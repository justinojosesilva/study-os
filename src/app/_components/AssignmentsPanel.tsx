"use client";

import { useState, useTransition } from "react";
import { ClipboardList, Plus, Trash2, ExternalLink, Link2 } from "lucide-react";
import {
  createAssignmentAction,
  toggleDeliveredAction,
  setArtifactUrlAction,
  deleteAssignmentAction,
} from "@/app/_actions/assignments";
import type { AssignmentView } from "@/domain/assignments/repository";

/**
 * Atividades de entrega de um objetivo.
 *
 * A lista é ordenada por vencimento e NÃO separa entregues das pendentes: o
 * que já foi entregue permanece na sequência, riscado. Separar em duas listas
 * faz perder a leitura de "como foi o semestre", que é justamente o que o
 * histórico serve para mostrar.
 */

type TopicOption = { id: string; title: string };

function diasAte(d: Date): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(d);
  alvo.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

function prazoTexto(d: Date, entregue: boolean): { texto: string; classe: string } {
  const dias = diasAte(d);
  const data = new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  if (entregue) return { texto: data, classe: "text-faint" };
  if (dias < 0) {
    const n = Math.abs(dias);
    return { texto: `${data} · atrasada ${n} ${n === 1 ? "dia" : "dias"}`, classe: "text-red-600" };
  }
  if (dias === 0) return { texto: `${data} · hoje`, classe: "text-warning font-medium" };
  if (dias === 1) return { texto: `${data} · amanhã`, classe: "text-warning" };
  if (dias <= 7) return { texto: `${data} · em ${dias} dias`, classe: "text-muted" };
  return { texto: data, classe: "text-muted" };
}

export function AssignmentsPanel({
  goalId,
  items,
  topics,
}: {
  goalId: string;
  items: AssignmentView[];
  topics: TopicOption[];
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pendentes = items.filter((a) => !a.entregue).length;
  const atrasadas = items.filter((a) => a.atrasada).length;

  function criar(fd: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await createAssignmentAction({
        goalId,
        topicId: String(fd.get("topicId") ?? "") || null,
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        dueDate: String(fd.get("dueDate") ?? ""),
      });
      if (res.ok) setAbrindo(false);
      else setErro(res.error);
    });
  }

  return (
    <section className="mt-6 rounded-xl border border-line bg-surface px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <ClipboardList size={16} className="text-faculdade" />
          Atividades de entrega
          {pendentes > 0 && (
            <span className="text-xs font-normal text-muted">
              {pendentes} pendente{pendentes === 1 ? "" : "s"}
              {atrasadas > 0 && <span className="text-red-600"> · {atrasadas} atrasada{atrasadas === 1 ? "" : "s"}</span>}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setAbrindo((v) => !v)}
          className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
        >
          <Plus size={14} />
          {abrindo ? "Cancelar" : "Nova atividade"}
        </button>
      </div>

      {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}

      {abrindo && (
        <form action={criar} className="mb-4 flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
          <div className="flex flex-wrap gap-2">
            <input
              name="title"
              required
              autoFocus
              maxLength={200}
              placeholder="Ex: Trabalho de Cloud — entrega final"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
            <input
              name="dueDate"
              type="date"
              required
              aria-label="Data de entrega"
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            />
          </div>
          {topics.length > 0 && (
            <select
              name="topicId"
              aria-label="Aula relacionada (opcional)"
              defaultValue=""
              className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted"
            >
              <option value="">Sem aula específica</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <textarea
            name="description"
            rows={2}
            placeholder="O que precisa ser entregue (opcional)"
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="press self-start rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
          >
            {pending ? "Salvando…" : "Adicionar"}
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted">
          Nenhuma atividade cadastrada. Trabalhos, seminários e provas práticas entram aqui — e
          aparecem na agenda conforme o prazo se aproxima.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((a) => (
            <Linha key={a.id} atividade={a} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Linha({ atividade: a }: { atividade: AssignmentView }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [editandoLink, setEditandoLink] = useState(false);
  const prazo = prazoTexto(a.dueDate, a.entregue);

  function alternar() {
    setErro(null);
    startTransition(async () => {
      const res = await toggleDeliveredAction(a.id, !a.entregue);
      if (!res.ok) setErro(res.error);
    });
  }

  function salvarLink(fd: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await setArtifactUrlAction(a.id, String(fd.get("url") ?? ""));
      if (res.ok) setEditandoLink(false);
      else setErro(res.error);
    });
  }

  function remover() {
    setErro(null);
    startTransition(async () => {
      const res = await deleteAssignmentAction(a.id);
      if (!res.ok) setErro(res.error);
    });
  }

  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        a.atrasada ? "border-red-600/30" : "border-line"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={a.entregue}
          onChange={alternar}
          disabled={pending}
          aria-label={`Marcar "${a.title}" como ${a.entregue ? "pendente" : "entregue"}`}
          className="mt-0.5 size-4 shrink-0 accent-faculdade"
        />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${a.entregue ? "text-muted line-through" : ""}`}>
            {a.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
            <span className={prazo.classe}>{prazo.texto}</span>
            {a.topicTitle && <span className="text-faint">· {a.topicTitle}</span>}
            {a.artifactUrl && (
              <a
                href={a.artifactUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-profissional hover:underline"
              >
                <ExternalLink size={11} />
                artefato
              </a>
            )}
          </p>
          {a.description && <p className="mt-1 text-xs text-muted">{a.description}</p>}

          {editandoLink && (
            <form action={salvarLink} className="mt-2 flex flex-wrap items-center gap-1.5">
              <input
                name="url"
                type="url"
                autoFocus
                defaultValue={a.artifactUrl ?? ""}
                placeholder="https://github.com/…"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs"
              />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg border border-line px-2 py-1 text-xs font-medium disabled:opacity-50"
              >
                Salvar
              </button>
            </form>
          )}
          {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setEditandoLink((v) => !v)}
            aria-label={a.artifactUrl ? `Editar link de ${a.title}` : `Adicionar link a ${a.title}`}
            className="tip p-1 text-faint transition-colors hover:text-ink"
          >
            <Link2 size={14} />
          </button>
          <button
            type="button"
            onClick={remover}
            disabled={pending}
            aria-label={`Excluir ${a.title}`}
            className="tip tip-left p-1 text-faint transition-colors hover:text-red-600 disabled:opacity-50"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </li>
  );
}
