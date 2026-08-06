import { z } from "zod";
// Só o TIPO é estático — o cliente continua vindo por `await import`, para o
// SDK não entrar no bundle. `import type` é apagado na compilação.
import type { ContentBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { MODEL, isMockMode } from "./config";

/**
 * Extração da carreira a partir do currículo que a pessoa JÁ TEM.
 *
 * A fase 1 abriu espaço para experiências e projetos anteriores ao app, mas
 * digitá-los é o custo de entrada: um currículo real tem 4 páginas. Aqui o
 * arquivo é lido e vira campos preenchidos.
 *
 * Duas regras que valem mais que a precisão do modelo:
 *
 * 1. Isto NÃO grava. Devolve o que entendeu, e a tela obriga revisão antes de
 *    salvar. IA lendo histórico profissional erra data e infla título com toda
 *    a naturalidade do mundo — e currículo errado é pior que currículo vazio.
 * 2. Nada é inventado. Campo ausente no documento volta nulo, não "estimado".
 */

const ExperienceSchema = z.object({
  company: z.string(),
  role: z.string(),
  /** "AAAA-MM". Se o documento só der o ano, use o mês 01. */
  startDate: z.string(),
  /** "AAAA-MM", ou null quando é o cargo atual. */
  endDate: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  techs: z.array(z.string()),
});

const ProjectSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  url: z.string().nullable(),
  techs: z.array(z.string()),
});

export const CareerExtractionSchema = z.object({
  experiences: z.array(ExperienceSchema),
  projects: z.array(ProjectSchema),
  /** O que o modelo NÃO conseguiu determinar. Vira aviso na tela de revisão. */
  uncertain: z.array(z.string()),
});

export type CareerExtraction = z.infer<typeof CareerExtractionSchema>;
export type ExtractedExperience = z.infer<typeof ExperienceSchema>;
export type ExtractedProject = z.infer<typeof ProjectSchema>;

export type CareerExtractionResult =
  | { ok: true; data: CareerExtraction; mocked: boolean }
  | { ok: false; error: string };

const SYSTEM = `Você extrai o histórico profissional de um currículo e devolve dados estruturados.

REGRAS:
- Extraia SOMENTE o que está escrito no documento. Não complete, não estime, não infira.
- Datas no formato AAAA-MM. Se só houver o ano, use o mês 01. Se o cargo for o atual
  ("atual", "presente", "até hoje", "-"), devolva endDate null.
- description: o que a pessoa fez naquele cargo, no texto do próprio documento, condensado
  se for muito longo. Não reescreva em linguagem de marketing.
- techs: só tecnologias explicitamente citadas naquele item. Lista vazia se não houver.
- projects: só projetos apresentados como projeto. NÃO transforme cargo em projeto.
- uncertain: liste em português o que ficou ambíguo ou ilegível (ex.: "a data de saída da
  Empresa X não estava clara"). Lista vazia se estiver tudo claro.
- Ordene as experiências da mais recente para a mais antiga.`;

type ExtractInput = { pdfBase64?: string; text?: string };

export async function extractCareer(input: ExtractInput): Promise<CareerExtractionResult> {
  const hasPdf = Boolean(input.pdfBase64);
  const text = input.text?.trim() ?? "";
  if (!hasPdf && !text) {
    return { ok: false, error: "Envie o PDF do currículo ou cole o texto dele." };
  }

  if (isMockMode()) {
    return { ok: true, data: mockExtraction(), mocked: true };
  }

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
    const client = new Anthropic();

    // O bloco `document` vem ANTES do texto — é a ordem que a API espera para
    // que a instrução se refira ao documento já lido.
    const content: ContentBlockParam[] = [];
    if (input.pdfBase64) {
      content.push({
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: input.pdfBase64,
        },
      });
    }
    if (text) {
      content.push({ type: "text", text: `Currículo em texto:\n\n${text}` });
    }
    content.push({ type: "text", text: "Extraia o histórico profissional deste currículo." });

    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(CareerExtractionSchema) },
    });

    if (!res.parsed_output) {
      return { ok: false, error: "Não consegui ler o currículo. Tente colar o texto." };
    }
    return { ok: true, data: res.parsed_output, mocked: false };
  } catch (err) {
    console.error("careerImport error", err);
    return { ok: false, error: "Não foi possível ler o currículo agora. Tente novamente." };
  }
}

function mockExtraction(): CareerExtraction {
  return {
    experiences: [
      {
        company: "Empresa Exemplo",
        role: "Engenheiro de Software Sênior",
        startDate: "2019-04",
        endDate: null,
        location: "Remoto",
        description: "Liderança técnica de squad e desenho de arquitetura de serviços.",
        techs: ["Java", "Node.js", "React", "AWS"],
      },
    ],
    projects: [],
    uncertain: ["Modo de demonstração: nenhum documento foi lido de verdade."],
  };
}
