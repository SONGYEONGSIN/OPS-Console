// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

type Source = {
  id: string;
  storagePath: string;
  createdAt: string;
  acceptedAt: string | null;
  regions: null;
};

const state = {
  me: { email: "a@x.com", permission: "member" } as Record<
    string,
    unknown
  > | null,
  canView: true,
  viewedSlug: null as string | null,
  sources: [] as Source[],
  missingFiles: new Set<string>(),
  unreadable: new Set<string>(),
  slots: [] as {
    kind: string;
    label?: string;
    reason?: string;
    jpeg?: Buffer;
  }[],
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/features/auth/permission", () => ({
  canViewMenu: (slug: string) => {
    state.viewedSlug = slug;
    return state.canView;
  },
}));
vi.mock("@/features/postal/receipt-print/sources", () => ({
  loadPrintSources: (ids: string[]) =>
    Promise.resolve(state.sources.filter((s) => ids.includes(s.id))),
  downloadReceipt: (path: string) =>
    Promise.resolve(state.missingFiles.has(path) ? null : Buffer.from(path)),
}));
vi.mock("@/features/postal/receipt-print/render-image", () => ({
  renderReceiptImage: (input: Buffer) =>
    state.unreadable.has(input.toString())
      ? Promise.reject(
          new Error("Input buffer contains unsupported image format"),
        )
      : Promise.resolve({ jpeg: input, widthPx: 465, heightPx: 1000 }),
}));
vi.mock("@/lib/pdf/receipt-print-pdf", () => ({
  renderReceiptPrintPdf: (slots: typeof state.slots) => {
    state.slots = slots;
    return Promise.resolve(Buffer.from("%PDF-fake"));
  },
}));

const { GET } = await import("../route");
const { RECEIPT_PDF_PATH } =
  await import("@/features/postal/receipt-print/print-ids");
const { RECEIPT_PDF_BATCH } =
  await import("@/features/postal/receipt-print/layout");

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const src = (
  n: number,
  acceptedAt: string | null,
  storagePath = `2026-09-2${n}/r${n}.jpg`,
): Source => ({
  id: id(n),
  storagePath,
  createdAt: "2026-09-20T00:00:00Z",
  acceptedAt,
  regions: null,
});
const get = (ids: string[]) =>
  GET(new Request(`http://x${RECEIPT_PDF_PATH}?ids=${ids.join(",")}`));

describe("영수증 출력 PDF 라우트", () => {
  beforeEach(() => {
    state.me = { email: "a@x.com", permission: "member" };
    state.canView = true;
    state.viewedSlug = null;
    state.sources = [src(1, "2026-09-23 15:14"), src(2, "2026-09-17 10:00")];
    state.missingFiles = new Set();
    state.unreadable = new Set();
    state.slots = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("주소 상수가 실제 라우트 위치다 — 화면이 만든 링크가 404 가 되지 않는다", () => {
    expect(
      existsSync(join(process.cwd(), "src/app", RECEIPT_PDF_PATH, "route.ts")),
    ).toBe(true);
  });

  it("로그인하지 않으면 401", async () => {
    state.me = null;
    expect((await get([id(1)])).status).toBe(401);
  });

  it("우편물 메뉴를 못 보면 403 — 페이지와 같은 판정을 쓴다", async () => {
    state.canView = false;
    expect((await get([id(1)])).status).toBe(403);
    expect(state.viewedSlug).toBe("postal");
  });

  it("id 가 틀리면 400", async () => {
    expect((await get(["abc"])).status).toBe(400);
  });

  it(`${RECEIPT_PDF_BATCH}장을 넘으면 400 — 화면이 나눠 보낸다`, async () => {
    const many = Array.from({ length: RECEIPT_PDF_BATCH + 1 }, (_, i) =>
      id(i + 1),
    );
    expect((await get(many)).status).toBe(400);
  });

  it("하나도 없으면(그사이 지웠다) 404", async () => {
    const res = await get([id(9)]);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      error: "영수증을 찾을 수 없습니다",
    });
  });

  it("PDF 를 새 탭에 연다 — 파일명은 첫 접수일~끝 접수일, 캐시하지 않는다", async () => {
    const res = await get([id(1), id(2)]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent("우편영수증_2026-09-17_2026-09-23.pdf")}`,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("접수일시 순으로 찍는다 — 전표에 붙는 순서", async () => {
    await get([id(1), id(2)]);
    expect(state.slots.map((s) => s.jpeg?.toString())).toEqual([
      "2026-09-22/r2.jpg",
      "2026-09-21/r1.jpg",
    ]);
  });

  it("지운 영수증은 빼고 남은 것을 찍는다", async () => {
    const res = await get([id(1), id(9)]);
    expect(res.status).toBe(200);
    expect(state.slots).toHaveLength(1);
  });

  it("사진을 못 받거나 못 읽으면 그 칸에 사유를 적고 나머지는 찍는다", async () => {
    state.sources = [
      src(1, "2026-09-21 10:00"),
      src(2, "2026-09-22 10:00", "2026-09-22/r2.heic"),
      src(3, "2026-09-23 10:00"),
      src(4, "2026-09-24 10:00"),
    ];
    state.missingFiles = new Set(["2026-09-21/r1.jpg"]);
    state.unreadable = new Set(["2026-09-22/r2.heic", "2026-09-23/r3.jpg"]);
    const res = await get([id(1), id(2), id(3), id(4)]);
    expect(res.status).toBe(200);
    expect(
      state.slots.map((s) => (s.kind === "error" ? s.reason : "image")),
    ).toEqual([
      "사진을 받지 못했습니다",
      "HEIC 사진은 넣을 수 없습니다 — JPG 로 다시 올려 주세요",
      "사진을 읽지 못했습니다",
      "image",
    ]);
    expect(state.slots[0].label).toBe("접수 2026-09-21 10:00");
  });

  it("판독 전 영수증의 사유 칸은 올린 시각으로 이름 붙인다", async () => {
    state.sources = [src(4, null)];
    state.missingFiles = new Set(["2026-09-24/r4.jpg"]);
    await get([id(4)]);
    // 2026-09-20T00:00:00Z → 한국 09-20 09:00
    expect(state.slots[0].label).toBe("올림 2026-09-20 09:00");
  });
});
