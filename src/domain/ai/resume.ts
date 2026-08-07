import { z } from "zod";
import { MODEL, isMockMode } from "./config";
import type { ResumeData } from "@/domain/resume/data";
import type { CareerData } from "@/domain/resume/career";

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

As informações vêm em DUAS naturezas diferentes, e confundi-las estraga o currículo:

A) CARREIRA — cargos, empresas, período e o que foi entregue. É a espinha dorsal:
   define senioridade, trajetória e domínio. É daqui que sai o peso do candidato.
B) ESTUDO RECENTE — tópicos dominados, certificações e horas registradas numa
   plataforma de estudos. É evidência da DIREÇÃO ATUAL (reciclagem, transição,
   aprofundamento), não experiência profissional.

REGRAS:
- Nunca apresente estudo como se fosse experiência. Horas de estudo e tópicos
  dominados não são entregas profissionais e não sustentam senioridade.
- Só cite horas de estudo, sequência de dias ou contagem de tópicos se isso
  realmente ajudar o cargo-alvo. Para quem já tem anos de carreira, quase nunca
  ajuda — nesse caso mencione a direção do estudo, não a métrica dele.
- Derive a senioridade da carreira (tempo e responsabilidade), nunca do estudo.
- Não invente nada: nem cargo, nem tecnologia, nem certificação.
- Se não houver carreira registrada, aí sim o estudo é o que existe — use-o,
  sem inflar, e posicione a pessoa como quem está construindo a base.

Escreva: (1) um headline curto e forte; (2) um resumo profissional de 2-4 frases;
(3) de 3 a 5 destaques (bullets) orientados ao cargo-alvo. Se houver descrição de
vaga, adapte a linguagem e priorize o que for mais relevante para ela.
Português do Brasil, tom profissional e objetivo, sem clichês vazios.`;

/** "2010-03" → "mar/2010"; entrada fora do padrão volta como veio. */
function mesAno(ym: string): string {
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [y, m] = ym.split("-");
  const i = Number(m) - 1;
  return meses[i] ? `${meses[i]}/${y}` : ym;
}

/** Anos entre o cargo mais antigo e hoje — o número que define a senioridade. */
function anosDeCarreira(career: CareerData): number | null {
  const inicios = career.experiences.map((e) => e.startDate).filter(Boolean).sort();
  if (inicios.length === 0) return null;
  const [y, m] = inicios[0].split("-").map(Number);
  const meses = (new Date().getFullYear() - y) * 12 + (new Date().getMonth() + 1 - m);
  return Math.max(0, Math.floor(meses / 12));
}

function serializeCareer(career: CareerData): string {
  if (career.experiences.length === 0 && career.projects.length === 0) {
    return "(A) CARREIRA: nenhuma experiência profissional registrada.";
  }
  const anos = anosDeCarreira(career);
  const linhas: string[] = [
    `(A) CARREIRA — ${career.experiences.length} cargo(s)${anos !== null ? `, cerca de ${anos} anos desde o primeiro registro` : ""}:`,
  ];
  for (const e of career.experiences) {
    const periodo = `${mesAno(e.startDate)} a ${e.endDate ? mesAno(e.endDate) : "atual"}`;
    linhas.push(`- ${e.role} — ${e.company} (${periodo})`);
    if (e.description) linhas.push(`  o que fez: ${e.description}`);
    if (e.techs && e.techs.length > 0) linhas.push(`  tecnologias: ${e.techs.join(", ")}`);
  }
  const destaques = career.projects.filter((p) => p.highlight);
  if (destaques.length > 0) {
    linhas.push("Projetos:");
    for (const p of destaques) {
      linhas.push(`- ${p.title}${p.description ? `: ${p.description}` : ""}`);
      if (p.techs && p.techs.length > 0) linhas.push(`  tecnologias: ${p.techs.join(", ")}`);
    }
  }
  return linhas.join("\n");
}

function serializeStudy(data: ResumeData): string {
  const linhas = [
    "(B) ESTUDO RECENTE na plataforma:",
    `- ${data.stats.masteredTopics} tópico(s) dominado(s), ${data.stats.studyHours}h registradas, sequência de ${data.stats.streak} dias.`,
  ];
  if (data.skills.length > 0) {
    linhas.push("- Tópicos dominados por área:");
    linhas.push(...data.skills.map((s) => `  ${s.goalTitle}: ${s.topics.join(", ")}`));
  } else {
    linhas.push("- Nenhum tópico dominado ainda.");
  }
  linhas.push(
    data.certifications.length > 0
      ? `- Certificações conquistadas: ${data.certifications.map((c) => `${c.title} (${c.provider})`).join("; ")}`
      : "- Nenhuma certificação conquistada ainda.",
  );
  if (data.focusAreas.length > 0) {
    linhas.push(`- Estudando atualmente: ${data.focusAreas.map((f) => f.title).join("; ")}.`);
  }
  return linhas.join("\n");
}

export async function generateResumeContent(input: {
  targetRole: string;
  jobDescription?: string;
  data: ResumeData;
  career: CareerData;
}): Promise<ResumeContentResult> {
  const role = input.targetRole.trim();
  if (!role) return { ok: false, error: "Informe o cargo-alvo para adaptar o currículo." };

  if (isMockMode()) {
    return { ok: true, data: mockContent(role, input.data, input.career), mocked: true };
  }

  const prompt = [
    `Cargo-alvo: ${role}`,
    input.jobDescription?.trim() ? `Descrição da vaga:\n${input.jobDescription.trim()}` : null,
    "Dados reais do candidato:",
    serializeCareer(input.career),
    serializeStudy(input.data),
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

/**
 * O mock segue a MESMA regra do SYSTEM: com carreira registrada, ela lidera e o
 * estudo entra como direção atual. A versão antiga abria com horas de estudo —
 * exatamente o que agora é proibido — e servia de espelho enganoso em dev.
 */
function mockContent(role: string, data: ResumeData, career: CareerData): ResumeContent {
  const areas = data.skills.map((s) => s.goalTitle).join(", ");
  const certs = data.certifications.map((c) => c.title).join(", ");
  const anos = anosDeCarreira(career);
  const atual = career.experiences.find((e) => !e.endDate) ?? career.experiences[0];

  if (!atual) {
    return {
      headline: `${role} · foco em ${data.skills[0]?.goalTitle ?? "tecnologia"}`,
      summary: `Em formação para ${role}, construindo base em ${areas || "tecnologia"}${certs ? `, com as certificações ${certs}` : ""}.`,
      highlights: [
        `${data.stats.masteredTopics} tópico(s) dominado(s) em ${data.skills.length} área(s).`,
        certs ? `Certificação(ões): ${certs}.` : "Trilha de certificações em andamento.",
        `Rotina de estudo consistente: ${data.stats.studyHours}h registradas.`,
      ],
    };
  }

  const tecnologias = [...new Set(career.experiences.flatMap((e) => e.techs ?? []))].slice(0, 6);
  return {
    headline: `${atual.role} · ${anos !== null ? `${anos} anos em tecnologia` : "tecnologia"}`,
    summary: `${atual.role} na ${atual.company}${anos !== null ? `, com cerca de ${anos} anos de carreira` : ""}. Experiência em ${tecnologias.slice(0, 4).join(", ")}. Atualmente direcionando a evolução para ${role}${areas ? `, com estudo focado em ${areas}` : ""}.`,
    highlights: [
      `${career.experiences.length} passagens profissionais, da mais recente na ${atual.company}.`,
      tecnologias.length > 0 ? `Stack: ${tecnologias.join(", ")}.` : `Atuação em ${role}.`,
      certs ? `Certificação(ões): ${certs}.` : `Direcionamento atual: ${role}.`,
    ],
  };
}
