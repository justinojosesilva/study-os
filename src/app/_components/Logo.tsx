/**
 * A marca do Latis Skills: três nós ligados, um preenchido.
 *
 * O nó cheio é o tópico dominado; os vazados, os que ele sustenta. É a mesma
 * ideia que o modelo de dados já usa — progresso é DERIVADO das ligações, não
 * guardado em nenhum lugar.
 *
 * Duas decisões que não são estéticas:
 *
 * 1. As arestas PARAM antes dos nós. Desenhadas de centro a centro, elas
 *    atravessariam o interior dos círculos vazados e a marca viraria rabisco.
 *    Os pontos de início e fim já saem recuados pelo raio mais uma folga.
 * 2. Existe uma variante `compacta`, e ela nasceu de medição, não de gosto.
 *    Rasterizando a arte grande a 16px, o FURO dos nós vazados fecha: os dois
 *    círculos viram borrões cinzas e a distinção dominado/não-dominado — que é
 *    o significado da marca — some. A correção é contraintuitiva: nó MAIOR com
 *    traço MAIS FINO (r 4.2→5.8, traço 3.6→2.8). O anel sobrevive porque o
 *    furo passa de ~1,6px para ~2,7px. As arestas encurtam junto, para o
 *    triângulo não empastelar com os nós maiores.
 *
 * Tudo em `currentColor`: herda o tema claro/escuro sem uma segunda versão.
 */

type Props = {
  /** Lado em pixels. Abaixo de 24 entra a variante compacta. */
  size?: number;
  className?: string;
};

export function Logo({ size = 24, className }: Props) {
  const compacta = size < 24;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {compacta ? (
        <>
          <g stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity="0.65">
            <path d="M19.6 19 L16.2 24.8" />
            <path d="M28.4 19 L31.8 24.8" />
            <path d="M19.4 33 L28.6 33" />
          </g>
          <circle cx="24" cy="11" r="6.4" fill="currentColor" />
          <circle cx="10.5" cy="33" r="5.8" fill="none" stroke="currentColor" strokeWidth="2.8" />
          <circle cx="37.5" cy="33" r="5.8" fill="none" stroke="currentColor" strokeWidth="2.8" />
        </>
      ) : (
        <>
          <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" opacity="0.55">
            <path d="M20.3 17.2 L14 28" />
            <path d="M27.7 17.2 L34 28" />
            <path d="M16.8 33 L31.2 33" />
          </g>
          <circle cx="24" cy="11" r="5.5" fill="currentColor" />
          <circle cx="11" cy="33" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
          <circle cx="37" cy="33" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.6" />
        </>
      )}
    </svg>
  );
}
