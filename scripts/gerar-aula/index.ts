import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SISTEMA_ESQUELETO, SISTEMA_SECAO, SISTEMA_LAB, pedidoSecao } from "./prompts";

/**
 * Gerador de aulas fora do Claude Code.
 *
 * POR QUE EXISTE. Gerar uma aula prática dentro do Claude Code consumia metade
 * de uma sessão só para começar. A causa não era o prompt: era a aula técnica
 * inteira — 24 mil tokens — viver no contexto enquanto o agente faz dezenas de
 * operações, e CADA operação reenvia o contexto como entrada. Aqui o contexto é
 * controlado: cada chamada recebe o esqueleto (~1,5 mil tokens), nunca o texto
 * completo.
 *
 * POR QUE EM PEDAÇOS. A maior aula da trilha tem 2125 linhas e 112 títulos —
 * cerca de 24 mil tokens de saída. Pedir isso numa chamada só arrisca truncar e
 * degrada a qualidade no fim. Seção por seção também torna o processo
 * RETOMÁVEL: cada seção pronta é gravada, e uma queda não perde o que já custou.
 *
 * ORÇAMENTO, e não a cota do app. `AI_DAILY_LIMIT_MICROS` existe para proteger a
 * superfície do app, onde um laço ou outra pessoa poderiam disparar gasto. Aqui
 * é o dono rodando um lote deliberado na própria máquina — o controle certo é um
 * teto explícito por execução, que o script anuncia e respeita.
 */

const PRECO = { entrada: 5, saida: 25 }; // US$ por milhão de tokens, opus-4-8
const MODEL = process.env.AULA_MODEL ?? "claude-opus-4-8";

type Uso = { entrada: number; saida: number };
const gasto = (u: Uso) => (u.entrada * PRECO.entrada + u.saida * PRECO.saida) / 1_000_000;

class Orcamento {
  private usado: Uso = { entrada: 0, saida: 0 };
  constructor(private readonly tetoUSD: number) {}
  registrar(u: Uso) {
    this.usado.entrada += u.entrada;
    this.usado.saida += u.saida;
  }
  get gastoUSD() {
    return gasto(this.usado);
  }
  get resumo() {
    return `${this.usado.entrada} in / ${this.usado.saida} out . US$ ${this.gastoUSD.toFixed(3)}`;
  }
  /** Confere ANTES de gastar. Estimar a saída pelo máximo evita estourar no fim. */
  cabe(saidaMax: number): boolean {
    const projetado = this.gastoUSD + (saidaMax * PRECO.saida) / 1_000_000;
    return projetado <= this.tetoUSD;
  }
}

async function chamar(
  client: Anthropic,
  orc: Orcamento,
  sistema: string,
  pedido: string,
  maxTokens: number,
): Promise<string> {
  if (!orc.cabe(maxTokens)) {
    throw new Error(
      `Orçamento estouraria nesta chamada (já usou US$ ${orc.gastoUSD.toFixed(3)}). ` +
        `Rode de novo com --orcamento maior; o que já foi gerado está salvo.`,
    );
  }
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: sistema,
    messages: [{ role: "user", content: pedido }],
  });
  orc.registrar({
    entrada: res.usage?.input_tokens ?? 0,
    saida: res.usage?.output_tokens ?? 0,
  });

  // Truncamento em SILÊNCIO é o pior defeito possível aqui: o esqueleto cortado
  // no meio de "### 11." parecia pronto, e as seções seriam escritas a partir
  // dele. Falhar alto custa uma reexecução; aceitar custa uma aula quebrada
  // descoberta só na hora de estudar por ela.
  if (res.stop_reason === "max_tokens") {
    throw new Error(
      `A resposta bateu no teto de ${maxTokens} tokens e veio cortada. ` +
        `Nada foi gravado. Aumente o limite desta etapa em scripts/gerar-aula/index.ts.`,
    );
  }

  return res.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Quebra o esqueleto em blocos de nível 2 — a unidade de uma chamada. */
function fatiar(esqueleto: string): string[] {
  const linhas = esqueleto.split("\n");
  const blocos: string[] = [];
  let atual: string[] = [];
  for (const l of linhas) {
    if (/^##\s/.test(l) && atual.length > 0) {
      blocos.push(atual.join("\n").trim());
      atual = [];
    }
    atual.push(l);
  }
  if (atual.length > 0) blocos.push(atual.join("\n").trim());
  return blocos.filter((b) => /^##\s/m.test(b));
}

async function main() {
  const args = process.argv.slice(2);
  const tema = args.filter((a) => !a.startsWith("--")).join(" ");
  const flag = (nome: string, padrao: string) =>
    args.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1] ?? padrao;

  if (!tema) {
    console.error("Uso: npm run aula -- \"Tema da aula\" [--orcamento=2] [--lab] [--saida=dir]");
    console.error("  --lab  gera o roteiro pratico a partir do esqueleto da aula ja gerada");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY nao esta definida (lida do .env).");
    process.exit(1);
  }

  const tetoUSD = Number(flag("orcamento", "2"));
  const dir = join(flag("saida", "aulas"), tema.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60));
  const querLab = args.includes("--lab");
  mkdirSync(dir, { recursive: true });

  const client = new Anthropic();
  const orc = new Orcamento(tetoUSD);
  console.log(`tema: ${tema}`);
  console.log(`saida: ${dir}/ . orcamento: US$ ${tetoUSD.toFixed(2)} . modelo: ${MODEL}\n`);

  // --- 1. esqueleto (retomavel) ---
  const arqEsq = join(dir, "_esqueleto.md");
  let esqueleto: string;
  if (existsSync(arqEsq)) {
    esqueleto = readFileSync(arqEsq, "utf8");
    console.log("esqueleto: reaproveitado do disco");
  } else {
    process.stdout.write("esqueleto: gerando… ");
    esqueleto = await chamar(client, orc, SISTEMA_ESQUELETO, `Tema da aula: ${tema}`, 10000);
    writeFileSync(arqEsq, esqueleto);
    console.log(`ok (${orc.resumo})`);
  }

  if (querLab) {
    const arqLab = join(dir, "lab.md");
    process.stdout.write("lab: gerando a partir do esqueleto… ");
    const lab = await chamar(
      client,
      orc,
      SISTEMA_LAB,
      `Tema da aula: ${tema}\n\nEsqueleto da aula:\n${esqueleto}`,
      16000,
    );
    writeFileSync(arqLab, lab);
    console.log(`ok\n\n${arqLab} . total ${orc.resumo}`);
    return;
  }

  // --- 2. secoes, uma chamada cada, retomavel ---
  const secoes = fatiar(esqueleto);
  console.log(`secoes a escrever: ${secoes.length}\n`);

  const partes: string[] = [];
  for (const [i, secao] of secoes.entries()) {
    const titulo = secao.split("\n")[0].replace(/^##\s*/, "").slice(0, 50);
    const arq = join(dir, `_s${String(i + 1).padStart(2, "0")}.md`);
    if (existsSync(arq)) {
      partes.push(readFileSync(arq, "utf8"));
      console.log(`  [${i + 1}/${secoes.length}] ${titulo} — do disco`);
      continue;
    }
    process.stdout.write(`  [${i + 1}/${secoes.length}] ${titulo} … `);
    const texto = await chamar(client, orc, SISTEMA_SECAO, pedidoSecao(tema, esqueleto, secao), 8000);
    writeFileSync(arq, texto);
    partes.push(texto);
    console.log(`ok (acumulado US$ ${orc.gastoUSD.toFixed(3)})`);
  }

  const final = join(dir, "aula.md");
  const texto = partes.join("\n\n---\n\n") + "\n";
  writeFileSync(final, texto);

  // Títulos contados FORA de blocos cercados: `# comentario` em bash não é
  // título, e contar sem esse cuidado inflou a medição por 30 numa comparação.
  let dentro = false;
  let titulos = 0;
  for (const l of texto.split("\n")) {
    if (/^\s*```/.test(l)) dentro = !dentro;
    else if (!dentro && /^#{2,4}\s/.test(l)) titulos += 1;
  }

  console.log(`\n${final}`);
  console.log(`  ${texto.length} chars . ${partes.length} seções . ${titulos} títulos`);
  if (titulos < 100) {
    console.log(`  AVISO: a referência da trilha tem ~127 títulos. Abaixo de 100 costuma`);
    console.log(`         indicar parede de texto — vale reler antes de estudar por ela.`);
  }
  console.log(`  total: ${orc.resumo}`);
}

main().catch((e) => {
  console.error("\nerro:", e.message);
  process.exit(1);
});
