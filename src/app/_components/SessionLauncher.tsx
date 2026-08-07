"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Play } from "lucide-react";
import { SessionLogger } from "./SessionLogger";
import type { PickerTopic } from "@/domain/topics/repository";
import type { PickerMaterial } from "@/domain/materials/repository";

/**
 * One session dialog for the whole agenda, opened on demand.
 *
 * Every plan block used to mount its own `SessionLogger`. On a normal week
 * that meant 27 of them on one page: 27 hidden textareas, 27 topic `<select>`s
 * carrying 1.134 `<option>` between them, 27 timers and 27 ambient-audio
 * hooks, in 436 KB of HTML — with the database nearly empty.
 *
 * Now the blocks render a plain button that asks the launcher to open. The
 * dialog is mounted only while it is open and is keyed by the request, so each
 * launch starts with a fresh timer instead of needing to reset one.
 */

type Request = { topicId?: string; minutes?: number; seq: number };
type Launcher = (topicId?: string, minutes?: number) => void;

const LauncherCtx = createContext<Launcher | null>(null);

export function SessionLauncherProvider({
  topics,
  materials = [],
  children,
}: {
  topics: PickerTopic[];
  materials?: PickerMaterial[];
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<Request | null>(null);

  const launch = useCallback<Launcher>((topicId, minutes) => {
    // `seq` makes two launches of the SAME block distinct, so the dialog
    // remounts instead of reopening with the previous timer still running.
    setRequest((prev) => ({ topicId, minutes, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const value = useMemo(() => launch, [launch]);

  return (
    <LauncherCtx.Provider value={value}>
      {children}
      {request && (
        <SessionLogger
          key={`${request.topicId ?? "livre"}-${request.minutes ?? 0}-${request.seq}`}
          topics={topics}
          materials={materials}
          initialTopicId={request.topicId}
          initialMinutes={request.minutes}
          autoOpen
          hideTrigger
          onDismiss={() => setRequest(null)}
        />
      )}
    </LauncherCtx.Provider>
  );
}

function useLauncher(): Launcher | null {
  return useContext(LauncherCtx);
}

/**
 * The button a plan block shows. Falls back to nothing outside a provider,
 * which keeps the block components usable in isolation.
 */
export function StartBlockButton({
  topicId,
  minutes,
  label = "Iniciar",
  className,
}: {
  topicId?: string;
  minutes?: number;
  label?: string;
  className?: string;
}) {
  const launch = useLauncher();
  if (!launch) return null;

  return (
    <button
      type="button"
      onClick={() => launch(topicId, minutes)}
      className={
        className ??
        "press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-surface-2"
      }
    >
      <Play size={14} /> {label}
    </button>
  );
}
