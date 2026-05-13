import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateClient, mockResult } = vi.hoisted(() => {
  const mockResult = vi.fn();
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.neq = () => builder;
  builder.maybeSingle = () => Promise.resolve(mockResult());
  builder.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(mockResult()).then(onFulfilled);
  const mockCreateClient = vi.fn(async () => ({
    from: () => builder,
  }));
  return { mockCreateClient, mockResult };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mockCreateClient,
}));

import { listBackupRequests, getBackupRequestById } from "../queries";

const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  requester_email: "bob@example.com",
  requester_team: "ops",
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  services: ["s1"],
  contacts: [],
  summary_md: "내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  mail_status: "pending",
  mail_sent_at: null,
  mail_error: null,
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
};

describe("listBackupRequests", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listBackupRequests();
    expect(rows.length).toBe(1);
    expect(rows[0].requester_email).toBe("bob@example.com");
  });

  it("supabase error → 빈 배열", async () => {
    mockResult.mockReturnValue({ data: null, error: { message: "boom" } });
    const rows = await listBackupRequests();
    expect(rows).toEqual([]);
  });

  it("zod fail row는 skip", async () => {
    mockResult.mockReturnValue({
      data: [validRow, { ...validRow, mail_status: "unknown" }],
      error: null,
    });
    const rows = await listBackupRequests();
    expect(rows.length).toBe(1);
  });
});

describe("getBackupRequestById", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 1건 반환", async () => {
    mockResult.mockReturnValue({ data: validRow, error: null });
    const row = await getBackupRequestById(validRow.id);
    expect(row?.id).toBe(validRow.id);
  });

  it("not found → null", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const row = await getBackupRequestById(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(row).toBeNull();
  });
});
