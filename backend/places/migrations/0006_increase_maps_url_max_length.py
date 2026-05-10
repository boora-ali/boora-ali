from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0005_alter_place_created_at_alter_visit_created_at_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="place",
            name="maps_url",
            field=models.URLField(
                blank=True, max_length=2000, verbose_name="maps url", db_column="maps_url"
            ),
        ),
    ]
