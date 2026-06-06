import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn().mockResolvedValue("tok"),
}));
vi.mock("@/lib/microsoft/workbook-session", () => ({
  getWorkbookSession: vi.fn().mockResolvedValue("sess"),
  refreshWorkbookSession: vi.fn().mockResolvedValue("sess2"),
}));

import { patchSingleColumn } from "../sheet-write";

const OLD = { ...process.env };

beforeEach(() => {
  process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive";
  process.env.SHAREPOINT_RECEIVABLES_ITEM_ID = "item";
});
afterEach(() => {
  process.env = { ...OLD };
  vi.restoreAllMocks();
});

describe("patchSingleColumn", () => {
  it("빈 행 목록이면 fetch 없이 ok", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await patchSingleColumn({
      worksheetName: "Sheet1",
      colIdx: 0,
      rowNumbers: [],
      value: "2026-06-07",
    });
    expect(r.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("env 누락이면 ok:false", async () => {
    delete process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
    const r = await patchSingleColumn({
      worksheetName: "Sheet1",
      colIdx: 0,
      rowNumbers: [2],
      value: "2026-06-07",
    });
    expect(r.ok).toBe(false);
  });

  it("행별 PATCH 호출 — 주소·값 전달", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const r = await patchSingleColumn({
      worksheetName: "Sheet1",
      colIdx: 0, // A열
      rowNumbers: [2, 5],
      value: "2026-06-07",
    });
    expect(r.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain("A2:A2");
    expect(init?.method).toBe("PATCH");
    expect(String(init?.body)).toContain("2026-06-07");
  });
});
