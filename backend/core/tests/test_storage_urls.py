import hashlib
import hmac
import time
from unittest.mock import Mock

from core.storage_urls import (
    _media_signing_key,
    build_public_media_url,
    sign_media_url,
    verify_media_url,
)


def test_sign_media_url_returns_exp_and_sig():
    exp, sig = sign_media_url("users/1/places/covers/abc")
    assert isinstance(exp, int)
    assert isinstance(sig, str)
    assert len(sig) == 64  # SHA256 hex = 64 chars
    assert exp > int(time.time())  # in the future


def test_verify_media_url_valid():
    path = "users/1/places/covers/abc"
    exp, sig = sign_media_url(path)
    assert verify_media_url(path, exp, sig) is True


def test_verify_media_url_expired():
    path = "users/1/places/covers/abc"
    past_exp = int(time.time()) - 1  # already expired
    message = f"{path}:{past_exp}".encode()
    sig = hmac.new(_media_signing_key(), message, hashlib.sha256).hexdigest()
    assert verify_media_url(path, past_exp, sig) is False


def test_verify_media_url_wrong_sig():
    path = "users/1/places/covers/abc"
    exp, _ = sign_media_url(path)
    assert verify_media_url(path, exp, "deadbeef" * 8) is False


def test_verify_media_url_wrong_path():
    path_a = "users/1/places/covers/abc"
    path_b = "users/1/places/covers/other"
    exp, sig_a = sign_media_url(path_a)
    # sig_a valid for path_a but not path_b
    assert verify_media_url(path_b, exp, sig_a) is False


def test_build_public_media_url_returns_same_origin():
    field = Mock()
    field.name = "users/1/places/covers/abc_123"
    url = build_public_media_url(field)
    assert url.startswith("/api/media/users/1/places/covers/abc_123")


def test_build_public_media_url_includes_exp_and_sig():
    field = Mock()
    field.name = "users/1/places/covers/abc_123"
    url = build_public_media_url(field)
    assert "?exp=" in url
    assert "&sig=" in url


def test_build_public_media_url_with_request_uses_absolute_uri():
    field = Mock()
    field.name = "users/1/places/covers/abc_123"
    request = Mock()
    request.build_absolute_uri = lambda path: f"https://booraali.com.br{path}"
    url = build_public_media_url(field, request=request)
    assert url.startswith("https://booraali.com.br/api/media/")
    assert "?exp=" in url
    assert "&sig=" in url


def test_build_public_media_url_empty_field():
    assert build_public_media_url(None) == ""
    field = Mock()
    field.name = ""
    assert build_public_media_url(field) == ""
