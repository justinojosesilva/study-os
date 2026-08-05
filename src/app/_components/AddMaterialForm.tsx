"use client";

import { useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createMaterialAction } from "@/app/_actions/materials";
import { MATERIAL_TYPE_OPTIONS } from "@/lib/materials";

type GoalOption = { id: string; title: string };

/**
 * Two modes: a fixed goal (goalId, used on the goal page) or a goal picker
 * (goals, used on the general /materials page — "" = unattached material).
 */
export function AddMaterialForm({
  goalId,
  goals,
}: {
  goalId?: string;
  goals?: GoalOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createMaterialAction(fd);
      if (res.ok) formRef.current?.reset();
      else setError(res.error);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
      {goals ? null : <input type="hidden" name="goalId" value={goalId} />}

      <div className="flex items-center gap-2">
        <select
          name="type"
          defaultValue="course"
          className="shrink-0 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm"
        >
          {MATERIAL_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          name="title"
          placeholder="Título do material"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
      </div>

      {/* `flex-wrap` porque a linha estourava 375px: o select de objetivo era
          `shrink-0` e o navegador o dimensiona pela OPÇÃO MAIS LONGA
          ("Certificação AWS Solutions Architect (SAA-C03)"), levando a página
          a 504px de largura no celular. Agora ele encolhe e, se ainda não
          couber, a linha quebra em vez de empurrar o documento. */}
      <div className="flex flex-wrap items-center gap-2">
        {goals && (
          <select
            name="goalId"
            defaultValue=""
            className="min-w-0 max-w-[10rem] flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-sm sm:max-w-[14rem]"
          >
            <option value="">Sem objetivo</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        )}
        <input
          name="url"
          type="url"
          placeholder="https://… (opcional)"
          className="min-w-0 flex-1 basis-40 rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-medium text-canvas disabled:opacity-50"
        >
          <Plus size={16} /> {pending ? "…" : "Add"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
