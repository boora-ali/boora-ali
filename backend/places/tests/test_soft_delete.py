import pytest
from model_bakery import baker

from places.models import Place, Visit, VisitItem


@pytest.mark.django_db
class TestSoftDeleteQuerySet:
    def test_live_hides_deleted_places(self, user):
        live = baker.make("places.Place", user=user)
        baker.make("places.Place", user=user, deleted_at="2026-01-01T00:00:00Z")

        qs = Place.objects.for_user(user)
        assert qs.count() == 1
        assert qs.first().pk == live.pk

    def test_deleted_returns_only_deleted(self, user):
        baker.make("places.Place", user=user)
        deleted = baker.make(
            "places.Place", user=user, deleted_at="2026-01-01T00:00:00Z"
        )

        qs = Place.objects.filter(user=user).deleted()
        assert qs.count() == 1
        assert qs.first().pk == deleted.pk

    def test_live_hides_deleted_visits(self, user):
        place = baker.make("places.Place", user=user)
        live = baker.make("places.Visit", place=place)
        baker.make("places.Visit", place=place, deleted_at="2026-01-01T00:00:00Z")

        qs = Visit.objects.for_user(user)
        assert qs.count() == 1
        assert qs.first().pk == live.pk

    def test_live_hides_deleted_visit_items(self, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        live = baker.make("places.VisitItem", visit=visit)
        baker.make("places.VisitItem", visit=visit, deleted_at="2026-01-01T00:00:00Z")

        qs = VisitItem.objects.for_user(user)
        assert qs.count() == 1
        assert qs.first().pk == live.pk


@pytest.mark.django_db
class TestPlaceSoftDelete:
    def test_delete_soft_deletes_place(self, api_client, user):
        place = baker.make("places.Place", user=user)
        api_client.force_authenticate(user)

        response = api_client.delete(f"/api/places/{place.public_id}/")

        assert response.status_code == 204
        place.refresh_from_db()
        assert place.deleted_at is not None

    def test_delete_cascades_to_visits_and_items(self, api_client, user):
        place = baker.make("places.Place", user=user)
        visit = baker.make("places.Visit", place=place)
        item = baker.make("places.VisitItem", visit=visit)
        api_client.force_authenticate(user)

        api_client.delete(f"/api/places/{place.public_id}/")

        visit.refresh_from_db()
        item.refresh_from_db()
        assert visit.deleted_at is not None
        assert item.deleted_at is not None

    def test_deleted_place_hidden_from_list(self, api_client, user):
        baker.make("places.Place", user=user, deleted_at="2026-01-01T00:00:00Z")
        api_client.force_authenticate(user)

        response = api_client.get("/api/places/")

        assert response.status_code == 200
        assert len(response.data["results"]) == 0

    def test_delete_does_not_affect_other_user(self, api_client, user):
        other_user = baker.make("auth.User")
        other_place = baker.make("places.Place", user=other_user)
        my_place = baker.make("places.Place", user=user)
        api_client.force_authenticate(user)

        api_client.delete(f"/api/places/{my_place.public_id}/")

        other_place.refresh_from_db()
        assert other_place.deleted_at is None


@pytest.mark.django_db
class TestTrashAndRestore:
    def test_trash_returns_deleted_places(self, api_client, user):
        baker.make("places.Place", user=user)
        deleted = baker.make(
            "places.Place", user=user, deleted_at="2026-01-01T00:00:00Z"
        )
        api_client.force_authenticate(user)

        response = api_client.get("/api/places/trash/")

        assert response.status_code == 200
        ids = [r["public_id"] for r in response.data["results"]]
        assert str(deleted.public_id) in ids
        assert len(ids) == 1

    def test_trash_only_own_places(self, api_client, user):
        other_user = baker.make("auth.User")
        baker.make("places.Place", user=other_user, deleted_at="2026-01-01T00:00:00Z")
        api_client.force_authenticate(user)

        response = api_client.get("/api/places/trash/")

        assert response.status_code == 200
        assert len(response.data["results"]) == 0

    def test_restore_clears_deleted_at(self, api_client, user):
        place = baker.make("places.Place", user=user, deleted_at="2026-01-01T00:00:00Z")
        visit = baker.make(
            "places.Visit", place=place, deleted_at="2026-01-01T00:00:00Z"
        )
        item = baker.make(
            "places.VisitItem", visit=visit, deleted_at="2026-01-01T00:00:00Z"
        )
        api_client.force_authenticate(user)

        response = api_client.post(f"/api/places/{place.public_id}/restore/")

        assert response.status_code == 204
        place.refresh_from_db()
        visit.refresh_from_db()
        item.refresh_from_db()
        assert place.deleted_at is None
        assert visit.deleted_at is None
        assert item.deleted_at is None

    def test_restore_rejects_other_user(self, api_client, user):
        other_user = baker.make("auth.User")
        place = baker.make(
            "places.Place", user=other_user, deleted_at="2026-01-01T00:00:00Z"
        )
        api_client.force_authenticate(user)

        response = api_client.post(f"/api/places/{place.public_id}/restore/")

        assert response.status_code == 404

    def test_restore_rejects_live_place(self, api_client, user):
        place = baker.make("places.Place", user=user)
        api_client.force_authenticate(user)

        response = api_client.post(f"/api/places/{place.public_id}/restore/")

        assert response.status_code == 404
