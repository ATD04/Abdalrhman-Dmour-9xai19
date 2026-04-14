
import sys
from pathlib import Path
import json

# Add storage to path
sys.path.append(str(Path.cwd() / "app/services/workflow-service"))

from storage.database import Database

def test_resolve():
    db = Database(db_path=Path("test.db"))
    
    # 1. Create a case
    payload = {
        "request_id": "test_req_1",
        "query": "How to test?",
        "user_type": "citizen",
        "sector_primary": "general",
        "priority": "medium",
        "escalation_reason": "test",
        "query_embedding": [0.1, 0.2, 0.3]
    }
    case = db.create_case(payload)
    case_id = case["case_id"]
    print(f"Created case: {case_id}")
    
    # 2. Resolve it
    db.resolve_case(
        case_id=case_id,
        resolution_answer="This is the answer.",
        resolution_note="Some note",
        actor="tester"
    )
    print("Resolved case")
    
    # 3. Verify
    updated = db.get_case(case_id)
    print(f"Resolution Answer: {updated['resolution_answer']}")
    print(f"Status: {updated['status']}")
    
    # 4. Try to find it
    match = db.find_resolved_answer(
        query="test",
        query_embedding=[0.1, 0.2, 0.3],
        session_id=None,
        user_id=None
    )
    print(f"Match found in FAQ: {match is not None}")

if __name__ == "__main__":
    test_resolve()
