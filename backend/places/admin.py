from django.contrib import admin
from django.utils.html import format_html

from config.admin_site import site as admin_site

from .models import Place, Visit, VisitItem


def image_preview(image_field):
    if image_field:
        return format_html(
            '<img src="{}" style="max-height:120px;border-radius:4px;">',
            image_field.url,
        )
    return "—"


@admin.register(Place, site=admin_site)
class PlaceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "status", "user", "cover_preview", "created_at")
    list_filter = ("status", "category")
    search_fields = ("name", "category", "address")
    readonly_fields = ("cover_preview", "created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("user", "name", "category", "address", "status", "notes")}),
        ("Links", {"fields": ("instagram_url", "maps_url"), "classes": ("collapse",)}),
        ("Cover photo", {"fields": ("cover_photo", "cover_preview")}),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    @admin.display(description="Cover")
    def cover_preview(self, obj):
        return image_preview(obj.cover_photo)


class VisitItemInline(admin.TabularInline):
    model = VisitItem
    extra = 0
    fields = ("name", "type", "rating", "price", "would_order_again", "notes", "photo")
    readonly_fields = ("photo_preview",)

    def get_fields(self, request, obj=None):
        return (
            "name",
            "type",
            "rating",
            "price",
            "would_order_again",
            "notes",
            "photo",
            "photo_preview",
        )

    @admin.display(description="Preview")
    def photo_preview(self, obj):
        return image_preview(obj.photo)


@admin.register(Visit, site=admin_site)
class VisitAdmin(admin.ModelAdmin):
    list_display = (
        "place",
        "visited_at",
        "overall_rating",
        "would_return",
        "photo_preview",
    )
    list_filter = ("would_return",)
    search_fields = ("place__name",)
    readonly_fields = ("photo_preview", "created_at", "updated_at")
    inlines = (VisitItemInline,)
    fieldsets = (
        (None, {"fields": ("place", "visited_at", "would_return", "general_notes")}),
        (
            "Ratings",
            {"fields": ("environment_rating", "service_rating", "overall_rating")},
        ),
        ("Photo", {"fields": ("photo", "photo_preview")}),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    @admin.display(description="Photo")
    def photo_preview(self, obj):
        return image_preview(obj.photo)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.photo and not obj.photo_path:
            obj.photo_path = obj.photo.name
            Visit.objects.filter(pk=obj.pk).update(photo_path=obj.photo_path)


@admin.register(VisitItem, site=admin_site)
class VisitItemAdmin(admin.ModelAdmin):
    list_display = ("name", "visit", "type", "rating", "price", "photo_preview")
    list_filter = ("type", "would_order_again")
    search_fields = ("name",)
    readonly_fields = ("photo_preview", "created_at", "updated_at")
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "visit",
                    "name",
                    "type",
                    "rating",
                    "price",
                    "would_order_again",
                    "notes",
                )
            },
        ),
        ("Photo", {"fields": ("photo", "photo_preview")}),
        (
            "Timestamps",
            {"fields": ("created_at", "updated_at"), "classes": ("collapse",)},
        ),
    )

    @admin.display(description="Photo")
    def photo_preview(self, obj):
        return image_preview(obj.photo)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if obj.photo and not obj.photo_path:
            obj.photo_path = obj.photo.name
            VisitItem.objects.filter(pk=obj.pk).update(photo_path=obj.photo_path)
