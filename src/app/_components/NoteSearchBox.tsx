"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

/**
 * Submits to the URL rather than filtering in place: the search runs in
 * Postgres, and putting the term in the query string keeps a result set
 * linkable and survivable across a reload.
 */
export function NoteSearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/notes?q=${encodeURIComponent(q)}` : "/notes");
  }

  return (
    <form onSubmit={submit} className="mb-5 flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          type="search"
          aria-label="Buscar nas anotações"
          placeholder="Buscar… (aspas para expressão exata)"
          className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm"
        />
      </div>
      {initial && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            router.push("/notes");
          }}
          className="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink"
        >
          <X size={14} /> Limpar
        </button>
      )}
      <button
        type="submit"
        className="press shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-canvas"
      >
        Buscar
      </button>
    </form>
  );
}
