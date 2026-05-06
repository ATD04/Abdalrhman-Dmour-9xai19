# Intelligent Traffic Light System - Wadi Saqra

## 🚦 Project Overview
This project is an advanced **Intelligent Traffic Light Management System** designed for the **Wadi Saqra intersection**. It integrates real-time traffic simulation using **SUMO** with AI-powered video analytics using **YOLO** to optimize traffic flow and provide a live digital twin of the intersection.

## 🚀 Key Features
- **Live Digital Twin**: Real-time synchronization between the SUMO simulation and a web-based dashboard.
- **Video Analytics**: Processing traffic camera feeds to detect vehicle types, count traffic, and detect incidents (abnormal stops, pedestrian crossings).
- **Decision Support**: Intelligent logic to adjust traffic light timings based on real-time congestion levels.
- **Interactive Dashboard**: Modern UI for monitoring KPIs like average waiting time, vehicle count, and incident alerts.

## 📁 Project Structure
- `Traffic_Project_Simulation/`: Main application directory.
  - `app/`: Frontend files (HTML, CSS, JS) and the web dashboard.
  - `scripts/`: Python scripts for simulation control and data processing.
  - `sumo_scenarios/`: SUMO configuration files and maps for Wadi Saqra.
  - `models/`: AI models (YOLOv8/v11) for object detection (Excluded from Git due to size).
- `Traffic_Data_Sandbox/`: Experimental scripts and data analysis notebooks.

## 🛠 Installation & Setup

### Prerequisites
- Python 3.10+
- [SUMO (Simulation of Urban MObility)](https://www.eclipse.org/sumo/) installed and added to your system PATH.
- Node.js (for frontend development, if applicable).

### Setup Instructions
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ahmad-Hasasneh/intelligent_traffic_light.git
   cd intelligent_traffic_light
   ```

2. **Install dependencies:**
   ```bash
   pip install -r Traffic_Project_Simulation/requirements-live.txt
   ```

3. **Download AI Models:**
   *Note: Due to size constraints, AI models are not included in the repository. Please place your `.pt` files in the `Traffic_Project_Simulation/models/` directory.*

4. **Run the Simulation:**
   - On Windows: Run `start_simulation.bat`
   - On Mac/Linux: Run `./start_simulation.command`

## 👥 Team Collaboration
We are using this repository to divide tasks:
- **Frontend/UI**: Work inside `Traffic_Project_Simulation/app/`.
- **Simulation/Logic**: Work inside `Traffic_Project_Simulation/scripts/`.
- **Data Science/AI**: Work inside `Traffic_Project_Simulation/models/` and `Traffic_Data_Sandbox/`.

## 📄 License
This project is part of the 9XAI Hackathon.
