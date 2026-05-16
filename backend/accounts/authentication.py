import logging

from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.exceptions import SessionExpiredException, SessionNotFoundException

from .models import UserSession

_SESSION_CACHE_TTL = 270  # seconds — safely below simplejwt ACCESS_TOKEN_LIFETIME
_auth_logger = logging.getLogger("accounts.auth")


def _session_cache_key(user_id: int) -> str:
    return f"session_key:{user_id}"


def invalidate_session_cache(user_id: int) -> None:
    try:
        cache.delete(_session_cache_key(user_id))
    except Exception as exc:
        _auth_logger.warning("Cache unavailable on session invalidation: %s", exc)


class SingleSessionJWTAuthentication(JWTAuthentication):
    """Rejects access tokens whose session_key no longer matches the DB record.

    When a user logs in from a new device, the session_key is rotated,
    immediately invalidating all tokens issued in prior sessions.

    If the cache is unavailable, validation falls back to the DB. If the DB
    is also unavailable, the request is allowed through (fail-open) to avoid
    total downtime — revoked sessions may stay valid until the token expires (30 min).
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_session_key = validated_token.get("session_key")

        if not token_session_key:
            return user

        cache_key = _session_cache_key(user.pk)

        try:
            cached_key = cache.get(cache_key)
        except Exception as exc:
            _auth_logger.warning("Cache unavailable for session read: %s", exc)
            cached_key = None

        if cached_key is None:
            try:
                cached_key = str(user.active_session.session_key)
            except UserSession.DoesNotExist:
                raise SessionNotFoundException
            except Exception as exc:
                _auth_logger.warning("DB unavailable for session fallback: %s", exc)
                return user  # fail-open: allow through if both cache and DB are down

            try:
                cache.set(cache_key, cached_key, timeout=_SESSION_CACHE_TTL)
            except Exception as exc:
                _auth_logger.warning("Cache unavailable for session write: %s", exc)

        if cached_key != str(token_session_key):
            raise SessionExpiredException

        return user
