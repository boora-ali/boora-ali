# Models e Migrations

## Adicionar campo a model existente

```python
# 1. models.py
new_field = models.CharField(max_length=50, blank=True, default="")

# 2. makemigrations
python manage.py makemigrations accounts --name=add_new_field

# 3. Verificar migration gerada — nunca reformatar as antigas
```

## Migration idempotente (quando coluna pode já existir)

Usar `SeparateDatabaseAndState` + `RunPython` — nunca `AddField` direto para colunas que podem existir:

```python
def _add_columns(apps, schema_editor):
    conn = schema_editor.connection
    with conn.cursor() as cursor:
        if conn.vendor == "postgresql":
            cursor.execute("ALTER TABLE my_table ADD COLUMN IF NOT EXISTS col TYPE")
        else:
            existing = {i.name for i in conn.introspection.get_table_description(cursor, "my_table")}
            if "col" not in existing:
                cursor.execute("ALTER TABLE my_table ADD COLUMN col TYPE")

operations = [migrations.SeparateDatabaseAndState(
    database_operations=[migrations.RunPython(_add_columns, _remove_columns)],
    state_operations=[migrations.AddField(...)],
)]
```

## PublicIdModel

```python
from core.models import PublicIdModel

class Place(PublicIdModel):
    # Herda: public_id (UUID), created_at, updated_at
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=200)

    class Meta:
        ordering = ["-created_at"]
```

## Managers/QuerySets (places/managers.py)

```python
class PlaceQuerySet(models.QuerySet):
    def for_user(self, user):
        return self.filter(user=user).select_related("user__profile")

class Place(PublicIdModel):
    objects = PlaceQuerySet.as_manager()
```

## Signals — limpeza de imagens

```python
# places/signals.py
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction

@receiver(post_delete, sender=Place)
def cleanup_place_photo(sender, instance, **kwargs):
    def _delete():
        if instance.cover_photo:
            ImageService.delete(instance.cover_photo)
    transaction.on_commit(_delete)
```

## Teste de migration (regression)

```python
@pytest.mark.django_db(transaction=True)
def test_migration_idempotent():
    executor = MigrationExecutor(connection)
    executor.migrate([("app", "0004_previous")])
    # simular estado problemático
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE my_table ADD COLUMN col TYPE")
    executor = MigrationExecutor(connection)
    executor.migrate([("app", "0005_target")])
    # verificar resultado
```
