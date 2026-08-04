import django_filters

from .models import Category, Place, Visit, VisitItem


class CategoryFilter(django_filters.FilterSet):
    name = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Category
        fields = ("name",)


class PlaceFilter(django_filters.FilterSet):
    has_coords = django_filters.BooleanFilter(method="filter_has_coords")
    min_rating = django_filters.NumberFilter(method="filter_min_rating")
    max_rating = django_filters.NumberFilter(method="filter_max_rating")
    date_from = django_filters.DateFilter(method="filter_date_from")
    date_to = django_filters.DateFilter(method="filter_date_to")
    category = django_filters.UUIDFilter(
        field_name="categories__public_id", label="category"
    )

    def filter_has_coords(self, queryset, name, value):
        if value:
            return queryset.filter(latitude__isnull=False, longitude__isnull=False)
        return queryset.filter(latitude__isnull=True)

    def filter_min_rating(self, queryset, name, value):
        return queryset.with_avg_rating().filter(avg_rating__gte=value)

    def filter_max_rating(self, queryset, name, value):
        return queryset.with_avg_rating().filter(avg_rating__lte=value)

    def filter_date_from(self, queryset, name, value):
        return queryset.filter(visits__visited_at__date__gte=value).distinct()

    def filter_date_to(self, queryset, name, value):
        return queryset.filter(visits__visited_at__date__lte=value).distinct()

    class Meta:
        model = Place
        fields = {"status": ["exact"]}


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
