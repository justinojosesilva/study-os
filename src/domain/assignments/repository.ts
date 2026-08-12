import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/infra/db/client";
import { assignments, goals, topics, type Assignment } from "@/infra/db/schema";

/**
 * Atividades de entrega — trabalho, seminário, prova prática.
 *
 * O estado NÃO é uma coluna: pendente é `deliveredAt IS NULL`. Toda leitura
 * aqui deriva `entregue` e `atrasada` na consulta, para a tela não ter de
 * repetir a regra e as duas nunca discordarem.
 */

export type AssignmentView = Assignment & {
  goalTitle: string;
  topicTitle: string | null;
  entregue: boolean;
  /** Só faz sentido para pendente: entregue com atraso já é história. */
  atrasada: boolean;
};

const camposBase = {
  id: assignments.id,
  ownerId: assignments.ownerId,
  goalId: assignments.goalId,
  topicId: assignments.topicId,
  title: assignments.title,
  description: assignments.description,
  dueDate: assignments.dueDate,
  deliveredAt: assignments.deliveredAt,
  artifactUrl: assignments.artifactUrl,
  createdAt: assignments.createdAt,
  goalTitle: goals.title,
  topicTitle: topics.title,
  entregue: sql<boolean>`${assignments.deliveredAt} is not null`,
  atrasada: sql<boolean>`${assignments.deliveredAt} is null and ${assignments.dueDate} < now()`,
};

/** Tudo de um objetivo, vencendo primeiro. */
export async function listByGoal(ownerId: string, goalId: string): Promise<AssignmentView[]> {
  return db
    .select(camposBase)
    .from(assignments)
    .innerJoin(goals, eq(assignments.goalId, goals.id))
    .leftJoin(topics, eq(assignments.topicId, topics.id))
    .where(and(eq(assignments.ownerId, ownerId), eq(assignments.goalId, goalId)))
    .orderBy(asc(assignments.dueDate));
}

/**
 * Pendentes que vencem até `ateDias` à frente, mais TODAS as atrasadas.
 *
 * As atrasadas entram independentemente da janela de propósito: um prazo
 * vencido não deixa de importar por ter passado da janela — é justamente aí
 * que ele mais precisa aparecer.
 */
export async function listUpcoming(ownerId: string, ateDias = 14): Promise<AssignmentView[]> {
  const limite = new Date(Date.now() + ateDias * 24 * 60 * 60 * 1000);
  return db
    .select(camposBase)
    .from(assignments)
    .innerJoin(goals, eq(assignments.goalId, goals.id))
    .leftJoin(topics, eq(assignments.topicId, topics.id))
    .where(
      and(
        eq(assignments.ownerId, ownerId),
        isNull(assignments.deliveredAt),
        lte(assignments.dueDate, limite),
      ),
    )
    .orderBy(asc(assignments.dueDate));
}

/** Quantas estão pendentes e quantas dessas já venceram. Para o dashboard. */
export async function countPending(
  ownerId: string,
): Promise<{ pendentes: number; atrasadas: number }> {
  const [linha] = await db
    .select({
      pendentes: sql<number>`count(*)::int`,
      atrasadas: sql<number>`count(*) filter (where ${assignments.dueDate} < now())::int`,
    })
    .from(assignments)
    .where(and(eq(assignments.ownerId, ownerId), isNull(assignments.deliveredAt)));
  return linha ?? { pendentes: 0, atrasadas: 0 };
}

export type NewAssignmentInput = {
  goalId: string;
  topicId: string | null;
  title: string;
  description: string | null;
  dueDate: Date;
  artifactUrl: string | null;
};

/**
 * Cria a entrega. O objetivo é conferido contra o dono ANTES da inserção —
 * a FK garante que o objetivo existe, não que ele é seu.
 */
export async function createAssignment(
  ownerId: string,
  input: NewAssignmentInput,
): Promise<Assignment | null> {
  const [objetivo] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.ownerId, ownerId), eq(goals.id, input.goalId)))
    .limit(1);
  if (!objetivo) return null;

  // Mesma conferência para o tópico: precisa ser do MESMO objetivo, senão a
  // entrega apareceria pendurada numa aula de outra disciplina.
  if (input.topicId) {
    const [t] = await db
      .select({ id: topics.id })
      .from(topics)
      .where(
        and(
          eq(topics.ownerId, ownerId),
          eq(topics.id, input.topicId),
          eq(topics.goalId, input.goalId),
        ),
      )
      .limit(1);
    if (!t) return null;
  }

  const [linha] = await db
    .insert(assignments)
    .values({ ownerId, ...input })
    .returning();
  return linha;
}

/** Alterna entregue/pendente. Devolve o goalId para revalidação, ou null. */
export async function toggleDelivered(
  ownerId: string,
  id: string,
  entregue: boolean,
): Promise<string | null> {
  const [linha] = await db
    .update(assignments)
    .set({ deliveredAt: entregue ? new Date() : null })
    .where(and(eq(assignments.ownerId, ownerId), eq(assignments.id, id)))
    .returning({ goalId: assignments.goalId });
  return linha?.goalId ?? null;
}

export async function setArtifactUrl(
  ownerId: string,
  id: string,
  url: string | null,
): Promise<string | null> {
  const [linha] = await db
    .update(assignments)
    .set({ artifactUrl: url })
    .where(and(eq(assignments.ownerId, ownerId), eq(assignments.id, id)))
    .returning({ goalId: assignments.goalId });
  return linha?.goalId ?? null;
}

export async function deleteAssignment(ownerId: string, id: string): Promise<string | null> {
  const [linha] = await db
    .delete(assignments)
    .where(and(eq(assignments.ownerId, ownerId), eq(assignments.id, id)))
    .returning({ goalId: assignments.goalId });
  return linha?.goalId ?? null;
}
