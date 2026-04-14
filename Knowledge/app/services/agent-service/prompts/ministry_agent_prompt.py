"""
Ministry Agent Prompts
Generic prompt builder for ministry-specific RAG agents.
"""


def _is_importance_query(query: str) -> bool:
    lowered = (query or "").strip().lower()
    keywords = {
        "اهم",
        "الأهم",
        "ابرز",
        "أبرز",
        "key",
        "most important",
        "important articles",
        "top articles",
    }
    return any(keyword in lowered for keyword in keywords)


def get_ministry_system_prompt(mode: str = "concise") -> str:
    if mode == "detailed":
        return (
            "أنت مساعد وزاري متخصص في منصة حكومية أردنية. "
            "أجب فقط اعتمادًا على الأدلة المسترجعة. "
            "إذا كانت الأدلة غير كافية فاذكر ذلك بوضوح دون اختلاق. "
            "ابدأ دائما بالإجابة المباشرة، ثم الأساس أو الإجراء، ثم الشروط أو الاستثناءات. "
            "عند ضعف الأدلة اذكر درجة عدم اليقين بشكل صريح."
        )
    return (
        "أنت مساعد وزاري متخصص في منصة حكومية أردنية. "
        "أجب بإيجاز وبدقة اعتمادًا فقط على الأدلة المسترجعة. "
        "ابدأ بإجابة مباشرة ثم سطر موجز للأساس أو الإجراء ثم أي شرط مهم. "
        "إذا لم تكفِ الأدلة، فاذكر ذلك بوضوح."
    )


def build_ministry_prompt(
    query: str,
    evidence: str,
    ministry_name: str,
    language: str = "ar",
    conversation_history: list[dict] | None = None,
    mode: str = "concise",
) -> str:
    history_block = ""
    if conversation_history:
        lines = []
        for msg in conversation_history[-4:]:
            role = msg.get("role", "")
            content = (msg.get("content") or "").strip()
            if role and content:
                lines.append(f"{role}: {content[:400]}")
        if lines:
            history_block = "\n\nConversation context:\n" + "\n".join(lines)

    lang_line = "Respond in Arabic." if language == "ar" else "Respond in English."
    style_line = (
        "Structure strictly as: 1) direct answer, 2) legal/procedural basis, 3) conditions/exceptions."
        if mode == "detailed"
        else "Provide a short answer with direct answer first, then one basis/procedure line, then key condition if any."
    )
    importance_line = ""
    if _is_importance_query(query):
        importance_line = (
            "If the user asks for the most important clauses/articles, provide a ranked shortlist (up to 5) from the evidence, "
            "and briefly justify each item based on legal effect or practical impact. "
            "Do not respond with 'cannot classify importance' unless evidence is actually missing."
        )

    return (
        f"You are handling a query for ministry agent: {ministry_name}.\n"
        f"{lang_line}\n"
        f"{style_line}\n"
        f"{importance_line}\n"
        "Use only the evidence below. Do not invent facts.\n"
        "If the evidence is mixed, prioritize the most directly relevant passages.\n"
        "If evidence is thin, explicitly state uncertainty and avoid definitive claims.\n"
        f"{history_block}\n\n"
        f"User query:\n{query}\n\n"
        f"Retrieved evidence:\n{evidence}"
    )
