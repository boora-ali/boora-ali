import logging
import posixpath

from django.core.files.storage import default_storage
from django.http import Http404, HttpResponse
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.permissions import AllowAny

from core.storage_urls import _build_signed_url, _use_s3_signing, verify_media_url

logger = logging.getLogger(__name__)


@api_view(["GET"])
@authentication_classes([])  # sem auth de header — auth é via HMAC na URL
@permission_classes([AllowAny])
def serve_user_media(request, path):
    path = posixpath.normpath("/" + path).lstrip("/")

    # — Validação de estrutura do path —
    parts = path.split("/")
    if len(parts) < 3 or parts[0] != "users":
        raise Http404

    try:
        int(parts[1])  # user_id deve ser inteiro
    except (IndexError, ValueError):
        raise Http404

    # — Autenticação via HMAC query params —
    exp_str = request.GET.get("exp", "")
    sig = request.GET.get("sig", "")

    # Se apenas um dos parâmetros HMAC está presente, a URL está malformada.
    # Retornar 404 imediatamente com log para facilitar debug.
    if bool(exp_str) != bool(sig):
        logger.warning(
            "Partial HMAC params in media request: exp=%s sig_present=%s path=%s",
            exp_str or "(missing)",
            bool(sig),
            path,
        )
        raise Http404

    if exp_str and sig:
        # Caminho principal: <img src="/api/media/...?exp=&sig=">
        try:
            exp = int(exp_str)
        except ValueError:
            raise Http404

        if not verify_media_url(path, exp, sig):
            raise Http404  # expirado ou sig inválida → 404 (nunca 403)

    else:
        # Fallback JWT Bearer: para testes automatizados e acesso programático (ex: curl).
        # NÃO é usado por <img src> em produção.
        from accounts.authentication import SingleSessionJWTAuthentication

        try:
            result = SingleSessionJWTAuthentication().authenticate(request)
        except Exception:
            raise Http404

        # result é None quando não há header Authorization (sem tentar auth)
        if result is None:
            raise Http404

        user, _ = result
        # Verificar que user_id no path pertence ao usuário autenticado
        if int(parts[1]) != user.id:
            raise Http404

    # — Servir via X-Accel-Redirect → /_r2_proxy/ → R2 —
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

    response = HttpResponse()
    response["X-Accel-Redirect"] = "/_r2_proxy/"
    response["X-Accel-Target"] = media_url
    # Nota: com X-Accel-Redirect, nginx descarta headers do Django e usa os do /_r2_proxy/.
    # Este Cache-Control não chega ao browser — está aqui apenas para dev local (sem nginx).
    response["Cache-Control"] = "private, max-age=3600, must-revalidate"
    return response
