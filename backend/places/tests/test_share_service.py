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
from places.services import PlaceShareService

pytestmark = pytest.mark.django_db


def _make_jpeg_bytes():
    buf = io.BytesIO()
    Image.new("RGB", (8, 8), color=(0, 255, 0)).save(buf, format="JPEG")
    return buf.getvalue()


def _make_share_sig(token: str, path: str, exp: int):
    msg = json.dumps([token, path, exp], separators=(",", ":")).encode()
    return hmac.new(
        settings.MEDIA_ENCRYPTION_KEY.encode(), msg, hashlib.sha256
    ).hexdigest()


def test_build_share_url_includes_token():
    assert PlaceShareService.build_share_url("abc123").endswith("/share/abc123")


def test_get_share_detail_returns_signed_cover_photo_url(user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)

    detail = PlaceShareService.get_share_detail(share.token)

    assert detail["cover_photo_url"] is not None
    assert share.token in detail["cover_photo_url"]
    assert "sig=" in detail["cover_photo_url"]
    assert "exp=" in detail["cover_photo_url"]


def test_get_share_media_bytes_decrypts_encrypted_content(user):
    place = baker.make(Place, user=user, cover_photo="places/covers/img")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)
    path = str(place.cover_photo)
    exp = int(time.time()) + 3600
    sig = _make_share_sig(share.token, path, exp)

    fake_decrypted = _make_jpeg_bytes()
    fake_raw = ImageService.encrypt(fake_decrypted, user_id=user.pk)
    mock_file = MagicMock()
    mock_file.read.return_value = fake_raw

    with patch("places.services.default_storage") as mock_storage:
        mock_storage.open.return_value = mock_file
        result = PlaceShareService.get_share_media_bytes(share.token, path, sig, exp)

    assert result == fake_decrypted


def test_import_shared_place_photo_copies_cover_photo(user, other_user):
    source_place = baker.make(
        Place,
        user=other_user,
        cover_photo="places/covers/source.jpg",
    )
    target_place = baker.make(
        Place,
        user=user,
        cover_photo=None,
    )

    raw = _make_jpeg_bytes()
    decrypted = ImageService.encrypt(raw, user_id=other_user.pk)
    mock_file = MagicMock()
    mock_file.read.return_value = decrypted

    with (
        patch("places.services.default_storage") as mock_storage,
        patch("core.image_service.default_storage"),
    ):
        mock_storage.open.return_value = mock_file
        changed = PlaceShareService.import_shared_place_photo(
            source_place_pk=source_place.pk,
            source_owner_pk=other_user.pk,
            target_place_pk=target_place.pk,
            target_owner_pk=user.pk,
        )

    target_place.refresh_from_db()
    assert changed is True
    assert target_place.cover_photo


def test_import_shared_place_returns_created_outcome_and_dispatches_copy_task(
    user, other_user
):
    source_place = baker.make(
        Place,
        user=other_user,
        name="Import Me",
        address="Rua Import, 10",
        cover_photo="places/covers/source.jpg",
    )
    share = baker.make(PlaceShare, place=source_place, owner=other_user, is_active=True)

    with patch("places.tasks.copy_shared_place_photo") as mock_task:
        outcome = PlaceShareService.import_shared_place(share.token, user)

    assert outcome.status == "created"
    assert outcome.imported_place is not None
    assert outcome.imported_place.user == user
    mock_task.delay.assert_called_once()


def test_import_shared_place_rejects_owner(user):
    place = baker.make(Place, user=user, name="Mine", address="Rua Owner, 1")
    share = baker.make(PlaceShare, place=place, owner=user, is_active=True)

    outcome = PlaceShareService.import_shared_place(share.token, user)

    assert outcome.status == "owner"
    assert outcome.imported_place is None
