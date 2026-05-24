from django.db import migrations

TASK_NAME = "Comprimir mídias recentes"
TASK_PATH = "places.tasks.compress_recent_media"


def create_media_compression_schedule(apps, _schema_editor):
    crontab_schedule = apps.get_model("django_celery_beat", "CrontabSchedule")
    periodic_task = apps.get_model("django_celery_beat", "PeriodicTask")

    crontab, _created = crontab_schedule.objects.get_or_create(
        minute="0",
        hour="2",
        day_of_week="*",
        day_of_month="*",
        month_of_year="*",
    )
    periodic_task.objects.update_or_create(
        name=TASK_NAME,
        defaults={
            "task": TASK_PATH,
            "crontab": crontab,
            "enabled": True,
            "description": (
                "Comprime em background as mídias alteradas nas últimas 24h, "
                "fora do caminho síncrono de upload."
            ),
        },
    )


def remove_media_compression_schedule(apps, _schema_editor):
    periodic_task = apps.get_model("django_celery_beat", "PeriodicTask")
    periodic_task.objects.filter(name=TASK_NAME, task=TASK_PATH).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("places", "0014_placeshare"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(
            create_media_compression_schedule,
            remove_media_compression_schedule,
        ),
    ]
