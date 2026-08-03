import GithubSlugger from "github-slugger";

/**
 * Heading extraction and slugs, shared by the reader and the table of contents.
 *
 * The slug is also what reading position is stored against: pixel offsets stop
 * being meaningful the moment font size or column width changes, and both are
 * about to become adjustable. A heading is stable under any of that.
 */

export type Heading = { depth: number; text: string; slug: string };

/** Strips the inline markdown that would otherwise show up in the index. */
function plain(text: string): string {
  return text
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]*)\*\*/g, "$1")
    .replace(/\*([^*]*)\*/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim();
}

/**
 * Headings in document order, skipping fenced code — a `# comment` inside a
 * shell block is not a section, and these lessons carry 47 code blocks each.
 *
 * Slugs come from `github-slugger`, the same library `rehype-slug` uses to put
 * the ids on the rendered HTML. Rolling my own would drift from those ids on
 * the first accent or repeated title, and the index would scroll nowhere.
 */
export function extractHeadings(markdown: string): Heading[] {
  const out: Heading[] = [];
  // One slugger per document: it is stateful, and that state is exactly what
  // makes a repeated "Exercícios" become "exercicios-1".
  const slugger = new GithubSlugger();
  let fence: string | null = null;

  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\r$/, "");

    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      fence = fence === null ? fenceMatch[1] : null;
      continue;
    }
    if (fence !== null) continue;

    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (!m) continue;

    const text = plain(m[2]);
    if (!text) continue;

    out.push({ depth: m[1].length, text, slug: slugger.slug(text) });
  }

  return out;
}

/** Words outside fenced code, for the reading estimate. */
export function countWords(markdown: string): number {
  let fence: string | null = null;
  let words = 0;
  for (const raw of markdown.split("\n")) {
    const line = raw.replace(/\r$/, "");
    const fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) {
      fence = fence === null ? fenceMatch[1] : null;
      continue;
    }
    if (fence !== null) continue;
    const t = line.trim();
    if (t) words += t.split(/\s+/).length;
  }
  return words;
}

/**
 * Reading time in minutes.
 *
 * 130 wpm rather than the usual 200: the measured lessons carry ~47 code
 * blocks and 9 diagrams each, and nobody reads those at prose speed. Code is
 * charged separately, per block, instead of by word count — a 40-line snippet
 * is scanned, not read word by word.
 */
const PROSE_WPM = 130;
const SECONDS_PER_CODE_BLOCK = 20;

export function readingMinutes(markdown: string): number {
  const blocks = (markdown.match(/^\s*(```|~~~)/gm) ?? []).length / 2;
  const minutes = countWords(markdown) / PROSE_WPM + (blocks * SECONDS_PER_CODE_BLOCK) / 60;
  return Math.max(1, Math.round(minutes));
}
