"""
Governance Service — Audit Logger
Structured logging engine for all query/response interactions.
"""
import logging
from storage.database import Database

logger = logging.getLogger("governance-service.audit")


class AuditLogger:
    """Handles audit log creation, retrieval, and cleanup."""

    def __init__(self):
        self.db = Database()

    def log(self, entry: dict) -> int:
        """
        Insert an audit log entry.

        Args:
            entry: Dict with audit fields (request_id, query, user_type, etc.)

        Returns:
            The row ID of the inserted record.
        """
        row_id = self.db.insert_audit(entry)
        logger.info(f"Audit logged: request_id={entry.get('request_id')}, "
                     f"user_type={entry.get('user_type')}, "
                     f"escalated={entry.get('escalated', False)}")
        return row_id

    def get(self, request_id: str) -> dict | None:
        """Get a single audit record by request_id."""
        return self.db.get_audit(request_id)

    def query(self, filters: dict) -> tuple[list[dict], int]:
        """
        Query audit logs with filters.

        Returns:
            (records, total_count)
        """
        return self.db.query_audit(filters)

    def cleanup(self) -> int:
        """Delete records older than AUDIT_RETENTION_DAYS. Returns count deleted."""
        count = self.db.cleanup_old_records()
        if count > 0:
            logger.info(f"Cleaned up {count} old audit records")
        return count
