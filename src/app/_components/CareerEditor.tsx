"use client";

import { useRef, useState, useTransition } from "react";
import { Briefcase, FolderGit2, Plus, Trash2, Pencil, X, Star } from "lucide-react";
import {
  createExperienceAction,
  updateExperienceAction,
  deleteExperienceAction,
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  toggleProjectHighlightAction,
} from "@/app/_actions/career";
import type { CareerData } from "@/domain/resume/career";
import type { ResumeExperience, ResumeProject } from "@/infra/db/schema";
import { EmptyState } from "./EmptyState";

/**
 * A carreira anterior ao app, digitada à mão.
 *
 * Todo o resto do currículo é derivado do uso do Study OS — e por isso ele só
 * sabia descrever quem começou a carreira aqui dentro. Isto é a entrada dos
 * fatos que o app não tem como computar.
 */
export function CareerEditor({ career }: { career: CareerData }) {
  return (
    <div className="flex flex-col gap-5">
      <ExperienceSection experiences={career.experiences} />
      <ProjectSection projects={career.projects} />
    </div>
  );
}

// --- experiências -----------------------------------------------------------

function ExperienceSection({ experiences }: { experiences: ResumeExperience[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Briefcase size={17} className="text-profissional" />
          Experiência
        </h2>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setEditing(null);
          }}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          {adding ? <X size={14} /> : <Plus size={14} />} {adding ? "Cancelar" : "Adicionar"}
        </button>
      </div>

      {adding && <ExperienceForm onDone={() => setAdding(false)} />}

      {experiences.length === 0 && !adding ? (
        <EmptyState
          bordered={false}
          icon={Briefcase}
          title="Nenhuma experiência registrada"
          hint="O currículo hoje só sabe o que você estudou aqui. Adicione os cargos que vieram antes."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {experiences.map((e) =>
            editing === e.id ? (
              <li key={e.id}>
                <ExperienceForm experience={e} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {e.role} <span className="text-muted">· {e.company}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-faint tabular-nums">
                    {e.startDate} — {e.endDate ?? "atual"}
                    {e.location && ` · ${e.location}`}
                  </p>
                  {e.techs && e.techs.length > 0 && (
                    <p className="mt-1 text-xs text-muted">{e.techs.join(" · ")}</p>
                  )}
                </div>
                <RowActions
                  onEdit={() => {
                    setEditing(e.id);
                    setAdding(false);
                  }}
                  onDelete={() => deleteExperienceAction(e.id)}
                  deleteLabel={`Remover ${e.role} em ${e.company}`}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function ExperienceForm({
  experience,
  onDone,
}: {
  experience?: ResumeExperience;
  onDone: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const fd = new FormData(ev.currentTarget);
    start(async () => {
      const res = experience
        ? await updateExperienceAction(experience.id, fd)
        : await createExperienceAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        onDone();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="mb-2 flex flex-col gap-2 rounded-lg border border-line bg-surface-2 px-3 py-3"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Cargo">
          <input name="role" defaultValue={experience?.role} className={INPUT} />
        </Field>
        <Field label="Empresa">
          <input name="company" defaultValue={experience?.company} className={INPUT} />
        </Field>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Início (AAAA-MM)">
          <input
            name="startDate"
            placeholder="2010-03"
            defaultValue={experience?.startDate}
            className={INPUT}
          />
        </Field>
        <Field label="Fim (vazio = atual)">
          <input
            name="endDate"
            placeholder="2014-08"
            defaultValue={experience?.endDate ?? ""}
            className={INPUT}
          />
        </Field>
        <Field label="Local">
          <input name="location" defaultValue={experience?.location ?? ""} className={INPUT} />
        </Field>
      </div>
      <Field label="O que você fez">
        <textarea
          name="description"
          rows={4}
          defaultValue={experience?.description ?? ""}
          placeholder="Responsabilidades e resultados. Uma linha por item funciona bem."
          className={`${INPUT} resize-y`}
        />
      </Field>
      <Field label="Tecnologias (separadas por vírgula)">
        <input
          name="techs"
          placeholder="Java, Spring, PostgreSQL, AWS"
          defaultValue={experience?.techs?.join(", ") ?? ""}
          className={INPUT}
        />
      </Field>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-50"
        >
          {pending ? "Salvando…" : experience ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}

// --- projetos ---------------------------------------------------------------

function ProjectSection({ projects }: { projects: ResumeProject[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const destaques = projects.filter((p) => p.highlight).length;

  return (
    <section className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <FolderGit2 size={17} className="text-certificacao" />
          Projetos
        </h2>
        <button
          type="button"
          onClick={() => {
            setAdding((v) => !v);
            setEditing(null);
          }}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          {adding ? <X size={14} /> : <Plus size={14} />} {adding ? "Cancelar" : "Adicionar"}
        </button>
      </div>
      <p className="mb-3 text-xs text-muted">
        Só os marcados com estrela entram no currículo — {destaques} de {projects.length}.
      </p>

      {adding && <ProjectForm onDone={() => setAdding(false)} />}

      {projects.length === 0 && !adding ? (
        <EmptyState
          bordered={false}
          icon={FolderGit2}
          title="Nenhum projeto registrado"
          hint="Trabalhos que valem ser mostrados — com link, se houver."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((p) =>
            editing === p.id ? (
              <li key={p.id}>
                <ProjectForm project={p} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li
                key={p.id}
                className="flex items-start gap-3 rounded-lg border border-line px-3 py-2.5"
              >
                <HighlightToggle project={p} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  {p.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted">{p.description}</p>
                  )}
                  {p.techs && p.techs.length > 0 && (
                    <p className="mt-1 text-xs text-faint">{p.techs.join(" · ")}</p>
                  )}
                </div>
                <RowActions
                  onEdit={() => {
                    setEditing(p.id);
                    setAdding(false);
                  }}
                  onDelete={() => deleteProjectAction(p.id)}
                  deleteLabel={`Remover projeto ${p.title}`}
                />
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

function HighlightToggle({ project }: { project: ResumeProject }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => {
        await toggleProjectHighlightAction(project.id, !project.highlight);
      })}
      aria-pressed={project.highlight}
      aria-label={
        project.highlight
          ? `Tirar ${project.title} do currículo`
          : `Incluir ${project.title} no currículo`
      }
      className={`tip mt-0.5 shrink-0 transition-colors disabled:opacity-50 ${
        project.highlight ? "text-certificacao" : "text-faint hover:text-ink"
      }`}
    >
      <Star size={16} fill={project.highlight ? "currentColor" : "none"} />
    </button>
  );
}

function ProjectForm({ project, onDone }: { project?: ResumeProject; onDone: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setError(null);
    const fd = new FormData(ev.currentTarget);
    start(async () => {
      const res = project
        ? await updateProjectAction(project.id, fd)
        : await createProjectAction(fd);
      if (res.ok) {
        formRef.current?.reset();
        onDone();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="mb-2 flex flex-col gap-2 rounded-lg border border-line bg-surface-2 px-3 py-3"
    >
      <Field label="Título">
        <input name="title" defaultValue={project?.title} className={INPUT} />
      </Field>
      <Field label="Descrição">
        <textarea
          name="description"
          rows={3}
          defaultValue={project?.description ?? ""}
          className={`${INPUT} resize-y`}
        />
      </Field>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Link">
          <input
            name="url"
            type="url"
            placeholder="https://…"
            defaultValue={project?.url ?? ""}
            className={INPUT}
          />
        </Field>
        <Field label="Repositório">
          <input
            name="repoUrl"
            type="url"
            placeholder="https://github.com/…"
            defaultValue={project?.repoUrl ?? ""}
            className={INPUT}
          />
        </Field>
      </div>
      <Field label="Tecnologias (separadas por vírgula)">
        <input
          name="techs"
          defaultValue={project?.techs?.join(", ") ?? ""}
          className={INPUT}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="highlight"
          defaultChecked={project?.highlight ?? true}
          className="size-4"
        />
        Incluir no currículo
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas disabled:opacity-50"
        >
          {pending ? "Salvando…" : project ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}

// --- compartilhado ----------------------------------------------------------

const INPUT =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function RowActions({
  onEdit,
  onDelete,
  deleteLabel,
}: {
  onEdit: () => void;
  onDelete: () => Promise<unknown>;
  deleteLabel: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label="Editar"
        className="tip p-1 text-faint transition-colors hover:text-ink"
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          await onDelete();
        })}
        aria-label={deleteLabel}
        className="tip tip-left p-1 text-faint transition-colors hover:text-red-600 disabled:opacity-50"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}
