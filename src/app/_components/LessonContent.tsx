"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { Mermaid } from "./Mermaid";

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

export function LessonContent({
  content,
  compact = false,
}: {
  content: string;
  /**
   * For the session-note panels inside the agenda and the calendar dialog:
   * smaller type, and no reading-measure cap — in a panel a few hundred pixels
   * wide the cap never binds, and the tighter spacing is what makes a long
   * note skimmable in a box that scrolls.
   */
  compact?: boolean;
}) {
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
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
