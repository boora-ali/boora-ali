from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, TabularInline
from unfold.contrib.filters.admin import (
    ChoicesDropdownFilter,
    RangeDateTimeFilter,
    RangeNumericFilter,
    RelatedDropdownFilter,
)

from config.admin_site import site as admin_site

from .models import CoordsStatus, Place, Visit, VisitItem
from .tasks import resolve_place_coords

ADMIN_LIST_PER_PAGE = 10


@admin.action(description="Retentar resolução de coordenadas (failed)")
def retry_failed_coords(modeladmin, request, queryset):
    failed = queryset.filter(coords_status=CoordsStatus.FAILED, maps_url__isnull=False)
    count = 0
    for place in failed:
        place.coords_status = CoordsStatus.PENDING
        place.save(update_fields=["coords_status"])
        resolve_place_coords.delay(place.pk)
        count += 1
    modeladmin.message_user(request, f"{count} lugar(es) enfileirado(s) para retry.")


def image_preview(image_field):
    if image_field:
        return format_html(
            '<img src="{}" style="max-height:120px;border-radius:4px;">',
            image_field.url,
        )
    return "-"


def persist_photo_path_with_history(request, obj):
    if obj.photo and not obj.photo_path:
        obj.photo_path = obj.photo.name
        obj._history_user = request.user
        obj.save(update_fields=["photo_path"])


@admin.register(Place, site=admin_site)
class PlaceAdmin(SimpleHistoryAdmin, ModelAdmin):
    actions = [retry_failed_coords]
    list_display = (
        "name",
        "category",
        "status",
        "coords_status",
        "user",
        "visit_count",
        "cover_preview",
        "created_at",
    )
    list_filter = (
        ("status", ChoicesDropdownFilter),
        ("coords_status", ChoicesDropdownFilter),
        "category",
        ("created_at", RangeDateTimeFilter),
    )
    list_filter_submit = True
    search_fields = ("name", "category", "address", "user__username", "user__email")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("public_id", "cover_preview", "created_at", "updated_at")
    list_per_page = ADMIN_LIST_PER_PAGE
    list_fullwidth = True
    compressed_fields = True
    warn_unsaved_form = True
    fieldsets = (
        (
            "Lugar",
            {
                "classes": ("tab",),
                "fields": ("user", "name", "category", "address", "status", "notes"),
            },
        ),
        (
            "Mapa",
            {
                "classes": ("tab",),
                "fields": ("maps_url", "coords_status", "latitude", "longitude"),
            },
        ),
        (
            "Links e foto",
            {
                "classes": ("tab",),
                "fields": ("instagram_url", "cover_photo", "cover_preview"),
            },
        ),
        (
            "Sistema",
            {
                "classes": ("tab",),
                "fields": ("public_id", "deleted_at", "created_at", "updated_at"),
            },
        ),
    )

    def get_queryset(self, request):
        queryset = (
            super()
            .get_queryset(request)
            .annotate(visits_count=Count("visits", distinct=True))
        )
        if request.user.is_superuser:
            return queryset
        return queryset.filter(user=request.user)

    @admin.display(description="Visits", ordering="visits_count")
    def visit_count(self, obj):
        return obj.visits_count

    @admin.display(description="Cover")
    def cover_preview(self, obj):
        return image_preview(obj.cover_photo)


class VisitItemInline(TabularInline):
    model = VisitItem
    extra = 0
    tab = True
    show_count = True
    fields = (
        "name",
        "type",
        "rating",
        "price",
        "would_order_again",
        "notes",
        "photo",
        "photo_preview",
    )
    readonly_fields = ("photo_preview",)

    @admin.display(description="Preview")
    def photo_preview(self, obj):
        return image_preview(obj.photo)


@admin.register(Visit, site=admin_site)
class VisitAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = (
        "place",
        "visited_at",
        "environment_rating",
        "service_rating",
        "overall_rating",
        "would_return",
        "item_count",
        "photo_preview",
    )
    list_filter = (
        ("place", RelatedDropdownFilter),
        "would_return",
        ("visited_at", RangeDateTimeFilter),
        ("overall_rating", RangeNumericFilter),
    )
    list_filter_submit = True
    search_fields = ("place__name", "place__category", "place__user__username")
    list_select_related = ("place", "place__user")
    autocomplete_fields = ("place",)
    readonly_fields = (
        "public_id",
        "photo_preview",
        "photo_path",
        "created_at",
        "updated_at",
    )
    inlines = (VisitItemInline,)
    list_per_page = ADMIN_LIST_PER_PAGE
    list_fullwidth = True
    compressed_fields = True
    warn_unsaved_form = True
    fieldsets = (
        (
            "Visita",
            {
                "classes": ("tab",),
                "fields": ("place", "visited_at", "would_return", "general_notes"),
            },
        ),
        (
            "Notas",
            {
                "classes": ("tab",),
                "fields": ("environment_rating", "service_rating", "overall_rating"),
            },
        ),
        ("Foto", {"classes": ("tab",), "fields": ("photo", "photo_preview")}),
        (
            "Sistema",
            {
                "classes": ("tab",),
                "fields": (
                    "public_id",
                    "photo_path",
                    "deleted_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def get_queryset(self, request):
        queryset = (
            super()
            .get_queryset(request)
            .annotate(items_count=Count("items", distinct=True))
        )
        if request.user.is_superuser:
            return queryset
        return queryset.filter(place__user=request.user)

    @admin.display(description="Items", ordering="items_count")
    def item_count(self, obj):
        return obj.items_count

    @admin.display(description="Photo")
    def photo_preview(self, obj):
        return image_preview(obj.photo)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        persist_photo_path_with_history(request, obj)


@admin.register(VisitItem, site=admin_site)
class VisitItemAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = (
        "name",
        "visit",
        "place_name",
        "type",
        "rating",
        "price",
        "would_order_again",
        "photo_preview",
    )
    list_filter = (
        ("type", ChoicesDropdownFilter),
        "would_order_again",
        ("rating", RangeNumericFilter),
        ("price", RangeNumericFilter),
    )
    list_filter_submit = True
    search_fields = ("name", "visit__place__name", "visit__place__category")
    list_select_related = ("visit", "visit__place", "visit__place__user")
    autocomplete_fields = ("visit",)
    readonly_fields = (
        "public_id",
        "photo_preview",
        "photo_path",
        "created_at",
        "updated_at",
    )
    list_per_page = ADMIN_LIST_PER_PAGE
    list_fullwidth = True
    compressed_fields = True
    warn_unsaved_form = True
    fieldsets = (
        (
            "Item",
            {
                "classes": ("tab",),
                "fields": (
                    "visit",
                    "name",
                    "type",
                    "rating",
                    "price",
                    "would_order_again",
                    "notes",
                ),
            },
        ),
        ("Foto", {"classes": ("tab",), "fields": ("photo", "photo_preview")}),
        (
            "Sistema",
            {
                "classes": ("tab",),
                "fields": (
                    "public_id",
                    "photo_path",
                    "deleted_at",
                    "created_at",
                    "updated_at",
                ),
            },
        ),
    )

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(visit__place__user=request.user)

    @admin.display(description="Place", ordering="visit__place__name")
    def place_name(self, obj):
        return obj.visit.place.name

    @admin.display(description="Photo")
    def photo_preview(self, obj):
        return image_preview(obj.photo)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        persist_photo_path_with_history(request, obj)
