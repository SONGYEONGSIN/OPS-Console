import { describe, it, expect } from "vitest";
import { PAGE_META } from "../page-meta-config";

describe("PAGE_META", () => {
  it("services 헤드라인이 사이드바 그룹·메뉴와 일치 + description 보존", () => {
    const services = PAGE_META.services;
    expect(services).toBeDefined();
    // 사이드바: 그룹 '서비스사이클' > 메뉴 '서비스'. 다른 메뉴 derive 형식과 동일
    expect(services.headline.accent).toBe("서비스사이클");
    expect(services.headline.title).toBe("서비스");
    // meta는 미정의 — page.tsx의 dynamicCount로 derivePatternMeta가 채움
    expect(services.meta).toBeUndefined();
    expect(services.description).toContain("현재 운영 중인 서비스");
  });

  it("alerts/my-todo/schedule/handover 헤드라인 정의", () => {
    expect(PAGE_META.alerts.headline.title).toBe("주의해야 할 알림");
    expect(PAGE_META["my-todo"].headline.accent).toBe("내 계획");
    expect(PAGE_META.schedule.headline.title).toBe("운영부 달력");
    expect(PAGE_META.handover.headline.accent).toBe("요청 · 자료");
  });

  it("미정의 slug는 undefined (fallback은 호출부에서 처리)", () => {
    expect(PAGE_META["unknown-slug-xyz"]).toBeUndefined();
  });
});
