import { scoped } from "@/domain/auth";
import { getLessonMarkdown } from "@/domain/lessons/repository";
import { titleFromMarkdown } from "@/lib/headings";

/**
 * Baixa a aula como markdown.
 *
 * É Route Handler e não Server Action porque o que se quer aqui é um ARQUIVO, e
 * o navegador só salva arquivo a partir de uma resposta com Content-Disposition.
 * Uma action devolveria a string para o JS montar um Blob — mais código para
 * fazer pior o que o protocolo já faz.
 *
 * Markdown e não PDF porque é o formato em que a aula está guardada: exportar é
 * devolver o original, sem conversão que possa perder tabela, Mermaid ou bloco
 * de código. Para PDF existe o Imprimir, que passa pelo renderizador.
 */

/** Nome de arquivo seguro. Sem isto, um título com `/` ou aspas quebraria o
 *  cabeçalho — e o cabeçalho é onde o nome viaja. */
function nomeDeArquivo(titulo: string): string {
  const base =
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "aula";
  return `${base}.md`;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return scoped(async (ownerId) => {
    const aula = await getLessonMarkdown(ownerId, id);
    if (!aula) return new Response("Aula não encontrada.", { status: 404 });

    // Só prefixa o H1 quando o markdown não tem um. As 25 aulas em produção
    // TÊM — e o H1 delas é melhor que a coluna `title`, que guarda o nome do
    // arquivo de origem. Prefixar sempre daria dois H1 em todo arquivo
    // exportado, o de baixo sendo o bom.
    const h1 = titleFromMarkdown(aula.content);
    const corpo = h1 ? `${aula.content}\n` : `# ${aula.title}\n\n${aula.content}\n`;

    return new Response(corpo, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nomeDeArquivo(h1 ?? aula.title)}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
