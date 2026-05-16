from __future__ import annotations

import logging

from celery import shared_task
from django.core.management import call_command
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

_log = logging.getLogger("accounts.tasks")


@shared_task
def flush_expired_blacklisted_tokens():
    now = timezone.now()
    expired_outstanding_count = OutstandingToken.objects.filter(
        expires_at__lte=now
    ).count()
    expired_blacklisted_count = BlacklistedToken.objects.filter(
        token__expires_at__lte=now
    ).count()

    call_command("flushexpiredtokens")

    result = {
        "expired_outstanding_tokens": expired_outstanding_count,
        "expired_blacklisted_tokens": expired_blacklisted_count,
    }
    _log.info("flush_expired_blacklisted_tokens: %s", result)
    return result
