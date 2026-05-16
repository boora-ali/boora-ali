import base64
import functools
import hashlib
import io
import logging
import secrets

from cryptography.fernet import Fernet
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image

logger = logging.getLogger(__name__)

_HKDF_SALT = b"bora-ali-media-v1"


class ImageService:
    @staticmethod
    @functools.lru_cache(maxsize=128)
    def _derive_key(user_id: int, _secret_key: str) -> Fernet:
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=_HKDF_SALT,
            info=str(user_id).encode(),
            backend=default_backend(),
        )
        raw = hkdf.derive(_secret_key.encode())
        return Fernet(base64.urlsafe_b64encode(raw))

    @staticmethod
    def make_path(user_id: int, category: str, data: bytes) -> str:
        sha = hashlib.sha256(data).hexdigest()[:16]
        token = secrets.token_hex(8)
        return f"users/{user_id}/{category}/{sha}_{token}"

    @staticmethod
    def _media_key(user_id: int) -> Fernet:
        key = getattr(settings, "MEDIA_ENCRYPTION_KEY", None) or settings.SECRET_KEY
        return ImageService._derive_key(user_id, key)

    @staticmethod
    def encrypt(data: bytes, user_id: int) -> bytes:
        return ImageService._media_key(user_id).encrypt(data)

    @staticmethod
    def decrypt(data: bytes, user_id: int) -> bytes:
        return ImageService._media_key(user_id).decrypt(data)

    @staticmethod
    def detect_content_type(data: bytes) -> str:
        try:
            img = Image.open(io.BytesIO(data))
            return {
                "JPEG": "image/jpeg",
                "PNG": "image/png",
                "WEBP": "image/webp",
            }.get(img.format, "application/octet-stream")
        except Exception:
            return "application/octet-stream"

    @staticmethod
    def _compress(data: bytes, max_dimension: int = 1920, quality: int = 82) -> bytes:
        try:
            img = Image.open(io.BytesIO(data))
            fmt = img.format or "JPEG"
            if img.width > max_dimension or img.height > max_dimension:
                img.thumbnail((max_dimension, max_dimension), Image.LANCZOS)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
                fmt = "JPEG"
            buf = io.BytesIO()
            save_kwargs = {"format": fmt, "optimize": True}
            if fmt in ("JPEG", "WEBP"):
                save_kwargs["quality"] = quality
            img.save(buf, **save_kwargs)
            return buf.getvalue()
        except Exception:
            return data

    @staticmethod
    def save(file_obj, user_id: int, category: str) -> str:
        file_obj.seek(0)
        data = ImageService._compress(file_obj.read())
        encrypted = ImageService.encrypt(data, user_id)
        path = ImageService.make_path(user_id, category, data)

        backend = type(default_storage).__name__
        logger.info(
            "[storage] uploading user=%s category=%s path=%s backend=%s size=%db",
            user_id,
            category,
            path,
            backend,
            len(encrypted),
        )
        try:
            saved_path = default_storage.save(path, ContentFile(encrypted))
            logger.info("[storage] upload OK path=%s", saved_path)
            return saved_path
        except Exception as exc:
            logger.error(
                "[storage] upload FAILED path=%s error=%s", path, exc, exc_info=True
            )
            raise

    @staticmethod
    def delete(path: str) -> None:
        if not path:
            return
        try:
            default_storage.delete(path)
            logger.info("[storage] deleted path=%s", path)
        except Exception:
            logger.warning("Failed to delete media file: %s", path)
