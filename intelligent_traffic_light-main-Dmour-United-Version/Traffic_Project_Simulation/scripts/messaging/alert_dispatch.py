"""External alert dispatch for high-severity traffic incidents.

Supported channels:
  - webhook: POST JSON payload to an HTTP endpoint
  - email: send plain-text alerts via SMTP
  - noop: record the dispatch attempt without external I/O
"""

from __future__ import annotations

import json
import logging
import smtplib
import sys
import time
from collections import deque
from dataclasses import dataclass
from email.message import EmailMessage
from typing import Any
from urllib import request

try:
    from ..core.live_support import now_iso
except ImportError:
    from core.live_support import now_iso

logger = logging.getLogger("its.alert_dispatch")
sys.modules.setdefault("alert_dispatch", sys.modules[__name__])

SEVERITY_ORDER = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}


@dataclass
class DispatchResult:
    channel: str
    success: bool
    detail: str


class AlertDispatcher:
    def __init__(self, config: dict[str, Any]) -> None:
        block = config.get("alert_dispatch", {}) or {}
        self.enabled = bool(block.get("enabled", False))
        self.channels = list(block.get("channels", ["noop"]))
        self.min_severity = str(block.get("min_severity", "HIGH")).upper()
        self.webhook_url = block.get("webhook_url")
        self.timeout_s = float(block.get("request_timeout_seconds", 5.0))
        self.dedup_window_s = float(block.get("dedup_window_seconds", 900.0))
        self.email_cfg = block.get("email", {}) or {}
        self.sent_keys: dict[str, float] = {}
        self.history: deque[dict[str, Any]] = deque(maxlen=50)

    def describe(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "channels": self.channels,
            "min_severity": self.min_severity,
            "webhook_configured": bool(self.webhook_url),
            "email_enabled": bool(self.email_cfg.get("enabled")),
            "recent_dispatches": list(self.history),
        }

    def dispatch(self, alerts: list[dict[str, Any]], context: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        if not self.enabled:
            return []

        dispatched: list[dict[str, Any]] = []
        for alert in alerts:
            normalized = self._normalize_alert(alert, context or {})
            if normalized is None:
                continue
            severity = str(normalized.get("severity", "LOW")).upper()
            if SEVERITY_ORDER.get(severity, -1) < SEVERITY_ORDER.get(self.min_severity, 2):
                continue

            key = self._dedup_key(normalized)
            if not self._should_dispatch(key):
                continue

            results = [self._dispatch_channel(channel, normalized) for channel in self.channels]
            entry = {
                "timestamp": now_iso(),
                "key": key,
                "alert": normalized,
                "results": [result.__dict__ for result in results],
            }
            self.history.appendleft(entry)
            self.sent_keys[key] = time.monotonic()
            dispatched.append(entry)
        return dispatched

    def _normalize_alert(self, alert: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
        incident_type = alert.get("incident_type") or alert.get("type")
        direction = alert.get("direction")
        severity = str(alert.get("severity", "LOW")).upper()
        if not incident_type or not direction:
            return None

        message = alert.get("message") or alert.get("reason") or alert.get("recommendation") or incident_type
        recommendation = alert.get("tip") or alert.get("recommendation") or "Review the incident immediately."
        return {
            "incident_type": incident_type,
            "direction": direction,
            "severity": severity,
            "message": message,
            "recommendation": recommendation,
            "source": alert.get("source", "runtime"),
            "wall_time": context.get("wall_time") or now_iso(),
            "controller_tls_id": context.get("controller_tls_id"),
            "source_system": "wadi_saqra_its",
        }

    def _dedup_key(self, alert: dict[str, Any]) -> str:
        minute_bucket = str(alert.get("wall_time", now_iso()))[:16]
        return f"{alert['incident_type']}:{alert['direction']}:{minute_bucket}"

    def _should_dispatch(self, key: str) -> bool:
        now = time.monotonic()
        self.sent_keys = {
            existing_key: ts for existing_key, ts in self.sent_keys.items()
            if now - ts <= self.dedup_window_s
        }
        previous = self.sent_keys.get(key)
        if previous is None:
            return True
        return now - previous > self.dedup_window_s

    def _dispatch_channel(self, channel: str, alert: dict[str, Any]) -> DispatchResult:
        channel = str(channel).lower()
        try:
            if channel == "webhook":
                return self._send_webhook(alert)
            if channel == "email":
                return self._send_email(alert)
            if channel == "noop":
                return DispatchResult(channel="noop", success=True, detail="Recorded without external delivery.")
            return DispatchResult(channel=channel, success=False, detail="Unsupported alert channel.")
        except Exception as exc:  # noqa: BLE001
            logger.warning("Alert dispatch via %s failed: %s", channel, exc)
            return DispatchResult(channel=channel, success=False, detail=str(exc))

    def _send_webhook(self, alert: dict[str, Any]) -> DispatchResult:
        if not self.webhook_url:
            return DispatchResult(channel="webhook", success=False, detail="webhook_url is not configured.")
        body = json.dumps(alert).encode("utf-8")
        req = request.Request(
            self.webhook_url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=self.timeout_s) as response:  # noqa: S310
            code = getattr(response, "status", 200)
        return DispatchResult(channel="webhook", success=200 <= int(code) < 300, detail=f"HTTP {code}")

    def _send_email(self, alert: dict[str, Any]) -> DispatchResult:
        if not self.email_cfg.get("enabled"):
            return DispatchResult(channel="email", success=False, detail="Email dispatch is disabled.")
        recipients = list(self.email_cfg.get("to", []))
        if not recipients:
            return DispatchResult(channel="email", success=False, detail="No email recipients configured.")

        msg = EmailMessage()
        msg["Subject"] = f"[{alert['severity']}] {alert['incident_type']} on {alert['direction']}"
        msg["From"] = self.email_cfg.get("from", "its@localhost")
        msg["To"] = ", ".join(recipients)
        msg.set_content(
            "\n".join(
                [
                    f"Time: {alert['wall_time']}",
                    f"Direction: {alert['direction']}",
                    f"Severity: {alert['severity']}",
                    f"Incident: {alert['incident_type']}",
                    f"Message: {alert['message']}",
                    f"Recommendation: {alert['recommendation']}",
                ]
            )
        )

        host = self.email_cfg.get("host", "localhost")
        port = int(self.email_cfg.get("port", 25))
        use_tls = bool(self.email_cfg.get("use_tls", False))
        username = self.email_cfg.get("username")
        password = self.email_cfg.get("password")

        with smtplib.SMTP(host, port, timeout=self.timeout_s) as smtp:
            if use_tls:
                smtp.starttls()
            if username:
                smtp.login(username, password or "")
            smtp.send_message(msg)
        return DispatchResult(channel="email", success=True, detail=f"SMTP {host}:{port}")
