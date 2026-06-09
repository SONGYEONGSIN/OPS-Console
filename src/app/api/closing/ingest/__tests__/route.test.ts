import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, mockUpsert, mockSelect } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockUpsert: vi.fn(),
  mockSelect: vi.fn(),
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
    // upsert(onConflict service_id, ignoreDuplicates).select() 체인 mock — 신규만 누적.
    mockSelect.mockResolvedValue({
      data: [{ service_id: 1234567 }],
      error: null,
    });
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    });
  });

  it("시크릿 불일치 → 401 + admin client 미생성", async () => {
    const res = await POST(
      req({ secret: "wrong", body: { scraped_at: "x", rows: [validRow] } }),
    );
    expect(res.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("CRON_SECRET 미설정 → 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(
      req({ secret: "s3cr3t", body: { scraped_at: "x", rows: [validRow] } }),
    );
    expect(res.status).toBe(500);
  });

  it("빈 배열 rows → 400 + 적재 안 함", async () => {
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [] },
      }),
    );
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("정상 payload → upsert(신규만 누적, ignoreDuplicates) + ok:true inserted:실제건수", async () => {
    // 기존에 없던 신규 1건만 insert되어 돌아온 상황
    mockSelect.mockResolvedValue({
      data: [{ service_id: 1234567 }],
      error: null,
    });
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [validRow] },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.received).toBe(1);
    expect(body.inserted).toBe(1); // select가 돌려준 실제 신규 건수
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    // upsert: service_id 충돌 무시(신규만), scraped_at 주입 확인
    const [rowsArg, optsArg] = mockUpsert.mock.calls[0];
    expect(optsArg).toEqual({
      onConflict: "service_id",
      ignoreDuplicates: true,
    });
    expect(rowsArg[0].scraped_at).toBe("2026-06-07T10:00:00+09:00");
    expect(rowsArg[0].service_id).toBe(1234567);
  });

  it("전부 기존 데이터(중복)면 inserted:0", async () => {
    mockSelect.mockResolvedValue({ data: [], error: null }); // 신규 0건
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [validRow] },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(1);
    expect(body.inserted).toBe(0);
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
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("upsert 실패 → 500", async () => {
    mockSelect.mockResolvedValue({ data: null, error: { message: "db fail" } });
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: { scraped_at: "2026-06-07T10:00:00+09:00", rows: [validRow] },
      }),
    );
    expect(res.status).toBe(500);
  });
});
