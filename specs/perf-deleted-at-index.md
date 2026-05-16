# Perf #6 — Índice `(user, deleted_at)` ausente nos modelos principais

> ✅ **IMPLEMENTADO**

## Problema

Toda query de registros ativos faz `WHERE user_id = X AND deleted_at IS NULL`.
Os índices existentes cobrem `(user, status)` e `(user, category)` — nenhum cobre `deleted_at`.
Com crescimento da tabela, o PostgreSQL faz scan completo do sub-conjunto do usuário
para filtrar soft-deletes.

**Modelos afetados** (`backend/places/models.py`):

| Modelo | Índice atual | Query frequente não coberta |
|--------|-------------|----------------------------|
| `Place` | `(user, status)`, `(user, category)` | `WHERE user_id=X AND deleted_at IS NULL` |
| `Visit` | `(place, visited_at)`, `(place, deleted_at)` | `WHERE place_id=X AND deleted_at IS NULL` |
| `VisitItem` | `(visit, type)`, `(visit, rating)` | `WHERE visit_id=X AND deleted_at IS NULL` |

**Sintoma**: listagem de lugares/visitas lenta para usuários com histórico extenso de soft-deletes.

---

## Objetivo

Adicionar índice composto `(user, deleted_at)` em `Place` e `(place, deleted_at)` já existe em
`Visit` — verificar; adicionar `(visit, deleted_at)` em `VisitItem`.
Resultado: queries de listagem ativa passam a usar index scan em vez de seq scan.

---

## Skills a invocar antes de implementar

- `/django-expert` — índices compostos Django, `Meta.indexes`, migrations de `AddIndex`
- `/bora-ali-backend` — convenções do projeto (Place, Visit, VisitItem, migrations de places)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/models.py` | Adicionar índices em `Place.Meta.indexes` e `VisitItem.Meta.indexes` |

> **Migrations**: após editar o models.py, rodar `python manage.py makemigrations places` manualmente.
> Não criar migrations automaticamente — invariante do repo.

---

## Implementação passo a passo

### 1. Verificar estado atual dos índices em Visit

```bash
cd backend
python manage.py shell -c "
from places.models import Visit
print([idx.fields for idx in Visit._meta.indexes])
"
```

### 2. Place — adicionar `(user, deleted_at)`

```python
# backend/places/models.py — class Place.Meta.indexes
indexes = [
    models.Index(fields=["user", "status"], name="place_user_status_idx"),
    models.Index(fields=["user", "category"], name="place_user_category_idx"),
    models.Index(fields=["user", "deleted_at"], name="place_user_deleted_at_idx"),  # NOVO
]
```

### 3. VisitItem — adicionar `(visit, deleted_at)`

```python
# backend/places/models.py — class VisitItem.Meta.indexes
indexes = [
    models.Index(fields=["visit", "type"], name="visititem_visit_type_idx"),
    models.Index(fields=["visit", "rating"], name="visititem_visit_rating_idx"),
    models.Index(fields=["visit", "deleted_at"], name="visititem_visit_deleted_at_idx"),  # NOVO
]
```

### 4. Gerar migration

```bash
cd backend
python manage.py makemigrations places --name "add_deleted_at_indexes"
```

Revisar o arquivo gerado antes de aplicar — deve conter apenas `AddIndex`.

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Verificação extra — confirmar índices no banco:
```bash
cd backend
python manage.py dbshell << 'EOF'
\d places_place
\d places_visititem
EOF
```

Buscar as linhas com `place_user_deleted_at_idx` e `visititem_visit_deleted_at_idx`.
