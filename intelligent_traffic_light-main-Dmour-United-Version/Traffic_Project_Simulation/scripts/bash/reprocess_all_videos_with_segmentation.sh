#!/bin/bash
# Re-process all existing videos with YOLOv8 Segmentation

set -e

echo "🎯 Re-processing ALL videos with YOLOv8 Segmentation..."
echo ""
echo "⚠️  WARNING: This will re-process all videos from scratch."
echo "   It may take 10-30 minutes depending on video count/length."
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

cd "$(dirname "$0")"
source ../venv/bin/activate

# Find all tracking JSON files
TRACKING_DIR="app/data/video_tracking"
if [ ! -d "$TRACKING_DIR" ]; then
    echo "❌ No tracking directory found: $TRACKING_DIR"
    exit 1
fi

# Count videos
VIDEO_COUNT=$(find "$TRACKING_DIR" -name "*.json" | wc -l | xargs)
echo ""
echo "📹 Found $VIDEO_COUNT processed videos"
echo ""

# For each video, find its source and re-process
SUCCESS=0
FAILED=0

for json_file in "$TRACKING_DIR"/*.json; do
    [ -f "$json_file" ] || continue
    
    basename=$(basename "$json_file" .json)
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔄 Processing: $basename"
    
    # Extract source_path from JSON
    source_path=$(python3 -c "import json; data=json.load(open('$json_file')); print(data.get('manifest_entry', {}).get('source_path', ''))" 2>/dev/null || echo "")
    
    if [ -z "$source_path" ]; then
        echo "   ⚠️  No source_path found in JSON, skipping..."
        ((FAILED++))
        continue
    fi
    
    echo "   Source: $source_path"
    
    # Try to find the source file
    SOURCE_FILE=""
    for loc in \
        "../Traffic_Data_Sandbox/live_stream/$source_path" \
        "../Traffic_Data_Sandbox/live_stream/$(echo $source_path | tr '[:lower:]' '[:upper:]')" \
        "~/Desktop/$source_path"
    do
        if [ -f "$loc" ]; then
            SOURCE_FILE="$loc"
            break
        fi
    done
    
    if [ -z "$SOURCE_FILE" ]; then
        echo "   ❌ Source file not found: $source_path"
        echo "      Tried:"
        echo "        ../Traffic_Data_Sandbox/live_stream/$source_path"
        echo "        ~/Desktop/$source_path"
        ((FAILED++))
        continue
    fi
    
    echo "   ✅ Found source: $SOURCE_FILE"
    echo "   🔄 Re-processing with segmentation..."
    echo ""
    
    if python3 scripts/build_video_analytics_dataset.py \
        --source "$SOURCE_FILE" \
        --force 2>&1 | grep -E "(Processing|Model loaded|Written|ERROR)"; then
        echo ""
        echo "   ✅ Success!"
        ((SUCCESS++))
    else
        echo ""
        echo "   ❌ Failed!"
        ((FAILED++))
    fi
    
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Summary:"
echo "   ✅ Success: $SUCCESS"
echo "   ❌ Failed:  $FAILED"
echo "   📹 Total:   $VIDEO_COUNT"
echo ""
echo "🎯 Done! Refresh your browser to see segmentation masks."
echo "   http://localhost:3100/ → Video Analytics tab"
