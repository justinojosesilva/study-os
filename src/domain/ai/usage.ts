import { and, gte, eq, sql } from "drizzle-orm";
import { db, runAsOwner } from "@/infra/db/client";
import { aiUsage, users } from "@/infra/db/schema";
import { MODEL } from "./config";

/**
 * Registro de consumo e teto de gasto da IA.
 *
 * POR QUE EXISTE. O sistema tinha 11 endpoints de IA sem limite nenhum,
 * faturados na conta Anthropic do dono, e nenhum registro de quanto cada um
 * consumia — só o console da Anthropic sabia. Visibilidade e teto são o mesmo
 * trabalho: a tabela que responde "quanto gastei" é a que permite dizer "chega".
 *
 * COMO SE ENCAIXA. As chamadas ao modelo acontecem FORA da transação com
 * escopo (é o padrão do projeto: ler contexto no `scoped`, chamar o modelo
 * fora, gravar de volta no `scoped`). Então este módulo abre a sua própria
 * transação com `runAsOwner` para ler o gasto e para gravar o consumo — e por
 * isso recebe `ownerId` explicitamente, em vez de adivinhar por contexto.
 */

/** US$ por milhão de tokens. Ver a tabela de preços da Anthropic. */
const PRECO_POR_MTOK: Record<string, { entrada: number; saida: number }> = {
  "claude-opus-4-8": { entrada: 5, saida: 25 },
  "claude-opus-5": { entrada: 5, saida: 25 },
  "claude-sonnet-5": { entrada: 3, saida: 15 },
  "claude-haiku-4-5": { entrada: 1, saida: 5 },
};

/** Se o modelo for desconhecido, assume o mais caro da lista — erra para o lado seguro. */
function preco(model: string) {
  return PRECO_POR_MTOK[model] ?? { entrada: 5, saida: 25 };
}

/**
 * Custo em MILIONÉSIMOS DE DÓLAR. Inteiro de propósito: centavos arredondariam
 * quase toda chamada para zero, e float acumula deriva ao somar centenas de
 * linhas. US$ 0,22 = 220000.
 */
export function custoMicros(model: string, entrada: number, saida: number): number {
  const p = preco(model);
  return Math.round(((entrada * p.entrada + saida * p.saida) / 1_000_000) * 1_000_000);
}

export function microsParaReais(micros: number): string {
  return `US$ ${(micros / 1_000_000).toFixed(2)}`;
}

// --- tetos ------------------------------------------------------------------

/** Padrão da instalação, quando a pessoa não tem teto próprio. */
const TETO_DIA_PADRAO = Number(process.env.AI_DAILY_LIMIT_MICROS ?? 5_000_000); // US$ 5
const TETO_MES_PADRAO = Number(process.env.AI_MONTHLY_LIMIT_MICROS ?? 30_000_000); // US$ 30

export type Tetos = { dia: number; mes: number };

/**
 * Teto EFETIVO de uma pessoa: o dela, com o padrão da instalação como reserva.
 *
 * Os limites por variável de ambiente são globais — valem para todo mundo
 * igual. Convidar alguém significava dar a essa pessoa o mesmo teto do dono, na
 * fatura do dono. A coluna em `users` resolve isso sem obrigar ninguém a
 * configurar nada: nulo continua caindo no padrão.
 *
 * FALHA FECHADA em valor inválido. Um teto negativo ou não numérico vindo do
 * banco não pode virar "sem limite" — cai no padrão, que é o mais restritivo
 * dos dois comportamentos possíveis.
 */
function efetivo(valor: number | null, padrao: number): number {
  return typeof valor === "number" && Number.isFinite(valor) && valor >= 0 ? valor : padrao;
}

async function tetosNoEscopo(ownerId: string): Promise<Tetos> {
  const [linha] = await db
    .select({
      dia: users.aiDailyLimitMicros,
      mes: users.aiMonthlyLimitMicros,
    })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  return {
    dia: efetivo(linha?.dia ?? null, TETO_DIA_PADRAO),
    mes: efetivo(linha?.mes ?? null, TETO_MES_PADRAO),
  };
}

export type Consumo = { dia: number; mes: number; chamadasHoje: number };

/**
 * Cada leitura existe em duas formas, e a diferença é QUEM abre a transação.
 *
 * As funções `…NoEscopo` assumem que já existe um `runAsOwner` ativo e usam o
 * `db` ambiente — é o caso das páginas, que já rodam dentro de `scoped()`. As
 * outras abrem a própria transação, porque o caminho da IA chama o modelo fora
 * de qualquer transação. Aninhar as duas funcionaria, mas seguraria duas
 * conexões do pool ao mesmo tempo para uma leitura só.
 */
async function consumoNoEscopo(ownerId: string): Promise<Consumo> {
  const inicioDia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const inicioMes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [linha] = await db
    .select({
      dia: sql<number>`coalesce(sum(${aiUsage.costMicros}) filter (where ${aiUsage.createdAt} >= ${inicioDia}), 0)::int`,
      mes: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::int`,
      chamadasHoje: sql<number>`count(*) filter (where ${aiUsage.createdAt} >= ${inicioDia})::int`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.ownerId, ownerId), gte(aiUsage.createdAt, inicioMes)));
  return linha ?? { dia: 0, mes: 0, chamadasHoje: 0 };
}

export async function consumo(ownerId: string): Promise<Consumo> {
  return runAsOwner(ownerId, () => consumoNoEscopo(ownerId));
}

/**
 * O mesmo consumo, mais os tetos e a quebra por endpoint — o que a tela mostra.
 *
 * Os tetos vêm daqui, e não do componente: eles saem da coluna da pessoa ou de
 * variável de ambiente do servidor, e a tela não tem acesso a nenhuma das duas.
 */
export type ConsumoDetalhado = Consumo & {
  tetoDia: number;
  tetoMes: number;
  /** true quando a pessoa tem teto próprio, e não o padrão da instalação. */
  tetoProprio: boolean;
  porEndpoint: { endpoint: string; micros: number; chamadas: number }[];
};

/** Para páginas — já rodam dentro de `scoped()`. */
export async function consumoDetalhadoNoEscopo(ownerId: string): Promise<ConsumoDetalhado> {
  const inicioMes = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const base = await consumoNoEscopo(ownerId);
  const [proprios] = await db
    .select({ dia: users.aiDailyLimitMicros, mes: users.aiMonthlyLimitMicros })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);

  const porEndpoint = await db
    .select({
      endpoint: aiUsage.endpoint,
      micros: sql<number>`sum(${aiUsage.costMicros})::int`,
      chamadas: sql<number>`count(*)::int`,
    })
    .from(aiUsage)
    .where(and(eq(aiUsage.ownerId, ownerId), gte(aiUsage.createdAt, inicioMes)))
    .groupBy(aiUsage.endpoint)
    .orderBy(sql`sum(${aiUsage.costMicros}) desc`);

  return {
    ...base,
    tetoDia: efetivo(proprios?.dia ?? null, TETO_DIA_PADRAO),
    tetoMes: efetivo(proprios?.mes ?? null, TETO_MES_PADRAO),
    tetoProprio: proprios?.dia != null || proprios?.mes != null,
    porEndpoint,
  };
}

export type LimiteResultado = { ok: true } | { ok: false; error: string };

/**
 * FALHA FECHADA. Se a consulta de consumo quebrar, a chamada é negada — o
 * banco já é requisito de tudo no app, então indisponibilidade dele não é um
 * caso que se resolva gastando dinheiro às cegas.
 */
export async function dentroDoTeto(ownerId: string): Promise<LimiteResultado> {
  try {
    // Consumo e tetos na MESMA transação: são duas leituras do mesmo dono, e
    // abrir duas seguraria duas conexões do pool para decidir uma coisa só.
    const { c, tetos } = await runAsOwner(ownerId, async () => ({
      c: await consumoNoEscopo(ownerId),
      tetos: await tetosNoEscopo(ownerId),
    }));

    if (c.dia >= tetos.dia) {
      return {
        ok: false,
        error: `Limite diário de IA atingido (${microsParaReais(tetos.dia)}). Ele reabre 24h após as primeiras chamadas.`,
      };
    }
    if (c.mes >= tetos.mes) {
      return {
        ok: false,
        error: `Limite mensal de IA atingido (${microsParaReais(tetos.mes)}).`,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("falha ao consultar consumo de IA", err);
    return {
      ok: false,
      error: "Não foi possível verificar o limite de uso agora.",
    };
  }
}

async function registrar(input: {
  ownerId: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  try {
    await runAsOwner(input.ownerId, async () => {
      await db.insert(aiUsage).values({
        ownerId: input.ownerId,
        endpoint: input.endpoint,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicros: custoMicros(input.model, input.inputTokens, input.outputTokens),
      });
    });
  } catch (err) {
    // Falha ao REGISTRAR não invalida a resposta já paga e já obtida. Só que
    // perder o registro corrói o teto, então tem de aparecer no log.
    console.error("falha ao registrar consumo de IA", err);
  }
}

// --- o ponto único ----------------------------------------------------------

type ComUso = {
  usage?: { input_tokens?: number; output_tokens?: number } | null;
};

export type ChamadaResultado<R> = { ok: true; res: R } | { ok: false; error: string };

/**
 * Verifica o teto, cria o cliente, executa e registra o consumo.
 *
 * Todo módulo de `domain/ai` passa por aqui — é o que impede que um endpoint
 * novo nasça sem limite, como os 11 anteriores nasceram.
 */
export async function chamarModelo<R extends ComUso>(
  ownerId: string,
  endpoint: string,
  executar: (client: import("@anthropic-ai/sdk").default) => Promise<R>,
): Promise<ChamadaResultado<R>> {
  const limite = await dentroDoTeto(ownerId);
  if (!limite.ok) return limite;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const res = await executar(new Anthropic());

  await registrar({
    ownerId,
    endpoint,
    model: MODEL,
    inputTokens: res.usage?.input_tokens ?? 0,
    outputTokens: res.usage?.output_tokens ?? 0,
  });

  return { ok: true, res };
}
