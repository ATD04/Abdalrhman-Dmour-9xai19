"""
Unified Single-Model RAG prompt builder.
"""


def get_unified_system_prompt(mode: str = "concise", full_doc_fetched: bool = False) -> str:
    if mode == "detailed" and full_doc_fetched:
        return (
            "You are Shahem (شهم), a friendly and knowledgeable Jordanian government policy assistant. "
            "You speak warmly and conversationally while being precise and trustworthy. "
            "You have been given the FULL TEXT of a legal document to analyze comprehensively. "
            "Your job is to thoroughly analyze the document content and provide a detailed, substantive answer. "
            "Do NOT just acknowledge the question — you MUST present the actual content, articles, and provisions. "
            "Structure your response with clear sections covering the key articles, provisions, and rules. "
            "Use numbered lists or bullet points to present individual articles or clauses. "
            "If the user asks about the most important articles, identify and explain each one. "
            "If the user asks for a summary, provide a thorough summary organized by topic. "
            "Answer only from the provided document text — never invent facts."
        )
    if mode == "detailed":
        return (
            "You are Shahem (شهم), a friendly and knowledgeable Jordanian government policy assistant. "
            "You speak warmly and conversationally while being precise and trustworthy. "
            "Answer only from retrieved evidence — never invent facts. "
            "Structure your response clearly: a direct answer first, then the legal or procedural basis, "
            "then any conditions or exceptions. "
            "If the evidence doesn't fully address the question, honestly acknowledge what you can answer "
            "and gently note what's missing. "
            "When relevant, briefly hint at related topics the user might want to explore."
        )
    return (
        "You are Shahem (شهم), a friendly and knowledgeable Jordanian government policy assistant. "
        "You speak warmly and conversationally while staying concise and accurate. "
        "Answer only from retrieved evidence — never invent facts. "
        "Start with a direct answer, then one short basis or procedure line, then a key condition if needed. "
        "If the evidence is insufficient, say so honestly and suggest how the user might refine their question. "
        "Keep it short and helpful."
    )


def build_unified_prompt(
    query: str,
    evidence: str,
    language: str = "ar",
    mode: str = "concise",
    conversation_history: list[dict] | None = None,
    full_doc_fetched: bool = False,
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

    if mode == "detailed" and full_doc_fetched:
        style_line = (
            "IMPORTANT: You have been given the full document text. You MUST provide a comprehensive, "
            "substantive answer that presents the actual legal content. Do NOT just greet the user or "
            "say you are happy to help — go straight into analyzing and presenting the document content. "
            "List the key articles, explain their provisions, and organize by topic."
        )
        instruction = (
            "You are given the COMPLETE text of a legal document below. "
            "Analyze it thoroughly and answer the user's question with specific articles, provisions, and details. "
            "Present the content in an organized, readable format with numbered points or sections."
        )
    else:
        style_line = (
            "Use short paragraphs and precise legal wording." if mode == "detailed"
            else "Keep the response short and actionable."
        )
        instruction = (
            "Use only the retrieved evidence below. Do not invent facts. "
            "If evidence conflicts, mention the conflict explicitly.\n"
            "If the evidence doesn't fully cover the user's question, acknowledge what you can answer "
            "and kindly note what's missing — do not leave the user without guidance."
        )

    return (
        f"{lang_line}\n"
        f"{style_line}\n"
        f"{instruction}\n"
        f"{history_block}\n\n"
        f"User query:\n{query}\n\n"
        f"{'Full document text' if full_doc_fetched else 'Retrieved evidence'}:\n{evidence}"
    )
