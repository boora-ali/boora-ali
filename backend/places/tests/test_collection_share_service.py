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
from places.models import Collection, CollectionPlace, CollectionShare, Place
from places.services import CollectionShareImportStatus, CollectionShareService

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
    assert CollectionShareService.build_share_url("abc123").endswith(
        "/share/collections/abc123"
    )


def test_create_share_materializes_snapshot(user):
    collection = baker.make(Collection, user=user, name="Favoritos", emoji="⭐")
    place = baker.make(
        "places.Place",
        user=user,
        name="Café X",
        category="cafe",
        address="Rua Y, 123",
        notes="Notas antigas",
    )
    baker.make(CollectionPlace, collection=collection, place=place)

    with patch("places.services.transaction.on_commit"):
        share = CollectionShareService.create_share(collection, user)

    snapshot = share.place_snapshots.get()
    assert share.snapshot_name == "Favoritos"
    assert snapshot.name == "Café X"
    assert snapshot.notes == "Notas antigas"
    assert snapshot.source_place_public_id == place.public_id
    assert snapshot.order_index == 0


def test_get_share_detail_returns_frozen_data(user):
    collection = baker.make(Collection, user=user, name="Origem", emoji="☕")
    place = baker.make(
        "places.Place",
        user=user,
        name="Café antigo",
        category="cafe",
        address="Rua A, 10",
        instagram_url="https://instagram.com/original",
        maps_url="https://maps.google.com/?q=old",
        status="favorite",
        notes="snapshot",
    )
    baker.make(CollectionPlace, collection=collection, place=place)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name="Origem",
        snapshot_emoji="☕",
        snapshot_description="antes",
        is_active=True,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=place.public_id,
        name="Café antigo",
        category="cafe",
        address="Rua A, 10",
        instagram_url="https://instagram.com/original",
        maps_url="https://maps.google.com/?q=old",
        status="favorite",
        notes="snapshot",
        source_cover_photo_path="",
        cover_photo_path="",
        order_index=0,
    )

    place.name = "Café novo"
    place.notes = "mudou"
    place.save(update_fields=["name", "notes"])

    detail = CollectionShareService.get_share_detail(share.token)
    assert detail["name"] == "Origem"
    assert detail["emoji"] == "☕"
    assert detail["description"] == "antes"
    assert detail["place_count"] == 1
    assert detail["places"][0]["name"] == "Café antigo"
    assert detail["places"][0]["notes"] == "snapshot"


def test_get_share_media_bytes_decrypts_encrypted_content(user):
    collection = baker.make(Collection, user=user)
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name="Share",
        is_active=True,
    )
    snapshot = baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=baker.make("places.Place", user=user).public_id,
        name="Café",
        category="cafe",
        address="Rua X",
        status="favorite",
        source_cover_photo_path="users/1/collection_shares/x.jpg",
        cover_photo_path="users/1/collection_shares/x.jpg",
        order_index=0,
    )
    path = snapshot.cover_photo_path
    exp = int(time.time()) + 3600
    sig = _make_share_sig(share.token, path, exp)

    fake_decrypted = _make_jpeg_bytes()
    fake_raw = ImageService.encrypt(fake_decrypted, user_id=user.pk)
    mock_file = MagicMock()
    mock_file.read.return_value = fake_raw

    with patch("places.services.default_storage") as mock_storage:
        mock_storage.open.return_value = mock_file
        result = CollectionShareService.get_share_media_bytes(
            share.token, path, sig, exp
        )

    assert result == fake_decrypted


def test_finalize_collection_share_copies_cover_and_activates(user):
    collection = baker.make(Collection, user=user)
    place = baker.make(
        "places.Place",
        user=user,
        cover_photo="users/1/places/covers/source.jpg",
    )
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name="Share",
        is_active=False,
    )
    snapshot = baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=place.public_id,
        name=place.name,
        category=place.category,
        address=place.address,
        status=place.status,
        source_cover_photo_path=str(place.cover_photo),
        cover_photo_path="",
        order_index=0,
    )

    raw = _make_jpeg_bytes()
    mock_file = MagicMock()
    mock_file.read.return_value = raw

    with (
        patch("places.tasks._read_media_bytes", return_value=raw),
        patch("core.image_service.default_storage"),
    ):
        from places.tasks import finalize_collection_share

        finalize_collection_share.run(share.pk)

    share.refresh_from_db()
    snapshot.refresh_from_db()
    assert share.is_active is True
    assert snapshot.cover_photo_path


def test_import_shared_collection_reuses_existing_place_and_creates_new_ones(
    user, other_user
):
    collection = baker.make(Collection, user=other_user, name="Origem", emoji="⭐")
    existing_place = baker.make(
        Place,
        user=user,
        name="Lugar repetido",
        address="Rua Repetida, 10",
        category="cafe",
        status="favorite",
        notes="meu lugar",
    )
    duplicate_snapshot_place = baker.make(
        Place,
        user=other_user,
        name=existing_place.name,
        address=existing_place.address,
        category="cafe",
        status="favorite",
        notes="snapshot",
    )
    new_snapshot_place = baker.make(
        Place,
        user=other_user,
        name="Lugar novo",
        address="Rua Nova, 20",
        category="bar",
        status="want_to_visit",
        notes="novo",
    )
    baker.make(CollectionPlace, collection=collection, place=duplicate_snapshot_place)
    baker.make(CollectionPlace, collection=collection, place=new_snapshot_place)
    share = baker.make(
        CollectionShare,
        owner=other_user,
        source_collection=collection,
        snapshot_name="Origem",
        snapshot_emoji="⭐",
        snapshot_description="descrição",
        is_active=True,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=duplicate_snapshot_place.public_id,
        name=existing_place.name,
        category="cafe",
        address=existing_place.address,
        instagram_url="",
        maps_url="",
        coords_status="resolved",
        latitude=None,
        longitude=None,
        status="favorite",
        notes="snapshot",
        source_cover_photo_path="",
        cover_photo_path="",
        order_index=0,
    )
    baker.make(
        "places.CollectionSharePlaceSnapshot",
        share=share,
        source_place_public_id=new_snapshot_place.public_id,
        name="Lugar novo",
        category="bar",
        address="Rua Nova, 20",
        instagram_url="",
        maps_url="",
        coords_status="resolved",
        latitude=None,
        longitude=None,
        status="want_to_visit",
        notes="novo",
        source_cover_photo_path="",
        cover_photo_path="",
        order_index=1,
    )

    outcome = CollectionShareService.import_shared_collection(share.token, user)

    assert outcome.status == CollectionShareImportStatus.IMPORTED
    assert outcome.imported_collection is not None
    imported = outcome.imported_collection
    assert imported.user == user
    assert imported.name == "Origem"
    assert imported.collection_places.count() == 2
    imported_place_ids = set(
        imported.collection_places.values_list("place_id", flat=True)
    )
    assert existing_place.pk in imported_place_ids
    assert (
        Place.objects.filter(
            user=user, name="Lugar novo", address="Rua Nova, 20"
        ).count()
        == 1
    )


def test_import_shared_collection_rejects_owner(user):
    collection = baker.make(Collection, user=user, name="Minha coleção", emoji="📍")
    share = baker.make(
        CollectionShare,
        owner=user,
        source_collection=collection,
        snapshot_name=collection.name,
        is_active=True,
    )
    outcome = CollectionShareService.import_shared_collection(share.token, user)

    assert outcome.status == CollectionShareImportStatus.OWNER
    assert outcome.imported_collection is None
