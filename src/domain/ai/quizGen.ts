import { z } from "zod";
import { MODEL, isMockMode } from "./config";
import { chamarModelo } from "./usage";

/**
 * Topic quiz — the shorter road to `mastered`.
 *
 * The goal exam samples a whole goal; this one drills a single topic using the
 * material actually produced for it: the lab, the lesson, the flashcards and
 * whatever the tutor explained. Passing it promotes the topic without waiting
 * for the goal exam, and answering it is itself preparation for that exam.
 */

export const QuizSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(z.string()),
      correctIndex: z.number(),
      explanation: z.string(),
    }),
  ),
});

export type GeneratedQuiz = z.infer<typeof QuizSchema>;

export type QuizResult =
  { ok: true; data: GeneratedQuiz; mocked: boolean } | { ok: false; error: string };

export type QuizSource = {
  topicTitle: string;
  goalTitle: string;
  lessons: { title: string; kind: "aula" | "lab"; content: string }[];
  flashcards: { front: string; back: string }[];
  tutorAnswers: { question: string | null; answer: string }[];
  /** The student's own written syntheses — evidence, not source of truth. */
  notes: { title: string; content: string }[];
};

/**
 * Character budget for the study material sent to the model.
 *
 * A single topic here holds ~150k characters of lessons — roughly 37k tokens,
 * which is both wasteful and close to trouble. So the material is packed by
 * signal density rather than truncated blindly:
 *
 *   flashcards    already distilled question/answer pairs — the best value per
 *                 character there is, so they go in whole;
 *   notes         what the student actually wrote and how they frame it, newest
 *                 first, because a rewritten synthesis supersedes its draft;
 *   tutor answers short and specific to what confused you, kept recent-first;
 *   lab           where application shows up, which is what a quiz should test;
 *   lesson        the concepts, included last and trimmed hardest.
 *
 * Long lessons keep their head AND tail: the opening carries the objectives and
 * the closing usually carries the exercises. A plain head-truncation would drop
 * exactly the part that makes good questions.
 */
const BUDGET = { lab: 14000, aula: 9000, tutor: 6000, notes: 10000 } as const;

function squeeze(text: string, limit: number): string {
  const clean = text.trim();
  if (clean.length <= limit) return clean;
  const head = Math.floor(limit * 0.6);
  const tail = limit - head;
  return `${clean.slice(0, head)}\n\n[…trecho omitido…]\n\n${clean.slice(-tail)}`;
}

function buildContext(src: QuizSource, count: number): string {
  const labs = src.lessons.filter((l) => l.kind === "lab");
  const aulas = src.lessons.filter((l) => l.kind === "aula");

  const parts: string[] = [`Tópico: ${src.topicTitle}`, `Objetivo de estudo: ${src.goalTitle}`];

  if (src.flashcards.length) {
    parts.push(
      "",
      "FLASHCARDS (já revisados pelo aluno):",
      src.flashcards.map((c) => `- P: ${c.front}\n  R: ${c.back}`).join("\n"),
    );
  }

  if (src.notes.length) {
    let left = BUDGET.notes;
    const chunks: string[] = [];
    for (const n of src.notes) {
      if (left <= 0) break;
      const piece = `--- ${n.title} ---\n${squeeze(n.content, Math.min(left, 4000))}`;
      chunks.push(piece);
      left -= piece.length;
    }
    parts.push(
      "",
      "ANOTAÇÕES DO PRÓPRIO ALUNO (o que ele escreveu, na ordem da mais recente para a mais antiga):",
      chunks.join("\n\n"),
    );
  }

  if (src.tutorAnswers.length) {
    let left = BUDGET.tutor;
    const chunks: string[] = [];
    for (const t of src.tutorAnswers) {
      if (left <= 0) break;
      const piece = `- ${t.question ? `Pergunta: ${t.question}\n  ` : ""}${squeeze(t.answer, Math.min(left, 2000))}`;
      chunks.push(piece);
      left -= piece.length;
    }
    parts.push("", "EXPLICAÇÕES DO TUTOR (dúvidas que o aluno já teve):", chunks.join("\n"));
  }

  for (const l of labs) {
    parts.push("", `LABORATÓRIO PRÁTICO — ${l.title}:`, squeeze(l.content, BUDGET.lab));
  }
  for (const l of aulas) {
    parts.push("", `AULA — ${l.title}:`, squeeze(l.content, BUDGET.aula));
  }

  parts.push("", `Gere exatamente ${count} questões sobre este tópico, usando o material acima.`);
  return parts.join("\n");
}

const SYSTEM = `Você é um examinador técnico sênior montando um questionário para verificar se o aluno
domina UM tópico específico. Gere questões de múltipla escolha com 4 alternativas, exatamente uma
correta.

Baseie-se no material fornecido: laboratório prático, aula, flashcards e explicações do tutor. Dê
mais peso ao que aparece no laboratório, porque é onde a aplicação real está — o objetivo é
verificar se o aluno sabe usar, não se decorou. Prefira cenários, diagnóstico de erro e comparação
entre alternativas plausíveis; evite pegadinhas de sintaxe e perguntas que se respondem só lendo o
enunciado.

As ANOTAÇÕES DO PRÓPRIO ALUNO têm status diferente do resto: elas mostram o que ele estudou de
fato e com que palavras pensa o assunto — NÃO são fonte de verdade. Use-as para escolher o recorte
e o vocabulário das questões. Se uma anotação contradisser a aula ou o laboratório, não reproduza
o erro: pergunte sobre esse ponto e traga a alternativa correta do material.

NUNCA atribua uma opinião ou um engano ao aluno. Não escreva "o aluno anotou que…", "o aluno
acredita que…" nem nada equivalente, e não descreva o que ele teria concluído. Uma anotação que
adverte contra um erro não significa que ele cometeu esse erro. Faça a pergunta de forma direta,
sobre o assunto — a alternativa errada carrega o engano, o enunciado não acusa ninguém.

Quando o material vier com um trecho omitido, não invente o conteúdo que falta: pergunte sobre o
que está presente.

NÚMEROS SÓ SE ESTIVEREM ESCRITOS. Tempos, uso de memória, percentuais, versões, nomes de arquivo e
saídas de terminal só podem aparecer se constarem literalmente no material. Se você quer perguntar
sobre uma medição que o material menciona sem o valor, descreva a medição em palavras ("o startup
medido no Lab 1", "a redução de RSS observada") em vez de arriscar um número. Um valor inventado
vira decoreba errada, que é o oposto do objetivo. "correctIndex" é o índice (base 0) da alternativa correta. "explanation" diz em
1-2 frases por que a correta está certa. Responda SEMPRE em português do Brasil.`;

export async function generateQuiz(
  ownerId: string,
  src: QuizSource,
  questionCount: number,
): Promise<QuizResult> {
  const hasMaterial =
    src.lessons.length > 0 ||
    src.flashcards.length > 0 ||
    src.tutorAnswers.length > 0 ||
    src.notes.length > 0;
  if (!hasMaterial) {
    return {
      ok: false,
      error:
        "Este tópico ainda não tem material. Escreva uma anotação, adicione uma aula ou lab, crie flashcards, ou pergunte ao tutor antes de gerar o questionário.",
    };
  }

  if (isMockMode()) {
    return { ok: true, data: mockQuiz(src, questionCount), mocked: true };
  }

  try {
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const chamada = await chamarModelo(ownerId, "quizGen", (client) =>
      client.messages.parse({
        model: MODEL,
        max_tokens: 8192,
        system: SYSTEM,
        messages: [{ role: "user", content: buildContext(src, questionCount) }],
        output_config: { format: zodOutputFormat(QuizSchema) },
      }),
    );
    if (!chamada.ok) return { ok: false, error: chamada.error };
    const res = chamada.res;

    if (!res.parsed_output || res.parsed_output.questions.length === 0) {
      return { ok: false, error: "A IA não retornou um questionário válido." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("quiz-gen error", err);
    return {
      ok: false,
      error: "Não foi possível gerar o questionário agora. Tente novamente.",
    };
  }
}

// ---------------------------------------------------------------------------
// Mock — derives from the topic's own flashcards so the flow works without a key.
// ---------------------------------------------------------------------------
function mockQuiz(src: QuizSource, count: number): GeneratedQuiz {
  return {
    questions: Array.from({ length: count }, (_, i) => {
      const card = src.flashcards[i % Math.max(1, src.flashcards.length)];
      const prompt = card?.front ?? `Sobre "${src.topicTitle}", qual afirmação está correta?`;
      const right = card?.back ?? `Aplicar ${src.topicTitle} na prática.`;
      return {
        prompt,
        options: [
          right,
          `${src.topicTitle} não se aplica a este contexto.`,
          `${src.topicTitle} dispensa os demais tópicos do objetivo.`,
          `${src.topicTitle} só existe em teoria.`,
        ],
        correctIndex: 0,
        explanation: `A alternativa correta reflete o material estudado sobre ${src.topicTitle}.`,
      };
    }),
  };
}
