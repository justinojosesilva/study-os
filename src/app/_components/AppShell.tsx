"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  RefreshCw,
  Library,
  Award,
  Sparkles,
  FileText,
  Trophy,
  Target,
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
 * Global app shell: a persistent left sidebar on desktop (≥lg) grouped into
 * sections, and a sticky top bar on mobile (<lg), both with active-route
 * highlighting. Auth screens render shell-less. `signOut` is a server component
 * passed down from the root layout.
 */
export function AppShell({
  user,
  signOut,
  children,
}: {
  user: { name?: string | null } | null;
  signOut: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // Auth screens and the public résumé page have no shell.
  if (pathname === "/signin" || pathname.startsWith("/r/")) return <>{children}</>;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-ink text-canvas">
            <Target size={18} />
          </span>
          <span className="text-lg font-medium">Study OS</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-5">
          {SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                {section.label}
              </span>
              {section.items.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`press flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                      active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <Icon size={17} className={active ? "text-ink" : "text-faint"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line px-2 pt-4">
          <span className="truncate text-sm text-muted">{user?.name ?? "Conta"}</span>
          {signOut}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/85 px-4 py-2.5 backdrop-blur lg:hidden">
        <Link href="/" aria-label="Study OS · início" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-ink text-canvas">
            <Target size={15} />
          </span>
        </Link>
        {/* Scrolls horizontally: the icon row is fixed-width per item, so on a
            375px phone the full set would otherwise overflow the header. */}
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {ALL_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`press flex size-9 shrink-0 items-center justify-center rounded-lg ${
                  active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
          <span className="ml-0.5 flex size-9 items-center justify-center">{signOut}</span>
        </nav>
      </header>

      <div className="lg:pl-60">{children}</div>
    </>
  );
}
