import unittest
from pathlib import Path
import sys
from typing import Any, cast

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.tools import KnowledgeTools
import config


class FakeKnowledgeClient:
    def __init__(self):
        self.calls = []

    def retrieve(self, **kwargs):
        self.calls.append(kwargs)
        ministry = kwargs.get("ministry_name")
        if ministry:
            return {
                "results": [
                    {
                        "score": 0.58,
                        "source_id": "m1",
                        "source_name": "Filtered Ministry Source",
                        "page": 1,
                        "text": "weak",
                        "metadata": {"retrieval_chunk_type": "pdf_page_text", "sector": "general"},
                    }
                ]
            }
        return {
            "results": [
                {
                    "score": 0.93,
                    "source_id": "c1",
                    "source_name": "Constitution",
                    "page": 1,
                    "text": "strong",
                    "metadata": {"retrieval_chunk_type": "pdf_page_text", "sector": "justice"},
                },
                {
                    "score": 0.81,
                    "source_id": "c2",
                    "source_name": "Cross-scope Source",
                    "page": 5,
                    "text": "second",
                    "metadata": {"retrieval_chunk_type": "pdf_page_text", "sector": "justice"},
                },
            ]
        }


class SemanticRetrievalTests(unittest.TestCase):
    def test_retrieval_does_not_widen_when_strict_scope_enabled(self):
        client = FakeKnowledgeClient()
        tools = KnowledgeTools(client=cast(Any, client))

        prev_strict_scope = config.ENFORCE_STRICT_SCOPE_FILTERS
        prev_serial_fallback = config.ENABLE_SERIAL_RETRIEVAL_FALLBACK
        config.ENFORCE_STRICT_SCOPE_FILTERS = True
        config.ENABLE_SERIAL_RETRIEVAL_FALLBACK = True

        try:
            chunks = tools.search_knowledge(
                query="what does the constitution say",
                ministry_name="labor_agent",
                sector="labor",
                user_type="citizen",
                top_k=2,
                query_embedding=[0.1, 0.2, 0.3],
            )
        finally:
            config.ENFORCE_STRICT_SCOPE_FILTERS = prev_strict_scope
            config.ENABLE_SERIAL_RETRIEVAL_FALLBACK = prev_serial_fallback

        self.assertEqual(len(client.calls), 1)
        self.assertIsNotNone(client.calls[0].get("query_embedding"))
        self.assertEqual(chunks[0]["source_name"], "Filtered Ministry Source")

    def test_retrieval_widens_filters_when_not_strict(self):
        client = FakeKnowledgeClient()
        tools = KnowledgeTools(client=cast(Any, client))

        prev_strict_scope = config.ENFORCE_STRICT_SCOPE_FILTERS
        prev_serial_fallback = config.ENABLE_SERIAL_RETRIEVAL_FALLBACK
        config.ENFORCE_STRICT_SCOPE_FILTERS = False
        config.ENABLE_SERIAL_RETRIEVAL_FALLBACK = True

        try:
            chunks = tools.search_knowledge(
                query="what does the constitution say",
                ministry_name="labor_agent",
                sector="labor",
                user_type="citizen",
                top_k=2,
                query_embedding=[0.1, 0.2, 0.3],
            )
        finally:
            config.ENFORCE_STRICT_SCOPE_FILTERS = prev_strict_scope
            config.ENABLE_SERIAL_RETRIEVAL_FALLBACK = prev_serial_fallback

        self.assertEqual(len(client.calls), 1)
        self.assertGreater(chunks[0]["score"], chunks[1]["score"])
        self.assertEqual(chunks[0]["source_name"], "Constitution")

    def test_semantic_ranking_is_score_only(self):
        tools = KnowledgeTools(client=cast(Any, FakeKnowledgeClient()))
        ranked = tools._semantic_rank_chunks(
            [
                {"score": 0.4, "source_name": "A"},
                {"score": 0.9, "source_name": "B"},
                {"score": 0.7, "source_name": "C"},
            ]
        )
        self.assertEqual([c["source_name"] for c in ranked], ["B", "C", "A"])


if __name__ == "__main__":
    unittest.main()
