from __future__ import annotations

import logging
from datetime import timedelta

from celery import shared_task
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

_log = logging.getLogger("accounts.tasks")

_ACCOUNT_DELETION_GRACE_DAYS = 7


@shared_task
def purge_deleted_accounts():
    """Deleta permanentemente contas com deletion_requested_at > 7 dias."""
    cutoff = timezone.now() - timedelta(days=_ACCOUNT_DELETION_GRACE_DAYS)
    User = get_user_model()

    expired = User.objects.filter(
        profile__deletion_requested_at__isnull=False,
        profile__deletion_requested_at__lt=cutoff,
    )

    if not expired.exists():
        return {"deleted": 0}

    # user.delete() dispara CASCADE (Place→Visit→VisitItem→post_delete signals de storage)
    deleted_count = 0
    for user in expired.iterator():
        user.delete()
        deleted_count += 1

    _log.info("purge_deleted_accounts: %d conta(s) deletada(s)", deleted_count)
    return {"deleted": deleted_count}


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
