/**
 * Ordenação natural por número dentro do título.
 *
 * POR QUE EXISTE. `sortOrder` nasce como ordem de criação, e quem cadastra uma
 * disciplina inteira raramente digita na ordem certa — o objetivo da faculdade
 * ficou "Aula 6, 7, 8, 5, 9" por isso. Arrastar resolve, mas arrastar cinco
 * itens para consertar o que um número já diz é trabalho manual sobre uma
 * informação que está escrita ali.
 *
 * A ordenação alfabética comum NÃO resolve: ela põe "Aula 10" antes de
 * "Aula 2", porque compara caractere a caractere. Daí a comparação por
 * segmentos — texto com texto, número com número.
 */

/** Quebra "Aula 10 - Cloud" em ["aula ", 10, " - cloud"]. */
function segmentos(titulo: string): (string | number)[] {
  const partes = titulo.toLowerCase().match(/(\d+|\D+)/g) ?? [];
  return partes.map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

/**
 * Compara dois títulos por segmentos. Número perde para texto quando os tipos
 * divergem na mesma posição — assim "Aula 2" vem antes de "Aula extra", em vez
 * de a comparação depender de como o navegador ordena tipos diferentes.
 */
export function compararNatural(a: string, b: string): number {
  const sa = segmentos(a);
  const sb = segmentos(b);
  const n = Math.min(sa.length, sb.length);

  for (let i = 0; i < n; i++) {
    const x = sa[i];
    const y = sb[i];
    if (x === y) continue;
    if (typeof x === "number" && typeof y === "number") return x - y;
    if (typeof x === "number") return -1;
    if (typeof y === "number") return 1;
    return x < y ? -1 : 1;
  }
  return sa.length - sb.length;
}

/**
 * Diz se vale oferecer o botão. Sem pelo menos DOIS títulos numerados o
 * "ordenar por número" não tem o que ordenar, e um botão que não muda nada é
 * pior que botão nenhum.
 */
export function temNumeracao(titulos: string[]): boolean {
  const comNumero = titulos.filter((t) => /\d/.test(t));
  return comNumero.length >= 2;
}
