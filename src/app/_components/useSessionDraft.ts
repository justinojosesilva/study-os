"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Rascunho da anotação da sessão, preservado entre recargas.
 *
 * Mesma perda do cronômetro, em outro campo: a anotação é escrita DURANTE a
 * sessão e só vira linha no banco quando você salva. Um reload no meio levava
 * junto o texto — e anotação de uma hora de estudo não se reescreve de memória.
 *
 * Fica separado do `useStudyTimer` porque o texto mora nos componentes de
 * formulário, não no relógio. Compartilham só a convenção de chave, para que
 * apagar o rascunho de uma aula não apague o de outra.
 *
 * Gravação com atraso de propósito: `onChange` dispara a cada tecla, e escrever
 * no disco a cada tecla trava a digitação em texto longo.
 */

const ATRASO_MS = 400;

const chave = (escopo: string) => `latis:rascunho:${escopo}`;

export function useSessionDraft(escopo: string | undefined) {
  const [texto, setTexto] = useState("");
  const reidratado = useRef(false);

  // Reidrata uma vez. Mesmo motivo do cronômetro para não usar inicializador
  // preguiçoso: o servidor renderiza vazio e o cliente renderizaria o rascunho,
  // o que é divergência de hidratação.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!escopo || reidratado.current) return;
    reidratado.current = true;
    try {
      const salvo = window.localStorage.getItem(chave(escopo));
      if (salvo) setTexto(salvo);
    } catch {
      // Storage bloqueado. Seguir sem rascunho é melhor que quebrar o campo.
    }
  }, [escopo]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!escopo || !reidratado.current) return;
    const id = setTimeout(() => {
      try {
        if (texto) window.localStorage.setItem(chave(escopo), texto);
        else window.localStorage.removeItem(chave(escopo));
      } catch {
        /* idem */
      }
    }, ATRASO_MS);
    return () => clearTimeout(id);
  }, [escopo, texto]);

  /** Chamar DEPOIS de a sessão ser gravada — o rascunho já virou linha no banco. */
  const descartar = useCallback(() => {
    setTexto("");
    if (!escopo) return;
    try {
      window.localStorage.removeItem(chave(escopo));
    } catch {
      /* idem */
    }
  }, [escopo]);

  return { texto, setTexto, descartar };
}
