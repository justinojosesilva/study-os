"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Trash2, ExternalLink, BadgeCheck, CalendarClock, TriangleAlert } from "lucide-react";
import {
  setCertificationStatusAction,
  deleteCertificationAction,
} from "@/app/_actions/certifications";
import type { CertificationView } from "@/domain/certifications/repository";
import { CertificationForm } from "./CertificationForm";
import { daysUntil, formatMonthYear } from "@/lib/date";

type GoalOption = { id: string; title: string };

const STATUS_CHIP: Record<CertificationView["status"], { label: string; cls: string }> = {
  planned: { label: "Planejada", cls: "bg-surface-2 text-muted" },
  scheduled: { label: "Agendada", cls: "bg-profissional-soft text-profissional" },
  passed: { label: "Conquistada", cls: "bg-faculdade-soft text-faculdade" },
  failed: { label: "Não passou", cls: "bg-red-600/10 text-red-600" },
  expired: { label: "Expirada", cls: "bg-warning/15 text-warning" },
};

export function CertCard({ cert, goals }: { cert: CertificationView; goals: GoalOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const chip = STATUS_CHIP[cert.status];
  const isPending = cert.status === "planned" || cert.status === "scheduled";

  function markPassed() {
    setError(null);
    startTransition(async () => {
      const res = await setCertificationStatusAction(cert.id, "passed");
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteCertificationAction(cert.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="rounded-xl border border-line bg-surface px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
              {cert.provider}
            </span>
            <span className="truncate font-medium">{cert.title}</span>
            {cert.code && <span className="text-xs text-faint">{cert.code}</span>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <Deadline cert={cert} />
          </div>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${chip.cls}`}>
          {chip.label}
        </span>
      </div>

      {cert.readinessPct != null && isPending && (
        <Link href={`/goals/${cert.goalId}`} className="mt-3 block">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-muted">Prontidão</span>
            <span className="font-medium tabular-nums">{cert.readinessPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full origin-left rounded-full bg-certificacao motion-safe:animate-grow-x"
              style={{ width: `${cert.readinessPct}%` }}
            />
          </div>
        </Link>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex items-center gap-3">
          {cert.status === "passed" && cert.credentialUrl && (
            <a
              href={cert.credentialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-profissional hover:underline"
            >
              <BadgeCheck size={14} /> Ver credencial <ExternalLink size={11} />
            </a>
          )}
          {isPending && (
            <button
              onClick={markPassed}
              disabled={pending}
              className="press inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              <BadgeCheck size={13} /> Marcar conquistada
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <CertificationForm goals={goals} cert={cert} />
          <button
            onClick={remove}
            disabled={pending}
            aria-label="Remover certificação"
            className="text-faint transition-colors hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </li>
  );
}

/** Contextual date line: countdown to exam, obtained month, or expiry warning. */
function Deadline({ cert }: { cert: CertificationView }) {
  const parts: React.ReactNode[] = [];

  if ((cert.status === "planned" || cert.status === "scheduled") && cert.examDate) {
    const d = daysUntil(cert.examDate);
    const soon = d >= 0 && d <= 14;
    parts.push(
      <span key="exam" className={`inline-flex items-center gap-1 ${soon ? "text-warning" : "text-muted"}`}>
        <CalendarClock size={13} />
        {d >= 0 ? `Prova em ${d} ${d === 1 ? "dia" : "dias"}` : `Prova ${formatMonthYear(cert.examDate)}`}
      </span>,
    );
  }

  if (cert.status === "passed" && cert.obtainedDate) {
    parts.push(
      <span key="got" className="text-muted">
        Conquistada em {formatMonthYear(cert.obtainedDate)}
      </span>,
    );
  }

  if (cert.status === "passed" && cert.expiresDate) {
    const d = daysUntil(cert.expiresDate);
    const soon = d >= 0 && d <= 90;
    parts.push(
      <span key="exp" className={`inline-flex items-center gap-1 ${soon ? "text-warning" : "text-faint"}`}>
        {soon && <TriangleAlert size={13} />}
        {d >= 0 ? `Expira em ${formatMonthYear(cert.expiresDate)}` : `Expirou ${formatMonthYear(cert.expiresDate)}`}
      </span>,
    );
  }

  if (parts.length === 0) return null;
  return <>{parts}</>;
}
