import { z } from "zod";
import { MODEL, isMockMode } from "./config";

/**
 * Career-mentor roadmap generation. Given a free-text career target, Claude
 * produces a structured learning roadmap (phases → topics, certifications,
 * estimated months). Generative and stateless — it doesn't read the user's
 * data; the "adopt" step (actions) turns it into a real goal + topics.
 */

export const RoadmapSchema = z.object({
  goalTitle: z.string(),
  summary: z.string(),
  estimatedMonths: z.number(),
  phases: z.array(
    z.object({
      name: z.string(),
      focus: z.string(),
      topics: z.array(z.string()),
    }),
  ),
  certifications: z.array(z.string()),
});

export type Roadmap = z.infer<typeof RoadmapSchema>;

export type RoadmapResult =
  | { ok: true; data: Roadmap; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você é um mentor de carreira em tecnologia. Dado um objetivo de carreira,
gere um roadmap de aprendizado estruturado em fases (por exemplo: Fundamentos, Intermediário,
Avançado, Certificações). Cada fase tem um foco de uma linha e uma lista de tópicos concretos
e acionáveis (títulos curtos). Inclua certificações recomendadas e uma estimativa realista de
tempo total em meses. Responda SEMPRE em português do Brasil, específico e prático.
Sugira um título de objetivo curto em goalTitle.`;

export async function generateRoadmap(
  target: string,
  context?: string,
): Promise<RoadmapResult> {
  const goal = target.trim();
  if (!goal) return { ok: false, error: "Descreva o que você quer se tornar." };

  if (isMockMode()) {
    return { ok: true, data: mockRoadmap(goal), mocked: true };
  }

  const prompt = [
    `Objetivo de carreira: ${goal}`,
    context?.trim() ? `Contexto do usuário: ${context.trim()}` : null,
    "Gere o roadmap.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const client = new Anthropic();

    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(RoadmapSchema) },
    });

    if (!res.parsed_output) {
      return { ok: false, error: "A IA não retornou um roadmap válido." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("roadmap error", err);
    return {
      ok: false,
      error: "Não foi possível gerar o roadmap agora. Tente novamente.",
    };
  }
}

function mockRoadmap(target: string): Roadmap {
  return {
    goalTitle: target.length > 60 ? target.slice(0, 57) + "…" : target,
    summary: `Trilha para "${target}", das bases às certificações. Estude por fase e use revisão espaçada para reter o conteúdo.`,
    estimatedMonths: 6,
    phases: [
      { name: "Fundamentos", focus: "Bases conceituais", topics: ["Conceitos essenciais", "Ferramentas básicas", "Primeiro projeto prático"] },
      { name: "Intermediário", focus: "Aplicação prática", topics: ["Padrões comuns", "Boas práticas", "Projeto de portfólio"] },
      { name: "Avançado", focus: "Profundidade e escala", topics: ["Tópicos avançados", "Performance e escala", "Casos do mundo real"] },
      { name: "Certificações", focus: "Validação", topics: ["Simulados", "Revisão final"] },
    ],
    certifications: ["Certificação de nível associate da área", "Certificação profissional avançada"],
  };
}
