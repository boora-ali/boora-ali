from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q
from unfold.sites import UnfoldAdminSite


class BoraAliAdminSite(UnfoldAdminSite):
    site_header = "Boora Ali Admin"
    site_title = "Boora Ali"
    index_title = "Insights"

    def index(self, request, extra_context=None):
        from places.models import Place, Visit, VisitItem

        User = get_user_model()
        name_filter = request.GET.get("q", "").strip()

        places_qs = Place.objects.select_related("user").order_by("name")
        visits_qs = Visit.objects.select_related("place", "place__user")
        items_qs = VisitItem.objects.select_related("visit", "visit__place")

        if not request.user.is_superuser:
            places_qs = places_qs.filter(user=request.user)
            visits_qs = visits_qs.filter(place__user=request.user)
            items_qs = items_qs.filter(visit__place__user=request.user)

        if name_filter:
            places_qs = places_qs.filter(name__icontains=name_filter)

        place_stats = places_qs.aggregate(
            total=Count("id"),
            visited=Count("id", filter=Q(status="visited")),
            favorites=Count("id", filter=Q(status="favorite")),
            pending_coords=Count("id", filter=Q(coords_status="pending")),
        )
        visit_stats = visits_qs.aggregate(
            total=Count("id"),
            average_rating=Avg("overall_rating"),
            would_return=Count("id", filter=Q(would_return=True)),
        )
        item_stats = items_qs.aggregate(
            total=Count("id"),
            average_rating=Avg("rating"),
            would_order_again=Count("id", filter=Q(would_order_again=True)),
        )

        extra_context = extra_context or {}
        extra_context.update(
            {
                "user_count": User.objects.count()
                if request.user.is_superuser
                else User.objects.filter(pk=request.user.pk).count(),
                "place_stats": place_stats,
                "visit_stats": visit_stats,
                "item_stats": item_stats,
                "recent_places": places_qs[:12],
                "recent_visits": visits_qs.order_by("-visited_at")[:8],
                "top_items": items_qs.exclude(rating__isnull=True).order_by("-rating")[
                    :8
                ],
                "name_filter": name_filter,
            }
        )
        return super().index(request, extra_context)


site = BoraAliAdminSite(name="boraali_admin")
