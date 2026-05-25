import uuid
from unittest.mock import patch

import pytest
from model_bakery import baker

from places.models import (
    Collection,
    CollectionPlace,
    CollectionShare,
    CollectionSharePlaceSnapshot,
)
from places.services import CollectionShareService

pytestmark = pytest.mark.django_db


def test_collection_share_token_auto_generated():
    share = baker.make(CollectionShare)
    assert share.token


def test_collection_share_is_active_defaults_false():
    share = baker.make(CollectionShare)
    assert share.is_active is False


def test_collection_share_db_table():
    assert CollectionShare._meta.db_table == "places_collection_share"


def test_collection_share_snapshot_db_table():
    assert (
        CollectionSharePlaceSnapshot._meta.db_table
        == "places_collection_share_place_snapshot"
    )


def test_collection_share_index_includes_token_active():
    index_fields = {tuple(idx.fields) for idx in CollectionShare._meta.indexes}
    assert ("token", "is_active") in index_fields


def test_collection_share_snapshot_ordering():
    assert CollectionSharePlaceSnapshot._meta.ordering == ["order_index", "created_at"]


def test_collection_share_str_includes_collection_and_state():
    collection = baker.make(Collection, name="Favoritos")
    share = baker.make(CollectionShare, snapshot_name="Coleção teste", is_active=True, source_collection=collection)

    assert str(share) == f"Favoritos share (ativo, {share.token[:8]})"


def test_collection_share_snapshot_str_includes_place_and_category():
    collection = baker.make(Collection, name="Favoritos")
    share = baker.make(CollectionShare, snapshot_name="Coleção teste", source_collection=collection)
    snapshot = baker.make(
        CollectionSharePlaceSnapshot,
        share=share,
        name="Café X",
        category="cafe",
        source_place_public_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
        status="favorite",
        order_index=0,
    )

    assert str(snapshot) == "Favoritos: Café X [cafe]"


@pytest.mark.parametrize(
    "field_name, place_kwargs, expected_value",
    [
        (
            "name",
            {"name": "N" * 1900},
            "N" * 1900,
        ),
        (
            "category",
            {"category": "C" * 1900},
            "C" * 1900,
        ),
        (
            "address",
            {"address": "A" * 1900},
            "A" * 1900,
        ),
        (
            "instagram_url",
            {"instagram_url": "https://instagram.com/" + "i" * 1870},
            "https://instagram.com/" + "i" * 1870,
        ),
        (
            "maps_url",
            {"maps_url": "https://maps.google.com/?q=" + "m" * 1870},
            "https://maps.google.com/?q=" + "m" * 1870,
        ),
        (
            "source_cover_photo_path",
            {"cover_photo": "users/1/places/covers/" + "p" * 1850},
            "users/1/places/covers/" + "p" * 1850,
        ),
    ],
)
def test_collection_share_snapshot_fields_allow_2000_chars(
    user, field_name, place_kwargs, expected_value
):
    collection = baker.make(Collection, user=user, name="Favoritos", emoji="⭐")
    place = baker.make("places.Place", user=user, **place_kwargs)
    baker.make(CollectionPlace, collection=collection, place=place)

    with patch("places.services.transaction.on_commit"):
        share = CollectionShareService.create_share(collection, user)

    snapshot = share.place_snapshots.get()
    assert getattr(snapshot, field_name) == expected_value
