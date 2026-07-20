import { startOfWeek, addDays, toDateKey } from "@/lib/date";

const WEEKS = 26;
const CELL = 13; // px
const GAP = 3; // px

const LEVEL_BG = [
  "var(--surface-2)",
  "color-mix(in srgb, var(--faculdade) 28%, var(--surface-2))",
  "color-mix(in srgb, var(--faculdade) 52%, var(--surface-2))",
  "color-mix(in srgb, var(--faculdade) 76%, var(--surface-2))",
  "var(--faculdade)",
];

const WEEKDAY_LABELS = ["Seg", "", "Qua", "", "Sex", "", ""];
const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function level(minutes: number): number {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

export function Heatmap({ minutesByDay }: { minutesByDay: Map<string, number> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const gridStart = addDays(startOfWeek(), -(WEEKS - 1) * 7); // Monday, WEEKS ago

  // Columns of 7 days (Mon→Sun). Future days are rendered blank.
  const columns = Array.from({ length: WEEKS }, (_, w) => {
    const colStart = addDays(gridStart, w * 7);
    const days = Array.from({ length: 7 }, (_, d) => {
      const date = addDays(colStart, d);
      const isFuture = date.getTime() > today.getTime();
      const minutes = minutesByDay.get(toDateKey(date)) ?? 0;
      return { date, minutes, isFuture };
    });
    return { colStart, days };
  });

  let totalMin = 0;
  let activeDays = 0;
  for (const minutes of minutesByDay.values()) {
    if (minutes > 0) {
      totalMin += minutes;
      activeDays += 1;
    }
  }

  // Month label appears on the first column that falls in a new month.
  let lastMonth = -1;

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-medium">Constância</h2>
        <span className="text-sm text-muted">
          {(Math.round((totalMin / 60) * 10) / 10).toLocaleString("pt-BR")}h em {activeDays} dias · últimas {WEEKS} semanas
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface px-5 py-4">
        <div className="inline-flex flex-col" style={{ gap: GAP }}>
          <div className="flex" style={{ gap: GAP, paddingLeft: 28 }}>
            {columns.map((col, i) => {
              const month = col.colStart.getMonth();
              const show = month !== lastMonth;
              lastMonth = month;
              return (
                <div
                  key={i}
                  className="whitespace-nowrap text-[10px] text-faint"
                  style={{ width: CELL }}
                >
                  {show ? MONTHS_PT[month] : ""}
                </div>
              );
            })}
          </div>

          <div className="flex" style={{ gap: GAP }}>
            <div className="flex flex-col" style={{ gap: GAP, width: 28 }}>
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="text-[10px] leading-none text-faint"
                  style={{ height: CELL, lineHeight: `${CELL}px` }}
                >
                  {label}
                </div>
              ))}
            </div>

            {columns.map((col, i) => (
              <div key={i} className="flex flex-col" style={{ gap: GAP }}>
                {col.days.map((day, d) => (
                  <div
                    key={d}
                    title={
                      day.isFuture
                        ? undefined
                        : `${formatFull(day.date)} · ${day.minutes} min`
                    }
                    className="rounded-[3px]"
                    style={{
                      width: CELL,
                      height: CELL,
                      background: day.isFuture ? "transparent" : LEVEL_BG[level(day.minutes)],
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-faint">
        <span>menos</span>
        {LEVEL_BG.map((bg, i) => (
          <span
            key={i}
            className="rounded-[3px]"
            style={{ width: 11, height: 11, background: bg }}
          />
        ))}
        <span>mais</span>
      </div>
    </section>
  );
}

function formatFull(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(d);
}
