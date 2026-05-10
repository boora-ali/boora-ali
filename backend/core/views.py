import logging

from django.db import transaction

logger = logging.getLogger(__name__)

_MUTATING = frozenset({"POST", "PUT", "PATCH", "DELETE"})


class MutationMixin:
    """
    Wraps mutating HTTP requests in a transaction and emits an audit log entry.

    Compatible with APIView, generics.* and simplejwt views.

    - dispatch(): wraps POST/PUT/PATCH/DELETE in transaction.atomic() so that
      any partial write is rolled back on an unhandled exception.
    - initial(): logs after DRF authentication runs, so request.user is resolved.
      Unauthenticated endpoints (e.g. login) log as "anonymous", which is still
      useful for IP-level audit of auth attempts.
    """

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if request.method.upper() in _MUTATING:
            user = getattr(request, "user", None)
            username = (
                user.username
                if user is not None and user.is_authenticated
                else "anonymous"
            )
            logger.info(
                "%s %s user=%s ip=%s",
                request.method,
                request.path,
                username,
                request.META.get("REMOTE_ADDR"),
            )

    def dispatch(self, request, *args, **kwargs):
        if request.method.upper() in _MUTATING:
            with transaction.atomic():
                return super().dispatch(request, *args, **kwargs)
        return super().dispatch(request, *args, **kwargs)
