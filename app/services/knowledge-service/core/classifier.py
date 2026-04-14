"""
Knowledge Service — Document Classifier
Reads the first page of a document and determines:
  1. Is it a regulation/law (قانون/نظام/تعليمات) or a general document?
  2. If it's a regulation: extracts the official title and year.

This enables automated versioning for regulations and proper labeling.
"""
import json
import logging
from typing import Union
from PIL import Image
from google import genai
from config import GEMINI_API_KEY
from ministries import VALID_MINISTRY_TYPES

logger = logging.getLogger("knowledge-service.classifier")

VALID_SECTORS = [
    "water", "health", "education", "justice", "labor", "finance",
    "energy", "agriculture", "trade", "environment", "transport",
    "digital", "tourism", "culture", "youth", "investment", "interior",
    "planning", "social_development", "public_works", "foreign_affairs",
    "general",
]

VALID_KNOWLEDGE_LEVELS = [
    "L1_general", "L2_sectoral", "L3_institutional", "L4_departmental",
]

VALID_VISIBILITY = ["public", "internal", "confidential"]


CLASSIFICATION_PROMPT = """Look at this document's first page carefully.
You must extract ALL of the following metadata.

── SECTION A: Document Type ──
1. doc_type: Is this an official law, regulation, or legal decree?
   - "regulation" = Laws (قانون), Regulations (نظام), Instructions (تعليمات), Decisions (قرارات), Decrees (مراسيم), Official Gazette entries (الجريدة الرسمية)
   - "general" = Strategic plans, guides (دليل), reports (تقرير), manuals, presentations, code of conduct, internal docs

── SECTION B: Legal Metadata (only if doc_type = "regulation") ──
2. title: Extract the official title in Arabic exactly as written.
3. document_year: The year it was issued (e.g. "2024").
4. document_number: The number of the document (e.g. "4").
5. legal_category: One of: "Original Law", "Amending Law", "Regulation", "Instruction", "Decision", "Decree".
6. is_amendment: True ONLY if it's an amending law/regulation (e.g., "قانون معدل").
7. amends_target: If is_amendment is True, what is the title of the original law it amends? Otherwise null.

── SECTION C: Sector & Routing (REQUIRED for ALL documents) ──
8. sector: Which government sector does this document belong to? Pick ONE:
   water, health, education, justice, labor, finance, energy, agriculture,
   trade, environment, transport, digital, tourism, culture, youth,
   investment, interior, planning, social_development, public_works,
   foreign_affairs, general
9. knowledge_level: What level of guidance is this?
   - "L1_general" = Cross-government policies, general rules
   - "L2_sectoral" = Sector-specific regulations/guides (e.g. water sector law)
   - "L3_institutional" = Specific to one entity/ministry
   - "L4_departmental" = Specific to one department within an entity
10. visibility: Who should see this document?
   - "public" = Published laws, citizen-facing guides, public reports
   - "internal" = Internal circulars, HR rules, employee procedures
   - "confidential" = Classified or sensitive documents
11. topic_keywords: 1-3 short keywords describing the subject (e.g. ["billing", "tariffs"]).
12. owner_entity: The official entity that owns/published this document (Arabic name).
13. date_of_the_constitution: If this document is a constitution or foundation doc, what is its primary date? Null otherwise.
14. ministry_type: Which specific department group does this belong to? Pick ONE:
    """ + ", ".join(VALID_MINISTRY_TYPES) + """

Respond in JSON only:
{
  "doc_type": "regulation" or "general",
  "title": "..." or null,
  "document_year": "..." or null,
  "document_number": "..." or null,
  "legal_category": "..." or null,
  "is_amendment": true or false,
  "amends_target": "..." or null,
  "sector": "...",
  "knowledge_level": "...",
  "visibility": "...",
  "topic_keywords": ["...", "..."],
  "owner_entity": "..." or null,
  "date_of_the_constitution": "..." or null,
  "ministry_type": "..."
}
"""


class DocumentClassifier:
    """
    Classifies documents by reading their first page with Gemini Flash.
    Returns: doc_type, title, legal metadata, sector, knowledge_level,
    visibility, topic_keywords, and owner_entity.
    """

    def __init__(self):
        self._client = None
        self.model = "gemini-2.5-flash"

    @property
    def client(self) -> genai.Client:
        """Lazily initialize the Gemini client."""
        if self._client is None:
            self._client = genai.Client(api_key=GEMINI_API_KEY)
        return self._client

    def classify(self, first_page: Union[Image.Image, str]) -> dict:
        """
        Classify a document from its first page (image or text).
        Returns: dict with all classification fields.
        """
        try:
            if isinstance(first_page, Image.Image):
                contents = [first_page, CLASSIFICATION_PROMPT]
            else:
                # Treat as text-only classification (e.g. DOCX/PPTX first chunk)
                contents = [CLASSIFICATION_PROMPT, str(first_page)]

            response = self.client.models.generate_content(
                model=self.model,
                contents=contents,
            )
            text = response.text.strip()

            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

            result = json.loads(text)

            # ── Normalize doc_type ──
            doc_type = result.get("doc_type", "general").lower().strip()
            if doc_type not in ("regulation", "general"):
                doc_type = "general"

            # ── Normalize sector ──
            sector = result.get("sector", "general").lower().strip()
            if sector not in VALID_SECTORS:
                sector = "general"

            # ── Normalize knowledge_level ──
            knowledge_level = result.get("knowledge_level", "L2_sectoral")
            if knowledge_level not in VALID_KNOWLEDGE_LEVELS:
                knowledge_level = "L2_sectoral"

            # ── Normalize visibility ──
            visibility = result.get("visibility", "public").lower().strip()
            if visibility not in VALID_VISIBILITY:
                visibility = "public"

            # ── Normalize topic_keywords ──
            topic_keywords = result.get("topic_keywords", [])
            if not isinstance(topic_keywords, list):
                topic_keywords = []
            topic_keywords = [str(k).strip().lower() for k in topic_keywords[:3]]

            # ── Normalize ministry_type ──
            ministry_type = result.get("ministry_type", "general").lower().strip()
            if ministry_type not in VALID_MINISTRY_TYPES:
                ministry_type = "general"

            classified = {
                "doc_type": doc_type,
                "title": result.get("title"),
                "document_year": result.get("document_year"),
                "document_number": result.get("document_number"),
                "legal_category": result.get("legal_category"),
                "is_amendment": bool(result.get("is_amendment", False)),
                "amends_target": result.get("amends_target"),
                "sector": sector,
                "knowledge_level": knowledge_level,
                "visibility": visibility,
                "topic_keywords": topic_keywords,
                "owner_entity": result.get("owner_entity"),
                "date_of_the_constitution": result.get("date_of_the_constitution"),
                "ministry_type": ministry_type,
            }

            logger.info(
                f"Classified: {classified['doc_type']} | sector: {classified['sector']} | "
                f"visibility: {classified['visibility']} | level: {classified['knowledge_level']} | "
                f"title: {classified['title']}"
            )
            return classified

        except Exception as e:
            logger.warning(f"Classification failed: {e}. Defaulting to 'general'.")
            return {
                "doc_type": "general",
                "title": None,
                "document_year": None,
                "document_number": None,
                "legal_category": None,
                "is_amendment": False,
                "amends_target": None,
                "sector": "general",
                "knowledge_level": "L2_sectoral",
                "visibility": "public",
                "topic_keywords": [],
                "owner_entity": None,
                "date_of_the_constitution": None,
                "ministry_type": "general",
            }
