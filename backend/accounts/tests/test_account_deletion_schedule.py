from __future__ import annotations

import pytest
from django.core.management import call_command
from django_celery_beat.models import PeriodicTask

pytestmark = pytest.mark.django_db


def test_account_purge_periodic_task_is_scheduled_daily_at_2am():
    task = PeriodicTask.objects.get(
        name="Apagar contas agendadas",
        task="accounts.tasks.purge_deleted_accounts",
    )

    assert task.enabled is True
    assert task.crontab is not None
    assert task.crontab.hour == "2"
    assert task.crontab.minute == "0"
    assert task.crontab.day_of_week == "*"
    assert task.crontab.day_of_month == "*"
    assert task.crontab.month_of_year == "*"


def test_sync_account_beat_tasks_command_recreates_the_schedule():
    PeriodicTask.objects.filter(
        name="Apagar contas agendadas",
        task="accounts.tasks.purge_deleted_accounts",
    ).delete()

    call_command("sync_beat_tasks")

    task = PeriodicTask.objects.get(
        name="Apagar contas agendadas",
        task="accounts.tasks.purge_deleted_accounts",
    )

    assert task.enabled is True
    assert task.crontab is not None
