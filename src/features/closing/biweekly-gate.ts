/**
 * 실행 주기 게이트 — anchor(기준 월요일)로부터 경과 주 수를 RUN_INTERVAL_WEEKS로 나눠 판정.
 *
 * cron이 매주 월 호출할 때, anchor와 같은 주기의 주만 실행한다.
 * RUN_INTERVAL_WEEKS=1 이면 매주(주간), 2 이면 격주. 현재 운영 기준은 주간(1).
 * anchor 경과 주 방식은 53주 해 경계에서도 어긋나지 않아 강건하다.
 *
 * Python 스크래퍼(Phase 2 §7)는 동일 규칙을 재구현하며 본 util 테스트로 동치를 보장한다.
 * anchor 기본값(2026-06-08)은 설계 §결정 Q1. 운영 값은 env(CLOSING_BIWEEKLY_ANCHOR)로 주입.
 */

/** 실행 주기(주). 1=매주(주간), 2=격주. Python scrape.py와 동치 유지. */
const RUN_INTERVAL_WEEKS = 1;

const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 날짜(YYYY-MM-DD)를 UTC 자정 epoch ms로. 시각 무시 — 일 단위 비교용. */
function kstDateToUtcMidnight(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00Z`);
}

/** 주어진 KST 날짜가 속한 주의 월요일(YYYY-MM-DD)을 반환. */
function mondayOfKstWeek(ymd: string): string {
  const ms = kstDateToUtcMidnight(ymd);
  const dow = new Date(ms).getUTCDay(); // 0=일 ~ 6=토 (UTC 자정이라 KST 요일과 동일)
  const offsetToMonday = (dow + 6) % 7; // 월=0, 일=6
  return KST_YMD.format(new Date(ms - offsetToMonday * DAY_MS));
}

/**
 * now(KST 기준)가 속한 주의 월요일이 anchorMonday로부터 짝수 주 떨어져 있으면 실행.
 * @param now 판정 기준 시각
 * @param anchorMonday 기준 월요일 'YYYY-MM-DD' (KST)
 */
export function shouldRunThisWeek(now: Date, anchorMonday: string): boolean {
  const nowYmd = KST_YMD.format(now);
  const thisMonday = mondayOfKstWeek(nowYmd);
  const anchor = mondayOfKstWeek(anchorMonday);

  const diffWeeks = Math.round(
    (kstDateToUtcMidnight(thisMonday) - kstDateToUtcMidnight(anchor)) /
      (7 * DAY_MS),
  );
  return diffWeeks % RUN_INTERVAL_WEEKS === 0;
}
