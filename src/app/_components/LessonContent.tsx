"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import "highlight.js/styles/github-dark.css";
import { Mermaid } from "./Mermaid";
import { ChevronRight } from "lucide-react";
import { fixTabTables } from "@/lib/tab-tables";
import { rehypeSections } from "@/lib/rehype-sections";

function isMermaid(className: unknown): boolean {
  return typeof className === "string" && className.includes("language-mermaid");
}

const components: Components = {
  // Drop the <pre> wrapper around mermaid blocks — <Mermaid/> renders its own.
  pre({ children }) {
    const child = Array.isArray(children) ? children[0] : children;
    const cls = (child as { props?: { className?: string } } | undefined)?.props?.className;
    if (isMermaid(cls)) return <>{children}</>;
    return <pre>{children}</pre>;
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
          : "prose-p:max-w-[68ch] prose-li:max-w-[68ch]"
      }`}
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
