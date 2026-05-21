import secrets
from unittest.mock import patch

import pytest
from django.utils import timezone


def _auto_verify_send(user, profile) -> None:
    """Test replacement for _send_verification_email: skips network, auto-verifies."""
    token = secrets.token_urlsafe(32)
    profile.email_verification_token = token
    profile.email_verification_sent_at = timezone.now()
    profile.email_verified = True
    profile.save(
        update_fields=[
            "email_verification_token",
            "email_verification_sent_at",
            "email_verified",
        ]
    )


@pytest.fixture(autouse=True)
def auto_verify_on_register():
    """Patch _send_verification_email so register auto-verifies in tests."""
    with patch(
        "accounts.views._send_verification_email", side_effect=_auto_verify_send
    ):
        yield
