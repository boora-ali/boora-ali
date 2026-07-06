# Feedback / Bug Report — Design Spec

**Data:** 2026-07-06

## Contexto

O Boora Ali já tem login, registro e landing page com footer compartilhado, além de integração com Resend para envio de e-mails.

O novo fluxo precisa permitir que qualquer pessoa envie um alerta curto para o dono do projeto, classificado como:

- `sugestão`
- `bug`

O acionamento deve existir em:

- footer do login
- footer do registro
- footer da landing page

O envio precisa:

- persistir no backend
- disparar e-mail para `samuelviana.dev@gmail.com`
- ter rate limit / throttle contra abuso

## Objetivo

Criar um fluxo simples de feedback que sirva como canal direto para alertas operacionais e sugestões de produto, sem virar um sistema genérico de suporte.

## Não objetivos

- Não criar um centro de suporte com fila, status ou resposta pública.
- Não criar anexos, upload de imagem ou múltiplos destinatários.
- Não criar um sistema genérico de tickets.
- Não depender de Cloudflare para proteger esse fluxo.

## Decisões de design

| # | Área | Decisão |
|---|------|---------|
| 1 | UI | Um botão único abre um modal único de feedback. |
| 2 | Tipos | Só dois tipos: `sugestão` e `bug`. |
| 3 | Backend | Novo model `FeedbackMessage` para persistência. |
| 4 | API | Novo `POST /api/feedback/` público. |
| 5 | Email | Envio via Resend para `samuelviana.dev@gmail.com`. |
| 6 | Abuso | Throttle dedicado no backend para esse endpoint. |
| 7 | Falha de e-mail | Persistir mesmo se o envio falhar; logar o erro. |

## Arquitetura

### Frontend

Criar um componente de ação reutilizável no footer com um botão:

- texto sugerido: `Sugestões / Relatar bug`
- comportamento: abre modal

O modal deve conter:

- seletor de tipo
- campo de mensagem
- botão de envio

Comportamento mínimo:

- validar mensagem vazia
- travar envio duplicado enquanto a request está em andamento
- mostrar sucesso e fechar o modal quando a API responder `201`
- mostrar erro inline quando a API falhar

O botão deve ser reaproveitado em:

- `Footer` compartilhado do login/register
- footer da landing page

### Backend

Criar um app ou módulo pequeno para feedback com foco só nesse caso de uso.

O model deve guardar apenas o necessário:

- tipo da mensagem
- texto da mensagem
- usuário relacionado, se houver login
- URL da página de origem, se disponível
- data de criação

O endpoint deve:

- aceitar usuários anônimos
- validar o tipo da mensagem
- validar o tamanho do texto
- salvar no banco primeiro
- enviar e-mail em seguida

Se o e-mail falhar:

- o request continua bem-sucedido
- o erro fica no log
- o registro permanece salvo

### E-mail

O e-mail precisa ser curto e operacional:

- assunto com o tipo, por exemplo `Novo bug — Boora Ali`
- corpo com a mensagem
- incluir `username` e `email` quando o usuário estiver autenticado
- incluir URL da página de origem quando disponível

O destinatário deve vir de configuração, não de código espalhado no frontend.

Sugestão de configuração:

- `FEEDBACK_EMAIL_TO=samuelviana.dev@gmail.com`

## API

### `POST /api/feedback/`

Payload mínimo:

- `kind`
- `message`
- `page_url` opcional

Regras:

- `kind` aceita apenas `suggestion` e `bug`
- `message` é obrigatório
- `page_url` é opcional e pode ser preenchido pelo frontend com `window.location.href`

Respostas:

- `201 Created` quando salvar e disparar o e-mail
- `400 Bad Request` para validação
- `429 Too Many Requests` quando bater o limite

## Rate limit e throttle

Criar um throttle próprio para feedback, separado do throttle de auth.

Proposta:

- scope: `feedback`
- taxa: baixa o bastante para bloquear spam, mas não a ponto de atrapalhar uso humano normal

O limite exato pode ser ajustado depois, mas precisa existir desde a primeira versão.

## Integração com o frontend

O modal deve usar o mesmo padrão de formulário já existente no projeto:

- React Hook Form
- Zod
- tratamento de erro da API com a mesma convenção usada nas telas de auth

O botão deve aparecer sem depender do estado de login.

## Critérios de aceite

1. Um visitante consegue abrir o modal em login, registro e landing page.
2. O envio com `sugestão` cria um registro no banco.
3. O envio com `bug` cria um registro no banco.
4. O e-mail chega em `samuelviana.dev@gmail.com`.
5. A request não quebra se o Resend falhar.
6. Um cliente abusivo recebe `429` pelo throttle.
7. O texto do botão e do modal deixa claro que é para sugestões e bugs, não para suporte geral.

## Testes esperados

### Backend

- cria feedback válido com sucesso
- rejeita `kind` inválido
- rejeita mensagem vazia
- aplica throttle
- persiste mesmo quando o envio de e-mail falha

### Frontend

- botão aparece no footer compartilhado
- botão aparece na landing
- modal abre e fecha corretamente
- submit de sucesso mostra feedback visual
- erro de API é exibido sem quebrar a página

## Observações

- Esse fluxo deve ficar pequeno de propósito.
- Se depois houver necessidade de anexos, triagem ou fila, isso vira outro projeto.
