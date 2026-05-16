import logging
import posixpath

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
    response = HttpResponse(data, content_type=content_type)
    response["Cache-Control"] = "private, max-age=3600"
    response["X-Content-Type-Options"] = "nosniff"
    return response
