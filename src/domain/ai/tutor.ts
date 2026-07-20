import { MODEL, isMockMode } from "./config";

/**
 * AI tutor. Per topic, Claude can explain, generate practice exercises, or
 * summarize — or answer a free-form question. Free-text output (not structured),
 * so this uses messages.create and reads the text blocks.
 */

export type TutorMode = "explain" | "exercises" | "summary";

export type TutorResult =
  | { ok: true; text: string; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você é um tutor de tecnologia, didático e direto. Ensina profissionais de TI.
Responda em português do Brasil, em TEXTO SIMPLES e bem formatado — sem markdown (nada de #,
**, ou blocos de código com crases). Use parágrafos curtos e listas com hífens quando ajudar.
Seja preciso e prático; evite enrolação.`;

function instruction(mode: TutorMode, question: string | undefined): string {
  if (question?.trim()) return `Pergunta do aluno: ${question.trim()}`;
  switch (mode) {
    case "explain":
      return "Explique este tópico de forma clara e didática, com um exemplo prático.";
    case "exercises":
      return "Crie 3 a 5 exercícios práticos sobre este tópico, numerados. Inclua as respostas ao final, após uma linha 'Respostas:'.";
    case "summary":
      return "Faça um resumo conciso e estruturado deste tópico, destacando os pontos-chave.";
  }
}

export async function askTutor(input: {
  topicTitle: string;
  goalTitle: string;
  mode: TutorMode;
  question?: string;
}): Promise<TutorResult> {
  if (isMockMode()) {
    return { ok: true, text: mockText(input), mocked: true };
  }

  const prompt = [
    `Objetivo de estudo: ${input.goalTitle}`,
    `Tópico: ${input.topicTitle}`,
    instruction(input.mode, input.question),
  ].join("\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) return { ok: false, error: "O tutor não retornou resposta." };
    return { ok: true, text, mocked: false };
  } catch (err) {
    console.error("tutor error", err);
    return { ok: false, error: "Não foi possível responder agora. Tente novamente." };
  }
}

function mockText(input: {
  topicTitle: string;
  mode: TutorMode;
  question?: string;
}): string {
  if (input.question?.trim()) {
    return `Resposta de demonstração sobre "${input.topicTitle}" para: "${input.question.trim()}".\n\nConfigure ANTHROPIC_API_KEY para respostas reais do tutor.`;
  }
  const map: Record<TutorMode, string> = {
    explain: `Explicação (demonstração) de "${input.topicTitle}".\n\n- Ideia central do tópico.\n- Por que importa na prática.\n- Um exemplo simples.\n\nDefina ANTHROPIC_API_KEY para a explicação real.`,
    exercises: `Exercícios (demonstração) sobre "${input.topicTitle}".\n\n1. Pergunta introdutória.\n2. Pergunta aplicada.\n3. Pergunta de aprofundamento.\n\nRespostas:\n1. …  2. …  3. …\n\nDefina ANTHROPIC_API_KEY para exercícios reais.`,
    summary: `Resumo (demonstração) de "${input.topicTitle}".\n\n- Ponto-chave 1.\n- Ponto-chave 2.\n- Ponto-chave 3.\n\nDefina ANTHROPIC_API_KEY para o resumo real.`,
  };
  return map[input.mode];
}
