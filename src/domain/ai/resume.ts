import { z } from "zod";
import { MODEL, isMockMode } from "./config";
import type { ResumeData } from "@/domain/resume/data";

/**
 * Résumé content generation — the capstone AI feature. Unlike the roadmap
 * mentor (which is stateless/generative), this reads the user's REAL
 * accumulated data (mastered topics, certifications, hours) and writes a
 * grounded professional summary, headline and highlight bullets, optionally
 * tailored to a target role or a pasted job description. It must not invent
 * skills or credentials the candidate doesn't have.
 */

export const ResumeContentSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  highlights: z.array(z.string()),
});

export type ResumeContent = z.infer<typeof ResumeContentSchema>;

export type ResumeContentResult =
  | { ok: true; data: ResumeContent; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você é um especialista em recrutamento tech e redação de currículos.
Com base APENAS nas competências REAIS do candidato (não invente skills nem certificações),
escreva: (1) um headline curto e forte; (2) um resumo profissional de 2-4 frases; (3) de 3 a 5
destaques (bullets) orientados ao cargo-alvo. Se houver descrição de vaga, adapte a linguagem
e priorize as competências mais relevantes para ela. Português do Brasil, tom profissional e
objetivo, sem clichês vazios.`;

function serializeData(data: ResumeData): string {
  const lines = [
    `Estatísticas: ${data.stats.masteredTopics} tópicos dominados, ${data.stats.studyHours}h de estudo acumuladas, sequência de ${data.stats.streak} dias.`,
    "Competências dominadas (por área):",
    ...data.skills.map((s) => `- ${s.goalTitle}: ${s.topics.join(", ")}`),
    data.certifications.length > 0
      ? `Certificações conquistadas: ${data.certifications.map((c) => `${c.title} (${c.provider})`).join("; ")}`
      : "Certificações conquistadas: nenhuma ainda.",
  ];
  if (data.skills.length === 0) lines.push("(Ainda sem tópicos dominados.)");
  return lines.join("\n");
}

export async function generateResumeContent(input: {
  targetRole: string;
  jobDescription?: string;
  data: ResumeData;
}): Promise<ResumeContentResult> {
  const role = input.targetRole.trim();
  if (!role) return { ok: false, error: "Informe o cargo-alvo para adaptar o currículo." };

  if (isMockMode()) {
    return { ok: true, data: mockContent(role, input.data), mocked: true };
  }

  const prompt = [
    `Cargo-alvo: ${role}`,
    input.jobDescription?.trim() ? `Descrição da vaga:\n${input.jobDescription.trim()}` : null,
    "Dados reais do candidato:",
    serializeData(input.data),
    "Gere o conteúdo do currículo.",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const client = new Anthropic();

    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(ResumeContentSchema) },
    });

    if (!res.parsed_output) {
      return { ok: false, error: "A IA não retornou um currículo válido." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("resume error", err);
    return { ok: false, error: "Não foi possível gerar o currículo agora. Tente novamente." };
  }
}

function mockContent(role: string, data: ResumeData): ResumeContent {
  const areas = data.skills.map((s) => s.goalTitle).join(", ") || "diversas áreas de tecnologia";
  const certs = data.certifications.map((c) => c.title).join(", ");
  return {
    headline: `${role} · foco em ${data.skills[0]?.goalTitle ?? "tecnologia"}`,
    summary: `Profissional de tecnologia com ${data.stats.studyHours}h de estudo aplicado e ${data.stats.masteredTopics} tópicos dominados em ${areas}. Aprendizado contínuo comprovado por uma rotina consistente${certs ? ` e pelas certificações ${certs}` : ""}. Buscando atuar como ${role}.`,
    highlights: [
      `Domínio de ${data.stats.masteredTopics} tópicos técnicos distribuídos em ${data.skills.length} área(s) de foco.`,
      certs ? `Certificação(ões): ${certs}.` : `Trilha de certificações em andamento.`,
      `${data.stats.studyHours}h de estudo acumuladas com sequência de ${data.stats.streak} dias — disciplina e constância.`,
      `Perfil orientado ao cargo de ${role}, com base sólida e evolução mensurável.`,
    ],
  };
}
