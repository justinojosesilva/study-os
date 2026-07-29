"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";
import { setGoalStatusAction } from "@/app/_actions/goals";
import { EditGoalForm } from "./EditGoalForm";
import type { Category } from "@/lib/categories";

type Props = {
  id: string;
  title: string;
  why: string | null;
  category: Category;
  targetDate: string;
  archived: boolean;
};

export function GoalActions({ id, title, why, category, targetDate, archived }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function archive() {
    if (!window.confirm("Arquivar este objetivo? Ele sai do dashboard, mas o histórico fica.")) {
      return;
    }
    run("archived", () => router.push("/"));
  }

  function reactivate() {
    run("active", () => router.refresh());
  }

  function run(status: "archived" | "active", onOk: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await setGoalStatusAction(id, status);
      if (res.ok) onOk();
      else setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {!archived && (
        <EditGoalForm id={id} title={title} why={why} category={category} targetDate={targetDate} />
      )}
      {archived ? (
        <button
          onClick={reactivate}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          <RotateCcw size={14} /> Reativar
        </button>
      ) : (
        <button
          onClick={archive}
          disabled={pending}
          aria-label="Arquivar objetivo"
          className="tip inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink hover:bg-surface-2 disabled:opacity-50"
        >
          <Archive size={14} /> Arquivar
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
