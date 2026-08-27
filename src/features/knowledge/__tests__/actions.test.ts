import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 제안 초안 삭제 — 권한과 경로 두 겹으로 막는다.
 *
 * 화면은 읽기 전용이 원칙이라 여기만 예외로 연다. 본 위치 문서가 이 경로로
 * 지워지면 사람이 쓴 지식이 클릭 한 번에 사라진다.
 */

const state = {
  me: null as Record<string, unknown> | null,
  row: null as Record<string, unknown> | null,
  deleted: [] as string[],
  graphStatus: 204,
  /** Graph PATCH(이동) 응답 상태. 409 면 같은 이름이 이미 있는 것이다. */
  moveStatus: 200,
  moved: null as { itemId: string; body: unknown } | null,
  updated: null as Record<string, unknown> | null,
  ensuredCategory: null as string | null,
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
}));

vi.mock("@/lib/microsoft/drive-upload", () => ({
  ensureFolder: (_d: string, _p: string, name: string) => {
    state.ensuredCategory = name;
    return Promise.resolve(`FOLDER_${name}`);
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    const chain = {
      select: () => chain,
      eq: (_c: string, v: string) => {
        chain._id = v;
        return chain;
      },
      maybeSingle: () => Promise.resolve({ data: state.row, error: null }),
      delete: () => {
        state.deleted.push(String(chain._id ?? ""));
        return chain;
      },
      update: (v: Record<string, unknown>) => {
        state.updated = v;
        return chain;
      },
      _id: "" as string,
    };
    return { from: () => chain };
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { deleteProposalDoc, promoteProposalDoc } = await import("../actions");

describe("deleteProposalDoc", () => {
  beforeEach(() => {
    state.me = { email: "a@x.com", permission: "member" };
    state.row = { path: "제안/x.md", graph_item_id: "item-1" };
    state.deleted = [];
    state.graphStatus = 204;
    process.env.SHAREPOINT_DRIVE_ID = "drive-1";
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: state.graphStatus < 300, status: state.graphStatus, text: () => Promise.resolve("") }),
    ) as unknown as typeof fetch;
  });

  it("비로그인은 거부한다", async () => {
    state.me = null;
    const r = await deleteProposalDoc("제안/x.md");
    expect(r.ok).toBe(false);
  });

  it("viewer는 거부한다 — 읽기 전용 권한이다", async () => {
    state.me = { email: "v@x.com", permission: "viewer" };
    const r = await deleteProposalDoc("제안/x.md");
    expect(r.ok).toBe(false);
  });

  it("본 위치 문서는 거부한다", async () => {
    const r = await deleteProposalDoc("엔티티/부산대.md");
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/제안/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("인덱스에 없는 경로는 거부한다 — 임의 경로로 Graph를 때리지 않는다", async () => {
    state.row = null;
    const r = await deleteProposalDoc("제안/없는문서.md");
    expect(r.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("정상 삭제는 Graph DELETE 후 인덱스에서도 지운다", async () => {
    const r = await deleteProposalDoc("제안/x.md");
    expect(r.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://graph.microsoft.com/v1.0/drives/drive-1/items/item-1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(state.deleted).toContain("제안/x.md");
  });

  it("Graph가 실패하면 인덱스를 지우지 않는다 — 파일이 남았는데 목록에서만 사라지면 안 된다", async () => {
    state.graphStatus = 500;
    const r = await deleteProposalDoc("제안/x.md");
    expect(r.ok).toBe(false);
    expect(state.deleted).toEqual([]);
  });
});

/**
 * 검토를 마친 초안을 본 위치로 옮긴다.
 *
 * 채팅(`promote_doc`)으로만 되던 걸 화면에도 연다. 검토하러 온 사람이 읽고 바로
 * 결정하는 자리가 여기라서다. 다만 **`제안/` 에서 나가는 방향만** 열어, 본 위치
 * 문서가 버튼 한 번으로 움직이지 않게 한다.
 */
describe("promoteProposalDoc", () => {
  beforeEach(() => {
    state.me = { email: "a@x.com", permission: "member" };
    state.row = {
      path: "제안/취업규칙 요점.md",
      graph_item_id: "item-9",
      category: "규칙",
    };
    state.updated = null;
    state.moved = null;
    state.ensuredCategory = null;
    state.moveStatus = 200;
    process.env.SHAREPOINT_DRIVE_ID = "drive-1";
    process.env.SHAREPOINT_KNOWLEDGE_FOLDER_ID = "vault-1";
    global.fetch = vi.fn((url: string, init: RequestInit) => {
      state.moved = { itemId: String(url).split("/items/")[1], body: init.body };
      return Promise.resolve({
        ok: state.moveStatus < 300,
        status: state.moveStatus,
        text: () => Promise.resolve(""),
      });
    }) as unknown as typeof fetch;
  });

  it("초안이 선언한 분류 폴더로 옮긴다", async () => {
    const r = await promoteProposalDoc("제안/취업규칙 요점.md");
    expect(r).toEqual({ ok: true, toPath: "규칙/취업규칙 요점.md" });
    expect(state.ensuredCategory).toBe("규칙");
    expect(state.moved?.itemId).toBe("item-9");
    expect(String(state.moved?.body)).toContain("FOLDER_규칙");
  });

  it("인덱스도 새 자리로 고친다 — 목록과 파일이 갈리면 안 된다", async () => {
    await promoteProposalDoc("제안/취업규칙 요점.md");
    expect(state.updated).toEqual({
      path: "규칙/취업규칙 요점.md",
      category: "규칙",
    });
  });

  it("본 위치 문서는 못 옮긴다 — 나가는 방향만 연다", async () => {
    state.row = { path: "규칙/이미.md", graph_item_id: "i", category: "개념" };
    const r = await promoteProposalDoc("규칙/이미.md");
    expect(r.ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("비로그인은 거부한다", async () => {
    state.me = null;
    expect((await promoteProposalDoc("제안/x.md")).ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("읽기 전용 권한은 거부한다", async () => {
    state.me = { email: "v@x.com", permission: "viewer" };
    expect((await promoteProposalDoc("제안/x.md")).ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("인덱스에 없는 경로는 거부한다 — 임의 경로로 Graph 를 때리지 않는다", async () => {
    state.row = null;
    expect((await promoteProposalDoc("제안/없는것.md")).ok).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("같은 이름이 이미 있으면 덮지 않고 알린다", async () => {
    state.moveStatus = 409;
    const r = await promoteProposalDoc("제안/취업규칙 요점.md");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("이미");
    // 파일은 그대로인데 인덱스만 바뀌면 목록과 볼트가 갈린다.
    expect(state.updated).toBeNull();
  });

  it("이동이 실패하면 인덱스를 안 고친다", async () => {
    state.moveStatus = 500;
    expect((await promoteProposalDoc("제안/취업규칙 요점.md")).ok).toBe(false);
    expect(state.updated).toBeNull();
  });
});
