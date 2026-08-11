"use client";

import { memo } from "react";
import { useSortable } from "@dnd-kit/react/sortable";
import { TopicCard } from "./TopicCard";
import type { CardLite, LessonLite } from "./TopicTools";
import type { NoteListItem } from "@/domain/notes/repository";
import type { Topic } from "@/infra/db/schema";

type TopicLite = Pick<Topic, "id" | "title" | "weight" | "status" | "phase">;

/**
 * Um `TopicCard` que sabe ser arrastado.
 *
 * A separação existe para o `TopicCard` continuar sem saber que ordenação
 * manual existe: ele recebe dois refs e um booleano, e é só isso. Quem monta a
 * lista decide se ela é arrastável.
 *
 * `memo` não é otimização prematura aqui — durante um arrasto o grupo inteiro
 * re-renderiza a cada movimento do ponteiro, e cada cartão carrega diálogos de
 * tutor, flashcards e anotações.
 */
export const SortableTopic = memo(function SortableTopic({
  topic,
  index,
  grupo,
  goalId,
  cards,
  lessons,
  notes,
  phases,
}: {
  topic: TopicLite;
  index: number;
  /** Chave da fase. `""` é o grupo "sem fase". */
  grupo: string;
  goalId: string;
  cards: CardLite[];
  lessons: LessonLite[];
  notes: NoteListItem[];
  phases: string[];
}) {
  const { ref, handleRef, isDragging } = useSortable({
    id: topic.id,
    index,
    group: grupo,
    type: "topico",
    // Só aceita outro tópico. Sem isso o cartão viraria alvo de qualquer
    // arrasto da página.
    accept: "topico",
    // O `move()` do @dnd-kit/helpers lê daqui para saber de qual chave do
    // registro o item saiu.
    data: { group: grupo },
  });

  return (
    <TopicCard
      topic={topic}
      goalId={goalId}
      cards={cards}
      lessons={lessons}
      notes={notes}
      phases={phases}
      dragRef={ref}
      handleRef={handleRef}
      dragging={isDragging}
    />
  );
});
