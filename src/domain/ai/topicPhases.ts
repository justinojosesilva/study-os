import { z } from "zod";
import type { getGoalWithTopics } from "@/domain/goals/repository";
import { CATEGORY } from "@/lib/categories";
import { statusLabelPt } from "@/lib/topic-status";
import { MODEL, isMockMode } from "./config";

type GoalWithTopics = NonNullable<Awaited<ReturnType<typeof getGoalWithTopics>>>;

/**
 * Groups a goal's existing topics into learning phases.
 *
 * The roadmap already proposes phases when a goal is generated, but goals built
 * by hand — or adopted before phases were persisted — arrive as a flat list. A
 * long flat list is exactly where grouping earns its keep, so this reads the
 * topics that exist and proposes the staging after the fact.
 */

export const PhasesSchema = z.object({
  phases: z.array(
    z.object({
      name: z.string(),
      topics: z.array(z.string()),
    }),
  ),
});

export type ProposedPhases = z.infer<typeof PhasesSchema>;

export type PhasesResult =
  | { ok: true; data: ProposedPhases; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você organiza tópicos de estudo em fases de aprendizado, na ordem em que devem ser
encarados. Use de 3 a 5 fases, com nomes curtos que indiquem profundidade crescente (por exemplo
"Fundamentos", "Base", "Intermediário", "Especialista") — adapte ao domínio quando fizer sentido.

Regras: use SOMENTE os títulos de tópico fornecidos, escritos exatamente como recebidos; cada tópico
aparece em UMA única fase; nenhum tópico pode ficar de fora; ordene as fases da mais básica para a
mais avançada, e dentro de cada fase ordene por dependência (o que precisa vir antes vem antes).
Responda SEMPRE em português do Brasil.`;

export async function proposePhases(goal: GoalWithTopics): Promise<PhasesResult> {
  if (goal.topics.length < 2) {
    return { ok: false, error: "Cadastre ao menos dois tópicos para agrupar em fases." };
  }

  if (isMockMode()) {
    return { ok: true, data: mockPhases(goal), mocked: true };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const client = new Anthropic();

    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: buildContext(goal) }],
      output_config: { format: zodOutputFormat(PhasesSchema) },
    });

    if (!res.parsed_output || res.parsed_output.phases.length === 0) {
      return { ok: false, error: "A IA não retornou um agrupamento válido." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("topic-phases error", err);
    return { ok: false, error: "Não foi possível agrupar agora. Tente novamente." };
  }
}

function buildContext(goal: GoalWithTopics): string {
  const lines = goal.topics.map(
    (t) => `- ${t.title} (status: ${statusLabelPt(t.status)}, peso: ${t.weight})`,
  );
  return [
    `Objetivo: ${goal.title}`,
    `Categoria: ${CATEGORY[goal.category].label}`,
    goal.why ? `Motivação: ${goal.why}` : null,
    "",
    `Tópicos a organizar (${goal.topics.length}):\n${lines.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Mock — splits the existing list into thirds so the flow works without a key.
// ---------------------------------------------------------------------------
function mockPhases(goal: GoalWithTopics): ProposedPhases {
  const titles = goal.topics.map((t) => t.title);
  const size = Math.ceil(titles.length / 3);
  const names = ["Fundamentos", "Base", "Especialista"];
  return {
    phases: names
      .map((name, i) => ({ name, topics: titles.slice(i * size, (i + 1) * size) }))
      .filter((p) => p.topics.length > 0),
  };
}
