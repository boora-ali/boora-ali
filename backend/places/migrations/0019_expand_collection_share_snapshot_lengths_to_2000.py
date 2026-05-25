from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0018_expand_collection_share_snapshot_lengths"),
    ]

    operations = [
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="name",
            field=models.CharField(max_length=2000),
        ),
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="category",
            field=models.CharField(max_length=2000),
        ),
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="address",
            field=models.CharField(blank=True, default="", max_length=2000),
        ),
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="instagram_url",
            field=models.URLField(blank=True, default="", max_length=2000),
        ),
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="maps_url",
            field=models.URLField(blank=True, default="", max_length=2000),
        ),
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="source_cover_photo_path",
            field=models.CharField(blank=True, default="", max_length=2000),
        ),
        migrations.AlterField(
            model_name="collectionshareplacesnapshot",
            name="cover_photo_path",
            field=models.CharField(blank=True, default="", max_length=2000),
        ),
    ]
