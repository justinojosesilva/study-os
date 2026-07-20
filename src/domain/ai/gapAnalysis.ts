import { z } from "zod";
import type { getGoalWithTopics } from "@/domain/goals/repository";
import { CATEGORY } from "@/lib/categories";
import { MODEL, isMockMode } from "./config";

type GoalWithTopics = NonNullable<Awaited<ReturnType<typeof getGoalWithTopics>>>;

/**
 * Career gap-analysis — the signature AI feature. It only works because of the
 * connected data we accumulated: the goal, its topics, and their mastery. Given
 * that, Claude identifies strengths, gaps (missing skills), and next topics.
 * Framework-free domain logic; the Anthropic client is just an API dependency.
 */

export const GapAnalysisSchema = z.object({
  summary: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(
    z.object({
      skill: z.string(),
      why: z.string(),
      priority: z.enum(["alta", "média", "baixa"]),
    }),
  ),
  suggestedTopics: z.array(z.string()),
});

export type GapAnalysis = z.infer<typeof GapAnalysisSchema>;

export type AnalysisResult =
  | { ok: true; data: GapAnalysis; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você é um mentor de carreira e estudos para profissionais de tecnologia.
Dado um objetivo de estudo e o estado atual dos tópicos do usuário, faça uma análise de lacunas:
identifique o que ele já domina (strengths), as lacunas importantes que faltam para atingir o
objetivo (gaps, com prioridade e um "why" curto), e sugira tópicos concretos e acionáveis para
adicionar ao plano (suggestedTopics — títulos curtos, no estilo dos tópicos existentes).
Seja específico ao domínio do objetivo. Responda SEMPRE em português do Brasil, conciso e prático.`;

export async function analyzeGoalGaps(goal: GoalWithTopics): Promise<AnalysisResult> {
  const context = buildContext(goal);

  // Dev/demo path: no key or AI_MOCK=true → return a plausible canned analysis
  // so the feature is usable without an Anthropic API key.
  if (isMockMode()) {
    return { ok: true, data: mockAnalysis(goal), mocked: true };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const client = new Anthropic();

    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: context }],
      output_config: { format: zodOutputFormat(GapAnalysisSchema) },
    });

    if (!res.parsed_output) {
      return { ok: false, error: "A IA não retornou uma análise válida." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("gap-analysis error", err);
    return {
      ok: false,
      error: "Não foi possível gerar a análise agora. Tente novamente.",
    };
  }
}

function buildContext(goal: GoalWithTopics): string {
  const cat = CATEGORY[goal.category].label;
  const lines = goal.topics.map(
    (t) => `- ${t.title} (status: ${statusLabel(t.status)}, peso: ${t.weight})`,
  );
  return [
    `Objetivo: ${goal.title}`,
    `Categoria: ${cat}`,
    goal.why ? `Motivação: ${goal.why}` : null,
    goal.targetDate ? `Prazo: ${goal.targetDate.toISOString().slice(0, 10)}` : null,
    "",
    goal.topics.length
      ? `Tópicos atuais:\n${lines.join("\n")}`
      : "O usuário ainda não cadastrou tópicos para este objetivo.",
    "",
    "Analise as lacunas para este objetivo.",
  ]
    .filter(Boolean)
    .join("\n");
}

function statusLabel(s: string): string {
  return s === "mastered" ? "dominado" : s === "learning" ? "estudando" : "a fazer";
}

// ---------------------------------------------------------------------------
// Mock — derives a plausible analysis from the goal's own data.
// ---------------------------------------------------------------------------
function mockAnalysis(goal: GoalWithTopics): GapAnalysis {
  const mastered = goal.topics.filter((t) => t.status === "mastered").map((t) => t.title);
  const inProgress = goal.topics.filter((t) => t.status !== "mastered").map((t) => t.title);

  const strengths = mastered.length
    ? mastered.map((t) => `${t} — base sólida`)
    : ["Você definiu um objetivo claro; comece marcando o que já domina."];

  const gaps = inProgress.slice(0, 3).map((t, i) => ({
    skill: t,
    why: `Ainda não dominado e relevante para "${goal.title}".`,
    priority: (i === 0 ? "alta" : i === 1 ? "média" : "baixa") as
      | "alta"
      | "média"
      | "baixa",
  }));

  return {
    summary: `Você está progredindo em "${goal.title}". Foque nas lacunas de maior prioridade e transforme os tópicos "estudando" em "dominado" com revisão espaçada.`,
    strengths,
    gaps: gaps.length
      ? gaps
      : [
          {
            skill: "Fundamentos do objetivo",
            why: "Quebre o objetivo em tópicos estudáveis para acompanhar a evolução.",
            priority: "alta",
          },
        ],
    suggestedTopics: ["Boas práticas", "Casos de uso do mundo real", "Simulado / avaliação"],
  };
}
