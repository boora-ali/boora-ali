from __future__ import annotations

from django.db import migrations


def forwards(apps, schema_editor):
    from places.beat import ensure_history_cleanup_schedule

    ensure_history_cleanup_schedule(apps)


def backwards(apps, schema_editor):
    from places.beat import remove_history_cleanup_schedule

    remove_history_cleanup_schedule(apps)


class Migration(migrations.Migration):
    dependencies = [
        ("places", "0016_alter_collection_created_at_and_more"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]

