import { z } from "zod";
import { MODEL, isMockMode } from "./config";
import { chamarModelo } from "./usage";

/**
 * "Estratégia da semana" — an AI narrative layered on top of the DETERMINISTIC
 * agenda. It does NOT plan; it explains the already-computed WeekPlan (why this
 * order, what to prioritize, an execution tip), grounded in the plan's real
 * deadlines, weights and due reviews. Cheap and stateless.
 */

export const WeekStrategySchema = z.object({
  summary: z.string(),
  priorities: z.array(z.string()),
  tip: z.string(),
});

export type WeekStrategy = z.infer<typeof WeekStrategySchema>;

export type WeekStrategyInput = {
  totalPlannedHours: number;
  daysWithPlan: number;
  dueReviews: number;
  topicFocus: { title: string; goalTitle: string; blocks: number }[];
  nearestExam: { title: string; daysUntil: number } | null;
};

export type WeekStrategyResult =
  { ok: true; data: WeekStrategy; mocked: boolean } | { ok: false; error: string };

const SYSTEM = `Você é um coach de estudos. Recebe um plano de estudos JÁ MONTADO para a
semana (não re-planeje nem invente tarefas). Escreva: (1) summary — 1 a 2 frases explicando a
lógica da semana e o foco principal; (2) priorities — 2 a 4 itens do que priorizar e POR QUÊ,
citando prazos, pesos e revisões quando fizer sentido; (3) tip — uma dica prática de execução.
Português do Brasil, direto e motivador, sem clichês vazios.`;

function serialize(input: WeekStrategyInput): string {
  const lines = [
    `Plano da semana: ${input.totalPlannedHours}h planejadas em ${input.daysWithPlan} dias.`,
    `Revisões pendentes (spaced repetition) hoje: ${input.dueReviews} cards.`,
  ];
  if (input.nearestExam) {
    lines.push(
      `Prova mais próxima: ${input.nearestExam.title} em ${input.nearestExam.daysUntil} dias.`,
    );
  }
  if (input.topicFocus.length > 0) {
    lines.push("Tópicos com mais tempo alocado nesta semana:");
    for (const t of input.topicFocus) {
      lines.push(`- ${t.title} (${t.goalTitle}): ${t.blocks} bloco(s)`);
    }
  } else {
    lines.push("Sem tópicos de estudo alocados (só revisões ou semana livre).");
  }
  return lines.join("\n");
}

export async function generateWeekStrategy(
  ownerId: string,
  input: WeekStrategyInput,
): Promise<WeekStrategyResult> {
  if (isMockMode()) {
    return { ok: true, data: mockStrategy(input), mocked: true };
  }

  const prompt = [serialize(input), "Escreva a estratégia da semana."].join("\n\n");

  try {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const chamada = await chamarModelo(ownerId, "weekStrategy", (client) =>
      client.messages.parse({
        model: MODEL,
        max_tokens: 1536,
        system: SYSTEM,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(WeekStrategySchema) },
      }),
    );
    if (!chamada.ok) return { ok: false, error: chamada.error };
    const res = chamada.res;

    if (!res.parsed_output) {
      return { ok: false, error: "A IA não retornou uma estratégia válida." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("week strategy error", err);
    return {
      ok: false,
      error: "Não foi possível gerar a estratégia agora. Tente novamente.",
    };
  }
}

function mockStrategy(input: WeekStrategyInput): WeekStrategy {
  const top = input.topicFocus[0];
  return {
    summary: `Semana de ${input.totalPlannedHours}h com foco em ${top?.title ?? "revisão"}. O plano prioriza o que está mais perto do prazo e ainda não dominado.`,
    priorities: [
      input.nearestExam
        ? `Prova de ${input.nearestExam.title} em ${input.nearestExam.daysUntil} dias — mantenha os tópicos dela no topo.`
        : `Avance nos tópicos de maior peso ainda pendentes.`,
      input.dueReviews > 0
        ? `${input.dueReviews} cards para revisar hoje — faça primeiro, eles decaem no tempo.`
        : `Sem revisões pendentes; aproveite para avançar em conteúdo novo.`,
      top ? `Feche ${top.title} antes de abrir muitas frentes.` : `Mantenha a constância diária.`,
    ],
    tip: "Comece pelo bloco mais curto do dia para criar momentum e não deixe a revisão para o fim.",
  };
}
