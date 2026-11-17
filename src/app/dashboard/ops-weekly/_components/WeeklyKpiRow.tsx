import type { WeeklyKpis } from "@/features/ops-weekly/merge";

// 라벨은 여기서만 정한다(순서 고정).
const CARDS: readonly { key: keyof WeeklyKpis; label: string }[] = [
  { key: "dev", label: "개발 중" },
  { key: "test", label: "테스트 중" },
  { key: "opening", label: "차주 오픈 예정" },
  { key: "running", label: "운영 중" },
  { key: "closing", label: "차주 마감 예정" },
  { key: "pims", label: "PIMS 발표 예정" },
];
const STAGE_KEYS: ReadonlySet<keyof WeeklyKpis> = new Set(["dev", "test"]);

/**
 * 건수 카드 6장. 개발/테스트 구분이 수집되지 않았으면(null) 0 이 아니라 `구분 미확인`이다.
 * 일부만 수집됐으면 숫자 옆에 구분이 안 된 건수를 적어 과소집계가 보이게 한다.
 */
export function WeeklyKpiRow({
  kpis,
  unknownCount = 0,
}: {
  kpis: WeeklyKpis;
  unknownCount?: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 px-5 pt-4 md:grid-cols-3 lg:px-7 xl:grid-cols-6">
      {CARDS.map(({ key, label }) => {
        const value = kpis[key];
        return (
          <div
            key={key}
            className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
          >
            <div
              data-testid="weekly-kpi-label"
              className="text-xs font-medium text-muted"
            >
              {label}
            </div>
            {value === null ? (
              <div className="text-sm font-medium text-muted">구분 미확인</div>
            ) : (
              <div className="text-2xl font-bold tabular-nums text-ink">
                {value.toLocaleString("ko-KR")}
              </div>
            )}
            {value !== null && STAGE_KEYS.has(key) && unknownCount > 0 ? (
              <div className="text-xs text-muted">{`구분 미확인 ${unknownCount}건`}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
