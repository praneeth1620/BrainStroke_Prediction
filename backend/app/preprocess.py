# import json
# import os
# from io import BytesIO

# import numpy as np
# from PIL import Image


# BASE_DIR = os.path.dirname(__file__)

# MODELS_DIR = os.path.abspath(
#     os.path.join(BASE_DIR, "../models")
# )

# CONFIG_PATH = os.path.join(
#     MODELS_DIR,
#     "deployment_config.json"
# )


# with open(
#     CONFIG_PATH,
#     "r",
#     encoding="utf-8"
# ) as config_file:

#     config = json.load(config_file)


# IMAGE_SIZE = tuple(
#     config["image_size"]
# )


# def process_image(
#     image_bytes: bytes
# ) -> np.ndarray:

#     try:

#         # ----------------------------------------------------
#         # 1. Decode image using PIL
#         # ----------------------------------------------------

#         image = Image.open(
#             BytesIO(image_bytes)
#         )

#         # ----------------------------------------------------
#         # 2. Convert to RGB
#         # ----------------------------------------------------

#         image = image.convert(
#             "RGB"
#         )

#         # ----------------------------------------------------
#         # 3. Resize exactly like the Colab pipeline
#         #
#         # Colab:
#         #
#         # image.load_img(
#         #     image_name,
#         #     target_size=(300, 300),
#         #     color_mode="rgb"
#         # )
#         #
#         # Keras load_img defaults to nearest interpolation.
#         # ----------------------------------------------------

#         image = image.resize(
#             IMAGE_SIZE,
#             Image.Resampling.NEAREST
#         )

#         # ----------------------------------------------------
#         # 4. Convert to NumPy
#         #
#         # IMPORTANT:
#         # Do NOT divide by 255.
#         #
#         # Colab sends pixel values in the range 0-255.
#         # ----------------------------------------------------

#         img_array = np.asarray(
#             image,
#             dtype=np.float32
#         )

#         # ----------------------------------------------------
#         # 5. Add batch dimension
#         # ----------------------------------------------------

#         img_array = np.expand_dims(
#             img_array,
#             axis=0
#         )

#         return img_array

#     except Exception as error:

#         raise ValueError(
#             "Invalid image file or format"
#         ) from error



import json
import os
from io import BytesIO
import hashlib

import numpy as np
from PIL import Image


BASE_DIR = os.path.dirname(__file__)

MODELS_DIR = os.path.abspath(
    os.path.join(BASE_DIR, "../models")
)

CONFIG_PATH = os.path.join(
    MODELS_DIR,
    "deployment_config.json"
)

with open(CONFIG_PATH, "r", encoding="utf-8") as config_file:
    config = json.load(config_file)

IMAGE_SIZE = tuple(config["image_size"])


def process_image(image_bytes: bytes) -> np.ndarray:

    print("=" * 80)
    print("PREPROCESS.PY - NEW VERSION IS RUNNING")
    print("=" * 80)

    print("Preprocess file:")
    print(os.path.abspath(__file__))

    print("Image size configuration:")
    print(IMAGE_SIZE)

    print("Received bytes:")
    print(len(image_bytes))

    # Decode using PIL
    image = Image.open(
        BytesIO(image_bytes)
    )

    print("Original PIL size:")
    print(image.size)

    print("Original PIL mode:")
    print(image.mode)

    # EXACTLY reproduce Colab:
    # color_mode="rgb"
    image = image.convert("RGB")

    # Colab load_img() defaults to nearest interpolation
    image = image.resize(
        IMAGE_SIZE,
        Image.Resampling.NEAREST
    )

    img_array = np.asarray(
        image,
        dtype=np.float32
    )

    img_array = np.expand_dims(
        img_array,
        axis=0
    )

    print("FINAL PREPROCESSED INPUT")
    print("Shape:", img_array.shape)
    print("Dtype:", img_array.dtype)
    print("Min:", float(img_array.min()))
    print("Max:", float(img_array.max()))
    print("Mean:", float(img_array.mean()))
    print("Std:", float(img_array.std()))

    print("=" * 80)

    return img_array