# Perf #7 — Busca textual via `ILIKE '%termo%'` sem índice

> ✅ **IMPLEMENTADO**

## Problema

`search_fields = ("name", "category", "address")` em `PlaceViewSet` (linha 36 de `views.py`)
usa `ILIKE '%termo%'` do DRF `SearchFilter`. Esse padrão **não pode usar B-tree indexes** —
PostgreSQL faz seq scan na tabela completa do usuário para cada busca.

Com 500+ lugares por usuário, toda digitação no campo de busca dispara um scan completo.

**Arquivo problemático:** `backend/places/views.py:36`

```python
search_fields = ("name", "category", "address")
```

---

## Objetivo

Ativar `pg_trgm` (extensão PostgreSQL) e criar índices `GIN` com `gin_trgm_ops` nos campos
de busca. O PostgreSQL passa a usar o índice para `ILIKE '%termo%'` — latência de busca
cai de O(N) para O(log N).

---

## Skills a invocar antes de implementar

- `/django-expert` — pg_trgm, índices GIN, migrations com `CreateExtension`, SearchFilter DRF
- `/bora-ali-backend` — convenções do projeto (PlaceViewSet, search_fields, migrations de places)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/config/settings.py` | Adicionar `django.contrib.postgres` em `INSTALLED_APPS` |
| `backend/places/models.py` | Adicionar `GinIndex` com `gin_trgm_ops` em `Place.Meta.indexes` |
| `backend/places/migrations/` | Migration para `CREATE EXTENSION pg_trgm` + índices GIN |

> **Migrations**: rodar `python manage.py makemigrations places` manualmente após editar models.py.
> A migration de extensão deve ser criada separadamente (ver passo 2).

---

## Implementação passo a passo

### 1. Adicionar `django.contrib.postgres` ao INSTALLED_APPS

```python
# backend/config/settings.py
INSTALLED_APPS = [
    # ... apps existentes ...
    "django.contrib.postgres",  # NOVO — necessário para GinIndex + TrigramSimilarity
    "accounts",
    "places",
]
```

### 2. Migration para ativar a extensão `pg_trgm`

Criar o arquivo manualmente (não gerado pelo makemigrations):

```python
# backend/places/migrations/XXXX_enable_pg_trgm.py
from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("places", "YYYY_migration_anterior"),
    ]

    operations = [
        TrigramExtension(),
    ]
```

Substituir `XXXX` e `YYYY` pelos números reais da sequência de migrations.

### 3. Adicionar índices GIN em `Place`

```python
# backend/places/models.py
from django.contrib.postgres.indexes import GinIndex

class Place(PublicIdModel, TimeStampedModel):
    # ... campos existentes ...

    class Meta:
        indexes = [
            models.Index(fields=["user", "status"], name="place_user_status_idx"),
            models.Index(fields=["user", "category"], name="place_user_category_idx"),
            models.Index(fields=["user", "deleted_at"], name="place_user_deleted_at_idx"),
            GinIndex(fields=["name"], name="place_name_trgm_idx", opclasses=["gin_trgm_ops"]),       # NOVO
            GinIndex(fields=["category"], name="place_category_trgm_idx", opclasses=["gin_trgm_ops"]),  # NOVO
            GinIndex(fields=["address"], name="place_address_trgm_idx", opclasses=["gin_trgm_ops"]),   # NOVO
        ]
```

### 4. Gerar migration dos índices GIN

```bash
cd backend
python manage.py makemigrations places --name "add_trigram_indexes"
```

A migration gerada deve conter `AddIndex` para cada `GinIndex`. Verificar antes de aplicar.

> **Nota**: `pg_trgm` deve estar ativo (migration do passo 2) antes de aplicar os índices GIN.
> Aplicar as migrations em ordem: extensão primeiro, depois índices.

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual — confirmar que o índice é usado:
```bash
cd backend
python manage.py dbshell << 'EOF'
EXPLAIN ANALYZE
SELECT id FROM places_place
WHERE user_id = 1 AND name ILIKE '%pizza%' AND deleted_at IS NULL;
EOF
```

Deve aparecer `Bitmap Index Scan on place_name_trgm_idx` em vez de `Seq Scan`.
