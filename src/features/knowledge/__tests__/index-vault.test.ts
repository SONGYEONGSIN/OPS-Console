import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken: vi.fn(async () => "tok") }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const { getGraphToken } = await import("@/lib/microsoft/auth");
const { createAdminClient } = await import("@/lib/supabase/admin");
const { indexVault } = await import("../index-vault");

/** Graph 응답 mock — 폴더 목록 → 파일 목록 → 본문 순으로 돌려준다. */
function stubGraph(
  tree: Record<string, { name: string; id: string; modified: string }[]>,
  bodies: Record<string, string>,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/content")) {
        const id = /items\/([^/]+)\/content/.exec(u)?.[1] ?? "";
        return new Response(bodies[id] ?? "", { status: 200 });
      }
      // 루트 children = 폴더 목록
      if (u.includes("VAULT/children")) {
        return new Response(
          JSON.stringify({
            value: Object.keys(tree).map((name) => ({
              name,
              id: `dir-${name}`,
              folder: { childCount: tree[name].length },
            })),
          }),
          { status: 200 },
        );
      }
      const dir = /items\/dir-([^/]+)\/children/.exec(u)?.[1];
      if (dir) {
        return new Response(
          JSON.stringify({
            value: (tree[decodeURIComponent(dir)] ?? []).map((f) => ({
              name: f.name,
              id: f.id,
              file: {},
              lastModifiedDateTime: f.modified,
            })),
          }),
          { status: 200 },
        );
      }
      return new Response("{}", { status: 200 });
    }),
  );
}

/** upsert / delete 호출을 기록하는 supabase mock. */
function stubDb(existing: { path: string; content_hash: string }[]) {
  const upserts: Record<string, unknown>[] = [];
  const deleted: string[][] = [];
  vi.mocked(createAdminClient).mockReturnValue({
    from: () => ({
      select: () => ({ data: existing, error: null }),
      upsert: async (rows: Record<string, unknown>[]) => {
        upserts.push(...rows);
        return { error: null };
      },
      delete: () => ({
        in: async (_col: string, paths: string[]) => {
          deleted.push(paths);
          return { error: null };
        },
      }),
    }),
  } as never);
  return { upserts, deleted };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getGraphToken).mockResolvedValue("tok");
  process.env.SHAREPOINT_DRIVE_ID = "drive-1";
  process.env.SHAREPOINT_KNOWLEDGE_FOLDER_ID = "VAULT";
});

describe("indexVault", () => {
  it("볼트를 훑어 문서를 인덱스에 넣는다", async () => {
    stubGraph(
      { 플레이북: [{ name: "가.md", id: "f1", modified: "2026-08-15T00:00:00Z" }] },
      { f1: "---\ntitle: 가\ncategory: 플레이북\nowner: 나\nupdated: 2026-08-15\n---\n본문" },
    );
    const { upserts } = stubDb([]);

    const r = await indexVault();

    expect(r.ok).toBe(true);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({
      path: "플레이북/가.md",
      category: "플레이북",
      title: "가",
      owner: "나",
    });
  });

  it("_templates는 인덱싱하지 않는다", async () => {
    stubGraph(
      {
        _templates: [{ name: "지식.md", id: "t1", modified: "2026-08-15T00:00:00Z" }],
        개념: [{ name: "가.md", id: "f1", modified: "2026-08-15T00:00:00Z" }],
      },
      { t1: "---\ntitle: 틀\n---\n", f1: "---\ntitle: 가\n---\n본문" },
    );
    const { upserts } = stubDb([]);

    await indexVault();

    expect(upserts.map((u) => u.path)).toEqual(["개념/가.md"]);
  });

  it("내용이 그대로면 본문을 다시 내려받지 않는다", async () => {
    const text = "---\ntitle: 가\ncategory: 개념\nowner: 나\nupdated: 2026-08-15\n---\n본문";
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update(text, "utf8").digest("hex");
    stubGraph(
      { 개념: [{ name: "가.md", id: "f1", modified: "2026-08-15T00:00:00Z" }] },
      { f1: text },
    );
    const { upserts } = stubDb([{ path: "개념/가.md", content_hash: hash }]);

    const r = await indexVault();

    // 해시가 같으면 upsert 대상이 아니다 — 매번 전부 다시 쓰면 문서가 늘수록 비용이 는다.
    expect(upserts).toHaveLength(0);
    expect(r.details?.unchanged).toBe(1);
  });

  it("볼트에서 사라진 문서는 인덱스에서도 지운다", async () => {
    // 안 지우면 삭제된 지식이 검색에 계속 뜬다 — 가장 나쁜 종류의 낡음이다.
    stubGraph(
      { 개념: [{ name: "가.md", id: "f1", modified: "2026-08-15T00:00:00Z" }] },
      { f1: "---\ntitle: 가\n---\n본문" },
    );
    const { deleted } = stubDb([
      { path: "개념/가.md", content_hash: "old" },
      { path: "개념/사라진 글.md", content_hash: "x" },
    ]);

    await indexVault();

    expect(deleted).toEqual([["개념/사라진 글.md"]]);
  });

  it("frontmatter 누락 건수를 집계해 돌려준다", async () => {
    stubGraph(
      {
        개념: [
          { name: "온전.md", id: "f1", modified: "2026-08-15T00:00:00Z" },
          { name: "빈약.md", id: "f2", modified: "2026-08-15T00:00:00Z" },
        ],
      },
      {
        f1: "---\ntitle: 온전\ncategory: 개념\nowner: 나\nupdated: 2026-08-15\n---\n본문",
        f2: "본문만 있다",
      },
    );
    stubDb([]);

    const r = await indexVault();

    expect(r.details?.indexed).toBe(2);
    expect(r.details?.incomplete).toBe(1);
  });

  it("env가 없으면 실패로 돌려준다 — 조용히 0건 성공하지 않는다", async () => {
    delete process.env.SHAREPOINT_KNOWLEDGE_FOLDER_ID;
    stubDb([]);

    const r = await indexVault();

    expect(r.ok).toBe(false);
    expect(r.message).toContain("SHAREPOINT_KNOWLEDGE_FOLDER_ID");
  });
});
