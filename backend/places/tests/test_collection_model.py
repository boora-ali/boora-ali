import pytest
from model_bakery import baker

from places.models import Collection

pytestmark = pytest.mark.django_db


def test_collection_str_returns_name():
    collection = baker.make(Collection, name="Favoritos")
    assert str(collection) == "Favoritos"
