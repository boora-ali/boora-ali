import logging
from functools import lru_cache
from urllib.parse import urlparse

import boto3
from botocore.client import Config
from django.conf import settings

logger = logging.getLogger(__name__)


def build_public_media_url(file_field, request=None) -> str:
    if not file_field:
        return ""

    name = getattr(file_field, "name", "").lstrip("/")
    if not name:
        return ""

    # Production: return presigned URL directly so the browser fetches from R2
    # without any auth proxy. <img src={url}> works because the browser does not
    # send Origin on image requests, avoiding the withCredentials CORS issue.
    if _use_s3_signing():
        signed = _build_signed_url(name)
        if signed:
            return signed

    # Dev/fallback (USE_VERSITYGW=False, local filesystem): serve through the
    # authenticated Django view so images are still protected in development.
    if request:
        return request.build_absolute_uri(f"/api/media/{name}")
    return f"/api/media/{name}"


def _use_s3_signing() -> bool:
    use_versity = str(getattr(settings, "USE_VERSITYGW", "False")).lower() == "true"
    endpoint = getattr(settings, "AWS_S3_ENDPOINT_URL", "")
    logger.debug("[storage] USE_VERSITYGW=%s endpoint=%s", use_versity, endpoint)
    return use_versity


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
