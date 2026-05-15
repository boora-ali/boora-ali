# Feat — Tipo de Conta (Person vs Establishment)

## Problema

Todo usuário é tratado como pessoa física — não há distinção entre um usuário pessoal
e um estabelecimento (restaurante, café, etc.). Sem essa distinção, não é possível
oferecer funcionalidades específicas para negócios como perfil público comercial,
cardápio e promoção paga no feed.

---

## Objetivo

1. Campo `account_type` no cadastro: `PERSON` (default) | `ESTABLISHMENT`
2. Usuário tipo `ESTABLISHMENT` é redirecionado para dashboard separado após login
3. Dashboard protegido por guard — usuários `PERSON` não acessam `/dashboard`
4. Base necessária para todos os outros specs de estabelecimento

---

## Skills a invocar antes de implementar

Backend:
- `/django-expert` — choices enum, serializer, migrations
- `/bora-ali-backend` — UserProfile, RegisterView, convenções do projeto

Frontend:
- `/bora-ali-frontend` — React Query, roteamento, PrivateRoute
- `/frontend-design` — RadioGroup, Card (shadcn/ui)

> **Dependências**: nenhuma. Bloqueia `feat-estabelecimento-perfil.md`,
> `feat-estabelecimento-pagamento.md`.

---

## Arquivos que serão mexidos

| Arquivo | O que muda |
|---------|-----------|
| `backend/accounts/models.py` | Adicionar `account_type` em `UserProfile` |
| `backend/accounts/serializers.py` | Expor `account_type` em register e me |
| `backend/accounts/migrations/` | `makemigrations accounts` |
| `frontend/src/routes/RegisterPage.tsx` | Adicionar seleção de tipo de conta |
| `frontend/src/routes/LoginPage.tsx` | Após login, redirecionar por `account_type` |
| `frontend/src/routes/Dashboard.tsx` | Dashboard vazio para estabelecimento (nova rota) |
| `frontend/src/App.tsx` | Registrar `/dashboard` com guard `EstablishmentRoute` |
| `frontend/src/contexts/AuthContext.tsx` | Expor `account_type` no contexto de auth |

---

## Implementação passo a passo

### 1. `models.py` — `account_type` em `UserProfile`

```python
# backend/accounts/models.py
class AccountType(models.TextChoices):
    PERSON = "person", "Pessoa"
    ESTABLISHMENT = "establishment", "Estabelecimento"


class UserProfile(models.Model):
    # ... campos existentes ...
    account_type = models.CharField(
        max_length=20,
        choices=AccountType.choices,
        default=AccountType.PERSON,
        db_index=True,
    )
```

> Rodar `python manage.py makemigrations accounts` após editar o model.

### 2. `serializers.py` — expor `account_type`

```python
# backend/accounts/serializers.py

class RegisterSerializer(serializers.ModelSerializer):
    account_type = serializers.ChoiceField(
        choices=AccountType.choices, default=AccountType.PERSON, write_only=False
    )

    def create(self, validated_data):
        account_type = validated_data.pop("account_type", AccountType.PERSON)
        user = super().create(validated_data)
        user.profile.account_type = account_type
        user.profile.save(update_fields=["account_type"])
        return user


class MeSerializer(serializers.ModelSerializer):
    account_type = serializers.CharField(source="profile.account_type", read_only=True)

    class Meta:
        # incluir account_type nos campos
        ...
```

### 3. Frontend — seleção no `RegisterPage.tsx`

```tsx
// frontend/src/routes/RegisterPage.tsx
<div className="space-y-2">
  <p className="text-sm font-medium">{t("register.account_type")}</p>
  <div className="grid grid-cols-2 gap-3">
    {[
      { value: "person", label: t("register.person"), icon: User },
      { value: "establishment", label: t("register.establishment"), icon: Store },
    ].map(({ value, label, icon: Icon }) => (
      <label key={value}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer",
          watch("account_type") === value && "border-primary bg-primary/5"
        )}>
        <input type="radio" value={value} {...register("account_type")} className="sr-only" />
        <Icon className="h-6 w-6" />
        <span className="text-sm font-medium">{label}</span>
      </label>
    ))}
  </div>
</div>
```

### 4. Frontend — redirect pós-login por `account_type`

```tsx
// frontend/src/routes/LoginPage.tsx
const { user } = useAuth();

useEffect(() => {
  if (!user) return;
  if (user.account_type === "establishment") {
    navigate("/dashboard");
  } else {
    navigate(searchParams.get("next") ?? "/");
  }
}, [user]);
```

### 5. Frontend — `EstablishmentRoute` guard

```tsx
// frontend/src/components/EstablishmentRoute.tsx
export function EstablishmentRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.account_type !== "establishment") return <Navigate to="/" />;
  return <>{children}</>;
}
```

```tsx
// frontend/src/App.tsx
<Route path="/dashboard/*" element={
  <EstablishmentRoute>
    <Dashboard />
  </EstablishmentRoute>
} />
```

### 6. Frontend — `Dashboard.tsx` (esqueleto inicial)

```tsx
// frontend/src/routes/Dashboard.tsx
export function Dashboard() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r p-4 space-y-2">
        <NavLink to="/dashboard/profile">{t("dashboard.profile")}</NavLink>
        <NavLink to="/dashboard/menu">{t("dashboard.menu")}</NavLink>
        <NavLink to="/dashboard/promotions">{t("dashboard.promotions")}</NavLink>
      </aside>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

### 7. Traduções i18n (pt-BR)

```json
"register.account_type": "Você é:",
"register.person": "Pessoa",
"register.establishment": "Estabelecimento",
"dashboard.profile": "Perfil",
"dashboard.menu": "Cardápio",
"dashboard.promotions": "Promoções"
```

---

## O que este feature não inclui (YAGNI)

- Troca de `account_type` após cadastro
- Onboarding guiado para estabelecimentos (pode vir depois)
- Múltiplos usuários administrando o mesmo estabelecimento

---

## Verificação

```bash
scripts/dev-check.sh backend
scripts/dev-check.sh frontend
```

Teste manual:
1. `POST /api/auth/register/` com `account_type=establishment` → perfil criado com tipo correto
2. `GET /api/auth/me/` → retorna `account_type`
3. Login como estabelecimento → redireciona para `/dashboard`
4. Login como pessoa → acessa `/dashboard` → redireciona para `/`
