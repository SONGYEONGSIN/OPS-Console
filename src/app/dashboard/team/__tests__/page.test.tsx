import { describe, it, expect } from "vitest";
import TeamPage from "../page";

/**
 * team/page.tsx는 async server component (DB 룩업 + Supabase auth 의존).
 * RSC 동작 검증은 e2e/team-permission.spec.ts가 담당하며, 여기서는 export 시그니처만 보호한다.
 */
describe("TeamPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof TeamPage).toBe("function");
    expect(TeamPage.constructor.name).toBe("AsyncFunction");
  });
});
