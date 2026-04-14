import json
import urllib.request

URL = "http://localhost:9200/query/stream"
PAYLOAD = {
    "query": "قانون حقوق الأشخاص ذوي الإعاقة لسنة 2017)",
    "language": "en",
    "mode": "concise",
    "user_type": "citizen",
}

for i in range(6):
    req = urllib.request.Request(
        URL,
        data=json.dumps(PAYLOAD).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    answer = ""
    completion_retry = None
    generation = None
    confidence = None

    with urllib.request.urlopen(req, timeout=90) as resp:
        for raw in resp:
            line = raw.decode("utf-8", errors="ignore").rstrip("\n")
            if not line.startswith("data: "):
                continue
            payload_raw = line[6:]
            try:
                obj = json.loads(payload_raw)
            except Exception:
                continue

            if isinstance(obj, dict) and "answer" in obj and "timings" in obj:
                answer = str(obj.get("answer") or "")
                timings = obj.get("timings") or {}
                completion_retry = timings.get("completion_retry")
                generation = timings.get("generation")
                confidence = obj.get("confidence")
                break

    stripped = answer.strip()
    end = stripped[-1:] if stripped else ""
    print(
        "run=%d conf=%s completion_retry=%s generation=%s end=%r len=%d"
        % (i + 1, confidence, completion_retry, generation, end, len(stripped))
    )
