"""
Knowledge & Retrieval Microservice — Configuration
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load centralized shared env first, then service-local env overrides
BASE_DIR = Path(__file__).parent
SHARED_ENV_PATH = BASE_DIR.parent.parent / ".env.shared"
load_dotenv(SHARED_ENV_PATH)
load_dotenv(BASE_DIR / ".env", override=True)

# ─── Paths ────────────────────────────────────────────────────────────────────
DATA_DIR = BASE_DIR / "data"
VECTORS_DIR = DATA_DIR / "vectors"
PAGES_DIR = DATA_DIR / "pages"
FILES_DIR = DATA_DIR / "files"
DB_PATH = DATA_DIR / "knowledge.db"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
VECTORS_DIR.mkdir(exist_ok=True)
PAGES_DIR.mkdir(exist_ok=True)
FILES_DIR.mkdir(exist_ok=True)

# ─── Gemini ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2-preview")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))

# ─── Ingestion ────────────────────────────────────────────────────────────────
PDF_DPI = int(os.getenv("PDF_DPI", "200"))
EXTRACT_PDF_TEXT = os.getenv("EXTRACT_PDF_TEXT", "false").lower() == "true"
ENABLE_LLM_PDF_TEXT_EXTRACTION = os.getenv("ENABLE_LLM_PDF_TEXT_EXTRACTION", "true").lower() == "true"
PDF_TEXT_EXTRACTION_MODEL = os.getenv("PDF_TEXT_EXTRACTION_MODEL", "gemini-2.5-flash")
PDF_TEXT_EXTRACTION_MAX_RETRIES = int(os.getenv("PDF_TEXT_EXTRACTION_MAX_RETRIES", "2"))
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "100"))
SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".txt", ".html", ".htm", ".docx"}
DEFAULT_CHUNK_STRATEGY = os.getenv("DEFAULT_CHUNK_STRATEGY", "page")  # page | fixed | paragraph

# ─── Retrieval ────────────────────────────────────────────────────────────────
DEFAULT_TOP_K = int(os.getenv("DEFAULT_TOP_K", "5"))
DEFAULT_MIN_SCORE = float(os.getenv("DEFAULT_MIN_SCORE", "0.0"))
RETRIEVE_OVERSAMPLE_FACTOR = int(os.getenv("RETRIEVE_OVERSAMPLE_FACTOR", "1"))
# ─── Storage Settings ────────────────────────────────────────────────────────────
USE_SUPABASE = os.getenv("USE_SUPABASE", os.getenv("use_supabase", "false")).lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("databse_url", ""))
# ─── Server ───────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8100"))
