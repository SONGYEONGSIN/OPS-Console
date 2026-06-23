import { describe, it, expect, vi, beforeEach } from "vitest";

const { upsertMock, deleteInMock, contextReadRows } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  deleteInMock: vi.fn().mockResolvedValue({ error: null }),
  contextReadRows: { value: [] as Array<Record<string, unknown>> },
}));

// 동일 맥락 두 건(제목/링크 다름) + 다른 맥락 한 건
const RSS = `<?xml version="1.0"?><rss><channel>
  <item><title>광양보건대 학교법인 파산 선고 폐교 수순</title><link>https://n/1</link><pubDate>Mon, 22 Jun 2026 09:00:00 +0900</pubDate><description>d</description></item>
  <item><title>광양보건대 끝내 폐교 법원 파산선고</title><link>https://n/2</link><pubDate>Sun, 21 Jun 2026 09:00:00 +0900</pubDate><description>d</description></item>
  <item><title>조승래 의원 사립대학구조개선법 개정안 대표발의</title><link>https://n/3</link><pubDate>Fri, 19 Jun 2026 09:00:00 +0900</pubDate><description>d</description></item>
</channel></rss>`;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      // 2) 본문 upsert → .select("title")
      upsert: (rows: unknown, opts: unknown) => {
        upsertMock(rows, opts);
        return {
          select: () =>
            Promise.resolve({
              data: (rows as Array<{ title: string }>).map((r) => ({
                title: r.title,
              })),
              error: null,
            }),
        };
      },
      // 60일 cleanup: delete().lt().select() / 맥락 cleanup: delete().in()
      delete: () => ({
        lt: () => ({
          select: () => Promise.resolve({ data: [], error: null }),
        }),
        in: (_col: string, ids: string[]) => deleteInMock(ids),
      }),
      // 맥락 cleanup 대상 read: select().gte()
      select: () => ({
        gte: () =>
          Promise.resolve({ data: contextReadRows.value, error: null }),
      }),
    }),
  }),
}));

import { runNewsCollect } from "../news-collect";

beforeEach(() => {
  upsertMock.mockReset();
  deleteInMock.mockClear();
  deleteInMock.mockResolvedValue({ error: null });
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    text: async () => RSS,
  } as Response);
});

describe("runNewsCollect — 동일 맥락 dedup + cleanup 배선", () => {
  it("배치 적재 시 동일 맥락은 최신 1건으로 접어서 upsert한다", async () => {
    contextReadRows.value = [];
    await runNewsCollect();

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const rows = upsertMock.mock.calls[0][0] as Array<{
      title: string;
      published_at: string | null;
    }>;
    const gy = rows.filter((r) => r.title.includes("광양보건대"));
    expect(gy).toHaveLength(1); // 광양 2건 → 1건
    expect(gy[0].title).toContain("파산 선고"); // 최신(06-22) 유지
    expect(rows.some((r) => r.title.includes("조승래"))).toBe(true);
  });

  it("주기 정리: 윈도우 내 동일 맥락 과거 기사 id를 삭제한다", async () => {
    // DB에 같은 맥락 2건(최신 a / 과거 b) + 다른 맥락 c 존재한다고 가정
    contextReadRows.value = [
      {
        id: "a",
        title: "광양보건대 폐교 수순",
        published_at: "2026-06-22T00:00:00Z",
      },
      {
        id: "b",
        title: "광양보건대 파산 선고 폐교",
        published_at: "2026-06-21T00:00:00Z",
      },
      {
        id: "c",
        title: "조승래 사립대학구조개선법 개정안",
        published_at: "2026-06-19T00:00:00Z",
      },
    ];
    await runNewsCollect();

    expect(deleteInMock).toHaveBeenCalledTimes(1);
    expect(deleteInMock.mock.calls[0][0]).toEqual(["b"]);
  });
});
