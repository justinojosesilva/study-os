import { notFound } from "next/navigation";
import { scoped } from "@/domain/auth";
import { getNote } from "@/domain/notes/repository";
import { formatDayMonth, formatTime } from "@/lib/date";
import { Breadcrumbs } from "@/app/_components/Breadcrumbs";
import { NoteEditor } from "@/app/_components/NoteEditor";
import { NoteFlashcards } from "@/app/_components/NoteFlashcards";

export const dynamic = "force-dynamic";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return scoped(async (ownerId) => {
    const note = await getNote(ownerId, id);
    if (!note) notFound();

    // A note written during "estudo livre" has no topic, and so no goal — the
    // trail just gets shorter rather than showing an empty crumb.
    const trail = [{ label: "Dashboard", href: "/" }];
    if (note.goalId && note.goalTitle) {
      trail.push({ label: note.goalTitle, href: `/goals/${note.goalId}` });
    }

    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:py-12">
        <Breadcrumbs items={[...trail, { label: note.title }]} />

        {note.topicTitle && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-faint">
            {note.topicTitle}
          </p>
        )}
        <h1 className="mb-1 text-2xl font-medium tracking-tight">{note.title}</h1>
        <p className="mb-6 text-xs text-faint">
          {note.sessionStartedAt ? (
            <>
              Escrita em {formatDayMonth(note.sessionStartedAt)} às{" "}
              {formatTime(note.sessionStartedAt)}
              {note.sessionMinutes != null && ` · sessão de ${note.sessionMinutes}min`}
            </>
          ) : (
            <>Criada em {formatDayMonth(note.createdAt)}</>
          )}
          {note.updatedAt.getTime() - note.createdAt.getTime() > 60_000 && (
            <> · editada em {formatDayMonth(note.updatedAt)}</>
          )}
        </p>

        <NoteEditor
          noteId={note.id}
          goalId={note.goalId ?? ""}
          initialTitle={note.title}
          initialContent={note.content}
        />

        {/* A card belongs to a topic, so this only appears when the note has
            one — a free-study note has nowhere to file the cards. */}
        {note.topicId && note.goalId && (
          <NoteFlashcards
            topicId={note.topicId}
            goalId={note.goalId}
            content={note.content}
          />
        )}
      </main>
    );
  });
}
