import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  rows: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
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
        in: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: state.rows, error: null }),
        // getExtractStates 는 limit 없이 order 까지 부르고 기다린다.
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: state.requests, error: null }),
      });
      return chain;
    },
  }),
}));

// 담당자 조회는 총괄장(Graph)을 읽는다 — 이 파일의 관심사가 아니라 끊는다.
vi.mock("../assignee-queries", () => ({
  loadAssigneeRows: () => Promise.resolve({ under: [], grad: [] }),
}));

const { listReceipts, SIGNED_URL_TTL_SECONDS, getExtractStates } =
  await import("../queries");

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

/**
 * 형광펜 준비 여부 — 영수증 출력 버튼 옆 안내가 센다.
 * 이게 틀리면 모든 영수증이 '빠짐' 으로 보이거나, 빠진 것을 못 본다.
 */
describe("getExtractStates — hasRegions", () => {
  const BOX = [0.1, 0.1, 0.2, 0.2];
  const done = (regions?: unknown) => ({
    receipt_id: "r1",
    status: "done",
    warnings: [],
    message: null,
    requested_at: "2026-09-28T07:00:00Z",
    result: {
      accepted_at: "2026-09-23 15:14",
      items: [
        {
          tracking_no: "11263-1102-7080",
          fee: 4590,
          postal_code: "55338",
          recipient_org: "우석대",
          recipient_name: "강정화",
        },
      ],
      ...(regions === undefined ? {} : { regions }),
    },
  });

  it("접수일자·총요금 자리를 다 찾았으면 참", async () => {
    state.requests = [done({ receipt: BOX, accepted_at: BOX, total_fee: BOX })];
    expect((await getExtractStates(["r1"])).get("r1")?.hasRegions).toBe(true);
  });

  it("하나라도 없으면 거짓", async () => {
    state.requests = [
      done({ receipt: BOX, accepted_at: BOX, total_fee: null }),
    ];
    expect((await getExtractStates(["r1"])).get("r1")?.hasRegions).toBe(false);
  });

  it("위치를 묻기 전 판독은 거짓", async () => {
    state.requests = [done()];
    expect((await getExtractStates(["r1"])).get("r1")?.hasRegions).toBe(false);
  });
});
