import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(
        username="alice", email="a@a.com", password="pw12345!"
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        username="bob", email="b@b.com", password="pw12345!"
    )


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user)
    return api_client
