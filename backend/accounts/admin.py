from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin, UserAdmin
from django.contrib.auth.models import Group, User

from config.admin_site import site as admin_site

from .models import GoogleIdentity


@admin.register(GoogleIdentity, site=admin_site)
class GoogleIdentityAdmin(admin.ModelAdmin):
    list_display = ("user", "google_sub", "email", "email_verified", "updated_at")
    search_fields = ("user__username", "user__email", "google_sub", "email")
    list_select_related = ("user",)


admin_site.register(User, UserAdmin)
admin_site.register(Group, GroupAdmin)
