/**
 * 관제 지표 한 칸.
 *
 * 공용 `KpiCard` 를 쓰지 않는다 — 그쪽은 **기간 비교**용이라 증감이 없으면
 * "비교 불가"를 찍는다. 여기 지표는 지금 상태(도는 중·멈춤·오늘 실행)라 비교할
 * 직전 기간이 애초에 없고, 네 장 모두에 "비교 불가"가 뜨면 화면이 고장 난 것처럼
 * 보인다.
 *
 * 아래 줄에는 증감 대신 **그 숫자를 어떻게 읽어야 하는지**를 적는다.
 *
 * **자기 테두리를 갖지 않는다.** 넷이 각자 카드가 되면 아래 에이전트 카드와 같은
 * 층으로 보여, 무엇이 요약이고 무엇이 개체인지 읽히지 않는다. 요약은 한 판이고
 * 여기는 그 판을 나눈 한 칸이다.
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
      data-kpi={label}
      className="flex flex-col gap-1 px-4 py-3"
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
