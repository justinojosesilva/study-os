"use client";

import { useState, useTransition } from "react";
import { Sparkles, Save, Printer, Copy, Check, TriangleAlert, Globe, Link2, ExternalLink } from "lucide-react";
import { saveResumeAction, generateResumeAction, setResumePublicAction } from "@/app/_actions/resume";
import type { ResumeData } from "@/domain/resume/data";
import type { CareerData } from "@/domain/resume/career";
import { CareerEditor } from "./CareerEditor";
import type { ResumeContact } from "@/infra/db/schema";
import { SkeletonBlock, SkeletonText } from "./Skeleton";
import { ResumeSheet, monthYear } from "./ResumeSheet";

type InitialProfile = {
  headline: string;
  summary: string;
  targetRole: string;
  contact: ResumeContact;
  highlights: string[];
};

export function ResumeWorkspace({
  initial,
  initialIsPublic,
  initialSlug,
  data,
  career,
}: {
  initial: InitialProfile;
  initialIsPublic: boolean;
  initialSlug: string | null;
  data: ResumeData;
  career: CareerData;
}) {
  const [headline, setHeadline] = useState(initial.headline);
  const [summary, setSummary] = useState(initial.summary);
  const [targetRole, setTargetRole] = useState(initial.targetRole);
  const [contact, setContact] = useState<ResumeContact>(initial.contact);
  const [highlightsText, setHighlightsText] = useState(initial.highlights.join("\n"));
  const [jobDescription, setJobDescription] = useState("");

  const [mocked, setMocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, startGenerate] = useTransition();
  const [saving, startSave] = useTransition();

  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [slug, setSlug] = useState<string | null>(initialSlug);
  const [linkCopied, setLinkCopied] = useState(false);
  const [publishing, startPublish] = useTransition();

  const highlights = highlightsText.split("\n").map((h) => h.trim()).filter(Boolean);
  const publicUrl = slug && typeof window !== "undefined" ? `${window.location.origin}/r/${slug}` : "";

  function togglePublish() {
    setError(null);
    startPublish(async () => {
      const res = await setResumePublicAction(!isPublic);
      if (res.ok) {
        setIsPublic(res.isPublic);
        setSlug(res.slug);
      } else {
        setError(res.error);
      }
    });
  }

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard
      ?.writeText(publicUrl)
      .then(() => {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      })
      .catch(() => setError("Não foi possível copiar o link."));
  }

  function setContactField(key: keyof ResumeContact, value: string) {
    setContact((c) => ({ ...c, [key]: value }));
  }

  function generate() {
    setError(null);
    startGenerate(async () => {
      const res = await generateResumeAction(targetRole, jobDescription);
      if (res.ok) {
        setHeadline(res.data.headline);
        setSummary(res.data.summary);
        setHighlightsText(res.data.highlights.join("\n"));
        setMocked(res.mocked);
      } else {
        setError(res.error);
      }
    });
  }

  function save() {
    setError(null);
    startSave(async () => {
      const res = await saveResumeAction({ headline, summary, targetRole, contact, highlights });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(res.error);
      }
    });
  }

  function copyMarkdown() {
    setError(null);
    const md = buildMarkdown({ headline, summary, contact, highlights }, data);
    navigator.clipboard
      ?.writeText(md)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setError("Não foi possível copiar. Use Imprimir / PDF para exportar."));
  }

  return (
    <div className="resume-grid grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div className="no-print flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="press inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            {saved ? <Check size={15} /> : <Save size={15} />} {saved ? "Salvo" : saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            onClick={copyMarkdown}
            className="press inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copiado" : "Markdown"}
          </button>
          <button
            onClick={() => window.print()}
            className="press inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-surface-2"
          >
            <Printer size={15} /> Imprimir / PDF
          </button>
        </div>

        {/* Share / publish */}
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <Globe size={15} className="text-profissional" /> Link público
            </h2>
            <button
              onClick={togglePublish}
              disabled={publishing}
              className={`press inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${
                isPublic
                  ? "border border-line bg-surface hover:bg-surface-2"
                  : "bg-ink text-canvas"
              }`}
            >
              {publishing ? "…" : isPublic ? "Despublicar" : "Publicar"}
            </button>
          </div>
          {isPublic && publicUrl ? (
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted"
              />
              <button
                onClick={copyLink}
                aria-label="Copiar link"
                className="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-xs font-medium hover:bg-surface-2"
              >
                {linkCopied ? <Check size={14} /> : <Link2 size={14} />}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir currículo público"
                className="press inline-flex shrink-0 items-center rounded-lg border border-line px-2.5 py-2 text-xs font-medium hover:bg-surface-2"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Publique para gerar um link somente-leitura que você pode compartilhar. As estatísticas
              de estudo não aparecem na versão pública.
            </p>
          )}
        </section>

        {/* AI panel */}
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-medium">
            <Sparkles size={15} className="text-certificacao" /> Adaptar com IA
          </h2>
          <p className="mb-3 text-xs text-muted">
            A IA escreve o resumo e os destaques a partir das suas competências reais.
          </p>
          <label className="mb-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Cargo-alvo</span>
            <input
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Ex: Arquiteto de Soluções Cloud"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted">Descrição da vaga (opcional)</span>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={3}
              placeholder="Cole a descrição da vaga para adaptar o texto a ela."
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>
          <button
            onClick={generate}
            disabled={generating}
            className="press mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            <Sparkles size={15} /> {generating ? "Gerando…" : "Gerar com IA"}
          </button>
          {mocked && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <TriangleAlert size={12} /> Demonstração (mock) — defina ANTHROPIC_API_KEY para geração real.
            </p>
          )}
          {generating && (
            <SkeletonBlock label="Gerando currículo…" className="mt-3">
              <SkeletonText lines={3} />
            </SkeletonBlock>
          )}
        </section>

        {/* Contact */}
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h2 className="mb-3 text-sm font-medium">Contato</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome" value={contact.name ?? ""} onChange={(v) => setContactField("name", v)} />
            <Input label="Email" value={contact.email ?? ""} onChange={(v) => setContactField("email", v)} />
            <Input label="Local" value={contact.location ?? ""} onChange={(v) => setContactField("location", v)} />
            <Input label="LinkedIn" value={contact.linkedin ?? ""} onChange={(v) => setContactField("linkedin", v)} />
            <Input label="GitHub" value={contact.github ?? ""} onChange={(v) => setContactField("github", v)} />
          </div>
        </section>

        {/* Headline + summary + highlights */}
        <section className="rounded-xl border border-line bg-surface px-5 py-4">
          <h2 className="mb-3 text-sm font-medium">Texto</h2>
          <div className="flex flex-col gap-3">
            <Input label="Headline" value={headline} onChange={setHeadline} />
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Resumo profissional</span>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted">Destaques (um por linha)</span>
              <textarea
                value={highlightsText}
                onChange={(e) => setHighlightsText(e.target.value)}
                rows={4}
                className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <CareerEditor career={career} github={contact.github} />
      </div>

      {/* Live preview / print sheet */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <ResumeSheet
          headline={headline}
          summary={summary}
          contact={contact}
          highlights={highlights}
          data={data}
          career={career}
        />
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
    </label>
  );
}

function buildMarkdown(
  p: { headline: string; summary: string; contact: ResumeContact; highlights: string[] },
  data: ResumeData,
): string {
  const lines: string[] = [];
  lines.push(`# ${p.contact.name || "Seu nome"}`);
  if (p.headline) lines.push(`**${p.headline}**`);
  const contactLine = [p.contact.email, p.contact.location, p.contact.linkedin, p.contact.github]
    .filter(Boolean)
    .join(" · ");
  if (contactLine) lines.push(contactLine);
  if (p.summary) lines.push("", "## Resumo", "", p.summary);
  if (p.highlights.length) {
    lines.push("", "## Destaques", "");
    for (const h of p.highlights) lines.push(`- ${h}`);
  }
  if (data.skills.length) {
    lines.push("", "## Competências", "");
    for (const s of data.skills) lines.push(`- **${s.goalTitle}:** ${s.topics.join(", ")}`);
  }
  if (data.certifications.length) {
    lines.push("", "## Certificações", "");
    for (const c of data.certifications) {
      const when = c.obtainedDate ? ` (${monthYear(c.obtainedDate)})` : "";
      lines.push(`- ${c.title} — ${c.provider}${when}`);
    }
  }
  if (data.focusAreas.length) {
    lines.push("", "## Áreas de foco", "");
    for (const g of data.focusAreas) lines.push(`- ${g.title} — ${g.masteredTopics}/${g.totalTopics} tópicos`);
  }
  lines.push(
    "",
    `_${data.stats.studyHours}h de estudo · ${data.stats.masteredTopics} tópicos dominados · sequência de ${data.stats.streak} dias_`,
  );
  return lines.join("\n");
}
