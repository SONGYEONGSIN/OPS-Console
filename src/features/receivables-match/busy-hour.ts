/**
 * 몰리는 시각에는 돌지 않는다.
 *
 * 최근 10일 실행을 시각별로 세보니 **09시만 37%가 실패**했다(성공 5 / 실패 3).
 * 12시 이후로는 한 번도 안 걸렸다.
 *
 * 09시부터 `closing-scrape`(Moa 874건)가 합류하고 10시엔 미수 메일 3종까지 겹쳐
 * 정시에 11개가 동시에 돈다. 같은 Azure AD 앱으로 Graph 를 두드리니 테넌트 스로틀에
 * 걸리고, 그게 `MaxRequestDurationExceeded` 로 나온다(2026-09-01~03 사흘 연속).
 *
 * 매시간 도는 잡이라 한 시간 걸러도 잃는 게 없다 — 다음 정시에 밀린 것까지 처리한다.
 */

/** 건너뛸 시각(KST). 늘리기 전에 실패 통계를 먼저 본다. */
export const BUSY_HOURS_KST = [9];

export function isBusyHour(now: Date = new Date()): boolean {
  // **한국 시각으로 재야 한다.** UTC 로 재면 아홉 시간 어긋나 엉뚱한 때를 건너뛴다.
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  return BUSY_HOURS_KST.includes(hour);
}
