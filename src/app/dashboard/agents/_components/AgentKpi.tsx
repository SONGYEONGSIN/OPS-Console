/**
 * 관제 지표 카드 한 장.
 *
 * 공용 `KpiCard` 를 쓰지 않는다 — 그쪽은 **기간 비교**용이라 증감이 없으면
 * "비교 불가"를 찍는다. 여기 지표는 지금 상태(도는 중·멈춤·오늘 실행)라 비교할
 * 직전 기간이 애초에 없고, 네 장 모두에 "비교 불가"가 뜨면 화면이 고장 난 것처럼
 * 보인다.
 *
 * 대신 같은 시각 언어를 쓴다 — 테두리·배경·라벨·숫자 크기 전부 KpiCard 와 같다.
 * 아래 줄에는 증감 대신 **그 숫자를 어떻게 읽어야 하는지**를 적는다.
 */
export function AgentKpi({
  label,
  value,
  note,
  alert,
  testId,
}: {
  label: string;
  value: number;
  /** 숫자를 어떻게 읽어야 하는지. 비면 줄을 만들지 않는다. */
  note: string;
  /** 관제탑에서 멈춤이 검은 글씨면 놓친다. */
  alert?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-1 border border-line-soft bg-situation-bg p-4"
    >
      <div className="text-xs font-medium text-muted">{label}</div>
      <span
        data-testid="kpi-value"
        className={`text-2xl font-bold tabular-nums ${
          alert ? "text-vermilion" : "text-ink"
        }`}
      >
        {value.toLocaleString("ko-KR")}
      </span>
      {note && <div className="text-2xs text-muted">{note}</div>}
    </div>
  );
}
