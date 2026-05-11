"""
Regression tests for migrations that caused Sentry errors in production.
"""

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

LATEST_ACCOUNTS_MIGRATION = (
    "accounts",
    "0007_schedule_token_cleanup",
)


def restore_latest_accounts_migration():
    MigrationExecutor(connection).migrate([LATEST_ACCOUNTS_MIGRATION])


@pytest.mark.django_db(transaction=True)
def test_0005_terms_accepted_idempotent_when_columns_already_exist():
    """
    Regression: 'column "terms_accepted_at" of relation "accounts_user_profile" already exists'

    Reproduces the scenario where 0005 failed because the columns were already in the DB
    (e.g., partial migration run without the django_migrations record being committed).
    """
    try:
        executor = MigrationExecutor(connection)

        # Roll back to state before 0005
        executor.migrate([("accounts", "0004_google_identity")])

        # Simulate columns already existing in the DB (the root cause of the Sentry error)
        with connection.cursor() as cursor:
            if connection.vendor == "postgresql":
                cursor.execute(
                    "ALTER TABLE accounts_user_profile"
                    " ADD COLUMN terms_accepted_at TIMESTAMPTZ NULL"
                )
                cursor.execute(
                    "ALTER TABLE accounts_user_profile"
                    " ADD COLUMN terms_version VARCHAR(20) NOT NULL DEFAULT ''"
                )
            else:
                cursor.execute(
                    "ALTER TABLE accounts_user_profile"
                    " ADD COLUMN terms_accepted_at DATETIME NULL"
                )
                cursor.execute(
                    "ALTER TABLE accounts_user_profile"
                    " ADD COLUMN terms_version VARCHAR(20) NOT NULL DEFAULT ''"
                )

        # Apply 0005 — must not raise even though columns already exist
        executor = MigrationExecutor(connection)
        executor.migrate([("accounts", "0005_terms_accepted")])

        # Verify the columns are present and readable
        with connection.cursor() as cursor:
            col_names = {
                info.name
                for info in connection.introspection.get_table_description(
                    cursor, "accounts_user_profile"
                )
            }
        assert "terms_accepted_at" in col_names
        assert "terms_version" in col_names
    finally:
        restore_latest_accounts_migration()


@pytest.mark.django_db(transaction=True)
def test_0005_terms_accepted_applies_cleanly_from_scratch():
    """Fresh apply of 0005 (no pre-existing columns) must work normally."""
    try:
        executor = MigrationExecutor(connection)
        executor.migrate([("accounts", "0004_google_identity")])

        executor = MigrationExecutor(connection)
        executor.migrate([("accounts", "0005_terms_accepted")])

        with connection.cursor() as cursor:
            col_names = {
                info.name
                for info in connection.introspection.get_table_description(
                    cursor, "accounts_user_profile"
                )
            }
        assert "terms_accepted_at" in col_names
        assert "terms_version" in col_names
    finally:
        restore_latest_accounts_migration()
