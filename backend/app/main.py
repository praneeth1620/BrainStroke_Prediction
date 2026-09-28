import json
import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

import bcrypt
import fitz
import jwt
import numpy as np
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, EmailStr, field_validator
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Image as ReportImage, Paragraph, SimpleDocTemplate, Spacer

from app.model import predict
from app.preprocess import process_image

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = (BASE_DIR.parent / "models").resolve()
DB_PATH = Path(os.getenv("DATABASE_PATH", str(BASE_DIR.parent / "brain_stroke_app.db")))
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR.parent / "uploads")))
CONFIG_PATH = MODELS_DIR / "deployment_config.json"
METRICS_PATH = MODELS_DIR / "metrics.json"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

JWT_SECRET = os.getenv("JWT_SECRET", "brain-stroke-ai-demo-secret")
JWT_ALGORITHM = "HS256"
JWT_TTL_DAYS = 7

with open(CONFIG_PATH, "r", encoding="utf-8") as file:
    config = json.load(file)


def risk_level_from_probability(probability: float) -> str:
    if probability < 0.30:
        return "LOW"
    if probability < 0.60:
        return "MODERATE"
    if probability < 0.80:
        return "HIGH"
    return "VERY HIGH"


class AuthRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("Full name must be at least 2 characters long.")
        return value

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("Password must be at least 8 characters long.")
        return value


class AuthLoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = None
    profile_info: str | None = None
    phone: str | None = None
    date_of_birth: str | None = None
    address: str | None = None
    medical_history: str | None = None
    current_medications: str | None = None
    allergies: str | None = None


class PasswordUpdateRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError("New password must be at least 8 characters long.")
        return value


def get_db_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    with get_db_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                profile_info TEXT,
                phone TEXT,
                date_of_birth TEXT,
                address TEXT,
                medical_history TEXT,
                current_medications TEXT,
                allergies TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        user_columns = {row["name"] for row in connection.execute("PRAGMA table_info(users)")}
        for column in ("phone", "date_of_birth", "address", "medical_history", "current_medications", "allergies"):
            if column not in user_columns:
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} TEXT")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                image_reference TEXT,
                file_type TEXT,
                stroke_probability REAL NOT NULL,
                normal_probability REAL NOT NULL,
                prediction TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                model_name TEXT NOT NULL,
                model_version TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS food_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                item_type TEXT NOT NULL,
                description TEXT,
                nutrition_note TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS model_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL,
                version TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(model_name, version)
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_food_items_category ON food_items(category)"
        )

        sample_food = [
            ("Spinach", "Vegetables", "vegetarian", "Leafy green vegetable commonly eaten in salads and cooked dishes.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Broccoli", "Vegetables", "vegetarian", "Cruciferous vegetable often prepared steamed, roasted, or in soups.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Blueberries", "Fruits", "vegetarian", "Small fruit rich in fiber and antioxidant compounds.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Avocado", "Fruits", "vegetarian", "Fruit often used in salads, wraps, and smoothies.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Oats", "Whole grains", "vegetarian", "Whole grain commonly served as porridge or baked goods.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Quinoa", "Whole grains", "vegetarian", "A gluten-free seed that is frequently used as a grain-like staple.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Walnuts", "Nuts and seeds", "vegetarian", "Nut with healthy fats and fiber commonly used in meals and snacks.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Chia seeds", "Nuts and seeds", "vegetarian", "Small seeds often added to smoothies, yogurt, or puddings.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Salmon", "Non-vegetarian foods", "non_vegetarian", "Fish frequently consumed as a source of protein and healthy fats.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Chicken breast", "Non-vegetarian foods", "non_vegetarian", "Lean protein source prepared in a variety of ways.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Eggs", "Other general healthy-food categories", "non_vegetarian", "Protein-rich food used in many meal patterns and cooking styles.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Greek yogurt", "Other general healthy-food categories", "vegetarian", "Fermented dairy food often used as a protein-rich breakfast or snack.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Beans", "Vegetables", "vegetarian", "Legume commonly included in soups, salads, stews, and side dishes.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
            ("Brown rice", "Whole grains", "vegetarian", "Whole grain staple that is minimally processed compared with white rice.", "General healthy-eating information associated with cardiovascular health and risk-factor management."),
        ]

        for item in sample_food:
            connection.execute(
                "INSERT OR IGNORE INTO food_items (name, category, item_type, description, nutrition_note) VALUES (?, ?, ?, ?, ?)",
                item,
            )

        connection.execute(
            "INSERT OR IGNORE INTO model_versions (model_name, version, metadata) VALUES (?, ?, ?)",
            (
                "EfficientNetB3",
                config["version"],
                json.dumps({
                    "backbone": "EfficientNetB3",
                    "input_size": config["image_size"],
                    "training_reference": "PK_demo",
                    "research_note": "This model is intended for research and screening support, not clinical diagnosis.",
                }),
            ),
        )

        admin_email = "admin@gmail.com"
        admin_user = connection.execute(
            "SELECT id FROM users WHERE email = ?",
            (admin_email,),
        ).fetchone()
        if admin_user is None:
            connection.execute(
                "INSERT INTO users (full_name, email, password_hash, role, profile_info) VALUES (?, ?, ?, ?, ?)",
                (
                    "System Administrator",
                    admin_email,
                    hash_password("abc@12345678"),
                    "admin",
                    "Administrative account for platform management.",
                ),
            )
        else:
            connection.execute("UPDATE users SET role = 'admin' WHERE email = ?", (admin_email,))

        connection.commit()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_TTL_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(authorization: str | None = Header(default=None, alias="Authorization")) -> dict:
    if authorization is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required.")
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authorization header.")
    token = parts[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token.") from exc

    user_id = int(payload.get("sub"))
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT id, full_name, email, role, profile_info, phone, date_of_birth, address, medical_history, current_medications, allergies, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found.")
    return dict(row)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


def sanitize_filename(filename: str | None) -> str:
    if not filename:
        return "uploaded_scan.png"
    clean = re.sub(r"[^A-Za-z0-9._-]+", "_", filename)
    return clean or "uploaded_scan.png"


def save_uploaded_bytes(user_id: int, original_name: str | None, content: bytes) -> str:
    user_upload_dir = UPLOAD_DIR / str(user_id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
    output_name = f"{stamp}_{sanitize_filename(original_name)}"
    file_path = user_upload_dir / output_name
    file_path.write_bytes(content)
    return str(Path("uploads") / str(user_id) / output_name)


def validate_brain_ct_upload(contents: bytes, content_type: str) -> bytes:
    if content_type == "application/pdf":
        with fitz.open(stream=contents, filetype="pdf") as document:
            if document.page_count == 0:
                raise ValueError("The PDF does not contain any pages.")
            page = document.load_page(0)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        return np.asarray(image.convert("RGB"), dtype=np.float32)

    try:
        image = Image.open(BytesIO(contents)).convert("RGB")
    except Exception as exc:
        raise ValueError("Invalid image file or format.") from exc

    if image.size[0] <= 0 or image.size[1] <= 0:
        raise ValueError("Invalid image file or format.")

    image_array = np.asarray(image, dtype=np.float32)
    grayscale = np.mean(image_array, axis=2)
    channel_distortion = np.mean(np.abs(image_array - np.repeat(grayscale[:, :, None], 3, axis=2)))
    if channel_distortion > 12:
        raise ValueError("Only grayscale brain CT scan images are supported. Please upload a scanned brain image.")
    return image_array.astype(np.float32)


def normal_probability_from_stroke(stroke_probability: float) -> float:
    return max(0.0, min(1.0, 1.0 - float(stroke_probability)))


app = FastAPI(
    title="NeuroView AI Clinical Screening API",
    description="Brain CT screening API with authentication, predictions, reporting, and admin management.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.on_event("startup")
def startup_event() -> None:
    init_db()


@app.get("/uploads/{relative_path:path}")
def serve_upload(relative_path: str):
    upload_root = UPLOAD_DIR.resolve()
    file_path = (upload_root / relative_path).resolve()
    if upload_root not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded file not found.")
    return FileResponse(file_path)


@app.get("/")
def read_root():
    return {"message": "NeuroView API is running."}


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "NeuroView",
        "database": "connected",
        "model": "loaded",
    }


@app.get("/info")
def model_info():
    try:
        with open(METRICS_PATH, "r", encoding="utf-8") as file:
            metrics = json.load(file)
        return {"config": config, "metrics": metrics}
    except Exception as exc:  # pragma: no cover - optional fallback for metrics file
        return {"config": config, "metrics": {}, "warning": str(exc)}


@app.post("/auth/register")
def register_user(payload: AuthRegisterRequest):
    if payload.password != payload.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match.")

    with get_db_connection() as connection:
        existing = connection.execute("SELECT id FROM users WHERE email = ?", (payload.email.lower(),)).fetchone()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A user with this email already exists.")

        user_id = connection.execute(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
            (payload.full_name.strip(), payload.email.lower(), hash_password(payload.password), "user"),
        ).lastrowid
        row = connection.execute(
            "SELECT id, full_name, email, role, profile_info, phone, date_of_birth, address, medical_history, current_medications, allergies, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

    token = create_access_token(user_id)
    return {
        "token": token,
        "user": dict(row),
        "message": "Account created successfully.",
    }


@app.post("/auth/login")
def login_user(payload: AuthLoginRequest):
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT id, full_name, email, password_hash, role, profile_info, phone, date_of_birth, address, medical_history, current_medications, allergies, created_at FROM users WHERE email = ?",
            (payload.email.lower(),),
        ).fetchone()

    if row is None or not verify_password(payload.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(row["id"])
    user = {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "role": row["role"],
        "profile_info": row["profile_info"],
        "phone": row["phone"],
        "date_of_birth": row["date_of_birth"],
        "address": row["address"],
        "medical_history": row["medical_history"],
        "current_medications": row["current_medications"],
        "allergies": row["allergies"],
        "created_at": row["created_at"],
    }
    return {"token": token, "user": user, "message": "Logged in successfully."}


@app.post("/auth/logout")
def logout_user():
    return {"message": "Logged out successfully."}


@app.get("/auth/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@app.get("/profile")
def get_profile(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


@app.put("/profile")
def update_profile(payload: ProfileUpdateRequest, current_user: dict = Depends(get_current_user)):
    updates = []
    values = []
    editable_fields = (
        "full_name", "profile_info", "phone", "date_of_birth", "address",
        "medical_history", "current_medications", "allergies",
    )
    for field in editable_fields:
        value = getattr(payload, field)
        if value is not None:
            updates.append(f"{field} = ?")
            values.append(value.strip())
    if not updates:
        return {"user": current_user, "message": "No profile changes to save."}
    values.append(current_user["id"])
    with get_db_connection() as connection:
        connection.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = ?",
            tuple(values),
        )
        connection.commit()
        row = connection.execute(
            "SELECT id, full_name, email, role, profile_info, phone, date_of_birth, address, medical_history, current_medications, allergies, created_at FROM users WHERE id = ?",
            (current_user["id"],),
        ).fetchone()
    return {"user": dict(row), "message": "Profile updated successfully."}


@app.post("/profile/change-password")
def change_password(payload: PasswordUpdateRequest, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE id = ?",
            (current_user["id"],),
        ).fetchone()
    if row is None or not verify_password(payload.current_password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    with get_db_connection() as connection:
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (hash_password(payload.new_password), current_user["id"]),
        )
        connection.commit()
    return {"message": "Password updated successfully."}


@app.post("/predict")
async def make_prediction(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    if file is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload a CT image.")

    content_type = file.content_type or ""
    if content_type not in {"image/jpeg", "image/png", "image/jpg", "application/pdf"} and not content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only grayscale brain CT scan images are supported. Please upload a scanned brain image.",
        )

    try:
        contents = await file.read()
        validated = validate_brain_ct_upload(contents, content_type)
        if content_type == "application/pdf":
            rgb_image = Image.fromarray(validated.astype(np.uint8), mode="RGB")
            image_bytes = BytesIO()
            rgb_image.save(image_bytes, format="PNG")
            image_contents = image_bytes.getvalue()
            preprocessed = process_image(image_contents)
        else:
            image_contents = contents
            if len(contents) == 0:
                raise ValueError("Uploaded image is empty.")
            preprocessed = process_image(contents)
        result = predict(preprocessed)
        stroke_probability = float(result["stroke_probability"])
        normal_probability = normal_probability_from_stroke(stroke_probability)
        prediction_label = result["prediction_label"]
        risk_level = risk_level_from_probability(stroke_probability)
        result.update({
            "normal_probability": normal_probability,
            "risk_level": risk_level,
            "prediction": prediction_label,
            "model_name": "EfficientNetB3",
            "model_version": config["version"],
            "disclaimer": "This is a research/screening tool and not a clinical diagnosis.",
            "file_type": "PDF" if content_type == "application/pdf" else "Image",
        })

        image_reference = save_uploaded_bytes(current_user["id"], file.filename, image_contents)
        with get_db_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO predictions (
                    user_id, image_reference, file_type, stroke_probability, normal_probability,
                    prediction, risk_level, model_name, model_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    current_user["id"],
                    image_reference,
                    "PDF" if content_type == "application/pdf" else "Image",
                    stroke_probability,
                    normal_probability,
                    prediction_label,
                    risk_level,
                    "EfficientNetB3",
                    config["version"],
                ),
            )
            connection.commit()
            prediction_id = cursor.lastrowid

        result["prediction_id"] = prediction_id
        result["timestamp"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Prediction failed: {exc}") from exc


@app.get("/predictions")
def list_predictions(current_user: dict = Depends(get_current_user)):
    with get_db_connection() as connection:
        rows = connection.execute(
            """
            SELECT * FROM predictions
            WHERE user_id = ?
            ORDER BY created_at DESC
            """,
            (current_user["id"],),
        ).fetchall()
    return {"predictions": [dict(row) for row in rows]}


@app.get("/predictions/{prediction_id}")
def get_prediction(prediction_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT * FROM predictions WHERE id = ?",
            (prediction_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found.")
    if current_user["role"] != "admin" and row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access another user's predictions.")
    return {"prediction": dict(row)}


@app.delete("/predictions/{prediction_id}")
def delete_prediction(prediction_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM predictions WHERE id = ?", (prediction_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found.")
        if current_user["role"] != "admin" and row["user_id"] != current_user["id"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot delete another user's predictions.")
        connection.execute("DELETE FROM predictions WHERE id = ?", (prediction_id,))
        connection.commit()
    return {"message": "Prediction deleted successfully."}


@app.get("/reports/{prediction_id}")
def generate_report(prediction_id: int, current_user: dict = Depends(get_current_user)):
    with get_db_connection() as connection:
        row = connection.execute(
            "SELECT * FROM predictions WHERE id = ?",
            (prediction_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prediction not found.")
    if current_user["role"] != "admin" and row["user_id"] != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You cannot access another user's report.")

    with get_db_connection() as connection:
        user = connection.execute("SELECT full_name, email FROM users WHERE id = ?", (row["user_id"],)).fetchone()

    file_path = (UPLOAD_DIR.parent / row["image_reference"]).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Uploaded image not found.")

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("BRAIN STROKE AI SCREENING REPORT", styles['Title']),
        Spacer(1, 18),
        Paragraph(f"User name: {user['full_name']}", styles['BodyText']),
        Paragraph(f"Prediction ID: {row['id']}", styles['BodyText']),
        Paragraph(f"Date/time: {row['created_at']}", styles['BodyText']),
        Paragraph(f"Prediction: {row['prediction']}", styles['BodyText']),
        Paragraph(f"Stroke probability: {(row['stroke_probability'] * 100):.2f}%", styles['BodyText']),
        Paragraph(f"Normal probability: {(row['normal_probability'] * 100):.2f}%", styles['BodyText']),
        Paragraph(f"Risk level: {row['risk_level']}", styles['BodyText']),
        Paragraph(f"Model: {row['model_name']}", styles['BodyText']),
        Paragraph("Model version: " + str(row['model_version']), styles['BodyText']),
        Paragraph("Input size: 300 × 300 × 3", styles['BodyText']),
        Paragraph("Disclaimer: This is a research/screening tool and not a clinical diagnosis.", styles['BodyText']),
        Paragraph("This is a research/screening tool and not a clinical diagnosis.", styles['BodyText']),
        Spacer(1, 12),
    ]
    try:
        story.append(ReportImage(str(file_path), width=220, height=220))
    except Exception:
        story.append(Paragraph("CT image unavailable.", styles['BodyText']))
    doc.build(story)

    pdf_content = buffer.getvalue()
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="report_{prediction_id}.pdf"'},
    )


@app.get("/food")
def get_food():
    with get_db_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM food_items ORDER BY category, name"
        ).fetchall()
    return {"food_items": [dict(row) for row in rows]}


@app.get("/food/{food_id}")
def get_food_item(food_id: int):
    with get_db_connection() as connection:
        row = connection.execute("SELECT * FROM food_items WHERE id = ?", (food_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Food item not found.")
    return {"food_item": dict(row)}


@app.get("/model")
def get_model_details():
    with open(METRICS_PATH, "r", encoding="utf-8") as file:
        metrics = json.load(file)
    return {
        "model_name": config["model_name"],
        "version": config["version"],
        "backbone": "EfficientNetB3",
        "input_size": config["image_size"],
        "output": config["classes"],
        "threshold": config["threshold"],
        "metrics": metrics.get("metrics", {}),
        "disclaimer": "This model is intended for research and screening support only and is not a clinical diagnosis.",
    }


@app.get("/admin/dashboard")
def admin_dashboard(current_user: dict = Depends(require_admin)):
    with get_db_connection() as connection:
        total_users = connection.execute("SELECT COUNT(*) AS count FROM users").fetchone()["count"]
        total_predictions = connection.execute("SELECT COUNT(*) AS count FROM predictions").fetchone()["count"]
        normal_predictions = connection.execute("SELECT COUNT(*) AS count FROM predictions WHERE prediction = 'NORMAL'").fetchone()["count"]
        stroke_predictions = connection.execute("SELECT COUNT(*) AS count FROM predictions WHERE prediction = 'STROKE'").fetchone()["count"]
        latest = connection.execute(
            "SELECT id, user_id, prediction, risk_level, created_at FROM predictions ORDER BY created_at DESC LIMIT 8"
        ).fetchall()
    system_status = {
        "frontend": "online",
        "fastapi": "online",
        "model": "loaded",
        "database": "connected",
    }
    return {
        "stats": {
            "total_users": total_users,
            "total_predictions": total_predictions,
            "normal_predictions": normal_predictions,
            "stroke_predictions": stroke_predictions,
            "model_version": config["version"],
        },
        "system_status": system_status,
        "recent_activity": [dict(row) for row in latest],
        "user": current_user,
    }


@app.get("/admin/users")
def admin_users(current_user: dict = Depends(require_admin)):
    with get_db_connection() as connection:
        rows = connection.execute(
            "SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC"
        ).fetchall()
    return {"users": [dict(row) for row in rows]}


@app.get("/admin/predictions")
def admin_predictions(current_user: dict = Depends(require_admin)):
    with get_db_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM predictions ORDER BY created_at DESC"
        ).fetchall()
    return {"predictions": [dict(row) for row in rows]}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
