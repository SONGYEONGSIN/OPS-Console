import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: { table: string; filters: string[] }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      from: (table: string) => {
        const entry = { table, filters: [] as string[] };
        calls.push(entry);
        const note = (op: string) => (c: string) => {
          entry.filters.push(`${op}:${c}`);
          return chain;
        };
        const chain: Record<string, unknown> = {
          select: () => chain,
          eq: note("eq"),
          neq: () => chain,
          is: () => chain,
          not: (c: string, op: string, v: unknown) => {
            entry.filters.push(`not:${c} ${op} ${String(v)}`);
            return chain;
          },
          in: () => chain,
          gte: note("gte"),
          gt: note("gt"),
          lte: note("lte"),
          lt: note("lt"),
          or: (f: string) => {
            entry.filters.push(`or:${f.split(".")[0]}`);
            return chain;
          },
          then: (r: (v: unknown) => unknown) =>
            Promise.resolve({ count: 1, error: null }).then(r),
        };
        return chain;
      },
    }),
}));

const { getMenuCounts } = await import("../queries");

const closingCalls = () => calls.filter((c) => c.table === "closing_services");

/**
 * 사이드바 숫자는 그 메뉴를 눌렀을 때 나오는 건수여야 한다.
 *
 * 메뉴가 생애주기로 넷으로 갈렸으므로(개발테스트=시작 전 / 배포운영=접수 중 /
 * 서비스마감·정산=마감) 여기서도 같은 규칙(`closing/phase.ts`)을 써야 한다.
 * 규칙이 두 벌이 되면 화면과 숫자가 갈린다 — 실제로 867 이 뜨는데 눌러보면
 * 572 였다.
 */
describe("서비스 생애주기 메뉴 카운트", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("네 메뉴 모두 숫자가 있다", async () => {
    const counts = await getMenuCounts("me@x.com");
    for (const slug of ["dev-test", "deploy", "closing", "settlement"]) {
      expect([...counts.keys()], slug).toContain(slug);
    }
  });

  it("모두 closing_services 를 단계로 걸러 센다", async () => {
    await getMenuCounts("me@x.com");
    const filtered = closingCalls().filter((c) => c.filters.length > 0);
    expect(filtered.length).toBe(4);
  });

  it("시작 전은 write_start_at 을 본다 — 결제마감만 보면 접수 중과 안 갈린다", async () => {
    await getMenuCounts("me@x.com");
    const upcoming = closingCalls().find((c) =>
      c.filters.includes("gt:write_start_at"),
    );
    expect(upcoming).toBeDefined();
  });

  it("마감은 결제마감이 지난 것만", async () => {
    await getMenuCounts("me@x.com");
    const closed = closingCalls().filter((c) =>
      c.filters.includes("lt:pay_end_at"),
    );
    // 서비스마감 + 전형료정산 둘 다 마감 범위다.
    expect(closed.length).toBe(2);
  });
});

/**
 * 실데이터가 있는 메뉴는 숫자를 붙인다. **목업 자리표시자에는 안 붙인다** —
 * 가짜 숫자가 진짜처럼 보이면 없는 기능을 있는 줄 안다(자료실을 걷어낸 이유).
 */
describe("실데이터 메뉴 카운트", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("우편물·지식망·리포트·체크리스트·성과에 숫자가 있다", async () => {
    const counts = await getMenuCounts("me@x.com");
    for (const slug of [
      "postal",
      "knowledge",
      "reports",
      "checklist",
      "outcomes",
    ]) {
      expect([...counts.keys()], slug).toContain(slug);
    }
  });

  it("각자 자기 표를 센다", async () => {
    await getMenuCounts("me@x.com");
    const tables = calls.map((c) => c.table);
    for (const t of [
      "postal_receipts",
      "knowledge_docs",
      "reports",
      "checklist_rounds",
      "performance_assignments",
    ]) {
      expect(tables, t).toContain(t);
    }
  });

  it("대학배정은 안 센다 — 엑셀을 읽어야 해서 매 화면이 느려진다", async () => {
    const counts = await getMenuCounts("me@x.com");
    expect([...counts.keys()]).not.toContain("assignments");
  });
});

/**
 * `제안/`은 사람이 아직 안 본 초안 칸이다. 열람 목록에서 뺐으면 사이드바 숫자도
 * 같이 빠져야 한다 — 눌러서 나오는 건수와 숫자가 어긋나면 숫자를 못 믿는다.
 */
describe("지식망 건수", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("검토 대기 초안은 안 센다 — 목록에 없는 걸 세면 숫자가 어긋난다", async () => {
    await getMenuCounts("me@x.com");
    const knowledge = calls.filter((c) => c.table === "knowledge_docs");
    expect(knowledge).toHaveLength(1);
    expect(knowledge[0].filters).toContain("not:path like 제안/%");
  });
});
