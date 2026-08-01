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

export function LessonContent({ content }: { content: string }) {
  return (
    // O container segue a largura padrão das telas, mas o texto corrido tem
    // medida própria: a 1024px a linha chegava a 107 caracteres, contra os
    // 45–75 confortáveis. Só parágrafo e item de lista são limitados — tabela,
    // código e diagrama continuam usando a largura toda, que é onde ela ajuda.
    <div className="prose prose-stone max-w-none dark:prose-invert prose-headings:font-medium prose-p:max-w-[68ch] prose-li:max-w-[68ch] prose-a:text-profissional prose-pre:rounded-lg prose-pre:border prose-pre:border-line prose-img:rounded-lg">
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
