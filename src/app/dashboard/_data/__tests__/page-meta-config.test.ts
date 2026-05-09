import { describe, it, expect } from "vitest";
import { PAGE_META } from "../page-meta-config";

describe("PAGE_META", () => {
  it("services 메타가 mockup 명세와 일치", () => {
    const services = PAGE_META.services;
    expect(services).toBeDefined();
    expect(services.headline.accent).toBe("실시간");
    expect(services.headline.title).toBe("서비스 운영");
    expect(services.meta).toEqual([
      { label: "근무 II", tone: "accent" },
      { label: "서비스", value: "12개" },
      { label: "자동 새로고침", value: "10초" },
    ]);
    expect(services.description).toContain("현재 운영 중인 서비스");
  });

  it("alerts/my-todo/schedule/handover 헤드라인 정의", () => {
    expect(PAGE_META.alerts.headline.title).toBe("주의해야 할 알림");
    expect(PAGE_META["my-todo"].headline.accent).toBe("오늘");
    expect(PAGE_META.schedule.headline.title).toBe("전체 일정");
    expect(PAGE_META.handover.headline.accent).toBe("교대");
  });

  it("미정의 slug는 undefined (fallback은 호출부에서 처리)", () => {
    expect(PAGE_META["unknown-slug-xyz"]).toBeUndefined();
  });
});
