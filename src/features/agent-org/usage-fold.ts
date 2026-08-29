/**
 * 시각 목록 → KST 날짜별 건수.
 *
 * 카드에 '오늘 N건'과 7일 막대를 띄우려면 필요한 계산이고, 순수 함수로 둔다 —
 * 쿼리 안에 묻으면 월말·자정 경계를 테스트할 수 없다.
 *
 * 경계는 **`lt(익일 00:00)`** 로 잡는다. 리포트 쪽이 쓰는 `lte(23:59:59)` 는
 * 23:59:59.5 를 잃는다 — 한 화면에서 두 방식이 섞이면 숫자가 미묘하게 갈린다.
 */

/** ISO 시각 → KST 날짜(YYYY-MM-DD). */
function kstYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** 오늘(KST)을 마지막으로 하는 N일. 오름차순이라 그대로 막대 순서가 된다. */
export function lastKstDays(n: number, now: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    // UTC 기준 날짜 연산으로 빼야 윤년·월말을 안전하게 넘는다.
    const d = new Date(now.getTime() - i * 86_400_000);
    out.push(kstYmd(d));
  }
  return out;
}

/** 시각 목록을 주어진 날짜 배열에 맞춰 센다. 구간 밖은 버린다. */
export function foldByKstDay(
  atIsoList: readonly string[],
  days: readonly string[],
): number[] {
  const index = new Map(days.map((d, i) => [d, i]));
  const counts = days.map(() => 0);
  for (const iso of atIsoList) {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) continue;
    const i = index.get(kstYmd(new Date(ms)));
    if (i !== undefined) counts[i] += 1;
  }
  return counts;
}
