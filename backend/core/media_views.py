import logging
import posixpath

from django.core.files.storage import default_storage
from django.http import Http404, HttpResponseRedirect
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import IsAuthenticated

from accounts.authentication import SingleSessionJWTAuthentication

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
        signed_url = default_storage.url(path)
    except Exception:
        logger.warning("Failed to sign URL for %s", path, exc_info=True)
        raise Http404

    response = HttpResponseRedirect(signed_url)
    response["Cache-Control"] = "private, max-age=0, no-store"
    return response
