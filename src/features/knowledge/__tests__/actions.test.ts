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
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
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
      _id: "" as string,
    };
    return { from: () => chain };
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const { deleteProposalDoc } = await import("../actions");

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
