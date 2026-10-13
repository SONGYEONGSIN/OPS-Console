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
const readOf = (values: unknown[][]) => ({
  ok: true,
  status: 200,
  json: async () => ({ values }),
  text: async () => "",
});
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
  // 첫 호출(V열 현재 값 읽기)은 빈 열 — 이후는 ok
  fetchMock.mockResolvedValueOnce(readOf([[""]]));
  getGraphTokenMock.mockClear();
  getWorkbookSessionMock.mockClear();
  process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID = "drive-1";
  process.env.SHAREPOINT_DEPOSIT_ITEM_ID = "dep-1";
});

describe("writeUnpaidSchools", () => {
  it("V1:V3000 내용을 지우고 V1:V{N+1} 에 머리글 + 이름 순으로 쓴다", async () => {
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true, written: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const read = call(0);
    expect(read.method).toBe("GET");
    expect(read.url).toContain("range(address='V1:V3000')");

    const clear = call(1);
    expect(clear.method).toBe("POST");
    expect(clear.url).toContain("worksheets('입금')/range(address='V1:V3000')/clear");
    expect(clear.body).toEqual({ applyTo: "Contents" });

    const write = call(2);
    expect(write.method).toBe("PATCH");
    expect(write.url).toContain("range(address='V1:V3')");
    expect(write.body).toEqual({
      values: [["미수 학교 (2곳)"], ["가대학"], ["나대학"]],
    });
    expect(write.url).toContain("drives/drive-1/items/dep-1/");
  });

  it("0곳이면 머리글만 쓴다", async () => {
    await writeUnpaidSchools([], "입금");
    const write = call(2);
    expect(write.url).toContain("range(address='V1:V1')");
    expect(write.body).toEqual({ values: [["미수 학교 (0곳)"]] });
  });

  it("clear 응답이 실패면 ok:false 이고 값을 쓰지 않는다", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(readOf([[""]]))
      .mockResolvedValueOnce(fail(500));
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errorMessage).toContain("500");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("값 PATCH 응답이 실패면 ok:false", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(readOf([[""]]))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(fail(403));
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

  it("현재 V열이 새 목록과 같으면 지우지도 쓰지도 않는다", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      readOf([["미수 학교 (2곳)"], ["가대학"], ["나대학"], [""], [""]]),
    );
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true, written: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(call(0).method).toBe("GET");
  });

  it("값이 숫자·빈칸 섞여 와도 비어 있지 않은 칸을 문자열로 순서대로 비교한다", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      readOf([["미수 학교 (0곳)"], [""], [""]]),
    );
    const res = await writeUnpaidSchools([], "입금");
    expect(res).toEqual({ ok: true, written: false });
  });

  it("순서나 내용이 다르면 다시 쓴다", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        readOf([["미수 학교 (2곳)"], ["나대학"], ["가대학"]]),
      )
      .mockResolvedValue(ok());
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true, written: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("읽기 응답이 실패면 건너뛰지 않고 ok:false 이며 쓰지 않는다", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(fail(404));
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errorMessage).toContain("404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("환경변수가 없으면 ok:false", async () => {
    delete process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
