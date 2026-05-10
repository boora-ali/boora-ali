import pytest
from django.db import IntegrityError
from model_bakery import baker

pytestmark = pytest.mark.django_db


def test_google_identity_has_unique_google_sub():
    user = baker.make("auth.User")
    baker.make(
        "accounts.GoogleIdentity",
        user=user,
        google_sub="google-sub-1",
        email="first@example.com",
        email_verified=True,
    )

    with pytest.raises(IntegrityError):
        baker.make(
            "accounts.GoogleIdentity",
            user=baker.make("auth.User"),
            google_sub="google-sub-1",
            email="second@example.com",
            email_verified=True,
        )
