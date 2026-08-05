"use client";

import { createContext, memo, useContext, useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import "highlight.js/styles/github-dark.css";
import { Mermaid } from "./Mermaid";
import { CopyButton } from "./CopyButton";
import { ChevronRight } from "lucide-react";
import { fixTabTables } from "@/lib/tab-tables";
import { rehypeSections } from "@/lib/rehype-sections";

function isMermaid(className: unknown): boolean {
  return typeof className === "string" && className.includes("language-mermaid");
}

/** Raw text of a `<pre>`, taken from the hast node rather than React children:
 *  the children are already elements once the highlighter has run. */
function preText(node: unknown): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    const el = n as { type?: string; value?: string; children?: unknown[] };
    if (el?.type === "text" && typeof el.value === "string") out.push(el.value);
    if (Array.isArray(el?.children)) el.children.forEach(walk);
  };
  walk(node);
  return out.join("");
}

const components: Components = {
  // Drop the <pre> wrapper around mermaid blocks — <Mermaid/> renders its own.
  pre({ children, node }) {
    const child = Array.isArray(children) ? children[0] : children;
    const cls = (child as { props?: { className?: string } } | undefined)?.props?.className;
    if (isMermaid(cls)) return <>{children}</>;
    // 47 code blocks in a single lesson: copying is the most-used action per
    // character of code there is.
    return (
      <div className="group relative">
        <CopyButton text={preText(node)} />
        <pre>{children}</pre>
      </div>
    );
  },
  // A table wider than its container has to scroll inside itself, or it pushes
  // the whole page sideways. Matters most in the narrow session-note panels,
  // where a glossary table is far wider than the dialog.
  table({ children }) {
    return (
      <div className="overflow-x-auto">
        <table>{children}</table>
      </div>
    );
  },
  code({ className, children, node: _node, ...rest }) {
    if (isMermaid(className)) {
      return <Mermaid chart={String(children).replace(/\n$/, "")} />;
    }
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  },
};

/**
 * Collapse state travels by context, NOT as arguments to a component factory.
 *
 * The factory version rebuilt the components map whenever the collapsed set
 * changed, and a new map means new component TYPES — React then unmounts and
 * remounts the whole markdown subtree, destroying all nine mermaid diagrams.
 * Through context the map is a module constant that never changes identity, so
 * folding a section re-renders that section and nothing else.
 */
type SectionState = { collapsed: ReadonlySet<string>; toggle: (slug: string) => void };
const EMPTY: SectionState = { collapsed: new Set(), toggle: () => {} };
const SectionCtx = createContext<SectionState>(EMPTY);

/** Componente de verdade (maiúsculo) porque usa hook — a regra de hooks não
 *  reconhece uma função `section` minúscula dentro do mapa. */
function MdSection({ children, ...props }: React.ComponentProps<"section">) {
  const { collapsed, toggle: onToggle } = useContext(SectionCtx);
  const slug = String((props as Record<string, unknown>)["data-slug"] ?? "");
  const isCollapsed = collapsed.has(slug);
  const kids = Array.isArray(children) ? children : [children];
  // The heading always stays; only what follows it folds away.
  const [heading, ...body] = kids;

  return (
    <section data-slug={slug} className="md-section">
      <div className="group relative">
        {heading}
        <button
          type="button"
          onClick={() => onToggle(slug)}
          aria-expanded={!isCollapsed}
          aria-label={isCollapsed ? "Expandir seção" : "Recolher seção"}
          className="absolute -left-6 top-1/2 hidden -translate-y-1/2 text-faint transition-colors hover:text-ink group-hover:block lg:block"
        >
          <ChevronRight
            size={16}
            className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`}
          />
        </button>
      </div>
      {!isCollapsed && body}
    </section>
  );
}

const sectionComponents: Components = { ...components, section: MdSection };

const PLUGINS_SECOES = [rehypeHighlight, rehypeSlug, rehypeSections];
const PLUGINS_SIMPLES = [rehypeHighlight, rehypeSlug];
const REMARK = [remarkGfm];

function LessonContentImpl({
  content,
  compact = false,
  sections = false,
  collapsed,
  onToggleSection,
  style,
}: {
  content: string;
  /**
   * For the session-note panels inside the agenda and the calendar dialog:
   * smaller type, and no reading-measure cap — in a panel a few hundred pixels
   * wide the cap never binds, and the tighter spacing is what makes a long
   * note skimmable in a box that scrolls.
   */
  compact?: boolean;
  /** Group `h2` blocks into foldable sections. Only worth it for lessons. */
  sections?: boolean;
  collapsed?: ReadonlySet<string>;
  onToggleSection?: (slug: string) => void;
  /** Aplicado no próprio elemento `.prose` — ver surfaceStyle. */
  style?: React.CSSProperties;
}) {
  /**
   * Both of these MUST keep a stable identity across renders.
   *
   * They were rebuilt on every render, and the reader re-renders on every
   * frame of scrolling (the progress percentage is state). A new `components`
   * object means new component TYPES for `pre`/`code`/`section`, so React
   * unmounts and remounts that whole subtree — which re-runs the mermaid
   * effect and blanks each diagram until its async render resolves. On the
   * lesson where seven diagrams sit together, thousands of pixels collapsed
   * and returned repeatedly while scrolling, and the page jumped.
   */
  const rehype = sections ? PLUGINS_SECOES : PLUGINS_SIMPLES;
  const map = sections ? sectionComponents : components;
  const ctx = useMemo(
    () => ({ collapsed: collapsed ?? EMPTY.collapsed, toggle: onToggleSection ?? EMPTY.toggle }),
    [collapsed, onToggleSection],
  );

  const tree = (
    // O container segue a largura padrão das telas, mas o texto corrido tem
    // medida própria: a 1024px a linha chegava a 107 caracteres, contra os
    // 45–75 confortáveis. Só parágrafo e item de lista são limitados — tabela,
    // código e diagrama continuam usando a largura toda, que é onde ela ajuda.
    <div
      className={`prose prose-stone max-w-none dark:prose-invert prose-headings:font-medium prose-a:text-profissional prose-pre:rounded-lg prose-pre:border prose-pre:border-line prose-img:rounded-lg ${
        compact
          ? "prose-sm prose-headings:mt-3 prose-headings:mb-1.5 prose-p:my-1.5 prose-table:my-2 prose-pre:my-2"
          : "prose-p:max-w-[var(--reader-measure,68ch)] prose-li:max-w-[var(--reader-measure,68ch)]"
      }`}
      style={style}
    >
      <ReactMarkdown
        remarkPlugins={REMARK}
        rehypePlugins={rehype}
        components={map}
      >
        {fixTabTables(content)}
      </ReactMarkdown>
    </div>
  );

  return sections ? <SectionCtx.Provider value={ctx}>{tree}</SectionCtx.Provider> : tree;
}

/**
 * Memoised: the reader re-renders on every scroll frame, and re-rendering
 * ~85k characters of markdown for a progress bar is both wasteful and — via
 * the remount described above — visibly broken.
 */
export const LessonContent = memo(LessonContentImpl);
