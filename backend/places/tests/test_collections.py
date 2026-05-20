import pytest
from model_bakery import baker

pytestmark = pytest.mark.django_db

COLLECTION_PAYLOAD = {"name": "Favoritos", "emoji": "⭐", "description": "Os melhores"}


# ---------------------------------------------------------------------------
# CRUD de coleções
# ---------------------------------------------------------------------------


def test_create_collection(auth_client):
    r = auth_client.post("/api/collections/", COLLECTION_PAYLOAD, format="json")
    assert r.status_code == 201
    assert r.data["name"] == "Favoritos"
    assert "public_id" in r.data
    assert "id" not in r.data


def test_list_collections(auth_client, user):
    baker.make("places.Collection", user=user, _quantity=3)
    r = auth_client.get("/api/collections/")
    assert r.status_code == 200
    assert len(r.data["results"]) == 3


def test_retrieve_collection(auth_client, user):
    col = baker.make("places.Collection", user=user, name="Especial")
    r = auth_client.get(f"/api/collections/{col.public_id}/")
    assert r.status_code == 200
    assert r.data["name"] == "Especial"
    assert "places" in r.data


def test_update_collection(auth_client, user):
    col = baker.make("places.Collection", user=user, name="Antigo")
    r = auth_client.patch(
        f"/api/collections/{col.public_id}/", {"name": "Novo"}, format="json"
    )
    assert r.status_code == 200
    assert r.data["name"] == "Novo"


def test_delete_collection(auth_client, user):
    col = baker.make("places.Collection", user=user)
    r = auth_client.delete(f"/api/collections/{col.public_id}/")
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# Ownership
# ---------------------------------------------------------------------------


def test_list_only_own_collections(auth_client, user, other_user):
    baker.make("places.Collection", user=user, _quantity=2)
    baker.make("places.Collection", user=other_user, _quantity=3)
    r = auth_client.get("/api/collections/")
    assert r.status_code == 200
    assert len(r.data["results"]) == 2


def test_cannot_retrieve_other_user_collection(auth_client, other_user):
    col = baker.make("places.Collection", user=other_user)
    r = auth_client.get(f"/api/collections/{col.public_id}/")
    assert r.status_code == 404


def test_cannot_delete_other_user_collection(auth_client, other_user):
    col = baker.make("places.Collection", user=other_user)
    r = auth_client.delete(f"/api/collections/{col.public_id}/")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# place_count annotation
# ---------------------------------------------------------------------------


def test_place_count_in_list(auth_client, user):
    col = baker.make("places.Collection", user=user)
    places = baker.make("places.Place", user=user, _quantity=3)
    for p in places:
        baker.make("places.CollectionPlace", collection=col, place=p)

    r = auth_client.get("/api/collections/")
    assert r.status_code == 200
    result = next(
        item
        for item in r.data["results"]
        if str(item["public_id"]) == str(col.public_id)
    )
    assert result["place_count"] == 3


def test_place_count_zero_when_empty(auth_client, user):
    baker.make("places.Collection", user=user)
    r = auth_client.get("/api/collections/")
    assert r.status_code == 200
    assert r.data["results"][0]["place_count"] == 0


# ---------------------------------------------------------------------------
# POST /collections/{id}/places/{place_id}/
# ---------------------------------------------------------------------------


def test_add_place_to_collection_returns_201(auth_client, user):
    col = baker.make("places.Collection", user=user)
    place = baker.make("places.Place", user=user)
    r = auth_client.post(f"/api/collections/{col.public_id}/places/{place.public_id}/")
    assert r.status_code == 201


def test_add_place_idempotent_returns_200_on_repeat(auth_client, user):
    col = baker.make("places.Collection", user=user)
    place = baker.make("places.Place", user=user)
    url = f"/api/collections/{col.public_id}/places/{place.public_id}/"
    r1 = auth_client.post(url)
    r2 = auth_client.post(url)
    assert r1.status_code == 201
    assert r2.status_code == 200


def test_cannot_add_other_user_place_to_collection(auth_client, user, other_user):
    col = baker.make("places.Collection", user=user)
    place = baker.make("places.Place", user=other_user)
    r = auth_client.post(f"/api/collections/{col.public_id}/places/{place.public_id}/")
    assert r.status_code == 404


def test_cannot_add_place_to_other_user_collection(auth_client, user, other_user):
    col = baker.make("places.Collection", user=other_user)
    place = baker.make("places.Place", user=user)
    r = auth_client.post(f"/api/collections/{col.public_id}/places/{place.public_id}/")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /collections/{id}/places/{place_id}/
# ---------------------------------------------------------------------------


def test_remove_place_from_collection_returns_204(auth_client, user):
    col = baker.make("places.Collection", user=user)
    place = baker.make("places.Place", user=user)
    baker.make("places.CollectionPlace", collection=col, place=place)

    r = auth_client.delete(
        f"/api/collections/{col.public_id}/places/{place.public_id}/"
    )
    assert r.status_code == 204


def test_remove_place_not_in_collection_returns_204(auth_client, user):
    """DELETE is idempotent — if the place isn't in the collection, still 204."""
    col = baker.make("places.Collection", user=user)
    place = baker.make("places.Place", user=user)
    r = auth_client.delete(
        f"/api/collections/{col.public_id}/places/{place.public_id}/"
    )
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# GET detail returns places list
# ---------------------------------------------------------------------------


def test_retrieve_collection_includes_places(auth_client, user):
    col = baker.make("places.Collection", user=user)
    places = baker.make("places.Place", user=user, _quantity=2)
    for p in places:
        baker.make("places.CollectionPlace", collection=col, place=p)

    r = auth_client.get(f"/api/collections/{col.public_id}/")
    assert r.status_code == 200
    assert "places" in r.data
    assert len(r.data["places"]) == 2


def test_retrieve_collection_places_have_public_id(auth_client, user):
    col = baker.make("places.Collection", user=user)
    place = baker.make("places.Place", user=user)
    baker.make("places.CollectionPlace", collection=col, place=place)

    r = auth_client.get(f"/api/collections/{col.public_id}/")
    assert r.status_code == 200
    assert "public_id" in r.data["places"][0]
