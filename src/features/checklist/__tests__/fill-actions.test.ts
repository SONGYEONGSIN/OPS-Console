import { describe, it, expect, vi } from "vitest";

// 목킹 admin 클라이언트 — 테스트가 sbState로 응답/호출추적을 제어한다.
let sbState: ReturnType<typeof makeSb>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => sbState.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { fillUpdateItem, fillDeleteItem, fillAddItem } from "../fill-actions";

type TokenRow = { round_id: string; kind: string; enabled: boolean };
type ItemRow = { round_id: string };

function makeSb(cfg: { token: TokenRow | null; item?: ItemRow | null }) {
  const calls = { updated: false, deleted: false, inserted: false };
  const client = {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        insert: () => {
          calls.inserted = true;
          return builder;
        },
        update: () => {
          calls.updated = true;
          return builder;
        },
        delete: () => {
          calls.deleted = true;
          return builder;
        },
        eq: () => builder,
        single: () => Promise.resolve({ data: { id: "new" }, error: null }),
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === "checklist_share_tokens"
                ? cfg.token
                : (cfg.item ?? null),
          }),
        then: (resolve: (v: { error: null }) => void) =>
          resolve({ error: null }),
      };
      return builder;
    },
  };
  return { client, calls };
}

const validFill: TokenRow = { round_id: "R1", kind: "fill", enabled: true };

describe("fillUpdateItem — 토큰/회차 스코프 강제", () => {
  it("report 토큰이면 거부 + update 미호출", async () => {
    sbState = makeSb({ token: { ...validFill, kind: "report" } });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });

  it("비활성 토큰이면 거부 + update 미호출", async () => {
    sbState = makeSb({ token: { ...validFill, enabled: false } });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });

  it("타 회차 항목이면 거부 + update 미호출", async () => {
    sbState = makeSb({ token: validFill, item: { round_id: "R2" } });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });

  it("같은 회차 항목이면 update 호출 + ok (부서 무관)", async () => {
    sbState = makeSb({ token: validFill, item: { round_id: "R1" } });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(true);
    expect(sbState.calls.updated).toBe(true);
  });

  it("잘못된 patch면 거부", async () => {
    sbState = makeSb({ token: validFill, item: { round_id: "R1" } });
    const r = await fillUpdateItem("t", "i1", { status: "왼료" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });
});

describe("fillAddItem — 유효 토큰 + 부서 지정", () => {
  it("fill 토큰이면 insert 호출 + ok", async () => {
    sbState = makeSb({ token: validFill });
    const r = await fillAddItem("t", "개발부", "서버/시스템", "새 점검 항목");
    expect(r.ok).toBe(true);
    expect(sbState.calls.inserted).toBe(true);
  });
  it("report 토큰이면 거부 + insert 미호출", async () => {
    sbState = makeSb({ token: { ...validFill, kind: "report" } });
    const r = await fillAddItem("t", "개발부", "서버/시스템", "x");
    expect(r.ok).toBe(false);
    expect(sbState.calls.inserted).toBe(false);
  });
  it("잘못된 부서면 거부", async () => {
    sbState = makeSb({ token: validFill });
    const r = await fillAddItem("t", "없는부서", "cat", "x");
    expect(r.ok).toBe(false);
    expect(sbState.calls.inserted).toBe(false);
  });
});

describe("fillDeleteItem — 회차 스코프 강제", () => {
  it("타 회차 항목이면 거부 + delete 미호출", async () => {
    sbState = makeSb({ token: validFill, item: { round_id: "R2" } });
    const r = await fillDeleteItem("t", "i1");
    expect(r.ok).toBe(false);
    expect(sbState.calls.deleted).toBe(false);
  });
  it("같은 회차 항목이면 delete 호출 + ok", async () => {
    sbState = makeSb({ token: validFill, item: { round_id: "R1" } });
    const r = await fillDeleteItem("t", "i1");
    expect(r.ok).toBe(true);
    expect(sbState.calls.deleted).toBe(true);
  });
});
