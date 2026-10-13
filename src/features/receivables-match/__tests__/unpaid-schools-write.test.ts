import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchMock, getGraphTokenMock, getWorkbookSessionMock } = vi.hoisted(
  () => ({
    fetchMock: vi.fn(),
    getGraphTokenMock: vi.fn().mockResolvedValue("test-token"),
    getWorkbookSessionMock: vi.fn().mockResolvedValue("sess-1"),
  }),
);

vi.stubGlobal("fetch", fetchMock);
vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken: getGraphTokenMock }));
vi.mock("@/lib/microsoft/workbook-session", () => ({
  getWorkbookSession: getWorkbookSessionMock,
  refreshWorkbookSession: vi.fn().mockResolvedValue("sess-2"),
}));

import { writeUnpaidSchools } from "../unpaid-schools-write";

const ok = () => ({ ok: true, status: 200, text: async () => "" });
const fail = (status: number) => ({
  ok: false,
  status,
  text: async () => `error ${status}`,
});

function call(i: number) {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return {
    url: decodeURIComponent(url),
    method: init.method,
    body: init.body ? JSON.parse(String(init.body)) : undefined,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok());
  getGraphTokenMock.mockClear();
  getWorkbookSessionMock.mockClear();
  process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive-1";
  process.env.SHAREPOINT_DEPOSIT_ITEM_ID = "dep-1";
});

describe("writeUnpaidSchools", () => {
  it("V1:V3000 내용을 지우고 V1:V{N+1} 에 머리글 + 이름 순으로 쓴다", async () => {
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const clear = call(0);
    expect(clear.method).toBe("POST");
    expect(clear.url).toContain("worksheets('입금')/range(address='V1:V3000')/clear");
    expect(clear.body).toEqual({ applyTo: "Contents" });

    const write = call(1);
    expect(write.method).toBe("PATCH");
    expect(write.url).toContain("range(address='V1:V3')");
    expect(write.body).toEqual({
      values: [["미수 학교 (2곳)"], ["가대학"], ["나대학"]],
    });
    expect(write.url).toContain("drives/drive-1/items/dep-1/");
  });

  it("0곳이면 머리글만 쓴다", async () => {
    await writeUnpaidSchools([], "입금");
    const write = call(1);
    expect(write.url).toContain("range(address='V1:V1')");
    expect(write.body).toEqual({ values: [["미수 학교 (0곳)"]] });
  });

  it("clear 응답이 실패면 ok:false 이고 값을 쓰지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(fail(500));
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errorMessage).toContain("500");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("값 PATCH 응답이 실패면 ok:false", async () => {
    fetchMock.mockResolvedValueOnce(ok()).mockResolvedValueOnce(fail(403));
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errorMessage).toContain("403");
  });

  it("세션 발급이 던져도 ok:false 로 돌려준다", async () => {
    getWorkbookSessionMock.mockRejectedValueOnce(new Error("boom"));
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errorMessage).toContain("boom");
  });

  it("환경변수가 없으면 ok:false", async () => {
    delete process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
