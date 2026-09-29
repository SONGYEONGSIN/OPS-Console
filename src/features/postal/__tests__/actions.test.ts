import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  me: null as Record<string, unknown> | null,
  uploaded: [] as { bucket: string; path: string; body: unknown }[],
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
        upload: (path: string, body: unknown) => {
          if (state.uploadError) {
            return Promise.resolve({ error: { message: state.uploadError } });
          }
          state.uploaded.push({ bucket, path, body });
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

const { extractSpy } = vi.hoisted(() => ({ extractSpy: vi.fn() }));
vi.mock("../extract-actions", () => ({
  requestExtraction: (id: string) => {
    extractSpy(id);
    return Promise.resolve({ ok: true });
  },
}));

const { uprightSpy } = vi.hoisted(() => ({
  uprightSpy: vi.fn((b: Buffer) => Promise.resolve(b)),
}));
vi.mock("../upright-photo", () => ({ uprightPhoto: (b: Buffer) => uprightSpy(b) }));

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

/**
 * 판독 모델은 회전 정보를 무시하고 저장된 픽셀을 본다 — 저장 전에 세워야 판독·검토
 * 화면·PDF 가 같은 사진을 본다(upright-photo.ts).
 */
describe("uploadReceipt — 사진 세우기", () => {
  beforeEach(() => {
    state.me = { email: "a@b.com", displayName: "박수정", permission: "member" };
    state.uploaded = [];
    state.uploadError = null;
    state.inserted = [];
    state.removed = [];
    uprightSpy.mockClear();
  });

  it("세운 사진을 저장한다 — 올린 파일 그대로가 아니다", async () => {
    const upright = Buffer.from("upright");
    uprightSpy.mockResolvedValueOnce(upright);
    const r = await uploadReceipt(file());
    expect(r.ok).toBe(true);
    expect(uprightSpy).toHaveBeenCalledTimes(1);
    expect(uprightSpy.mock.calls[0][0].length).toBe(1000);
    expect(state.uploaded[0].body).toBe(upright);
  });

  it("세우다 실패하면 저장하지 않는다 — 깨진 사진은 판독·화면·출력 어디서도 못 쓴다", async () => {
    uprightSpy.mockRejectedValueOnce(new Error("corrupt"));
    const r = await uploadReceipt(file());
    expect(r).toEqual({ ok: false, error: "사진을 읽지 못했습니다 — 다시 찍어 올려 주세요" });
    expect(state.uploaded).toHaveLength(0);
    expect(state.inserted).toHaveLength(0);
  });
});

/**
 * 올리자마자 판독이 시작돼야 한다 — [추출]을 따로 누르게 하면 목록이 '판독 전'
 * 으로만 차고, 사람이 버튼을 누르러 다시 들어와야 한다.
 */
describe("uploadReceipt — 자동 판독", () => {
  beforeEach(() => {
    state.me = { email: "me@x.com", permission: "member" };
    state.uploaded = [];
    state.inserted = [];
    state.removed = [];
    state.uploadError = null;
    extractSpy.mockClear();
  });

  it("업로드가 끝나면 그 영수증의 판독을 요청한다", async () => {
    const r = await uploadReceipt(file());
    expect(r.ok).toBe(true);
    expect(extractSpy).toHaveBeenCalledWith("r1");
  });

  it("업로드가 실패하면 판독을 요청하지 않는다", async () => {
    state.uploadError = "저장 실패";
    await uploadReceipt(file());
    expect(extractSpy).not.toHaveBeenCalled();
  });

  it("올릴 수 없는 파일이면 판독도 없다", async () => {
    await uploadReceipt(file("x.pdf", "application/pdf"));
    expect(extractSpy).not.toHaveBeenCalled();
  });
});
