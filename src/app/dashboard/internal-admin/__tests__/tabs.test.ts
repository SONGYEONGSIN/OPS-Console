import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  MAIN_TABS,
  SUB_VIEWS,
  resolveView,
  viewHref,
} from "../tabs";

describe("내부관리자 탭", () => {
  it("메인 탭은 'SMS 발신번호 등록' 하나", () => {
    expect(MAIN_TABS.map((t) => [t.key, t.label])).toEqual([
      ["sms", "SMS 발신번호 등록"],
    ]);
    expect(MAIN_TABS[0].href).toBe("/dashboard/internal-admin?tab=sms");
  });

  it("서브 탭 이름·순서와 새 형식 href — 개요는 없다", () => {
    expect(SUB_VIEWS.map((t) => [t.key, t.label, t.href])).toEqual([
      ["schools", "학교", "/dashboard/internal-admin?tab=sms&view=schools"],
      ["numbers", "발신번호", "/dashboard/internal-admin?tab=sms&view=numbers"],
      ["checks", "확인 필요", "/dashboard/internal-admin?tab=sms&view=checks"],
    ]);
  });

  it("기본 뷰는 학교", () => expect(DEFAULT_VIEW).toBe("schools"));

  it("viewHref 는 새 형식 주소를 만든다", () => {
    expect(viewHref("numbers")).toBe(
      "/dashboard/internal-admin?tab=sms&view=numbers",
    );
  });
});

describe("resolveView", () => {
  it.each(["schools", "numbers", "checks"] as const)(
    "새 형식 tab=sms&view=%s",
    (v) => expect(resolveView("sms", v)).toBe(v),
  );

  it("tab=sms 에 view 가 없으면 기본 뷰", () =>
    expect(resolveView("sms", "")).toBe("schools"));

  it.each(["schools", "numbers", "checks"] as const)(
    "옛 형식 tab=%s 는 같은 뷰",
    (t) => expect(resolveView(t, "")).toBe(t),
  );

  it("지운 개요 — 옛 view=overview·tab=overview 는 학교", () => {
    expect(resolveView("sms", "overview")).toBe("schools");
    expect(resolveView("overview", "")).toBe("schools");
  });

  it("옛 형식은 view 를 보지 않는다", () =>
    expect(resolveView("numbers", "checks")).toBe("numbers"));

  it("모르는 tab 은 기본 뷰", () => {
    expect(resolveView("zzz", "")).toBe("schools");
    expect(resolveView("zzz", "numbers")).toBe("schools");
    expect(resolveView("", "")).toBe("schools");
  });

  it("모르는 view 는 기본 뷰", () =>
    expect(resolveView("sms", "zzz")).toBe("schools"));
});
