import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const goalCategory = pgEnum("goal_category", [
  "faculdade",
  "profissional",
  "certificacao",
]);

export const goalStatus = pgEnum("goal_status", [
  "active",
  "paused",
  "done",
  "archived",
]);

// Reading vs. doing. Kept as an enum because the app reasons about the two
// differently; the filename convention ("aula-01", "lab-01") only looked like
// data.
export const lessonKind = pgEnum("lesson_kind", ["aula", "lab"]);

// The path a topic walks: read it, practise it, then prove it. `praticando`
// sits between studying and mastery because doing the exercises is real
// progress — and `mastered` is earned by passing, not declared.
export const topicStatus = pgEnum("topic_status", [
  "todo",
  "learning",
  "praticando",
  "mastered",
]);

export const materialType = pgEnum("material_type", [
  "book",
  "pdf",
  "video",
  "course",
  "article",
  "link",
]);

export const certificationStatus = pgEnum("certification_status", [
  "planned", // on the radar, no exam booked
  "scheduled", // exam booked (exam_date set)
  "passed", // obtained
  "failed", // attempted, didn't pass
  "expired", // was obtained, now lapsed
]);

// ---------------------------------------------------------------------------
// users — identity. Single-user today; the seam for real auth (Auth.js) later.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  weeklyGoalHours: integer("weekly_goal_hours").notNull().default(10),
  // Minutes available to study per weekday, indexed 0=Sun..6=Sat. null = not
  // set → the scheduler derives an even spread from weeklyGoalHours. No RLS
  // (users is the identity table), so this stays a plain column here.
  availability: jsonb("availability").$type<number[]>(),
  /**
   * Teto de gasto de IA desta pessoa, em milionésimos de dólar. NULL = usa o
   * padrão de `AI_DAILY_LIMIT_MICROS` / `AI_MONTHLY_LIMIT_MICROS`.
   *
   * Existe porque o teto por variável de ambiente é GLOBAL: convidar alguém
   * significava dar a essa pessoa o mesmo limite do dono, na fatura do dono.
   * Nulo por padrão de propósito — o dono não precisa configurar nada, e quem
   * for convidado recebe um teto explícito.
   */
  aiDailyLimitMicros: integer("ai_daily_limit_micros"),
  aiMonthlyLimitMicros: integer("ai_monthly_limit_micros"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// goals — a career/study objective with a "why" and a target date.
// ---------------------------------------------------------------------------

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    why: text("why"),
    category: goalCategory("category").notNull(),
    targetDate: timestamp("target_date", { withTimezone: true }),
    status: goalStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("goals_owner_idx").on(t.ownerId)],
);

// ---------------------------------------------------------------------------
// topics — units of content inside a goal. Progress is DERIVED from these
// (weighted share of `mastered` topics), never stored on the goal.
// ---------------------------------------------------------------------------

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: topicStatus("status").notNull().default("todo"),
    weight: integer("weight").notNull().default(1),
    // Stage this topic belongs to ("Fundamentos", "Base", "Especialista"…). The
    // roadmap already thinks in phases; this is where that survives adoption.
    // Free text rather than an enum because the phases depend on the subject.
    // Null means ungrouped, which is a normal state, not a defect.
    phase: text("phase"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("topics_owner_idx").on(t.ownerId),
    index("topics_goal_idx").on(t.goalId),
  ],
);

// ---------------------------------------------------------------------------
// study_sessions — immutable event log. We never UPDATE a running total;
// hours, streaks and the constancy heatmap are all aggregated from rows here.
// `topicId` is nullable so logging unstructured study stays frictionless.
// ---------------------------------------------------------------------------

export const studySessions = pgTable(
  "study_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    // De onde veio o estudo desta sessão. Faz parte do EVENTO — escrito uma vez
    // na criação, junto com a duração — então não fere o log imutável.
    // `set null` porque apagar um curso não pode apagar o histórico de estudo.
    materialId: uuid("material_id").references(() => materials.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMin: integer("duration_min").notNull(),
    comprehension: integer("comprehension"), // 1-10 self-rating, nullable
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sessions_owner_idx").on(t.ownerId),
    index("sessions_owner_started_idx").on(t.ownerId, t.startedAt),
    index("sessions_topic_idx").on(t.topicId),
    index("sessions_material_idx").on(t.materialId),
  ],
);

// ---------------------------------------------------------------------------
// materials — references (URL + progress), NOT hosted files. Avoids being a
// file host (storage cost + LGPD). Optionally tied to a goal.
// ---------------------------------------------------------------------------

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    type: materialType("type").notNull(),
    title: text("title").notNull(),
    url: text("url"),
    progressPct: integer("progress_pct").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("materials_owner_idx").on(t.ownerId),
    index("materials_goal_idx").on(t.goalId),
  ],
);

// ---------------------------------------------------------------------------
// flashcards — front/back study cards belonging to a topic (phase 2.1).
// A topic has 0..N cards; the card is the unit of spaced repetition.
// ---------------------------------------------------------------------------

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    front: text("front").notNull(),
    back: text("back").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("flashcards_owner_idx").on(t.ownerId),
    index("flashcards_topic_idx").on(t.topicId),
  ],
);

// ---------------------------------------------------------------------------
// flashcard_reviews — append-only spaced-repetition log (FSRS), per card.
// Each row is one review event carrying the resulting FSRS card snapshot.
// A card's current memory state = its most recent row; no row = a fresh card.
// ---------------------------------------------------------------------------

export const flashcardReviews = pgTable(
  "flashcard_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    flashcardId: uuid("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1=again 2=hard 3=good 4=easy
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull(),
    // Resulting FSRS card state (mirrors ts-fsrs Card):
    state: integer("state").notNull(), // 0=new 1=learning 2=review 3=relearning
    due: timestamp("due", { withTimezone: true }).notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    elapsedDays: integer("elapsed_days").notNull().default(0),
    scheduledDays: integer("scheduled_days").notNull().default(0),
    learningSteps: integer("learning_steps").notNull().default(0),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReview: timestamp("last_review", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("card_reviews_owner_idx").on(t.ownerId),
    index("card_reviews_card_reviewed_idx").on(t.flashcardId, t.reviewedAt),
    index("card_reviews_owner_due_idx").on(t.ownerId, t.due),
  ],
);

// ---------------------------------------------------------------------------
// exams — a generated assessment over a goal's topics. Persisted as attempts
// (many per goal) so scores can be compared over time: the exam is how a
// self-declared `mastered` gets checked against what was actually absorbed.
// Questions live in their own table because results are read per TOPIC — that's
// what drives reverting a topic to `learning` and seeding flashcards.
// ---------------------------------------------------------------------------

export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    // Set when this is a topic quiz rather than the goal's exam. Same table on
    // purpose: identical shape, so grading, the runner and the attempt history
    // are shared instead of forked into a parallel system.
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    // null until submitted — an exam in progress has no score yet.
    scorePct: integer("score_pct"),
    feedback: text("feedback"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("exams_owner_idx").on(t.ownerId), index("exams_goal_idx").on(t.goalId)],
);

export const examQuestions = pgTable(
  "exam_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    // Kept even if the topic is deleted — the attempt stays readable.
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    topicTitle: text("topic_title").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    chosenIndex: integer("chosen_index"),
    explanation: text("explanation").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("exam_questions_owner_idx").on(t.ownerId),
    index("exam_questions_exam_idx").on(t.examId),
  ],
);

// ---------------------------------------------------------------------------
// lessons — authored study content (markdown) attached to a topic. Unlike
// `materials` (external references), this stores the TEXT itself — the notes/
// lessons the user writes or generates. Text is cheap; this is not a binary
// file host. Rendered in-app on a dedicated reading page.
// ---------------------------------------------------------------------------

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    // A FONTE de onde esta aula saiu — o curso, livro ou artigo que a originou.
    // `set null` (e não cascade): apagar o curso não pode apagar a aula, que é
    // trabalho seu, não dele.
    materialId: uuid("material_id").references(() => materials.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    // Reading material vs. hands-on lab. They are different work — finishing
    // the reading is not finishing the practice — so progress counts them apart
    // and the quiz can lean on the lab, which is where application shows up.
    kind: lessonKind("kind").notNull().default("aula"),
    content: text("content").notNull(), // markdown
    // When the material was finished. A timestamp rather than a flag: it keeps
    // the "when" that a boolean throws away, and null reads naturally as "not
    // done yet" without a default to maintain.
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lessons_owner_idx").on(t.ownerId),
    index("lessons_topic_idx").on(t.topicId),
    index("lessons_material_idx").on(t.materialId),
  ],
);

// ---------------------------------------------------------------------------
// notes — what the user WROTE while studying, as opposed to `lessons`, which
// is material to study. Markdown, same renderer.
//
// It lives here and not on `study_sessions` on purpose: that table is an
// immutable event log (hours, streak and the heatmap all aggregate from it),
// and a note is the opposite — a document to be revised and extended. The real
// notes proved it: two sessions 43 minutes apart held the same synthesis, the
// second one rewritten, because there was no way to edit the first.
//
// So the note belongs to the TOPIC, which is also the axis you search along;
// `session_id` keeps the "written during which session" without making the
// session its owner. Null session = written outside a timed block.
// ---------------------------------------------------------------------------

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Nullable, mirroring `study_sessions.topic_id`: "estudo livre" is a real
    // option in the logger, and a NOT NULL here would mean either refusing to
    // save what the user just wrote or dropping it silently. The topic is the
    // normal case and the axis notes are browsed by; null is the escape hatch.
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "cascade" }),
    // Deleting a session must not delete the knowledge written during it.
    sessionId: uuid("session_id").references(() => studySessions.id, {
      onDelete: "set null",
    }),
    // Set when the note was written from inside a lesson, over a selected
    // passage. `set null` because deleting the lesson must not delete what the
    // reader wrote about it.
    lessonId: uuid("lesson_id").references(() => lessons.id, { onDelete: "set null" }),
    // The section the passage was in, by heading slug — NOT a character
    // offset. Editing one paragraph shifts every offset after it, while a
    // heading survives anything short of renaming the section. If the section
    // does disappear, the note still holds its quote and simply floats free.
    anchorSlug: text("anchor_slug"),
    quote: text("quote"),
    title: text("title").notNull(),
    content: text("content").notNull(), // markdown
    // The one field adopted from the redesign proposal: it has a job the body
    // text does not — telling the next session where to pick up.
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notes_owner_idx").on(t.ownerId),
    index("notes_topic_idx").on(t.topicId),
    index("notes_session_idx").on(t.sessionId),
    index("notes_lesson_idx").on(t.lessonId),
    // Full text over title + body under `pt_unaccent` — the `portuguese`
    // config with unaccent in front of the stemmer (created in migration 0017).
    //
    // Measured, not assumed: the Portuguese snowball stemmer does NOT conflate
    // "injeção"/"injeções" ('injeçã' vs 'injeçõ') nor "revisão"/"revisar". What
    // it does give is regular inflection, and unaccent adds the case that
    // actually comes up while typing — "conteudo" finding "conteúdo".
    //
    // The config name is a literal, so the expression stays IMMUTABLE and
    // indexable. Queries MUST use the same name or the index is skipped.
    index("notes_fts_idx").using(
      "gin",
      sql`to_tsvector('pt_unaccent', ${t.title} || ' ' || ${t.content})`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// reading_progress — where the reader stopped, per lesson.
//
// The measured lessons run to ~85k characters, about an hour of reading and
// 80 screens of scrolling, so nobody finishes one in a sitting and reopening
// at the top is a real cost.
//
// Position is an ANCHOR (a heading slug), not a scroll offset: font size and
// column width are about to become adjustable, and every stored pixel would
// point somewhere else the moment either changes. `percent` is kept alongside
// only to draw the bar.
//
// Mutable state, not an event log — one row per lesson, updated in place.
// ---------------------------------------------------------------------------

export const readingProgress = pgTable(
  "reading_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    anchorSlug: text("anchor_slug"),
    percent: integer("percent").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One position per lesson: the upsert depends on this.
    uniqueIndex("reading_progress_owner_lesson_idx").on(t.ownerId, t.lessonId),
    index("reading_progress_owner_updated_idx").on(t.ownerId, t.updatedAt),
  ],
);

// ---------------------------------------------------------------------------
// certifications — a credential the user targets or holds (the "certify" step
// of the plan→execute→review→certify→résumé journey). Mutable stateful entity
// (like goals), NOT an event log. Optionally linked to the goal that studies
// for it, so exam readiness = the goal's derived mastered-weight %.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// tutor_answers — what the tutor explained about a topic.
//
// Until now the tutor's reply lived only in the open dialog and was gone on
// close. Keeping it turns a throwaway answer into study material the quiz can
// draw on, and gives the topic a readable history of what was already asked.
// ---------------------------------------------------------------------------

export const tutorAnswers = pgTable(
  "tutor_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    mode: text("mode").notNull(),
    question: text("question"),
    answer: text("answer").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tutor_answers_owner_idx").on(t.ownerId),
    index("tutor_answers_topic_idx").on(t.topicId),
  ],
);

export const certifications = pgTable(
  "certifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references(() => goals.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    provider: text("provider").notNull(), // AWS, Google Cloud, Microsoft, CNCF…
    code: text("code"), // exam code, e.g. SAA-C03
    status: certificationStatus("status").notNull().default("planned"),
    examDate: timestamp("exam_date", { withTimezone: true }),
    obtainedDate: timestamp("obtained_date", { withTimezone: true }),
    expiresDate: timestamp("expires_date", { withTimezone: true }),
    score: text("score"), // free-form: "820/1000", "Pass"
    costCents: integer("cost_cents"), // investment tracking, nullable
    credentialUrl: text("credential_url"), // verification link (Credly, etc.)
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("certifications_owner_idx").on(t.ownerId),
    index("certifications_goal_idx").on(t.goalId),
  ],
);

// ---------------------------------------------------------------------------
// assignments — atividades de entrega (trabalho, prova prática, seminário).
//
// POR QUE NÃO CABE EM NADA QUE EXISTE. `materials` é o que se CONSOME (URL e
// progresso, sem prazo e sem estado de concluído); `lessons` é conteúdo;
// `certifications` tem data de prova mas outro ciclo de vida. Entrega é algo
// que se PRODUZ, com prazo duro e estado binário — e esquecê-la custa nota.
//
// Três decisões que valem mais que as colunas:
//
// 1. NÃO existe coluna `status`. Pendente é `deliveredAt IS NULL`. Duas
//    colunas permitiriam o estado impossível "entregue sem data de entrega",
//    e derivar em vez de guardar é a mesma regra do progresso do objetivo.
// 2. `dueDate` é NOT NULL. A função inteira é não perder prazo; sem data a
//    linha não entra na agenda nem no dashboard, e vira uma anotação — que já
//    tem lugar próprio no sistema.
// 3. `artifactUrl` é REFERÊNCIA, não arquivo. Mesma razão de `materials`: o
//    app não vira file host (custo de storage e LGPD).
// ---------------------------------------------------------------------------

export const assignments = pgTable(
  "assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Cascade e não set null: entrega sem disciplina não significa nada.
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    // Opcional, e `set null` — a entrega sobrevive ao tópico que a originou.
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    /** Null = pendente. É daqui que o estado é derivado. */
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    /** Link do que foi entregue — repositório, doc, vídeo. */
    artifactUrl: text("artifact_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assignments_owner_idx").on(t.ownerId),
    index("assignments_goal_idx").on(t.goalId),
    // O que a agenda e o dashboard perguntam: o que vence, do mais próximo.
    index("assignments_owner_due_idx").on(t.ownerId, t.dueDate),
  ],
);

// ---------------------------------------------------------------------------
// resume_profile — the editorial layer of the "currículo inteligente" (the
// résumé capstone). One row per user. Skills, certifications and goals are
// DERIVED live from the other tables; this stores only the human/AI-authored
// bits: headline, summary, target role, contact and highlight bullets.
// ---------------------------------------------------------------------------

export type ResumeContact = {
  name?: string;
  email?: string;
  location?: string;
  linkedin?: string;
  github?: string;
};

export const resumeProfiles = pgTable(
  "resume_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline"),
    summary: text("summary"),
    targetRole: text("target_role"),
    contact: jsonb("contact").$type<ResumeContact>(),
    highlights: jsonb("highlights").$type<string[]>(),
    // Public sharing: an unguessable random slug + a publish flag. Only
    // is_public rows are served at /r/[slug]. Slug is null until first publish.
    publicSlug: text("public_slug"),
    isPublic: boolean("is_public").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("resume_profiles_owner_idx").on(t.ownerId),
    uniqueIndex("resume_profiles_slug_idx").on(t.publicSlug),
  ],
);

// ---------------------------------------------------------------------------
// ai_usage — o que cada chamada de IA consumiu.
//
// Existe por dois motivos que são o mesmo trabalho: VISIBILIDADE (não havia
// como saber o gasto sem abrir o console da Anthropic) e TETO (11 endpoints de
// IA estavam acessíveis sem limite nenhum, faturados na conta do dono).
//
// Guarda TOKENS, não só custo: preço muda, token não. `cost_micros` é o que
// foi cobrado na época, em milionésimos de dólar — inteiro, sem deriva de
// ponto flutuante, e mantido como registro histórico mesmo se a tabela de
// preços mudar depois.
//
// É log imutável, como `study_sessions`: uma linha por chamada, escrita uma
// vez. Gasto por período é sempre agregado na leitura.
// ---------------------------------------------------------------------------

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Qual módulo de `domain/ai` fez a chamada: "tutor", "quizGen"… */
    endpoint: text("endpoint").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    /** Custo em milionésimos de dólar. US$ 0,22 = 220000. */
    costMicros: integer("cost_micros").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A consulta quente é "quanto este dono gastou desde X" — daí o par.
    index("ai_usage_owner_created_idx").on(t.ownerId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// resume_experiences / resume_projects — a CARREIRA, que é anterior ao app.
//
// Todo o resto do currículo é DERIVADO do uso do Latis Skills: competência é
// tópico `mastered`, credencial é certificação `passed`, dedicação é soma de
// sessão. Isso descreve bem quem começou a carreira aqui dentro — e descreve
// mal qualquer pessoa que já tinha uma. Medido em 06/08/2026: 4 tópicos
// dominados, 0 certificações e 27h de estudo, contra 14 anos de experiência
// real que o sistema não tinha onde guardar.
//
// Por isso estas duas tabelas são as únicas do módulo que armazenam fato em
// vez de derivar: elas não têm origem no app, então não há de onde computá-las.
// ---------------------------------------------------------------------------

export const resumeExperiences = pgTable(
  "resume_experiences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    // Datas como texto "YYYY-MM": currículo se escreve em mês/ano, e um
    // timestamp obrigaria a inventar o dia. `endDate` nulo = cargo atual.
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    location: text("location"),
    description: text("description"), // markdown, mesmo renderizador do resto
    techs: jsonb("techs").$type<string[]>(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resume_experiences_owner_idx").on(t.ownerId)],
);

export const resumeProjects = pgTable(
  "resume_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    url: text("url"),
    repoUrl: text("repo_url"),
    techs: jsonb("techs").$type<string[]>(),
    // Quais projetos entram no currículo gerado. Um portfólio inteiro não cabe
    // numa página, e a escolha é editorial — não dá para derivar.
    highlight: boolean("highlight").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("resume_projects_owner_idx").on(t.ownerId)],
);

// ---------------------------------------------------------------------------
// Inferred types — the single source of truth for the domain layer.
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
export type Material = typeof materials.$inferSelect;
export type NewMaterial = typeof materials.$inferInsert;
export type Flashcard = typeof flashcards.$inferSelect;
export type NewFlashcard = typeof flashcards.$inferInsert;
export type FlashcardReview = typeof flashcardReviews.$inferSelect;
export type NewFlashcardReview = typeof flashcardReviews.$inferInsert;
export type Certification = typeof certifications.$inferSelect;
export type NewCertification = typeof certifications.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;
export type ReadingProgress = typeof readingProgress.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type ExamQuestion = typeof examQuestions.$inferSelect;
export type NewExamQuestion = typeof examQuestions.$inferInsert;
export type ResumeProfile = typeof resumeProfiles.$inferSelect;
export type NewResumeProfile = typeof resumeProfiles.$inferInsert;
export type ResumeExperience = typeof resumeExperiences.$inferSelect;
export type NewResumeExperience = typeof resumeExperiences.$inferInsert;
export type AiUsage = typeof aiUsage.$inferSelect;
export type NewAiUsage = typeof aiUsage.$inferInsert;
export type ResumeProject = typeof resumeProjects.$inferSelect;
export type NewResumeProject = typeof resumeProjects.$inferInsert;

export type TutorAnswer = typeof tutorAnswers.$inferSelect;
export type NewTutorAnswer = typeof tutorAnswers.$inferInsert;

export type Assignment = typeof assignments.$inferSelect;
export type NewAssignment = typeof assignments.$inferInsert;
