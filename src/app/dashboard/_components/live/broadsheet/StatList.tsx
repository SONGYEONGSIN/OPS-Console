export type StatRow = {
  label: string;
  value: string;
  tone?: "default" | "vermilion" | "sage";
};

export function StatList({ rows }: { rows: StatRow[] }) {
  return (
    <div className="flex flex-col border-y border-line-soft divide-y divide-line-soft bg-situation-bg">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-center justify-between px-4 py-2.5"
        >
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.1em] ${
              r.tone === "vermilion" ? "text-vermilion" : "text-muted"
            }`}
          >
            {r.label}
          </span>
          <span
            className={`text-lg font-bold tabular-nums ${
              r.tone === "vermilion"
                ? "text-vermilion"
                : r.tone === "sage"
                  ? "text-sage"
                  : "text-ink"
            }`}
          >
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
