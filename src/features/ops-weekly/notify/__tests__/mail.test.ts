import { describe, expect, it } from "vitest";
import {
  allSubmittedMail,
  remindMail,
  reportedMail,
  requestMail,
  requestTeamsHtml,
  returnedMail,
  opsWeeklyLink,
} from "../mail";

const W = { weekStart: "2026-11-16", label: "2026년 11월 3주차", rangeLabel: "11/16~11/20" };
const BASE = "https://ops.example.com";

describe("주간업무보고 알림 문구", () => {
  it("링크 — 주 고정, 전체 보고·제출 현황은 쿼리로", () => {
    expect(opsWeeklyLink(BASE, W.weekStart)).toBe(
      "https://ops.example.com/dashboard/ops-weekly?week=2026-11-16",
    );
    expect(opsWeeklyLink(BASE, W.weekStart, "all")).toBe(
      "https://ops.example.com/dashboard/ops-weekly?week=2026-11-16&op=all",
    );
    expect(opsWeeklyLink(BASE, W.weekStart, "status")).toBe(
      "https://ops.example.com/dashboard/ops-weekly?week=2026-11-16&tab=status",
    );
  });

  it("작성 요청 — 브랜드 머리, 주차·기간, 마감 안내, 링크", () => {
    const m = requestMail(W, BASE);
    expect(m.subject).toBe("[운영부 상황실] 2026년 11월 3주차 주간업무보고 작성 요청");
    expect(m.html).toContain("11/16~11/20");
    expect(m.html).toContain("목요일 17:00");
    expect(m.html).toContain('href="https://ops.example.com/dashboard/ops-weekly?week=2026-11-16"');
  });

  it("미제출 알림 — 아직 제출하지 않았다고", () => {
    const m = remindMail(W, BASE);
    expect(m.subject).toBe("[운영부 상황실] 2026년 11월 3주차 주간업무보고 — 아직 제출하지 않았습니다");
    expect(m.html).toContain("제출완료");
  });

  it("전원 제출 — 당번에게 제출 현황 링크", () => {
    const m = allSubmittedMail(W, BASE);
    expect(m.subject).toContain("전원 제출");
    expect(m.html).toContain("tab=status");
  });

  it("다시 작성 요청 — 사유가 있으면 싣고 HTML 은 이스케이프", () => {
    const m = returnedMail(W, BASE, { reason: "<b>표</b> 다시", by: "김당번" });
    expect(m.subject).toContain("다시 작성 요청");
    expect(m.html).toContain("&lt;b&gt;표&lt;/b&gt; 다시");
    expect(m.html).toContain("김당번");
    expect(returnedMail(W, BASE, { reason: null, by: "김당번" }).html).not.toContain("사유");
  });

  it("최종 보고 — 받는 사람에게 전체 보고 링크", () => {
    const m = reportedMail(W, BASE, { by: "김당번" });
    expect(m.subject).toBe("[운영부 상황실] 2026년 11월 3주차 운영부 주간업무보고");
    expect(m.html).toContain("op=all");
  });

  it("Teams 그룹채팅 — 한 문단 + 링크", () => {
    const html = requestTeamsHtml(W, BASE);
    expect(html).toContain("2026년 11월 3주차");
    expect(html).toContain('<a href="https://ops.example.com/dashboard/ops-weekly?week=2026-11-16"');
  });
});
