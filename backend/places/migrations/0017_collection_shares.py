import secrets

from django.conf import settings
from django.db import migrations, models
from django.db.models import deletion


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0017_schedule_history_cleanup"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CollectionShare",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("token", models.CharField(default=secrets.token_urlsafe, max_length=64, unique=True)),
                ("snapshot_name", models.CharField(max_length=100)),
                ("snapshot_emoji", models.CharField(blank=True, default="📍", max_length=8)),
                ("snapshot_description", models.TextField(blank=True, default="")),
                ("is_active", models.BooleanField(db_index=True, default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "owner",
                    models.ForeignKey(
                        on_delete=deletion.CASCADE,
                        related_name="collection_shares",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "source_collection",
                    models.ForeignKey(
                        on_delete=deletion.CASCADE,
                        related_name="shares",
                        to="places.collection",
                    ),
                ),
            ],
            options={
                "db_table": "places_collection_share",
                "indexes": [
                    models.Index(
                        fields=["token", "is_active"],
                        name="colshare_token_active_idx",
                    ),
                ],
            },
        ),
        migrations.CreateModel(
            name="CollectionSharePlaceSnapshot",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("source_place_public_id", models.UUIDField(db_index=True)),
                ("name", models.CharField(max_length=200)),
                ("category", models.CharField(max_length=100)),
                ("address", models.CharField(blank=True, default="", max_length=300)),
                ("instagram_url", models.URLField(blank=True, default="")),
                ("maps_url", models.URLField(blank=True, default="")),
                (
                    "coords_status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("resolved", "Resolved"),
                            ("failed", "Failed"),
                        ],
                        default="resolved",
                        max_length=10,
                    ),
                ),
                (
                    "latitude",
                    models.DecimalField(
                        blank=True,
                        decimal_places=7,
                        max_digits=10,
                        null=True,
                    ),
                ),
                (
                    "longitude",
                    models.DecimalField(
                        blank=True,
                        decimal_places=7,
                        max_digits=10,
                        null=True,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("want_to_visit", "Want to visit"),
                            ("visited", "Visited"),
                            ("favorite", "Favorite"),
                            ("would_not_return", "Would not return"),
                        ],
                        max_length=32,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                (
                    "source_cover_photo_path",
                    models.CharField(blank=True, default="", max_length=500),
                ),
                ("cover_photo_path", models.CharField(blank=True, default="", max_length=500)),
                ("order_index", models.PositiveIntegerField(db_index=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "share",
                    models.ForeignKey(
                        on_delete=deletion.CASCADE,
                        related_name="place_snapshots",
                        to="places.collectionshare",
                    ),
                ),
            ],
            options={
                "db_table": "places_collection_share_place_snapshot",
                "ordering": ["order_index", "created_at"],
                "indexes": [
                    models.Index(
                        fields=["share", "order_index"],
                        name="colshare_snapshot_order_idx",
                    ),
                ],
            },
        ),
    ]
