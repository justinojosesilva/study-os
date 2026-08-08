import Link from "next/link";
import { NotebookPen, Search } from "lucide-react";
import { scoped } from "@/domain/auth";
import { listAllNotes, searchNotes } from "@/domain/notes/repository";
import { formatDayMonth } from "@/lib/date";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { EmptyState } from "@/app/_components/EmptyState";
import { NoteSearchBox } from "@/app/_components/NoteSearchBox";

export const dynamic = "force-dynamic";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // The query lives in the URL so a search can be bookmarked and survives a
  // reload — same reasoning as the tabs on /progress.
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  return scoped(async (ownerId) => {
    const [hits, all] = await Promise.all([
      query ? searchNotes(ownerId, query) : Promise.resolve([]),
      query ? Promise.resolve([]) : listAllNotes(ownerId),
    ]);

    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <Breadcrumbs items={[{ label: "Dashboard", href: "/" }, { label: "Anotações" }]} />

        <h1 className="mb-1 flex items-center gap-2 text-xl font-medium">
          <NotebookPen size={20} className="text-faculdade" />
          Anotações
        </h1>
        <p className="mb-5 text-sm text-muted">
          Busca no texto inteiro, sem depender de acento: <em>configuracao</em> encontra{" "}
          <em>configuração</em>. Aspas procuram a expressão exata.
        </p>

        <NoteSearchBox initial={query} />

        {query ? (
          hits.length === 0 ? (
            <EmptyState
              icon={Search}
              title={`Nada encontrado para “${query}”`}
              hint="Tente outra palavra, ou use aspas para procurar uma expressão exata."
            />
          ) : (
            <>
              <p className="mb-3 text-xs text-faint">
                {hits.length} {hits.length === 1 ? "anotação" : "anotações"} · mais relevante
                primeiro
              </p>
              <ul className="flex flex-col gap-2">
                {hits.map((h) => (
                  <li key={h.id}>
                    <Link
                      href={`/notes/${h.id}`}
                      className="press flex flex-col gap-1.5 rounded-xl border border-line bg-surface px-4 py-3 hover:bg-surface-2"
                    >
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">{h.title}</span>
                        <Context topic={h.topicTitle} goal={h.goalTitle} />
                      </span>
                      <span className="text-sm leading-relaxed text-muted">
                        {h.snippet.map((part, i) =>
                          part.hit ? (
                            <mark
                              key={i}
                              className="rounded bg-faculdade-soft px-0.5 text-faculdade"
                            >
                              {part.text}
                            </mark>
                          ) : (
                            <span key={i}>{part.text}</span>
                          ),
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : all.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Nenhuma anotação ainda"
            hint="O que você escrever ao registrar uma sessão vira uma anotação, e aparece aqui."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {all.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/notes/${n.id}`}
                  className="press flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3 hover:bg-surface-2"
                >
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    <Context topic={n.topicTitle} goal={n.goalTitle} />
                  </span>
                  <span className="flex items-center gap-2 text-[11px] text-faint tabular-nums">
                    {formatDayMonth(n.createdAt)}
                    <span>·</span>
                    {n.length.toLocaleString("pt-BR")} caracteres
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  });
}

function Context({ topic, goal }: { topic: string | null; goal: string | null }) {
  if (!topic) return <span className="text-xs text-faint">estudo livre</span>;
  return (
    <span className="text-xs text-faint">
      {topic}
      {goal && ` · ${goal}`}
    </span>
  );
}
