# FAST V8 - Brain Stroke CT Classification Platform

This repository contains a FastAPI inference backend and a Next.js frontend.

## Structure

- **`backend/`**: Contains the FastAPI prediction service and the deployed EfficientNetB3 model. See [`backend/README.md`](./backend/README.md) for setup details.
- **`frontend/`**: Contains the Next.js web application that provides the user interface for interacting with the Prediction API.

## How to Run

### Run Everything via Docker
You can run the backend API and frontend using Docker Compose.

From the repository root, run:

```powershell
docker compose up --build
```

This builds and starts the API and frontend. The SQLite database and uploaded scans are stored in the `api_data` Docker volume. Stop the services with `Ctrl+C`; run `docker compose down` to remove the containers and network while keeping that data volume.

- The **Frontend** will be available at `http://localhost:3000`
- The **Backend API** will be available at `http://localhost:8000` (Swagger UI at `/docs`)

### Run Frontend Locally (Development)
If you wish to develop the frontend locally while the backend runs in Docker:

1. Ensure the backend is running (`docker compose up --build api`).
2. Open a new terminal and navigate to the frontend:
```bash
cd frontend
npm install
npm run dev
```
3. Visit `http://localhost:3000`.
