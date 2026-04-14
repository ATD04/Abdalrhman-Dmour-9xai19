"""
Knowledge Service — PDF Page Text Extractor
Extracts text from rendered PDF page images using Gemini generation model.
"""
import logging
import time
from PIL import Image
from google import genai
from config import (
    GEMINI_API_KEY,
    ENABLE_LLM_PDF_TEXT_EXTRACTION,
    PDF_TEXT_EXTRACTION_MODEL,
    PDF_TEXT_EXTRACTION_MAX_RETRIES,
)

logger = logging.getLogger("knowledge-service.pdf-text-extractor")

EXTRACTION_PROMPT = (
    "Extract all visible text from this document page exactly as it appears. "
    "Preserve Arabic and English text, line breaks, numbers, and legal article numbering. "
    "Do not summarize. Do not translate. Return plain text only."
)


class PdfPageTextExtractor:
    """LLM-based PDF page text extractor."""

    def __init__(self):
        self.enabled = ENABLE_LLM_PDF_TEXT_EXTRACTION and bool(GEMINI_API_KEY)
        self.model = PDF_TEXT_EXTRACTION_MODEL
        self.max_retries = max(1, PDF_TEXT_EXTRACTION_MAX_RETRIES)
        self.client = genai.Client(api_key=GEMINI_API_KEY) if self.enabled else None

    def extract(self, image: Image.Image) -> str:
        """Extract page text from a PIL image using Gemini model."""
        if not self.enabled or self.client is None:
            return ""

        for attempt in range(self.max_retries):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=[EXTRACTION_PROMPT, image],
                )
                text = (response.text or "").strip()
                if text:
                    return text
                return ""
            except Exception as e:
                logger.warning(f"PDF text extraction attempt {attempt + 1} failed: {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)
        return ""
