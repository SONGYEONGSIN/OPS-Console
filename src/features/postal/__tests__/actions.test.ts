import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: null as Record<string, unknown> | null,
  uploaded: [] as { bucket: string; path: string }[],
  uploadError: null as string | null,
  inserted: [] as Record<string, unknown>[],
  removed: [] as string[],
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: (path: string) => {
          if (state.uploadError) {
            return Promise.resolve({ error: { message: state.uploadError } });
          }
          state.uploaded.push({ bucket, path });
          return Promise.resolve({ error: null });
        },
        remove: (paths: string[]) => {
          state.removed.push(...paths);
          return Promise.resolve({ error: null });
        },
      }),
    },
    from: () => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        insert: (row: Record<string, unknown>) => {
          state.inserted.push(row);
          return chain;
        },
        select: () => chain,
        single: () => Promise.resolve({ data: { id: "r1" }, error: null }),
      });
      return chain;
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { uploadReceipt } = await import("../actions");

const file = (name = "a.jpg", type = "image/jpeg", size = 1000) =>
  ({
    name,
    type,
    size,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(size)),
  }) as unknown as File;

/**
 * 영수증 업로드.
 *
 * 영수증에는 수취인 실명과 카드 결제 정보가 찍혀 있다. 버킷이 비공개라 서명 URL로만
 * 열리지만, **누가 올릴 수 있는지**는 여기서 막아야 한다.
 */
describe("uploadReceipt", () => {
  beforeEach(() => {
    state.me = { email: "a@b.com", displayName: "박수정", permission: "member" };
    state.uploaded = [];
    state.uploadError = null;
    state.inserted = [];
    state.removed = [];
  });

  it("비로그인은 거부한다", async () => {
    state.me = null;
    const r = await uploadReceipt(file());
    expect(r.ok).toBe(false);
    expect(state.uploaded).toHaveLength(0);
  });

  it("읽기 전용 권한은 거부한다", async () => {
    state.me = { email: "a@b.com", displayName: "김뷰어", permission: "viewer" };
    const r = await uploadReceipt(file());
    expect(r.ok).toBe(false);
    expect(state.uploaded).toHaveLength(0);
  });

  it("사진이 아니면 저장하지 않는다", async () => {
    const r = await uploadReceipt(file("x.pdf", "application/pdf"));
    expect(r.ok).toBe(false);
    expect(state.uploaded).toHaveLength(0);
  });

  it("비공개 버킷에 넣고 올린 사람을 남긴다 — 그게 엑셀의 '확인' 칸이다", async () => {
    const r = await uploadReceipt(file());
    expect(r.ok).toBe(true);
    expect(state.uploaded[0].bucket).toBe("postal-receipts");
    expect(state.inserted[0].uploaded_by).toBe("박수정");
    expect(state.inserted[0].storage_path).toBe(state.uploaded[0].path);
  });

  it("결제 정보 칸을 만들지 않는다 — 칸이 없어야 실수로도 안 들어간다", async () => {
    await uploadReceipt(file());
    const keys = Object.keys(state.inserted[0]).join(" ");
    expect(keys).not.toMatch(/card|approval|승인|가맹/i);
  });

  it("저장이 실패하면 행을 만들지 않는다 — 파일 없는 카드가 남으면 안 된다", async () => {
    state.uploadError = "quota exceeded";
    const r = await uploadReceipt(file());
    expect(r.ok).toBe(false);
    expect(state.inserted).toHaveLength(0);
  });
});
