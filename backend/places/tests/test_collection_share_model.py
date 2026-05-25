import pytest
from model_bakery import baker

from places.models import CollectionShare, CollectionSharePlaceSnapshot

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
