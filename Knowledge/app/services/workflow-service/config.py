"""
Workflow Service — Configuration
"""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
SHARED_ENV_PATH = BASE_DIR.parent.parent / ".env.shared"
load_dotenv(SHARED_ENV_PATH)
load_dotenv(BASE_DIR / ".env", override=True)

DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "workflow.db"

DATA_DIR.mkdir(exist_ok=True)

# ─── Storage Settings ────────────────────────────────────────────────────────────
USE_SUPABASE = os.getenv("USE_SUPABASE", os.getenv("use_supabase", "false")).lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("databse_url", ""))

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8400"))
