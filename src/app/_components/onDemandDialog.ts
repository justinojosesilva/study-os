"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Contrato dos diálogos montados sob demanda.
 *
 * O `TopicCard` montava os quatro diálogos do tópico — tutor, aulas, anotações
 * e flashcards. Num objetivo real de 42 tópicos isso era 168 `<dialog>`, 126
 * textareas e 845 KB de HTML, com todos fechados. É o mesmo problema que a
 * agenda tinha com um `SessionLogger` por bloco.
 *
 * A saída é a mesma: a linha renderiza SÓ o gatilho e pede ao provedor da
 * página para montar o diálogo. Um componente recebe `onRequestOpen` (é uma
 * linha da lista, não desenha `<dialog>`) ou `autoOpen`/`hideTrigger` (é a
 * instância única do provedor, não desenha gatilho).
 */
export type OnDemandProps = {
  /** Abre ao montar. O provedor monta uma instância nova por clique, então não
   *  há estado antigo para reaproveitar — abrir na montagem basta. */
  autoOpen?: boolean;
  hideTrigger?: boolean;
  /** Chamado no `close` do `<dialog>`, para o provedor desmontar a instância. */
  onDismiss?: () => void;
  /** Presente = esta instância é um gatilho de linha: clicar pede ao provedor
   *  e o `<dialog>` não é renderizado aqui. */
  onRequestOpen?: () => void;
};

export function useAutoOpen(
  ref: RefObject<HTMLDialogElement | null>,
  autoOpen?: boolean,
): void {
  const opened = useRef(false);
  useEffect(() => {
    if (!autoOpen || opened.current) return;
    opened.current = true;
    ref.current?.showModal();
  }, [autoOpen, ref]);
}
