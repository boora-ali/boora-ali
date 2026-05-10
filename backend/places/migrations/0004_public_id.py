import uuid
from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    for model_name in ("Place", "Visit", "VisitItem"):
        Model = apps.get_model("places", model_name)
        for obj in Model.objects.filter(public_id__isnull=True):
            obj.public_id = uuid.uuid4()
            obj.save(update_fields=["public_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0003_place_lat_lng"),
    ]

    operations = [
        # Step 1: add the field as nullable, no default, no unique — existing rows get NULL
        migrations.AddField(
            model_name="place",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="visit",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.AddField(
            model_name="visititem",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        # Step 2: populate unique UUIDs for all existing rows (Python-side, guaranteed unique)
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        # Step 3: set the final field definition: unique, not-null, with uuid4 default for new rows
        migrations.AlterField(
            model_name="place",
            name="public_id",
            field=models.UUIDField(
                db_index=True, default=uuid.uuid4, editable=False, unique=True
            ),
        ),
        migrations.AlterField(
            model_name="visit",
            name="public_id",
            field=models.UUIDField(
                db_index=True, default=uuid.uuid4, editable=False, unique=True
            ),
        ),
        migrations.AlterField(
            model_name="visititem",
            name="public_id",
            field=models.UUIDField(
                db_index=True, default=uuid.uuid4, editable=False, unique=True
            ),
        ),
    ]
