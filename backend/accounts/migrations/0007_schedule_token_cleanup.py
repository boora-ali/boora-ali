from django.db import migrations

TASK_NAME = "Limpar tokens bloqueados expirados"
TASK_PATH = "accounts.tasks.flush_expired_blacklisted_tokens"


def create_token_cleanup_schedule(apps, _schema_editor):
    interval_schedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    periodic_task = apps.get_model("django_celery_beat", "PeriodicTask")

    interval, _created = interval_schedule.objects.get_or_create(
        every=7,
        period="days",
    )
    periodic_task.objects.update_or_create(
        name=TASK_NAME,
        defaults={
            "task": TASK_PATH,
            "interval": interval,
            "enabled": True,
            "description": (
                "Remove tokens SimpleJWT expirados, incluindo tokens bloqueados "
                "expirados."
            ),
        },
    )


def remove_token_cleanup_schedule(apps, _schema_editor):
    periodic_task = apps.get_model("django_celery_beat", "PeriodicTask")
    periodic_task.objects.filter(name=TASK_NAME, task=TASK_PATH).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_historicalgoogleidentity_historicalgroup_and_more"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(
            create_token_cleanup_schedule,
            remove_token_cleanup_schedule,
        ),
    ]
