# Feat — Pagamento de Promoção (Abacate Pay + PIX)

## Problema

Estabelecimentos precisam pagar para se promover no feed. Não há integração com
gateway de pagamento, nem modelo para registrar campanhas e seus estados de pagamento.
O fluxo precisa ser confiável: PIX gerado → confirmação por webhook → campanha ativa.

---

## Objetivo

1. Estabelecimento escolhe um plano (R$50/5 dias ou R$100/1 mês) e recebe QR code PIX
2. Abacate Pay notifica via webhook ao confirmar o pagamento
3. Backend valida a assinatura do webhook e ativa a campanha
4. Task Celery expira campanhas quando `ends_at < now`

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — APIView, Celery tasks, signals, webhook idempotência
- `/bora-ali-backend` — MutationMixin, PublicIdModel, estrutura de tasks.py

> **Dependências**: `feat-tipo-conta.md` + `feat-estabelecimento-perfil.md`
> (obrigatórios — `EstablishmentProfile` precisa existir).
>
> **Variáveis de ambiente novas**:
> ```
> ABACATE_PAY_API_KEY
> ABACATE_PAY_WEBHOOK_SECRET
> ```

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/establishments/models.py` | Adicionar `PromotionPlan`, `PromotionCampaign`, `Payment` |
| `backend/establishments/serializers.py` | `PromotionPlanSerializer`, `PromotionCampaignSerializer` |
| `backend/establishments/views.py` | `PromotionPlanView`, `PromotionCampaignView`, `AbacatePayWebhookView` |
| `backend/establishments/tasks.py` | `expire_promotion_campaigns` |
| `backend/establishments/services.py` | `AbacatePayService` (wrapper da API) |
| `backend/establishments/urls.py` | Registrar rotas de planos, campanhas e webhook |
| `backend/establishments/migrations/` | `makemigrations establishments` |
| `backend/config/settings.py` | Adicionar `ABACATE_PAY_API_KEY`, `ABACATE_PAY_WEBHOOK_SECRET` |
| `frontend/src/services/promotions.service.ts` | `getPlans()`, `createCampaign()`, `getCampaign()` |
| `frontend/src/routes/dashboard/PromotionsPage.tsx` | Tela de campanhas + QR code PIX |

---

## Implementação passo a passo

### 1. `settings.py` — variáveis Abacate Pay

```python
# backend/config/settings.py
ABACATE_PAY_API_KEY = os.getenv("ABACATE_PAY_API_KEY", "")
ABACATE_PAY_WEBHOOK_SECRET = os.getenv("ABACATE_PAY_WEBHOOK_SECRET", "")
ABACATE_PAY_BASE_URL = "https://api.abacatepay.com/v1"
```

### 2. `models.py` — planos, campanhas e pagamentos

```python
# backend/establishments/models.py

class PromotionPlan(models.Model):
    name = models.CharField(max_length=50)          # "5 dias" | "1 mês"
    duration_days = models.PositiveIntegerField()   # 5 | 30
    price_brl = models.DecimalField(max_digits=8, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "establishments_promotion_plan"


class CampaignStatus(models.TextChoices):
    PENDING_PAYMENT = "pending_payment", "Aguardando pagamento"
    ACTIVE = "active", "Ativa"
    EXPIRED = "expired", "Expirada"
    CANCELLED = "cancelled", "Cancelada"


class PromotionCampaign(PublicIdModel):
    establishment = models.ForeignKey(
        EstablishmentProfile, on_delete=models.CASCADE, related_name="campaigns"
    )
    plan = models.ForeignKey(PromotionPlan, on_delete=models.PROTECT)
    status = models.CharField(
        max_length=20, choices=CampaignStatus.choices,
        default=CampaignStatus.PENDING_PAYMENT, db_index=True
    )
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "establishments_promotion_campaign"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "Pendente"
    PAID = "paid", "Pago"
    EXPIRED = "expired", "Expirado"
    REFUNDED = "refunded", "Reembolsado"


class Payment(PublicIdModel):
    campaign = models.OneToOneField(
        PromotionCampaign, on_delete=models.CASCADE, related_name="payment"
    )
    amount_brl = models.DecimalField(max_digits=8, decimal_places=2)
    gateway = models.CharField(max_length=30, default="abacate_pay")
    gateway_id = models.CharField(max_length=200, unique=True, db_index=True)
    pix_qr_code = models.TextField(blank=True, default="")      # base64 ou URL
    pix_copy_paste = models.TextField(blank=True, default="")   # copia-e-cola
    pix_expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING, db_index=True
    )
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "establishments_payment"
```

> Rodar `python manage.py makemigrations establishments`.

### 3. `services.py` — wrapper Abacate Pay

```python
# backend/establishments/services.py
import hmac
import hashlib
import requests
from django.conf import settings


class AbacatePayService:
    BASE_URL = settings.ABACATE_PAY_BASE_URL

    @classmethod
    def _headers(cls):
        return {
            "Authorization": f"Bearer {settings.ABACATE_PAY_API_KEY}",
            "Content-Type": "application/json",
        }

    @classmethod
    def create_pix_charge(cls, amount_brl: float, external_id: str,
                          description: str, expires_in: int = 1800) -> dict:
        """Cria cobrança PIX. Retorna {id, qr_code, copy_paste, expires_at}."""
        response = requests.post(
            f"{cls.BASE_URL}/billing/create",
            json={
                "amount": int(amount_brl * 100),  # centavos
                "externalId": external_id,
                "description": description,
                "expiresIn": expires_in,
                "methods": ["PIX"],
            },
            headers=cls._headers(),
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

    @classmethod
    def validate_webhook_signature(cls, payload: bytes, signature: str) -> bool:
        expected = hmac.new(
            settings.ABACATE_PAY_WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)
```

### 4. `views.py` — endpoints de promoção e webhook

```python
# backend/establishments/views.py
from django.utils import timezone
from datetime import timedelta
from .services import AbacatePayService


class PromotionPlanView(APIView):
    permission_classes = []

    def get(self, request):
        plans = PromotionPlan.objects.filter(is_active=True)
        return Response(PromotionPlanSerializer(plans, many=True).data)


class PromotionCampaignView(MutationMixin, APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        campaigns = PromotionCampaign.objects.filter(
            establishment__user=request.user
        ).select_related("plan", "payment").order_by("-created_at")
        return Response(PromotionCampaignSerializer(campaigns, many=True).data)

    def post(self, request):
        plan = get_object_or_404(PromotionPlan, pk=request.data.get("plan_id"), is_active=True)
        profile = get_object_or_404(EstablishmentProfile, user=request.user)

        campaign = PromotionCampaign.objects.create(establishment=profile, plan=plan)

        pix_data = AbacatePayService.create_pix_charge(
            amount_brl=float(plan.price_brl),
            external_id=str(campaign.public_id),
            description=f"Promoção Bora Ali — {plan.name}",
        )

        Payment.objects.create(
            campaign=campaign,
            amount_brl=plan.price_brl,
            gateway_id=pix_data["id"],
            pix_qr_code=pix_data.get("qrCode", ""),
            pix_copy_paste=pix_data.get("copyPaste", ""),
            pix_expires_at=pix_data.get("expiresAt"),
        )

        return Response(PromotionCampaignSerializer(campaign).data, status=201)


class AbacatePayWebhookView(MutationMixin, APIView):
    permission_classes = []

    def post(self, request):
        signature = request.headers.get("X-Abacate-Signature", "")
        if not AbacatePayService.validate_webhook_signature(request.body, signature):
            return Response(status=400)

        event = request.data.get("event")
        if event != "billing.paid":
            return Response(status=200)  # ignorar outros eventos

        gateway_id = request.data.get("billing", {}).get("id")
        payment = Payment.objects.filter(gateway_id=gateway_id).first()
        if not payment or payment.status == PaymentStatus.PAID:
            return Response(status=200)  # idempotência

        now = timezone.now()
        payment.status = PaymentStatus.PAID
        payment.paid_at = now
        payment.save(update_fields=["status", "paid_at"])

        campaign = payment.campaign
        campaign.status = CampaignStatus.ACTIVE
        campaign.starts_at = now
        campaign.ends_at = now + timedelta(days=campaign.plan.duration_days)
        campaign.save(update_fields=["status", "starts_at", "ends_at"])

        return Response(status=200)
```

### 5. `tasks.py` — expirar campanhas

```python
# backend/establishments/tasks.py
from celery import shared_task
from django.utils import timezone
import logging

_log = logging.getLogger("establishments.tasks")


@shared_task
def expire_promotion_campaigns():
    """Expira campanhas cujo ends_at passou."""
    from .models import PromotionCampaign, CampaignStatus

    expired = PromotionCampaign.objects.filter(
        status=CampaignStatus.ACTIVE,
        ends_at__lt=timezone.now(),
    )
    count = expired.update(status=CampaignStatus.EXPIRED)
    _log.info("expire_promotion_campaigns: %d campanhas expiradas", count)
    return {"expired": count}
```

**Agendar via admin**: crontab `0 * * * *` (1x/hora).

### 6. `urls.py`

```python
# backend/establishments/urls.py (adicionar)
path("establishment/plans/", PromotionPlanView.as_view()),
path("establishment/campaigns/", PromotionCampaignView.as_view()),
path("establishment/webhooks/abacate-pay/", AbacatePayWebhookView.as_view()),
```

### 7. Frontend — `PromotionsPage.tsx`

```tsx
// frontend/src/routes/dashboard/PromotionsPage.tsx
export function PromotionsPage() {
  const { data: plans } = useQuery({ queryKey: ["plans"], queryFn: promotionsService.getPlans });
  const { data: campaigns } = useQuery({ queryKey: ["campaigns"], queryFn: promotionsService.getCampaigns });
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  const createCampaign = useMutation({
    mutationFn: (planId: number) => promotionsService.createCampaign(planId),
    onSuccess: (campaign) => setActiveCampaign(campaign),
  });

  // Polling a cada 5s enquanto há campanha PENDING_PAYMENT
  useQuery({
    queryKey: ["campaign", activeCampaign?.public_id],
    queryFn: () => promotionsService.getCampaign(activeCampaign!.public_id),
    enabled: activeCampaign?.status === "pending_payment",
    refetchInterval: 5000,
    onSuccess: (data) => {
      if (data.status === "active") {
        setActiveCampaign(null);
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      }
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{t("promotions.title")}</h1>

      {/* Campanha ativa */}
      {campaigns?.find((c) => c.status === "active") && (
        <ActiveCampaignCard campaign={campaigns.find((c) => c.status === "active")!} />
      )}

      {/* QR Code PIX pendente */}
      {activeCampaign?.status === "pending_payment" && (
        <PixPaymentCard campaign={activeCampaign} />
      )}

      {/* Seleção de plano */}
      {!activeCampaign && (
        <div className="grid grid-cols-2 gap-4">
          {plans?.map((plan) => (
            <PlanCard key={plan.id} plan={plan}
              onSelect={() => createCampaign.mutate(plan.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 8. Traduções i18n (pt-BR)

```json
"promotions.title": "Promoções",
"promotions.active_until": "Ativa até {{date}}",
"promotions.scan_qr": "Escaneie o QR code para pagar",
"promotions.or_copy": "ou copie o código PIX",
"promotions.waiting_payment": "Aguardando confirmação do pagamento...",
"promotions.plan_5days": "5 dias — R$ 50",
"promotions.plan_1month": "1 mês — R$ 100"
```

---

## O que este feature não inclui (YAGNI)

- Cartão de crédito / assinatura recorrente
- Reembolso automatizado
- Nota fiscal / recibo formal
- Múltiplas campanhas simultâneas (MVP: 1 por vez)
- Dashboard de métricas de impressões

---

## Verificação

```bash
scripts/dev-check.sh backend
```

Teste manual:
1. `GET /api/establishment/plans/` → retorna 2 planos
2. `POST /api/establishment/campaigns/` com `plan_id` → cria campanha + QR code PIX
3. Simular webhook `billing.paid` com assinatura válida → campanha muda para ACTIVE
4. Simular webhook com assinatura inválida → 400
5. Rodar `expire_promotion_campaigns` com `ends_at` no passado → status EXPIRED
