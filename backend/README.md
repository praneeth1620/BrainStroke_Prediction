# Brain Stroke CT Classification Backend

FastAPI inference service for the EfficientNetB3 model trained in `PK_demo`.

## Runtime Layout

- `app/`: API, image preprocessing, and model inference.
- `models/efficientnet_b3_stroke.keras`: trained model.
- `models/deployment_config.json`: input size, class labels, and threshold.
- `models/metrics.json`: held-out test metrics.

The model expects RGB images resized to 300 x 300. The API accepts image uploads and PDFs (the first page is used). Predictions use the frozen threshold `0.355`.

## Run

From the repository root, run `docker compose up --build`. The API is available at `http://localhost:8000` and its interactive documentation at `/docs`.

For local development, install `requirements.txt` and run `uvicorn main:app --app-dir app --host 0.0.0.0 --port 8000`.

This model is intended for research and screening support, not as a standalone clinical diagnosis.
