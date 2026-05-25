from django.db import migrations

def create_media_compression_schedule(apps, _schema_editor):
    from places.beat import ensure_media_compression_schedule

    ensure_media_compression_schedule(apps)


def remove_media_compression_schedule(apps, _schema_editor):
    from places.beat import remove_media_compression_schedule as _remove_media_compression_schedule

    _remove_media_compression_schedule(apps)


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
