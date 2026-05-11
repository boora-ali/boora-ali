from __future__ import annotations

import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from django_celery_beat.models import IntervalSchedule, PeriodicTask
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)

from accounts.tasks import flush_expired_blacklisted_tokens


@pytest.mark.django_db
def test_flush_expired_blacklisted_tokens_removes_only_expired_tokens():
    user = User.objects.create_user(username="token-cleanup")
    now = timezone.now()
    expired = OutstandingToken.objects.create(
        user=user,
        jti="expired-token",
        token="expired-token",
        created_at=now - timezone.timedelta(days=10),
        expires_at=now - timezone.timedelta(days=1),
    )
    valid = OutstandingToken.objects.create(
        user=user,
        jti="valid-token",
        token="valid-token",
        created_at=now,
        expires_at=now + timezone.timedelta(days=1),
    )
    BlacklistedToken.objects.create(token=expired)
    BlacklistedToken.objects.create(token=valid)

    result = flush_expired_blacklisted_tokens()

    assert result == {
        "expired_outstanding_tokens": 1,
        "expired_blacklisted_tokens": 1,
    }
    assert not OutstandingToken.objects.filter(jti="expired-token").exists()
    assert not BlacklistedToken.objects.filter(token__jti="expired-token").exists()
    assert OutstandingToken.objects.filter(jti="valid-token").exists()
    assert BlacklistedToken.objects.filter(token__jti="valid-token").exists()


@pytest.mark.django_db
def test_token_cleanup_periodic_task_is_scheduled_every_seven_days():
    task = PeriodicTask.objects.get(
        name="Limpar tokens bloqueados expirados",
        task="accounts.tasks.flush_expired_blacklisted_tokens",
    )

    assert task.enabled is True
    assert task.interval.every == 7
    assert task.interval.period == IntervalSchedule.DAYS
