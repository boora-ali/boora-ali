# Feat — Coleções de Places

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
- `/django-expert` — M2M through model, viewsets, nested routes
- `/bora-ali-backend` — PublicIdModel, MutationMixin, convenções de URL

Frontend:
- `/bora-ali-frontend` — React Query, serviços de API, roteamento
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
| `frontend/src/api/collections.ts` | CRUD de coleções + add/remove place (novo) |
| `frontend/src/routes/CollectionListPage.tsx` | Lista de coleções do usuário (nova) |
| `frontend/src/routes/CollectionDetailPage.tsx` | Places de uma coleção (nova) |
| `frontend/src/routes/PlaceDetailPage.tsx` | Botão "Adicionar a coleção" |
| `frontend/src/App.tsx` | Registrar rotas `/collections` e `/collections/:id` |

---

## Implementação passo a passo

### 1. `models.py` — `Collection` e `CollectionPlace`

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

    places = models.ManyToManyField(
        "Place",
        through="CollectionPlace",
        related_name="collections",
    )

    class Meta:
        db_table = "places_collection"
        ordering = ["-updated_at"]


class CollectionPlace(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE)
    place = models.ForeignKey("Place", on_delete=models.CASCADE)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_collection_place"
        unique_together = [("collection", "place")]
        ordering = ["-added_at"]
```

> Rodar `python manage.py makemigrations places` após criar os modelos.

### 2. `serializers.py`

```python
# backend/places/serializers.py
class CollectionSerializer(serializers.ModelSerializer):
    place_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Collection
        fields = ["public_id", "name", "emoji", "description", "place_count", "updated_at"]
        read_only_fields = ["public_id", "updated_at"]


class CollectionDetailSerializer(CollectionSerializer):
    places = PlaceListSerializer(many=True, read_only=True)

    class Meta(CollectionSerializer.Meta):
        fields = CollectionSerializer.Meta.fields + ["places"]
```

### 3. `views.py` — `CollectionViewSet`

```python
# backend/places/views.py
from django.db.models import Count

class CollectionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    lookup_field = "public_id"

    def get_queryset(self):
        qs = Collection.objects.filter(user=self.request.user)
        if self.action == "list":
            return qs.annotate(place_count=Count("places"))
        return qs.prefetch_related("places")

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
        CollectionPlace.objects.get_or_create(collection=collection, place=place)
        return Response(status=201)

    def delete(self, request, collection_public_id, place_public_id):
        collection, place = self._get_collection_and_place(
            request, collection_public_id, place_public_id
        )
        CollectionPlace.objects.filter(collection=collection, place=place).delete()
        return Response(status=204)
```

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

### 5. Frontend — `api/collections.ts`

```typescript
// frontend/src/api/collections.ts
export interface Collection {
  public_id: string;
  name: string;
  emoji: string;
  description: string;
  place_count: number;
  updated_at: string;
}

export const collectionsApi = {
  list: () => api.get<Collection[]>("/api/collections/"),
  create: (data: Pick<Collection, "name" | "emoji" | "description">) =>
    api.post<Collection>("/api/collections/", data),
  get: (id: string) => api.get<Collection & { places: Place[] }>(`/api/collections/${id}/`),
  update: (id: string, data: Partial<Collection>) =>
    api.patch<Collection>(`/api/collections/${id}/`, data),
  delete: (id: string) => api.delete(`/api/collections/${id}/`),
  addPlace: (collectionId: string, placeId: string) =>
    api.post(`/api/collections/${collectionId}/places/${placeId}/`),
  removePlace: (collectionId: string, placeId: string) =>
    api.delete(`/api/collections/${collectionId}/places/${placeId}/`),
};
```

### 6. Frontend — `CollectionListPage.tsx`

```tsx
// frontend/src/routes/CollectionListPage.tsx
export function CollectionListPage() {
  const { data: collections } = useQuery({
    queryKey: ["collections"],
    queryFn: collectionsApi.list,
  });

  return (
    <div className="space-y-3 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">{t("collections.title")}</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          {t("collections.new")}
        </Button>
      </div>
      {collections?.map((c) => (
        <Link key={c.public_id} to={`/collections/${c.public_id}`}>
          <Card className="p-4 flex items-center gap-3">
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
    </div>
  );
}
```

### 7. Botão "Adicionar a coleção" no PlaceDetail

```tsx
// Dropdown ou Sheet listando as coleções do usuário com checkbox
function AddToCollectionSheet({ placePublicId }: { placePublicId: string }) {
  const { data: collections } = useQuery({ queryKey: ["collections"], queryFn: collectionsApi.list });
  const { data: place } = useQuery({ queryKey: ["place", placePublicId], queryFn: ... });

  const placeCollectionIds = new Set(place?.collections?.map((c) => c.public_id));

  function handleToggle(collectionId: string) {
    const isIn = placeCollectionIds.has(collectionId);
    if (isIn) {
      collectionsApi.removePlace(collectionId, placePublicId);
    } else {
      collectionsApi.addPlace(collectionId, placePublicId);
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
2. `POST /api/collections/{id}/places/{place_id}/` → adiciona place
3. `GET /api/collections/{id}/` → retorna places da coleção
4. `DELETE /api/collections/{id}/places/{place_id}/` → remove place
5. Frontend: criar coleção, adicionar place pelo PlaceDetail, ver coleção com place listado
