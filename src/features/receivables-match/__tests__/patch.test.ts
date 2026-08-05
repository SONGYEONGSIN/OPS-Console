import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MatchPair } from "../types";

const {
  fetchMock,
  getGraphTokenMock,
  getWorkbookSessionMock,
  refreshWorkbookSessionMock,
} = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getGraphTokenMock: vi.fn().mockResolvedValue("test-token"),
  getWorkbookSessionMock: vi.fn().mockResolvedValue("sess-1"),
  refreshWorkbookSessionMock: vi.fn().mockResolvedValue("sess-2"),
}));

vi.stubGlobal("fetch", fetchMock);
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: getGraphTokenMock,
}));
vi.mock("@/lib/microsoft/workbook-session", () => ({
  getWorkbookSession: getWorkbookSessionMock,
  refreshWorkbookSession: refreshWorkbookSessionMock,
}));

import { patchMatchResult } from "../patch";

const basePair: MatchPair = {
  misuRows: [5],
  depRows: [2],
  kind: "oneToOne",
  depositDate: "2026-04-15",
  amount: 100000,
};

const ok = () => ({ ok: true, status: 200, text: async () => "" });
const fail = (status: number) => ({
  ok: false,
  status,
  text: async () => `error ${status}`,
});
const noteGet = (value: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ values: [[value]] }),
});

/** fetchMock 호출 i의 (url, method, sessionId) 요약 */
function callAt(i: number) {
  const [url, init] = fetchMock.mock.calls[i] as [
    string,
    RequestInit & { headers?: Record<string, string> },
  ];
  return {
    url,
    method: init?.method ?? "GET",
    session: init?.headers?.["workbook-session-id"],
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  getWorkbookSessionMock.mockClear();
  refreshWorkbookSessionMock.mockClear();
  getWorkbookSessionMock.mockResolvedValue("sess-1");
  refreshWorkbookSessionMock.mockResolvedValue("sess-2");
  process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive-test";
  process.env.SHAREPOINT_RECEIVABLES_ITEM_ID = "misu-item";
  process.env.SHAREPOINT_DEPOSIT_ITEM_ID = "dep-item";
});

describe("patchMatchResult", () => {
  it("dryRun=true → fetch 호출 없음 + 결과 ok 반환", async () => {
    const result = await patchMatchResult(basePair, "미수시트", "입금시트", {
      dryRun: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(true);
  });

  it("dryRun=false + K열 재read에서 '미처리' 확인 후 PATCH (미수 J/K + 입금 K)", async () => {
    fetchMock.mockResolvedValueOnce(noteGet("")); // ① K열 재read GET
    fetchMock.mockResolvedValueOnce(ok()); // ② 미수 J PATCH
    fetchMock.mockResolvedValueOnce(ok()); // ③ 미수 K PATCH
    fetchMock.mockResolvedValueOnce(ok()); // ④ 입금 K PATCH

    const result = await patchMatchResult(basePair, "미수시트", "입금시트", {
      dryRun: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.ok).toBe(true);
    expect(result.dryRun).toBe(false);
    expect(callAt(0).method).toBe("GET");
    expect(callAt(1).method).toBe("PATCH");
    expect(callAt(2).method).toBe("PATCH");
    expect(callAt(3).method).toBe("PATCH");
  });

  it("K열 재read에서 이미 '입금완료' → PATCH skip + ok:false 반환 (race 회피)", async () => {
    fetchMock.mockResolvedValueOnce(noteGet("입금완료"));
    const result = await patchMatchResult(basePair, "미수시트", "입금시트", {
      dryRun: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    expect(result.skipped).toBe(true);
  });

  it("모든 Graph 호출에 워크북 세션 헤더를 싣는다", async () => {
    fetchMock.mockResolvedValue(noteGet(""));
    fetchMock.mockResolvedValueOnce(noteGet(""));
    fetchMock.mockResolvedValueOnce(ok());
    fetchMock.mockResolvedValueOnce(ok());
    fetchMock.mockResolvedValueOnce(ok());

    await patchMatchResult(basePair, "미수시트", "입금시트", { dryRun: false });

    // 미수 워크북 3건(GET + J + K) + 입금 워크북 1건 — 각자 세션 발급
    expect(getWorkbookSessionMock).toHaveBeenCalledWith("drive-test", "misu-item");
    expect(getWorkbookSessionMock).toHaveBeenCalledWith("drive-test", "dep-item");
    for (let i = 0; i < 4; i++) {
      expect(callAt(i).session).toBe("sess-1");
    }
  });

  it("PATCH 실패를 삼키지 않는다 — ok:false + errorMessage", async () => {
    fetchMock.mockResolvedValueOnce(noteGet("")); // GET
    fetchMock.mockResolvedValueOnce(ok()); // J PATCH
    fetchMock.mockResolvedValueOnce(fail(500)); // K PATCH 실패

    const result = await patchMatchResult(basePair, "미수시트", "입금시트", {
      dryRun: false,
    });
    expect(result.ok).toBe(false);
    expect(result.skipped).toBeFalsy();
    expect(result.errorMessage).toContain("500");
    expect(result.errorMessage).toContain("K5");
  });

  it("504는 세션 재발급 후 1회 재시도한다", async () => {
    fetchMock.mockResolvedValueOnce(noteGet("")); // GET
    fetchMock.mockResolvedValueOnce(fail(504)); // J PATCH 1차 실패
    fetchMock.mockResolvedValueOnce(ok()); // J PATCH retry 성공
    fetchMock.mockResolvedValueOnce(ok()); // K PATCH
    fetchMock.mockResolvedValueOnce(ok()); // 입금 K PATCH

    const result = await patchMatchResult(basePair, "미수시트", "입금시트", {
      dryRun: false,
    });
    expect(refreshWorkbookSessionMock).toHaveBeenCalledWith(
      "drive-test",
      "misu-item",
    );
    expect(callAt(2).session).toBe("sess-2");
    expect(result.ok).toBe(true);
  });

  it("N:1 — 미수 여러 행 모두 J와 K를 쓴다 (J가 K보다 먼저)", async () => {
    const pair: MatchPair = { ...basePair, misuRows: [100, 101], kind: "nToOne" };
    fetchMock.mockResolvedValueOnce(noteGet("")); // GET
    for (let i = 0; i < 5; i++) fetchMock.mockResolvedValueOnce(ok());

    const result = await patchMatchResult(pair, "미수시트", "입금시트", {
      dryRun: false,
    });
    expect(result.ok).toBe(true);
    // 행마다 J → K 순서. K가 먼저 찍히면 부분 실패 시 그 행이 '처리완료'로 굳어
    // 재실행에서도 영구 제외된다.
    expect(callAt(1).url).toContain("J100");
    expect(callAt(2).url).toContain("K100");
    expect(callAt(3).url).toContain("J101");
    expect(callAt(4).url).toContain("K101");
    expect(callAt(5).url).toContain("K2");
  });
});
