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

const serviceA = {
  id: "11111111-1111-4111-8111-111111111111",
  service_id: 5072006,
  service_name: "Graduate School of Police Studies",
  university_name: "경찰대학 대학원",
};

const serviceB = {
  id: "22222222-2222-4222-8222-222222222222",
  service_id: 1165060,
  service_name: "2025학년도 2학기 외국인전형",
  university_name: "한양대학교(ERICA)",
};

/**
 * supabase 응답은 중첩 join shape — backup_request_services 배열 안에 services 본체.
 * PR-4: top-level contacts 컬럼 제거. backup_request_services 원소에 note_md/contacts 추가.
 */
const validRow = {
  id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  requester_email: "bob@example.com",
  requester_team: "ops",
  substitute_email: "alice@example.com",
  substitute_name: "Alice",
  summary_md: "내용",
  leave_start_date: "2026-05-20",
  leave_end_date: "2026-05-25",
  mail_status: "pending",
  mail_sent_at: null,
  mail_error: null,
  created_at: "2026-05-13T00:00:00Z",
  updated_at: "2026-05-13T00:00:00Z",
  backup_request_services: [
    {
      service_id: serviceA.id,
      substitute_email: null,
      substitute_name: null,
      note_md: null,
      contacts: [],
      services: serviceA,
    },
    {
      service_id: serviceB.id,
      substitute_email: null,
      substitute_name: null,
      note_md: null,
      contacts: [],
      services: serviceB,
    },
  ],
};

describe("listBackupRequests", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 반환 + services_detail 평탄화", async () => {
    mockResult.mockReturnValue({ data: [validRow], error: null });
    const rows = await listBackupRequests();
    expect(rows.length).toBe(1);
    expect(rows[0].requester_email).toBe("bob@example.com");
    expect(rows[0].services_detail).toHaveLength(2);
    expect(rows[0].services_detail[0]?.service_name).toBe(
      "Graduate School of Police Studies",
    );
  });

  it("services join 없는 row → services_detail 빈 배열", async () => {
    const { backup_request_services: _drop, ...withoutJoin } = validRow;
    void _drop;
    mockResult.mockReturnValue({ data: [withoutJoin], error: null });
    const rows = await listBackupRequests();
    expect(rows.length).toBe(1);
    expect(rows[0].services_detail).toEqual([]);
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

  it("PR-4: services join row의 contacts/note_md 평탄화 시 보존", async () => {
    const richRow = {
      ...validRow,
      backup_request_services: [
        {
          service_id: serviceA.id,
          substitute_email: null,
          substitute_name: null,
          note_md: "5/20 마감 임박",
          contacts: ["경찰대 — 강민호", "고려대 — 홍길동"],
          services: serviceA,
        },
      ],
    };
    mockResult.mockReturnValue({ data: [richRow], error: null });
    const rows = await listBackupRequests();
    expect(rows[0]?.services_detail[0]?.note_md).toBe("5/20 마감 임박");
    expect(rows[0]?.services_detail[0]?.contacts).toEqual([
      "경찰대 — 강민호",
      "고려대 — 홍길동",
    ]);
  });
});

describe("getBackupRequestById", () => {
  beforeEach(() => {
    mockResult.mockReset();
  });

  it("정상 row 1건 반환 + services_detail 평탄화", async () => {
    mockResult.mockReturnValue({ data: validRow, error: null });
    const row = await getBackupRequestById(validRow.id);
    expect(row?.id).toBe(validRow.id);
    expect(row?.services_detail).toHaveLength(2);
  });

  it("not found → null", async () => {
    mockResult.mockReturnValue({ data: null, error: null });
    const row = await getBackupRequestById(
      "00000000-0000-0000-0000-000000000000",
    );
    expect(row).toBeNull();
  });
});
