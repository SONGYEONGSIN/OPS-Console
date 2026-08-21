import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  rows: [] as Record<string, unknown>[],
  signed: [] as { path: string; expires: number }[],
  signError: null as string | null,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: (path: string, expires: number) => {
          state.signed.push({ path, expires });
          if (state.signError) {
            return Promise.resolve({
              data: null,
              error: { message: state.signError },
            });
          }
          return Promise.resolve({
            data: { signedUrl: `https://signed/${path}` },
            error: null,
          });
        },
      }),
    },
    from: () => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: state.rows, error: null }),
      });
      return chain;
    },
  }),
}));

const { listReceipts, SIGNED_URL_TTL_SECONDS } = await import("../queries");

/**
 * 영수증 목록.
 *
 * 이미지는 **공개 URL이 없다.** 버킷이 비공개라 서버가 그때그때 짧은 서명 URL을
 * 발급해야 열린다 — 화면에 박힌 링크가 새어 나가도 곧 만료된다.
 */
describe("listReceipts", () => {
  beforeEach(() => {
    state.rows = [
      {
        id: "r1",
        storage_path: "2026-08-19/abc.jpg",
        uploaded_by: "박수정",
        created_at: "2026-08-19T02:00:00+00:00",
        confirmed_at: null,
      },
    ];
    state.signed = [];
    state.signError = null;
  });

  it("카드마다 서명 URL을 붙인다", async () => {
    const out = await listReceipts();
    expect(out[0].imageUrl).toBe("https://signed/2026-08-19/abc.jpg");
    expect(state.signed[0].expires).toBe(SIGNED_URL_TTL_SECONDS);
  });

  it("검토하는 동안은 버티되, 하루를 넘기지 않는다", () => {
    // 5분으로 시작했는데 목록을 열어둔 채 나중에 누르면 이미 죽어 있었다
    // (2026-08-21). 한 번 앉아 검토하는 시간은 버텨야 한다.
    expect(SIGNED_URL_TTL_SECONDS).toBeGreaterThanOrEqual(900);
    // 그래도 새어 나간 링크가 오래 살아 있으면 안 된다.
    expect(SIGNED_URL_TTL_SECONDS).toBeLessThanOrEqual(3600);
  });

  it("서명이 실패해도 목록은 낸다 — 카드가 통째로 사라지면 무엇이 안 보이는지 모른다", async () => {
    state.signError = "signing failed";
    const out = await listReceipts();
    expect(out).toHaveLength(1);
    expect(out[0].imageUrl).toBeNull();
  });

  it("올린 사람과 시각을 그대로 싣는다", async () => {
    const out = await listReceipts();
    expect(out[0].uploadedBy).toBe("박수정");
    expect(out[0].createdAt).toBe("2026-08-19T02:00:00+00:00");
  });
});
