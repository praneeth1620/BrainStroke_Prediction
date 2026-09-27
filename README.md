# FAST V8 - Brain Stroke CT Classification Platform

This repository contains a FastAPI inference backend and a Next.js frontend.

## Structure

- **`backend/`**: Contains the FastAPI prediction service and the deployed EfficientNetB3 model. See [`backend/README.md`](./backend/README.md) for setup details.
- **`frontend/`**: Contains the Next.js web application that provides the user interface for interacting with the Prediction API.

## How to Run

### Run Everything via Docker
You can run the backend API and frontend using Docker Compose.

```bash
cd backend
docker-compose up --build
```
- The **Frontend** will be available at `http://localhost:3000`
- The **Backend API** will be available at `http://localhost:8000` (Swagger UI at `/docs`)

### Run Frontend Locally (Development)
If you wish to develop the frontend locally while the backend runs in Docker:

1. Ensure the backend is running (`cd backend && docker-compose up`).
2. Open a new terminal and navigate to the frontend:
```bash
cd frontend
npm install
npm run dev
```
3. Visit `http://localhost:3000`.
