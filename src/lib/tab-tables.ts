/**
 * Rewrites tab-separated grids as markdown tables, on the source string,
 * before it is parsed.
 *
 * Nine of the twenty notes hold glossaries pasted from elsewhere in the shape
 *
 *     Termo→Definição em uma linha
 *     Augmentation→Fase de build onde o framework é pré-inicializado
 *
 * — tabs, not pipes, which markdown renders as one run-on paragraph. (I had
 * previously claimed these were markdown tables and had started rendering as
 * such; they were not, and they had not.)
 *
 * Why a string pass and not a remark plugin, which is where this started: by
 * the time the tree exists, a grid line can be split across several text nodes.
 * `RestResponse<T>` in the prose is parsed as inline HTML, so the paragraph
 * arrives as ["…\nUni", <html>, "\t0 ou 1 item…"] and the row is already in
 * pieces. Rewriting the source sidesteps inline parsing entirely: block-level
 * table parsing happens first, and remark-gfm does the rest.
 *
 * The stored text is never modified — this runs on the way to the renderer, so
 * the note stays exactly as written and the next paste from the same source is
 * handled too.
 */

/** A row needs content on both sides of a tab; otherwise it is indentation. */
function isRow(line: string): boolean {
  return /[^\t]\t[^\t]/.test(line);
}

function cells(line: string): string[] {
  // A literal pipe inside a cell would end the column early.
  return line.split("\t").map((c) => c.trim().replace(/\|/g, "\\|"));
}

function toPipeTable(rows: string[][]): string[] {
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? "");
  const line = (r: string[]) => `| ${pad(r).join(" | ")} |`;
  const [header, ...body] = rows;
  return [
    line(header),
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...body.map(line),
  ];
}

export function fixTabTables(markdown: string): string {
  if (!markdown.includes("\t")) return markdown;

  const lines = markdown.split("\n");
  const out: string[] = [];
  let run: string[][] = [];
  let fence: string | null = null;

  const flush = () => {
    if (run.length >= 2) {
      // A table needs a blank line before it or it glues onto the paragraph
      // above and is parsed as more of that paragraph.
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      out.push(...toPipeTable(run));
      out.push("");
    } else if (run.length === 1) {
      // One row alone is a sentence that happens to contain a tab.
      out.push(run[0].join(" "));
    }
    run = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");

    // Tabs are legitimate content inside code; never touch a fenced block.
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      flush();
      fence = fence === null ? fenceMatch[1] : null;
      out.push(line);
      continue;
    }
    if (fence !== null) {
      out.push(line);
      continue;
    }

    if (isRow(line)) {
      run.push(cells(line));
      continue;
    }
    flush();
    out.push(line);
  }
  flush();

  return out.join("\n");
}
