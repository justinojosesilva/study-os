"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createTopicAction } from "@/app/_actions/topics";

export function AddTopicForm({ goalId }: { goalId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createTopicAction(fd);
      if (res.ok) formRef.current?.reset();
      else setError(res.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="goalId" value={goalId} />
      <input
        name="title"
        placeholder="Adicionar tópico (ex: VPC)"
        className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <input
        name="weight"
        type="number"
        min={1}
        defaultValue={1}
        aria-label="Peso"
        className="w-16 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
      >
        <Plus size={16} /> {pending ? "…" : "Add"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
