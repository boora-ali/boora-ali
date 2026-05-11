import pytest
from django.conf import settings
from django.contrib.auth.models import Group, User
from django.contrib.contenttypes.models import ContentType
from django.contrib.sessions.models import Session
from django.urls import reverse
from django.utils import timezone
from django_celery_beat.models import (
    ClockedSchedule,
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
    PeriodicTasks,
    SolarSchedule,
)
from rest_framework_simplejwt.token_blacklist.models import (
    BlacklistedToken,
    OutstandingToken,
)
from simple_history.admin import SimpleHistoryAdmin
from unfold.admin import ModelAdmin, TabularInline
from unfold.sites import UnfoldAdminSite

from accounts.models import GoogleIdentity, UserProfile, UserSession
from config.admin_site import site as admin_site
from places.admin import VisitItemInline
from places.models import Place, Visit, VisitItem

HISTORY_MODELS = [
    User,
    Group,
    UserProfile,
    UserSession,
    GoogleIdentity,
    Place,
    Visit,
    VisitItem,
]

OPERATIONAL_MODELS = [
    OutstandingToken,
    BlacklistedToken,
    PeriodicTask,
    CrontabSchedule,
    IntervalSchedule,
    SolarSchedule,
    ClockedSchedule,
    PeriodicTasks,
]

SYSTEM_MODELS = [
    Session,
    ContentType,
]

ADMIN_MODELS = [*HISTORY_MODELS, *OPERATIONAL_MODELS, *SYSTEM_MODELS]


def test_unfold_is_loaded_before_django_admin():
    assert settings.INSTALLED_APPS.index("unfold") < settings.INSTALLED_APPS.index(
        "django.contrib.admin"
    )


def test_custom_admin_site_uses_unfold_site():
    assert isinstance(admin_site, UnfoldAdminSite)


@pytest.mark.parametrize(
    "model",
    ADMIN_MODELS,
)
def test_registered_admins_use_unfold_model_admin(model):
    assert isinstance(admin_site._registry[model], ModelAdmin)


@pytest.mark.parametrize("model", HISTORY_MODELS)
def test_registered_admins_use_simple_history_admin(model):
    assert isinstance(admin_site._registry[model], SimpleHistoryAdmin)


@pytest.mark.parametrize("model", HISTORY_MODELS)
def test_models_have_history_manager(model):
    assert hasattr(model, "history")


@pytest.mark.parametrize(
    "model",
    ADMIN_MODELS,
)
def test_registered_admins_paginate_by_ten(model):
    assert admin_site._registry[model].list_per_page == 10


def test_visit_items_inline_uses_unfold_inline():
    assert issubclass(VisitItemInline, TabularInline)


@pytest.mark.django_db
def test_admin_dashboard_renders_with_unfold(client):
    user = User.objects.create_superuser(
        username="admin",
        email="admin@example.com",
        password="secret",
    )
    client.force_login(user)

    response = client.get(reverse("boraali_admin:index"))

    assert response.status_code == 200
    assert "Lugares recentes" in response.content.decode()


@pytest.mark.django_db
@pytest.mark.parametrize(
    ("route_name", "factory"),
    [
        ("boraali_admin:auth_user_history", lambda user: user),
        (
            "boraali_admin:accounts_userprofile_history",
            lambda user: UserProfile.objects.create(user=user),
        ),
        (
            "boraali_admin:places_place_history",
            lambda user: Place.objects.create(
                user=user, name="Cafe Historico", category="Cafe"
            ),
        ),
        (
            "boraali_admin:places_visit_history",
            lambda user: Visit.objects.create(
                place=Place.objects.create(
                    user=user, name="Restaurante Historico", category="Restaurante"
                ),
                visited_at=timezone.now(),
            ),
        ),
        (
            "boraali_admin:places_visititem_history",
            lambda user: VisitItem.objects.create(
                visit=Visit.objects.create(
                    place=Place.objects.create(
                        user=user, name="Padaria Historica", category="Padaria"
                    ),
                    visited_at=timezone.now(),
                ),
                name="Cafe",
            ),
        ),
    ],
)
def test_admin_history_views_render_with_unfold(client, route_name, factory):
    username = route_name.rsplit(":", maxsplit=1)[-1]
    user = User.objects.create_superuser(
        username=username,
        email=f"{username}@example.com",
        password="secret",
    )
    instance = factory(user)
    client.force_login(user)

    response = client.get(reverse(route_name, args=[instance.pk]))

    assert response.status_code == 200


@pytest.mark.django_db
def test_user_session_rotation_creates_history_entry(user):
    session = UserSession.objects.create(user=user)
    initial_history_count = session.history.count()

    session.rotate()

    assert session.history.count() == initial_history_count + 1


@pytest.mark.django_db
def test_place_admin_changelist_and_change_view_render(client):
    user = User.objects.create_superuser(
        username="place-admin",
        email="place-admin@example.com",
        password="secret",
    )
    place = Place.objects.create(user=user, name="Cafe Norte", category="Cafe")
    client.force_login(user)

    changelist_response = client.get(reverse("boraali_admin:places_place_changelist"))
    change_response = client.get(
        reverse("boraali_admin:places_place_change", args=[place.pk])
    )

    assert changelist_response.status_code == 200
    assert change_response.status_code == 200


@pytest.mark.django_db
def test_visit_admin_changelist_renders(client):
    user = User.objects.create_superuser(
        username="visit-admin",
        email="visit-admin@example.com",
        password="secret",
    )
    place = Place.objects.create(user=user, name="Cafe Centro", category="Cafe")
    Visit.objects.create(place=place, visited_at=timezone.now())
    client.force_login(user)

    response = client.get(reverse("boraali_admin:places_visit_changelist"))

    assert response.status_code == 200


@pytest.mark.django_db
@pytest.mark.parametrize(
    "route_name",
    [
        "boraali_admin:token_blacklist_outstandingtoken_changelist",
        "boraali_admin:token_blacklist_blacklistedtoken_changelist",
        "boraali_admin:django_celery_beat_periodictask_changelist",
        "boraali_admin:django_celery_beat_crontabschedule_changelist",
        "boraali_admin:django_celery_beat_intervalschedule_changelist",
        "boraali_admin:django_celery_beat_solarschedule_changelist",
        "boraali_admin:django_celery_beat_clockedschedule_changelist",
        "boraali_admin:django_celery_beat_periodictasks_changelist",
        "boraali_admin:auth_group_changelist",
        "boraali_admin:accounts_usersession_changelist",
        "boraali_admin:sessions_session_changelist",
        "boraali_admin:contenttypes_contenttype_changelist",
    ],
)
def test_operational_admin_changelists_render(client, route_name):
    user = User.objects.create_superuser(
        username=route_name.rsplit(":", maxsplit=1)[-1],
        email=f"{route_name.rsplit(':', maxsplit=1)[-1]}@example.com",
        password="secret",
    )
    client.force_login(user)

    response = client.get(reverse(route_name))

    assert response.status_code == 200
