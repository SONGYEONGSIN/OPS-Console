// @vitest-environment node
//
// 저장소 다운로드가 Blob 을 돌려준다 — node 의 Blob 으로 돌린다.
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  receipts: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
  receiptsError: null as { message: string } | null,
  files: {} as Record<string, Buffer>,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result =
        table === "postal_receipts"
          ? { data: state.receipts, error: state.receiptsError }
          : { data: state.requests, error: null };
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        in: () => chain,
        order: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(result),
      });
      return chain;
    },
    storage: {
      from: () => ({
        download: (path: string) =>
          Promise.resolve(
            path in state.files
              ? {
                  data: new Blob([new Uint8Array(state.files[path])]),
                  error: null,
                }
              : { data: null, error: { message: "Object not found" } },
          ),
      }),
    },
  }),
}));

const { loadPrintSources, downloadReceipt } = await import("../sources");

const REGIONS = {
  receipt: [0.18, 0, 0.78, 1],
  accepted_at: [0.37, 0.12, 0.56, 0.14],
  total_fee: [0.53, 0.59, 0.72, 0.61],
};

describe("loadPrintSources", () => {
  beforeEach(() => {
    state.receipts = [
      {
        id: "r1",
        storage_path: "2026-09-23/a.jpg",
        created_at: "2026-09-23T01:00:00+00:00",
      },
    ];
    state.requests = [];
    state.receiptsError = null;
  });

  it("최신 판독의 접수일시와 위치를 싣는다 — 목록과 같은 규칙", async () => {
    state.requests = [
      {
        receipt_id: "r1",
        result: { accepted_at: "2026-09-23 15:14", regions: REGIONS },
        requested_at: "2026-09-28T07:00:00Z",
      },
      {
        receipt_id: "r1",
        result: { accepted_at: "2026-09-22 09:00" },
        requested_at: "2026-09-23T02:00:00Z",
      },
    ];
    expect(await loadPrintSources(["r1"])).toEqual([
      {
        id: "r1",
        storagePath: "2026-09-23/a.jpg",
        createdAt: "2026-09-23T01:00:00+00:00",
        acceptedAt: "2026-09-23 15:14",
        regions: REGIONS,
      },
    ]);
  });

  it("판독이 없으면 접수일시·위치가 없다", async () => {
    const [s] = await loadPrintSources(["r1"]);
    expect([s.acceptedAt, s.regions]).toEqual([null, null]);
  });

  it("재판독 대기 중이면 위치가 없다 — 목록처럼 최신 요청만 본다", async () => {
    state.requests = [
      { receipt_id: "r1", result: null, requested_at: "2026-09-28T08:00:00Z" },
      {
        receipt_id: "r1",
        result: { accepted_at: "2026-09-23 15:14", regions: REGIONS },
        requested_at: "2026-09-28T07:00:00Z",
      },
    ];
    const [s] = await loadPrintSources(["r1"]);
    expect([s.acceptedAt, s.regions]).toEqual([null, null]);
  });

  it("영수증 조회가 실패하면 던진다 — 조용한 0건은 '없는 영수증'으로 둔갑한다", async () => {
    state.receiptsError = { message: "boom" };
    await expect(loadPrintSources(["r1"])).rejects.toThrow(
      /영수증을 읽지 못했습니다/,
    );
  });
});

describe("downloadReceipt", () => {
  it("사진을 받는다", async () => {
    state.files = { "a.jpg": Buffer.from("jpeg-bytes") };
    expect((await downloadReceipt("a.jpg"))?.toString()).toBe("jpeg-bytes");
  });

  it("못 받으면 null — 그 칸에 사유를 적는다", async () => {
    state.files = {};
    expect(await downloadReceipt("없는.jpg")).toBeNull();
  });
});
