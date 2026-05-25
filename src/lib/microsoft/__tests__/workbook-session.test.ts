import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("../auth", () => ({
  getGraphToken: vi.fn(),
  __resetTokenCache: vi.fn(),
}));

import { getGraphToken } from "../auth";
import {
  refreshWorkbookSession,
  __resetWorkbookSessionCache,
} from "../workbook-session";

const DRIVE = "drive-1";
const ITEM = "item-1";

beforeEach(() => {
  __resetWorkbookSessionCache();
  vi.mocked(getGraphToken).mockReset();
});

describe("refreshWorkbookSession", () => {
  it("성공 응답 → sessionId 반환", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok-A");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "session-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const id = await refreshWorkbookSession(DRIVE, ITEM);
    expect(id).toBe("session-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401 응답 → forceRefresh로 token 재발급 + 1회 재시도 후 성공", async () => {
    vi.mocked(getGraphToken)
      .mockResolvedValueOnce("tok-stale")
      .mockResolvedValueOnce("tok-fresh");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          '{"error":{"code":"InvalidAuthenticationToken","message":"token expired"}}',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "session-2" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const id = await refreshWorkbookSession(DRIVE, ITEM);
    expect(id).toBe("session-2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 재시도 시 forceRefresh 호출
    expect(vi.mocked(getGraphToken)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(getGraphToken).mock.calls[1][0]).toEqual({
      forceRefresh: true,
    });
  });

  it("401 → 재시도도 401 → throw", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "still bad",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshWorkbookSession(DRIVE, ITEM)).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("403 등 401이 아닌 에러 → 재시도 없음, 즉시 throw", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(refreshWorkbookSession(DRIVE, ITEM)).rejects.toThrow(/403/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
