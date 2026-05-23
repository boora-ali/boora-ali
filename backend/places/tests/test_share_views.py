import hashlib
import hmac
import io
import json
import time
from unittest.mock import MagicMock, patch

import pytest
from django.conf import settings
from model_bakery import baker
from PIL import Image

from core.image_service import ImageService
from places.models import Place, PlaceShare

pytestmark = pytest.mark.django_db


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_signed_url_params(token: str, path: str, ttl: int = 3600):
    exp = int(time.time()) + ttl
    msg = json.dumps([token, path, exp], separators=(",", ":")).encode()
    sig = hmac.new(
        settings.MEDIA_ENCRYPTION_KEY.encode(), msg, hashlib.sha256
    ).hexdigest()
    return sig, exp


def _make_jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(0, 255, 0)).save(buf, format="JPEG")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# PlaceShareCreateView — POST /api/places/{public_id}/share/
# ---------------------------------------------------------------------------


def test_share_create_returns_token_and_url(auth_client, user):
    place = baker.make(Place, user=user)
    r = auth_client.post(f"/api/places/{place.public_id}/share/")
    assert r.status_code == 201
    assert "token" in r.data
    assert "url" in r.data
    assert r.data["token"]
    assert PlaceShare.objects.filter(place=place, owner=user).exists()


def test_share_create_url_contains_token(auth_client, user):
    place = baker.make(Place, user=user)
    r = auth_client.post(f"/api/places/{place.public_id}/share/")
    assert r.status_code == 201
    assert r.data["token"] in r.data["url"]


def test_share_create_requires_auth(api_client, user):
    place = baker.make(Place, user=user)
    r = api_client.post(f"/api/places/{place.public_id}/share/")
    assert r.status_code == 401


def test_share_create_wrong_user_returns_404(auth_client, other_user):
    place = baker.make(Place, user=other_user)
    r = auth_client.post(f"/api/places/{place.public_id}/share/")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PlaceShareRevokeView — DELETE /api/places/{public_id}/share/{token}/
# ---------------------------------------------------------------------------


def test_share_revoke_sets_inactive(auth_client, user):
    place = baker.make(Place, user=user)
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    r = auth_client.delete(f"/api/places/{place.public_id}/share/{share.token}/")
    assert r.status_code == 204
    share.refresh_from_db()
    assert share.is_active is False


def test_share_revoke_requires_auth(api_client, user):
    place = baker.make(Place, user=user)
    share = baker.make(PlaceShare, place=place, owner=user)
    r = api_client.delete(f"/api/places/{place.public_id}/share/{share.token}/")
    assert r.status_code == 401


def test_share_revoke_wrong_owner_returns_404(auth_client, user, other_user):
    place = baker.make(Place, user=other_user)
    share = baker.make(PlaceShare, place=place, owner=other_user, is_active=True)
    r = auth_client.delete(f"/api/places/{place.public_id}/share/{share.token}/")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PlaceShareDetailView — GET /api/share/{token}/ (no auth)
# ---------------------------------------------------------------------------


def test_share_detail_returns_place_data(api_client, user):
    place = baker.make(Place, user=user, name="Café X", category="cafe")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    r = api_client.get(f"/api/share/{share.token}/")
    assert r.status_code == 200
    assert r.data["name"] == "Café X"
    assert r.data["category"] == "cafe"
    assert "address" in r.data
    assert "status" not in r.data
    assert "cover_photo_url" in r.data


def test_share_detail_inactive_token_returns_404(api_client, user):
    place = baker.make(Place, user=user)
    share = baker.make(PlaceShare, place=place, owner=user, is_active=False)
    r = api_client.get(f"/api/share/{share.token}/")
    assert r.status_code == 404


def test_share_detail_unknown_token_returns_404(api_client):
    r = api_client.get("/api/share/nonexistenttoken123/")
    assert r.status_code == 404


def test_share_detail_no_cover_photo_url_is_none(api_client, user):
    place = baker.make(Place, user=user, cover_photo=None)
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    r = api_client.get(f"/api/share/{share.token}/")
    assert r.status_code == 200
    assert r.data["cover_photo_url"] is None


def test_share_detail_with_cover_photo_returns_signed_url(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/someimage")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    r = api_client.get(f"/api/share/{share.token}/")
    assert r.status_code == 200
    assert r.data["cover_photo_url"] is not None
    assert share.token in r.data["cover_photo_url"]
    assert "sig=" in r.data["cover_photo_url"]
    assert "exp=" in r.data["cover_photo_url"]


# ---------------------------------------------------------------------------
# PlaceShareMediaView — GET /api/share/{token}/media/{path}
# ---------------------------------------------------------------------------


def test_share_media_expired_sig_returns_404(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    path = "places/covers/img"
    exp = int(time.time()) - 10  # already expired
    msg = f"{share.token}:{path}:{exp}".encode()
    sig = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
    r = api_client.get(f"/api/share/{share.token}/media/{path}?sig={sig}&exp={exp}")
    assert r.status_code == 404


def test_share_media_bad_sig_returns_404(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    path = "places/covers/img"
    sig, exp = _make_signed_url_params(share.token, path)
    r = api_client.get(f"/api/share/{share.token}/media/{path}?sig=badsig&exp={exp}")
    assert r.status_code == 404


def test_share_media_valid_sig_returns_decrypted_content(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    path = str(place.cover_photo)
    sig, exp = _make_signed_url_params(share.token, path)

    fake_decrypted = _make_jpeg_bytes()
    fake_raw = ImageService.encrypt(fake_decrypted, user_id=user.pk)

    mock_file = MagicMock()
    mock_file.read.return_value = fake_raw

    with patch("places.views.default_storage") as mock_storage:
        mock_storage.open.return_value = mock_file

        r = api_client.get(f"/api/share/{share.token}/media/{path}?sig={sig}&exp={exp}")

    assert r.status_code == 200
    assert r.content == fake_decrypted


def test_share_media_valid_sig_returns_plaintext_image(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/plain")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    path = str(place.cover_photo)
    sig, exp = _make_signed_url_params(share.token, path)

    fake_plaintext = _make_jpeg_bytes()
    mock_file = MagicMock()
    mock_file.read.return_value = fake_plaintext

    with patch("places.views.default_storage") as mock_storage:
        mock_storage.open.return_value = mock_file

        r = api_client.get(f"/api/share/{share.token}/media/{path}?sig={sig}&exp={exp}")

    assert r.status_code == 200
    assert r.content == fake_plaintext


def test_share_media_inactive_token_returns_404(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=False)
    path = str(place.cover_photo)
    sig, exp = _make_signed_url_params(share.token, path)
    r = api_client.get(f"/api/share/{share.token}/media/{path}?sig={sig}&exp={exp}")
    assert r.status_code == 404


def test_share_media_storage_error_returns_404(api_client, user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    path = str(place.cover_photo)
    sig, exp = _make_signed_url_params(share.token, path)

    with patch("places.views.default_storage") as mock_storage:
        mock_storage.open.side_effect = Exception("file not found")
        r = api_client.get(f"/api/share/{share.token}/media/{path}?sig={sig}&exp={exp}")

    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PlaceShareImportView — POST /api/share/{token}/import/
# ---------------------------------------------------------------------------


def test_share_import_creates_place(auth_client, user, other_user):
    place = baker.make(
        Place,
        user=other_user,
        name="Bar Y",
        address="Rua A, 1",
        category="bar",
        cover_photo=None,
    )
    share = baker.make(PlaceShare, place=place, owner=other_user, is_active=True)
    r = auth_client.post(f"/api/share/{share.token}/import/")
    assert r.status_code == 201
    assert "public_id" in r.data
    assert Place.objects.filter(user=user, name="Bar Y").exists()


def test_share_import_owner_returns_400(auth_client, user):
    place = baker.make(Place, user=user, name="Mine", address="Rua B, 2")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    r = auth_client.post(f"/api/share/{share.token}/import/")
    assert r.status_code == 400
    assert "dono" in r.data["detail"]


def test_share_import_duplicate_returns_400(auth_client, user, other_user):
    place = baker.make(
        Place, user=other_user, name="Duplicate", address="Rua C, 3", cover_photo=None
    )
    share = baker.make(PlaceShare, place=place, owner=other_user, is_active=True)
    # first import succeeds
    r1 = auth_client.post(f"/api/share/{share.token}/import/")
    assert r1.status_code == 201
    # second import → duplicate
    r2 = auth_client.post(f"/api/share/{share.token}/import/")
    assert r2.status_code == 400
    assert "lista" in r2.data["detail"]


def test_share_import_with_cover_photo_dispatches_task(auth_client, user, other_user):
    place = baker.make(
        Place,
        user=other_user,
        name="Photo Place",
        address="Rua D, 4",
        cover_photo="places/covers/photo",
    )
    share = baker.make(PlaceShare, place=place, owner=other_user, is_active=True)
    mock_task = MagicMock()
    with patch("places.views.copy_shared_place_photo", mock_task):
        r = auth_client.post(f"/api/share/{share.token}/import/")
    assert r.status_code == 201
    mock_task.delay.assert_called_once()


def test_share_import_inactive_token_returns_404(auth_client, other_user):
    place = baker.make(Place, user=other_user, name="Inactive", address="Rua E, 5")
    share = baker.make(PlaceShare, place=place, owner=other_user, is_active=False)
    r = auth_client.post(f"/api/share/{share.token}/import/")
    assert r.status_code == 404


def test_share_import_requires_auth(api_client, other_user):
    place = baker.make(Place, user=other_user)
    share = baker.make(PlaceShare, place=place, owner=other_user, is_active=True)
    r = api_client.post(f"/api/share/{share.token}/import/")
    assert r.status_code == 401
