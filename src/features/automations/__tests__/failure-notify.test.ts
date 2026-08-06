import { describe, it, expect } from "vitest";
import { shouldNotifyFailure, renderFailureHtml } from "../failure-notify";
import type { AutomationRunEntry } from "../types";

const entry = (over: Partial<AutomationRunEntry> = {}): AutomationRunEntry => ({
  ranAt: "2026-08-06T09:08:00+09:00",
  ok: true,
  skipped: false,
  message: "",
  ...over,
});

describe("shouldNotifyFailure", () => {
  it("첫 실패면 알린다", () => {
    expect(
      shouldNotifyFailure([
        entry({ ok: false, message: "터짐" }),
        entry({ ok: true }),
      ]),
    ).toBe(true);
  });

  it("직전도 실패였으면 다시 알리지 않는다 — 매시간 잡이 하루 24통을 보내는 걸 막는다", () => {
    expect(
      shouldNotifyFailure([
        entry({ ok: false, message: "또 터짐" }),
        entry({ ok: false, message: "터짐" }),
      ]),
    ).toBe(false);
  });

  it("복구 후 재발이면 다시 알린다", () => {
    expect(
      shouldNotifyFailure([
        entry({ ok: false, message: "재발" }),
        entry({ ok: true }),
        entry({ ok: false, message: "예전 실패" }),
      ]),
    ).toBe(true);
  });

  it("이력에 이번 실행뿐이어도 알린다", () => {
    expect(shouldNotifyFailure([entry({ ok: false, message: "터짐" })])).toBe(
      true,
    );
  });

  it("성공은 알리지 않는다", () => {
    expect(shouldNotifyFailure([entry({ ok: true })])).toBe(false);
  });

  it("skipped는 알림 대상도, 직전 판정 대상도 아니다", () => {
    // 자동 실행 OFF로 스킵된 호출이 사이에 끼어도 '직전 실패' 판정이 흐려지면 안 된다.
    expect(
      shouldNotifyFailure([
        entry({ ok: false, message: "또 터짐" }),
        entry({ skipped: true, ok: true }),
        entry({ ok: false, message: "터짐" }),
      ]),
    ).toBe(false);
    expect(shouldNotifyFailure([entry({ skipped: true, ok: false })])).toBe(
      false,
    );
  });

  it("기록이 비어 있으면 알리지 않는다", () => {
    expect(shouldNotifyFailure([])).toBe(false);
  });
});

describe("renderFailureHtml", () => {
  it("잡 이름과 실패 사유, 시각을 싣는다", () => {
    const html = renderFailureHtml(
      "서비스 마감 스크래핑",
      entry({ ok: false, message: "RuntimeError: 엑셀 다운로드 타임아웃" }),
    );
    expect(html).toContain("서비스 마감 스크래핑");
    expect(html).toContain("RuntimeError: 엑셀 다운로드 타임아웃");
    expect(html).toContain("09:08");
  });

  it("HTML을 이스케이프한다 — 실패 메시지는 외부 문자열이다", () => {
    const html = renderFailureHtml(
      "잡",
      entry({ ok: false, message: "<script>alert(1)</script>" }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
