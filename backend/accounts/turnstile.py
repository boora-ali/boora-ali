from __future__ import annotations

import logging

import httpx
from django.conf import settings
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

_SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


class TurnstileMixin:
    """Validates Cloudflare Turnstile token before processing the request.

    Skipped when TURNSTILE_SECRET_KEY is not configured (dev/test environments).
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        secret = getattr(settings, "TURNSTILE_SECRET_KEY", "")
        if not secret:
            return

        token = request.data.get("cf_turnstile_response", "")
        if not token:
            raise ValidationError(
                {"cf_turnstile_response": "Verificação de segurança necessária."}
            )

        try:
            resp = httpx.post(
                _SITEVERIFY_URL,
                data={
                    "secret": secret,
                    "response": token,
                    "remoteip": request.META.get("REMOTE_ADDR", ""),
                },
                timeout=5.0,
            )
            result = resp.json()
        except Exception:
            logger.warning("Turnstile siteverify request failed")
            raise ValidationError(
                {"cf_turnstile_response": "Erro ao verificar segurança."}
            )

        if not result.get("success"):
            codes = result.get("error-codes", [])
            logger.warning("Turnstile verification failed: %s", codes)
            raise ValidationError(
                {"cf_turnstile_response": "Verificação de segurança falhou."}
            )
