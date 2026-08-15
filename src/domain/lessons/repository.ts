import { randomBytes } from "node:crypto";
import { db, adminDb } from "@/infra/db/client";
import { lessons, topics, goals, materials, type NewLesson } from "@/infra/db/schema";
import { and, eq, desc } from "drizzle-orm";

export type LessonListItem = {
  id: string;
  topicId: string;
  title: string;
  kind: "aula" | "lab";
  updatedAt: Date;
  completedAt: Date | null;
};

/** Lightweight list (no content) for a goal's topics — grouped in the UI. */
export async function listLessonsForGoal(
  ownerId: string,
  goalId: string,
): Promise<LessonListItem[]> {
  return db
    .select({
      id: lessons.id,
      topicId: lessons.topicId,
      title: lessons.title,
      kind: lessons.kind,
      updatedAt: lessons.updatedAt,
      completedAt: lessons.completedAt,
    })
    .from(lessons)
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .where(and(eq(lessons.ownerId, ownerId), eq(topics.goalId, goalId)))
    .orderBy(desc(lessons.updatedAt));
}

export type LessonRead = {
  id: string;
  title: string;
  content: string;
  topicId: string;
  topicTitle: string;
  goalId: string;
  goalTitle: string;
  completedAt: Date | null;
  materialId: string | null;
  materialTitle: string | null;
  materialUrl: string | null;
  isPublic: boolean;
  publicSlug: string | null;
};

/** Full lesson + its topic/goal context, for the reading page. */
export async function getLessonForReading(
  ownerId: string,
  lessonId: string,
): Promise<LessonRead | null> {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      content: lessons.content,
      topicId: lessons.topicId,
      topicTitle: topics.title,
      goalId: goals.id,
      goalTitle: goals.title,
      completedAt: lessons.completedAt,
      // A fonte, quando houver. `leftJoin` porque a maioria das aulas é
      // anterior ao vínculo e nunca terá material.
      materialId: materials.id,
      materialTitle: materials.title,
      materialUrl: materials.url,
      isPublic: lessons.isPublic,
      publicSlug: lessons.publicSlug,
    })
    .from(lessons)
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .innerJoin(goals, eq(topics.goalId, goals.id))
    .leftJoin(materials, eq(lessons.materialId, materials.id))
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .limit(1);
  return row ?? null;
}

export async function createLesson(input: NewLesson) {
  const [row] = await db.insert(lessons).values(input).returning({ id: lessons.id });
  return row;
}

export async function updateLesson(
  ownerId: string,
  lessonId: string,
  fields: { title: string; content: string },
) {
  const [row] = await db
    .update(lessons)
    .set({ ...fields, updatedAt: new Date() })
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ id: lessons.id });
  return Boolean(row);
}

export async function deleteLesson(ownerId: string, lessonId: string) {
  const [row] = await db
    .delete(lessons)
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ id: lessons.id });
  return Boolean(row);
}

/**
 * Marks a lesson finished, or clears it. Toggling rather than setting a flag
 * once: material gets revisited, and being able to reopen it matters as much as
 * closing it.
 */
export async function setLessonCompleted(
  ownerId: string,
  lessonId: string,
  done: boolean,
): Promise<string | null> {
  const [row] = await db
    .update(lessons)
    .set({ completedAt: done ? new Date() : null })
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ topicId: lessons.topicId });
  return row?.topicId ?? null;
}

// ---------------------------------------------------------------------------
// Compartilhamento público.
//
// Mesmo desenho já usado em `resume_profiles`, de propósito: publicar é a única
// operação do app que serve dados SEM dono autenticado, e ter duas maneiras de
// fazer isso é ter duas superfícies para auditar.
// ---------------------------------------------------------------------------

/** Slug aleatório (~11 chars) — impossível de enumerar por tentativa. */
function makeSlug(): string {
  return randomBytes(8).toString("base64url");
}

/**
 * Publica ou despublica uma aula, cunhando o slug na primeira publicação.
 *
 * O slug é PRESERVADO ao despublicar. Republicar devolve o mesmo endereço, que
 * é o que alguém espera de um link que já compartilhou — e quem quiser matar o
 * link de vez despublica e ele para de resolver, que é o controle que importa.
 */
export async function setLessonPublic(
  ownerId: string,
  lessonId: string,
  isPublic: boolean,
): Promise<{ isPublic: boolean; slug: string | null } | null> {
  const [atual] = await db
    .select({ slug: lessons.publicSlug })
    .from(lessons)
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .limit(1);
  if (!atual) return null;

  const slug = isPublic ? (atual.slug ?? makeSlug()) : atual.slug;
  const [row] = await db
    .update(lessons)
    .set({ isPublic, publicSlug: slug, updatedAt: new Date() })
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .returning({ id: lessons.id });
  return row ? { isPublic, slug } : null;
}

export type PublicLesson = {
  ownerId: string;
  title: string;
  content: string;
  kind: "aula" | "lab";
  topicTitle: string;
  updatedAt: Date;
};

/**
 * Resolve um slug público para a aula. Usa `adminDb` para furar a RLS nesta
 * ÚNICA leitura, filtrada a linhas publicadas — é a mesma costura do currículo,
 * e a única do app.
 *
 * Devolve só o que a página pública mostra. As NOTAS ficam de fora: nota é o
 * que você escreveu estudando, não o material — hoje são 18 delas em 6 aulas, e
 * compartilhar a aula não pode arrastá-las junto.
 */
export async function resolvePublicLesson(slug: string): Promise<PublicLesson | null> {
  if (!slug) return null;
  const [row] = await adminDb
    .select({
      ownerId: lessons.ownerId,
      title: lessons.title,
      content: lessons.content,
      kind: lessons.kind,
      topicTitle: topics.title,
      updatedAt: lessons.updatedAt,
    })
    .from(lessons)
    .innerJoin(topics, eq(lessons.topicId, topics.id))
    .where(and(eq(lessons.publicSlug, slug), eq(lessons.isPublic, true)))
    .limit(1);
  return row ?? null;
}

/** Título + markdown cru, para download. Escopado pelo dono como todo o resto. */
export async function getLessonMarkdown(
  ownerId: string,
  lessonId: string,
): Promise<{ title: string; content: string } | null> {
  const [row] = await db
    .select({ title: lessons.title, content: lessons.content })
    .from(lessons)
    .where(and(eq(lessons.ownerId, ownerId), eq(lessons.id, lessonId)))
    .limit(1);
  return row ?? null;
}
