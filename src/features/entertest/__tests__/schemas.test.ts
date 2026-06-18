import { describe, it, expect } from "vitest";
import {
  entertestCheckSchema,
  entertestIngestSchema,
  entertestRunSchema,
} from "../schemas";

describe("entertest schemas", () => {
  it("entertestCheckSchema — 유효 체크 파싱", () => {
    const parsed = entertestCheckSchema.parse({
      key: "login",
      label: "로그인",
      status: "pass",
      message: null,
    });
    expect(parsed.status).toBe("pass");
    expect(parsed.screenshot_url).toBeUndefined();
  });

  it("entertestCheckSchema — 잘못된 status 거부", () => {
    const r = entertestCheckSchema.safeParse({
      key: "x",
      label: "x",
      status: "weird",
      message: null,
    });
    expect(r.success).toBe(false);
  });

  it("entertestIngestSchema — done + checks 파싱", () => {
    const parsed = entertestIngestSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      status: "done",
      checks: [
        { key: "login", label: "로그인", status: "pass", message: null },
      ],
    });
    expect(parsed.checks).toHaveLength(1);
  });

  it("entertestIngestSchema — 잘못된 uuid 거부", () => {
    const r = entertestIngestSchema.safeParse({
      id: "not-uuid",
      status: "done",
      checks: [],
    });
    expect(r.success).toBe(false);
  });

  it("entertestRunSchema — nullable 필드 허용", () => {
    const parsed = entertestRunSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440001",
      requested_by: "a@b.com",
      requested_at: "2026-06-18T00:00:00Z",
      target_url: "https://entertest.jinhakapply.com/Notice/1098146/A",
      test_account: null,
      status: "pending",
      claimed_at: null,
      finished_at: null,
      result: null,
      error_message: null,
    });
    expect(parsed.status).toBe("pending");
  });
});
