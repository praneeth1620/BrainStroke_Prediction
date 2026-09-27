import json
import os

import numpy as np
import tensorflow as tf

BASE_DIR = os.path.dirname(__file__)
MODELS_DIR = os.path.abspath(os.path.join(BASE_DIR, "../models"))
CONFIG_PATH = os.path.join(MODELS_DIR, "deployment_config.json")

with open(CONFIG_PATH, "r", encoding="utf-8") as config_file:
    config = json.load(config_file)

MODEL_PATH = os.path.join(MODELS_DIR, config["model_file"])
model = tf.keras.models.load_model(MODEL_PATH, compile=False)
threshold = float(config["threshold"])
classes = config["classes"]


def predict(img_array: np.ndarray) -> dict:
    print("=" * 80)
    print("FASTAPI DEBUG INFORMATION")
    print("=" * 80)
    print("Input shape:", img_array.shape)
    print("Input dtype:", img_array.dtype)
    print("Input min:", float(img_array.min()))
    print("Input max:", float(img_array.max()))
    print("Input mean:", float(img_array.mean()))
    print("Input std:", float(img_array.std()))

    prediction = model.predict(img_array, verbose=0)
    print("RAW MODEL OUTPUT:", prediction)

    stroke_probability = float(prediction[0][0])
    print("Stroke probability:", stroke_probability)
    print("Stroke probability %:", stroke_probability * 100)
    print("=" * 80)

    prediction_class = int(stroke_probability >= threshold)

    return {
        "stroke_probability": stroke_probability,
        "threshold": threshold,
        "prediction_class": prediction_class,
        "prediction_label": classes[str(prediction_class)],
        "debug": {
            "input_shape": list(img_array.shape),
            "input_dtype": str(img_array.dtype),
            "input_min": float(img_array.min()),
            "input_max": float(img_array.max()),
            "input_mean": float(img_array.mean()),
            "input_std": float(img_array.std()),
            "raw_model_output": prediction.astype(float).tolist(),
            "stroke_probability_percent": stroke_probability * 100,
        },
    }
