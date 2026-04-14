# Knowledge Service — Complete Documentation

## 1. Overview
The **Knowledge Service** is a standalone, microservice-based Retrieval-Augmented Generation (RAG) backend. It handles document ingestion, smart chunking, embedding generation, vector storage, and semantic retrieval. 

This service is designed to be highly modular and can be easily extracted and used in other projects that require a robust document processing and vector search engine.

---

## 2. Key Features
- **Multi-Format Support:** Ingests PDF, DOCX, PPTX, TXT, HTML, and Images.
- **Visual Page Rendering:** Automatically generates high-resolution PNG previews for PDF pages. For DOCX and PPTX, it converts them to PDF under the hood (using `docx2pdf` and LibreOffice) to generate accurate visual page renderings.
- **Smart Chunking:** Extracts text while preserving page-level boundaries. Supports `page`, `paragraph`, and fixed-size chunking strategies.
- **Arabic OCR Support:** Integrated with Tesseract (`tesseract-ocr-ara`) to extract text from scanned Arabic documents and images.
- **Semantic Search:** Uses Google Gemini's Embedding API (`gemini-embedding-2-preview`) for high-quality semantic vector search.
- **Document Classification & Versioning:** Auto-detects document types (e.g., "regulation" vs "general"). Auto-versions documents if an updated file with the same title is ingested.
- **Local SQLite Vector Store:** Uses a highly optimized SQLite database in WAL (Write-Ahead Logging) mode for both relational metadata and vector embeddings (using exact cosine similarity or specialized extensions).

---

## 3. Tech Stack
- **Framework:** FastAPI (Python 3.11)
- **Embeddings:** `google-genai` (Gemini API)
- **Document Processing:** PyMuPDF (`fitz`), `python-docx`, `python-pptx`, `Pillow`
- **Format Conversion:** `docx2pdf`, `libreoffice` (headless)
- **OCR:** `pytesseract`, Tesseract-OCR
- **Database:** `aiosqlite` (SQLite)

---

## 4. Prerequisites & System Dependencies

If running locally without Docker, you must install the following system dependencies:
- **LibreOffice:** For PPTX to PDF conversion (`brew install --cask libreoffice` or `apt-get install libreoffice`).
- **Tesseract OCR:** For image/scanned PDF text extraction (`brew install tesseract tesseract-lang` or `apt-get install tesseract-ocr tesseract-ocr-ara`).
- **MuPDF & dependencies:** For PyMuPDF rendering.

If running via **Docker**, the provided `Dockerfile` already installs all necessary Debian packages.

---

## 5. Environment Configuration (`.env`)

Create a `.env` file in the root of the service:

```ini
# Server Settings
HOST=0.0.0.0
PORT=9100

# Gemini API (Required for Embeddings & Classification)
GEMINI_API_KEY=AIzaSy...
GEMINI_EMBEDDING_MODEL=gemini-embedding-2-preview

# Chunking & Rendering Settings
PDF_DPI=150
```

---

## 6. Architecture & Pipeline

### The Ingestion Pipeline (`core/ingestion.py`)
1. **Duplicate Detection:** Computes SHA-256 hash of the uploaded file. Rejects exact duplicates.
2. **Format Conversion:** If DOCX/PPTX, converts to a temporary PDF.
3. **Chunking & Page Rendering:** Parses the file, extracts text, and renders page-by-page PNGs. Uses Tesseract for OCR if no text is found in images/PDFs.
4. **Classification:** Sends the first page/chunk to a Gemini LLM prompt to classify the document (Type, Sector, Tags, Title).
5. **Versioning:** Checks if a document with the same extracted title already exists. If yes, increments the version.
6. **Embedding:** Sends all text chunks to the Gemini Embedding API in batches.
7. **Storage:** Saves metadata to `sources` table, chunks to `chunks` table, and vectors to `embeddings` table. Saves page images to disk.

---

## 7. API Reference

The service runs on **Port 9100**.

### 7.1 Health Check
**`GET /health`**
Returns the status of the service, total ingested sources, and available models.

### 7.2 Ingestion
**`POST /ingest`**
Upload a single file.
- **Form Data:**
  - `file`: The document file (UploadFile)
  - `source_name` (optional): Override the document name.
  - `tags` (optional): Comma-separated tags (e.g., "finance, 2024").
  - `language` (optional): Default is `auto`.

**`POST /ingest/batch`**
Upload multiple files simultaneously.
- **Form Data:**
  - `files`: List of files.
  - `tags`: Applied to all files in the batch.

### 7.3 Retrieval & Search
**`POST /retrieve`**
Perform a semantic search across ingested documents.
- **JSON Payload:**
  ```json
  {
    "query": "ما هي شروط التقاعد المبكر؟",
    "top_k": 5,
    "doc_type": "regulation", 
    "tags": ["labor"]
  }
  ```
- **Response:** Returns an array of matched chunks, including the text snippet, cosine similarity score, source metadata, and page number.

### 7.4 Document Management
**`GET /sources`**
List all ingested documents with pagination.

**`DELETE /sources/{source_id}`**
Delete a document and all associated chunks, embeddings, and page images.

### 7.5 File & Page Viewers
**`GET /sources/{source_id}/file`**
Download or view the original uploaded file (PDF, DOCX, PPTX, etc.).

**`GET /sources/{source_id}/pages`**
Returns a JSON list of all available generated page images for a document.

**`GET /sources/{source_id}/page/{page_number}`**
Returns the actual PNG image of the specified page. Used heavily by the UI for visual search results.

---

## 8. Running with Docker

The easiest way to integrate this into another project is via Docker Compose:

```yaml
services:
  knowledge-service:
    build:
      context: ./knowledge-service
      dockerfile: Dockerfile
    container_name: knowledge-service
    ports:
      - "9100:9100"
    env_file:
      - ./knowledge-service/.env
    volumes:
      - knowledge-data:/app/data
    restart: unless-stopped

volumes:
  knowledge-data:
```

### Build and Run:
```bash
docker compose up -d --build knowledge-service
```

## 9. Next Steps for Extraction
If moving this to a new repository:
1. Copy the entire `services/knowledge-service/` directory.
2. Ensure the `Dockerfile` retains the `libreoffice` and `tesseract-ocr` dependencies.
3. Provide the correct `GEMINI_API_KEY` in the new environment.
4. The service will spin up fully independently, ready to serve as the Knowledge Engine for any Agentic or LLM framework.