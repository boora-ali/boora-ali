from django.db import migrations

def create_account_purge_schedule(apps, _schema_editor):
    from accounts.beat import ensure_account_purge_schedule

    ensure_account_purge_schedule(apps)


def remove_account_purge_schedule(apps, _schema_editor):
    from accounts.beat import remove_account_purge_schedule as _remove_account_purge_schedule

    _remove_account_purge_schedule(apps)


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0011_alter_googleidentity_created_at_and_more"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(
            create_account_purge_schedule,
            remove_account_purge_schedule,
        ),
    ]
