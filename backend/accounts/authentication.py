from django.core.cache import cache
from rest_framework_simplejwt.authentication import JWTAuthentication

from core.exceptions import SessionExpiredException, SessionNotFoundException

from .models import UserSession

_SESSION_CACHE_TTL = 270  # seconds — safely below simplejwt ACCESS_TOKEN_LIFETIME


def _session_cache_key(user_id: int) -> str:
    return f"session_key:{user_id}"


def invalidate_session_cache(user_id: int) -> None:
    cache.delete(_session_cache_key(user_id))


class SingleSessionJWTAuthentication(JWTAuthentication):
    """Rejects access tokens whose session_key no longer matches the DB record.

    When a user logs in from a new device, the session_key is rotated,
    immediately invalidating all tokens issued in prior sessions.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        token_session_key = validated_token.get("session_key")

        if not token_session_key:
            return user

        cache_key = _session_cache_key(user.pk)
        cached_key = cache.get(cache_key)

        if cached_key is None:
            try:
                cached_key = str(user.active_session.session_key)
            except UserSession.DoesNotExist:
                raise SessionNotFoundException
            cache.set(cache_key, cached_key, timeout=_SESSION_CACHE_TTL)

        if cached_key != str(token_session_key):
            raise SessionExpiredException

        return user
