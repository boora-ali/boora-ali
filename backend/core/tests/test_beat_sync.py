from __future__ import annotations

import pytest
from django.core.management import call_command
from django_celery_beat.models import PeriodicTask

pytestmark = pytest.mark.django_db


def test_sync_beat_tasks_command_recreates_all_project_schedules():
    PeriodicTask.objects.filter(
        name__in=[
            "Comprimir mídias recentes",
            "Limpar tokens bloqueados expirados",
            "Apagar contas agendadas",
        ]
    ).delete()

    call_command("sync_beat_tasks")

    assert PeriodicTask.objects.filter(
        name="Comprimir mídias recentes",
        task="places.tasks.compress_recent_media",
    ).exists()
    assert PeriodicTask.objects.filter(
        name="Limpar tokens bloqueados expirados",
        task="accounts.tasks.flush_expired_blacklisted_tokens",
    ).exists()
    assert PeriodicTask.objects.filter(
        name="Apagar contas agendadas",
        task="accounts.tasks.purge_deleted_accounts",
    ).exists()
