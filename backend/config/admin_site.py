from django.contrib.admin import AdminSite
from django.contrib.auth import get_user_model


class BoraAliAdminSite(AdminSite):
    site_header = "Bora Ali Admin"
    site_title = "Bora Ali"
    index_title = "Dashboard"

    def index(self, request, extra_context=None):
        from places.models import Place

        User = get_user_model()
        name_filter = request.GET.get("q", "").strip()

        places_qs = Place.objects.select_related("user").order_by("name")
        if name_filter:
            places_qs = places_qs.filter(name__icontains=name_filter)

        extra_context = extra_context or {}
        extra_context.update(
            {
                "user_count": User.objects.count(),
                "place_count": Place.objects.count(),
                "places": places_qs[:200],
                "name_filter": name_filter,
            }
        )
        return super().index(request, extra_context)


site = BoraAliAdminSite(name="boraali_admin")
