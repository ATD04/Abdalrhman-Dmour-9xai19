import tempfile
import unittest
from pathlib import Path
import sys
from typing import cast

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from storage.database import Database


class WorkflowSemanticMatchTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        db_path = Path(self.tmp.name) / "workflow_test.db"
        self.db = Database(db_path=db_path)

        self._create_closed_case(
            case_id="case_sess",
            request_id="r1",
            session_id="sess-1",
            user_id="user-1",
            query="how to renew permit",
            embedding=[1.0, 0.0, 0.0],
            answer="session answer",
            faq=False,
        )
        self._create_closed_case(
            case_id="case_user",
            request_id="r2",
            session_id="sess-2",
            user_id="user-1",
            query="permit renewal docs",
            embedding=[0.95, 0.05, 0.0],
            answer="user answer",
            faq=False,
        )
        self._create_closed_case(
            case_id="case_faq",
            request_id="r3",
            session_id="sess-3",
            user_id="user-2",
            query="public faq",
            embedding=[0.0, 1.0, 0.0],
            answer="faq answer",
            faq=True,
        )

    def tearDown(self):
        self.tmp.cleanup()

    def _create_closed_case(self, case_id, request_id, session_id, user_id, query, embedding, answer, faq):
        self.db.create_case(
            {
                "case_id": case_id,
                "request_id": request_id,
                "session_id": session_id,
                "user_id": user_id,
                "query": query,
                "user_type": "citizen",
                "sector_primary": "general",
                "sector_labels": ["general"],
                "priority": "medium",
                "escalation_reason": "no_answer",
                "query_embedding": embedding,
            }
        )
        self.db.resolve_case(case_id, resolution_answer=answer, resolution_note=None, actor="tester")
        if faq:
            self.db.mark_faq_candidate(case_id, actor="tester")

    def test_same_session_match_preferred(self):
        match = self.db.find_resolved_answer(
            query="renew permit",
            user_id="user-1",
            session_id="sess-1",
            query_embedding=[1.0, 0.0, 0.0],
        )
        self.assertIsNotNone(match)
        match = cast(dict, match)
        self.assertEqual(match.get("match_scope"), "same_session")
        self.assertEqual(match.get("case_id"), "case_sess")

    def test_same_user_match_when_session_missing(self):
        match = self.db.find_resolved_answer(
            query="renew permit",
            user_id="user-1",
            session_id="sess-x",
            query_embedding=[0.95, 0.05, 0.0],
        )
        self.assertIsNotNone(match)
        match = cast(dict, match)
        self.assertEqual(match.get("match_scope"), "same_user")
        self.assertEqual(match.get("case_id"), "case_user")

    def test_faq_global_match_requires_faq_candidate(self):
        match = self.db.find_resolved_answer(
            query="faq query",
            user_id="user-x",
            session_id="sess-x",
            query_embedding=[0.0, 1.0, 0.0],
        )
        self.assertIsNotNone(match)
        match = cast(dict, match)
        self.assertEqual(match.get("match_scope"), "faq")
        self.assertEqual(match.get("case_id"), "case_faq")

    def test_below_threshold_no_match(self):
        match = self.db.find_resolved_answer(
            query="unrelated",
            user_id="user-1",
            session_id="sess-1",
            query_embedding=[0.0, 0.0, 1.0],
        )
        self.assertIsNone(match)


if __name__ == "__main__":
    unittest.main()
