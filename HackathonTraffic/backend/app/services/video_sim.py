import cv2
import time
import os

def simulate_video_stream(video_path, fps=10):
    """
    Simulates an RTSP-like video stream by reading a local video file
    and yielding frames at a specific FPS.
    """
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at {video_path}")
        return

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("Error: Could not open video file.")
        return

    delay = 1.0 / fps
    print(f"Starting simulation at {fps} FPS...")

    try:
        while cap.isOpened():
            start_time = time.time()
            ret, frame = cap.read()
            
            if not ret:
                # Loop the video if it ends (typical for sandbox simulation)
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # Process or display frame (placeholder for AI injection)
            # cv2.imshow('Simulated Feed', frame)
            
            # This is where the frames would be piped to YOLO/Forecasting modules
            
            # Control FPS
            elapsed = time.time() - start_time
            time.sleep(max(0, delay - elapsed))
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

if __name__ == "__main__":
    # Updated to use the uploaded Wadi Saqra sample
    MOCK_VIDEO_PATH = "/Users/atd04/Documents/GitHub/Abdalrhman-Dmour-9xai19/HackathonTraffic/data_sandbox/video/YTDown.com_YouTube_Media_52ao3WsInBo_001_1080p.mp4"
    simulate_video_stream(MOCK_VIDEO_PATH)
