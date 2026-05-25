import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MatchPair } from "../types";

const { fetchMock, getGraphTokenMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getGraphTokenMock: vi.fn().mockResolvedValue("test-token"),
}));

vi.stubGlobal("fetch", fetchMock);
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: getGraphTokenMock,
}));

import { patchMatchResult } from "../patch";

const basePair: MatchPair = {
  misuRows: [5],
  depRows: [2],
  kind: "oneToOne",
  depositDate: "2026-04-15",
  amount: 100000,
};

beforeEach(() => {
  fetchMock.mockReset();
  process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive-test";
  process.env.SHAREPOINT_RECEIVABLES_ITEM_ID = "misu-item";
  process.env.SHAREPOINT_DEPOSIT_ITEM_ID = "dep-item";
});

describe("patchMatchResult", () => {
  it("dryRun=true → fetch 호출 없음 + 결과 ok 반환", async () => {
    const result = await patchMatchResult(basePair, "미수시트", "입금시트", { dryRun: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  it("dryRun=false + K열 재read에서 '미처리' 확인 후 PATCH (미수 K/J + 입금 K)", async () => {
    // ① K열 재read GET — 빈 상태 ("미처리" = 빈)
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ values: [[""]] }),
    });
    // ② 미수 K PATCH
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => "" });
    // ③ 미수 J PATCH
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => "" });
    // ④ 입금 K PATCH
    fetchMock.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const result = await patchMatchResult(basePair, "미수시트", "입금시트", { dryRun: false });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(false);
    // 첫 호출은 GET (K열 재read)
    expect(fetchMock.mock.calls[0][1]?.method ?? "GET").toBe("GET");
    // 후속 3건 PATCH
    expect(fetchMock.mock.calls[1][1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[2][1]?.method).toBe("PATCH");
    expect(fetchMock.mock.calls[3][1]?.method).toBe("PATCH");
  });

  it("K열 재read에서 이미 '입금완료' → PATCH skip + ok:false 반환 (race 회피)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ values: [["입금완료"]] }),
    });
    const result = await patchMatchResult(basePair, "미수시트", "입금시트", { dryRun: false });
    expect(fetchMock).toHaveBeenCalledTimes(1); // GET만, PATCH skip
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });
});
