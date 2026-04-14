"""
Agent Orchestration Microservice — Configuration
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Precedence chain (highest to lowest):
#   1. Docker Compose runtime env injection  — always wins, never overridden
#   2. agent-service/.env                   — local dev defaults (override=False)
#   3. .env.shared                          — shared platform defaults (override=False)
# Both file loads use override=False so that Docker Compose runtime values
# (injected before Python starts) are never clobbered by file-based values.
BASE_DIR = Path(__file__).parent
SHARED_ENV_PATH = BASE_DIR.parent.parent / ".env.shared"
load_dotenv(SHARED_ENV_PATH, override=False)
load_dotenv(BASE_DIR / ".env", override=False)

# ─── Paths ────────────────────────────────────────────────────────────────────
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "sessions.db"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)

# ─── Gemini ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
FAST_GEMINI_MODEL = os.getenv("FAST_GEMINI_MODEL", GEMINI_MODEL)
ROUTER_GEMINI_MODEL = os.getenv("ROUTER_GEMINI_MODEL", GEMINI_MODEL)
FAST_ROUTER_GEMINI_MODEL = os.getenv("FAST_ROUTER_GEMINI_MODEL", FAST_GEMINI_MODEL)
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "gemini-embedding-2-preview")
EMBEDDING_DIMENSIONS = int(os.getenv("EMBEDDING_DIMENSIONS", "768"))

# ─── Knowledge Service ───────────────────────────────────────────────────────
KNOWLEDGE_SERVICE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://localhost:8100")

# ─── Governance Service ──────────────────────────────────────────────────────
GOVERNANCE_SERVICE_URL = os.getenv("GOVERNANCE_SERVICE_URL", "http://governance-service:8300")
GOVERNANCE_ENABLED = os.getenv("GOVERNANCE_ENABLED", "true").lower() == "true"

# ─── Workflow Service ────────────────────────────────────────────────────────
WORKFLOW_SERVICE_URL = os.getenv("WORKFLOW_SERVICE_URL", "http://workflow-service:8400")
WORKFLOW_ENABLED = os.getenv("WORKFLOW_ENABLED", "true").lower() == "true"
# ─── Storage Settings ────────────────────────────────────────────────────────────
USE_SUPABASE = os.getenv("USE_SUPABASE", os.getenv("use_supabase", "false")).lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL", os.getenv("databse_url", ""))
# ─── Agent Settings ──────────────────────────────────────────────────────────
ENABLE_SINGLE_MODEL_RAG = os.getenv("ENABLE_SINGLE_MODEL_RAG", "true").lower() == "true"
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.4"))
TICKET_CONFIDENCE_THRESHOLD = float(os.getenv("TICKET_CONFIDENCE_THRESHOLD", str(CONFIDENCE_THRESHOLD)))
DEFAULT_TOP_K = int(os.getenv("DEFAULT_TOP_K", "5"))
CONCISE_TOP_K = int(os.getenv("CONCISE_TOP_K", "4"))
DETAILED_TOP_K = int(os.getenv("DETAILED_TOP_K", "8"))
MAX_CONVERSATION_DEPTH = int(os.getenv("MAX_CONVERSATION_DEPTH", "20"))
SESSION_TTL_HOURS = int(os.getenv("SESSION_TTL_HOURS", "24"))
ENABLE_SELF_VERIFICATION = os.getenv("ENABLE_SELF_VERIFICATION", "false").lower() == "true"
REQUEST_CACHE_TTL_SECONDS = int(os.getenv("REQUEST_CACHE_TTL_SECONDS", "300"))
WORKFLOW_LOOKUP_TIMEOUT_MS = int(os.getenv("WORKFLOW_LOOKUP_TIMEOUT_MS", "350"))
WORKFLOW_LOOKUP_NEGATIVE_CACHE_TTL_SECONDS = int(
    os.getenv("WORKFLOW_LOOKUP_NEGATIVE_CACHE_TTL_SECONDS", "120")
)
WORKFLOW_LOOKUP_BACKGROUND_BUDGET_MS = int(
    os.getenv("WORKFLOW_LOOKUP_BACKGROUND_BUDGET_MS", "100")
)
# Concise mode keeps a moderate token budget to avoid clipped structured answers.
CONCISE_MAX_OUTPUT_TOKENS = int(os.getenv("CONCISE_MAX_OUTPUT_TOKENS", "768"))
DETAILED_MAX_OUTPUT_TOKENS = int(os.getenv("DETAILED_MAX_OUTPUT_TOKENS", "32768"))
# 0 means no truncation; keep full chunk text to preserve answer fidelity.
CONCISE_EVIDENCE_CHAR_LIMIT = int(os.getenv("CONCISE_EVIDENCE_CHAR_LIMIT", "0"))
DETAILED_EVIDENCE_CHAR_LIMIT = int(os.getenv("DETAILED_EVIDENCE_CHAR_LIMIT", "0"))
FAST_MODE_RULE_ONLY_GUARDRAILS = os.getenv("FAST_MODE_RULE_ONLY_GUARDRAILS", "true").lower() == "true"
CONCISE_DEFER_AMENDMENTS = os.getenv("CONCISE_DEFER_AMENDMENTS", "true").lower() == "true"
ENABLE_CONCISE_QUICK_COMPLETE = os.getenv("ENABLE_CONCISE_QUICK_COMPLETE", "false").lower() == "true"
ENABLE_SERIAL_RETRIEVAL_FALLBACK = os.getenv("ENABLE_SERIAL_RETRIEVAL_FALLBACK", "false").lower() == "true"
ENABLE_STREAM_COMPLETION_RETRY = os.getenv("ENABLE_STREAM_COMPLETION_RETRY", "false").lower() == "true"
STREAM_COMPLETION_RETRY_MAX_ATTEMPTS = int(os.getenv("STREAM_COMPLETION_RETRY_MAX_ATTEMPTS", "1"))
ENFORCE_STRICT_SCOPE_FILTERS = os.getenv("ENFORCE_STRICT_SCOPE_FILTERS", "true").lower() == "true"
RETRIEVAL_CANDIDATE_MULTIPLIER = int(os.getenv("RETRIEVAL_CANDIDATE_MULTIPLIER", "1"))
RETRIEVAL_CANDIDATE_CAP = int(os.getenv("RETRIEVAL_CANDIDATE_CAP", "8"))
ORCHESTRATOR_RUNTIME = os.getenv("ORCHESTRATOR_RUNTIME", "v2").strip().lower()
V2_SINGLE_AGENT_ONLY = os.getenv("V2_SINGLE_AGENT_ONLY", "true").lower() == "true"
ENABLE_V2_AMENDMENT_LOOKUP = os.getenv("ENABLE_V2_AMENDMENT_LOOKUP", "false").lower() == "true"
ENABLE_V2_OUTPUT_GUARDRAIL = os.getenv("ENABLE_V2_OUTPUT_GUARDRAIL", "true").lower() == "true"
STREAM_ALLOW_CORRECTION_REPLACE = os.getenv("STREAM_ALLOW_CORRECTION_REPLACE", "false").lower() == "true"
STREAM_EMIT_EXTRACTIVE_FALLBACK_CORRECTION = os.getenv(
    "STREAM_EMIT_EXTRACTIVE_FALLBACK_CORRECTION", "false"
).lower() == "true"
ENABLE_ROUTER_EMBEDDING_FAST_PATH = os.getenv("ENABLE_ROUTER_EMBEDDING_FAST_PATH", "true").lower() == "true"
ROUTER_EMBEDDING_FAST_PATH_MIN_SCORE = float(os.getenv("ROUTER_EMBEDDING_FAST_PATH_MIN_SCORE", "0.88"))
ROUTER_PREWARM_ON_STARTUP = os.getenv("ROUTER_PREWARM_ON_STARTUP", "true").lower() == "true"
STREAM_WORKFLOW_LOOKUP_ENABLED = os.getenv("STREAM_WORKFLOW_LOOKUP_ENABLED", "false").lower() == "true"
ROUTER_EXECUTION_MODE = os.getenv("ROUTER_EXECUTION_MODE", "deterministic").strip().lower()
ENABLE_QUERY_EMBEDDING = os.getenv("ENABLE_QUERY_EMBEDDING", "false").lower() == "true"

# ─── Intent Clarity & Suggestions ───────────────────────────────────────────
ENABLE_INTENT_CLARITY_CHECK = os.getenv("ENABLE_INTENT_CLARITY_CHECK", "true").lower() == "true"
INTENT_CLARITY_TIMEOUT_MS = int(os.getenv("INTENT_CLARITY_TIMEOUT_MS", "1500"))

# ─── Full Document Retrieval (Detailed Mode) ────────────────────────────────
ENABLE_FULL_DOC_RETRIEVAL = os.getenv("ENABLE_FULL_DOC_RETRIEVAL", "true").lower() == "true"
FULL_DOC_MIN_SOURCE_CONCENTRATION = float(os.getenv("FULL_DOC_MIN_SOURCE_CONCENTRATION", "0.5"))
FULL_DOC_MIN_CHUNKS_FROM_SOURCE = int(os.getenv("FULL_DOC_MIN_CHUNKS_FROM_SOURCE", "3"))
FULL_DOC_MAX_PAGES = int(os.getenv("FULL_DOC_MAX_PAGES", "50"))
FULL_DOC_FETCH_TIMEOUT_SECONDS = float(os.getenv("FULL_DOC_FETCH_TIMEOUT_SECONDS", "5.0"))
# LLM-based adequacy judge: lets the model decide if chunks are enough or full doc is needed.
# Falls back to rule-based heuristics on timeout or error.
ENABLE_LLM_ADEQUACY_JUDGE = os.getenv("ENABLE_LLM_ADEQUACY_JUDGE", "true").lower() == "true"
LLM_ADEQUACY_TIMEOUT_SECONDS = float(os.getenv("LLM_ADEQUACY_TIMEOUT_SECONDS", "3.0"))

# ─── Ministry Agent Mapping ──────────────────────────────────────────────────
# Maps agent_id values to the ministry_name used for retrieval filtering.
# Imported from the shared ministry registry — single source of truth.
from ministries import AGENT_MINISTRY_MAP  # noqa: E402

# Semantic retrieval and review controls.
SEMANTIC_PRIMARY_MIN_SCORE = float(os.getenv("SEMANTIC_PRIMARY_MIN_SCORE", "0.60"))
SEMANTIC_PRIMARY_MIN_AVG_SCORE = float(os.getenv("SEMANTIC_PRIMARY_MIN_AVG_SCORE", "0.66"))
SEMANTIC_PRIMARY_MIN_CONCENTRATION = float(os.getenv("SEMANTIC_PRIMARY_MIN_CONCENTRATION", "0.42"))
ENABLE_POST_STREAM_SEMANTIC_REVIEW = os.getenv("ENABLE_POST_STREAM_SEMANTIC_REVIEW", "true").lower() == "true"
ENABLE_LLM_SEMANTIC_REVIEW_IN_CONCISE = os.getenv("ENABLE_LLM_SEMANTIC_REVIEW_IN_CONCISE", "false").lower() == "true"
POST_GEN_TIMEOUT_SECONDS = float(os.getenv("POST_GEN_TIMEOUT_SECONDS", "3.0"))
POST_GEN_TIMEOUT_CONCISE_SECONDS = float(os.getenv("POST_GEN_TIMEOUT_CONCISE_SECONDS", "1.2"))
POST_GEN_TIMEOUT_DETAILED_SECONDS = float(os.getenv("POST_GEN_TIMEOUT_DETAILED_SECONDS", "4.0"))

# ─── CORS ─────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins. "*" permits all (dev only).
ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "*").split(",")
    if o.strip()
]

# ─── Server ───────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8200"))
