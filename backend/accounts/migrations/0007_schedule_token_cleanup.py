from django.db import migrations

def create_token_cleanup_schedule(apps, _schema_editor):
    from accounts.beat import ensure_token_cleanup_schedule

    ensure_token_cleanup_schedule(apps)


def remove_token_cleanup_schedule(apps, _schema_editor):
    from accounts.beat import remove_token_cleanup_schedule as _remove_token_cleanup_schedule

    _remove_token_cleanup_schedule(apps)


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
