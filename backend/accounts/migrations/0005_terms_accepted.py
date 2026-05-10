from django.db import migrations, models


def _add_columns(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        if conn.vendor == "postgresql":
            cursor.execute(
                "ALTER TABLE accounts_user_profile"
                " ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NULL"
            )
            cursor.execute(
                "ALTER TABLE accounts_user_profile"
                " ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20) NOT NULL DEFAULT ''"
            )
        else:
            existing = {
                info.name
                for info in conn.introspection.get_table_description(
                    cursor, "accounts_user_profile"
                )
            }
            if "terms_accepted_at" not in existing:
                cursor.execute(
                    "ALTER TABLE accounts_user_profile ADD COLUMN terms_accepted_at DATETIME NULL"
                )
            if "terms_version" not in existing:
                cursor.execute(
                    "ALTER TABLE accounts_user_profile"
                    " ADD COLUMN terms_version VARCHAR(20) NOT NULL DEFAULT ''"
                )


def _remove_columns(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        if conn.vendor == "postgresql":
            cursor.execute(
                "ALTER TABLE accounts_user_profile DROP COLUMN IF EXISTS terms_accepted_at"
            )
            cursor.execute(
                "ALTER TABLE accounts_user_profile DROP COLUMN IF EXISTS terms_version"
            )
        else:
            existing = {
                info.name
                for info in conn.introspection.get_table_description(
                    cursor, "accounts_user_profile"
                )
            }
            if "terms_accepted_at" in existing:
                cursor.execute(
                    "ALTER TABLE accounts_user_profile DROP COLUMN terms_accepted_at"
                )
            if "terms_version" in existing:
                cursor.execute(
                    "ALTER TABLE accounts_user_profile DROP COLUMN terms_version"
                )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_google_identity"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_add_columns, _remove_columns),
            ],
            state_operations=[
                migrations.AddField(
                    model_name="userprofile",
                    name="terms_accepted_at",
                    field=models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="terms accepted at",
                    ),
                ),
                migrations.AddField(
                    model_name="userprofile",
                    name="terms_version",
                    field=models.CharField(
                        blank=True,
                        default="",
                        max_length=20,
                        verbose_name="terms version",
                    ),
                ),
            ],
        ),
    ]
