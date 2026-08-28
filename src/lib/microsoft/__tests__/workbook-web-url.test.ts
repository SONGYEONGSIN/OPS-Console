import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ getGraphToken: vi.fn(async () => "tok") }));

import { fetchWorkbookWebUrl } from "../workbook-web-url";

/**
 * 원본 엑셀 바로가기 링크 하나를 가져온다.
 *
 * 미수채권·우편물이 각자 같은 함수를 갖고 있었고 계약이 **세 번째**가 될 참이었다.
 * 이 레포의 기록이 그 지점을 정확히 짚는다 — "세 번째로 옮겨 적을 때 결국 다른
 * 치수가 들어갔다"(HeaderActionButton).
 */
describe("fetchWorkbookWebUrl", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("webUrl 을 돌려준다", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ webUrl: "https://sp/대장.xlsx" }), {
          status: 200,
        }),
      );
    expect(await fetchWorkbookWebUrl("tok", "D", "I", "계약")).toBe(
      "https://sp/대장.xlsx",
    );
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/drives/D/items/I");
    expect(url).toContain("$select=webUrl");
  });

  it("itemId 가 없으면 조회하지 않는다", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    expect(await fetchWorkbookWebUrl("tok", "D", undefined, "계약")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  /**
   * 던지지 않는다 — 링크 하나 때문에 목록까지 죽으면 안 된다. 깨진 링크를
   * 누르게 하느니 버튼을 안 그린다.
   */
  it("조회가 실패하면 null — 던지지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 404 }),
    );
    expect(await fetchWorkbookWebUrl("tok", "D", "I", "계약")).toBeNull();
  });

  it("네트워크가 터져도 null", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNRESET"));
    expect(await fetchWorkbookWebUrl("tok", "D", "I", "계약")).toBeNull();
  });

  it("webUrl 이 비어 오면 null — 빈 링크를 버튼에 달지 않는다", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    expect(await fetchWorkbookWebUrl("tok", "D", "I", "계약")).toBeNull();
  });
});
