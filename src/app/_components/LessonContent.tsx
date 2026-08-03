"use client";

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
 * Section-aware variant of the component map. Built per render because the
 * collapsed set changes; the plain map above stays a module constant for the
 * note panels, which have no sections.
 */
function sectionComponents(
  collapsed: ReadonlySet<string>,
  onToggle: (slug: string) => void,
): Components {
  return {
    ...components,
    section({ children, ...props }) {
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
    },
  };
}

export function LessonContent({
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
  const rehype = sections
    ? [rehypeHighlight, rehypeSlug, rehypeSections]
    : [rehypeHighlight, rehypeSlug];
  const map =
    sections && collapsed && onToggleSection
      ? sectionComponents(collapsed, onToggleSection)
      : components;

  return (
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
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehype}
        components={map}
      >
        {fixTabTables(content)}
      </ReactMarkdown>
    </div>
  );
}
