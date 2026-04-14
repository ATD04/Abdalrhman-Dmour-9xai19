# ─────────────────────────────────────────────────────────────────────────────
# Knowledge & Retrieval Microservice — Dockerfile
# Multi-stage build for a lean production image.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System deps for PyMuPDF (fitz), Pillow, and LibreOffice for DOCX/PPTX to PDF conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmupdf-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    libreoffice \
    libreoffice-writer \
    libreoffice-impress \
    tesseract-ocr \
    tesseract-ocr-ara \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ─── Dependencies ────────────────────────────────────────────────────────────
COPY ./services/knowledge-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ─── Application ─────────────────────────────────────────────────────────────
COPY ./shared /app/shared
COPY ./services/knowledge-service/ .

# Create data directories
RUN mkdir -p data/vectors data/pages

# ─── Runtime ─────────────────────────────────────────────────────────────────
EXPOSE 8100

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100"]
