"""
Governance Microservice — Configuration
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
DB_PATH = DATA_DIR / "governance.db"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)

# ─── Gemini ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ─── Sibling Services ────────────────────────────────────────────────────────
AGENT_SERVICE_URL = os.getenv("AGENT_SERVICE_URL", "http://localhost:8200")
KNOWLEDGE_SERVICE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://localhost:8100")

# ─── Guardrail Settings ──────────────────────────────────────────────────────
INPUT_GUARDRAIL_ENABLED = os.getenv("INPUT_GUARDRAIL_ENABLED", "true").lower() == "true"
OUTPUT_GUARDRAIL_ENABLED = os.getenv("OUTPUT_GUARDRAIL_ENABLED", "true").lower() == "true"

# ─── Audit Settings ──────────────────────────────────────────────────────────
AUDIT_RETENTION_DAYS = int(os.getenv("AUDIT_RETENTION_DAYS", "90"))

# ─── Storage Settings ────────────────────────────────────────────────────────
USE_SUPABASE = os.getenv("USE_SUPABASE", os.getenv("use_supabase", "false")).lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("databse_url", ""))

# ─── Server ───────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8300"))
