# Feat — Coleções de Places

> ✅ **IMPLEMENTADO**

## Problema

Não há como agrupar places por critério temático. Um usuário que tem 200 lugares não consegue
separar "Restaurantes em SP", "Para ir com família", "Viagem Rio 2026" — tudo fica numa lista
única filtrada só por categoria.

---

## Objetivo

1. Usuário cria coleções com nome, emoji e descrição opcional
2. Adiciona/remove places de qualquer coleção
3. Place pode pertencer a múltiplas coleções
4. Coleções listadas na sidebar/home; ao abrir, exibe os places daquela coleção

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — tabela associativa, viewsets, nested routes
- `/bora-ali-backend` — PublicIdModel, MutationMixin, convenções de URL

Frontend:
- `/bora-ali-frontend` — serviços de API, hooks com useState/useEffect, roteamento
- `/frontend-design` — Card, Sheet, Button, Badge (shadcn/ui)

> **Dependências**: nenhuma. Feature autossuficiente.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/models.py` | Adicionar `Collection`, `CollectionPlace` |
| `backend/places/views.py` | `CollectionViewSet`, `CollectionPlaceView` |
| `backend/places/serializers.py` | `CollectionSerializer`, `CollectionDetailSerializer` |
| `backend/places/urls.py` | Registrar rotas de coleções |
| `backend/places/migrations/` | `makemigrations places` após criar modelos |
| `frontend/src/services/collections.service.ts` | CRUD de coleções + add/remove place (novo) |
| `frontend/src/routes/CollectionListPage.tsx` | Lista de coleções do usuário (nova) |
| `frontend/src/routes/CollectionDetailPage.tsx` | Places de uma coleção (nova) |
| `frontend/src/routes/PlaceDetailPage.tsx` | Botão "Adicionar a coleção" |
| `frontend/src/App.tsx` | Registrar rotas `/collections` e `/collections/:id` |

---

## Implementação passo a passo

### 1. `models.py` — `Collection` e `CollectionPlace`

Padrão de tabela associativa explícita: sem `ManyToManyField` no `Collection`.
Toda a manipulação da relação passa por `CollectionPlace` diretamente — evita ter dois
caminhos para a mesma operação e mantém controle total sobre campos extras (ex.: `added_at`).

```python
# backend/places/models.py
class Collection(PublicIdModel):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="collections"
    )
    name = models.CharField(max_length=100)
    emoji = models.CharField(max_length=8, blank=True, default="📍")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "places_collection"
        ordering = ["-updated_at"]


class CollectionPlace(models.Model):
    collection = models.ForeignKey(
        Collection, on_delete=models.CASCADE, related_name="collection_places"
    )
    place = models.ForeignKey(
        "Place", on_delete=models.CASCADE, related_name="collection_places"
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_collection_place"
        ordering = ["-added_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["collection", "place"], name="collection_place_unique"
            )
        ]
```

> `unique_together` é depreciado desde Django 4.2 — usar `UniqueConstraint`.
> Rodar `python manage.py makemigrations places` após criar os modelos.

### 2. `serializers.py`

`place_count` vem da anotação do queryset. Para o detail, places são acessados via
`collection_places` (reverse FK da tabela associativa) — sem depender do campo M2M.

```python
# backend/places/serializers.py
class CollectionSerializer(serializers.ModelSerializer):
    place_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Collection
        fields = ["public_id", "name", "emoji", "description", "place_count", "updated_at"]
        read_only_fields = ["public_id", "updated_at"]


class CollectionDetailSerializer(CollectionSerializer):
    places = serializers.SerializerMethodField()

    class Meta(CollectionSerializer.Meta):
        fields = CollectionSerializer.Meta.fields + ["places"]

    def get_places(self, obj):
        # collection_places é prefetched no get_queryset do viewset
        qs = [cp.place for cp in obj.collection_places.all()]
        return PlaceListSerializer(qs, many=True).data
```

### 3. `views.py` — `CollectionViewSet`

`Count("collection_places")` — via FK reverso da tabela associativa, não via campo M2M.
`select_related("user")` removido — a queryset já filtra `user=request.user`, não há necessidade
de join.

```python
# backend/places/views.py
from django.db.models import Count, Prefetch
from core.viewsets import ViewSetBase
from core.views import MutationMixin

class CollectionViewSet(ViewSetBase):
    lookup_field = "public_id"

    def get_queryset(self):
        qs = Collection.objects.filter(user=self.request.user)
        if self.action == "list":
            return qs.annotate(place_count=Count("collection_places"))
        return qs.prefetch_related(
            Prefetch(
                "collection_places",
                queryset=CollectionPlace.objects.select_related("place").order_by("-added_at"),
            )
        )

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CollectionDetailSerializer
        return CollectionSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CollectionPlaceView(MutationMixin, APIView):
    """POST /collections/{public_id}/places/{place_public_id}/ — adicionar
       DELETE /collections/{public_id}/places/{place_public_id}/ — remover"""
    permission_classes = [IsAuthenticated]

    def _get_collection_and_place(self, request, collection_public_id, place_public_id):
        collection = get_object_or_404(Collection, public_id=collection_public_id, user=request.user)
        place = get_object_or_404(Place, public_id=place_public_id, user=request.user)
        return collection, place

    def post(self, request, collection_public_id, place_public_id):
        collection, place = self._get_collection_and_place(
            request, collection_public_id, place_public_id
        )
        _, created = CollectionPlace.objects.get_or_create(collection=collection, place=place)
        return Response(status=201 if created else 200)

    def delete(self, request, collection_public_id, place_public_id):
        collection, place = self._get_collection_and_place(
            request, collection_public_id, place_public_id
        )
        CollectionPlace.objects.filter(collection=collection, place=place).delete()
        return Response(status=204)
```

> `ViewSetBase` (de `core.viewsets`) já inclui `IsAuthenticated`, `MutationMixin` e `DjangoFilterBackend` — não declarar novamente.

### 4. `urls.py` — registrar rotas

```python
# backend/places/urls.py
from rest_framework.routers import DefaultRouter
from .views import CollectionViewSet, CollectionPlaceView

router = DefaultRouter()
router.register("collections", CollectionViewSet, basename="collection")

# Além do router:
path(
    "collections/<collection_public_id>/places/<place_public_id>/",
    CollectionPlaceView.as_view(),
),
```

### 5. Frontend — `services/collections.service.ts`

`baseURL` do axios já inclui `/api` — caminhos sem prefixo `/api/`.

```typescript
// frontend/src/services/collections.service.ts
import { api } from "./api";
import type { Place } from "./places.service";

export interface Collection {
  public_id: string;
  name: string;
  emoji: string;
  description: string;
  place_count: number;
  updated_at: string;
}

export interface CollectionDetail extends Collection {
  places: Place[];
}

export const collectionsService = {
  list: () => api.get<Collection[]>("/collections/"),
  create: (data: Pick<Collection, "name" | "emoji" | "description">) =>
    api.post<Collection>("/collections/", data),
  get: (id: string) => api.get<CollectionDetail>(`/collections/${id}/`),
  update: (id: string, data: Partial<Pick<Collection, "name" | "emoji" | "description">>) =>
    api.patch<Collection>(`/collections/${id}/`, data),
  delete: (id: string) => api.delete(`/collections/${id}/`),
  addPlace: (collectionId: string, placeId: string) =>
    api.post(`/collections/${collectionId}/places/${placeId}/`),
  removePlace: (collectionId: string, placeId: string) =>
    api.delete(`/collections/${collectionId}/places/${placeId}/`),
};
```

### 6. Frontend — `CollectionListPage.tsx`

O projeto não usa `@tanstack/react-query`. Usar `useState` + `useEffect`.

```tsx
// frontend/src/routes/CollectionListPage.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { collectionsService, type Collection } from "../services/collections.service";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";

export function CollectionListPage() {
  const { t } = useTranslation();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    collectionsService.list().then(({ data }) => setCollections(data));
  }, []);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("collections.title")}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t("collections.new")}
        </Button>
      </div>
      {collections.map((c) => (
        <Link key={c.public_id} to={`/collections/${c.public_id}`}>
          <Card className="flex items-center gap-3 p-4">
            <span className="text-2xl">{c.emoji}</span>
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted-foreground">
                {c.place_count} {t("collections.places_count")}
              </p>
            </div>
          </Card>
        </Link>
      ))}
      {/* TODO: CreateCollectionModal open={createOpen} onClose={() => setCreateOpen(false)} */}
    </div>
  );
}
```

### 7. Botão "Adicionar a coleção" no PlaceDetail

`handleToggle` deve ser `async` e awaitar as chamadas para garantir feedback de erro ao usuário.

```tsx
function AddToCollectionSheet({ placePublicId }: { placePublicId: string }) {
  const { t } = useTranslation();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [placeCollectionIds, setPlaceCollectionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    collectionsService.list().then(({ data }) => setCollections(data));
    // place.collections preenchido pelo endpoint GET /places/:id/ (expandir se necessário)
  }, [placePublicId]);

  async function handleToggle(collectionId: string) {
    const isIn = placeCollectionIds.has(collectionId);
    try {
      if (isIn) {
        await collectionsService.removePlace(collectionId, placePublicId);
        setPlaceCollectionIds((prev) => {
          const next = new Set(prev);
          next.delete(collectionId);
          return next;
        });
      } else {
        await collectionsService.addPlace(collectionId, placePublicId);
        setPlaceCollectionIds((prev) => new Set(prev).add(collectionId));
      }
    } catch {
      // exibir toast de erro
    }
  }
  // ...
}
```

### 8. Traduções i18n (pt-BR)

```json
"collections.title": "Coleções",
"collections.new": "Nova coleção",
"collections.places_count": "lugar(es)",
"collections.add_to": "Adicionar a coleção",
"collections.empty": "Nenhuma coleção ainda"
```

---

## O que este feature não inclui (YAGNI)

- Coleções públicas/compartilháveis (extensão natural de `feat-place-sharing.md`)
- Ordenação manual de places dentro da coleção
- Cover photo da coleção (emoji é suficiente no MVP)
- Colaboração em coleções com outros usuários

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `POST /api/collections/` → cria coleção
2. `POST /api/collections/{id}/places/{place_id}/` → adiciona place, retorna 201
3. `POST /api/collections/{id}/places/{place_id}/` novamente → retorna 200 (idempotente)
4. `GET /api/collections/{id}/` → retorna places da coleção
5. `DELETE /api/collections/{id}/places/{place_id}/` → remove place
6. Frontend: criar coleção, adicionar place pelo PlaceDetail, ver coleção com place listado
