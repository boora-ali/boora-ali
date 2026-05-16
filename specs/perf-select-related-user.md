# Perf #8 — `select_related("user")` desnecessário na listagem de lugares

> ✅ **IMPLEMENTADO**

## Problema

`PlaceViewSet.get_queryset()` (linha 63 de `views.py`) faz `JOIN` com a tabela `auth_user`
em toda listagem, incluindo `User.password` (hash PBKDF2), `last_login`, `date_joined`, etc.
Como todos os places já são filtrados por `request.user`, o objeto `user` é sempre o
mesmo usuário autenticado — o JOIN não adiciona informação nova.

**Arquivo problemático:** `backend/places/views.py:63`

```python
queryset = Place.objects.for_user(self.request.user).select_related("user")
```

Mesmo padrão na lixeira (`views.py:97`) e em `VisitViewSet` (`views.py:137`).

---

## Objetivo

Remover `select_related("user")` onde o serializer não expõe campos do modelo `User`.
Onde user é necessário (ex: admin ou serializer que expõe `user.email`), trocar por
`select_related("user").only("user__id", "user__username")` para carregar só os campos usados.

---

## Skills a invocar antes de implementar

- `/django-expert` — `select_related`, `.only()`, análise de queries, django-debug-toolbar
- `/bora-ali-backend` — convenções do projeto (PlaceViewSet, VisitViewSet, managers)

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/views.py` | Remover ou restringir `select_related("user")` nas querysets |

---

## Implementação passo a passo

### 1. Verificar quais campos de `user` o serializer expõe

```bash
cd backend
grep -n "user" places/serializers.py | head -30
```

Se o serializer expõe apenas `public_id` do place (sem campos de `user`), remover o `select_related`.
Se expõe `user.username` ou similar, trocar por `.only()`.

### 2. PlaceViewSet — listagem principal (linha 63)

```python
# backend/places/views.py

def get_queryset(self):
    # ANTES:
    # queryset = Place.objects.for_user(self.request.user).select_related("user")

    # DEPOIS (se serializer não expõe campos de user):
    queryset = Place.objects.for_user(self.request.user)

    # DEPOIS (se serializer expõe user.username ou similar):
    # queryset = Place.objects.for_user(self.request.user).select_related("user").only(
    #     *[f.name for f in Place._meta.fields],
    #     "user__id", "user__username",
    # )
```

### 3. Lixeira — `trash()` (linha 97)

```python
# backend/places/views.py — def trash(self, ...)
# ANTES:
# .select_related("user")

# DEPOIS:
# remover .select_related("user") ou aplicar .only() conforme passo 2
```

### 4. VisitViewSet — `select_related("place")` (linha 137)

`select_related("place")` em `VisitViewSet` é **necessário** — o serializer de visita
expõe campos do place. Não remover. Verificar se `place__user` também é carregado
desnecessariamente via `select_related("place__user")`.

```bash
cd backend
grep -n "select_related" places/managers.py
```

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste extra — confirmar que o número de queries não aumentou (sem N+1 regressão):
```bash
cd backend
python manage.py shell -c "
from django.test.utils import override_settings
from django.db import connection, reset_queries
from django.test import RequestFactory
from rest_framework.test import APIRequestFactory
print('Verificar com django-debug-toolbar ou connection.queries em teste')
"
```

Os testes existentes que cobrem a listagem de places devem continuar passando.
