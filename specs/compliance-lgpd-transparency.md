# LGPD - Transparência e Direitos Pendentes

## Objetivo

Fechar a parte de LGPD que ainda não está explícita no produto sem criar governança pesada:

- deixar claro quais dados o Boora Ali trata e para quê;
- listar os terceiros/operadores que recebem dados;
- mapear os direitos do titular para a ação já existente no app;
- manter o caminho de contato com o encarregado visível.

## Contexto

O núcleo já existe:

- ledger de consentimento;
- exportação JSON dos dados;
- revogação do consentimento pela conta;
- registro de consentimento no cadastro, no aceite de termos e no primeiro login Google;
- footer com contato do encarregado;
- política de privacidade básica.

O que falta é tornar isso mais explícito para o titular, sem adicionar endpoint novo nem fluxo novo de governança.

## Escopo

### Frontend

- `frontend/src/routes/PrivacyPolicyPage.tsx`
  - resumir os dados tratados por categoria;
  - listar os operadores/terceiros com a finalidade de cada um;
  - explicitar retenção e base prática de cada bloco de dado;
  - mapear os direitos do titular para as ações existentes no app.

- `frontend/src/routes/AccountPage.tsx`
  - adicionar uma área curta de "Seus direitos";
  - ligar os atalhos já existentes: editar perfil, exportar dados, excluir conta, revogar consentimento.

- `frontend/src/components/layout/Footer.tsx`
  - manter o contato do encarregado visível no rodapé.

### Texto e i18n

- `frontend/src/locales/*/translation.json`
  - adicionar as chaves para os novos textos da política e da área de direitos.

## Fora do escopo

- novos endpoints de backend;
- `.lgpd/` como store documental;
- ROPA, DPA, runbook de incidentes e artefatos de auditoria;
- formato adicional de exportação além de JSON;
- revisão de decisões automatizadas, porque o app não usa esse tipo de automação;
- pipeline de purge automático para o ledger de consentimento.

## Regras

- Reusar as telas e ações que já existem.
- Não criar abstração nova para texto estático.
- Não adicionar dependência só para exibir essa informação.
- Se uma ação legal já existe, o spec só precisa torná-la visível e compreensível.

## Verificação

- checar lint do frontend;
- checar testes das telas alteradas;
- confirmar manualmente que a política lista os terceiros e que a área da conta aponta para as ações corretas.
