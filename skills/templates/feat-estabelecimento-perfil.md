# Feat — Perfil de Estabelecimento

## Problema

Após o cadastro como estabelecimento (`feat-tipo-conta.md`), o negócio não tem onde
registrar suas informações públicas: nome comercial, descrição, cardápio, horários,
contato. Não há página pública para o estabelecimento ser descoberto por outros usuários.

---

## Objetivo

1. Estabelecimento preenche perfil público no dashboard: nome, descrição, categoria,
   cover photo, telefone, site, link de cardápio externo
2. Cardápio interno: itens com nome, descrição, preço e foto
3. Página pública `/e/:username` acessível sem autenticação
4. Reutiliza `username` de `feat-perfil-publico.md` (já em `UserProfile`)

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — ModelViewSet, serializers, ImageService, nested routes
- `/bora-ali-backend` — PublicIdModel, MutationMixin, ImageService, convenções

Frontend:
- `/bora-ali-frontend` — React Query, React Hook Form + Zod, i18n
- `/frontend-design` — Card, Avatar, Badge, Sheet (shadcn/ui)

> **Dependências**: `feat-tipo-conta.md` (obrigatório) + `feat-perfil-publico.md`
> (para `username` em `UserProfile`).

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/establishments/__init__.py` | Criar app `establishments` |
| `backend/establishments/apps.py` | AppConfig |
| `backend/establishments/models.py` | `EstablishmentProfile`, `MenuItem` |
| `backend/establishments/serializers.py` | Serializers de perfil e cardápio |
| `backend/establishments/views.py` | `EstablishmentProfileView`, `MenuItemViewSet`, `PublicEstablishmentView` |
| `backend/establishments/urls.py` | Rotas do app |
| `backend/establishments/migrations/` | `makemigrations establishments` |
| `backend/config/settings.py` | Adicionar `establishments` em `INSTALLED_APPS` |
| `backend/config/urls.py` | Incluir `establishments.urls` |
| `frontend/src/api/establishment.ts` | CRUD de perfil e cardápio (novo) |
| `frontend/src/routes/dashboard/ProfilePage.tsx` | Formulário de edição do perfil |
| `frontend/src/routes/dashboard/MenuPage.tsx` | Gerenciar itens do cardápio |
| `frontend/src/routes/EstablishmentPublicPage.tsx` | Página pública `/e/:username` |
| `frontend/src/App.tsx` | Registrar rota `/e/:username` fora do `PrivateRoute` |

---

## Implementação passo a passo

### 1. Criar app `establishments`

```bash
cd backend
python manage.py startapp establishments
```

Adicionar em `config/settings.py`:
```python
INSTALLED_APPS = [
    ...
    "establishments",
]
```

### 2. `models.py`

```python
# backend/establishments/models.py
from django.conf import settings
from django.db import models
from core.models import PublicIdModel


class EstablishmentProfile(PublicIdModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="establishment_profile",
    )
    business_name = models.CharField(max_length=150)
    description = models.TextField(blank=True, default="")
    cover_photo = models.FileField(upload_to="", blank=True, null=True)
    category = models.CharField(max_length=50, blank=True, default="")
    menu_url = models.URLField(blank=True, default="")
    phone = models.CharField(max_length=30, blank=True, default="")
    website_url = models.URLField(blank=True, default="")
    is_public = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "establishments_profile"


class MenuItem(PublicIdModel):
    establishment = models.ForeignKey(
        EstablishmentProfile, on_delete=models.CASCADE, related_name="menu_items"
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    price = models.DecimalField(max_digits=8, decimal_places=2)
    photo = models.FileField(upload_to="", blank=True, null=True)
    is_available = models.BooleanField(default=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "establishments_menu_item"
        ordering = ["position", "name"]
```

> Rodar `python manage.py makemigrations establishments`.

### 3. `serializers.py`

```python
# backend/establishments/serializers.py
from rest_framework import serializers
from .models import EstablishmentProfile, MenuItem


class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = [
            "public_id", "name", "description", "price",
            "photo", "is_available", "position",
        ]
        read_only_fields = ["public_id"]


class EstablishmentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstablishmentProfile
        fields = [
            "public_id", "business_name", "description", "cover_photo",
            "category", "menu_url", "phone", "website_url", "is_public",
        ]
        read_only_fields = ["public_id"]

    def update(self, instance, validated_data):
        cover_photo = validated_data.pop("cover_photo", None)
        if cover_photo:
            ImageService.delete(instance.cover_photo)
            ImageService.save(instance, cover_photo, category="establishments/covers",
                              owner_pk=instance.user_id)
        return super().update(instance, validated_data)


class PublicEstablishmentSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.profile.username")
    menu_items = MenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = EstablishmentProfile
        fields = [
            "public_id", "username", "business_name", "description",
            "category", "menu_url", "phone", "website_url", "menu_items",
        ]
```

### 4. `views.py`

```python
# backend/establishments/views.py
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from core.views import MutationMixin
from .models import EstablishmentProfile, MenuItem
from .serializers import (
    EstablishmentProfileSerializer, MenuItemSerializer, PublicEstablishmentSerializer
)
from accounts.models import UserProfile


class EstablishmentProfileView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_profile(self, user):
        profile, _ = EstablishmentProfile.objects.get_or_create(user=user)
        return profile

    def get(self, request):
        profile = self._get_profile(request.user)
        return Response(EstablishmentProfileSerializer(profile).data)

    def patch(self, request):
        profile = self._get_profile(request.user)
        serializer = EstablishmentProfileSerializer(
            profile, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MenuItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MenuItemSerializer
    lookup_field = "public_id"

    def get_queryset(self):
        return MenuItem.objects.filter(establishment__user=self.request.user)

    def perform_create(self, serializer):
        profile = get_object_or_404(EstablishmentProfile, user=self.request.user)
        serializer.save(establishment=profile)


class PublicEstablishmentView(APIView):
    permission_classes = []

    def get(self, request, username):
        user_profile = get_object_or_404(UserProfile, username=username)
        profile = get_object_or_404(
            EstablishmentProfile, user=user_profile.user, is_public=True
        )
        return Response(PublicEstablishmentSerializer(profile).data)
```

### 5. `urls.py`

```python
# backend/establishments/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EstablishmentProfileView, MenuItemViewSet, PublicEstablishmentView

router = DefaultRouter()
router.register("menu", MenuItemViewSet, basename="menu-item")

urlpatterns = [
    path("establishment/me/", EstablishmentProfileView.as_view()),
    path("establishment/me/", include(router.urls)),
    path("e/<str:username>/", PublicEstablishmentView.as_view()),
]
```

```python
# backend/config/urls.py
path("api/", include("establishments.urls")),
```

### 6. Frontend — `api/establishment.ts`

```typescript
// frontend/src/api/establishment.ts
export const establishmentApi = {
  getProfile: () =>
    api.get<EstablishmentProfile>("/api/establishment/me/"),
  updateProfile: (data: Partial<EstablishmentProfile>) =>
    api.patch<EstablishmentProfile>("/api/establishment/me/", data),
  getPublic: (username: string) =>
    api.get<PublicEstablishment>(`/api/e/${username}/`),

  listMenu: () => api.get<MenuItem[]>("/api/establishment/me/menu/"),
  createMenuItem: (data: MenuItemPayload) =>
    api.post<MenuItem>("/api/establishment/me/menu/", data),
  updateMenuItem: (id: string, data: Partial<MenuItemPayload>) =>
    api.patch<MenuItem>(`/api/establishment/me/menu/${id}/`, data),
  deleteMenuItem: (id: string) =>
    api.delete(`/api/establishment/me/menu/${id}/`),
};
```

### 7. Frontend — `EstablishmentPublicPage.tsx`

```tsx
// frontend/src/routes/EstablishmentPublicPage.tsx
export function EstablishmentPublicPage() {
  const { username } = useParams<{ username: string }>();
  const { data, isError } = useQuery({
    queryKey: ["establishment", username],
    queryFn: () => establishmentApi.getPublic(username!),
  });

  if (isError) return <NotFound />;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-6">
      <Helmet>
        <title>{data?.business_name} — Bora Ali</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {data?.cover_photo && (
        <img src={data.cover_photo} className="w-full rounded-xl h-48 object-cover" />
      )}

      <div>
        <Badge>{data?.category}</Badge>
        <h1 className="text-2xl font-semibold mt-1">{data?.business_name}</h1>
        <p className="text-muted-foreground text-sm">{data?.description}</p>
      </div>

      <div className="flex gap-3">
        {data?.menu_url && (
          <Button asChild variant="outline" size="sm">
            <a href={data.menu_url} target="_blank">{t("establishment.view_menu")}</a>
          </Button>
        )}
        {data?.phone && (
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${data.phone}`}>{t("establishment.call")}</a>
          </Button>
        )}
      </div>

      {data?.menu_items && data.menu_items.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">{t("establishment.menu")}</h2>
          {data.menu_items.map((item) => (
            <div key={item.public_id} className="flex justify-between items-start border rounded-lg p-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <span className="font-medium text-sm">
                {formatCurrency(item.price)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 8. Traduções i18n (pt-BR)

```json
"establishment.view_menu": "Ver cardápio",
"establishment.call": "Ligar",
"establishment.menu": "Cardápio",
"dashboard.profile_saved": "Perfil salvo!",
"dashboard.menu_item_added": "Item adicionado ao cardápio"
```

---

## O que este feature não inclui (YAGNI)

- Cover photo pública sem autenticação (requer endpoint de mídia pública — extensão futura)
- Horário de funcionamento estruturado
- Galeria de fotos do estabelecimento
- Avaliações de outros usuários no perfil público

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `PATCH /api/establishment/me/` → atualiza perfil
2. `POST /api/establishment/me/menu/` → cria item de cardápio
3. `GET /api/e/:username/` sem auth com `is_public=true` → retorna perfil + itens
4. `GET /api/e/:username/` com `is_public=false` → 404
5. Frontend: dashboard edita perfil, página pública renderiza itens do cardápio
