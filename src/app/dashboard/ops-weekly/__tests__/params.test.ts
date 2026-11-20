import { describe, it, expect } from "vitest";
import { AREA_LABEL } from "@/features/ops-weekly/constants";
import {
  APP_SUBS,
  AREA_TABS,
  AREA_TAB_LABEL,
  MANAGE_SECTIONS,
  MANAGE_SECTION_LABEL,
  OPS_TABS,
  PIMS_SUBS,
  appVisibleSubs,
  buildRoleTabs,
  buildTabs,
  defaultAppSub,
  manageHref,
  opsWeeklyHref,
  parseSection,
  parseSub,
  parseWeekParam,
  resolveAppSub,
  resolveArea,
  resolveTab,
  roleTabOf,
  roleTabsOf,
  type TabAccess,
} from "../_params";

describe("parseWeekParam", () => {
  it("월요일만", () => {
    expect(parseWeekParam("2026-11-17")).toBeNull();
    expect(parseWeekParam("2026-11-16")).toBe("2026-11-16");
    expect(parseWeekParam(undefined)).toBeNull();
    expect(parseWeekParam("garbage")).toBeNull();
  });
});

describe("buildTabs", () => {
  it("확인한 탭에 ✓, op 를 이어 붙인다", () => {
    const t = buildTabs({
      weekStart: "2026-11-16",
      op: "a@x",
      checked: ["pims"],
    });
    expect(t.map((x) => x.label)).toEqual([
      "원서접수",
      "합격자 발표 ✓",
      "프로젝트",
      "TF",
      "휴가·외근",
    ]);
    expect(t[0].href).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&op=a%40x",
    );
  });

  it("영역 다섯만 — 제출 현황·설정은 역할 탭 줄로, op 가 없으면 붙이지 않는다", () => {
    const t = buildTabs({
      weekStart: "2026-11-16",
      op: null,
      checked: [],
    });
    expect(t.map((x) => x.key)).toEqual([
      "application",
      "pims",
      "project",
      "tf",
      "leave",
    ]);
    expect(t[4].href).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=leave",
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

const W = "2026-11-16";
const acc = (o: Partial<TabAccess> = {}): TabAccess => ({ canReport: true, status: null, manage: false, ...o });

describe("resolveTab — 주소 어휘 그대로, 권한 없는 값은 처음 화면", () => {
  it("작성자만: status·settings·모르는 값·빈 값은 원서접수", () => {
    for (const raw of ["status", "settings", "xx", undefined]) expect(resolveTab(raw, acc())).toBe("application");
    expect(resolveTab("pims", acc())).toBe("pims");
    expect(resolveTab("tf", acc())).toBe("tf");
  });
  it("명단 밖 당번: 내 보고서 값은 제출 현황으로", () => {
    const a = acc({ canReport: false, status: "manage" });
    for (const raw of ["application", "project", "settings", undefined]) expect(resolveTab(raw, a)).toBe("status");
  });
  it("관리자는 settings 그대로", () => {
    expect(resolveTab("settings", acc({ canReport: false, status: "manage", manage: true }))).toBe("settings");
  });
  it("받는 사람(보고된 주): status 는 그대로, 나머지는 status", () => {
    const a = acc({ canReport: false, status: "read" });
    expect(resolveTab("status", a)).toBe("status");
    expect(resolveTab("settings", a)).toBe("status");
  });
  it("볼 화면이 없으면 null", () => {
    expect(resolveTab("status", acc({ canReport: false }))).toBeNull();
    expect(resolveTab(undefined, acc({ canReport: false }))).toBeNull();
  });
});

describe("역할 탭", () => {
  it("roleTabsOf — 일반 운영자 1개, 작성자 당번 2개, 명단 밖 관리자 2개, 작성자 관리자 3개", () => {
    expect(roleTabsOf(acc())).toEqual(["report"]);
    expect(roleTabsOf(acc({ status: "manage" }))).toEqual(["report", "status"]);
    expect(roleTabsOf(acc({ canReport: false, status: "manage", manage: true }))).toEqual(["status", "manage"]);
    expect(roleTabsOf(acc({ status: "manage", manage: true }))).toEqual(["report", "status", "manage"]);
  });
  it("roleTabOf — tab 값 7개를 역할로", () => {
    expect(OPS_TABS.map(roleTabOf)).toEqual(["report", "report", "report", "report", "report", "status", "manage"]);
  });
  it("buildRoleTabs — 라벨·주소, op·sub 를 들고 가지 않는다", () => {
    const t = buildRoleTabs({ weekStart: W, roles: ["report", "status", "manage"] });
    expect(t.map((x) => x.label)).toEqual(["내 보고서", "제출 현황", "관리"]);
    expect(t.map((x) => x.href)).toEqual([
      `/dashboard/ops-weekly?week=${W}&tab=application`,
      `/dashboard/ops-weekly?week=${W}&tab=status`,
      `/dashboard/ops-weekly?week=${W}&tab=settings`,
    ]);
  });
});

describe("관리 메뉴", () => {
  it("관리 메뉴 일곱 개 순서와 section 해석", () => {
    expect(MANAGE_SECTIONS.map((s) => MANAGE_SECTION_LABEL[s])).toEqual([
      "전체 현황", "당번 지정", "받는 사람", "당번 순번표", "작성 제외", "프로젝트·TF 목록", "안 붙은 서비스",
    ]);
    expect(parseSection(null)).toBe("overview");
    expect(parseSection("unmatched")).toBe("unmatched");
    expect(parseSection("nope")).toBe("overview");
    expect(manageHref(W, "unmatched")).toBe(`/dashboard/ops-weekly?week=${W}&tab=settings&section=unmatched`);
  });
});

describe("AREA_TAB_LABEL", () => {
  it("영역 라벨만 '합격자 발표' — 도메인 AREA_LABEL 은 그대로", () => {
    expect(AREA_TAB_LABEL).toEqual({ ...AREA_LABEL, pims: "합격자 발표" });
    expect(AREA_LABEL.pims).toBe("PIMS");
  });
});

describe("영역 주소", () => {
  it("resolveArea — 서랍·역할 탭 값은 원서접수", () => {
    expect(resolveArea("pims")).toBe("pims");
    expect(resolveArea("leave")).toBe("leave");
    for (const raw of ["project", "tf", "status", null])
      expect(resolveArea(raw)).toBe("application");
  });
  it("AREA_TABS — 왼쪽 영역 셋의 순서와 라벨", () => {
    expect(AREA_TABS.map((a) => AREA_TAB_LABEL[a])).toEqual([
      "원서접수",
      "합격자 발표",
      "휴가·외근",
    ]);
  });
});
