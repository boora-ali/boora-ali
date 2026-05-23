import pytest
from model_bakery import baker

from places.models import PlaceShare


@pytest.mark.django_db
def test_placeshare_token_auto_generated():
    share = baker.make(PlaceShare)
    assert share.token
    assert len(share.token) > 0


@pytest.mark.django_db
def test_placeshare_tokens_are_unique():
    share1 = baker.make(PlaceShare)
    share2 = baker.make(PlaceShare)
    assert share1.token != share2.token


@pytest.mark.django_db
def test_placeshare_is_active_defaults_true():
    share = baker.make(PlaceShare)
    assert share.is_active is True


@pytest.mark.django_db
def test_placeshare_is_active_can_be_false():
    share = baker.make(PlaceShare, is_active=False)
    assert share.is_active is False


@pytest.mark.django_db
def test_placeshare_db_table():
    assert PlaceShare._meta.db_table == "places_place_share"


def test_placeshare_indexes_include_token_active():
    index_fields = {tuple(idx.fields) for idx in PlaceShare._meta.indexes}
    assert ("token", "is_active") in index_fields


@pytest.mark.django_db
def test_placeshare_fk_place_and_owner():
    share = baker.make(PlaceShare)
    assert share.place_id is not None
    assert share.owner_id is not None
