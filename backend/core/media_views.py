import logging
import posixpath
import uuid
from pathlib import Path

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import Http404, HttpResponse
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated

from accounts.authentication import SingleSessionJWTAuthentication
from core.image_service import ImageService

logger = logging.getLogger(__name__)


@api_view(["GET"])
@authentication_classes([SingleSessionJWTAuthentication])
@permission_classes([IsAuthenticated])
def serve_user_media(request, path):
    # Normalize to strip any ".." segments before splitting.
    path = posixpath.normpath("/" + path).lstrip("/")
    parts = path.split("/")
    if len(parts) < 3 or parts[0] != "users":
        raise Http404

    try:
        file_user_id = int(parts[1])
    except (IndexError, ValueError):
        raise Http404

    if file_user_id != request.user.id:
        raise Http404

    try:
        with default_storage.open(path, "rb") as fh:
            encrypted = fh.read()
    except Exception:
        raise Http404

    try:
        data = ImageService.decrypt(encrypted, file_user_id)
    except Exception:
        logger.warning("Failed to decrypt media file: %s", path)
        raise Http404

    content_type = ImageService.detect_content_type(data)

    if getattr(settings, "USE_X_ACCEL_REDIRECT", False):
        try:
            temp_dir = Path(settings.TEMP_SERVE_DIR)
            temp_dir.mkdir(parents=True, exist_ok=True)
            temp_id = uuid.uuid4().hex
            (temp_dir / temp_id).write_bytes(data)
        except Exception:
            logger.error("Failed to write temp file for X-Accel-Redirect: %s", path, exc_info=True)
            raise Http404

        response = HttpResponse()
        response["X-Accel-Redirect"] = f"/protected-temp/{temp_id}"
        response["Content-Type"] = content_type
        response["Cache-Control"] = "private, max-age=0, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response

    response = HttpResponse(data, content_type=content_type)
    response["Cache-Control"] = "private, max-age=3600"
    response["X-Content-Type-Options"] = "nosniff"
    return response
