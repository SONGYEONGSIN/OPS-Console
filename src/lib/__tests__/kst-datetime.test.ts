import { describe, it, expect } from "vitest";
import { kstDateTime } from "../kst-format";

/**
 * 실행 이력 시각은 **한 형식으로만** 찍는다.
 *
 * 자동화 실행 로그는 `2026. 9. 4. 오후 5:17:04`(12시간제·초까지), 에이전트
 * 인스펙터는 `17:17`(날짜 없음)이었다. 같은 종류의 값인데 화면마다 달라
 * 견주기가 안 됐다(2026-09-07 지적).
 */
describe("kstDateTime", () => {
  const iso = "2026-09-04T08:17:04Z"; // KST 17:17

  it("연도부터 분까지 — 실행 이력을 견주려면 연도가 있어야 한다", () => {
    expect(kstDateTime(iso)).toBe("2026. 09. 04. 17:17");
  });

  it("24시간제 — 오후를 쓰지 않는다", () => {
    expect(kstDateTime(iso)).not.toMatch(/오전|오후/);
  });

  it("초는 안 찍는다 — 실행 이력에서 초는 읽는 짐만 된다", () => {
    expect(kstDateTime(iso)).not.toMatch(/:\d\d:\d\d/);
  });

  it("자정을 24시로 쓰지 않는다", () => {
    expect(kstDateTime("2026-09-03T15:00:00Z")).toBe("2026. 09. 04. 00:00");
  });

  it("빈 값이면 대시 — 화면에 Invalid Date 를 흘리지 않는다", () => {
    expect(kstDateTime(null)).toBe("—");
    expect(kstDateTime("")).toBe("—");
  });

  it("깨진 값도 대시", () => {
    expect(kstDateTime("어제")).toBe("—");
  });
});
