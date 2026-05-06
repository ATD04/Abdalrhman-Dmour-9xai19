#!/bin/bash
# Re-process a video with segmentation enabled

set -e

echo "🎯 Re-processing video with YOLOv8 Segmentation..."
echo ""

cd "$(dirname "$0")"
source ../venv/bin/activate

# Find source video (check common locations)
SOURCE=""
for loc in \
    "../Traffic_Data_Sandbox/live_stream/IMG_5206.mp4" \
    "../Traffic_Data_Sandbox/live_stream/IMG_5206.MOV" \
    "~/Desktop/IMG_5206.mp4" \
    "~/Desktop/IMG_5206.MOV"
do
    if [ -f "$loc" ]; then
        SOURCE="$loc"
        break
    fi
done

if [ -z "$SOURCE" ]; then
    echo "⚠️  Source video not found. Using existing preview as demo..."
    echo ""
    echo "To properly test segmentation:"
    echo "1. Place a source video (e.g., IMG_5206.mp4) in Traffic_Data_Sandbox/live_stream/"
    echo "2. Run this command:"
    echo ""
    echo "   python3 scripts/build_video_analytics_dataset.py \\"
    echo "     --source /path/to/video.mp4 \\"
    echo "     --force"
    echo ""
    echo "The --force flag ensures re-processing even if output exists."
    exit 1
fi

echo "📹 Source: $SOURCE"
echo "🔄 Re-processing with --force flag..."
echo ""

python3 scripts/build_video_analytics_dataset.py \
    --source "$SOURCE" \
    --force

echo ""
echo "✅ Done! Refresh the browser to see segmentation masks."
echo "   Open: http://localhost:3100/ → Video Analytics tab"
