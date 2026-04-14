"""
Knowledge Service — Chunking Engine
Converts uploaded files into chunks ready for embedding.
Supports: PDF (page-as-image), images, text files, HTML.
"""
import fitz  # PyMuPDF
from io import BytesIO
from pathlib import Path
from PIL import Image
from dataclasses import dataclass, field
from config import PDF_DPI, EXTRACT_PDF_TEXT
from core.pdf_text_extractor import PdfPageTextExtractor


@dataclass
class Chunk:
    """A single chunk of content ready for embedding."""
    page: int
    chunk_type: str            # "pdf_page", "image", "text"
    content: Image.Image | str  # PIL Image or text string
    metadata: dict = field(default_factory=dict)


class ChunkingEngine:
    """Converts files into a list of Chunks based on the chosen strategy."""

    def __init__(self, dpi: int = PDF_DPI):
        self.dpi = dpi
        self.pdf_text_extractor = PdfPageTextExtractor()

    def chunk(self, file_path: Path, file_type: str,
              strategy: str = "page", source_id: str = "") -> list[Chunk]:
        """
        Main entry point. Routes to the appropriate chunker.
        Returns a list of Chunk objects.
        """
        ext = file_path.suffix.lower()

        if ext == ".pdf":
            return self._chunk_pdf(file_path, source_id)
        elif ext in (".png", ".jpg", ".jpeg", ".webp", ".gif"):
            return self._chunk_image(file_path)
        elif ext in (".txt",):
            return self._chunk_text(file_path, strategy)
        elif ext in (".html", ".htm"):
            return self._chunk_html(file_path, strategy)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    # ─── PDF ──────────────────────────────────────────────────────────

    def _chunk_pdf(self, file_path: Path, source_id: str) -> list[Chunk]:
        """Render each PDF page and create linked page-image and page-text chunks."""
        doc = fitz.open(str(file_path))
        chunks = []

        for i, page in enumerate(doc):
            page_num = i + 1
            zoom = self.dpi / 72
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            img = Image.open(BytesIO(pix.tobytes("png")))

            page_key = f"{source_id}_p{page_num}"

            # Preferred extraction path: Gemini LLM over rendered page image.
            page_text = self.pdf_text_extractor.extract(img)
            if not page_text and EXTRACT_PDF_TEXT:
                # Optional fallback to direct PDF text extraction for born-digital PDFs.
                page_text = page.get_text("text").strip()

            chunks.append(Chunk(
                page=page_num,
                chunk_type="pdf_page_image",
                content=img,
                metadata={
                    "page_key": page_key,
                    "modality": "image",
                    "width": img.width,
                    "height": img.height,
                    "image_mime_type": "image/png",
                    "has_text_chunk": bool(page_text),
                },
            ))

            if page_text:
                chunks.append(Chunk(
                    page=page_num,
                    chunk_type="pdf_page_text",
                    content=page_text,
                    metadata={
                        "page_key": page_key,
                        "modality": "text",
                        "text": page_text,
                    },
                ))
        doc.close()
        return chunks

    # ─── Image ────────────────────────────────────────────────────────

    def _chunk_image(self, file_path: Path) -> list[Chunk]:
        """Single image = single chunk."""
        img = Image.open(str(file_path))
        return [Chunk(
            page=1,
            chunk_type="image",
            content=img,
            metadata={"width": img.width, "height": img.height},
        )]

    # ─── Text ─────────────────────────────────────────────────────────

    def _chunk_text(self, file_path: Path, strategy: str) -> list[Chunk]:
        """Split text files into chunks."""
        text = file_path.read_text(encoding="utf-8")

        if strategy == "paragraph":
            paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        else:
            # Fixed-size chunking (~1000 chars per chunk)
            chunk_size = 1000
            paragraphs = [text[i:i + chunk_size]
                          for i in range(0, len(text), chunk_size)]

        return [
            Chunk(page=i + 1, chunk_type="text", content=p)
            for i, p in enumerate(paragraphs)
        ]

    # ─── HTML ─────────────────────────────────────────────────────────

    def _chunk_html(self, file_path: Path, strategy: str) -> list[Chunk]:
        """Strip HTML tags, then chunk as text."""
        import re
        raw = file_path.read_text(encoding="utf-8")
        # Simple tag stripping
        text = re.sub(r'<[^>]+>', ' ', raw)
        text = re.sub(r'\s+', ' ', text).strip()

        # Write stripped text to a temp approach and reuse text chunker
        chunk_size = 1000
        parts = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
        return [
            Chunk(page=i + 1, chunk_type="text", content=p)
            for i, p in enumerate(parts)
        ]
