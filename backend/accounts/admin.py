from django.contrib import admin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import Group, User
from django.contrib.contenttypes.models import ContentType
from django.contrib.sessions.models import Session
from django_celery_beat.admin import (
    ClockedScheduleAdmin as BaseClockedScheduleAdmin,
)
from django_celery_beat.admin import (
    CrontabScheduleAdmin as BaseCrontabScheduleAdmin,
)
from django_celery_beat.admin import (
    IntervalScheduleAdmin as BaseIntervalScheduleAdmin,
)
from django_celery_beat.admin import (
    PeriodicTaskAdmin as BasePeriodicTaskAdmin,
)
from django_celery_beat.admin import (
    SolarScheduleAdmin as BaseSolarScheduleAdmin,
)
from django_celery_beat.models import (
    ClockedSchedule,
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
    PeriodicTasks,
    SolarSchedule,
)
from rest_framework_simplejwt.token_blacklist.admin import (
    BlacklistedTokenAdmin as BaseBlacklistedTokenAdmin,
)
from rest_framework_simplejwt.token_blacklist.admin import (
    OutstandingTokenAdmin as BaseOutstandingTokenAdmin,
)
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, StackedInline
from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm

from config.admin_site import site as admin_site

from .models import GoogleIdentity, UserProfile, UserSession

ADMIN_LIST_PER_PAGE = 10


class UserProfileInline(StackedInline):
    model = UserProfile
    can_delete = False
    extra = 0
    fields = (
        "nickname",
        "profile_photo",
        "terms_accepted_at",
        "terms_version",
    )


class UserSessionInline(StackedInline):
    model = UserSession
    can_delete = False
    extra = 0
    readonly_fields = ("session_key", "created_at")
    fields = ("session_key", "created_at")


@admin.register(User, site=admin_site)
class UserAdmin(SimpleHistoryAdmin, BaseUserAdmin, ModelAdmin):
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm
    inlines = (UserProfileInline, UserSessionInline)
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "is_staff",
        "is_active",
        "date_joined",
    )
    list_filter = ("is_staff", "is_superuser", "is_active", "groups")
    list_select_related = ("profile",)
    search_fields = ("username", "first_name", "last_name", "email")
    ordering = ("-date_joined",)
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True
    warn_unsaved_form = True

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(pk=request.user.pk)


@admin.register(Group, site=admin_site)
class GroupAdmin(SimpleHistoryAdmin, BaseGroupAdmin, ModelAdmin):
    search_fields = ("name",)
    list_per_page = ADMIN_LIST_PER_PAGE


@admin.register(ContentType, site=admin_site)
class ContentTypeAdmin(ModelAdmin):
    list_display = ("app_label", "model")
    list_filter = ("app_label",)
    search_fields = ("app_label", "model")
    readonly_fields = ("app_label", "model")
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Session, site=admin_site)
class SessionAdmin(ModelAdmin):
    list_display = ("session_key_short", "expire_date")
    list_filter = ("expire_date",)
    search_fields = ("session_key",)
    readonly_fields = ("session_key", "session_data", "expire_date")
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True

    @admin.display(description="Session key", ordering="session_key")
    def session_key_short(self, obj):
        return f"{obj.session_key[:12]}..."

    def has_add_permission(self, request):
        return False


@admin.register(GoogleIdentity, site=admin_site)
class GoogleIdentityAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = ("user", "email", "email_verified", "google_sub", "updated_at")
    list_filter = ("email_verified", "created_at", "updated_at")
    search_fields = ("user__username", "user__email", "google_sub", "email")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at", "updated_at")
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True
    warn_unsaved_form = True

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(user=request.user)


@admin.register(UserProfile, site=admin_site)
class UserProfileAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = ("user", "nickname", "terms_version", "terms_accepted_at")
    list_filter = ("terms_version", "terms_accepted_at")
    search_fields = ("user__username", "user__email", "nickname")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("terms_accepted_at",)
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True
    warn_unsaved_form = True

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(user=request.user)


@admin.register(UserSession, site=admin_site)
class UserSessionAdmin(SimpleHistoryAdmin, ModelAdmin):
    list_display = ("user", "session_key", "created_at")
    list_filter = ("created_at",)
    search_fields = ("user__username", "user__email", "session_key")
    list_select_related = ("user",)
    autocomplete_fields = ("user",)
    readonly_fields = ("session_key", "created_at")
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        if request.user.is_superuser:
            return queryset
        return queryset.filter(user=request.user)


@admin.register(OutstandingToken, site=admin_site)
class OutstandingTokenAdmin(BaseOutstandingTokenAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    list_filter = ("created_at", "expires_at")
    search_fields = ("user__username", "user__email", "jti")
    compressed_fields = True


@admin.register(BlacklistedToken, site=admin_site)
class BlacklistedTokenAdmin(BaseBlacklistedTokenAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    list_filter = ("blacklisted_at",)
    search_fields = ("token__user__username", "token__user__email", "token__jti")
    compressed_fields = True


@admin.register(PeriodicTask, site=admin_site)
class PeriodicTaskAdmin(BasePeriodicTaskAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True
    warn_unsaved_form = True


@admin.register(CrontabSchedule, site=admin_site)
class CrontabScheduleAdmin(BaseCrontabScheduleAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True


@admin.register(IntervalSchedule, site=admin_site)
class IntervalScheduleAdmin(BaseIntervalScheduleAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True


@admin.register(SolarSchedule, site=admin_site)
class SolarScheduleAdmin(BaseSolarScheduleAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True


@admin.register(ClockedSchedule, site=admin_site)
class ClockedScheduleAdmin(BaseClockedScheduleAdmin, ModelAdmin):
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True


@admin.register(PeriodicTasks, site=admin_site)
class PeriodicTasksAdmin(ModelAdmin):
    list_display = ("ident", "last_update")
    readonly_fields = ("ident", "last_update")
    list_per_page = ADMIN_LIST_PER_PAGE
    compressed_fields = True

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
