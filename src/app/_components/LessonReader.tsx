"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, CornerDownLeft, X } from "lucide-react";
import { saveReadingProgressAction } from "@/app/_actions/reading";
import type { Heading } from "@/lib/headings";
import { LessonContent } from "./LessonContent";

/**
 * The reading shell for a lesson: index, position and progress.
 *
 * Sized by what the lessons actually are — a median of ~85k characters, about
 * an hour of reading, 25 `h2` plus 78 `h3`, and 72.370 pixels of scrolling in
 * the largest. At that size the reader's problem is not typography, it is that
 * there is no map and no way back to where you stopped.
 */

/** Long enough that the reader has settled, short enough to survive a close. */
const SAVE_DEBOUNCE_MS = 1500;
/**
 * The band where returning to a position is worth offering. Below the floor
 * there is nothing to return to; at the ceiling the lesson is effectively read
 * and "continue from 100%" is noise. Same ceiling as `continueReading`.
 */
const RESUME_MIN_PERCENT = 3;
const RESUME_MAX_PERCENT = 97;
/** Hard cap so a document that never stops changing cannot hold the page. */
const SETTLE_CAP_MS = 20000;

export function LessonReader({
  lessonId,
  content,
  headings,
  minutes,
  initialPercent,
  initialAnchor,
}: {
  lessonId: string;
  content: string;
  headings: Heading[];
  minutes: number;
  initialPercent: number;
  initialAnchor: string | null;
}) {
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [percent, setPercent] = useState(initialPercent);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [showResume, setShowResume] = useState(
    Boolean(initialAnchor) &&
      initialPercent >= RESUME_MIN_PERCENT &&
      initialPercent <= RESUME_MAX_PERCENT,
  );

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<{ slug: string | null; percent: number }>({
    slug: initialAnchor,
    percent: initialPercent,
  });

  const sectionSlugs = useMemo(
    () => headings.filter((h) => h.depth === 2).map((h) => h.slug),
    [headings],
  );

  /**
   * Heading offsets, measured once and re-measured only when the layout can
   * have changed (a section folds, the window resizes).
   *
   * An IntersectionObserver was the first attempt and it was wrong: it reports
   * when an element crosses a boundary, not which heading is currently above
   * the fold, so between callbacks the answer goes stale. Measured at 52.800px
   * into the real lesson it still pointed at the last section of the document.
   *
   * Reading geometry for 104 headings on every frame would be the other
   * extreme. Precomputed offsets plus a binary search cost O(log n) per frame
   * and touch no layout at all while scrolling.
   */
  const offsets = useRef<{ top: number; slug: string }[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  /**
   * While this is set, every re-measure scrolls back to the anchor.
   *
   * Resuming jumps to a DOM element, which is correct at the instant it runs —
   * but nine mermaid diagrams are still rendering, and any one of them above
   * the anchor pushes the target down afterwards. A fixed 4s deadline was the
   * first attempt and it left the reader 6.412px short: the diagrams were
   * still arriving when it expired.
   *
   * So the hold ends on the reader's own input instead of on a clock — wheel,
   * touch or key. A programmatic scroll never clears it, which is exactly the
   * distinction a `scroll` listener could not make.
   */
  const settleTarget = useRef<string | null>(null);
  const settleUntil = useRef(0);

  /** Last heading whose top is above the reading line, by binary search. */
  const syncActive = useCallback(() => {
    const list = offsets.current;
    if (list.length === 0) return;
    const line = window.scrollY + 120;
    let lo = 0;
    let hi = list.length - 1;
    let found = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].top <= line) {
        found = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    setActiveSlug(list[found].slug);
  }, []);

  const measure = useCallback(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("h1[id], h2[id], h3[id]"),
    );
    offsets.current = nodes.map((n) => ({
      top: n.getBoundingClientRect().top + window.scrollY,
      slug: n.id,
    }));
    // Re-measuring without re-deriving leaves the index pointing at whatever
    // the previous offsets said. That is how the same scroll position reported
    // three different sections across three samples.
    syncActive();


  }, [syncActive]);

  useEffect(() => {
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);

    // Measuring once on mount is not enough: mermaid renders asynchronously,
    // and one of these diagrams is 1.681px tall. Every offset below it moves
    // when it appears, which made the index run ahead of the reader — marked
    // "18. Mapa mental" while the text on screen was section 14.1. A
    // ResizeObserver catches that, plus font swaps and image loads, without
    // guessing at a delay.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    });
    if (contentRef.current) observer.observe(contentRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
    // Folding a section moves everything below it.
  }, [measure, content, collapsed]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPercent(max <= 0 ? 100 : Math.round((window.scrollY / max) * 100));
      syncActive();
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [syncActive]);

  // Persist after the reader stops moving. Writing on every scroll event would
  // mean hundreds of round trips across one lesson.
  useEffect(() => {
    const slug = activeSlug;
    if (slug === lastSaved.current.slug && Math.abs(percent - lastSaved.current.percent) < 2) {
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      lastSaved.current = { slug, percent };
      void saveReadingProgressAction(lessonId, slug, percent);
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [activeSlug, percent, lessonId]);

  /**
   * Holds the resumed position while the document keeps growing.
   *
   * Two attempts failed before this one. A 4s deadline expired while diagrams
   * were still arriving and left the reader 6.412px short. Re-asserting from
   * the ResizeObserver missed the largest growth entirely — 7.394px of it,
   * between three and six seconds, with no observer error logged.
   *
   * A poll does not care which mechanism reports the change: it just keeps the
   * anchor at the top until the reader touches the page. Eighty ticks of one
   * `scrollIntoView` is nothing next to being dropped 7.000px from where the
   * screen said you would land.
   */
  useEffect(() => {
    const release = () => {
      settleTarget.current = null;
    };
    const events = ["wheel", "touchstart", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, release, { passive: true }));

    const tick = setInterval(() => {
      if (!settleTarget.current) return;
      if (Date.now() > settleUntil.current) {
        settleTarget.current = null;
        return;
      }
      document.getElementById(settleTarget.current)?.scrollIntoView({ block: "start" });
    }, 250);

    return () => {
      events.forEach((e) => window.removeEventListener(e, release));
      clearInterval(tick);
    };
  }, []);

  const jump = useCallback((slug: string) => {
    const el = document.getElementById(slug);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const resume = useCallback(() => {
    setShowResume(false);
    if (!initialAnchor) return;
    settleTarget.current = initialAnchor;
    settleUntil.current = Date.now() + SETTLE_CAP_MS;
    jump(initialAnchor);
  }, [initialAnchor, jump]);

  const toggleSection = useCallback((slug: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const allCollapsed = collapsed.size >= sectionSlugs.length && sectionSlugs.length > 0;
  const toggleAll = useCallback(() => {
    setCollapsed(allCollapsed ? new Set() : new Set(sectionSlugs));
  }, [allCollapsed, sectionSlugs]);

  const resumeHeading = useMemo(
    () => headings.find((h) => h.slug === initialAnchor) ?? null,
    [headings, initialAnchor],
  );

  const remaining = Math.max(0, Math.round(minutes * (1 - percent / 100)));

  return (
    <>
      {/* Progress sits at the very top of the viewport: it is the one piece of
          state that has to stay legible through 80 screens. */}
      <div
        className="fixed inset-x-0 top-0 z-30 h-0.5 bg-profissional/70 transition-[width] duration-150"
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da leitura"
      />

      {showResume && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-profissional/30 bg-profissional-soft px-4 py-3">
          <CornerDownLeft size={16} className="shrink-0 text-profissional" />
          {/* Nomeia a seção, não o percentual. Os dois medem coisas
              diferentes — o percentual guarda o ponto mais longe já alcançado,
              a âncora guarda onde a leitura estava — e misturá-los produzia
              "você parou em 100%" apontando para o topo do documento. */}
          <p className="min-w-0 flex-1 truncate text-sm">
            Você parou em{" "}
            <span className="font-medium">{resumeHeading?.text ?? `${initialPercent}%`}</span>.
          </p>
          <button
            type="button"
            onClick={resume}
            className="press shrink-0 rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas"
          >
            Continuar de onde parei
          </button>
          <button
            type="button"
            onClick={() => setShowResume(false)}
            aria-label="Dispensar"
            className="shrink-0 text-faint hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex gap-8">
        <div ref={contentRef} className="min-w-0 flex-1">
          <LessonContent
            content={content}
            sections
            collapsed={collapsed}
            onToggleSection={toggleSection}
          />
        </div>

        {headings.length >= 4 && (
          <Toc
            headings={headings}
            activeSlug={activeSlug}
            onJump={jump}
            minutes={minutes}
            remaining={remaining}
            percent={percent}
            allCollapsed={allCollapsed}
            onToggleAll={toggleAll}
          />
        )}
      </div>
    </>
  );
}

/**
 * Only `h2` is listed, with the `h3` of the current section expanded beneath
 * it. A flat list of all 128 headings is a second wall, not a way out of the
 * first one.
 */
function Toc({
  headings,
  activeSlug,
  onJump,
  minutes,
  remaining,
  percent,
  allCollapsed,
  onToggleAll,
}: {
  headings: Heading[];
  activeSlug: string | null;
  onJump: (slug: string) => void;
  minutes: number;
  remaining: number;
  percent: number;
  allCollapsed: boolean;
  onToggleAll: () => void;
}) {
  // Which h2 owns the active heading, so an active h3 still opens its parent.
  const activeSection = useMemo(() => {
    let section: string | null = null;
    for (const h of headings) {
      if (h.depth === 2) {
        if (h.slug === activeSlug) return h.slug;
        section = h.slug;
      }
      if (h.slug === activeSlug) return section;
    }
    return null;
  }, [headings, activeSlug]);

  const items = useMemo(() => {
    const out: (Heading & { show: boolean })[] = [];
    let current: string | null = null;
    for (const h of headings) {
      if (h.depth === 2) current = h.slug;
      if (h.depth <= 2) out.push({ ...h, show: true });
      else if (h.depth === 3) out.push({ ...h, show: current === activeSection });
    }
    return out.filter((h) => h.show);
  }, [headings, activeSection]);

  return (
    <nav
      aria-label="Índice da aula"
      className="sticky top-8 hidden h-[calc(100vh-6rem)] w-60 shrink-0 flex-col xl:flex"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">
          {percent}% · {remaining > 0 ? `${remaining} min restantes` : "no fim"}
        </span>
        <button
          type="button"
          onClick={onToggleAll}
          aria-label={allCollapsed ? "Expandir todas as seções" : "Recolher todas as seções"}
          className="tip tip-left text-faint transition-colors hover:text-ink"
        >
          {allCollapsed ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}
        </button>
      </div>
      <p className="mb-3 text-[11px] text-faint">leitura estimada em {minutes} min</p>

      <ul className="min-h-0 flex-1 overflow-y-auto border-l border-line text-sm">
        {items.map((h) => {
          const active = h.slug === activeSlug;
          return (
            <li key={h.slug}>
              <button
                type="button"
                onClick={() => onJump(h.slug)}
                aria-current={active ? "location" : undefined}
                className={`-ml-px block w-full border-l-2 py-1 pr-2 text-left transition-colors ${
                  h.depth >= 3 ? "pl-5 text-xs" : "pl-3"
                } ${
                  active
                    ? "border-profissional font-medium text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {h.text}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
