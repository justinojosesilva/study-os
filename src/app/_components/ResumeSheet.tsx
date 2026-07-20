import { BadgeCheck } from "lucide-react";
import type { ResumeData } from "@/domain/resume/data";
import type { ResumeContact } from "@/infra/db/schema";

/**
 * Presentational résumé sheet — no hooks, so it renders in both the client
 * editor (live preview) and the server-rendered public page (/r/[slug]).
 * `showStats` gates the study-stats footer: shown in-app, hidden on the public
 * page (hours/streak feel internal on a shared résumé).
 */

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function monthYear(d: Date | null): string {
  if (!d) return "";
  return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

export function ResumeSheet({
  headline,
  summary,
  contact,
  highlights,
  data,
  showStats = true,
}: {
  headline: string;
  summary: string;
  contact: ResumeContact;
  highlights: string[];
  data: ResumeData;
  showStats?: boolean;
}) {
  const contactLine = [contact.email, contact.location, contact.linkedin, contact.github]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="resume-sheet rounded-xl border border-line bg-surface px-7 py-7">
      <header className="border-b border-line pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{contact.name || "Seu nome"}</h1>
        {headline && <p className="mt-0.5 text-sm text-profissional">{headline}</p>}
        {contactLine && <p className="mt-2 text-xs text-muted">{contactLine}</p>}
      </header>

      {summary && (
        <Section title="Resumo">
          <p className="text-sm leading-relaxed">{summary}</p>
        </Section>
      )}

      {highlights.length > 0 && (
        <Section title="Destaques">
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm leading-relaxed">
            {highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </Section>
      )}

      {data.skills.length > 0 && (
        <Section title="Competências">
          <div className="flex flex-col gap-2.5">
            {data.skills.map((s) => (
              <div key={s.goalTitle}>
                <p className="text-sm font-medium">{s.goalTitle}</p>
                <p className="mt-0.5 text-sm text-muted">{s.topics.join(" · ")}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.certifications.length > 0 && (
        <Section title="Certificações">
          <ul className="flex flex-col gap-1.5">
            {data.certifications.map((c, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck size={14} className="shrink-0 text-faculdade" />
                  <span className="font-medium">{c.title}</span>
                  <span className="text-muted">· {c.provider}</span>
                </span>
                {c.obtainedDate && (
                  <span className="shrink-0 text-xs text-faint">{monthYear(c.obtainedDate)}</span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.focusAreas.length > 0 && (
        <Section title="Áreas de foco">
          <ul className="flex flex-col gap-1 text-sm">
            {data.focusAreas.map((g, i) => (
              <li key={i} className="flex items-baseline justify-between gap-3">
                <span>{g.title}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {g.masteredTopics}/{g.totalTopics} tópicos
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {showStats && (
        <p className="mt-6 text-[11px] text-faint">
          {data.stats.studyHours}h de estudo · {data.stats.masteredTopics} tópicos dominados ·
          sequência de {data.stats.streak} dias
        </p>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">{title}</h2>
      {children}
    </section>
  );
}
