from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0007_place_coords_status"),
    ]

    operations = [
        migrations.AddField(
            model_name="place",
            name="deleted_at",
            field=models.DateTimeField(
                blank=True, db_column="deleted_at", null=True, verbose_name="deleted at"
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="deleted_at",
            field=models.DateTimeField(
                blank=True, db_column="deleted_at", null=True, verbose_name="deleted at"
            ),
        ),
        migrations.AddField(
            model_name="visititem",
            name="deleted_at",
            field=models.DateTimeField(
                blank=True, db_column="deleted_at", null=True, verbose_name="deleted at"
            ),
        ),
    ]
