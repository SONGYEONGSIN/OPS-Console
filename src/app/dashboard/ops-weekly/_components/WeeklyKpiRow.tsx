import type { WeeklyKpis } from "@/features/ops-weekly/merge";

// 라벨은 여기서만 정한다(순서 고정).
const CARDS: readonly { key: keyof WeeklyKpis; label: string }[] = [
  { key: "dev", label: "개발 중" },
  { key: "test", label: "테스트 중" },
  { key: "running", label: "운영 중" },
  { key: "pims", label: "PIMS 발표 예정" },
];
// 한 장에 두 칸으로 묶는다 — 운영리포트 '계약 체결'(ContractSheetCard)과 같은 모양.
// 합계는 내지 않는다: 접수 중이면서 차주 마감인 건이 둘 다 들 수 있어 합이 뜻을 잃는다.
const PAIR_LABEL = "차주 오픈 / 마감";
const PAIR: readonly { key: keyof WeeklyKpis; label: string }[] = [
  { key: "opening", label: "차주 오픈 예정" },
  { key: "closing", label: "차주 마감 예정" },
];
const STAGE_KEYS: ReadonlySet<keyof WeeklyKpis> = new Set(["dev", "test"]);

/**
 * 건수 카드 5장(한 장은 두 칸 — 차주 오픈·마감). 개발/테스트 구분이 수집되지 않았으면(null) 0 이 아니라 `구분 미확인`이다.
 * 일부만 수집됐으면 숫자 옆에 구분이 안 된 건수를 적어 과소집계가 보이게 한다.
 */
export function WeeklyKpiRow({
  kpis,
  ownerName,
  unknownCount = 0,
}: {
  kpis: WeeklyKpis;
  /** 이 숫자가 누구의 보고서 것인지 — 제출 현황·설정 탭에서도 카드가 남아 있어 밝혀야 한다 */
  ownerName: string;
  unknownCount?: number;
}) {
  return (
    <>
      <p className="px-5 pt-4 text-xs text-muted lg:px-7">
        {`${ownerName}의 이번 주 · 항목 간 중복 집계될 수 있습니다`}
      </p>
      <div className="grid grid-cols-2 gap-3 px-5 pt-2 md:grid-cols-3 lg:px-7 xl:grid-cols-6">
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
                <div className="text-sm font-medium text-muted">
                  구분 미확인
                </div>
              ) : (
                <div className="text-2xl font-bold tabular-nums text-ink">
                  {value.toLocaleString("ko-KR")}
                  <span className="ml-0.5 text-sm font-medium text-muted">
                    건
                  </span>
                </div>
              )}
              {value !== null && STAGE_KEYS.has(key) && unknownCount > 0 ? (
                <div className="text-xs text-muted">{`구분 미확인 ${unknownCount}건`}</div>
              ) : null}
            </div>
          );
        })}
        <div
          role="group"
          aria-label={PAIR_LABEL}
          className="col-span-2 flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
        >
          <div className="text-xs font-medium text-muted">{PAIR_LABEL}</div>
          <div className="flex gap-3">
            {PAIR.map(({ key, label }, i) => (
              <div key={key} className="flex min-w-0 flex-1 gap-3">
                {i > 0 ? (
                  <div className="w-px shrink-0 self-stretch bg-line-soft" />
                ) : null}
                <div
                  data-segment={key}
                  className="flex min-w-0 flex-col gap-0.5"
                >
                  <div
                    data-testid="weekly-kpi-label"
                    className="text-2xs text-muted [overflow-wrap:anywhere]"
                  >
                    {label}
                  </div>
                  <div className="text-2xl font-bold tabular-nums text-ink">
                    {(kpis[key] ?? 0).toLocaleString("ko-KR")}
                    <span className="ml-0.5 text-sm font-medium text-muted">
                      건
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
