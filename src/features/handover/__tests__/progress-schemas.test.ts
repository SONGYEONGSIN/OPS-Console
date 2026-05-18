import { describe, it, expect } from "vitest";
import {
  handoverProgressRowSchema,
  handoverProgressCreateSchema,
  PROGRESS_STATUS_VALUES,
} from "../progress-schemas";

describe("handover progress schemas", () => {
  it("status enum 3종", () => {
    expect(PROGRESS_STATUS_VALUES).toEqual([
      "in_progress",
      "completed",
      "cancelled",
    ]);
  });

  it("row schema 통과", () => {
    const r = handoverProgressRowSchema.parse({
      id: "11111111-1111-4111-8111-111111111111",
      service_id: "22222222-2222-4222-8222-222222222222",
      from_email: "from@x.com",
      from_name: "From",
      to_email: "to@x.com",
      to_name: "To",
      status: "in_progress",
      notes: null,
      confirmed_at: null,
      created_at: "2026-05-17T00:00:00Z",
      updated_at: "2026-05-17T00:00:00Z",
    });
    expect(r.status).toBe("in_progress");
  });

  it("create — service_id + to_email/name 필수", () => {
    const r = handoverProgressCreateSchema.safeParse({
      service_id: "22222222-2222-4222-8222-222222222222",
      to_email: "to@x.com",
      to_name: "To",
    });
    expect(r.success).toBe(true);
  });

  it("create — invalid email reject", () => {
    const r = handoverProgressCreateSchema.safeParse({
      service_id: "22222222-2222-4222-8222-222222222222",
      to_email: "not-email",
      to_name: "To",
    });
    expect(r.success).toBe(false);
  });

  it("create — notes 2000 초과 reject", () => {
    const r = handoverProgressCreateSchema.safeParse({
      service_id: "22222222-2222-4222-8222-222222222222",
      to_email: "to@x.com",
      to_name: "To",
      notes: "x".repeat(2001),
    });
    expect(r.success).toBe(false);
  });
});
