import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, mockDelete, mockInsert } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockDelete: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { POST } from "../route";

const validRow = {
  service_id: 1234567,
  university_name: "○○대학교",
  region: "서울",
  service_name: "2026 수시 원서접수",
  university_type: "4년제",
  category: "수시",
  operator_name: "박운영",
  developer_name: "김개발",
  write_start_at: "2026-03-01T00:01:00+09:00",
  write_end_at: "2026-09-15T18:00:00+09:00",
  solo: false,
};

function req(opts: { secret?: string; body?: unknown } = {}) {
  return new Request("http://localhost/api/closing/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

describe("/api/closing/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    // delete-all → insert 체인 mock. delete()는 빈 필터 없이 전체 삭제(neq 트릭).
    mockDelete.mockReturnValue({
      neq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockInsert.mockResolvedValue({ error: null });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({
        delete: mockDelete,
        insert: mockInsert,
      }),
    });
  });

  it("시크릿 불일치 → 401 + admin client 미생성", async () => {
    const res = await POST(req({ secret: "wrong", body: { scraped_at: "x", rows: [validRow] } }));
    expect(res.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("CRON_SECRET 미설정 → 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req({ secret: "s3cr3t", body: { scraped_at: "x", rows: [validRow] } }));
    expect(res.status).toBe(500);
  });

  it("빈 배열 rows → 400 + 적재 안 함 (전체 삭제 사고 방지)", async () => {
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [] },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("정상 payload → delete-all 후 insert + ok:true inserted:N", async () => {
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [validRow] },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(1);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    // insert에 scraped_at이 각 row에 주입되었는지
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg[0].scraped_at).toBe("2026-06-07T10:00:00+09:00");
    expect(insertArg[0].service_id).toBe(1234567);
  });

  it("잘못된 row(write_end_at 누락) → 400", async () => {
    const { write_end_at: _o, ...badRow } = validRow;
    void _o;
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [badRow] },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("insert 실패 → 500", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db fail" } });
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [validRow] },
      }),
    );
    expect(res.status).toBe(500);
  });
});
