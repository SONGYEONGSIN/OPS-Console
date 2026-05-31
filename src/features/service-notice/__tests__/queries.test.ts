import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchNextMonthServices } from "../queries";

function mockServices(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "gte", "lt", "not", "order", "limit"]) {
    builder[m] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) =>
    resolve({ data: rows, error: null });
  const from = vi.fn(() => builder);
  (createAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    from,
  });
  return { from, builder };
}

beforeEach(() => vi.clearAllMocks());

describe("fetchNextMonthServices", () => {
  it("services 행을 ServiceNoticeService로 매핑", async () => {
    const { from } = mockServices([
      {
        id: "u1",
        university_name: "가천대",
        service_name: "수시모집",
        university_type: "4년제",
        category: "공통원서",
        operator_email: "kim@x.com",
        operator_name: "김운영",
        write_start_at: "2026-05-31T15:00:00Z",
        write_end_at: "2026-06-09T15:00:00Z",
        pay_start_at: null,
        pay_end_at: null,
      },
    ]);
    const out = await fetchNextMonthServices({
      startISO: "2026-05-31T15:00:00.000Z",
      endISO: "2026-06-30T15:00:00.000Z",
      monthKey: "2026-06",
    });
    expect(from).toHaveBeenCalledWith("services");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "u1",
      universityName: "가천대",
      serviceName: "수시모집",
      operatorEmail: "kim@x.com",
      operatorName: "김운영",
      writeStartAt: "2026-05-31T15:00:00Z",
    });
  });

  it("data null이면 빈 배열", async () => {
    mockServices([]);
    const out = await fetchNextMonthServices({
      startISO: "a",
      endISO: "b",
      monthKey: "2026-06",
    });
    expect(out).toEqual([]);
  });
});
