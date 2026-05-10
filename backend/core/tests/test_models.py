import uuid

from django.db import models

from core.models import PublicIdModel


def test_public_id_field_config():
    field = PublicIdModel._meta.get_field("public_id")
    assert isinstance(field, models.UUIDField)
    assert field.unique is True
    assert field.editable is False
    assert field.default is uuid.uuid4
    assert field.db_index is True


def test_public_id_model_is_abstract():
    assert PublicIdModel._meta.abstract is True
