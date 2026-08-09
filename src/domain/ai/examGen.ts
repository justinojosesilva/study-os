import { z } from "zod";
import type { getGoalWithTopics } from "@/domain/goals/repository";
import { CATEGORY } from "@/lib/categories";
import { statusLabelPt } from "@/lib/topic-status";
import { MODEL, isMockMode } from "./config";
import { chamarModelo } from "./usage";

type GoalWithTopics = NonNullable<Awaited<ReturnType<typeof getGoalWithTopics>>>;

/**
 * Exam generation — the counterweight to self-declared mastery.
 *
 * `gapAnalysis` trusts topic status and asks "what's missing from the plan?".
 * This asks the opposite question: "is this actually known?". Questions are tied
 * back to a topic so the result can act on the domain — promoting a practised
 * topic to `mastered`, knocking a missed one back a step, and seeding flashcards
 * from the misses — instead of being just a score.
 */

export const ExamSchema = z.object({
  questions: z.array(
    z.object({
      topicTitle: z.string(),
      prompt: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
      explanation: z.string(),
    }),
  ),
});

export type GeneratedExam = z.infer<typeof ExamSchema>;

export type ExamGenResult =
  { ok: true; data: GeneratedExam; mocked: boolean } | { ok: false; error: string };

const SYSTEM = `Você é um examinador técnico sênior montando uma prova para avaliar o que o aluno
REALMENTE absorveu de um objetivo de estudo. Gere questões de múltipla escolha (4 alternativas cada,
exatamente uma correta) cobrindo os tópicos informados.

Priorize nesta ordem: primeiro os tópicos em "praticando", porque acertar tudo neles é o que promove
o tópico a "dominado"; depois os já "dominado", para confirmar que o domínio se sustenta; por último
os em "estudando". Dê mais questões aos tópicos de maior peso.

Evite perguntas de decoreba: prefira aplicação, comparação e diagnóstico de cenários reais.
"topicTitle" DEVE ser exatamente igual a um dos títulos de tópico fornecidos. "correctIndex" é o
índice (base 0) da alternativa correta em "options". "explanation" explica por que a resposta certa
está certa, em 1-2 frases. Responda SEMPRE em português do Brasil.`;

export async function generateExam(
  ownerId: string,
  goal: GoalWithTopics,
  questionCount: number,
): Promise<ExamGenResult> {
  const topics = goal.topics.filter((t) => t.status !== "todo");
  if (topics.length === 0) {
    return {
      ok: false,
      error: "Comece ao menos um tópico (estudando ou praticando) antes de gerar a prova.",
    };
  }

  if (isMockMode()) {
    return { ok: true, data: mockExam(goal, questionCount), mocked: true };
  }

  try {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const chamada = await chamarModelo(ownerId, "examGen", (client) =>
      client.messages.parse({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{ role: "user", content: buildContext(goal, topics, questionCount) }],
        output_config: { format: zodOutputFormat(ExamSchema) },
      }),
    );
    if (!chamada.ok) return { ok: false, error: chamada.error };
    const res = chamada.res;

    if (!res.parsed_output || res.parsed_output.questions.length === 0) {
      return { ok: false, error: "A IA não retornou uma prova válida." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("exam-gen error", err);
    return {
      ok: false,
      error: "Não foi possível gerar a prova agora. Tente novamente.",
    };
  }
}

function buildContext(
  goal: GoalWithTopics,
  topics: GoalWithTopics["topics"],
  questionCount: number,
): string {
  const lines = topics.map(
    (t) => `- ${t.title} (status: ${statusLabelPt(t.status)}, peso: ${t.weight})`,
  );
  return [
    `Objetivo: ${goal.title}`,
    `Categoria: ${CATEGORY[goal.category].label}`,
    goal.why ? `Motivação: ${goal.why}` : null,
    "",
    `Tópicos estudados:\n${lines.join("\n")}`,
    "",
    `Gere exatamente ${questionCount} questões distribuídas entre esses tópicos.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Mock — round-robins the goal's own topics so the flow is usable without a key.
// ---------------------------------------------------------------------------
function mockExam(goal: GoalWithTopics, questionCount: number): GeneratedExam {
  const topics = goal.topics.filter((t) => t.status !== "todo");
  return {
    questions: Array.from({ length: questionCount }, (_, i) => {
      const topic = topics[i % topics.length];
      return {
        topicTitle: topic.title,
        prompt: `Em "${topic.title}", qual afirmação descreve melhor sua aplicação prática?`,
        options: [
          `Aplicar ${topic.title} ao resolver um problema real do objetivo "${goal.title}".`,
          `${topic.title} só existe em contexto acadêmico, sem uso prático.`,
          `${topic.title} substitui a necessidade de entender os demais tópicos.`,
          `${topic.title} é irrelevante para "${goal.title}".`,
        ],
        correctIndex: 0,
        explanation: `${topic.title} se justifica pela aplicação prática dentro de "${goal.title}" — as demais alternativas invertem ou exageram esse papel.`,
      };
    }),
  };
}
