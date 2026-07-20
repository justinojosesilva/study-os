import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Crumb = { label: string; href?: string };

/** Sub-page trail. The last item is the current page (no href, aria-current). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="mb-6 flex items-center gap-1 text-sm">
      {items.map((it, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="shrink-0 text-faint" />}
          {it.href ? (
            <Link href={it.href} className="press text-muted transition-colors hover:text-ink">
              {it.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate font-medium text-ink">
              {it.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
