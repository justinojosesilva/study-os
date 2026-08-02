import { z } from "zod";
import { MODEL, isMockMode } from "./config";

/**
 * AI flashcard generation. Given a topic (and optionally pasted content/notes),
 * Claude produces concise front/back study cards. Pairs with the FSRS review
 * system — generated cards become real flashcards the user can review.
 */

export const GeneratedCardsSchema = z.object({
  cards: z.array(z.object({ front: z.string(), back: z.string() })),
});

export type GeneratedCard = { front: string; back: string };

export type FlashcardGenResult =
  | { ok: true; data: GeneratedCard[]; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você gera flashcards de estudo. Dado um tópico (e, se houver, conteúdo/anotações),
crie de 5 a 8 flashcards concisos: front = pergunta clara e específica; back = resposta curta e
correta. Evite perguntas triviais ou redundantes. Responda SEMPRE em português do Brasil.
Se houver conteúdo colado, baseie os cards nele; caso contrário, use conhecimento do tópico.`;

export async function generateFlashcards(input: {
  topicTitle: string;
  goalTitle: string;
  content?: string;
  /**
   * When the caller IS a document — a note — the text is the subject, not extra
   * context. Without this the topic title wins: a note about dependency
   * injection filed under an "AWS Lambda" topic produced eight Lambda cards.
   */
  strictContent?: boolean;
}): Promise<FlashcardGenResult> {
  if (isMockMode()) {
    return { ok: true, data: mockCards(input.topicTitle), mocked: true };
  }

  const grounded = input.strictContent && input.content?.trim();
  const prompt = [
    `Objetivo: ${input.goalTitle}`,
    `Tópico: ${input.topicTitle}`,
    input.content?.trim() ? `Conteúdo/anotações:\n${input.content.trim()}` : null,
    grounded
      ? "Gere os flashcards EXCLUSIVAMENTE a partir do conteúdo acima. Não acrescente conhecimento do tópico que não esteja escrito ali. Se o conteúdo não der 5 cards, gere menos."
      : "Gere os flashcards.",
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
      output_config: { format: zodOutputFormat(GeneratedCardsSchema) },
    });

    if (!res.parsed_output) {
      return { ok: false, error: "A IA não retornou flashcards válidos." };
    }
    const cards = res.parsed_output.cards.filter((c) => c.front.trim() && c.back.trim());
    if (cards.length === 0) return { ok: false, error: "Nenhum flashcard gerado." };
    return { ok: true, data: cards, mocked: false };
  } catch (err) {
    console.error("flashcard-gen error", err);
    return {
      ok: false,
      error: "Não foi possível gerar os flashcards agora. Tente novamente.",
    };
  }
}

function mockCards(topic: string): GeneratedCard[] {
  return [
    { front: `O que é ${topic}?`, back: `Definição de ${topic} (demonstração — configure a IA).` },
    { front: `Quando usar ${topic}?`, back: `Cenários de uso de ${topic}.` },
    { front: `Um erro comum ao lidar com ${topic}?`, back: `Armadilha frequente em ${topic}.` },
  ];
}
