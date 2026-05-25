from django.contrib import admin
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin

from config.admin_site import site as admin_site

from .models import Notification


@admin.register(Notification, site=admin_site)
class NotificationAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = ("user", "type", "title", "read_at", "expires_at", "created_at")
    list_filter = ("type", "read_at", "expires_at", "created_at")
    search_fields = ("user__username", "user__email", "title", "body")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
    list_per_page = 10
    compressed_fields = True
    warn_unsaved_form = True
    fieldsets = (
        (
            "Notificação",
            {
                "classes": ("tab",),
                "fields": ("user", "type", "title", "body", "read_at", "expires_at"),
            },
        ),
        (
            "Sistema",
            {
                "classes": ("tab",),
                "fields": ("created_at", "updated_at"),
            },
        ),
    )
