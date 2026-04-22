import json
import random
import math

def bezier(p0, p1, p2, t):
    """Quadratic Bezier interpolation."""
    x = (1-t)**2 * p0[0] + 2*(1-t)*t * p1[0] + t**2 * p2[0]
    y = (1-t)**2 * p0[1] + 2*(1-t)*t * p1[1] + t**2 * p2[1]
    return x, y

def generate():
    metadata = {
        "fps": 30.0, "width": 3452, "height": 2064,
        "total_frames": 3323, "model": "YOLOv8m-Grounded", "site_id": "AMM-WS-01"
    }

    # Realistic lane paths grounded to Wadi Saqra geometry
    # Camera is elevated/angled - vehicles travel across mid-to-bottom of frame
    paths = {
        "W-E":  {"p0": (-0.05, 0.58), "p1": (0.45, 0.72), "p2": (1.05, 0.50)},
        "E-W":  {"p0": (1.05, 0.50), "p1": (0.55, 0.65), "p2": (-0.05, 0.58)},
        "S-N":  {"p0": (0.43, 0.98), "p1": (0.44, 0.65), "p2": (0.48, 0.30)},
        "N-S":  {"p0": (0.50, 0.30), "p1": (0.48, 0.62), "p2": (0.45, 0.98)},
    }

    # Base box sizes for a mid-elevation traffic camera
    # At mid-frame (y~0.65) a car should be ~6-8% wide, ~4-5% tall
    BASE_SIZES = {
        'car':   {'w': 0.075, 'h': 0.050},
        'truck': {'w': 0.120, 'h': 0.075},
        'bus':   {'w': 0.130, 'h': 0.080},
    }

    vehicles = []
    for i in range(1, 110):
        p_name = random.choices(["W-E", "E-W", "S-N", "N-S"], weights=[35, 25, 25, 15])[0]
        start_f = random.randint(0, 3050)
        duration = random.randint(400, 750)
        v_class = random.choices(['car', 'truck', 'bus'], weights=[85, 10, 5])[0]
        vehicles.append({
            "id": i, "type": v_class, "path": paths[p_name],
            "start": start_f, "end": start_f + duration
        })

    frames = {}
    for f in range(0, 3323):
        frame_objs = []
        for v in vehicles:
            if v["start"] <= f <= v["end"]:
                t = (f - v["start"]) / (v["end"] - v["start"])
                x, y = bezier(v["path"]["p0"], v["path"]["p1"], v["path"]["p2"], t)

                # Clamp to valid viewport (allow slight edge bleed)
                if x < -0.08 or x > 1.08 or y < 0.15 or y > 1.05:
                    continue

                # Perspective scale: clamp y between 0.3 and 1.0 for scale calc
                y_clamped = max(0.30, min(y, 1.0))
                # Scale: 0.55 at horizon (y=0.30), 1.0 at bottom (y=1.0)
                scale = 0.55 + (y_clamped - 0.30) / 0.70 * 0.45

                bs = BASE_SIZES[v["type"]]
                w = bs['w'] * scale
                h = bs['h'] * scale

                frame_objs.append({
                    "id": v["id"],
                    "label": v["type"],
                    "conf": round(random.uniform(0.91, 0.99), 2),
                    "bbox": [
                        round(x - w / 2, 4),
                        round(y - h / 2, 4),
                        round(w, 4),
                        round(h, 4)
                    ]
                })

        # Inject stalled vehicle (ID 777) anchored to intersection core ~00:00:45
        if 1350 <= f <= 1680:
            frame_objs.append({
                "id": 777, "label": "car", "conf": 0.99,
                "bbox": [0.41, 0.62, 0.072, 0.048]  # Visible, mid-frame
            })

        frames[str(f)] = frame_objs

    output = {"metadata": metadata, "frames": frames}
    with open('data_sandbox/video/livestream_intelligence.json', 'w') as f:
        json.dump(output, f)

    # Quick sanity check
    sample = frames.get("900", [])
    print(f"Frame 900: {len(sample)} detections")
    if sample:
        print(f"  Sample box: {sample[0]['bbox']} (w={sample[0]['bbox'][2]:.3f}, h={sample[0]['bbox'][3]:.3f})")

if __name__ == "__main__":
    generate()
