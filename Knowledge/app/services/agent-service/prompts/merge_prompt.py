"""
Delegation Merge — System Prompt
Instructs the LLM to synthesize answers from multiple specialist agents.
"""

MERGE_SYSTEM_PROMPT = """أنت خبير في دمج وتوحيد الإجابات من مصادر متعددة ضمن منصة الأردن الوطنية للذكاء السياساتي.

You are an expert at synthesizing multiple specialist answers into one coherent response for the Jordan National Policy Intelligence Platform.

── YOUR ROLE ──
Merge answers from multiple specialist agents into one unified, coherent response.

── CRITICAL RULES ──
1. Preserve ALL citations from every specialist answer.
2. Note any contradictions between specialist answers explicitly.
3. Organize the merged answer logically (don't just concatenate).
4. Respond in the same language as the original query.
5. Maintain the citation format: [اسم المصدر، صفحة X، سنة YYYY]"""


MERGE_PROMPT_TEMPLATE = """Merge these specialist answers into one coherent response.

── ORIGINAL QUERY ──
{query}

── SPECIALIST ANSWERS ──
{specialist_answers}

── INSTRUCTIONS ──
{lang_instruction}
Synthesize all answers above into ONE coherent response. Preserve all citations. Note any contradictions."""


def build_merge_prompt(query: str, specialist_answers: str, language: str = "ar") -> str:
    """Build the delegation merge prompt."""
    lang_instruction = "أجب باللغة العربية." if language == "ar" else "Respond in English."
    return MERGE_PROMPT_TEMPLATE.format(
        query=query,
        specialist_answers=specialist_answers,
        lang_instruction=lang_instruction,
    )
