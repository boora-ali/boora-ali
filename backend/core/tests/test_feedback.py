import pytest
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from core.feedback import FeedbackMessage

pytestmark = pytest.mark.django_db

_PUBLIC_IP = "203.0.113.42"


def test_feedback_creates_message_and_emails(api_client, monkeypatch):
    captured = {}

    def fake_send(payload):
        captured["payload"] = payload

    monkeypatch.setattr("core.feedback.resend.Emails.send", fake_send)

    response = api_client.post(
        "/api/feedback/",
        {
            "kind": "bug",
            "message": "Broken map on landing",
            "page_url": "https://booraali.com.br/",
        },
        format="json",
    )

    assert response.status_code == 201
    assert FeedbackMessage.objects.count() == 1
    message = FeedbackMessage.objects.get()
    assert message.kind == "bug"
    assert message.message == "Broken map on landing"
    assert message.page_url == "https://booraali.com.br/"
    assert captured["payload"]["to"] == ["samuelviana.dev@gmail.com"]
    assert "Broken map on landing" in captured["payload"]["text"]


def test_feedback_includes_authenticated_user(api_client, user, monkeypatch):
    api_client.force_authenticate(user)
    captured = {}

    def fake_send(payload):
        captured["payload"] = payload

    monkeypatch.setattr("core.feedback.resend.Emails.send", fake_send)

    response = api_client.post(
        "/api/feedback/",
        {"kind": "suggestion", "message": "Add a report button"},
        format="json",
    )

    assert response.status_code == 201
    assert "alice <a@a.com>" in captured["payload"]["text"]
    assert "Add a report button" in captured["payload"]["text"]


def test_feedback_persists_when_email_fails(api_client, monkeypatch):
    def fake_send(payload):
        raise RuntimeError("boom")

    monkeypatch.setattr("core.feedback.resend.Emails.send", fake_send)

    response = api_client.post(
        "/api/feedback/",
        {"kind": "suggestion", "message": "Please add a bug report link"},
        format="json",
    )

    assert response.status_code == 201
    assert FeedbackMessage.objects.filter(message="Please add a bug report link").exists()


@override_settings(
    THROTTLE_EXEMPT_CIDRS=[],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}},
    REST_FRAMEWORK={
        "DEFAULT_THROTTLE_CLASSES": [
            "rest_framework.throttling.AnonRateThrottle",
            "rest_framework.throttling.UserRateThrottle",
            "rest_framework.throttling.ScopedRateThrottle",
        ],
        "DEFAULT_THROTTLE_RATES": {
            "anon": "100/hour",
            "user": "1000/hour",
            "auth": "30/minute",
            "feedback": "1/minute",
        },
    },
)
def test_feedback_throttles():
    cache.clear()
    api_client = APIClient()
    payload = {"kind": "suggestion", "message": "Add dark mode"}

    first = api_client.post("/api/feedback/", payload, format="json", REMOTE_ADDR=_PUBLIC_IP)
    second = api_client.post("/api/feedback/", payload, format="json", REMOTE_ADDR=_PUBLIC_IP)

    assert first.status_code == 201
    assert second.status_code == 429


def test_feedback_rejects_invalid_payload(api_client):
    bad_kind = api_client.post(
        "/api/feedback/",
        {"kind": "not-a-kind", "message": "Hello"},
        format="json",
    )
    empty_message = api_client.post(
        "/api/feedback/",
        {"kind": "bug", "message": "   "},
        format="json",
    )

    assert bad_kind.status_code == 400
    assert empty_message.status_code == 400
