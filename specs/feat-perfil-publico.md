# Feat — Perfil Público de Usuário

## Problema

O app é 100% privado — não há como um usuário mostrar seus lugares para outra pessoa
a não ser via link de compartilhamento individual (`feat-place-sharing.md`).
Não existe conceito de "usuário com perfil público" ou "curador de lugares".

---


## Objetivo

1. Usuário define um `username` único (slug) e pode tornar o perfil público
2. Places podem ser marcados individualmente como `is_public`
3. Qualquer pessoa acessa `/u/:username` sem conta — vê nome, bio e places públicos
4. Base necessária para `feat-feed-amigos.md` (follows) e descoberta orgânica

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — serializers, viewset público, validação de slug, migrations
- `/django-patterns` — Prefetch com to_attr, select_related, N+1 em perfil público
- `/bora-ali-backend` — UserProfile, Place, PublicIdModel, convenções de URL

Frontend:
- `/bora-ali-frontend` — React Query, roteamento, i18n
- `/frontend-design` — Avatar, Badge, Card (shadcn/ui)
- `/impeccable` — layout do perfil público, lista de places, skeleton states
- `/design-taste-frontend` — header de perfil, PublicPlaceCard, affordances de follow

> **Dependências**: nenhuma. Bloqueia `feat-feed-amigos.md`.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/models.py` | Adicionar `username`, `bio`, `is_public` em `UserProfile` |
| `backend/accounts/views.py` | `PublicProfileView` (GET `/api/u/:username/`) |
| `backend/places/serializers.py` | `PublicPlaceSerializer` (novo — evita acoplamento cross-app) |
| `backend/accounts/serializers.py` | `PublicProfileSerializer`, `AccountSerializer` (expor novos campos) |
| `backend/accounts/urls.py` | Registrar rota pública `/u/:username/` |
| `backend/accounts/migrations/` | `makemigrations accounts` após editar `UserProfile` |
| `backend/places/models.py` | Adicionar `is_public` em `Place` |
| `backend/places/serializers.py` | `PublicPlaceSerializer` (sem dados sensíveis) |
| `backend/places/migrations/` | `makemigrations places` após editar `Place` |
| `frontend/src/routes/PublicProfilePage.tsx` | Página pública `/u/:username` (nova) |
| `frontend/src/routes/AccountPage.tsx` | Campos `username`, `bio`, toggle `is_public` (com Controller) |
| `frontend/src/services/auth.service.ts` | `getPublicProfile()` + tipos `PublicProfile`/`PublicPlace` adicionados |
| `frontend/src/components/places/PublicPlaceCard.tsx` | Card simplificado sem campos privados (novo) |
| `frontend/src/App.tsx` | Registrar rota `/u/:username` fora do `PrivateRoute` |

---

## Implementação passo a passo

### 1. `accounts/models.py` — campos em `UserProfile`

```python
# backend/accounts/models.py
import re
from django.core.exceptions import ValidationError

def _validate_username(value):
    if not value:  # null/blank permitido — o validator não deve rejeitar ausência
        return
    if not re.match(r'^[a-z0-9_]{3,30}$', value):
        raise ValidationError(
            "Username deve ter 3-30 caracteres: letras minúsculas, números e _"
        )

class UserProfile(models.Model):
    # ... campos existentes ...
    username = models.CharField(
        max_length=30, unique=True, null=True, blank=True,
        db_index=True, validators=[_validate_username]
    )
    bio = models.TextField(max_length=300, blank=True, default="")
    is_public = models.BooleanField(default=False)
```

> Rodar `python manage.py makemigrations accounts` após editar o model.

### 2. `places/models.py` — campo `is_public` em `Place`

```python
# backend/places/models.py
class Place(PublicIdModel):
    # ... campos existentes ...
    is_public = models.BooleanField(default=False, db_index=True)
```

> Rodar `python manage.py makemigrations places` após editar o model.

### 3. `places/serializers.py` — `PublicPlaceSerializer`

> Mantido em `places/` para evitar acoplamento cross-app em `accounts/`.

```python
# backend/places/serializers.py
class PublicPlaceSerializer(serializers.ModelSerializer):
    """Dados mínimos de um place público — sem notas nem avaliações privadas."""
    class Meta:
        model = Place
        fields = [
            "public_id", "name", "category", "address", "status",
            "maps_url", "instagram_url", "latitude", "longitude",
        ]
```

### 4a. `accounts/serializers.py` — `PublicProfileSerializer`

```python
# backend/accounts/serializers.py
from places.serializers import PublicPlaceSerializer

class PublicProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="profile.username")
    bio = serializers.CharField(source="profile.bio")
    # source="public_places" — nome do to_attr no Prefetch do PublicProfileView
    places = PublicPlaceSerializer(many=True, read_only=True, source="public_places")

    class Meta:
        model = User
        fields = ["username", "bio", "places"]
```

> `places` usa campo direto (não `SerializerMethodField`) — evita N+1. O view faz
> `prefetch_related` antes de serializar.

### 4b. `accounts/views.py` — `PublicProfileView`

> **Atenção:** `Place.objects.live()` assume que `PlaceQuerySet` tem método `.live()` (filtra
> places não deletados/em lixeira). Verificar em `places/managers.py` antes de implementar.
> Se não existir, substituir por `Place.objects.filter(deletion_requested_at__isnull=True)` ou
> equivalente conforme a convenção do projeto.

```python
# backend/accounts/views.py
from django.db.models import Prefetch
from places.models import Place

class PublicProfileView(APIView):
    permission_classes = []  # público

    def get(self, request, username):
        # Sem slice aqui — Prefetch não aceita queryset fatiado ([:N] levanta TypeError).
        # Limite de 50 places aplicado via Python após o Prefetch (ver abaixo).
        public_places_qs = Place.objects.live().filter(
            is_public=True
        ).order_by("-created_at")[:50]  # ATENÇÃO: só funciona se não houver outro filtro após

        # Alternativa segura se [:50] no Prefetch queryset causar TypeError:
        # aplicar o slice no serializer (source="public_places") passando [:50] no to_attr.
        # Nesse caso, remover [:50] do queryset e fatiar em PublicProfileSerializer.

        profile = get_object_or_404(
            UserProfile.objects.select_related("user").prefetch_related(
                # "user__places" — related_name correto definido em Place.user FK
                # "user__place_set" seria o padrão sem related_name, mas aqui é "places"
                Prefetch("user__places", queryset=public_places_qs, to_attr="public_places")
            ),
            username=username,
            is_public=True,
        )
        serializer = PublicProfileSerializer(profile.user)
        return Response(serializer.data)
```

> **Nota sobre o limite de 50:** Django aceita queryset fatiado num `Prefetch` somente se não
> for combinado com filtros adicionais depois. Testar no ambiente; se levantar `TypeError`,
> usar a alternativa acima.

### 5. `accounts/urls.py` — registrar rota

```python
# backend/accounts/urls.py
path("u/<str:username>/", PublicProfileView.as_view()),
```

### 6. `AccountSerializer` — expor novos campos

```python
# backend/accounts/serializers.py
class AccountSerializer(serializers.ModelSerializer):
    # Expor username, bio, is_public via profile nested ou achatado:
    username = serializers.CharField(
        source="profile.username", required=False, allow_null=True, allow_blank=True
    )
    bio = serializers.CharField(source="profile.bio", required=False)
    is_public = serializers.BooleanField(source="profile.is_public", required=False)

    def validate_username(self, value):
        if not value:  # null/blank — sem validação de unicidade para ausência
            return value
        qs = UserProfile.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(user=self.instance)
        if qs.exists():
            raise ValidationError("Este username já está em uso.")
        return value

    def update(self, instance, validated_data):
        # DRF coloca fields com source="profile.X" sob validated_data["profile"]
        profile_data = validated_data.pop("profile", {})
        if profile_data:
            profile = getattr(instance, "profile", None)
            if profile is None:
                from accounts.models import UserProfile
                profile = UserProfile.objects.create(user=instance)
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save(update_fields=list(profile_data.keys()))
        return super().update(instance, validated_data)
```

### 7. Frontend — `services/auth.service.ts` — `getPublicProfile`

```typescript
// Adicionar em frontend/src/services/auth.service.ts
export interface PublicPlace {
  public_id: string;
  name: string;
  category: string;
  address: string;
  status: string;
  maps_url: string | null;
  instagram_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PublicProfile {
  username: string;
  bio: string;
  places: PublicPlace[];
}

// Dentro do authService object:
getPublicProfile: (username: string) =>
  api.get<PublicProfile>(`/api/u/${username}/`),
```

### 8a. Frontend — `PublicPlaceCard.tsx`

> Lista sem card wrapper — cada item separado por `divide-y` do container pai.
> Sem box/shadow — o espaço e a linha fazem o trabalho.

```tsx
// frontend/src/components/places/PublicPlaceCard.tsx
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PublicPlace } from "@/services/auth.service";

export function PublicPlaceCard({ place }: { place: PublicPlace }) {
  return (
    <div className="py-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Badge variant="secondary" className="text-xs">{place.category}</Badge>
        </div>
        <p className="font-medium truncate">{place.name}</p>
        <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
          <MapPin className="w-3 h-3 shrink-0" />
          {place.address}
        </p>
      </div>
      {place.maps_url && (
        <a
          href={place.maps_url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
        >
          <MapPin className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
```

### 8b. Frontend — `PublicProfilePage.tsx`

```tsx
// frontend/src/routes/PublicProfilePage.tsx
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { authService } from "@/services/auth.service";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { NotFound } from "@/components/NotFound";
import { PublicPlaceCard } from "@/components/places/PublicPlaceCard";

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => authService.getPublicProfile(username!),
  });

  if (isError) return <NotFound />;

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{data?.username} — Boora Ali</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Header: left-aligned — evita clichê de perfil centrado */}
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarFallback className="text-lg">
              {data?.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-semibold truncate">@{data?.username}</h1>
              {/* Slot para botão follow (feat-feed-amigos) */}
            </div>
            {data?.bio && (
              <p className="text-muted-foreground text-sm mt-1 line-clamp-3">{data.bio}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            {t("profile.public_places")}
          </h2>
          {data?.places.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              {t("profile.no_public_places")}
            </p>
          )}
          {/* Sem card wrapper — PublicPlaceCard usa divide-y implícito via list */}
          <div className="divide-y">
            {data?.places.map((place) => (
              <PublicPlaceCard key={place.public_id} place={place} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
```

### 9. `AccountPage.tsx` — campos de perfil público

```tsx
// Campos adicionados ao formulário de conta:
<Input label={t("account.username")} {...register("username")}
  placeholder="seu_username" />
<Textarea label={t("account.bio")} {...register("bio")} maxLength={300} />

{/* Switch precisa de Controller — shadcn Switch não aceita ref/onChange do register() */}
<div className="flex items-center justify-between">
  <span className="text-sm">{t("account.is_public")}</span>
  <Controller
    control={control}
    name="is_public"
    render={({ field }) => (
      <Switch checked={field.value} onCheckedChange={field.onChange} />
    )}
  />
</div>

// Toggle por place no PlaceDetail:
<Switch
  checked={place.is_public}
  onCheckedChange={(v) => updatePlace.mutate({ is_public: v })}
  label={t("place.is_public")}
/>
```

### 10. Traduções i18n (pt-BR)

```json
"profile.public_places": "Lugares públicos",
"profile.no_public_places": "Nenhum lugar público ainda",
"account.username": "Username",
"account.bio": "Bio",
"account.is_public": "Perfil público",
"place.is_public": "Visível no meu perfil público"
```

---

## O que este feature não inclui (YAGNI)

- Foto de perfil pública (profile_photo já existe mas é privado — deixar para extensão)
- Paginação de places públicos além de 50
- Verificação de conta / badge verificado
- Perfis de coleções públicas
- SEO/indexação de perfis (mantemos `noindex` por ora)

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `PATCH /api/auth/me/` com `username=meuuser`, `is_public=true`
2. `GET /api/u/meuuser/` sem auth → retorna perfil + places públicos
3. Place com `is_public=false` → não aparece na resposta pública
4. `GET /api/u/meuuser/` com perfil `is_public=false` → 404
5. Frontend: `/u/meuuser` renderiza avatar, bio e cards de places
