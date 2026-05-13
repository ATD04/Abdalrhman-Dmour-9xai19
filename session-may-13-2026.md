# Session Notes — May 13, 2026

## Project

360-CitizenVoices is a full-stack Citizen Experience Intelligence platform for the Hashemite Kingdom of Jordan. It ingests citizen feedback from multiple channels, runs NLP and machine learning pipelines, and presents the results through a React dashboard with role-based access.

---

## What Was Done

### Understanding the Project

We started by reading the project README and docker-compose.yml to understand the overall architecture. The platform is made up of a React 18 frontend served on port 3000, a Flask-based pipeline API on port 5050, a FastAPI unified platform API on port 8001, a FastAPI classification and persona microservice on port 8000, and a PostgreSQL database on port 5432.

### Setting Up the Environment File

The .env.example file is located at the repository root, not inside the frontend folder. Running the copy command from the wrong directory caused a "No such file or directory" error. The correct approach is to always work from the repo root.

```
cd /Users/atd04/Documents/GitHub/360-CitizenVoices
cp .env.example .env
```

### Freeing Port 3000

A stale process was holding port 3000 from a previous dev server run. It was cleared with the following command before starting Docker.

```
lsof -ti :3000 | xargs kill -9
```

### Starting Docker Desktop

Docker Desktop was not running when the session began. Attempts to run docker compose failed with a daemon connection error. Docker Desktop was launched manually via Spotlight or the following terminal command.

```
open -a Docker
```

After Docker became ready, all subsequent commands worked normally.

### Starting the Full Stack

All services were built and started from the repo root using a single command. This brought up all nine containers successfully including the frontend, both API services, the classification microservice, the pipeline workers, and the database.

```
cd /Users/atd04/Documents/GitHub/360-CitizenVoices
docker compose up -d --build
```

---

## Accessing the Platform

The dashboard is available at http://localhost:3000. Use the following credentials to log in.

- Email: admin@voc360.gov.jo
- Password: Voc360-Admin!2026

Other available accounts and roles are listed in frontend/ACCOUNTS.md.

---

## Important Rule

Always run docker compose from the repository root directory. The frontend folder contains its own docker-compose.yml that is unrelated to the main stack and will produce errors if used directly.

---

## Running Services After This Session

| Port | Service |
|------|---------|
| 3000 | Frontend dashboard |
| 5050 | Pipeline API (Flask) |
| 8000 | Classification and Persona API (FastAPI) |
| 8001 | Unified platform API (FastAPI) |
| 5432 | PostgreSQL database |
