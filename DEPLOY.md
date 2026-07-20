# Deploy — Neon + Vercel

O Study OS sobe como um app Next.js na **Vercel** com **Neon** (Postgres
serverless). O mesmo Postgres roda do dev à produção, então não há migração de
banco quando você escala — você só troca as connection strings.

As partes delicadas são a **configuração de RLS com dois roles** e o uso do
endpoint **pooled** do Neon em runtime. Siga a ordem abaixo.

---

## 0. Pré-requisitos

- Uma conta [Neon](https://neon.tech) (o free tier basta de sobra pra uso solo).
- Uma conta [Vercel](https://vercel.com), com este repo no GitHub.
- Um GitHub OAuth App (passo 3).

---

## 1. Neon — criar o banco

1. Crie um projeto no Neon. Escolha a **região mais próxima da região da Vercel**
   (a latência entre a function e o banco domina o tempo de resposta).
2. No dashboard do Neon, pegue as **duas** formas da connection string:
   - **Direta** (host sem `-pooler`) — usada nas migrações e na criação do role.
   - **Pooled** (host com `-pooler`, PgBouncer) — usada pelo app em execução.

---

## 2. Migrações + RLS (rode uma vez, da sua máquina)

O RLS precisa de um segundo role, restrito. Rode isto localmente apontando pro Neon.

```bash
# Use a connection DIRETA (não-pooled) do owner para DDL + criação do role.
export DATABASE_URL="postgresql://<owner>:<senha>@<host>.neon.tech/<db>?sslmode=require"
export APP_DB_PASSWORD="<uma senha forte para o role restrito>"

npm run db:migrate   # cria as tabelas
npm run db:rls       # cria o role studyos_app + as policies owner_isolation
```


O `db:rls` cria o role de login `studyos_app` com `APP_DB_PASSWORD` e habilita RLS
em toda tabela de tenant. O app então conecta como esse role, nunca como o owner.

> **Não** faça seed em produção (`db:seed` é para dados de demonstração locais).
> A linha em `users` de cada usuário é criada automaticamente no primeiro login
> pelo GitHub.

---

## 3. GitHub OAuth App

Crie um em <https://github.com/settings/developers> → **New OAuth App**:

- **Homepage URL:** `https://<seu-domínio>`
- **Authorization callback URL:** `https://<seu-domínio>/api/auth/callback/github`

Copie o **Client ID** e gere um **Client Secret**.

---

## 4. Vercel — importar + variáveis de ambiente

Importe o repo do GitHub na Vercel (o framework Next.js é detectado
automaticamente). Ajuste a **região da function para casar com a região do
Neon**. Adicione estas variáveis de ambiente:

| Variável             | Valor                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `APP_DATABASE_URL`   | role restrito `studyos_app`, endpoint **POOLED** (`-pooler`)      |
| `DATABASE_URL`       | role owner, endpoint **POOLED** (usado em runtime — veja §6)       |
| `AUTH_SECRET`        | gere com `npx auth secret` (um valor novo e forte)                |
| `AUTH_GITHUB_ID`     | do OAuth App                                                       |
| `AUTH_GITHUB_SECRET` | do OAuth App                                                       |
| `ANTHROPIC_API_KEY`  | sua chave da API do Claude                                         |
| `AI_MOCK`            | `false`                                                            |

Observações:

- **`AUTH_DEV_BYPASS` não é necessário** — ele é travado por
  `NODE_ENV !== "production"`, então nunca consegue burlar a autenticação num
  deploy de produção na Vercel.
- O runtime usa endpoints **pooled** para as duas URLs (`prepare: false` já está
  setado em `src/infra/db/client.ts` por compatibilidade com o pooler). As
  migrações do §2 usam o endpoint **direto** porque comandos de DDL/role não
  devem passar pelo pooler.
- `trustHost: true` está setado em `src/auth.ts`, então o Auth.js confia no host
  da Vercel — não precisa de `AUTH_URL`.

Faça o deploy. No primeiro acesso, entre com o GitHub; sua linha em `users` é
criada nesse momento.

---

## 5. Checklist pós-deploy

- [ ] Login com GitHub funciona (cria seu usuário).
- [ ] Dashboard, objetivos, agenda, certificações e currículo carregam.
- [ ] Criar um objetivo/tópico e registrar uma sessão — os dados persistem.
- [ ] Publicar um currículo → `/r/<slug>` abre; despublicar → 404.
- [ ] Sem `AUTH_DEV_BYPASS` no ambiente de produção (confirme que o login real é exigido).

---

## 6. Notas de segurança (hardening opcional)

- **Superuser em runtime:** o resolver do currículo público
  (`resolvePublicResume`) usa o `adminDb` (conexão do owner) para uma única
  leitura estritamente filtrada (`is_public = true`). É por isso que o
  `DATABASE_URL` está presente em runtime. Para reforçar, crie um terceiro role
  que só possa dar `SELECT` nas linhas de currículo publicadas e aponte esse
  resolver para ele. Não é obrigatório num deploy pessoal.
- **Limites de conexão:** cada instância serverless abre seu próprio pool
  pequeno (`max: 10`/`4`) contra o pooler do Neon, que multiplexa para bem menos
  conexões reais no Postgres. Suficiente para tráfego baixo; aumente o plano do
  Neon se escalar.
- **Região:** mantenha as functions da Vercel e o Neon na mesma região.
