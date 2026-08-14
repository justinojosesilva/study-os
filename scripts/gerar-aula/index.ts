import "dotenv/config";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import {
  SISTEMA_ESQUELETO,
  SISTEMA_SECAO,
  SISTEMA_LAB,
  contextoEstavel,
  pedidoSecao,
} from "./prompts";

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

/**
 * Multiplicadores do cache de prompt. Ler custa 0,1× a entrada; ESCREVER custa
 * 1,25×. Daí a regra que decide onde cachear: só compensa quando o mesmo
 * prefixo vai ser lido mais de uma vez. Uma chamada única com cache sai MAIS
 * cara que sem.
 */
const CACHE_LEITURA = 0.1;
const CACHE_ESCRITA = 1.25;

type Uso = {
  entrada: number;
  saida: number;
  /** Tokens gravados no cache nesta chamada (custam 1,25×). */
  cacheEscrito: number;
  /** Tokens servidos do cache (custam 0,1×). */
  cacheLido: number;
};

const gasto = (u: Uso) =>
  (u.entrada * PRECO.entrada +
    u.cacheEscrito * PRECO.entrada * CACHE_ESCRITA +
    u.cacheLido * PRECO.entrada * CACHE_LEITURA +
    u.saida * PRECO.saida) /
  1_000_000;

class Orcamento {
  private usado: Uso = { entrada: 0, saida: 0, cacheEscrito: 0, cacheLido: 0 };
  constructor(private readonly tetoUSD: number) {}
  registrar(u: Uso) {
    this.usado.entrada += u.entrada;
    this.usado.saida += u.saida;
    this.usado.cacheEscrito += u.cacheEscrito;
    this.usado.cacheLido += u.cacheLido;
  }
  get gastoUSD() {
    return gasto(this.usado);
  }
  get resumo() {
    const c = this.usado;
    const cache =
      c.cacheLido > 0 || c.cacheEscrito > 0
        ? ` (cache: ${c.cacheLido} lidos / ${c.cacheEscrito} escritos)`
        : "";
    return `${c.entrada} in / ${c.saida} out${cache} . US$ ${this.gastoUSD.toFixed(3)}`;
  }
  /** O que a entrada teria custado sem cache — para provar que valeu. */
  get economiaUSD() {
    const c = this.usado;
    const semCache = ((c.entrada + c.cacheEscrito + c.cacheLido) * PRECO.entrada) / 1_000_000;
    const comCache =
      (c.entrada * PRECO.entrada +
        c.cacheEscrito * PRECO.entrada * CACHE_ESCRITA +
        c.cacheLido * PRECO.entrada * CACHE_LEITURA) /
      1_000_000;
    return semCache - comCache;
  }
  /** Confere ANTES de gastar. Estimar a saída pelo máximo evita estourar no fim. */
  cabe(saidaMax: number): boolean {
    const projetado = this.gastoUSD + (saidaMax * PRECO.saida) / 1_000_000;
    return projetado <= this.tetoUSD;
  }
}

/**
 * Um bloco de system. `cachear` marca o ponto de corte do cache.
 *
 * A ordem de renderização é tools → system → messages, e o cache casa por
 * PREFIXO: marcar o último bloco estável guarda tudo que veio antes dele. Por
 * isso o esqueleto entra aqui, e não na mensagem do usuário — lá ele ficaria
 * depois da parte que varia a cada seção, e nada seria reaproveitado.
 */
type BlocoSistema = { texto: string; cachear?: boolean };

async function chamar(
  client: Anthropic,
  orc: Orcamento,
  sistema: string | BlocoSistema[],
  pedido: string,
  maxTokens: number,
): Promise<string> {
  if (!orc.cabe(maxTokens)) {
    throw new Error(
      `Orçamento estouraria nesta chamada (já usou US$ ${orc.gastoUSD.toFixed(3)}). ` +
        `Rode de novo com --orcamento maior; o que já foi gerado está salvo.`,
    );
  }

  const system =
    typeof sistema === "string"
      ? sistema
      : sistema.map((b) => ({
          type: "text" as const,
          text: b.texto,
          ...(b.cachear ? { cache_control: { type: "ephemeral" as const } } : {}),
        }));

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: pedido }],
  });
  orc.registrar({
    entrada: res.usage?.input_tokens ?? 0,
    saida: res.usage?.output_tokens ?? 0,
    cacheEscrito: res.usage?.cache_creation_input_tokens ?? 0,
    cacheLido: res.usage?.cache_read_input_tokens ?? 0,
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

type Pedaco = { rotulo: string; spec: string; chave: string };

/**
 * Acima disto, uma seção de nível 2 é fatiada por nível 3.
 *
 * Não é número arbitrário: a "Explicação detalhada" tem 9 subseções de nível 3
 * e 36 de nível 4, contra 2 a 9 de todas as outras — é outlier por um fator de
 * cinco. Numa chamada só ela estourou 8000 tokens de saída. Aumentar o teto
 * empurraria o problema: 16 mil tokens numa resposta degradam no fim, que é
 * justamente onde mora o conteúdo mais avançado.
 */
const LIMITE_H3 = 5;

/** Nome de arquivo estável a partir do título, para o cache não depender de
 *  POSIÇÃO. Com índice, mudar o fatiamento desalinhava tudo que já foi pago. */
function chaveDe(rotulo: string): string {
  return rotulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

/** Quebra o esqueleto na unidade de uma chamada. */
function fatiar(esqueleto: string): Pedaco[] {
  const linhas = esqueleto.split("\n");

  // 1) agrupa por nível 2
  const grupos: string[][] = [];
  let atual: string[] = [];
  for (const l of linhas) {
    if (/^##\s/.test(l) && atual.length > 0) {
      grupos.push(atual);
      atual = [];
    }
    atual.push(l);
  }
  if (atual.length > 0) grupos.push(atual);

  // 2) fatia por nível 3 os grupos grandes demais
  const pedacos: Pedaco[] = [];
  for (const g of grupos.filter((g) => g.some((l) => /^##\s/.test(l)))) {
    const tituloH2 = g.find((l) => /^##\s/.test(l))!.replace(/^##\s*/, "").trim();
    const indicesH3 = g.map((l, i) => (/^###\s/.test(l) ? i : -1)).filter((i) => i >= 0);

    if (indicesH3.length <= LIMITE_H3) {
      pedacos.push({ rotulo: tituloH2, spec: g.join("\n").trim(), chave: chaveDe(tituloH2) });
      continue;
    }

    // Cabeçalho do grupo (o que vem antes do primeiro nível 3) acompanha a
    // primeira fatia, senão o título da seção some do documento montado.
    const cabecalho = g.slice(0, indicesH3[0]).join("\n").trim();
    for (const [n, ini] of indicesH3.entries()) {
      const fim = indicesH3[n + 1] ?? g.length;
      const corpo = g.slice(ini, fim).join("\n").trim();
      const tituloH3 = g[ini].replace(/^###\s*/, "").trim();
      pedacos.push({
        rotulo: `${tituloH2} › ${tituloH3}`,
        spec: n === 0 ? `${cabecalho}\n\n${corpo}` : corpo,
        chave: chaveDe(`${tituloH2}-${tituloH3}`),
      });
    }
  }
  return pedacos;
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

  // O prefixo que as 30 chamadas compartilham. O ponto de cache vai no ÚLTIMO
  // bloco estável: marcar aqui guarda também o SISTEMA_SECAO que veio antes.
  const prefixo = [
    { texto: SISTEMA_SECAO },
    { texto: contextoEstavel(tema, esqueleto), cachear: true },
  ];

  const partes: string[] = [];
  for (const [i, p] of secoes.entries()) {
    const rot = p.rotulo.slice(0, 54);
    const arq = join(dir, `_${p.chave}.md`);
    if (existsSync(arq)) {
      partes.push(readFileSync(arq, "utf8"));
      console.log(`  [${i + 1}/${secoes.length}] ${rot} — do disco`);
      continue;
    }
    process.stdout.write(`  [${i + 1}/${secoes.length}] ${rot} … `);
    const texto = await chamar(client, orc, prefixo, pedidoSecao(p.spec), 10000);
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
  if (orc.economiaUSD > 0) {
    console.log(`  cache economizou US$ ${orc.economiaUSD.toFixed(3)} de entrada`);
  }
}

main().catch((e) => {
  console.error("\nerro:", e.message);
  process.exit(1);
});
