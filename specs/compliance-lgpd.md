# Compliance LGPD - Core

## Objetivo

Entregar o núcleo prático de LGPD no Boora Ali sem criar camadas extras:

- guardar um ledger de consentimento;
- permitir exportação dos dados do usuário;
- permitir revogação do consentimento pela conta;
- registrar consentimento no cadastro, no aceite de termos e no primeiro login Google;
- atualizar a política de privacidade e o footer com o caminho de contato.

## Escopo

### Backend

- `backend/accounts/models.py`: adicionar `ConsentHistory`.
- `backend/accounts/serializers.py`: capturar IP e user-agent no registro.
- `backend/accounts/views.py`: `DataExportView` e `WithdrawConsentView`.
- `backend/accounts/services.py`: `build_export_payload(user)`.
- `backend/accounts/urls.py`: rotas `/api/auth/me/export/` e `/api/auth/me/withdraw-consent/`.
- `backend/accounts/tests/`: cobrir exportação, revogação e ledger de consentimento.

### Frontend

- `frontend/src/routes/AccountPage.tsx`: card "Seus dados" com exportação.
- `frontend/src/routes/PrivacyPolicyPage.tsx`: texto mínimo de bases legais, retenção e direitos.
- `frontend/src/components/layout/Footer.tsx`: link de contato/encarregado.
- `frontend/src/services/auth.service.ts`: `exportData()` e `withdrawConsent()`.
- `frontend/src/locales/*/translation.json`: chaves de i18n.

## Fora do escopo

- `.lgpd/` como store documental.
- ROPA, DPA, runbook de incidentes e artefatos de governança.
- purge de histórico órfão.
- audit log imutável.

## Regras

- Reusar os padrões já existentes no repo.
- Manter a solução pequena.
- Não adicionar abstrações novas se um método simples resolver.

