import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 영수증 지우기 — 사진 파일까지 지운다. 누운 사진을 세운 뒤 재판독이 확인하기 전이면 옛
 * 사진이 재판독 행의 `rotated_from` 에만 남아 있다. 영수증 행을 지우면 판독 행도 연쇄로
 * 지워져 그 경로를 잃는다 — 수취인·카드 정보가 찍힌 사진이 아무도 모르게 남는다.
 */
const state = {
  rotations: [] as { rotated_from: string }[],
  removed: [] as string[],
  log: [] as string[],
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () =>
    Promise.resolve({ permission: "admin", displayName: "운영자" }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        remove: (paths: string[]) => {
          state.log.push("remove");
          state.removed.push(...paths);
          return Promise.resolve({ error: null });
        },
      }),
    },
    from: (table: string) => {
      if (table === "postal_extract_requests") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          not: () => {
            state.log.push("read rotations");
            return Promise.resolve({ data: state.rotations, error: null });
          },
        };
        return chain;
      }
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: {
              id: "r1",
              storage_path: "2026-09-23/new.jpg",
              uploaded_by: "운영자",
              confirmed_at: null,
            },
          }),
        delete: () => {
          state.log.push("delete row");
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return chain;
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("../extract-actions", () => ({ requestExtraction: vi.fn() }));
vi.mock("../upright-photo", () => ({ uprightPhoto: vi.fn() }));

const { deleteReceipt } = await import("../actions");

describe("deleteReceipt — 세운 뒤 확인 전 옛 사진", () => {
  beforeEach(() => {
    state.rotations = [];
    state.removed = [];
    state.log = [];
  });

  it("확인을 기다리는 옛 사진도 함께 지운다 — 행을 지우기 전에 경로를 읽는다", async () => {
    state.rotations = [{ rotated_from: "2026-09-23/old.jpg" }];
    expect(await deleteReceipt("r1")).toEqual({ ok: true, id: "r1" });
    expect(state.removed).toEqual(["2026-09-23/new.jpg", "2026-09-23/old.jpg"]);
    expect(state.log).toEqual(["read rotations", "delete row", "remove"]);
  });

  it("세운 적이 없으면 지금 사진만 지운다", async () => {
    expect(await deleteReceipt("r1")).toEqual({ ok: true, id: "r1" });
    expect(state.removed).toEqual(["2026-09-23/new.jpg"]);
  });
});
