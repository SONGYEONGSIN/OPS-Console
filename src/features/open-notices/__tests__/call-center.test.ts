import { describe, it, expect } from "vitest";
import { callCenterLines, CALL_CENTER } from "../call-center";

/**
 * 고객센터 운영시간 안내.
 *
 * 평소에는 **요일별 기본 시간**이고, **수시(9월)·정시(1월) 두 철만** 연장한다.
 * 그동안 `평일 09:00~18:00 (마감일 ~22:00 연장 운영)` 한 줄이었는데, 실제와 달랐다
 * — 월요일은 10시 시작이고 금요일은 17시에 닫는다(2026-09-01 실제 안내문).
 *
 * 접수 시작일로 가른다. 그 무렵이 지원자가 문의를 시작하는 때다.
 */
describe("callCenterLines", () => {
  it("전화번호는 한 곳에만 있다", () => {
    expect(CALL_CENTER).toBe("1544-7715");
  });

  it("평소에는 요일별 기본 시간을 적는다", () => {
    const t = callCenterLines("2026-05-20T09:00:00+09:00").join("\n");
    expect(t).toContain("10~18");   // 월
    expect(t).toContain("09~17");   // 금
    expect(t).toContain("12:20~13:30");
    expect(t).toContain("주말");
  });

  it("수요일 점심이 다르다는 것도 적는다 — 그날만 14시까지다", () => {
    expect(callCenterLines(null).join("\n")).toMatch(/수요일/);
  });

  it("9월 수시 기간이면 연장 안내가 붙는다", () => {
    const t = callCenterLines("2026-09-08T10:00:00+09:00").join("\n");
    expect(t).toContain("09~21");
  });

  it("연장 기간에도 기본 시간은 함께 적는다 — 그 뒤로도 문의가 온다", () => {
    const t = callCenterLines("2026-09-08T10:00:00+09:00").join("\n");
    expect(t).toContain("10~18");
  });

  it("기간 밖이면 연장 문구를 안 넣는다 — 없는 시간을 알리지 않는다", () => {
    expect(callCenterLines("2026-08-20T10:00:00+09:00").join("\n")).not.toContain("09~21");
    expect(callCenterLines("2026-10-05T10:00:00+09:00").join("\n")).not.toContain("09~21");
  });

  it("날짜를 모르면 기본만 — 지어내지 않는다", () => {
    const t = callCenterLines(undefined).join("\n");
    expect(t).toContain("10~18");
    expect(t).not.toContain("09~21");
  });

  it("이상한 날짜에도 던지지 않는다", () => {
    expect(() => callCenterLines("이상한값")).not.toThrow();
  });

  it("경계일이 포함된다 — 시작일·종료일 당일도 연장이다", () => {
    expect(callCenterLines("2026-09-07T00:00:00+09:00").join("\n")).toContain("09~21");
    expect(callCenterLines("2026-09-30T23:00:00+09:00").join("\n")).toContain("09~21");
  });
});
