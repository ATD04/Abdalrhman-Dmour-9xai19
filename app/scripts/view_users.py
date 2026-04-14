import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    psycopg = None
    dict_row = None

# Load database config
load_dotenv(".env.shared")
DATABASE_URL = os.getenv("DATABASE_URL")
USE_SUPABASE = os.getenv("USE_SUPABASE", "false").lower() == "true"

def view_registered_users():
    if USE_SUPABASE:
        if not DATABASE_URL:
            print("DATABASE_URL not found in .env.shared")
            return
        if not psycopg:
            print("psycopg is not installed. Cannot connect to Supabase.")
            return

        print("Connecting to Supabase (PostgreSQL)...")
        try:
            with psycopg.connect(DATABASE_URL, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    cur.execute("SELECT user_id, email, full_name, role, created_at, password_hash FROM users;")
                    users = cur.fetchall()
                    display_users(users)
        except Exception as e:
            print(f"Error accessing Supabase: {e}")
    else:
        # Check for local SQLite DB
        # The workflow service stores its DB in app/services/workflow-service/data/workflow.db
        script_dir = Path(__file__).parent.absolute()
        db_path = script_dir.parent / "services" / "workflow-service" / "data" / "workflow.db"
        
        if not db_path.exists():
            # Try alternate path if running from root
            db_path = Path("app/services/workflow-service/data/workflow.db")
            
        if not db_path.exists():
            print(f"Workflow SQLite database not found at {db_path}")
            return

        print(f"Connecting to Local SQLite ({db_path})...")
        try:
            with sqlite3.connect(str(db_path)) as conn:
                conn.row_factory = sqlite3.Row
                cur = conn.cursor()
                cur.execute("SELECT user_id, email, full_name, role, created_at, password_hash FROM users;")
                users = [dict(row) for row in cur.fetchall()]
                display_users(users)
        except Exception as e:
            print(f"Error accessing SQLite: {e}")

def display_users(users):
    if not users:
        print("No users registered yet.")
        return

    print(f"\n--- {len(users)} REGISTERED USERS ---")
    print(f"{'Email':<30} | {'Full Name':<20} | {'Role':<10} | {'Hashed Password'}")
    print("-" * 120)
    
    for u in users:
        # Security note: We never show the full hash in logs/dashboards to prevent leakage
        # but for this admin view, we'll show a truncated version
        pw_hash = u.get('password_hash', 'N/A')
        truncated_hash = f"{pw_hash[:15]}...{pw_hash[-5:]}" if pw_hash != 'N/A' else 'N/A'
        print(f"{str(u['email']):<30} | {str(u['full_name']):<20} | {str(u['role']):<10} | {truncated_hash}")
    print("-" * 120)

if __name__ == "__main__":
    view_registered_users()
