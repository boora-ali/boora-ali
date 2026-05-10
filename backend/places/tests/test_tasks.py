from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest
from model_bakery import baker

from places.tasks import _resolve_place_coords

pytestmark = pytest.mark.django_db


class RetryCalled(Exception):
    pass


def make_task_self(retries: int):
    def retry(*, exc, countdown):
        raise RetryCalled((exc, countdown))

    return SimpleNamespace(
        request=SimpleNamespace(retries=retries),
        max_retries=3,
        retry=retry,
    )


@patch("places.tasks.urllib.request.urlopen")
def test_resolve_place_coords_updates_place(mock_urlopen, user):
    place = baker.make(
        "places.Place",
        user=user,
        maps_url="https://maps.app.goo.gl/boraali",
        coords_status="pending",
    )
    mock_urlopen.return_value = SimpleNamespace(
        url="https://www.google.com/maps/@-3.1019444,-60.0250000,17z"
    )

    _resolve_place_coords(make_task_self(0), place.pk)

    place.refresh_from_db()
    assert place.coords_status == "resolved"
    assert str(place.latitude) == "-3.1019444"
    assert str(place.longitude) == "-60.0250000"


@patch("places.tasks.urllib.request.urlopen", side_effect=OSError("boom"))
def test_resolve_place_coords_retries_with_backoff(mock_urlopen, user):
    place = baker.make(
        "places.Place",
        user=user,
        maps_url="https://maps.app.goo.gl/boraali",
        coords_status="pending",
    )

    with pytest.raises(RetryCalled) as error:
        _resolve_place_coords(make_task_self(1), place.pk)

    assert error.value.args[0][1] == 120
    place.refresh_from_db()
    assert place.coords_status == "pending"


@patch("places.tasks.urllib.request.urlopen", side_effect=OSError("boom"))
def test_resolve_place_coords_marks_failed_after_three_retries(mock_urlopen, user):
    place = baker.make(
        "places.Place",
        user=user,
        maps_url="https://maps.app.goo.gl/boraali",
        coords_status="pending",
    )

    _resolve_place_coords(make_task_self(3), place.pk)

    place.refresh_from_db()
    assert place.coords_status == "failed"
