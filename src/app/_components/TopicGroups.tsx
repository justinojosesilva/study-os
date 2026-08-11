"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Layers3, Sparkles, ArrowDownNarrowWide } from "lucide-react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { CollisionPriority } from "@dnd-kit/abstract";
import { groupTopicsIntoPhasesAction } from "@/app/_actions/ai";
import { reorderTopicsAction } from "@/app/_actions/topics";
import { SortableTopic } from "./SortableTopic";
import { compararNatural, temNumeracao } from "@/lib/natural-order";
import type { NoteListItem } from "@/domain/notes/repository";
import { PRACTICING_CREDIT } from "@/lib/progress";
import type { Topic } from "@/infra/db/schema";

type TopicLite = Pick<Topic, "id" | "title" | "weight" | "status" | "phase">;

/**
 * Chave do grupo "sem fase". Precisa ser uma string de verdade e não `""`:
 * ela vira o `id` do alvo de soltura, e um id vazio é falsy — a fase sem nome
 * simplesmente não receberia nada.
 */
const SEM_FASE = "__sem_fase__";
const rotulo = (chave: string) => (chave === SEM_FASE ? "Sem fase" : chave);
type CardLite = { id: string; front: string; back: string };
type LessonLite = { id: string; title: string; kind: "aula" | "lab"; completedAt: Date | null };

/**
 * Topic list grouped by learning phase, com ordenação manual.
 *
 * Grouping is what makes cards viable: a goal here can hold 42 topics, and 42
 * cards in one column is a longer wall than the list it replaced. Phases turn
 * that into a handful of readable stages — and give each stage its own progress,
 * which a flat list can't show.
 *
 * A ordem vem de `topics.sortOrder`, que era só ordem de criação. Isso quebrava
 * justamente onde a ordem importa: uma disciplina cadastrada fora de sequência
 * ficava "Aula 6, 7, 8, 5, 9" para sempre. Agora há dois caminhos para
 * consertar, e eles servem a casos diferentes:
 *
 *   - ARRASTAR, para ordem que só existe na sua cabeça.
 *   - ORDENAR POR NÚMERO, para quando o título já diz a ordem. Arrastar cinco
 *     itens para reproduzir o que "Aula 5..9" já informa é trabalho manual
 *     sobre informação existente — e num objetivo de 42 tópicos, é pior.
 *
 * O estado local espelha o servidor durante o arrasto e é reconciliado quando o
 * `revalidatePath` traz a lista nova. Sem esse espelho, cada movimento do
 * ponteiro esperaria uma ida ao banco.
 */
export function TopicGroups({
  goalId,
  topics,
  cardsByTopic,
  lessonsByTopic,
  notesByTopic,
}: {
  goalId: string;
  topics: TopicLite[];
  cardsByTopic: Map<string, CardLite[]>;
  lessonsByTopic: Map<string, LessonLite[]>;
  notesByTopic: Map<string, NoteListItem[]>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [salvando, startSalvar] = useTransition();

  const porId = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);

  // Agrupamento vindo do servidor. Os tópicos chegam por sortOrder, que já
  // codifica a sequência das fases — então a ordem de primeira aparição é a
  // ordem certa dos grupos também.
  const doServidor = useMemo(() => {
    const g: Record<string, string[]> = {};
    const seq: string[] = [];
    for (const t of topics) {
      const key = t.phase?.trim() || SEM_FASE;
      if (!(key in g)) {
        g[key] = [];
        seq.push(key);
      }
      g[key].push(t.id);
    }
    // Sem fase por último: é área de espera, não etapa.
    seq.sort((a, b) => (a === SEM_FASE ? 1 : b === SEM_FASE ? -1 : 0));
    const ordenado: Record<string, string[]> = {};
    for (const k of seq) ordenado[k] = g[k];
    return ordenado;
  }, [topics]);

  const [grupos, setGrupos] = useState(doServidor);
  // Espelho do estado para o `onDragEnd` ler: o handler roda no mesmo tick do
  // último `onDragOver`, e `grupos` ainda seria o valor da renderização anterior.
  const atualRef = useRef(doServidor);

  // Reconcilia com o servidor sempre que a lista muda de verdade. Comparar o
  // conteúdo, e não a referência, evita descartar um arrasto em andamento a
  // cada re-render do pai.
  const assinatura = JSON.stringify(doServidor);
  const ultimaAssinatura = useRef(assinatura);
  useEffect(() => {
    if (ultimaAssinatura.current !== assinatura) {
      ultimaAssinatura.current = assinatura;
      setGrupos(doServidor);
      atualRef.current = doServidor;
    }
  }, [assinatura, doServidor]);

  const ordered = Object.entries(grupos);
  const grouped = ordered.some(([name]) => name !== SEM_FASE);
  const phaseNames = ordered.map(([name]) => name).filter((n) => n !== SEM_FASE);

  /** Persiste a ordem inteira do objetivo, achatando os grupos na sequência da tela. */
  function persistir(novos: Record<string, string[]>) {
    const ordem: { id: string; phase: string | null }[] = [];
    for (const [fase, ids] of Object.entries(novos)) {
      for (const id of ids) ordem.push({ id, phase: fase === SEM_FASE ? null : fase });
    }
    setError(null);
    startSalvar(async () => {
      const res = await reorderTopicsAction(goalId, ordem);
      if (!res.ok) {
        setError(res.error);
        setGrupos(doServidor); // desfaz a ordem otimista
      }
    });
  }

  function organize() {
    setError(null);
    startTransition(async () => {
      const res = await groupTopicsIntoPhasesAction(goalId);
      if (!res.ok) setError(res.error);
    });
  }

  function ordenarPorNumero(fase: string) {
    const ids = [...(grupos[fase] ?? [])];
    ids.sort((a, b) =>
      compararNatural(porId.get(a)?.title ?? "", porId.get(b)?.title ?? ""),
    );
    const novos = { ...grupos, [fase]: ids };
    setGrupos(novos);
    atualRef.current = novos;
    persistir(novos);
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-medium">Tópicos</h2>
        <div className="flex items-center gap-2">
          {salvando && <span className="text-xs text-faint">salvando ordem…</span>}
          {topics.length >= 2 && (
            <button
              type="button"
              onClick={organize}
              disabled={pending}
              className="press inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              <Sparkles size={14} className="text-certificacao" />
              {pending ? "Organizando…" : grouped ? "Reorganizar fases" : "Organizar em fases"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <DragDropProvider
        onDragOver={(event) =>
          setGrupos((atual) => {
            const proximo = move(atual, event);
            // O updater tem de ser PURO. `persistir` mora aqui fora porque em
            // StrictMode o React chama o updater duas vezes — e um efeito
            // colateral dentro dele viraria duas gravações por arrasto.
            atualRef.current = proximo;
            return proximo;
          })
        }
        onDragEnd={(event) => {
          if (event.canceled) {
            setGrupos(doServidor);
            atualRef.current = doServidor;
            return;
          }
          persistir(atualRef.current);
        }}
      >
        <div className="flex flex-col gap-5">
          {ordered.map(([name, ids], indiceGrupo) => {
            const lista = ids.map((id) => porId.get(id)).filter((t): t is TopicLite => Boolean(t));
            return (
              <FaseGrupo
                key={name}
                nome={name}
                indice={indiceGrupo}
                mostrarCabecalho={grouped}
                progresso={phaseProgress(lista)}
                podeOrdenarPorNumero={
                  lista.length >= 2 && temNumeracao(lista.map((t) => t.title))
                }
                aoOrdenarPorNumero={() => ordenarPorNumero(name)}
              >
                {lista.map((t, i) => (
                  <SortableTopic
                    key={t.id}
                    topic={t}
                    index={i}
                    grupo={name}
                    goalId={goalId}
                    cards={cardsByTopic.get(t.id) ?? []}
                    lessons={lessonsByTopic.get(t.id) ?? []}
                    notes={notesByTopic.get(t.id) ?? []}
                    phases={phaseNames}
                  />
                ))}
              </FaseGrupo>
            );
          })}
        </div>
      </DragDropProvider>
    </>
  );
}

/**
 * Um grupo de fase, que também é alvo de soltura.
 *
 * Precisa ser `useSortable` e não só uma `<ul>`: sem um alvo próprio, uma fase
 * VAZIA não aceitaria nada, e mover o último tópico para fora dela deixaria um
 * grupo onde não dá mais para voltar.
 *
 * Três detalhes aqui são load-bearing, e errar qualquer um dos três mata o
 * arrasto inteiro em silêncio — sem erro no console, só nada acontecendo:
 *
 *   - O `id` É a chave do registro de grupos. O `move()` do helpers casa o
 *     alvo com a chave; um id decorado tipo `fase:X` nunca casa, e soltar numa
 *     fase vazia não faz nada.
 *   - NÃO leva `group`. O grupo é dos itens. Declarar o contêiner como membro
 *     do próprio grupo faz ele competir por índice com os filhos.
 *   - `collisionPriority` BAIXA. Sem isso o contêiner disputa a soltura com os
 *     próprios cartões, e como ele é maior, quase sempre ganha — o item nunca
 *     encontra a posição entre dois vizinhos.
 */
function FaseGrupo({
  nome,
  indice,
  mostrarCabecalho,
  progresso,
  podeOrdenarPorNumero,
  aoOrdenarPorNumero,
  children,
}: {
  nome: string;
  indice: number;
  mostrarCabecalho: boolean;
  progresso: number;
  podeOrdenarPorNumero: boolean;
  aoOrdenarPorNumero: () => void;
  children: React.ReactNode;
}) {
  const { ref } = useSortable({
    id: nome,
    type: "fase",
    accept: "topico",
    index: indice,
    collisionPriority: CollisionPriority.Low,
  });

  return (
    <section>
      {mostrarCabecalho && (
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-medium">
            <Layers3 size={14} className="text-faint" />
            {rotulo(nome)}
          </h3>
          <div className="flex items-center gap-2">
            {podeOrdenarPorNumero && (
              <button
                type="button"
                onClick={aoOrdenarPorNumero}
                className="press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
              >
                <ArrowDownNarrowWide size={13} />
                Ordenar por número
              </button>
            )}
            <span className="text-xs text-muted tabular-nums">{progresso}%</span>
          </div>
        </div>
      )}
      {!mostrarCabecalho && podeOrdenarPorNumero && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={aoOrdenarPorNumero}
            className="press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowDownNarrowWide size={13} />
            Ordenar por número
          </button>
        </div>
      )}
      <ul ref={ref} className="flex flex-col gap-2">
        {children}
      </ul>
    </section>
  );
}

/** Same credit rule as the goal bar, applied to one phase. */
function phaseProgress(list: TopicLite[]): number {
  const total = list.reduce((s, t) => s + t.weight, 0);
  if (total === 0) return 0;
  const earned = list.reduce(
    (s, t) =>
      s +
      (t.status === "mastered"
        ? t.weight
        : t.status === "praticando"
          ? t.weight * PRACTICING_CREDIT
          : 0),
    0,
  );
  return Math.round((earned / total) * 100);
}
