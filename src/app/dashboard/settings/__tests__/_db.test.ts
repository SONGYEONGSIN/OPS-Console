import { describe, it, expect } from "vitest";

// _db.ts는 server-only + admin client 의존. 단위 테스트는 export 시그너처만 cover.
describe("_db — export 시그너처", () => {
  it("getDbSnapshot은 async 함수", async () => {
    const mod = await import("../_db");
    expect(mod.getDbSnapshot.constructor.name).toBe("AsyncFunction");
  });
});
