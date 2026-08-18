import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Source } from "@/features/assistant/search";

/**
 * 어시스턴트 검색 도구 — 요청자 검증이 이 라우트의 존재 이유다.
 *
 * 7개 테이블의 RLS가 `for select to authenticated using (true)`라 행은 안 걸러진다
 * (2026-08-18 확인). 그래서 "누가 물었나"를 여기서 확인하지 않으면 탈퇴자 이메일로
 * 큐에 넣어도 그냥 답한다. 설계: docs/superpowers/specs/2026-08-18-assistant-tools-design.md
 */

const state = {
  operator: null as Record<string, unknown> | null,
  sources: [] as Source[],
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: state.operator, error: null }),
    };
    return { from: () => chain };
  },
}));

vi.mock("@/features/assistant/search", async (orig) => ({
  ...(await orig<typeof import("@/features/assistant/search")>()),
  searchDomainsWith: () => Promise.resolve(state.sources),
}));

const { GET } = await import("../route");

const req = (qs: string, auth = "Bearer s3cret") =>
  new Request(`http://x/api/assistant/tools/search${qs}`, {
    headers: { authorization: auth },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

const src = (domain: Source["domain"]): Source => ({
  domain,
  id: `${domain}-1`,
  title: `${domain} 제목`,
  snippet: "본문",
  deepLink: `/dashboard/${domain}`,
});

describe("어시스턴트 검색 도구", () => {
  beforeEach(() => {
    state.operator = {
      email: "a@x.com",
      permission: "member",
      status: "active",
    };
    state.sources = [];
    process.env.CRON_SECRET = "s3cret";
  });

  it("CRON_SECRET이 틀리면 401", async () => {
    const res = await GET(req("?q=부산대&as=a@x.com", "Bearer nope"));
    expect(res.status).toBe(401);
  });

  it("q가 없으면 400", async () => {
    const res = await GET(req("?as=a@x.com"));
    expect(res.status).toBe(400);
  });

  it("as가 없으면 400 — 누가 묻는지 모르면 답하지 않는다", async () => {
    const res = await GET(req("?q=부산대"));
    expect(res.status).toBe(400);
  });

  it("등록되지 않은 이메일이면 403", async () => {
    state.operator = null;
    const res = await GET(req("?q=부산대&as=ghost@x.com"));
    expect(res.status).toBe(403);
  });

  it("비활성 운영자면 403 — 탈퇴자가 계속 묻지 못하게", async () => {
    state.operator = {
      email: "a@x.com",
      permission: "member",
      status: "deleted",
    };
    const res = await GET(req("?q=부산대&as=a@x.com"));
    expect(res.status).toBe(403);
  });

  it("viewer면 403 — 어시스턴트 자체 정책과 같은 선", async () => {
    state.operator = {
      email: "v@x.com",
      permission: "viewer",
      status: "active",
    };
    const res = await GET(req("?q=부산대&as=v@x.com"));
    expect(res.status).toBe(403);
  });

  it("정상 요청은 검색 결과를 돌려준다", async () => {
    state.sources = [src("handover"), src("incident")];
    const res = await GET(req("?q=부산대&as=a@x.com"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.sources.map((s: Source) => s.domain)).toEqual([
      "handover",
      "incident",
    ]);
  });

  it("볼 수 없는 도메인은 결과에서 뺀다", async () => {
    // 지금은 admin 전용 도메인이 없어 member가 전부 본다(domain-menu.test.ts 참조).
    // 여기서는 필터가 실제로 적용되는지를 본다 — 매핑에 없는 도메인은 통과 못 한다.
    state.sources = [
      src("handover"),
      { ...src("incident"), domain: "unknown" as Source["domain"] },
    ];
    const res = await GET(req("?q=부산대&as=a@x.com"));
    const body = await res.json();
    expect(body.sources.map((s: Source) => s.domain)).toEqual(["handover"]);
  });
});
