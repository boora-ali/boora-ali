# Testes Backend

## Setup

```bash
cd backend && source .venv/bin/activate
pytest                           # todos
pytest accounts/ -x --tb=short  # app específico, para no 1º erro
pytest -k "test_create or test_delete"  # filtro por nome
pytest --tb=short -q             # saída compacta
```

`pytest.ini` aponta para `config.test_settings`: SQLite in-memory, MD5 hasher, throttle via LocMemCache.

## Estrutura de teste padrão

```python
import pytest
from model_bakery import baker
from django.test import override_settings

@pytest.mark.django_db
class TestPlaceCRUD:
    def test_list_only_own_places(self, api_client, user):
        other_user = baker.make("accounts.User")
        baker.make("places.Place", user=other_user)
        my_place = baker.make("places.Place", user=user)

        api_client.force_authenticate(user)
        response = api_client.get("/api/places/")

        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        assert response.data["results"][0]["public_id"] == str(my_place.public_id)
```

## Fixtures comuns

```python
# conftest.py (já existe)
@pytest.fixture
def user(db):
    return baker.make("accounts.User")

@pytest.fixture
def api_client():
    from rest_framework.test import APIClient
    return APIClient()
```

## Throttle — obrigatório para endpoints de auth

```python
@pytest.mark.django_db
@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
def test_login_throttle(api_client):
    api_client.defaults["REMOTE_ADDR"] = "203.0.113.42"  # IP público não-isento
    # ... 10 requests → 11ª deve retornar 429
```

## Imagens em testes

```python
@pytest.mark.django_db
@override_settings(
    SECRET_KEY="test-key-32-chars-minimum-length!",
    STORAGES={"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}},
)
def test_image_upload(tmp_path, api_client, user):
    from django.core.files.uploadedfile import SimpleUploadedFile
    img = SimpleUploadedFile("photo.jpg", b"...", content_type="image/jpeg")
    # ...
```

## Migration regression tests

```python
@pytest.mark.django_db(transaction=True)
def test_migration_idempotent():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connection)
    executor.migrate([("app", "0004_previous")])

    # Simular estado problemático: coluna já existe
    with connection.cursor() as cursor:
        cursor.execute("ALTER TABLE my_table ADD COLUMN my_col VARCHAR(20) NOT NULL DEFAULT ''")

    # Aplicar migration — não deve lançar
    executor = MigrationExecutor(connection)
    executor.migrate([("app", "0005_target")])

    # Verificar resultado
    with connection.cursor() as cursor:
        cols = {i.name for i in connection.introspection.get_table_description(cursor, "my_table")}
    assert "my_col" in cols
```

## Cobertura atual

88%+. Manter acima disso. Rodar `pytest --cov=. --cov-report=term-missing` para ver lacunas.
