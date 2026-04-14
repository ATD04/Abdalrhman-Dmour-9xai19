import argparse
import json
import time
import urllib.request

QUERIES = [
    "ما هو البند الثالث من قانون تنظيم العمل المهني؟",
    "ما هو البند الرابع من قانون تنظيم العمل المهني؟",
    "ما هو البند الخامس من قانون تنظيم العمل المهني؟",
    "ما هي المادة الثالثة في قانون العمل؟",
    "ما هي المادة الرابعة في قانون العمل؟",
    "ما العقوبات المنصوص عليها في قانون العمل المهني؟",
    "ما شروط الترخيص المهني بحسب القانون؟",
    "ما حقوق العامل في قانون العمل الأردني؟",
    "ما واجبات صاحب العمل في قانون العمل؟",
    "ما آلية تسوية النزاعات العمالية قانونيا؟",
    "ما هو البند السادس من قانون تنظيم العمل المهني؟",
    "ما هو البند السابع من قانون تنظيم العمل المهني؟",
    "ما هو البند الثامن من قانون تنظيم العمل المهني؟",
    "ما المقصود بعقد العمل في القانون؟",
    "ما مدة التجربة المسموحة في قانون العمل؟",
    "متى يحق للعامل إنهاء العقد قانونيا؟",
    "ما حالات الفصل المشروع في قانون العمل؟",
    "ما قواعد ساعات العمل والإجازات؟",
    "كيف ينظم القانون الحد الأدنى للأجور؟",
    "ما إجراءات الشكوى لدى وزارة العمل؟",
]


def percentile(sorted_vals, p):
    if not sorted_vals:
        return 0.0
    idx = max(0, int(len(sorted_vals) * p) - 1)
    return sorted_vals[idx]


def run(url: str):
    wall_times = []
    service_totals = []

    for i, q in enumerate(QUERIES, 1):
        payload = {
            "query": q,
            "user_type": "citizen",
            "language": "ar",
            "mode": "concise",
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        start = time.perf_counter()
        complete = None
        current_event = None
        with urllib.request.urlopen(req, timeout=180) as resp:
            for raw in resp:
                line = raw.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue
                if line.startswith("event: "):
                    current_event = line[len("event: "):]
                    continue
                if line.startswith("data: ") and current_event == "complete":
                    try:
                        complete = json.loads(line[len("data: "):])
                    except Exception:
                        complete = {}
                    break

        wall = time.perf_counter() - start
        total = float(((complete or {}).get("timings") or {}).get("total") or 0.0)
        wall_times.append(wall)
        service_totals.append(total)
        print(f"{i:02d}. wall={wall:.3f}s service_total={total:.3f}s query={q}")

    wall_sorted = sorted(wall_times)
    svc_sorted = sorted(service_totals)

    result = {
        "n": len(QUERIES),
        "wall": {
            "min": wall_sorted[0],
            "p50": wall_sorted[len(wall_sorted) // 2],
            "p90": percentile(wall_sorted, 0.9),
            "max": wall_sorted[-1],
            "avg": sum(wall_times) / len(wall_times),
        },
        "service_total": {
            "min": svc_sorted[0],
            "p50": svc_sorted[len(svc_sorted) // 2],
            "p90": percentile(svc_sorted, 0.9),
            "max": svc_sorted[-1],
            "avg": sum(service_totals) / len(service_totals),
        },
    }
    print("SUMMARY=" + json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:9200/query/stream")
    args = parser.parse_args()
    run(args.url)
