import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; filters: [string, unknown][] }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from: (table: string) => {
        const entry = { table, filters: [] as [string, unknown][] };
        calls.push(entry);
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: (c: string, v: unknown) => {
            entry.filters.push([c, v]);
            return chain;
          },
          neq: () => chain,
          is: () => chain,
          not: () => chain,
          in: () => chain,
          gte: (c: string, v: unknown) => {
            entry.filters.push([c, v]);
            return chain;
          },
          lt: (c: string, v: unknown) => {
            entry.filters.push([c, v]);
            return chain;
          },
          or: () => chain,
          then: (r: (v: unknown) => unknown) =>
            Promise.resolve({ count: 1, error: null }).then(r),
        };
        return chain;
      },
    }),
}));

const { getMenuCounts } = await import("../queries");

/**
 * 사이드바 숫자는 그 메뉴를 눌렀을 때 나오는 건수여야 한다.
 *
 * 서비스마감을 '마감된 것'으로, 배포·운영을 '진행중'으로 가른 뒤(#1076)에도
 * 사이드바는 `closing_services` 전체(867)를 세고 있었다 — 눌러보면 572 라
 * 숫자가 거짓말을 했다.
 */
describe("서비스 목록 메뉴 카운트", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("서비스마감은 마감된 것만 센다", async () => {
    await getMenuCounts("me@x.com");
    const closing = calls.filter((c) => c.table === "closing_services");
    const closed = closing.find((c) =>
      c.filters.some(([col]) => col === "pay_end_at"),
    );
    expect(closed, "closing_services 를 pay_end_at 으로 걸러야 한다").toBeDefined();
  });

  it("배포·운영도 센다 — 메뉴가 생겼으면 숫자도 있어야 한다", async () => {
    const counts = await getMenuCounts("me@x.com");
    // Map 을 돌려준다.
    expect([...counts.keys()]).toContain("deploy");
    expect([...counts.keys()]).toContain("settlement");
  });

  it("두 숫자는 다른 필터에서 온다 — 같으면 하나가 틀린 것이다", async () => {
    await getMenuCounts("me@x.com");
    const closing = calls.filter((c) => c.table === "closing_services");
    expect(closing.length).toBeGreaterThanOrEqual(2);
  });
});
