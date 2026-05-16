import django_filters

from .models import Place, Visit, VisitItem


class PlaceFilter(django_filters.FilterSet):
    has_coords = django_filters.BooleanFilter(method="filter_has_coords")

    def filter_has_coords(self, queryset, name, value):
        if value:
            return queryset.filter(latitude__isnull=False, longitude__isnull=False)
        return queryset.filter(latitude__isnull=True)

    class Meta:
        model = Place
        fields = {"status": ["exact"], "category": ["exact", "icontains"]}


class VisitFilter(django_filters.FilterSet):
    class Meta:
        model = Visit
        fields = {
            "visited_at": ["gte", "lte"],
            "would_return": ["exact"],
            "overall_rating": ["gte", "lte"],
        }


class VisitItemFilter(django_filters.FilterSet):
    class Meta:
        model = VisitItem
        fields = {
            "type": ["exact"],
            "rating": ["gte", "lte"],
            "would_order_again": ["exact"],
        }
