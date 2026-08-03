import type { Root, RootContent, Element } from "hast";

/**
 * Wraps everything from one `h2` up to the next in a `<section data-slug>`.
 *
 * Markdown output is flat: a heading and the twenty nodes that belong to it are
 * siblings, so "collapse this section" has nothing to collapse. With 25 `h2`
 * per lesson and 80 screens of scrolling, folding them is what turns the wall
 * into an index — but only once the section is a node.
 *
 * The slug is read off the id `rehype-slug` already put on the heading, so the
 * section, the anchor and the table of contents all name the same thing.
 */
export function rehypeSections() {
  return (tree: Root) => {
    const out: RootContent[] = [];
    let current: Element | null = null;

    for (const node of tree.children) {
      const isH2 = node.type === "element" && node.tagName === "h2";
      if (isH2) {
        const el = node as Element;
        current = {
          type: "element",
          tagName: "section",
          properties: {
            className: ["md-section"],
            "data-slug": String(el.properties?.id ?? ""),
          },
          children: [el],
        };
        out.push(current);
        continue;
      }
      // Anything before the first h2 (intro, h1) stays at the top level.
      // A doctype can only appear at the root, so it never joins a section.
      if (current && node.type !== "doctype") current.children.push(node);
      else out.push(node);
    }

    tree.children = out;
  };
}
