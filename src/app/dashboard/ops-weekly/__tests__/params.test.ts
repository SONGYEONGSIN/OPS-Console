import { describe, it, expect } from "vitest";
import {
  APP_SUBS,
  PIMS_SUBS,
  appVisibleSubs,
  buildTabs,
  defaultAppSub,
  opsWeeklyHref,
  parseSub,
  parseTab,
  parseWeekParam,
  resolveAppSub,
} from "../_params";

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

describe("parseSub", () => {
  it("없거나 목록 밖이면 탭별 기본값", () => {
    expect(parseSub("application", null, APP_SUBS)).toBe("dev");
    expect(parseSub("application", "nope", APP_SUBS)).toBe("dev");
    expect(parseSub("pims", null, PIMS_SUBS)).toBe("thisWeek");
    expect(parseSub("pims", "", PIMS_SUBS)).toBe("thisWeek");
  });
  it("다른 탭의 키는 기본값으로 돌린다", () => {
    expect(parseSub("application", "nextWeek", APP_SUBS)).toBe("dev");
    expect(parseSub("pims", "running", PIMS_SUBS)).toBe("thisWeek");
  });
  it("지금 안 보이는 탭(구분 미확인 0건)은 기본값", () => {
    const visible = APP_SUBS.filter((k) => k !== "unknown");
    expect(parseSub("application", "unknown", visible)).toBe("dev");
    expect(parseSub("application", "unknown", APP_SUBS)).toBe("unknown");
  });
  it("보이는 유효 키는 그대로", () => {
    expect(parseSub("application", "closing", APP_SUBS)).toBe("closing");
    expect(parseSub("pims", "nextWeek", PIMS_SUBS)).toBe("nextWeek");
  });
  it("묶음 키 목록은 merge 의 묶음 키와 같은 어휘다", () => {
    expect([...APP_SUBS].sort()).toEqual(
      ["dev", "test", "unknown", "running", "opening", "closing", "other"].sort(),
    );
    expect([...PIMS_SUBS]).toEqual(["thisWeek", "nextWeek"]);
  });
});

describe("opsWeeklyHref sub", () => {
  it("sub 가 없으면 기존 모양 그대로", () => {
    expect(opsWeeklyHref("2026-11-16", "pims", null)).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=pims",
    );
    expect(opsWeeklyHref("2026-11-16", "pims", null, null)).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=pims",
    );
  });
  it("sub 는 op 뒤에 붙는다", () => {
    expect(opsWeeklyHref("2026-11-16", "application", null, "test")).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&sub=test",
    );
    expect(opsWeeklyHref("2026-11-16", "application", "a@x", "test")).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&op=a%40x&sub=test",
    );
  });
  it("탭 이동 링크(buildTabs)는 sub 를 들고 가지 않는다", () => {
    const t = buildTabs({
      weekStart: "2026-11-16",
      op: null,
      isAdmin: false,
      checked: [],
    });
    expect(t.every((x) => !x.href.includes("sub="))).toBe(true);
  });
});

describe("원서접수 하위 탭 해석 — SubTabs·KPI 카드가 같은 함수를 쓴다", () => {
  it("구분이 수집된 주의 기본은 dev, 수집 전 주의 기본은 running", () => {
    expect(defaultAppSub(true)).toBe("dev");
    expect(defaultAppSub(false)).toBe("running");
  });
  it("보이는 키: 구분 미확인은 보일 때만", () => {
    expect(appVisibleSubs(true)).toContain("unknown");
    expect(appVisibleSubs(false)).not.toContain("unknown");
  });
  it("resolveAppSub: 없으면 그 주의 기본, 안 보이는 unknown 도 기본", () => {
    expect(resolveAppSub(null, { showUnknown: false, collected: true })).toBe(
      "dev",
    );
    expect(resolveAppSub(null, { showUnknown: false, collected: false })).toBe(
      "running",
    );
    expect(
      resolveAppSub("unknown", { showUnknown: false, collected: true }),
    ).toBe("dev");
    expect(
      resolveAppSub("unknown", { showUnknown: true, collected: true }),
    ).toBe("unknown");
    expect(
      resolveAppSub("closing", { showUnknown: false, collected: false }),
    ).toBe("closing");
  });
  it("parseSub 의 네 번째 인자로 기본값을 바꾼다", () => {
    expect(parseSub("application", null, APP_SUBS, "running")).toBe("running");
    expect(parseSub("application", "test", APP_SUBS, "running")).toBe("test");
  });
});
