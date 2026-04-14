"""
Knowledge Service — Ingestion Engine
Orchestrates the full pipeline: file → classify → chunk → embed → store.

Smart behavior:
- If doc is a REGULATION: auto-extracts title + year, uses title as source_name
  for auto-versioning, tags with "regulation" and the year.
- If doc is GENERAL: uses provided source_name (or filename), no auto-versioning.
"""
import uuid
import hashlib
import logging
import os
from io import BytesIO
from pathlib import Path
from core.chunking import ChunkingEngine
from core.embedding import EmbeddingEngine
from core.classifier import DocumentClassifier
from storage.database import Database
from storage.vector_store import VectorStore
from config import SUPPORTED_EXTENSIONS, FILES_DIR
from ministries import ALLOWED_MINISTRY_NAMES

logger = logging.getLogger("knowledge-service.ingestion")


class IngestionEngine:
    """
    Orchestrator that takes a file, classifies it, chunks it, embeds it,
    and stores both metadata and vectors.
    """

    def __init__(self, db: Database, vector_store: VectorStore,
                 embedding_engine: EmbeddingEngine):
        self.db = db
        self.vs = vector_store
        self.ee = embedding_engine
        self.chunker = ChunkingEngine()
        self.classifier = DocumentClassifier()

    @staticmethod
    def _compute_hash(file_path: Path) -> str:
        """Compute SHA-256 hash of a file."""
        sha = hashlib.sha256()
        with open(file_path, "rb") as f:
            for block in iter(lambda: f.read(8192), b""):
                sha.update(block)
        return sha.hexdigest()

    def ingest(self, file_path: Path, source_name: str = "",
               tags: list[str] = None, language: str = "auto",
               chunk_strategy: str = "page",
               visibility: str | None = None,
               approval_status: str = "approved",
               constitution_date: str | None = None,
               ministry_name: str | None = None,
               group_name: str | None = None,
               group_role: str | None = None) -> dict:
        """
        Full ingestion pipeline with smart classification.

        For regulations (auto-detected):
          - Extracts official title from page 1 → used as source_name
          - Auto-versions if same title already exists
          - Tagged as "regulation" + year

        For general documents:
          - Uses provided source_name (or filename)
          - No auto-versioning (each upload = new source)
          - Tagged as "general"

        Returns: {"source_id", "filename", "source_name", "chunks_created",
                  "version", "status", "doc_type", "classification"}

        Raises ValueError if exact duplicate file is detected.
        """
        tags = tags or []
        filename = file_path.name
        ext = file_path.suffix.lower()

        if ext not in SUPPORTED_EXTENSIONS:
            raise ValueError(f"Unsupported file type: {ext}. Supported: {SUPPORTED_EXTENSIONS}")

        # ── Step 0: Duplicate detection (SHA-256 hash)
        file_hash = self._compute_hash(file_path)
        duplicate = self.db.check_duplicate(file_hash)
        if duplicate:
            raise ValueError(
                f"Duplicate file detected. This exact file was already ingested as "
                f"'{duplicate.get('source_name', duplicate['filename'])}' "
                f"(source_id: {duplicate['source_id']}, version: {duplicate['version']}). "
                f"If this is an updated version, the file content must be different."
            )

        # ── Step 0.5: Convert DOCX to PDF immediately
        if ext == ".docx":
            logger.info(f"Converting DOCX to PDF: {filename}")
            import tempfile
            import subprocess
            import shutil
            
            # Use a temporary directory for conversion
            tmpdir = Path(tempfile.mkdtemp())
            try:
                # Work on a local copy to avoid path/permission edge cases in mounted dirs.
                temp_input = tmpdir / file_path.name
                shutil.copy2(file_path, temp_input)

                lo_profile = tmpdir / "lo-profile"
                result = subprocess.run(
                    [
                        "libreoffice",
                        f"-env:UserInstallation=file://{lo_profile}",
                        "--headless",
                        "--nologo",
                        "--nodefault",
                        "--nofirststartwizard",
                        "--convert-to",
                        "pdf:writer_pdf_Export",
                        "--outdir",
                        str(tmpdir),
                        str(temp_input),
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                    env={**os.environ, "HOME": "/tmp", "TMPDIR": str(tmpdir)},
                )

                # LibreOffice output naming can vary; discover generated PDF robustly.
                pdf_candidates = sorted(tmpdir.glob("*.pdf"))
                if not pdf_candidates:
                    pdf_candidates = sorted(tmpdir.rglob("*.pdf"))

                if not pdf_candidates:
                    debug_msg = (result.stderr or result.stdout or "no converter output").strip()
                    raise ValueError(f"DOCX to PDF conversion failed: output file not found. Converter output: {debug_msg[:500]}")

                pdf_path = max(pdf_candidates, key=lambda p: p.stat().st_mtime)
                final_pdf_path = FILES_DIR / f"converted_{uuid.uuid4().hex[:8]}_{file_path.stem}.pdf"
                shutil.move(str(pdf_path), str(final_pdf_path))

                # Overwrite file_path, filename, and ext variables to pretend it was uploaded as a PDF
                file_path = final_pdf_path
                filename = file_path.name
                ext = ".pdf"
                logger.info(f"Successfully converted DOCX to PDF: {filename}")
            except Exception as e:
                shutil.rmtree(tmpdir, ignore_errors=True)
                raise ValueError(f"Failed to convert DOCX to PDF: {e}")
            finally:
                shutil.rmtree(tmpdir, ignore_errors=True)

        if ext == ".pdf":
            file_type = "pdf"
        elif ext == ".docx":
            file_type = "docx"
        elif ext == ".pptx":
            file_type = "pptx"
        elif ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            file_type = "image"
        else:
            file_type = "text"

        # ── Step 1: Chunk the file first (we need page 1 image for classification)
        logger.info(f"Chunking {filename}...")
        temp_source_id = uuid.uuid4().hex[:8]
        chunks = self.chunker.chunk(file_path, file_type, chunk_strategy, temp_source_id)
        logger.info(f"Created {len(chunks)} chunks")

        # ── Step 2: Classify the document using page 1
        classification = {"doc_type": "general", "title": None, "year": None}
        if len(chunks) > 0:
            first_chunk_content = chunks[0].content

            # PDFs and images: classify from rendered page image
            if file_type in ("pdf", "image"):
                from PIL import Image
                if isinstance(first_chunk_content, Image.Image):
                    logger.info("Classifying document from first page image...")
                    classification = self.classifier.classify(first_chunk_content)

            # DOCX / PPTX: classify from first text chunk
            elif file_type in ("docx", "pptx") and isinstance(first_chunk_content, str):
                logger.info("Classifying DOCX/PPTX document from first text chunk...")
                classification = self.classifier.classify(first_chunk_content)

        doc_type = classification["doc_type"]
        manual_group_role = (group_role or "").strip().lower()
        effective_group_role = manual_group_role or (
            "amendment" if classification.get("is_amendment", False) else "primary"
        )
        if effective_group_role not in {"primary", "amendment", "related"}:
            effective_group_role = "primary"

        # ── Step 3: Determine source_name and versioning
        is_amendment = classification.get("is_amendment", False)
        effective_constitution_date = (
            (constitution_date or "").strip() or classification.get("date_of_the_constitution")
        )
        raw_ministry_name = (ministry_name or "").strip() or classification.get("ministry_type") or ""
        normalized_ministry_name = raw_ministry_name.strip().lower().replace(" ", "_")
        effective_ministry_name = (
            normalized_ministry_name
            if normalized_ministry_name in ALLOWED_MINISTRY_NAMES
            else None
        )
        
        if doc_type == "regulation":
            # For regulations: use extracted title as source_name
            effective_name = classification.get("title") or source_name or filename
            # Auto-add regulation tag + year tag
            if "regulation" not in tags:
                tags.append("regulation")
            year = classification.get("document_year")
            if year and str(year) not in tags:
                tags.append(str(year))
            
            # Additional tags for filtering
            if is_amendment:
                tags.append("amendment")

            logger.info(f"📜 REGULATION detected: '{effective_name}' ({year}) | Amendment: {is_amendment}")
        else:
            # For general docs: use provided name or filename
            effective_name = source_name or filename
            if "general" not in tags:
                tags.append("general")
            logger.info(f"📄 GENERAL document: '{effective_name}'")

        # ── Resolve visibility: admin override > classifier inference > default
        effective_visibility = visibility or classification.get("visibility", "public")
        # Add sector + topic_keywords to tags for backward-compatible filtering
        sector = classification.get("sector", "general")
        if sector != "general" and sector not in tags:
            tags.append(sector)
        for kw in classification.get("topic_keywords", []):
            if kw and kw not in tags:
                tags.append(kw)

        if effective_constitution_date:
            classification["date_of_the_constitution"] = effective_constitution_date
        classification["manual_labels"] = {
            "constitution_date": (constitution_date or "").strip() or None,
            "ministry_name": (ministry_name or "").strip() or None,
            "group_name": (group_name or "").strip() or None,
            "group_role": effective_group_role,
        }

        derived_group_name = (group_name or "").strip()
        if not derived_group_name:
            if doc_type == "regulation" and is_amendment and classification.get("amends_target"):
                derived_group_name = classification.get("amends_target") or ""
            elif doc_type == "regulation":
                derived_group_name = effective_name

        group = self.db.ensure_source_group(
            group_name=derived_group_name,
            doc_type=doc_type,
            ministry_name=effective_ministry_name,
            constitution_date=effective_constitution_date,
        ) if derived_group_name else None

        # ── Step 4: Check for existing source
        existing = self.db.find_source_by_name(effective_name)
        
        if existing and doc_type == "regulation" and not is_amendment:
            # Auto-version: same regulation title (NOT an amendment) → new version
            source_id = existing["source_id"]
            old_version = existing["current_version"]
            version = self.db.bump_version(source_id, tags)
            self.db.update_source_labels(
                source_id,
                date_of_the_constitution=effective_constitution_date,
                ministry_name=effective_ministry_name,
                source_group_id=group["group_id"] if group else existing.get("source_group_id"),
                group_role=effective_group_role,
            )
            logger.info(f"🔄 Auto-versioning: '{effective_name}' v{old_version} → v{version}")
        elif existing and doc_type == "general":
            # General docs: don't version, create as separate source
            source_id = temp_source_id
            self.db.create_source(
                source_id=source_id,
                source_name=effective_name + f" ({uuid.uuid4().hex[:4]})",
                filename=filename,
                file_type=file_type,
                tags=tags,
                language=language,
                doc_type=doc_type,
                metadata=classification,
                visibility=effective_visibility,
                approval_status=approval_status,
                date_of_the_constitution=effective_constitution_date,
                ministry_name=effective_ministry_name,
                ministry_type=classification.get("ministry_type", "general"),
                source_group_id=group["group_id"] if group else None,
                group_role=effective_group_role,
            )
            version = 1
        else:
            # Brand new source
            source_id = temp_source_id
            self.db.create_source(
                source_id=source_id,
                source_name=effective_name,
                filename=filename,
                file_type=file_type,
                tags=tags,
                language=language,
                doc_type=doc_type,
                metadata=classification,
                visibility=effective_visibility,
                approval_status=approval_status,
                date_of_the_constitution=effective_constitution_date,
                ministry_name=effective_ministry_name,
                ministry_type=classification.get("ministry_type", "general"),
                source_group_id=group["group_id"] if group else None,
                group_role=effective_group_role,
            )
            version = 1
            logger.info(f"New source '{effective_name}' → {source_id}")

        # ── Step 5: Persist original file for preview/download
        try:
            import shutil
            original_target = FILES_DIR / f"{source_id}_{filename}"
            if not original_target.exists():
                shutil.copy2(file_path, original_target)
        except Exception as e:
            logger.warning(f"Failed to store original file for {source_id}: {e}")

        pdf_image_chunks = [c for c in chunks if c.chunk_type == "pdf_page_image"]
        embeddable_chunks = [c for c in chunks if c.chunk_type != "pdf_page_image"]

        # ── Step 6: Embed text and non-PDF-image chunks only
        logger.info(
            "Embedding %s chunks (skipping %s PDF page images)",
            len(embeddable_chunks),
            len(pdf_image_chunks),
        )
        contents = [c.content for c in embeddable_chunks]
        embeddings = self.ee.embed_batch(contents)
        logger.info(f"All {len(embeddings)} embeddings generated")

        # ── Step 7: Store metadata + vectors
        chunk_records = []
        vector_records = []
        page_text_chunk_ids: dict[int, str] = {}
        page_text_by_page: dict[int, str] = {}

        for chunk, embedding in zip(embeddable_chunks, embeddings):
            chunk_suffix = chunk.chunk_type
            chunk_id = f"{source_id}_v{version}_p{chunk.page}_{chunk_suffix}"
            # Enrich chunk metadata with language/doc_type/tags for UI & filters
            meta = dict(chunk.metadata or {})
            meta.setdefault("language", language)
            meta.setdefault("doc_type", doc_type)
            meta.setdefault("page", chunk.page)
            meta["page_key"] = f"{source_id}_p{chunk.page}"
            if "tags" not in meta:
                meta["tags"] = tags
            # Preserve extracted text for non-string chunks (e.g., PDF page images)
            # and only fall back to content-derived text when needed.
            if isinstance(chunk.content, str):
                meta["text"] = chunk.content
            elif not isinstance(meta.get("text"), str):
                meta["text"] = ""

            if chunk.chunk_type == "pdf_page_text":
                page_text_chunk_ids[chunk.page] = chunk_id
                page_text_by_page[chunk.page] = meta.get("text", "")

            chunk_records.append({
                "chunk_id": chunk_id,
                "source_id": source_id,
                "version": version,
                "page": chunk.page,
                "chunk_type": chunk.chunk_type,
                "metadata": meta,
            })
            vector_records.append({
                "chunk_id": chunk_id,
                "source_id": source_id,
                "version": version,
                "page": chunk.page,
                "chunk_type": chunk.chunk_type,
                "modality": meta.get("modality") or ("image" if "image" in chunk.chunk_type else "text"),
                "page_key": meta.get("page_key"),
                "metadata": meta,
                "embedding": embedding,
            })

        pdf_page_records = []
        for chunk in pdf_image_chunks:
            image_bytes = None
            if hasattr(chunk.content, "save"):
                buffer = BytesIO()
                chunk.content.save(buffer, format="PNG")
                image_bytes = buffer.getvalue()
            if not image_bytes:
                logger.warning(
                    "Skipping PDF page asset for source=%s page=%s because image bytes were empty",
                    source_id,
                    chunk.page,
                )
                continue

            page_key = f"{source_id}_p{chunk.page}"
            page_meta = dict(chunk.metadata or {})
            page_meta["page_key"] = page_key
            page_meta["linked_text_chunk_id"] = page_text_chunk_ids.get(chunk.page)
            if chunk.page in page_text_by_page:
                page_meta["extracted_text"] = page_text_by_page[chunk.page]

            pdf_page_records.append({
                "source_id": source_id,
                "version": version,
                "page": chunk.page,
                "page_key": page_key,
                "text_chunk_id": page_text_chunk_ids.get(chunk.page),
                "image_mime_type": page_meta.get("image_mime_type", "image/png"),
                "image_data": image_bytes,
                "width": page_meta.get("width"),
                "height": page_meta.get("height"),
                "metadata": page_meta,
            })

        self.db.create_chunks(chunk_records, ministry_name=effective_ministry_name)
        self.db.create_pdf_pages(pdf_page_records, ministry_name=effective_ministry_name)
        self.db.create_version(source_id, version, len(chunk_records),
                               ministry_name=effective_ministry_name)
        self.vs.save_embeddings(source_id, version, vector_records,
                                ministry_name=effective_ministry_name)

        # ── Step 7: Store file hash for duplicate detection
        self.db.store_hash(file_hash, source_id, version, filename,
                           ministry_name=effective_ministry_name)

        return {
            "source_id": source_id,
            "filename": filename,
            "source_name": effective_name,
            "chunks_created": len(chunk_records),
            "version": version,
            "status": "completed",
            "doc_type": doc_type,
            "source_group_id": group["group_id"] if group else None,
            "source_group_name": group["group_name"] if group else None,
            "group_role": effective_group_role,
            "ministry_name": effective_ministry_name,
            "date_of_the_constitution": effective_constitution_date,
            "classification": classification,
        }
