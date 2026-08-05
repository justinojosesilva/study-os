"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  RefreshCw,
  NotebookPen,
  Library,
  Award,
  Sparkles,
  FileText,
  Trophy,
  Target,
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon; match: (p: string) => boolean };
type NavSection = { label: string; items: NavItem[] };

const SECTIONS: NavSection[] = [
  {
    label: "Estudo",
    items: [
      { href: "/", label: "Dashboard", icon: Home, match: (p) => p === "/" },
      // Also matches /goals/[id] and the exam pages, which live inside a goal.
      {
        href: "/goals",
        label: "Objetivos",
        icon: Target,
        match: (p) => p.startsWith("/goals") || p.startsWith("/exams"),
      },
      { href: "/agenda", label: "Agenda", icon: CalendarDays, match: (p) => p.startsWith("/agenda") },
      { href: "/review", label: "Revisão", icon: RefreshCw, match: (p) => p.startsWith("/review") },
    ],
  },
  {
    label: "Biblioteca",
    items: [
      {
        href: "/notes",
        label: "Anotações",
        icon: NotebookPen,
        // /notes/[id] is reached from a topic or the agenda too, but it always
        // belongs to this section — the crumb, not the entry point, tells the
        // user where they came from.
        match: (p) => p.startsWith("/notes"),
      },
      { href: "/materials", label: "Materiais", icon: Library, match: (p) => p.startsWith("/materials") },
      { href: "/certifications", label: "Certificações", icon: Award, match: (p) => p.startsWith("/certifications") },
    ],
  },
  {
    label: "Carreira",
    items: [
      { href: "/mentor", label: "Mentor", icon: Sparkles, match: (p) => p.startsWith("/mentor") },
      { href: "/curriculo", label: "Currículo", icon: FileText, match: (p) => p.startsWith("/curriculo") },
      { href: "/progress", label: "Progresso", icon: Trophy, match: (p) => p.startsWith("/progress") },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

/**
 * The five destinations the mobile bar carries, with labels.
 *
 * The old bar held all ten as 36px icon-only links in a strip that already
 * scrolled sideways — under the 44px touch minimum, and icon-only navigation
 * is the classic discoverability trap. Five labelled items fit a 375px screen;
 * the rest live behind "Mais".
 *
 * Chosen by what the daily loop needs: study, plan, review, write, and the
 * goals they all hang off.
 */
const MOBILE_PRIMARY = ["/", "/agenda", "/review", "/notes", "/goals"];
const PRIMARY_ITEMS = MOBILE_PRIMARY.map((href) => ALL_ITEMS.find((i) => i.href === href)!);
const OVERFLOW_ITEMS = ALL_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.href));

/**
 * Global app shell: a persistent left sidebar on desktop (≥lg) grouped into
 * sections, and a sticky top bar on mobile (<lg), both with active-route
 * highlighting. Auth screens render shell-less. `signOut` is a server component
 * passed down from the root layout.
 */
export function AppShell({
  user,
  signOut,
  children,
  initialCollapsed = false,
}: {
  user: { name?: string | null } | null;
  signOut: React.ReactNode;
  children: React.ReactNode;
  /** Read from a cookie on the server so the first paint is already correct. */
  initialCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // A cookie rather than localStorage: the layout reads it while rendering on
    // the server, so the sidebar never flashes open before collapsing.
    document.cookie = `sidebar=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  // Auth screens and the public résumé page have no shell.
  if (pathname === "/signin" || pathname.startsWith("/r/")) return <>{children}</>;

  return (
    <>
      {/* Desktop sidebar — collapses to an icon rail rather than disappearing,
          so navigation stays one click away. The labels live on the tooltips. */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface py-6 transition-[width] duration-200 lg:flex ${
          collapsed ? "w-16 px-2" : "w-60 px-4"
        }`}
      >
        <div className={`mb-8 flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
          <Link
            href="/"
            aria-label="Study OS · início"
            className={`tip flex items-center gap-2.5 ${collapsed ? "" : "px-2"}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas">
              <Target size={18} />
            </span>
            {!collapsed && <span className="text-lg font-medium">Study OS</span>}
          </Link>
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-expanded={!collapsed}
            className="tip flex size-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-ink"
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-5">
          {SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              {!collapsed && (
                <span className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                  {section.label}
                </span>
              )}
              {section.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`press flex items-center rounded-lg py-2 text-sm font-medium ${
                      collapsed ? "tip justify-center px-0" : "gap-3 px-3"
                    } ${active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
                  >
                    <Icon size={17} className={active ? "text-ink" : "text-faint"} />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          className={`mt-4 flex items-center gap-2 border-t border-line pt-4 ${
            collapsed ? "flex-col px-0" : "justify-between px-2"
          }`}
        >
          {!collapsed && <span className="truncate text-sm text-muted">{user?.name ?? "Conta"}</span>}
          {signOut}
        </div>
      </aside>

      {/* Mobile: título em cima, navegação embaixo — o polegar alcança a
          barra inferior, e o topo fica para identidade e conta. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" aria-label="Study OS · início" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-canvas">
            <Target size={15} />
          </span>
          <span className="text-sm font-medium">Study OS</span>
        </Link>
        <span className="flex size-11 items-center justify-center">{signOut}</span>
      </header>

      <MobileNav pathname={pathname} />

      {/* O leitor esconde a barra lateral marcando o <html>; este gancho é o
          que permite o padding acompanhar, sem o shell saber quem pediu. */}
      <div
        data-shell-content
        className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-60"}`}
      >
        {children}
        {/* Reserva a altura da barra fixa mais a área segura, senão o fim de
            cada página fica escondido atrás dela. */}
        <div aria-hidden className="h-[calc(4.5rem+env(safe-area-inset-bottom))] lg:hidden" />
      </div>
    </>
  );
}

/**
 * Bottom navigation for phones: five labelled destinations plus "Mais".
 *
 * Bottom rather than top because that is where the thumb is, and labelled
 * because an icon-only row is a guessing game. Targets are 44px tall, the
 * platform minimum the old 36px strip missed.
 */
function MobileNav({ pathname }: { pathname: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const overflowActive = OVERFLOW_ITEMS.some((i) => i.match(pathname));

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {PRIMARY_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // `min-w-0` é obrigatório: item flex não encolhe abaixo do
              // próprio conteúdo sem ele, e "Anotações"/"Objetivos" empurravam
              // a barra para 504px num viewport de 375.
              className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium ${
                active ? "text-ink" : "text-muted"
              }`}
            >
              <Icon size={19} className={active ? "text-profissional" : ""} />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Mais destinos"
          className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium ${
            overflowActive ? "text-ink" : "text-muted"
          }`}
        >
          <MoreHorizontal size={19} className={overflowActive ? "text-profissional" : ""} />
          Mais
        </button>
      </nav>

      <dialog
        ref={dialogRef}
        aria-label="Mais destinos"
        className="mx-auto mb-0 mt-auto w-full max-w-lg rounded-t-2xl bg-surface p-0 text-ink backdrop:bg-black/40 lg:hidden"
      >
        <div className="flex flex-col pb-[env(safe-area-inset-bottom)]">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <span className="font-medium">Mais</span>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              aria-label="Fechar"
              className="flex size-11 items-center justify-center text-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          </header>
          <ul className="flex flex-col px-2 py-2">
            {OVERFLOW_ITEMS.map((item) => {
              const active = item.match(pathname);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => dialogRef.current?.close()}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
                      active ? "bg-surface-2 text-ink" : "text-muted"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-ink" : "text-faint"} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </dialog>
    </>
  );
}
