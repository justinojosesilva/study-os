# Study OS

Plataforma de gestão de estudos técnicos. Objetivos viram tópicos, tópicos viram
sessões de estudo, e o que se acumula alimenta revisão espaçada, provas geradas
por IA e um currículo que se escreve sozinho.

Projeto pessoal, em uso diário desde julho de 2026. Construído single-user, mas
modelado multi-tenant desde a primeira migração — a diferença entre as duas
coisas é uma variável de ambiente, não uma reescrita.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 ·
Drizzle ORM · PostgreSQL 17 · Auth.js · Anthropic SDK

---

## O que ele faz

| Área | |
|---|---|
| **Estudo** | Objetivos com tópicos ponderados, sessões com timer Pomodoro e som ambiente, agenda semanal gerada a partir da sua disponibilidade |
| **Revisão** | Repetição espaçada com FSRS (`ts-fsrs`), flashcards gerados por IA a partir dos seus tópicos |
| **Avaliação** | Questionários e provas geradas por IA; o status "dominado" de um tópico é **conquistado na prova**, não marcado à mão |
| **Conteúdo** | Aulas em Markdown com sumário, diagramas Mermaid, progresso de leitura e anotações ancoradas em trechos |
| **Anotações** | Busca full-text em português com `unaccent` — `configuracao` encontra `configuração` |
| **Carreira** | Currículo derivado dos dados reais + importação do seu CV em PDF e de projetos do GitHub |

---

## As decisões que valem discutir

Um CRUD não precisa de README. Estas são as escolhas que moldaram o resto.

### `study_sessions` é um log imutável de eventos

Nenhuma linha registra "total de horas". Horas, sequência de dias, heatmap e
progresso são **sempre agregados na leitura** ([`domain/metrics.ts`](src/domain/metrics.ts)).
Um contador acumulado seria mais rápido e ficaria errado no primeiro `UPDATE`
concorrente ou no primeiro backfill; o log não tem como divergir de si mesmo.

### Progresso de objetivo é derivado, nunca armazenado

É a fração ponderada de tópicos dominados, calculada na hora. Não existe coluna
`progress` para dessincronizar quando um tópico muda de status.

### Isolamento por tenant no banco, não na aplicação

Toda tabela tem `owner_id`, e o Postgres é quem garante:

```sql
CREATE POLICY owner_isolation ON goals
  USING (owner_id = current_setting('app.owner_id', true)::uuid)
  WITH CHECK (owner_id = current_setting('app.owner_id', true)::uuid);
```

O app roda como um papel **restrito** (sem `BYPASSRLS`). Cada requisição abre uma
transação, define o GUC `app.owner_id` — transaction-local, seguro com pooler — e
guarda a transação num `AsyncLocalStorage`. O `db` exportado é um Proxy que
resolve para a transação da requisição atual, então os repositórios continuam
escrevendo `db.select()` e ganham o escopo de graça
([`infra/db/client.ts`](src/infra/db/client.ts)).

O efeito prático: **um repositório que esqueça o `where owner_id` não vaza dados**
— ele volta vazio. A regra vira default-deny em vez de disciplina.

### Uma única costura de autenticação

`getCurrentUserId()` é a única função no projeto que sabe quem é o usuário
([`domain/auth.ts`](src/domain/auth.ts)). Trocar o modo single-user por GitHub
OAuth mexeu só nela; nada abaixo mudou.

### Camada de domínio livre de framework

```
src/
  infra/db/     schema.ts (fonte da verdade), client.ts (conexão + RLS)
  domain/       regra de negócio sem Next, sem React
    ai/         11 módulos de IA — cada um lê dados reais e devolve Zod validado
    */repository.ts
  app/          rotas; Server Actions são FINAS e chamam domain/
```

Limite lógico, não de serviço. Extrair para um serviço separado só quando houver
motivo concreto — que ainda não houve.

### IA sobre dados reais, com saída tipada

Os 11 módulos em [`domain/ai/`](src/domain/ai) seguem o mesmo formato: leem o que
o usuário realmente acumulou, chamam o modelo **fora** de qualquer transação, e
devolvem estrutura validada por Zod (`output_config` + `zodOutputFormat`). Sem
API key, caem em modo mock — o app funciona inteiro sem nunca chamar a API.

Duas regras que valem mais que o prompt:

- **Nada é gravado sem revisão humana.** A importação de currículo lê o PDF,
  mostra o que entendeu e só grava depois que você confirma. IA lê data errada
  com confiança total, e um currículo errado é pior que um vazio.
- **Estudo não é experiência.** O gerador de currículo recebe carreira e estudo
  como categorias separadas, com a instrução explícita de nunca derivar
  senioridade de horas de estudo.

---

## Rodando localmente

Requer Node 20+, Docker e uma chave da Anthropic (opcional — sem ela o app roda
em modo mock).

```bash
cp .env.example .env
npm install
npm run db:up        # PostgreSQL 17 via Docker, porta 5435
npm run db:migrate
npm run db:seed      # imprime o DEV_OWNER_ID para colar no .env
npm run dev
```

Para exercitar o RLS localmente, `npm run db:rls` cria o papel restrito
`studyos_app`; aponte `APP_DATABASE_URL` para ele. Sem isso o app conecta como
owner e as políticas não se aplicam.

<details>
<summary>Demais comandos</summary>

| | |
|---|---|
| `npm run db:generate` | gera a migração SQL a partir do schema |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:down` | derruba o Postgres |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | checagem de tipos |

</details>

---

## Estado do projeto

17 tabelas, 21 migrações, ~21 mil linhas de TypeScript. Em produção na Vercel com
Neon, usado diariamente por uma pessoa — eu.

**Fora do escopo por decisão, não por falta de tempo:** geração de aulas dentro
do app (uma aula tem ~36 mil tokens de saída e leva minutos — precisa de Batch
API e fila, e isso só se paga quando houver um segundo usuário), billing e
multi-tenant de verdade.

O que existe aqui foi construído medindo antes de decidir. Vários commits
registram o número que derrubou o desenho anterior — é a parte do histórico que
vale ler.

---

## Licença

Sem licença definida. Código aberto para leitura, não para reuso.
