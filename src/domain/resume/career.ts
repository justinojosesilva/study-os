import { db } from "@/infra/db/client";
import {
  resumeExperiences,
  resumeProjects,
  type ResumeExperience,
  type ResumeProject,
} from "@/infra/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";

/**
 * A carreira anterior ao Study OS — a única parte do currículo que é FATO
 * armazenado em vez de derivado do uso do app. Ver o comentário das tabelas em
 * `infra/db/schema.ts`.
 */

export type CareerData = {
  experiences: ResumeExperience[];
  projects: ResumeProject[];
};

export async function getCareerData(ownerId: string): Promise<CareerData> {
  const [experiences, projects] = await Promise.all([
    db
      .select()
      .from(resumeExperiences)
      .where(eq(resumeExperiences.ownerId, ownerId))
      // Cargo atual primeiro; `end_date` nulo é o atual, e nulo ordena por
      // último em ASC, então o desempate vem de `start_date` decrescente.
      .orderBy(
        asc(resumeExperiences.sortOrder),
        desc(resumeExperiences.startDate),
      ),
    db
      .select()
      .from(resumeProjects)
      .where(eq(resumeProjects.ownerId, ownerId))
      .orderBy(asc(resumeProjects.sortOrder), desc(resumeProjects.createdAt)),
  ]);
  return { experiences, projects };
}

// --- experiências -----------------------------------------------------------

export type ExperienceInput = {
  company: string;
  role: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  description: string | null;
  techs: string[] | null;
  /** Só a importação define; o formulário manual deixa no default. */
  sortOrder?: number;
};

export async function createExperience(
  ownerId: string,
  input: ExperienceInput,
): Promise<ResumeExperience> {
  const [row] = await db
    .insert(resumeExperiences)
    .values({ ownerId, ...input })
    .returning();
  return row;
}

export async function updateExperience(
  ownerId: string,
  id: string,
  input: Partial<ExperienceInput>,
): Promise<void> {
  await db
    .update(resumeExperiences)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(resumeExperiences.id, id), eq(resumeExperiences.ownerId, ownerId)));
}

export async function deleteExperience(ownerId: string, id: string): Promise<void> {
  await db
    .delete(resumeExperiences)
    .where(and(eq(resumeExperiences.id, id), eq(resumeExperiences.ownerId, ownerId)));
}

// --- projetos ---------------------------------------------------------------

export type ProjectInput = {
  title: string;
  description: string | null;
  url: string | null;
  repoUrl: string | null;
  techs: string[] | null;
  highlight: boolean;
  /** Só a importação define; o formulário manual deixa no default. */
  sortOrder?: number;
};

export async function createProject(
  ownerId: string,
  input: ProjectInput,
): Promise<ResumeProject> {
  const [row] = await db.insert(resumeProjects).values({ ownerId, ...input }).returning();
  return row;
}

export async function updateProject(
  ownerId: string,
  id: string,
  input: Partial<ProjectInput>,
): Promise<void> {
  await db
    .update(resumeProjects)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(resumeProjects.id, id), eq(resumeProjects.ownerId, ownerId)));
}

export async function deleteProject(ownerId: string, id: string): Promise<void> {
  await db
    .delete(resumeProjects)
    .where(and(eq(resumeProjects.id, id), eq(resumeProjects.ownerId, ownerId)));
}
