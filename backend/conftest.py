import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from accounts.models import UserProfile

User = get_user_model()


def _make_verified_user(username, email, password):
    u = User.objects.create_user(username=username, email=email, password=password)
    UserProfile.objects.update_or_create(user=u, defaults={"email_verified": True})
    return u


@pytest.fixture
def user(db):
    return _make_verified_user("alice", "a@a.com", "pw12345!")


@pytest.fixture
def other_user(db):
    return _make_verified_user("bob", "b@b.com", "pw12345!")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user)
    return api_client
