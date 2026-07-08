/** 정량 지표 집계 공통 타입. */
export type Period = { startYmd: string; endYmd: string };

export type MetricValue = {
  value: number;
  unit: string;
  /** 근거 문자열 (예: "1/2") — 채점 보조 패널 표시용. */
  detail?: string;
};

/** ISO 타임스탬프의 날짜(YYYY-MM-DD)가 기간 내(inclusive)인지. null이면 false. */
export function inRange(iso: string | null, p: Period): boolean {
  if (!iso) return false;
  const ymd = iso.slice(0, 10);
  return ymd >= p.startYmd && ymd <= p.endYmd;
}
