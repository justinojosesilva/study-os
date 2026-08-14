import { readFileSync } from "node:fs";

/**
 * Compara aulas em markdown pelas medidas que separam "aula navegável" de
 * "parede de texto".
 *
 * Existe porque a comparação a olho enganou: a saída do gerador era 58% MAIOR
 * em caracteres e seis vezes menos navegável que a referência. Tamanho não é
 * qualidade, e sem medir não dá para ver isso.
 *
 *   npx tsx scripts/comparar-aulas.ts rotulo=caminho.md [rotulo=outra.md ...]
 */

type Medida = {
  chars: number;
  h: number[];
  titulos: number;
  tabelas: number;
  codigo: number;
  mermaid: number;
  charsProsa: number;
  linhasProsa: number;
};

/** Conta SEMPRE fora de blocos cercados: `# comentario` em bash não é título,
 *  e ignorar isso já inflou uma medição em 30 títulos. */
function medir(caminho: string): Medida {
  const texto = readFileSync(caminho, "utf8");
  const m: Medida = {
    chars: texto.length,
    h: [0, 0, 0, 0, 0, 0],
    titulos: 0,
    tabelas: 0,
    codigo: 0,
    mermaid: 0,
    charsProsa: 0,
    linhasProsa: 0,
  };
  let dentro = false;
  for (const l of texto.split("\n")) {
    if (/^\s*```/.test(l)) {
      dentro = !dentro;
      if (dentro) {
        m.codigo += 1;
        if (/^\s*```mermaid/.test(l)) m.mermaid += 1;
      }
      continue;
    }
    if (dentro) continue;
    const t = /^(#{1,6})\s/.exec(l);
    if (t) {
      m.h[t[1].length - 1] += 1;
      if (t[1].length >= 2 && t[1].length <= 4) m.titulos += 1;
    } else if (/^\s*\|/.test(l)) m.tabelas += 1;
    else if (l.trim()) {
      m.linhasProsa += 1;
      m.charsProsa += l.length;
    }
  }
  return m;
}

const alvos = process.argv.slice(2).map((a) => {
  const i = a.indexOf("=");
  return i < 0 ? [a, a] : [a.slice(0, i), a.slice(i + 1)];
});

if (alvos.length === 0) {
  console.error("Uso: npx tsx scripts/comparar-aulas.ts rotulo=caminho.md [...]");
  process.exit(1);
}

const linhas = alvos.map(([rot, p]) => [rot, medir(p)] as const);
const col = (s: string | number, n = 12) => String(s).padStart(n);

console.log("".padEnd(24) + linhas.map(([r]) => col(r.slice(0, 12))).join(""));
const linha = (rotulo: string, f: (m: Medida) => string | number) =>
  console.log(rotulo.padEnd(24) + linhas.map(([, m]) => col(f(m))).join(""));

linha("caracteres", (m) => m.chars);
linha("títulos (H2–H4)", (m) => m.titulos);
linha("  H2", (m) => m.h[1]);
linha("  H3", (m) => m.h[2]);
linha("  H4", (m) => m.h[3]);
linha("linhas de tabela", (m) => m.tabelas);
linha("blocos de código", (m) => m.codigo);
linha("  mermaid", (m) => m.mermaid);
linha("linhas de prosa", (m) => m.linhasProsa);
linha("chars por linha", (m) => Math.round(m.charsProsa / (m.linhasProsa || 1)));
console.log();
linha("TÍTULOS / mil chars", (m) => (m.titulos / (m.charsProsa / 1000 || 1)).toFixed(2));
console.log(
  "\n  (a referência da trilha fica em ~3,0 — abaixo de 1,5 é parede de texto)",
);
