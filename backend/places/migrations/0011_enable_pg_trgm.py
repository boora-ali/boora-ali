from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("places", "0010_add_deleted_at_indexes"),
    ]

    operations = [
        TrigramExtension(),
    ]
