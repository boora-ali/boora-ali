from __future__ import annotations

from collections.abc import Iterable

from django.db import models
from django.db.models import Avg, Count, Prefetch, Q, Sum


def parse_expands(raw_value: str | Iterable[str] | None) -> set[str]:
    if raw_value is None:
        return set()

    if isinstance(raw_value, str):
        return {item.strip() for item in raw_value.split(",") if item.strip()}

    return {str(item).strip() for item in raw_value if str(item).strip()}


class PlaceQuerySet(models.QuerySet):
    def live(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)

    def for_user(self, user):
        return self.filter(user=user).live()

    def with_avg_rating(self):
        return self.annotate(avg_rating=Avg("visits__overall_rating"))

    def with_consumable_stats(self):
        live_consumables = Q(
            visits__deleted_at__isnull=True,
            visits__items__deleted_at__isnull=True,
        )
        return self.annotate(
            consumables_count=Count(
                "visits__items", filter=live_consumables, distinct=True
            ),
            average_consumable_rating=Avg(
                "visits__items__rating", filter=live_consumables
            ),
            total_consumed_amount=Sum("visits__items__price", filter=live_consumables),
        )

    def with_list_expansion(self, expands: str | Iterable[str] | None = None):
        expand_set = parse_expands(expands)

        if "visits.items" in expand_set:
            from .models import Visit, VisitItem

            visit_items_queryset = VisitItem.objects.live().order_by("-created_at")
            visits_queryset = (
                Visit.objects.live()
                .order_by("-visited_at")
                .prefetch_related(Prefetch("items", queryset=visit_items_queryset))
            )
            return self.prefetch_related(Prefetch("visits", queryset=visits_queryset))

        if "visits" in expand_set:
            from .models import Visit

            visits_queryset = Visit.objects.live().order_by("-visited_at")
            return self.prefetch_related(Prefetch("visits", queryset=visits_queryset))

        return self

    def with_detail_payload(self, expands: str | Iterable[str] | None = None):
        expand_set = parse_expands(expands)
        from .models import Visit, VisitItem

        visits_queryset = Visit.objects.live().order_by("-visited_at")

        if "visits.items" in expand_set:
            visit_items_queryset = VisitItem.objects.live().order_by("-created_at")
            visits_queryset = visits_queryset.prefetch_related(
                Prefetch("items", queryset=visit_items_queryset)
            )

        return self.prefetch_related(Prefetch("visits", queryset=visits_queryset))

    def as_values(self):
        return self.values(
            "id",
            "name",
            "category",
            "address",
            "instagram_url",
            "maps_url",
            "status",
            "notes",
            "cover_photo",
            "created_at",
            "updated_at",
        )


class VisitQuerySet(models.QuerySet):
    def live(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)

    def for_user(self, user):
        return self.filter(place__user=user, place__deleted_at__isnull=True).live()

    def with_expansion(self, expands: str | Iterable[str] | None = None):
        expand_set = parse_expands(expands)

        queryset = self.select_related("place")

        if "items" in expand_set:
            from .models import VisitItem

            item_queryset = VisitItem.objects.live().order_by("-created_at")
            queryset = queryset.prefetch_related(
                Prefetch("items", queryset=item_queryset)
            )

        return queryset

    def with_detail_payload(self, expands: str | Iterable[str] | None = None):
        expand_set = parse_expands(expands)
        queryset = self.with_expansion(expands)

        if "items" not in expand_set:
            from .models import VisitItem

            item_queryset = VisitItem.objects.live().order_by("-created_at")
            queryset = queryset.prefetch_related(
                Prefetch("items", queryset=item_queryset)
            )

        return queryset

    def as_values(self):
        return self.values(
            "id",
            "place_id",
            "visited_at",
            "environment_rating",
            "service_rating",
            "overall_rating",
            "would_return",
            "general_notes",
            "photo",
            "photo_path",
            "created_at",
            "updated_at",
        )


class VisitItemQuerySet(models.QuerySet):
    def live(self):
        return self.filter(deleted_at__isnull=True)

    def deleted(self):
        return self.filter(deleted_at__isnull=False)

    def for_user(self, user):
        return self.filter(
            visit__place__user=user,
            visit__place__deleted_at__isnull=True,
            visit__deleted_at__isnull=True,
        ).live()

    def with_expansion(self, expands: str | Iterable[str] | None = None):
        expand_set = parse_expands(expands)

        if "visit.place" in expand_set:
            return self.select_related("visit", "visit__place")

        return self.select_related("visit", "visit__place")

    def as_values(self):
        return self.values(
            "id",
            "visit_id",
            "name",
            "type",
            "rating",
            "price",
            "would_order_again",
            "notes",
            "photo",
            "photo_path",
            "created_at",
            "updated_at",
        )
