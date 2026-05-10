"""
CRUD tests for Place, Visit and VisitItem.
Covers create, read, update and delete for each model,
including ownership isolation (user cannot touch other user's data).
"""

import pytest
from model_bakery import baker

pytestmark = pytest.mark.django_db

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

PLACE_PAYLOAD = {"name": "Café Teste", "category": "café", "status": "want_to_visit"}
VISIT_PAYLOAD = {
    "visited_at": "2026-05-01T12:00:00Z",
    "environment_rating": 7,
    "service_rating": 8,
    "overall_rating": 8,
    "would_return": True,
}
ITEM_PAYLOAD = {
    "name": "Espresso",
    "type": "coffee",
    "rating": 9,
    "price": "5.00",
    "would_order_again": True,
}

# ─────────────────────────────────────────────────────────────
# PLACE
# ─────────────────────────────────────────────────────────────


class TestPlaceCRUD:
    def test_create(self, auth_client):
        r = auth_client.post("/api/places/", PLACE_PAYLOAD, format="json")
        assert r.status_code == 201
        assert r.data["name"] == "Café Teste"
        assert "public_id" in r.data
        assert "id" not in r.data

    def test_list(self, auth_client, user):
        baker.make("places.Place", user=user, _quantity=3)
        r = auth_client.get("/api/places/")
        assert r.status_code == 200
        assert r.data["count"] == 3

    def test_retrieve(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        r = auth_client.get(f"/api/places/{place.public_id}/")
        assert r.status_code == 200
        assert r.data["public_id"] == str(place.public_id)

    def test_update(self, auth_client, user):
        place = baker.make("places.Place", user=user, name="Antigo")
        r = auth_client.patch(
            f"/api/places/{place.public_id}/",
            {"name": "Novo"},
            format="json",
        )
        assert r.status_code == 200
        assert r.data["name"] == "Novo"

    def test_delete(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        pid = place.public_id
        r = auth_client.delete(f"/api/places/{pid}/")
        assert r.status_code == 204
        r2 = auth_client.get(f"/api/places/{pid}/")
        assert r2.status_code == 404

    def test_delete_other_user_returns_404(self, auth_client, other_user):
        place = baker.make("places.Place", user=other_user)
        r = auth_client.delete(f"/api/places/{place.public_id}/")
        assert r.status_code == 404

    def test_delete_cascades_to_visits_and_items(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        item = baker.make("places.VisitItem", visit=visit)

        auth_client.delete(f"/api/places/{place.public_id}/")

        visit.refresh_from_db()
        item.refresh_from_db()
        assert visit.deleted_at is not None
        assert item.deleted_at is not None

    def test_list_only_own_places(self, auth_client, user, other_user):
        baker.make("places.Place", user=user, _quantity=2)
        baker.make("places.Place", user=other_user, _quantity=5)
        r = auth_client.get("/api/places/")
        assert r.data["count"] == 2


# ═════════════════════════════════════════════════════════════
# VISIT
# ═════════════════════════════════════════════════════════════


class TestVisitCRUD:
    def test_create_via_place(self, auth_client, user):
        place = baker.make("places.Place", user=user)
        r = auth_client.post(
            f"/api/places/{place.public_id}/visits/",
            VISIT_PAYLOAD,
            format="json",
        )
        assert r.status_code == 201
        assert "public_id" in r.data
        assert "id" not in r.data

    def test_create_foreign_place_returns_404(self, auth_client, other_user):
        place = baker.make("places.Place", user=other_user)
        r = auth_client.post(
            f"/api/places/{place.public_id}/visits/",
            VISIT_PAYLOAD,
            format="json",
        )
        assert r.status_code == 404

    def test_retrieve(self, auth_client, user):
        visit = baker.make("places.Visit", place__user=user)
        r = auth_client.get(f"/api/visits/{visit.public_id}/")
        assert r.status_code == 200
        assert r.data["public_id"] == str(visit.public_id)

    def test_update(self, auth_client, user):
        visit = baker.make("places.Visit", place__user=user, overall_rating=5)
        r = auth_client.patch(
            f"/api/visits/{visit.public_id}/",
            {"overall_rating": 10},
            format="json",
        )
        assert r.status_code == 200
        assert float(r.data["overall_rating"]) == 10.0

    def test_delete(self, auth_client, user):
        visit = baker.make("places.Visit", place__user=user)
        vid = visit.public_id
        r = auth_client.delete(f"/api/visits/{vid}/")
        assert r.status_code == 204
        visit.refresh_from_db()
        assert visit.deleted_at is not None

    def test_delete_other_user_returns_404(self, auth_client, other_user):
        visit = baker.make("places.Visit", place__user=other_user)
        r = auth_client.delete(f"/api/visits/{visit.public_id}/")
        assert r.status_code == 404

    def test_delete_cascades_to_items(self, auth_client, user):
        visit = baker.make("places.Visit", place__user=user)
        item = baker.make("places.VisitItem", visit=visit)

        auth_client.delete(f"/api/visits/{visit.public_id}/")

        item.refresh_from_db()
        assert item.deleted_at is not None


# ═════════════════════════════════════════════════════════════
# VISIT ITEM
# ═════════════════════════════════════════════════════════════


class TestVisitItemCRUD:
    def test_create_via_visit(self, auth_client, user):
        visit = baker.make("places.Visit", place__user=user)
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            ITEM_PAYLOAD,
            format="json",
        )
        assert r.status_code == 201
        assert "public_id" in r.data
        assert "id" not in r.data

    def test_create_foreign_visit_returns_404(self, auth_client, other_user):
        visit = baker.make("places.Visit", place__user=other_user)
        r = auth_client.post(
            f"/api/visits/{visit.public_id}/items/",
            ITEM_PAYLOAD,
            format="json",
        )
        assert r.status_code == 404

    def test_update(self, auth_client, user):
        item = baker.make("places.VisitItem", visit__place__user=user, name="Velho")
        r = auth_client.patch(
            f"/api/visit-items/{item.public_id}/",
            {"name": "Novo"},
            format="json",
        )
        assert r.status_code == 200
        assert r.data["name"] == "Novo"

    def test_delete(self, auth_client, user):
        item = baker.make("places.VisitItem", visit__place__user=user)
        iid = item.public_id
        r = auth_client.delete(f"/api/visit-items/{iid}/")
        assert r.status_code == 204

    def test_delete_soft_deletes(self, auth_client, user):
        item = baker.make("places.VisitItem", visit__place__user=user)
        auth_client.delete(f"/api/visit-items/{item.public_id}/")
        item.refresh_from_db()
        assert item.deleted_at is not None

    def test_delete_other_user_item_returns_404(self, auth_client, other_user):
        item = baker.make("places.VisitItem", visit__place__user=other_user)
        r = auth_client.delete(f"/api/visit-items/{item.public_id}/")
        assert r.status_code == 404

    def test_update_other_user_item_returns_404(self, auth_client, other_user):
        item = baker.make("places.VisitItem", visit__place__user=other_user)
        r = auth_client.patch(
            f"/api/visit-items/{item.public_id}/",
            {"name": "Hack"},
            format="json",
        )
        assert r.status_code == 404
