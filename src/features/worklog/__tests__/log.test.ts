import { describe, it, expect } from "vitest";
import { worklogInsertSchema } from "../schemas";

// logActivity는 server-only + admin client 의존. unit 단위는 입력 검증으로 cover.
describe("logActivity — payload validation", () => {
  it("정상 입력 schema 통과", () => {
    const r = worklogInsertSchema.safeParse({
      domain: "handover",
      action: "create",
      msg: "test",
      target_id: "abc",
      metadata: { foo: 1 },
    });
    expect(r.success).toBe(true);
  });

  it("level 미지정 시 INFO default (insert 시점에 채워짐)", () => {
    const r = worklogInsertSchema.parse({
      domain: "x",
      action: "y",
      msg: "z",
    });
    expect(r.level).toBeUndefined();
  });
});
