# Feat — Compartilhamento de Places entre usuários

## Problema

Não há como compartilhar um place com outra pessoa. O app é 100% privado — um usuário não
consegue enviar uma recomendação de lugar para um amigo nem importar recomendações recebidas.

---

## Objetivo

1. Dono gera um link público com token opaco (permanente, revogável)
2. Destinatário abre o link sem precisar de conta — vê nome, categoria, endereço, mapa e cover photo
3. Se logado, pode importar o place para a própria conta com um clique
4. Import copia dados textuais e re-criptografa a cover photo com a chave do importador via Celery

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — serializers, viewsets, DRF APIView, Celery tasks
- `/django-patterns` — HMAC signed URL, re-criptografia via Celery, idempotência de import
- `/bora-ali-backend` — convenções do projeto (ImageService, MutationMixin, PublicIdModel, SingleSession)

Frontend:
- `/bora-ali-frontend` — serviços de API, React Query, roteamento, i18n
- `/frontend-design` — componentes shadcn/ui (Button, Badge, Sheet)
- `/impeccable` — SharePage pública, foto bleeding-edge, CTA sticky no fundo
- `/design-taste-frontend` — chips de link (Maps/Instagram), skeleton de loading

> **Dependências**:
> - `feat-notifications.md` — opcional, pode notificar o dono quando alguém importa. Não bloqueia MVP.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/places/models.py` | Adicionar `PlaceShare` |
| `backend/places/views.py` | `PlaceShareCreateView`, `PlaceShareDetailView`, `PlaceShareMediaView`, `PlaceShareImportView` |
| `backend/places/urls.py` | Registrar `/share/`, `/places/{id}/share/` |
| `backend/places/tasks.py` | Adicionar `copy_shared_place_photo` |
| `backend/core/image_service.py` | Sem alterações — usar `decrypt()` + `default_storage.open()` |
| `backend/places/migrations/` | `makemigrations places` após criar `PlaceShare` |
| `frontend/src/routes/SharePage.tsx` | Página pública (nova) |
| `frontend/src/services/share.service.ts` | `createShare()`, `getShare()`, `importShare()` |
| `frontend/src/routes/PlaceDetailPage.tsx` | Adicionar `ShareButton` |
| `frontend/src/App.tsx` | Registrar rota `/share/:token` fora do `PrivateRoute` |

---

## Implementação passo a passo

### 1. `models.py` — `PlaceShare`

```python
# backend/places/models.py
import secrets

class PlaceShare(models.Model):
    # IMPORTANTE: passar a função sem chamar — secrets.token_urlsafe(32) chamaria uma vez
    # e todos os registros teriam o mesmo token.
    token = models.CharField(
        max_length=64, unique=True, db_index=True, default=secrets.token_urlsafe
    )
    place = models.ForeignKey(
        Place, on_delete=models.CASCADE, related_name="shares"
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="place_shares"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "places_place_share"
        indexes = [
            models.Index(fields=["token", "is_active"], name="share_token_active_idx"),
        ]
```

> Rodar `python manage.py makemigrations places` após criar o model.

### 2. `image_service.py` — sem alterações necessárias

`ImageService.decrypt(data: bytes, user_id: int) -> bytes` já existe.
Para ler do storage antes de descriptografar, use `default_storage.open(path).read()`.

```python
from django.core.files.storage import default_storage

# Ler + descriptografar (substitui o read_decrypted que o spec anterior propunha)
raw = default_storage.open(place.cover_photo).read()
decrypted = ImageService.decrypt(raw, user_id=owner_pk)
```

### 3. `views.py` — endpoints

```python
# backend/places/views.py
import hmac, hashlib, time
from django.conf import settings
from django.core.files.storage import default_storage
from django.http import HttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from core.image_service import ImageService
from core.views import MutationMixin
from .models import Place, PlaceShare, PlaceStatus
from .tasks import copy_shared_place_photo

def _make_signed_media_url(share_token: str, image_path: str, ttl: int = 3600) -> str:
    exp = int(time.time()) + ttl
    msg = f"{share_token}:{image_path}:{exp}".encode()
    sig = hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
    return f"{settings.PUBLIC_BASE_URL}/api/share/{share_token}/media/{image_path}?sig={sig}&exp={exp}"


class PlaceShareCreateView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, public_id):
        place = get_object_or_404(Place, public_id=public_id, user=request.user)
        # Decisão de design: cada chamada cria token independente (revogável individualmente).
        # Usuário pode ter N links ativos pro mesmo place — comportamento intencional.
        share = PlaceShare.objects.create(place=place, owner=request.user)
        return Response({"token": share.token, "url": f"{settings.PUBLIC_BASE_URL}/share/{share.token}"})


class PlaceShareRevokeView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, public_id, token):
        share = get_object_or_404(PlaceShare, token=token, place__public_id=public_id, owner=request.user)
        share.is_active = False
        share.save(update_fields=["is_active"])
        return Response(status=204)


class PlaceShareDetailView(APIView):
    permission_classes = []

    def get(self, request, token):
        share = get_object_or_404(
            PlaceShare.objects.select_related("place"),
            token=token,
            is_active=True,
        )
        place = share.place
        image_url = None
        if place.cover_photo:
            image_url = _make_signed_media_url(token, str(place.cover_photo))
        return Response({
            "name": place.name,
            "category": place.category,
            "address": place.address,
            "status": place.status,
            "instagram_url": place.instagram_url,
            "maps_url": place.maps_url,
            "latitude": place.latitude,
            "longitude": place.longitude,
            "cover_photo_url": image_url,
        })


class PlaceShareMediaView(APIView):
    permission_classes = []

    def get(self, request, token, path):
        sig = request.query_params.get("sig", "")
        try:
            exp = int(request.query_params.get("exp", 0))
        except (ValueError, TypeError):
            return Response(status=404)
        if time.time() > exp:
            return Response(status=404)
        expected = hmac.new(
            settings.SECRET_KEY.encode(),
            f"{token}:{path}:{exp}".encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return Response(status=404)
        share = get_object_or_404(
            PlaceShare.objects.select_related("place", "owner"),
            token=token,
            is_active=True,
        )
        try:
            raw = default_storage.open(share.place.cover_photo).read()
            decrypted = ImageService.decrypt(raw, user_id=share.owner.pk)
        except Exception:
            return Response(status=404)
        # Seguir padrão de media_views.py: stream sem Content-Disposition forçado
        return HttpResponse(decrypted, content_type=ImageService.detect_content_type(decrypted))


class PlaceShareImportView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        share = get_object_or_404(
            PlaceShare.objects.select_related("place", "owner"),
            token=token,
            is_active=True,
        )
        if share.owner == request.user:
            return Response({"detail": "Você já é dono deste lugar."}, status=400)

        place = share.place

        # Evita importações duplicadas do mesmo place (mesmo nome + endereço)
        already_imported = Place.objects.filter(
            user=request.user, name=place.name, address=place.address
        ).exists()
        if already_imported:
            return Response({"detail": "Você já tem este lugar na sua lista."}, status=400)

        imported = Place.objects.create(
            user=request.user,
            name=place.name,
            category=place.category,
            address=place.address,
            instagram_url=place.instagram_url,
            maps_url=place.maps_url,
            latitude=place.latitude,
            longitude=place.longitude,
            coords_status=place.coords_status,
            status=PlaceStatus.WANT_TO_VISIT,
            notes="",
        )

        if place.cover_photo:
            copy_shared_place_photo.delay(
                source_place_pk=place.pk,
                source_owner_pk=share.owner.pk,
                target_place_pk=imported.pk,
                target_owner_pk=request.user.pk,
            )

        return Response({"public_id": str(imported.public_id)}, status=201)
```

### 4. `tasks.py` — re-criptografia da foto

```python
# backend/places/tasks.py
@shared_task(bind=True, max_retries=3)
def copy_shared_place_photo(self, source_place_pk, source_owner_pk, target_place_pk, target_owner_pk):
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    from places.models import Place as PlaceModel
    from core.image_service import ImageService

    try:
        source_place = PlaceModel.objects.get(pk=source_place_pk)
    except PlaceModel.DoesNotExist:
        return  # Place original removido antes da task executar — sem retry

    try:
        target_place = PlaceModel.objects.get(pk=target_place_pk)
    except PlaceModel.DoesNotExist:
        return  # Place importado foi deletado antes da task — sem retry

    try:
        raw = default_storage.open(source_place.cover_photo).read()
        decrypted = ImageService.decrypt(raw, user_id=source_owner_pk)
        path = ImageService.save(ContentFile(decrypted), user_id=target_owner_pk, category="places/covers")
        target_place.cover_photo = path
        target_place.save(update_fields=["cover_photo"])
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
```

> Se a task esgotar as tentativas, o place importado existe sem foto — não é crítico.

### 5. `urls.py` — registrar rotas

```python
# backend/places/urls.py
from .views import (
    PlaceShareCreateView, PlaceShareRevokeView,
    PlaceShareDetailView, PlaceShareMediaView, PlaceShareImportView,
)

# Autenticados (dentro do router de places)
path("places/<public_id>/share/", PlaceShareCreateView.as_view()),
path("places/<public_id>/share/<str:token>/", PlaceShareRevokeView.as_view()),

# Públicos (no urls.py raiz ou separado)
path("share/<str:token>/", PlaceShareDetailView.as_view()),
path("share/<str:token>/media/<path:path>", PlaceShareMediaView.as_view()),
path("share/<str:token>/import/", PlaceShareImportView.as_view()),
```

### 6. Frontend — `services/share.service.ts`

```typescript
// frontend/src/services/share.service.ts
export interface ShareDetail {
  name: string;
  category: string;
  address: string;
  status: string;
  instagram_url: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  cover_photo_url: string | null;
}

export const shareService = {
  createShare: (placePublicId: string) =>
    api.post<{ token: string; url: string }>(`/api/places/${placePublicId}/share/`),

  getShare: (token: string) =>
    api.get<ShareDetail>(`/api/share/${token}/`),

  importShare: (token: string) =>
    api.post<{ public_id: string }>(`/api/share/${token}/import/`),
};
```

### 7. Frontend — `SharePage.tsx` (rota pública)

```tsx
// frontend/src/routes/SharePage.tsx
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { shareService } from "@/services/share.service";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotFound } from "@/components/NotFound";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Instagram } from "lucide-react";

export function SharePage() {
  const { token } = useParams<{ token: string }>();
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["share", token],
    queryFn: () => shareService.getShare(token!),
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);

  async function handleImport() {
    setImporting(true);
    try {
      const result = await shareService.importShare(token!);
      navigate(`/places/${result.public_id}`);
    } finally {
      setImporting(false);
    }
  }

  if (isError) return <NotFound />;

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-4">
        <Skeleton className="w-full h-56 rounded-xl" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{data?.name} — Bora Ali</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-lg mx-auto">
        {/* Foto ocupa topo sem padding — bleeding edge no mobile */}
        {data?.cover_photo_url && (
          <img
            src={data.cover_photo_url}
            alt={data.name}
            className="w-full aspect-[4/3] object-cover"
          />
        )}

        <div className="p-4 space-y-4">
          <div>
            <Badge variant="secondary" className="mb-2">{data?.category}</Badge>
            <h1 className="text-2xl font-semibold leading-tight">{data?.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">{data?.address}</p>
          </div>

          {/* Links como chips, não <a> raw */}
          {(data?.maps_url || data?.instagram_url) && (
            <div className="flex gap-2">
              {data.maps_url && (
                <a
                  href={data.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 hover:bg-muted transition-colors"
                >
                  <MapPin className="w-3 h-3" />
                  {t("share.view_maps")}
                </a>
              )}
              {data.instagram_url && (
                <a
                  href={data.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs border rounded-full px-3 py-1.5 hover:bg-muted transition-colors"
                >
                  <Instagram className="w-3 h-3" />
                  {t("share.view_instagram")}
                </a>
              )}
            </div>
          )}
        </div>

        {/* CTA sticky no fundo em mobile — não se perde ao scrollar */}
        <div className="sticky bottom-0 bg-background border-t p-4">
          {user ? (
            <Button onClick={handleImport} disabled={importing} className="w-full">
              {importing ? t("share.importing") : t("share.import_button")}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <a href={`/login?next=/share/${token}`}>{t("share.login_to_import")}</a>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
```

> Rota registrada fora do `PrivateRoute` em `App.tsx`.
> Adicionar `<meta name="robots" content="noindex">` na página para não indexar.

### 8. Frontend — `ShareButton` no PlaceDetail

```tsx
function ShareButton({ placePublicId }: { placePublicId: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (!shareUrl) {
      const result = await shareService.createShare(placePublicId);
      setShareUrl(result.url);
      await navigator.clipboard.writeText(result.url);
    } else {
      await navigator.clipboard.writeText(shareUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare}>
      <Share2 className="w-4 h-4 mr-2" />
      {copied ? t("share.copied") : t("share.button")}
    </Button>
  );
}
```

### 9. Traduções i18n (pt-BR)

```json
"share.button": "Compartilhar",
"share.copied": "Link copiado!",
"share.import_button": "Adicionar à minha lista",
"share.importing": "Adicionando...",
"share.login_to_import": "Entre para adicionar à sua lista",
"share.view_maps": "Ver no Maps",
"share.view_instagram": "Instagram"
```

---

## O que este feature não inclui (YAGNI)

- Compartilhamento de coleção / múltiplos places
- Expiração automática de links
- Analytics de visualizações
- Notificação ao dono quando alguém importa (pode ser adicionado após `feat-notifications`)
- Compartilhamento de Visit ou VisitItem

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `POST /api/places/{id}/share/` → retorna `{ token, url }`
2. `GET /api/share/{token}/` sem auth → retorna dados do place + `cover_photo_url` com signed URL
3. Abrir `cover_photo_url` → imagem descriptografada servida corretamente
4. `POST /api/share/{token}/import/` com auth de outro usuário → place criado, Celery task dispara
5. Após task completar → place importado tem cover photo re-criptografada
6. `DELETE /api/places/{id}/share/{token}/` → `GET /api/share/{token}/` retorna 404
7. Frontend: botão "Compartilhar" copia link, página pública renderiza, botão de import redireciona para o place
