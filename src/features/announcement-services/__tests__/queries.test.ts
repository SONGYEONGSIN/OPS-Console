import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  range: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: h.from }),
}));

import { listAnnouncementServiceCandidates } from "../queries";

function row(id: number) {
  return {
    service_id: id,
    university_name: `대학${id}`,
    service_name: "합격자발표",
  };
}

describe("listAnnouncementServiceCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.from.mockReturnValue({ select: h.select });
    h.select.mockReturnValue({ range: h.range });
  });

  it("1000건 cap을 넘겨도 전부 가져온다", async () => {
    // PostgREST Max-Rows 1000 — 한 번만 조회하면 뒤쪽 후보가 조용히 사라진다.
    const first = Array.from({ length: 1000 }, (_, i) => row(i + 1));
    h.range
      .mockResolvedValueOnce({ data: first, error: null })
      .mockResolvedValueOnce({ data: [row(1001)], error: null });

    const out = await listAnnouncementServiceCandidates();

    expect(out).toHaveLength(1001);
    expect(h.range).toHaveBeenCalledTimes(2);
    expect(out[0]).toEqual({
      service_id: 1,
      university_name: "대학1",
      service_name: "합격자발표",
    });
  });

  it("조회 실패는 삼키지 않는다", async () => {
    h.range.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(listAnnouncementServiceCandidates()).rejects.toThrow(/boom/);
  });

  it("비어 있으면 빈 배열", async () => {
    h.range.mockResolvedValue({ data: [], error: null });
    expect(await listAnnouncementServiceCandidates()).toEqual([]);
  });
});
