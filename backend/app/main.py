from fastapi import FastAPI, UploadFile, File, HTTPException
import fitz
import json
import os

from preprocess import process_image
from model import predict

app = FastAPI(
    title="Brain Stroke CT Classification API",
    description="API for classifying brain CT scans using the EfficientNetB3 model.",
    version="EfficientNetB3"
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, "../models"))
CONFIG_PATH = os.path.join(MODELS_DIR, "deployment_config.json")
with open(CONFIG_PATH, "r") as f:
    config = json.load(f)

METRICS_PATH = os.path.join(MODELS_DIR, config["metrics_file"])

@app.get("/")
def read_root():
    return {"message": "Welcome to the Brain Stroke CT Classification API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/info")
def model_info():
    try:
        with open(METRICS_PATH, "r") as f:
            metrics = json.load(f)
        return {"config": config, "metrics": metrics}
    except Exception as e:
        return {"config": config, "error": str(e)}

@app.post("/predict")
async def make_prediction(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    if not (content_type.startswith("image/") or content_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Upload an image or PDF file")
    
    try:
        contents = await file.read()
        if content_type == "application/pdf":
            with fitz.open(stream=contents, filetype="pdf") as document:
                if document.page_count == 0:
                    raise ValueError("The PDF does not contain any pages")
                page = document.load_page(0)
                contents = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).tobytes("png")

        preprocessed = process_image(contents)
        result = predict(preprocessed)
        result.update({
            "risk_level": "HIGH" if result["prediction_class"] == 1 else "LOW",
            "disclaimer": "This is a research/screening tool, not a clinical diagnosis.",
            "file_type": "PDF" if content_type == "application/pdf" else "Image",
        })
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
