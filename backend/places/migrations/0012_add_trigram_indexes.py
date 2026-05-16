from django.contrib.postgres.indexes import GinIndex
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("places", "0011_enable_pg_trgm"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="place",
            index=GinIndex(
                fields=["name"],
                name="place_name_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ),
        migrations.AddIndex(
            model_name="place",
            index=GinIndex(
                fields=["category"],
                name="place_category_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ),
        migrations.AddIndex(
            model_name="place",
            index=GinIndex(
                fields=["address"],
                name="place_address_trgm_idx",
                opclasses=["gin_trgm_ops"],
            ),
        ),
    ]
