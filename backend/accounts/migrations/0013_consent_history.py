import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0012_schedule_account_purge"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConsentHistory",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("terms_version", models.CharField(max_length=20, verbose_name="terms version")),
                ("accepted_at", models.DateTimeField(auto_now_add=True, verbose_name="accepted at")),
                (
                    "ip_address",
                    models.GenericIPAddressField(
                        blank=True,
                        null=True,
                        verbose_name="ip address",
                    ),
                ),
                (
                    "user_agent",
                    models.CharField(
                        blank=True,
                        default="",
                        max_length=512,
                        verbose_name="user agent",
                    ),
                ),
                (
                    "method",
                    models.CharField(
                        default="register",
                        max_length=20,
                        verbose_name="method",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="consent_history",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="user",
                    ),
                ),
            ],
            options={
                "db_table": "accounts_consent_history",
                "ordering": ["-accepted_at"],
                "verbose_name": "consent history",
                "verbose_name_plural": "consent histories",
            },
        ),
    ]
