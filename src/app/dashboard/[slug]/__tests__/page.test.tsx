import { describe, it, expect } from "vitest";
import DynamicDashboardPage from "../page";

/**
 * [slug]/page.tsx는 server component (requireMenu 가드 + DB 의존).
 * RSC 동작은 e2e/dashboard-menu-permission.spec.ts 가 담당.
 * 여기서는 export 시그니처만 보호.
 */
describe("DynamicDashboardPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof DynamicDashboardPage).toBe("function");
    expect(DynamicDashboardPage.constructor.name).toBe("AsyncFunction");
  });
});
