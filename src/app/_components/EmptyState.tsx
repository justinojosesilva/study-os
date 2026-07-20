import type { LucideIcon } from "lucide-react";

/**
 * Consistent empty state. `bordered` (default) draws a dashed card for
 * page-level blank slates; borderless is for nesting inside an existing card
 * section (topics/materials/flashcards) where a second border would look boxed-in.
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  bordered = true,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  bordered?: boolean;
  className?: string;
}) {
  const wrap = bordered
    ? "rounded-xl border border-dashed border-line px-6 py-10"
    : "px-4 py-8";

  return (
    <div className={`flex flex-col items-center text-center ${wrap} ${className}`}>
      {Icon && (
        <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-2 text-faint">
          <Icon size={19} />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
