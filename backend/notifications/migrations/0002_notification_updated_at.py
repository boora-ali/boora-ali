import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="updated_at",
            field=models.DateTimeField(
                auto_now=True,
                verbose_name="updated at",
                db_column="updated_at",
            ),
        ),
    ]
