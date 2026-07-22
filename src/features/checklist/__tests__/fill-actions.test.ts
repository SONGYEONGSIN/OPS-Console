import { describe, it, expect, vi } from "vitest";

// 목킹 admin 클라이언트 — 테스트가 sbState로 응답/호출추적을 제어한다.
let sbState: ReturnType<typeof makeSb>;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => sbState.client,
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { fillUpdateItem, fillDeleteItem } from "../fill-actions";

type TokenRow = {
  round_id: string;
  department: string | null;
  kind: string;
  enabled: boolean;
};
type ItemRow = { round_id: string; department: string };

function makeSb(cfg: { token: TokenRow | null; item?: ItemRow | null }) {
  const calls = { updated: false, deleted: false };
  const client = {
    from(table: string) {
      let op = "select";
      const builder: Record<string, unknown> = {
        select: () => builder,
        update: () => {
          op = "update";
          calls.updated = true;
          return builder;
        },
        delete: () => {
          op = "delete";
          calls.deleted = true;
          return builder;
        },
        eq: () => builder,
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === "checklist_share_tokens"
                ? cfg.token
                : (cfg.item ?? null),
          }),
        then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
      };
      void op;
      return builder;
    },
  };
  return { client, calls };
}

const validFill: TokenRow = {
  round_id: "R1",
  department: "개발부",
  kind: "dept-fill",
  enabled: true,
};

describe("fillUpdateItem — 토큰 스코프 강제", () => {
  it("(d) report 토큰이면 거부 + update 미호출", async () => {
    sbState = makeSb({ token: { ...validFill, kind: "report" } });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });

  it("(c) 비활성 토큰이면 거부 + update 미호출", async () => {
    sbState = makeSb({ token: { ...validFill, enabled: false } });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });

  it("(b) 타 부서 항목이면 거부 + update 미호출", async () => {
    sbState = makeSb({
      token: validFill,
      item: { round_id: "R1", department: "운영부" },
    });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });

  it("(a) 자기 부서·회차 항목이면 update 호출 + ok", async () => {
    sbState = makeSb({
      token: validFill,
      item: { round_id: "R1", department: "개발부" },
    });
    const r = await fillUpdateItem("t", "i1", { status: "done" });
    expect(r.ok).toBe(true);
    expect(sbState.calls.updated).toBe(true);
  });

  it("잘못된 patch(잘못된 상태)면 거부", async () => {
    sbState = makeSb({ token: validFill, item: { round_id: "R1", department: "개발부" } });
    const r = await fillUpdateItem("t", "i1", { status: "왼료" });
    expect(r.ok).toBe(false);
    expect(sbState.calls.updated).toBe(false);
  });
});

describe("fillDeleteItem — 토큰 스코프 강제", () => {
  it("타 부서 항목이면 거부 + delete 미호출", async () => {
    sbState = makeSb({
      token: validFill,
      item: { round_id: "R1", department: "영업부" },
    });
    const r = await fillDeleteItem("t", "i1");
    expect(r.ok).toBe(false);
    expect(sbState.calls.deleted).toBe(false);
  });

  it("자기 부서 항목이면 delete 호출 + ok", async () => {
    sbState = makeSb({
      token: validFill,
      item: { round_id: "R1", department: "개발부" },
    });
    const r = await fillDeleteItem("t", "i1");
    expect(r.ok).toBe(true);
    expect(sbState.calls.deleted).toBe(true);
  });
});
