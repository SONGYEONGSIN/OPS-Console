import { describe, it, expect } from "vitest";
import { buildTabs, parseTab, parseWeekParam } from "../_params";

describe("parseTab", () => {
  it("설정은 admin 만", () => {
    expect(parseTab("settings", false)).toBe("application");
    expect(parseTab("settings", true)).toBe("settings");
    expect(parseTab("xx", true)).toBe("application");
    expect(parseTab(undefined, true)).toBe("application");
    expect(parseTab("status", false)).toBe("status");
  });
});

describe("parseWeekParam", () => {
  it("월요일만", () => {
    expect(parseWeekParam("2026-11-17")).toBeNull();
    expect(parseWeekParam("2026-11-16")).toBe("2026-11-16");
    expect(parseWeekParam(undefined)).toBeNull();
    expect(parseWeekParam("garbage")).toBeNull();
  });
});

describe("buildTabs", () => {
  it("확인한 탭에 ✓, 설정은 admin 만, op 를 이어 붙인다", () => {
    const t = buildTabs({
      weekStart: "2026-11-16",
      op: "a@x",
      isAdmin: false,
      checked: ["pims"],
    });
    expect(t.map((x) => x.label)).toEqual([
      "원서접수",
      "PIMS ✓",
      "프로젝트",
      "TF",
      "휴가·외근",
      "제출 현황",
    ]);
    expect(t[0].href).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&op=a%40x",
    );
  });

  it("admin 은 설정 탭까지, op 가 없으면 붙이지 않는다", () => {
    const t = buildTabs({
      weekStart: "2026-11-16",
      op: null,
      isAdmin: true,
      checked: [],
    });
    expect(t.map((x) => x.key)).toEqual([
      "application",
      "pims",
      "project",
      "tf",
      "leave",
      "status",
      "settings",
    ]);
    expect(t[6].href).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=settings",
    );
  });
});
