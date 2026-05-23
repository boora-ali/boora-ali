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
from core.storage_urls import _build_signed_url, _use_s3_signing

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
        if _use_s3_signing():
            media_url = _build_signed_url(path)
        else:
            media_url = default_storage.url(path)
        if not media_url:
            raise Http404
    except Http404:
        raise
    except Exception:
        logger.warning("Failed to build media URL for %s", path, exc_info=True)
        raise Http404

    # X-Accel-Redirect: nginx intercepta este response vazio, descarta o body,
    # e faz subrequest interno para /_r2_proxy/ que faz proxy_pass para a URL
    # assinada do R2/VersityGW (passada via X-Accel-Target).
    # Resultado: browser faz 1 request autenticado → recebe bytes diretamente.
    # Sem redirect cross-origin → sem CORS. Sem URL assinada no cliente → sem expiração.
    # Cache-Control permite o browser cachear: mesma imagem na sessão = 0 requests extras.
    response = HttpResponse()
    response["X-Accel-Redirect"] = "/_r2_proxy/"
    response["X-Accel-Target"] = media_url
    response["Cache-Control"] = "private, max-age=3600, must-revalidate"
    return response
