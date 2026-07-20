/** Single shimmering placeholder block. Decorative — hidden from a11y tree;
 *  the surrounding container carries the loading status label. */
export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden="true" style={style} className={`skeleton ${className}`} />;
}

/** Wraps a set of skeletons with a screen-reader loading announcement, so
 *  assistive tech hears "Carregando…" while sighted users see the shimmer. */
export function SkeletonBlock({
  label = "Carregando…",
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** N stacked text lines; the last is shortened to read like a paragraph tail. */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          // last line ends early like real prose
          {...(i === lines - 1 ? { style: { width: "60%" } } : {})}
        />
      ))}
    </div>
  );
}
