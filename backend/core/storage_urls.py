import hashlib
import hmac
import logging
import time
from functools import lru_cache
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from django.conf import settings

logger = logging.getLogger(__name__)

_MEDIA_URL_TTL = 3600  # 1 hora


@lru_cache(maxsize=1)
def _media_signing_key() -> bytes:
    """
    Deriva a chave HMAC a partir de MEDIA_ENCRYPTION_KEY (ou SECRET_KEY como fallback).
    @lru_cache: calculado uma vez por processo — SHA256 não precisa repetir a cada request.
    """
    key = getattr(settings, "MEDIA_ENCRYPTION_KEY", None) or settings.SECRET_KEY
    return hashlib.sha256(f"bora-ali-media-url-v1:{key}".encode()).digest()


def sign_media_url(path: str, ttl: int = _MEDIA_URL_TTL) -> tuple[int, str]:
    """
    Retorna (exp, sig) onde:
      exp = unix timestamp de expiração
      sig = HMAC-SHA256 hex de '<path>:<exp>'
    """
    exp = int(time.time()) + ttl
    message = f"{path}:{exp}".encode()
    sig = hmac.new(_media_signing_key(), message, hashlib.sha256).hexdigest()
    return exp, sig


def verify_media_url(path: str, exp: int, sig: str) -> bool:
    """
    Valida assinatura e expiração. Retorna False se expirado ou sig inválida.
    hmac.compare_digest: resistência a timing attacks.
    """
    if int(time.time()) > exp:
        return False
    message = f"{path}:{exp}".encode()
    expected = hmac.new(_media_signing_key(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def build_public_media_url(file_field, request=None) -> str:
    if not file_field:
        return ""

    name = getattr(file_field, "name", "").lstrip("/")
    if not name:
        return ""

    # Sempre retornar URL same-origin com HMAC para evitar CORP cross-origin.
    # Funciona em todos os browsers incluindo Safari/Edge iOS.
    # <img src> não envia Bearer token — autenticação é via HMAC na query string.
    exp, sig = sign_media_url(name)
    path = f"/api/media/{name}"
    signed = f"{path}?exp={exp}&sig={sig}"

    if request:
        return request.build_absolute_uri(signed)
    return signed


def _use_s3_signing() -> bool:
    # VersityGW (dev local) força signing por compatibilidade.
    use_versity = str(getattr(settings, "USE_VERSITYGW", "False")).lower() == "true"

    # Produção (Cloudflare R2 / S3): habilita signing sempre que o storage
    # estiver totalmente configurado, independentemente de USE_VERSITYGW.
    endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", "")
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
    access_key = getattr(settings, "AWS_ACCESS_KEY_ID", "")
    secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", "")
    s3_configured = bool(endpoint and bucket and access_key and secret_key)

    enabled = use_versity or s3_configured
    logger.debug(
        "[storage] USE_VERSITYGW=%s s3_configured=%s endpoint=%s -> signing=%s",
        use_versity,
        s3_configured,
        endpoint,
        enabled,
    )
    return enabled


def _build_signed_url(key: str) -> str:
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
    if not bucket:
        return ""
    try:
        return _get_s3_presign_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=int(getattr(settings, "AWS_S3_URL_EXPIRES_IN", 3600)),
        )
    except Exception:
        return ""


@lru_cache(maxsize=1)
def _get_s3_presign_client():
    endpoint = _resolve_public_endpoint()
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=getattr(settings, "AWS_S3_REGION_NAME", "us-east-1"),
        aws_access_key_id=getattr(settings, "AWS_ACCESS_KEY_ID", None),
        aws_secret_access_key=getattr(settings, "AWS_SECRET_ACCESS_KEY", None),
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _resolve_public_endpoint() -> str:
    explicit = getattr(settings, "AWS_S3_PUBLIC_ENDPOINT", "").rstrip("/")
    if explicit:
        return explicit

    public_url = getattr(settings, "AWS_S3_PUBLIC_URL", "").rstrip("/")
    bucket = getattr(settings, "AWS_STORAGE_BUCKET_NAME", "")
    if public_url and bucket:
        suffix = f"/{bucket}"
        if public_url.endswith(suffix):
            parsed = urlparse(public_url[: -len(suffix)])
            if parsed.scheme and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
    return getattr(settings, "AWS_S3_ENDPOINT_URL", "").rstrip("/")
