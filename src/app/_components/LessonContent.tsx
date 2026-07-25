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
    <div className="prose prose-stone max-w-none dark:prose-invert prose-headings:font-medium prose-a:text-profissional prose-pre:rounded-lg prose-pre:border prose-pre:border-line prose-img:rounded-lg">
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
