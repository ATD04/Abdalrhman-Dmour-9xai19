import unittest
from pathlib import Path
import sys
from typing import Any, cast

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.retrieval import RetrievalEngine


class FakeDB:
    def list_sources(self):
        return [
            {
                "source_id": "s1",
                "approval_status": "approved",
                "visibility": "public",
                "metadata": {"sector": "general"},
                "tags": [],
                "doc_type": "general",
                "ministry_name": "general",
                "ministry_type": "general",
            }
        ]

    def get_source(self, source_id):
        return {
            "source_id": source_id,
            "source_name": "Source",
            "filename": "file.txt",
            "current_version": 1,
            "file_type": "txt",
            "tags": [],
            "language": "ar",
            "metadata": {"sector": "general"},
            "ministry_name": "general",
            "ministry_type": "general",
        }

    def get_chunks_by_ids(self, chunk_ids):
        return {
            cid: {"metadata": {"text": "evidence text"}, "chunk_type": "text"}
            for cid in chunk_ids
        }


class FakeVectorStore:
    def __init__(self):
        self.last_query_embedding = None

    def search(self, query_embedding, source_ids, top_k, min_score):
        self.last_query_embedding = query_embedding
        return [{"chunk_id": "c1", "source_id": "s1", "page": 1, "score": 0.91}]


class FakeEmbedding:
    def __init__(self):
        self.calls = 0

    def embed(self, query):
        self.calls += 1
        return [0.5, 0.5, 0.5]


class QueryEmbeddingReuseTests(unittest.TestCase):
    def test_precomputed_query_embedding_skips_embed_call(self):
        db = FakeDB()
        vs = FakeVectorStore()
        ee = FakeEmbedding()
        engine = RetrievalEngine(
            db=cast(Any, db),
            vector_store=cast(Any, vs),
            embedding_engine=cast(Any, ee),
        )

        result = engine.retrieve(
            query="constitutional powers",
            query_embedding=[0.1, 0.2, 0.3],
            top_k=3,
            sector="general",
        )

        self.assertEqual(ee.calls, 0)
        self.assertEqual(vs.last_query_embedding, [0.1, 0.2, 0.3])
        self.assertEqual(len(result["results"]), 1)


if __name__ == "__main__":
    unittest.main()
