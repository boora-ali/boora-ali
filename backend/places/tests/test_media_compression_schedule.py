from __future__ import annotations

import pytest
from django_celery_beat.models import PeriodicTask

pytestmark = pytest.mark.django_db


def test_media_compression_periodic_task_is_scheduled_daily_at_2am():
    task = PeriodicTask.objects.get(
        name="Comprimir mídias recentes",
        task="places.tasks.compress_recent_media",
    )

    assert task.enabled is True
    assert task.crontab is not None
    assert task.crontab.hour == "2"
    assert task.crontab.minute == "0"
    assert task.crontab.day_of_week == "*"
    assert task.crontab.day_of_month == "*"
    assert task.crontab.month_of_year == "*"
