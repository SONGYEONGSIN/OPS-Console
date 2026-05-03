/**
 * Masthead — 신문 1면 제호. "실시간 현황 · OPSROOM 일간 · YYYY.MM.DD 목요일 · vol.NNN".
 * 카드/대시보드 톤이 아니라 편집물(publication) 프레이밍의 시작점.
 */
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function Masthead({
  now,
  shiftLabel,
  volume,
}: {
  now: Date;
  shiftLabel: string;
  volume: number;
}) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const weekday = WEEKDAY_KO[now.getDay()];
  const vol = String(volume).padStart(3, "0");

  return (
    <header className="mb-5 border-b-2 border-line pb-3">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-semibold leading-none tracking-[-0.04em] text-ink">
            실시간 현황
          </h1>
          <span className="font-mono text-2xs uppercase tracking-[0.22em] text-muted">
            OPSROOM <span className="text-vermilion">·</span> 일간
          </span>
        </div>
        <div className="font-mono text-2xs uppercase tracking-[0.18em] text-muted">
          vol.{vol}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
        <span className="font-mono">
          {yyyy}.{mm}.{dd}
        </span>
        <span className="text-faint">{weekday}요일</span>
        <span aria-hidden className="h-3 w-px bg-line-soft" />
        <span>{shiftLabel}</span>
        <span className="ml-auto border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-ink">
          live
        </span>
      </div>
    </header>
  );
}
