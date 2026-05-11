from unittest.mock import patch

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from model_bakery import baker

pytestmark = pytest.mark.django_db


def test_create_place(auth_client):
    r = auth_client.post(
        "/api/places/",
        {"name": "Café X", "category": "café", "status": "want_to_visit"},
        format="json",
    )
    assert r.status_code == 201


def test_create_place_returns_public_id(auth_client):
    r = auth_client.post(
        "/api/places/",
        {"name": "Café X", "category": "café", "status": "want_to_visit"},
        format="json",
    )
    assert r.status_code == 201
    assert "public_id" in r.data
    assert "id" not in r.data


def test_create_place_accepts_manual_coordinates(auth_client):
    r = auth_client.post(
        "/api/places/",
        {
            "name": "Café X",
            "category": "café",
            "status": "want_to_visit",
            "latitude": "-3.1019444",
            "longitude": "-60.0250000",
        },
        format="json",
    )

    assert r.status_code == 201
    assert r.data["latitude"] == "-3.1019444"
    assert r.data["longitude"] == "-60.0250000"


@pytest.mark.django_db(transaction=True)
@patch("places.views.resolve_place_coords.delay")
def test_create_place_with_short_maps_url_queues_background_resolution(
    mock_delay, auth_client
):
    r = auth_client.post(
        "/api/places/",
        {
            "name": "Café X",
            "category": "café",
            "status": "want_to_visit",
            "maps_url": "https://maps.app.goo.gl/boraali",
        },
        format="json",
    )

    assert r.status_code == 201
    assert r.data["coords_status"] == "pending"
    assert r.data["latitude"] is None
    assert r.data["longitude"] is None
    from places.models import Place

    place = Place.objects.get(public_id=r.data["public_id"])
    mock_delay.assert_called_once_with(place.pk)


@pytest.mark.django_db(transaction=True)
@patch("places.views.resolve_place_coords.delay")
def test_create_place_with_long_maps_url_resolves_coords_inline(
    mock_delay, auth_client
):
    r = auth_client.post(
        "/api/places/",
        {
            "name": "Café X",
            "category": "café",
            "status": "want_to_visit",
            "maps_url": "https://www.google.com/maps/@-3.1019444,-60.0250000,17z",
        },
        format="json",
    )

    assert r.status_code == 201
    assert r.data["coords_status"] == "resolved"
    assert r.data["latitude"] == "-3.1019444"
    assert r.data["longitude"] == "-60.0250000"
    mock_delay.assert_not_called()


def test_list_includes_coordinates_for_places_map(auth_client, user):
    baker.make(
        "places.Place",
        user=user,
        name="Café X",
        latitude="-3.1019444",
        longitude="-60.0250000",
        maps_url="https://maps.google.com/maps?q=-3.1019444,-60.0250000",
    )

    r = auth_client.get("/api/places/")

    assert r.status_code == 200
    assert r.data["results"][0]["latitude"] == "-3.1019444"
    assert r.data["results"][0]["longitude"] == "-60.0250000"
    assert r.data["results"][0]["maps_url"] == (
        "https://maps.google.com/maps?q=-3.1019444,-60.0250000"
    )


def test_manual_coordinates_override_maps_url(auth_client):
    r = auth_client.post(
        "/api/places/",
        {
            "name": "Café X",
            "category": "café",
            "status": "want_to_visit",
            "maps_url": ("https://maps.google.com/maps?q=-3.0000000,-60.0000000"),
            "latitude": "-3.1019444",
            "longitude": "-60.0250000",
        },
        format="json",
    )

    assert r.status_code == 201
    assert r.data["latitude"] == "-3.1019444"
    assert r.data["longitude"] == "-60.0250000"


def test_create_place_rejects_non_google_maps_url(auth_client):
    r = auth_client.post(
        "/api/places/",
        {
            "name": "Café X",
            "category": "café",
            "status": "want_to_visit",
            "maps_url": "https://evil.com/maps",
        },
        format="json",
    )

    assert r.status_code == 400
    assert "maps_url" in r.data["field_errors"]


@pytest.mark.django_db(transaction=True)
@patch("places.views.resolve_place_coords.delay")
def test_update_place_with_short_maps_url_queues_background_resolution(
    mock_delay, auth_client, user
):
    place = baker.make("places.Place", user=user, maps_url="")

    r = auth_client.patch(
        f"/api/places/{place.public_id}/",
        {
            "maps_url": "https://maps.app.goo.gl/boraali",
        },
        format="json",
    )

    assert r.status_code == 200
    assert r.data["coords_status"] == "pending"
    assert r.data["latitude"] is None
    assert r.data["longitude"] is None
    mock_delay.assert_called_once_with(place.pk)


def test_list_only_own(auth_client, user, other_user):
    baker.make("places.Place", user=user, _quantity=2)
    baker.make("places.Place", user=other_user, _quantity=3)
    r = auth_client.get("/api/places/")
    assert r.status_code == 200
    assert r.data["count"] == 2


def test_cannot_access_others_place(auth_client, other_user):
    p = baker.make("places.Place", user=other_user)
    assert auth_client.get(f"/api/places/{p.public_id}/").status_code == 404


def test_filter_by_status(auth_client, user):
    baker.make("places.Place", user=user, status="favorite")
    baker.make("places.Place", user=user, status="visited")
    r = auth_client.get("/api/places/?status=favorite")
    assert r.data["count"] == 1


def test_search_by_name(auth_client, user):
    baker.make("places.Place", user=user, name="Padaria Bom Pão")
    baker.make("places.Place", user=user, name="Outro")
    r = auth_client.get("/api/places/?search=Padaria")
    assert r.data["count"] == 1


def test_pagination(auth_client, user):
    baker.make("places.Place", user=user, _quantity=25)
    r = auth_client.get("/api/places/")
    assert r.data["count"] == 25
    assert len(r.data["results"]) == 4


def test_detail_includes_consumables_summary(auth_client, user):
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)
    baker.make("places.VisitItem", visit=visit, rating=8, price="12.50")
    baker.make("places.VisitItem", visit=visit, rating=10, price="18.00")

    r = auth_client.get(f"/api/places/{place.public_id}/")

    assert r.status_code == 200
    assert r.data["consumables_count"] == 2
    assert float(r.data["average_consumable_rating"]) == 9.0
    assert r.data["total_consumed_amount"] == "30.50"


def test_detail_avoids_n_plus_one_queries(auth_client, user):
    place = baker.make("places.Place", user=user)
    visits = baker.make("places.Visit", place=place, _quantity=3)
    for visit in visits:
        baker.make("places.VisitItem", visit=visit, _quantity=4)

    with CaptureQueriesContext(connection) as queries:
        r = auth_client.get(f"/api/places/{place.public_id}/")

    assert r.status_code == 200
    assert len(queries) == 2
    assert "items" not in r.data["visits"][0]


def test_detail_can_expand_visit_items(auth_client, user):
    place = baker.make("places.Place", user=user)
    visit = baker.make("places.Visit", place=place)
    baker.make("places.VisitItem", visit=visit)

    r = auth_client.get(f"/api/places/{place.public_id}/?expand=visits.items")

    assert r.status_code == 200
    assert "items" in r.data["visits"][0]
    assert len(r.data["visits"][0]["items"]) == 1


def test_detail_payload_is_smaller_than_expanded_payload(auth_client, user):
    place = baker.make("places.Place", user=user)
    visits = baker.make("places.Visit", place=place, _quantity=2)
    for visit in visits:
        baker.make("places.VisitItem", visit=visit, _quantity=3)

    summarized = auth_client.get(f"/api/places/{place.public_id}/")
    expanded = auth_client.get(f"/api/places/{place.public_id}/?expand=visits.items")

    assert summarized.status_code == 200
    assert expanded.status_code == 200
    assert "items" not in summarized.data["visits"][0]
    assert "items" in expanded.data["visits"][0]
    assert len(summarized.content) < len(expanded.content)


def test_list_can_expand_visits(auth_client, user):
    place = baker.make("places.Place", user=user)
    baker.make("places.Visit", place=place)

    r = auth_client.get("/api/places/?expand=visits")

    assert r.status_code == 200
    assert "visits" in r.data["results"][0]
    assert len(r.data["results"][0]["visits"]) == 1


def test_list_expand_visits_items_avoids_n_plus_one(auth_client, user):
    places = baker.make("places.Place", user=user, _quantity=5)
    for place in places:
        visits = baker.make("places.Visit", place=place, _quantity=2)
        for visit in visits:
            baker.make("places.VisitItem", visit=visit, _quantity=2)

    with CaptureQueriesContext(connection) as queries:
        r = auth_client.get("/api/places/?expand=visits.items")

    assert r.status_code == 200
    assert len(r.data["results"]) == 4
    assert "items" in r.data["results"][0]["visits"][0]
    assert len(queries) <= 7
