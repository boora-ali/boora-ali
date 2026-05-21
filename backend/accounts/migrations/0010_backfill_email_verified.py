from django.db import migrations


def backfill_email_verified(apps, schema_editor):
    UserProfile = apps.get_model("accounts", "UserProfile")
    UserProfile.objects.filter(email_verified=False).update(email_verified=True)


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0009_email_verification"),
    ]

    operations = [
        migrations.RunPython(backfill_email_verified, migrations.RunPython.noop),
    ]
