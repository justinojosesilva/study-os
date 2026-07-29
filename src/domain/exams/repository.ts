import { db } from "@/infra/db/client";
import { exams, examQuestions, topics, goals, flashcards } from "@/infra/db/schema";
import { and, eq, asc, desc, isNotNull, inArray, sql } from "drizzle-orm";

export type NewQuestionInput = {
  topicId: string | null;
  topicTitle: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

/** Creates the exam and its questions in one transaction. */
export async function createExam(
  ownerId: string,
  goalId: string,
  questions: NewQuestionInput[],
) {
  return db.transaction(async (tx) => {
    const [exam] = await tx
      .insert(exams)
      .values({ ownerId, goalId })
      .returning({ id: exams.id });

    await tx.insert(examQuestions).values(
      questions.map((q, i) => ({
        ownerId,
        examId: exam.id,
        topicId: q.topicId,
        topicTitle: q.topicTitle,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        sortOrder: i,
      })),
    );

    return exam;
  });
}

export type ExamWithQuestions = {
  id: string;
  goalId: string;
  goalTitle: string;
  scorePct: number | null;
  completedAt: Date | null;
  questions: {
    id: string;
    topicId: string | null;
    topicTitle: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    chosenIndex: number | null;
    explanation: string;
  }[];
};

export async function getExam(
  ownerId: string,
  examId: string,
): Promise<ExamWithQuestions | null> {
  const [exam] = await db
    .select({
      id: exams.id,
      goalId: exams.goalId,
      scorePct: exams.scorePct,
      completedAt: exams.completedAt,
    })
    .from(exams)
    .where(and(eq(exams.ownerId, ownerId), eq(exams.id, examId)))
    .limit(1);
  if (!exam) return null;

  const [goal] = await db
    .select({ title: goals.title })
    .from(goals)
    .where(eq(goals.id, exam.goalId))
    .limit(1);

  const rows = await db
    .select()
    .from(examQuestions)
    .where(and(eq(examQuestions.ownerId, ownerId), eq(examQuestions.examId, examId)))
    .orderBy(asc(examQuestions.sortOrder));

  return {
    ...exam,
    goalTitle: goal?.title ?? "",
    questions: rows.map((r) => ({
      id: r.id,
      topicId: r.topicId,
      topicTitle: r.topicTitle,
      prompt: r.prompt,
      options: r.options,
      correctIndex: r.correctIndex,
      chosenIndex: r.chosenIndex,
      explanation: r.explanation,
    })),
  };
}

/** Past attempts for a goal, newest first — the "am I improving?" view. */
export async function listExamsForGoal(ownerId: string, goalId: string) {
  return db
    .select({
      id: exams.id,
      scorePct: exams.scorePct,
      createdAt: exams.createdAt,
      completedAt: exams.completedAt,
    })
    .from(exams)
    .where(
      and(
        eq(exams.ownerId, ownerId),
        eq(exams.goalId, goalId),
        isNotNull(exams.completedAt),
      ),
    )
    .orderBy(desc(exams.createdAt));
}

export type GradedResult = {
  scorePct: number;
  correct: number;
  total: number;
  /** Topics the exam knocked back a step. */
  demotedTopics: string[];
  /** Topics promoted to mastered by answering everything right. */
  masteredTopics: string[];
  cardsCreated: number;
};

/**
 * Grades the attempt and writes the consequences back into the domain: a topic
 * with a wrong answer loses `mastered` and a flashcard is seeded from the miss,
 * so a bad result feeds the review engine instead of being just a number.
 */
export async function submitExam(
  ownerId: string,
  examId: string,
  answers: Record<string, number>,
  feedback: string | null,
): Promise<GradedResult | null> {
  return db.transaction(async (tx) => {
    const [exam] = await tx
      .select({ id: exams.id, completedAt: exams.completedAt })
      .from(exams)
      .where(and(eq(exams.ownerId, ownerId), eq(exams.id, examId)))
      .limit(1);
    if (!exam || exam.completedAt) return null;

    const rows = await tx
      .select()
      .from(examQuestions)
      .where(and(eq(examQuestions.ownerId, ownerId), eq(examQuestions.examId, examId)));
    if (rows.length === 0) return null;

    let correct = 0;
    const missedByTopic = new Map<string, typeof rows>();
    // Topics this exam actually asked about — only those can move either way.
    const testedTopics = new Set<string>();

    for (const q of rows) {
      const chosen = answers[q.id] ?? null;
      await tx
        .update(examQuestions)
        .set({ chosenIndex: chosen })
        .where(eq(examQuestions.id, q.id));

      if (q.topicId) testedTopics.add(q.topicId);

      if (chosen === q.correctIndex) {
        correct += 1;
      } else if (q.topicId) {
        const list = missedByTopic.get(q.topicId) ?? [];
        list.push(q);
        missedByTopic.set(q.topicId, list);
      }
    }

    const scorePct = Math.round((correct / rows.length) * 100);
    await tx
      .update(exams)
      .set({ scorePct, feedback, completedAt: new Date() })
      .where(eq(exams.id, examId));

    // Consequence 1: a miss costs the topic one step. Mastery drops back to
    // practice rather than all the way to studying — getting a question wrong
    // means the practice wasn't finished, not that the reading was wasted.
    const demotedTopics: string[] = [];
    for (const [topicId, missed] of missedByTopic) {
      const [demoted] = await tx
        .update(topics)
        .set({
          status: sql`case ${topics.status}
            when 'mastered' then 'praticando'::topic_status
            when 'praticando' then 'learning'::topic_status
            else ${topics.status}
          end`,
        })
        .where(
          and(
            eq(topics.ownerId, ownerId),
            eq(topics.id, topicId),
            inArray(topics.status, ["mastered", "praticando"]),
          ),
        )
        .returning({ title: topics.title });
      if (demoted) demotedTopics.push(demoted.title);

      // Consequence 2: each miss becomes a card, feeding the review engine.
      await tx.insert(flashcards).values(
        missed.map((q) => ({
          ownerId,
          topicId,
          front: q.prompt,
          back: `${q.options[q.correctIndex]}\n\n${q.explanation}`,
        })),
      );
    }

    // Consequence 3: the exam is the only way into `mastered`. A topic that was
    // being practised and answered everything correctly here has earned it —
    // mastery becomes evidence rather than a self-assessment.
    const masteredTopics: string[] = [];
    for (const topicId of testedTopics) {
      if (missedByTopic.has(topicId)) continue;
      const [promoted] = await tx
        .update(topics)
        .set({ status: "mastered" })
        .where(
          and(
            eq(topics.ownerId, ownerId),
            eq(topics.id, topicId),
            eq(topics.status, "praticando"),
          ),
        )
        .returning({ title: topics.title });
      if (promoted) masteredTopics.push(promoted.title);
    }

    const cardsCreated = [...missedByTopic.values()].reduce((n, l) => n + l.length, 0);
    return {
      scorePct,
      correct,
      total: rows.length,
      demotedTopics,
      masteredTopics,
      cardsCreated,
    };
  });
}

export async function deleteExam(ownerId: string, examId: string) {
  const [row] = await db
    .delete(exams)
    .where(and(eq(exams.ownerId, ownerId), eq(exams.id, examId)))
    .returning({ id: exams.id });
  return Boolean(row);
}
