"""
Router Agent — Classification Prompt
Routes queries to one or more ministry-scoped agents.
All agent/sector lists are derived from the shared ministry registry.
"""
from ministries import MINISTRY_REGISTRY

VALID_AGENTS = list(MINISTRY_REGISTRY.keys())

VALID_SECTORS = sorted({info.sector for info in MINISTRY_REGISTRY.values()} | {"general"})

# ─── Build prompt fragments from registry ─────────────────────────────────────

def _build_agent_list() -> str:
    """Generate the numbered agent list for the prompt from the registry."""
    lines = []
    for i, (key, info) in enumerate(MINISTRY_REGISTRY.items(), 1):
        lines.append(f"{i}. {key} — {info.scope_en.split(',')[0].strip()}, {', '.join(info.topics_en[:5])}.")
    return "\n".join(lines)

_AGENT_LIST = _build_agent_list()
_SECTOR_LIST = ", ".join(VALID_SECTORS)
_AGENT_NAMES_PIPE = " | ".join(f'"{a}"' for a in VALID_AGENTS)
_SECTOR_NAMES_PIPE = " | ".join(f'"{s}"' for s in VALID_SECTORS)


ROUTER_SYSTEM_INSTRUCTION = """You are a query router for the Jordan National Policy Intelligence Platform (منصة الأردن الوطنية للذكاء السياساتي).

Your job is to analyze a user's query and determine:
1. What is their intent?
2. Which high-level sector best fits it?
3. Which ministry agent should handle it?
4. Does it require multiple ministry agents (delegation)?
5. Is the user asking to be handed to a human specialist?

Route based on ministry ownership first, not generic legal-vs-service categories.
You MUST respond in JSON only."""

ROUTER_PROMPT_TEMPLATE = """Analyze this query and classify it.

── QUERY ──
"{query}"

── USER CONTEXT ──
User type: {user_type}
Language: {language}
Sector hint: {sector_hint}

── MINISTRY AGENTS ──
""" + _AGENT_LIST + """

── HIGH-LEVEL SECTORS (pick ONE) ──
""" + _SECTOR_LIST + """

── ROUTING PRINCIPLES ──
- Choose the agent whose ministry corpus is most likely to contain the answer.
- Use `justice_agent` for constitutional questions, courts, judicial powers, and legal interpretation.
- Use `requires_delegation=true` only when the user clearly needs multiple ministry viewpoints.
- Set `wants_human_handoff=true` only when the user meaningfully asks to talk to a person or specialist officer.
- If multiple agents are needed, add one sub-question per agent. Each sub-question can restate the original query from that ministry's perspective.

── DELEGATION EXAMPLES ──
- "قارن بين حقوق العامل في قانون العمل وحقوق الموظف الحكومي" → labor_agent + civil_service_agent
- "ما العلاقة بين تسجيل الزواج والمحاكم الشرعية؟" → civil_status_agent + justice_agent
- "ما إجراءات تصريح العمل لغير الأردنيين وما الجزاءات القانونية للمخالفة؟" → labor_agent + justice_agent

── INTENT CATEGORIES ──
- "legal_inquiry" — asking about a legal rule, court power, article, law, regulation, or legal consequence
- "service_inquiry" — asking about a procedure, document, requirement, application flow, or practical service step
- "policy_comparison" — comparing ministry rules, responsibilities, or legal frameworks
- "general_inquiry" — general government question
- "out_of_scope" — clearly unrelated to Jordanian government responsibilities

Respond in JSON only:
{{
  "intent": "legal_inquiry" | "service_inquiry" | "policy_comparison" | "general_inquiry" | "out_of_scope",
  "sector": """ + _SECTOR_NAMES_PIPE + """,
  "agent": """ + _AGENT_NAMES_PIPE + """,
  "requires_delegation": true | false,
  "sub_questions": [
    {{"question": "...", "agent": "...", "sector": "..."}}
  ],
  "wants_human_handoff": true | false,
  "path": "single_agent_fast" | "multi_agent_orchestrated",
  "confidence_hint": 0.0-1.0
}}"""


def build_router_prompt(query: str, user_type: str = "citizen",
                        language: str = "ar", sector_hint: str | None = None) -> str:
    """Build the router classification prompt with the query context."""
    return ROUTER_PROMPT_TEMPLATE.format(
        query=query,
        user_type=user_type,
        language=language,
        sector_hint=sector_hint or "none",
    )
