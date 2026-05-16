# Feat — Recomendações de Estabelecimentos

## Problema

Usuários que já visitaram muitos lugares não recebem sugestões de novos estabelecimentos
compatíveis com seus gostos. Não há seção de descoberta baseada em histórico — o usuário
precisa buscar ativamente.

---

## Objetivo

1. Seção "Recomendados para você" na home/feed: horizontal scroll de estabelecimentos
   públicos na mesma categoria dos places mais visitados pelo usuário
2. Notificação in-app periódica (semanal) sugerindo um estabelecimento relevante
3. Algoritmo: top-3 categorias nos places com `status=VISITED` → busca estabelecimentos
   públicos nessas categorias, ordenados por recência de cadastro

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — annotate, Count, Subquery, queryset otimizado
- `/bora-ali-backend` — convenções de views, tasks.py, Place/Visit models

Frontend:
- `/bora-ali-frontend` — React Query, i18n, scroll horizontal
- `/frontend-design` — Card, Badge, ScrollArea (shadcn/ui)

> **Dependências**: `feat-estabelecimento-perfil.md` (obrigatório — `EstablishmentProfile`
> precisa existir) + `feat-notifications.md` (para notificações periódicas).

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/establishments/serializers.py` | `RecommendationSerializer` |
| `backend/establishments/views.py` | `RecommendationsView` |
| `backend/establishments/tasks.py` | `send_recommendation_notifications` |
| `backend/establishments/urls.py` | Registrar `/recommendations/` |
| `frontend/src/api/social.ts` | Adicionar `getRecommendations()` |
| `frontend/src/routes/FeedPage.tsx` | Seção "Recomendados para você" |
| `frontend/src/components/RecommendationCard.tsx` | Card de estabelecimento recomendado (novo) |

---

## Implementação passo a passo

### 1. `views.py` — `RecommendationsView`

```python
# backend/establishments/views.py
from django.db.models import Count
from places.models import Place, PlaceStatus


class RecommendationsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Top-3 categorias mais visitadas pelo usuário
        top_categories = (
            Place.objects.filter(
                user=request.user,
                status=PlaceStatus.VISITED,
                deleted_at__isnull=True,
                category__gt="",
            )
            .values("category")
            .annotate(total=Count("id"))
            .order_by("-total")[:3]
            .values_list("category", flat=True)
        )

        if not top_categories:
            # Sem histórico: retornar estabelecimentos mais recentes
            profiles = EstablishmentProfile.objects.filter(
                is_public=True
            ).order_by("-created_at")[:10]
        else:
            profiles = EstablishmentProfile.objects.filter(
                is_public=True,
                category__in=top_categories,
            ).order_by("-created_at")[:10]

        return Response(RecommendationSerializer(profiles, many=True).data)
```

### 2. `serializers.py` — `RecommendationSerializer`

```python
# backend/establishments/serializers.py
class RecommendationSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.profile.username")

    class Meta:
        model = EstablishmentProfile
        fields = [
            "public_id", "username", "business_name",
            "category", "description", "menu_url",
        ]
```

### 3. `tasks.py` — notificação semanal de recomendações

```python
# backend/establishments/tasks.py
import logging
from celery import shared_task

_log = logging.getLogger("establishments.tasks")


@shared_task
def send_recommendation_notifications():
    """Envia notificação semanal com 1 recomendação por usuário ativo."""
    from notifications.service import notify, NotificationType
    from django.contrib.auth import get_user_model
    from places.models import Place, PlaceStatus
    from django.db.models import Count

    User = get_user_model()

    # Apenas usuários PERSON com ao menos 1 visita registrada
    users = User.objects.filter(
        profile__account_type="person",
        places__status=PlaceStatus.VISITED,
        places__deleted_at__isnull=True,
    ).distinct()

    notified = 0
    for user in users.iterator():
        top_category = (
            Place.objects.filter(
                user=user,
                status=PlaceStatus.VISITED,
                deleted_at__isnull=True,
                category__gt="",
            )
            .values("category")
            .annotate(total=Count("id"))
            .order_by("-total")
            .values_list("category", flat=True)
            .first()
        )

        if not top_category:
            continue

        recommendation = EstablishmentProfile.objects.filter(
            is_public=True,
            category=top_category,
        ).order_by("-created_at").first()

        if not recommendation:
            continue

        notify(
            user=user,
            type=NotificationType.RECOMMENDATION,
            title="Novo lugar pra você explorar",
            body=f"Baseado nos seus favoritos: {recommendation.business_name}",
            metadata={"establishment_username": recommendation.user.profile.username},
        )
        notified += 1

    _log.info("send_recommendation_notifications: %d notificações enviadas", notified)
    return {"notified": notified}
```

**Agendar via admin**: crontab `0 9 * * 1` (toda segunda-feira às 9h).

### 4. `NotificationType` — novo tipo

```python
# notifications/constants.py
class NotificationType(str, Enum):
    # ... tipos existentes ...
    RECOMMENDATION = "recommendation"
```

### 5. `urls.py`

```python
# backend/establishments/urls.py (adicionar)
path("recommendations/", RecommendationsView.as_view()),
```

### 6. Frontend — `RecommendationCard.tsx`

```tsx
// frontend/src/components/RecommendationCard.tsx
interface Props {
  establishment: Recommendation;
}

export function RecommendationCard({ establishment }: Props) {
  return (
    <Link to={`/e/${establishment.username}`}>
      <div className="w-40 rounded-xl border bg-card p-3 space-y-2 flex-shrink-0">
        <div className="h-20 rounded-lg bg-muted flex items-center justify-center">
          <Store className="h-8 w-8 text-muted-foreground" />
        </div>
        <Badge variant="outline" className="text-xs">{establishment.category}</Badge>
        <p className="font-medium text-sm line-clamp-2">{establishment.business_name}</p>
      </div>
    </Link>
  );
}
```

### 7. `FeedPage.tsx` — seção "Recomendados para você"

```tsx
// frontend/src/routes/FeedPage.tsx
const { data: recommendations } = useQuery({
  queryKey: ["recommendations"],
  queryFn: socialApi.getRecommendations,
  staleTime: 10 * 60 * 1000, // revalidar a cada 10 min
});

// No topo do feed (antes dos cards orgânicos):
{recommendations && recommendations.length > 0 && (
  <div className="space-y-3">
    <h2 className="font-medium px-4">{t("feed.recommendations_title")}</h2>
    <ScrollArea className="w-full">
      <div className="flex gap-3 px-4 pb-2">
        {recommendations.map((r) => (
          <RecommendationCard key={r.public_id} establishment={r} />
        ))}
      </div>
    </ScrollArea>
  </div>
)}
```

### 8. `api/social.ts` — adicionar `getRecommendations`

```typescript
// frontend/src/api/social.ts
export const socialApi = {
  // ... existente ...
  getRecommendations: () =>
    api.get<Recommendation[]>("/api/recommendations/"),
};
```

### 9. Traduções i18n (pt-BR)

```json
"feed.recommendations_title": "Baseado nos seus lugares favoritos",
"notification.recommendation.title": "Novo lugar pra você explorar"
```

---

## O que este feature não inclui (YAGNI)

- Filtrar recomendações já visitadas pelo usuário
- Machine learning / collaborative filtering
- Recomendação por proximidade geográfica
- "Não me mostre mais este" (dismiss de recomendação)
- Recomendações de places de outros usuários (não estabelecimentos)

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
1. Usuário com 5 places visitados na categoria "japonês"
2. `GET /api/recommendations/` → retorna estabelecimentos com `category=japonês`
3. Usuário sem histórico → retorna estabelecimentos mais recentes
4. Rodar `send_recommendation_notifications` → notificação gerada para usuários com visitas
5. Frontend: seção horizontal aparece acima do feed com cards clicáveis
