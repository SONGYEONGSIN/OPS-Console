import { describe, it, expect } from "vitest";
import DashboardLayout from "../layout";

/**
 * layout.tsx는 async server component(redirect / Supabase auth 의존).
 * RSC 동작 검증은 e2e/dashboard.spec.ts가 담당하며, 여기서는 export 시그니처만 보호한다.
 */
describe("DashboardLayout — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof DashboardLayout).toBe("function");
    expect(DashboardLayout.constructor.name).toBe("AsyncFunction");
  });
});
