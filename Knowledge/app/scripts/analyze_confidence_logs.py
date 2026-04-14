import ast
import re
import statistics as st
import sys

entries = []
pattern = re.compile(r"Confidence: ([0-9.]+) \| breakdown: (\{.*\})")

for line in sys.stdin:
    match = pattern.search(line)
    if not match:
        continue
    confidence = float(match.group(1))
    breakdown = ast.literal_eval(match.group(2))
    entries.append((confidence, breakdown))

print(f"total_conf_entries={len(entries)}")
if not entries:
    raise SystemExit(0)

scores = sorted(c for c, _ in entries)
p50 = scores[len(scores) // 2]
p90 = scores[max(0, int(len(scores) * 0.9) - 1)]
print(f"confidence_min={scores[0]:.4f}")
print(f"confidence_p50={p50:.4f}")
print(f"confidence_p90={p90:.4f}")
print(f"confidence_max={scores[-1]:.4f}")

mismatch = [(c, b) for c, b in entries if b.get("severe_metadata_mismatch_penalty")]
print(f"severe_mismatch_count={len(mismatch)}")
if mismatch:
    mscores = sorted(c for c, _ in mismatch)
    mp50 = mscores[len(mscores) // 2]
    print(f"severe_mismatch_min={mscores[0]:.4f}")
    print(f"severe_mismatch_p50={mp50:.4f}")
    print(f"severe_mismatch_max={mscores[-1]:.4f}")

    by_sector = {}
    for _, b in mismatch:
        sector = b.get("routed_sector", "unknown")
        by_sector[sector] = by_sector.get(sector, 0) + 1
    print("severe_mismatch_by_routed_sector=" + str(by_sector))

    print("last_severe_mismatch_breakdown=" + str(mismatch[-1][1]))
