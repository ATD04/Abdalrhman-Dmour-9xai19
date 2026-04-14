"""
Father Orchestrator — Synthesis Prompt
The father agent receives curated research from one or more son agents and produces
the final authoritative answer that is returned to the user.
"""

ORCHESTRATOR_SYSTEM_PROMPT = """أنت الوكيل الأب (Father Orchestrator) في منصة الأردن الوطنية للذكاء السياساتي.
You are the Father Orchestrator Agent for the Jordan National Policy Intelligence Platform (JNPI).

── YOUR ROLE ──
You receive curated, source-backed research from one or more specialist son agents.
Each son agent has already searched the official Jordanian policy knowledge base and gathered
relevant laws, regulations, service procedures, or policy analyses.

Your sole job is to synthesize their findings into ONE final, authoritative answer for the user.

── SYNTHESIS RULES ──
1. PRESERVE ALL CITATIONS — every source referenced by a son must appear in your answer.
   Use the format: [اسم المصدر، صفحة X، سنة YYYY] / [Source Name, Page X, Year YYYY]
2. DO NOT INVENT — only use information that appears in the son agent reports below.
3. RESOLVE CONTRADICTIONS — if specialists disagree, state both findings and explain the discrepancy.
4. ORGANIZE LOGICALLY — do not just concatenate; structure the answer coherently for the user.
5. ATTRIBUTE CLEARLY — for cross-disciplinary answers, make clear which domain each finding belongs to.
6. RESPOND IN THE USER'S LANGUAGE — match the language of the original query exactly.
7. MAINTAIN GOVERNMENT-GRADE ACCURACY — neutral, factual, and precise."""


ORCHESTRATOR_SINGLE_PROMPT_TEMPLATE = """The specialist son agent has completed its research. Deliver the final answer to the user.

── ORIGINAL QUERY ──
{query}

── SON AGENT REPORT ({agent_name}) ──
{agent_answer}

── INSTRUCTIONS ──
{lang_instruction}
Present the son agent's findings as the final answer. Preserve all citations exactly as written."""


ORCHESTRATOR_MULTI_PROMPT_TEMPLATE = """Multiple specialist son agents have completed their research on this cross-disciplinary query.
Synthesize their findings into ONE coherent final answer.

── ORIGINAL QUERY ──
{query}

── SON AGENT REPORTS ──
{son_reports}

── INSTRUCTIONS ──
{lang_instruction}
Synthesize ALL son agent findings above into ONE coherent response.
Preserve every citation. Resolve any contradictions. Organize clearly."""


def build_single_son_prompt(query: str, agent_name: str, agent_answer: str,
                             language: str = "ar") -> str:
    """Build the father's prompt when a single son agent served the query."""
    lang_instruction = "أجب باللغة العربية." if language == "ar" else "Respond in English."
    return ORCHESTRATOR_SINGLE_PROMPT_TEMPLATE.format(
        query=query,
        agent_name=agent_name,
        agent_answer=agent_answer,
        lang_instruction=lang_instruction,
    )


def build_multi_son_prompt(query: str, son_results: list[dict], language: str = "ar") -> str:
    """
    Build the father's synthesis prompt when multiple son agents contributed.

    son_results: list of {"agent": str, "sector": str, "question": str, "answer": str}
    """
    parts = []
    for i, sr in enumerate(son_results, 1):
        parts.append(
            f"── Son Agent {i}: {sr['agent']} (Sector: {sr.get('sector', 'general')}) ──\n"
            f"Sub-Question: {sr.get('question', query)}\n"
            f"Research Findings:\n{sr['answer']}"
        )
    son_reports = "\n\n".join(parts)

    lang_instruction = "أجب باللغة العربية." if language == "ar" else "Respond in English."
    return ORCHESTRATOR_MULTI_PROMPT_TEMPLATE.format(
        query=query,
        son_reports=son_reports,
        lang_instruction=lang_instruction,
    )
