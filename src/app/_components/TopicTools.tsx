"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { TutorDialog } from "./TutorDialog";
import { LessonsDialog } from "./LessonsDialog";
import { NotesDialog } from "./NotesDialog";
import { FlashcardsDialog } from "./FlashcardsDialog";
import type { NoteListItem } from "@/domain/notes/repository";

/**
 * Um diálogo de cada tipo para a página inteira, montado ao clicar.
 *
 * Cada `TopicCard` montava os quatro. Medido num objetivo de 42 tópicos —
 * o tamanho real do "Especialista em Design Patterns":
 *
 *   diálogos      170
 *   textareas     127
 *   selects        86
 *   nós de DOM  7.881
 *   HTML         845 KB
 *
 * Todos fechados. É a mesma correção que a agenda recebeu: a linha renderiza
 * só o gatilho (`onRequestOpen`), e o provedor monta a instância de verdade,
 * com chave por lançamento para nascer limpa em vez de precisar de reset.
 */

export type CardLite = { id: string; front: string; back: string };
export type LessonLite = {
  id: string;
  title: string;
  kind: "aula" | "lab";
  completedAt: Date | null;
};

export type TopicToolKind = "tutor" | "lessons" | "notes" | "cards";

export type TopicToolRequest = {
  kind: TopicToolKind;
  topicId: string;
  topicTitle: string;
  goalId: string;
  lessons: LessonLite[];
  notes: NoteListItem[];
  cards: CardLite[];
};

type Opener = (req: TopicToolRequest) => void;

const ToolsCtx = createContext<Opener | null>(null);

export function TopicToolsProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<(TopicToolRequest & { seq: number }) | null>(null);

  // `seq` distingue dois cliques no MESMO botão, para o diálogo remontar em vez
  // de reabrir com o estado da vez anterior (resposta do tutor, rascunho, erro).
  const open = useCallback<Opener>((req) => {
    setRequest((prev) => ({ ...req, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  return (
    <ToolsCtx.Provider value={open}>
      {children}
      {request && <Mounted request={request} onDismiss={() => setRequest(null)} />}
    </ToolsCtx.Provider>
  );
}

function Mounted({
  request,
  onDismiss,
}: {
  request: TopicToolRequest & { seq: number };
  onDismiss: () => void;
}) {
  const key = `${request.kind}-${request.topicId}-${request.seq}`;
  const shared = { autoOpen: true as const, hideTrigger: true as const, onDismiss };

  switch (request.kind) {
    case "tutor":
      return (
        <TutorDialog
          key={key}
          topicId={request.topicId}
          topicTitle={request.topicTitle}
          {...shared}
        />
      );
    case "lessons":
      return (
        <LessonsDialog
          key={key}
          topicId={request.topicId}
          topicTitle={request.topicTitle}
          goalId={request.goalId}
          lessons={request.lessons}
          {...shared}
        />
      );
    case "notes":
      return (
        <NotesDialog
          key={key}
          topicId={request.topicId}
          topicTitle={request.topicTitle}
          goalId={request.goalId}
          notes={request.notes}
          {...shared}
        />
      );
    case "cards":
      return (
        <FlashcardsDialog
          key={key}
          topicId={request.topicId}
          topicTitle={request.topicTitle}
          goalId={request.goalId}
          cards={request.cards}
          {...shared}
        />
      );
  }
}

/**
 * Fora de um provedor devolve `null`, e o `TopicCard` cai de volta em montar o
 * próprio diálogo — o que mantém o cartão utilizável isolado, como o botão da
 * agenda.
 */
export function useTopicTools(): Opener | null {
  return useContext(ToolsCtx);
}
