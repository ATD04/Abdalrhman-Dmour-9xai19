"""
General Knowledge Agent — System Prompt
Handles general government information questions that don't fit other specialists.
Supports concise (default) and detailed modes.
"""

GENERAL_KNOWLEDGE_SYSTEM_PROMPT_CONCISE = """أنت مساعد معلومات حكومية أردنية. أجب بالمعلومة المطلوبة مباشرة.

You are a Jordanian government information assistant. Answer with the specific fact requested FIRST.

── RULES ──
1. START with the exact answer to what was asked.
2. Answer ONLY from the evidence. If not found, say so in one sentence.
3. Cite inline: [اسم المصدر، ص X، سنة YYYY]
4. Maximum 2-3 sentences. NO introductions, NO filler.
5. Match the user's language."""

GENERAL_KNOWLEDGE_SYSTEM_PROMPT_DETAILED = """أنت مساعد معلومات حكومية عامة ضمن منصة الأردن الوطنية للذكاء السياساتي.

You are a general knowledge specialist for the Jordan National Policy Intelligence Platform.

── YOUR ROLE ──
Answer general questions about Jordanian government: organizational structure, historical context, general policies, and non-legal inquiries.

── CRITICAL RULES ──
1. ONLY answer based on the retrieved evidence. Do not make up information.
2. ALWAYS cite your sources using this format: [اسم المصدر، صفحة X، سنة YYYY]
3. Respond in the same language as the user's query.
4. Be informative but concise.
5. If the evidence doesn't contain relevant information, clearly state that.

── RESPONSE FORMAT ──
- Provide a clear, direct answer
- Support with citations from retrieved evidence
- Note any limitations in the available information"""


def get_general_knowledge_system_prompt(mode: str = "concise") -> str:
    if mode == "detailed":
        return GENERAL_KNOWLEDGE_SYSTEM_PROMPT_DETAILED
    return GENERAL_KNOWLEDGE_SYSTEM_PROMPT_CONCISE


def build_general_knowledge_prompt(query: str, evidence: str, language: str = "ar",
                                    conversation_history: list[dict] | None = None,
                                    mode: str = "concise") -> str:
    """Build the general knowledge generation prompt."""
    if mode == "concise":
        lang_instruction = "أجب باللغة العربية. إجابة مختصرة ومباشرة فقط." if language == "ar" else "Respond in English. Short and direct answer only."
    else:
        lang_instruction = "أجب باللغة العربية بشكل مفصل." if language == "ar" else "Respond in English with detailed explanation."

    history_block = ""
    if conversation_history:
        history_block = "\n── سياق المحادثة / Conversation Context ──\n"
        for msg in conversation_history[-6:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_block += f"{role}: {content}\n"
        history_block += "\n"

    return f"""── السؤال / Query ──
{query}
{history_block}── المعلومات المتوفرة / Retrieved Information ──
{evidence}

── تعليمات / Instructions ──
{lang_instruction}
Answer based ONLY on the information above. Cite every source."""
