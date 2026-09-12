import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, mockUpsert, mockSelect, mockIn, mockChangesInsert } =
  vi.hoisted(() => ({
    mockCreateAdminClient: vi.fn(),
    mockUpsert: vi.fn(),
    mockSelect: vi.fn(),
    mockIn: vi.fn(),
    mockChangesInsert: vi.fn(),
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

/** validRow 와 **같은 상태**인 DB 행 — 시각만 DB 표기(+00:00)다. */
const existingSame = {
  service_id: 1234567,
  university_name: "○○대학교",
  region: "서울",
  service_name: "2026 수시 원서접수",
  university_type: "4년제",
  category: "수시",
  admission_type: null,
  operator_name: "박운영",
  developer_name: "김개발",
  write_start_at: "2026-02-28T15:01:00+00:00",
  write_end_at: "2026-09-15T09:00:00+00:00",
  pay_start_at: null,
  pay_end_at: null,
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

function payload(rows: unknown[]) {
  return { scraped_at: "2026-06-07T10:00:00+09:00", rows };
}

/** upsert 호출 중 신규 insert 경로(ignoreDuplicates)만 고른다. */
function insertCalls() {
  return mockUpsert.mock.calls.filter((c) => c[1]?.ignoreDuplicates === true);
}

/** upsert 호출 중 기존 행 갱신 경로만 고른다. */
function updateCalls() {
  return mockUpsert.mock.calls.filter((c) => c[1]?.ignoreDuplicates !== true);
}

describe("/api/closing/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    // 기존 행 조회 — 기본은 "아무것도 없다"(전부 신규).
    mockIn.mockResolvedValue({ data: [], error: null });
    mockSelect.mockReturnValue({ in: mockIn });
    // upsert(...).select() — 보낸 행을 그대로 반영했다고 응답.
    mockUpsert.mockImplementation((rows: { service_id: number }[]) => ({
      select: vi.fn().mockResolvedValue({
        data: rows.map((r) => ({ service_id: r.service_id })),
        error: null,
      }),
    }));
    mockChangesInsert.mockResolvedValue({ error: null });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) =>
        table === "closing_service_changes"
          ? { insert: mockChangesInsert }
          : { select: mockSelect, upsert: mockUpsert },
      ),
    });
  });

  it("시크릿 불일치 → 401 + admin client 미생성", async () => {
    const res = await POST(req({ secret: "wrong", body: payload([validRow]) }));
    expect(res.status).toBe(401);
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("CRON_SECRET 미설정 → 500", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    expect(res.status).toBe(500);
  });

  it("빈 배열 rows → 400 + 적재 안 함", async () => {
    const res = await POST(req({ secret: "s3cr3t", body: payload([]) }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("잘못된 row(write_end_at 누락) → 400", async () => {
    const { write_end_at: _o, ...badRow } = validRow;
    void _o;
    const res = await POST(req({ secret: "s3cr3t", body: payload([badRow]) }));
    expect(res.status).toBe(400);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("신규 건 → upsert(ignoreDuplicates) + ok:true inserted:실제건수", async () => {
    const res = await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.received).toBe(1);
    expect(body.inserted).toBe(1);
    expect(body.updated).toBe(0);
    expect(body.changes).toBe(0);

    expect(insertCalls()).toHaveLength(1);
    const [rowsArg, optsArg] = insertCalls()[0];
    expect(optsArg).toEqual({ onConflict: "service_id", ignoreDuplicates: true });
    expect(rowsArg[0].scraped_at).toBe("2026-06-07T10:00:00+09:00");
    expect(rowsArg[0].service_id).toBe(1234567);
    expect(mockChangesInsert).not.toHaveBeenCalled();
  });

  it("기존 행 조회는 배치의 service_id 로만 한다", async () => {
    await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    expect(mockIn).toHaveBeenCalledWith("service_id", [1234567]);
  });

  it("기존 행과 값이 같으면 갱신하지 않는다 (updated_at 흔들기 금지)", async () => {
    mockIn.mockResolvedValue({ data: [existingSame], error: null });
    const res = await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    const body = await res.json();
    expect(body.received).toBe(1);
    expect(body.inserted).toBe(0);
    expect(body.updated).toBe(0);
    expect(body.changes).toBe(0);
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mockChangesInsert).not.toHaveBeenCalled();
  });

  it("스크래퍼 +09:00 과 DB +00:00 이 같은 순간이면 변경으로 치지 않는다", async () => {
    // existingSame 의 시각은 validRow 와 같은 순간이되 표기만 UTC.
    mockIn.mockResolvedValue({ data: [existingSame], error: null });
    await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    expect(updateCalls()).toHaveLength(0);
    expect(mockChangesInsert).not.toHaveBeenCalled();
  });

  it("기존 행의 값이 바뀌었으면 갱신하고 이력을 남긴다", async () => {
    mockIn.mockResolvedValue({
      data: [{ ...existingSame, solo: false }],
      error: null,
    });
    const res = await POST(
      req({ secret: "s3cr3t", body: payload([{ ...validRow, solo: true }]) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(1);
    expect(body.inserted).toBe(0);
    expect(body.updated).toBe(1);
    expect(body.changes).toBe(1);

    // 갱신 — 신규 경로가 아니라 갱신 경로로 한 번.
    expect(insertCalls()).toHaveLength(0);
    expect(updateCalls()).toHaveLength(1);
    const [updRows] = updateCalls()[0];
    expect(updRows).toHaveLength(1);
    expect(updRows[0].service_id).toBe(1234567);
    expect(updRows[0].solo).toBe(true);

    // 이력 — 바뀐 필드만, scraped_at 포함.
    expect(mockChangesInsert).toHaveBeenCalledTimes(1);
    expect(mockChangesInsert.mock.calls[0][0]).toEqual([
      {
        service_id: 1234567,
        field: "solo",
        prev_value: "false",
        next_value: "true",
        scraped_at: "2026-06-07T10:00:00+09:00",
      },
    ]);
  });

  it("신규 + 변경이 섞이면 둘 다 처리한다", async () => {
    mockIn.mockResolvedValue({ data: [existingSame], error: null });
    const res = await POST(
      req({
        secret: "s3cr3t",
        body: payload([
          { ...validRow, operator_name: "이운영" },
          { ...validRow, service_id: 7654321 },
        ]),
      }),
    );
    const body = await res.json();
    expect(body.received).toBe(2);
    expect(body.inserted).toBe(1);
    expect(body.updated).toBe(1);
    expect(body.changes).toBe(1);
    expect(insertCalls()[0][0].map((r: { service_id: number }) => r.service_id)).toEqual([
      7654321,
    ]);
  });

  it("기존 행 조회 실패 → 500 + 아무것도 쓰지 않는다", async () => {
    mockIn.mockResolvedValue({ data: null, error: { message: "select fail" } });
    const res = await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    expect(res.status).toBe(500);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("insert 실패 → 500", async () => {
    mockUpsert.mockImplementation(() => ({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: "db fail" } }),
    }));
    const res = await POST(req({ secret: "s3cr3t", body: payload([validRow]) }));
    expect(res.status).toBe(500);
  });

  it("이력 적재 실패 → 500 (조용히 삼키지 않는다)", async () => {
    mockIn.mockResolvedValue({ data: [existingSame], error: null });
    mockChangesInsert.mockResolvedValue({ error: { message: "changes fail" } });
    const res = await POST(
      req({ secret: "s3cr3t", body: payload([{ ...validRow, solo: true }]) }),
    );
    expect(res.status).toBe(500);
  });
});
