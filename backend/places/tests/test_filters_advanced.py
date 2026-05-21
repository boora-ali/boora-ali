from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone
from model_bakery import baker
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def _client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _place(user, **kwargs):
    return baker.make("places.Place", user=user, deleted_at=None, **kwargs)


def _visit(place, overall_rating=None, days_ago=10):
    from django.utils import timezone as tz

    return baker.make(
        "places.Visit",
        place=place,
        deleted_at=None,
        overall_rating=overall_rating,
        visited_at=tz.now() - timedelta(days=days_ago),
    )


class TestPlaceFilterAdvanced:
    def test_filter_status(self, user):
        _place(user, status="visited")
        _place(user, status="favorite")
        response = _client(user).get("/api/places/?status=visited")
        assert response.status_code == 200
        assert all(p["status"] == "visited" for p in response.data["results"])

    def test_filter_min_rating(self, user):
        low = _place(user)
        high = _place(user)
        _visit(low, overall_rating=2)
        _visit(high, overall_rating=5)

        response = _client(user).get("/api/places/?min_rating=4")
        assert response.status_code == 200
        ids = [p["public_id"] for p in response.data["results"]]
        assert str(high.public_id) in ids
        assert str(low.public_id) not in ids

    def test_filter_max_rating(self, user):
        low = _place(user)
        high = _place(user)
        _visit(low, overall_rating=2)
        _visit(high, overall_rating=5)

        response = _client(user).get("/api/places/?max_rating=3")
        assert response.status_code == 200
        ids = [p["public_id"] for p in response.data["results"]]
        assert str(low.public_id) in ids
        assert str(high.public_id) not in ids

    def test_filter_min_and_max_rating(self, user):
        p2 = _place(user)
        p4 = _place(user)
        p5 = _place(user)
        _visit(p2, overall_rating=2)
        _visit(p4, overall_rating=4)
        _visit(p5, overall_rating=5)

        response = _client(user).get("/api/places/?min_rating=3&max_rating=4")
        assert response.status_code == 200
        ids = [p["public_id"] for p in response.data["results"]]
        assert str(p4.public_id) in ids
        assert str(p2.public_id) not in ids
        assert str(p5.public_id) not in ids

    def test_filter_date_from(self, user):
        recent = _place(user)
        old = _place(user)
        _visit(recent, days_ago=5)
        _visit(old, days_ago=60)

        cutoff = (timezone.now() - timedelta(days=10)).date().isoformat()
        response = _client(user).get(f"/api/places/?date_from={cutoff}")
        assert response.status_code == 200
        ids = [p["public_id"] for p in response.data["results"]]
        assert str(recent.public_id) in ids
        assert str(old.public_id) not in ids

    def test_filter_date_to(self, user):
        recent = _place(user)
        old = _place(user)
        _visit(recent, days_ago=5)
        _visit(old, days_ago=60)

        cutoff = (timezone.now() - timedelta(days=20)).date().isoformat()
        response = _client(user).get(f"/api/places/?date_to={cutoff}")
        assert response.status_code == 200
        ids = [p["public_id"] for p in response.data["results"]]
        assert str(old.public_id) in ids
        assert str(recent.public_id) not in ids

    def test_avg_rating_in_list_response(self, user):
        p = _place(user)
        _visit(p, overall_rating=4)

        response = _client(user).get("/api/places/")
        assert response.status_code == 200
        first = next(
            (r for r in response.data["results"] if r["public_id"] == str(p.public_id)),
            None,
        )
        assert first is not None
        assert "avg_rating" in first

    def test_avg_rating_null_no_visits(self, user):
        _place(user)
        response = _client(user).get("/api/places/")
        assert response.status_code == 200
        assert response.data["results"][0]["avg_rating"] is None

    def test_no_cross_user_leak(self, user, other_user):
        _place(user)
        _place(other_user)
        response = _client(user).get("/api/places/")
        assert all(True for _ in response.data["results"])
        # other_user's place must not appear
        response_other = _client(other_user).get("/api/places/")
        user_ids = {p["public_id"] for p in response.data["results"]}
        other_ids = {p["public_id"] for p in response_other.data["results"]}
        assert user_ids.isdisjoint(other_ids)
