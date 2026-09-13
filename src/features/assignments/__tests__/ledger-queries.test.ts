import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  range: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: h.from }),
}));

import { listLedgerRows } from "../ledger-queries";
import { reconcile } from "../import";

/**
 * 원장 읽기는 **대조의 한쪽 입력**이다. 시트 쪽은 `toLedgerRows` 가 만들고,
 * 이쪽은 DB 가 만든다. 두 배열이 같은 모양이어야 `reconcile` 이 그대로 먹는다.
 *
 * 정책이 `using (true)` 라 로그인한 사람 누구나 읽는다(admin 전용이 아니다).
 * 그래서 세션 클라이언트다 — admin 클라이언트는 쓰기에만 쓴다.
 */
function dbRow(overrides: Record<string, unknown> = {}) {
  return {
    academic_year: 2027,
    university_name: "서울대학교",
    work_kind: "원서접수",
    subtype: "수시",
    role: "운영",
    assignee_name: "나운영",
    university_type: "4년제",
    ...overrides,
  };
}

describe("listLedgerRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.from.mockReturnValue({ select: h.select });
    h.select.mockReturnValue({ eq: h.eq });
    h.eq.mockReturnValue({ range: h.range });
    h.range.mockResolvedValue({ data: [], error: null });
  });

  it("학년도로 거른다 — 다른 해의 배정은 대조에 끼면 안 된다", async () => {
    await listLedgerRows(2027);
    expect(h.from).toHaveBeenCalledWith("assignments");
    expect(h.eq).toHaveBeenCalledWith("academic_year", 2027);
  });

  it("reconcile 이 그대로 먹는 모양으로 돌려준다", async () => {
    h.range.mockResolvedValueOnce({ data: [dbRow()], error: null });

    const rows = await listLedgerRows(2027);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      academic_year: 2027,
      university_name: "서울대학교",
      work_kind: "원서접수",
      subtype: "수시",
      role: "운영",
      assignee_name: "나운영",
      university_type: "4년제",
    });
    // 두 모듈이 실제로 맞물리는지까지 본다 — 모양만 같고 안 맞물리면 소용없다.
    expect(reconcile(rows, rows).mismatchCount).toBe(0);
  });

  it("이력 비교에 쓸 assignee_email 도 함께 준다", async () => {
    // 이력의 단위는 이메일이다(마이그레이션 주석). 이름만 비교하면 운영자 메일이
    // 바뀐 경우를 '안 바뀜' 으로 읽어 이력에 구멍이 난다.
    h.range.mockResolvedValueOnce({
      data: [dbRow({ assignee_email: "a@x.com" })],
      error: null,
    });

    const rows = await listLedgerRows(2027);

    expect(rows[0].assignee_email).toBe("a@x.com");
    // 목이 반환값을 지어내므로 **select 에 컬럼이 들어갔는지까지** 본다 —
    // 이 단언이 없으면 컬럼을 안 넣고도 초록이다.
    expect(h.select.mock.calls[0][0]).toContain("assignee_email");
  });

  it("university_type 이 비면 undefined 다 — null 은 시트 쪽 모양에 없다", async () => {
    h.range.mockResolvedValueOnce({
      data: [dbRow({ university_type: null })],
      error: null,
    });
    const rows = await listLedgerRows(2027);
    expect(rows[0].university_type).toBeUndefined();
  });

  it("1000건 cap 을 넘겨도 전부 가져온다", async () => {
    // PostgREST Max-Rows 1000. 한 번만 조회하면 뒤쪽 배정이 조용히 사라지고,
    // 대조가 그걸 '원장에 없음' 으로 세어 **멀쩡한 이관을 실패로 보고한다**.
    const first = Array.from({ length: 1000 }, (_, i) =>
      dbRow({ university_name: `대학${i + 1}` }),
    );
    h.range
      .mockResolvedValueOnce({ data: first, error: null })
      .mockResolvedValueOnce({
        data: [dbRow({ university_name: "대학1001" })],
        error: null,
      });

    const rows = await listLedgerRows(2027);

    expect(rows).toHaveLength(1001);
    expect(h.range).toHaveBeenCalledTimes(2);
    expect(h.range.mock.calls[0]).toEqual([0, 999]);
    expect(h.range.mock.calls[1]).toEqual([1000, 1999]);
  });

  it("마지막 페이지가 짧으면 더 조회하지 않는다", async () => {
    h.range.mockResolvedValueOnce({ data: [dbRow()], error: null });
    await listLedgerRows(2027);
    expect(h.range).toHaveBeenCalledTimes(1);
  });

  it("조회 실패는 던진다 — 빈 배열이면 '원장에 없음' 으로 둔갑한다", async () => {
    // supabase-js 는 던지지 않는다. 여기서 삼키면 대조가 시트 전량을 미적재로
    // 세고, 사람은 멀쩡히 들어간 이관을 다시 돌린다.
    h.range.mockResolvedValueOnce({
      data: null,
      error: { message: "boom" },
    });
    await expect(listLedgerRows(2027)).rejects.toThrow(/boom/);
  });

  it("빈 원장은 빈 배열이다 — 아직 이관 전인 것은 에러가 아니다", async () => {
    const rows = await listLedgerRows(2027);
    expect(rows).toEqual([]);
  });
});
