type DomainRow = {
  domain: string;
  pending: number;
  inProgress: number;
  done: number;
};

/**
 * DomainHeatmap — 12 도메인 × 상태(대기/진행/완료) 행렬.
 * 카운트가 클수록 cell의 vermilion saturation이 높아져 시각 강조.
 * 0은 · (dot) 표시 — 활동 없음 신호.
 */
export function DomainHeatmap({ rows }: { rows: DomainRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-ink-soft">도메인 데이터 없음</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="domain-heatmap">
        <thead>
          <tr className="border-b border-line text-left text-2xs uppercase tracking-[0.18em] text-muted">
            <th className="py-2 pr-3">도메인</th>
            <th className="py-2 text-center">대기</th>
            <th className="py-2 text-center">진행</th>
            <th className="py-2 text-center">완료</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.domain}
              data-testid={`heatmap-row-${r.domain}`}
              className="border-b border-line-soft"
            >
              <td className="py-2 pr-3 font-medium text-ink">{r.domain}</td>
              <Cell value={r.pending} tone="pending" />
              <Cell value={r.inProgress} tone="inProgress" />
              <Cell value={r.done} tone="done" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TONE_BG: Record<"pending" | "inProgress" | "done", (n: number) => string> =
  {
    pending: (n) =>
      n === 0
        ? "bg-transparent text-muted"
        : n >= 4
          ? "bg-vermilion/40 text-vermilion-deep font-bold"
          : n >= 2
            ? "bg-vermilion/20 text-vermilion-deep"
            : "bg-vermilion/10 text-ink",
    inProgress: (n) =>
      n === 0
        ? "bg-transparent text-muted"
        : n >= 4
          ? "bg-indigo/40 text-indigo font-bold"
          : n >= 2
            ? "bg-indigo/20 text-indigo"
            : "bg-indigo/10 text-ink",
    done: (n) =>
      n === 0
        ? "bg-transparent text-muted"
        : n >= 4
          ? "bg-sage/40 text-sage font-bold"
          : n >= 2
            ? "bg-sage/20 text-sage"
            : "bg-sage/10 text-ink",
  };

function Cell({
  value,
  tone,
}: {
  value: number;
  tone: "pending" | "inProgress" | "done";
}) {
  return (
    <td className="py-1 text-center">
      <span
        className={`inline-block min-w-[2.5rem] px-2 py-0.5 font-mono ${TONE_BG[tone](value)}`}
      >
        {value === 0 ? "·" : value}
      </span>
    </td>
  );
}
