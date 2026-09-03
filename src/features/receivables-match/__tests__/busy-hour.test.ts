import { describe, it, expect } from "vitest";
import { isBusyHour, BUSY_HOURS_KST } from "../busy-hour";

/**
 * 몰리는 시각에는 돌지 않는다.
 *
 * 최근 10일 실행을 시각별로 세보니 **09시만 37%가 실패**했다(성공 5 / 실패 3).
 * 12시 이후로는 한 번도 안 걸렸다.
 *
 * 09시부터 `closing-scrape`(Moa 874건)가 합류하고 10시엔 미수 메일 3종까지 겹쳐
 * 정시에 11개가 동시에 돈다. 같은 Azure AD 앱으로 Graph 를 두드리니 테넌트 스로틀에
 * 걸리고, 그게 `MaxRequestDurationExceeded` 로 나온다.
 *
 * 매시간 도는 잡이라 한 시간 걸러도 잃는 게 없다 — 다음 정시에 밀린 것까지 처리한다.
 */
describe("isBusyHour", () => {
  const at = (h: number) => `2026-09-03T${String(h).padStart(2, "0")}:00:00+09:00`;

  it("09시는 건너뛴다", () => {
    expect(isBusyHour(new Date(at(9)))).toBe(true);
  });

  it("08시·10시는 돈다 — 09시만 뺀다", () => {
    expect(isBusyHour(new Date(at(8)))).toBe(false);
    expect(isBusyHour(new Date(at(10)))).toBe(false);
  });

  it("오후는 전부 돈다", () => {
    for (const h of [12, 15, 18, 19]) {
      expect(isBusyHour(new Date(at(h))), `${h}시`).toBe(false);
    }
  });

  it("한국 시각으로 잰다 — UTC 로 재면 아홉 시간 어긋난다", () => {
    // 2026-09-03T00:00:00Z = KST 09:00
    expect(isBusyHour(new Date("2026-09-03T00:00:00Z"))).toBe(true);
    // KST 09:00 이 아닌 UTC 09:00 = KST 18:00
    expect(isBusyHour(new Date("2026-09-03T09:00:00Z"))).toBe(false);
  });

  it("빼는 시각이 한 곳에만 있다", () => {
    expect(BUSY_HOURS_KST).toEqual([9]);
  });
});
