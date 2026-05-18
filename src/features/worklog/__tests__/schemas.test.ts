import { describe, it, expect } from "vitest";
import {
  worklogRowSchema,
  worklogInsertSchema,
  WORKLOG_LEVELS,
} from "../schemas";

describe("worklog schemas", () => {
  it("level enum 4종", () => {
    expect(WORKLOG_LEVELS).toEqual(["INFO", "WARN", "ERROR", "DEBUG"]);
  });

  it("insert — domain/action/msg 필수", () => {
    const ok = worklogInsertSchema.safeParse({
      domain: "handover",
      action: "create",
      msg: "인계 생성",
    });
    expect(ok.success).toBe(true);
  });

  it("insert — domain 빈 문자열 reject", () => {
    const r = worklogInsertSchema.safeParse({
      domain: "",
      action: "create",
      msg: "x",
    });
    expect(r.success).toBe(false);
  });

  it("row — level 기본 INFO + created_at 필수", () => {
    const ok = worklogRowSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-05-17T00:00:00Z",
      level: "INFO",
      user_email: "x@y.com",
      user_name: "User",
      domain: "handover",
      action: "create",
      target_type: "handover_progress",
      target_id: "abc",
      target_name: "한예종",
      msg: "인계 생성",
      metadata: { foo: "bar" },
    });
    expect(ok.success).toBe(true);
  });
});
