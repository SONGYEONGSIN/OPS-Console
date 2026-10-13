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

const ok = () => ({
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => "",
});
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
  it("V1:V3000 내용을 지우고 V4:V{N+4} 에 제목 + 이름 순으로 쓴다", async () => {
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true, written: true });

    const read = call(0);
    expect(read.method).toBe("GET");
    expect(read.url).toContain("range(address='V1:V3000')");

    const clear = call(1);
    expect(clear.method).toBe("POST");
    expect(clear.url).toContain("worksheets('입금')/range(address='V1:V3000')/clear");
    expect(clear.body).toEqual({ applyTo: "Contents" });

    const write = call(2);
    expect(write.method).toBe("PATCH");
    expect(write.url).toContain("range(address='V4:V6')");
    expect(write.body).toEqual({
      values: [["미수 학교 (2곳)"], ["가대학"], ["나대학"]],
    });
    expect(write.url).toContain("drives/drive-1/items/dep-1/");
  });

  it("0곳이면 V4 제목만 쓴다", async () => {
    await writeUnpaidSchools([], "입금");
    const write = call(2);
    expect(write.url).toContain("range(address='V4:V4')");
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
      readOf([[""], [""], [""], ["미수 학교 (2곳)"], ["가대학"], ["나대학"], [""]]),
    );
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true, written: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(call(0).method).toBe("GET");
  });

  it("값이 숫자·빈칸 섞여 와도 비어 있지 않은 칸을 문자열로 순서대로 비교한다", async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValueOnce(
      readOf([[""], [""], [""], ["미수 학교 (0곳)"], [""], [""]]),
    );
    const res = await writeUnpaidSchools([], "입금");
    expect(res).toEqual({ ok: true, written: false });
  });

  it("순서나 내용이 다르면 다시 쓴다", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(
        readOf([[""], [""], [""], ["미수 학교 (2곳)"], ["나대학"], ["가대학"]]),
      )
      .mockResolvedValue(ok());
    const res = await writeUnpaidSchools(["가대학", "나대학"], "입금");
    expect(res).toEqual({ ok: true, written: true });
  });

  it("제목이 예전 위치 V1 에 있으면 같은 목록이어도 다시 쓴다", async () => {
    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(readOf([["미수 학교 (1곳)"], ["가대학"], [""]]))
      .mockResolvedValue(ok());
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res).toEqual({ ok: true, written: true });
    expect(call(2).url).toContain("range(address='V4:V5')");
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

type Reply = { ok: boolean; status: number; json?: () => Promise<unknown>; text: () => Promise<string> };
const json = (body: unknown): Reply => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => "",
});

/** URL+method 로 응답을 고르는 라우터. 못 맞추면 빈 200. */
function route(overrides: Record<string, Reply> = {}) {
  const base: Record<string, Reply> = {
    "GET V1:V3000": json({ values: [[""]] }),
    "GET M4/format/fill": json({ color: "#000000" }),
    "GET M4/format/font": json({
      name: "맑은 고딕",
      size: 11,
      bold: true,
      color: "#FFFFFF",
      italic: null,
    }),
    "GET M4/format": json({ horizontalAlignment: "Center", verticalAlignment: "Center" }),
    "GET M5/format/font": json({
      name: "맑은 고딕",
      size: 10,
      bold: false,
      color: "#000000",
      italic: false,
    }),
  };
  const table = { ...base, ...overrides };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
    const u = decodeURIComponent(url);
    const m = /range\(address='([^']+)'\)(.*)$/.exec(u);
    const key = `${init.method} ${m?.[1]}${m?.[2]}`;
    return table[key] ?? ok();
  });
}

function calls() {
  return fetchMock.mock.calls.map((_, i) => call(i));
}
const find = (method: string, suffix: string) =>
  calls().find((c) => c.method === method && c.url.endsWith(suffix));

describe("writeUnpaidSchools 서식 복사", () => {
  it("M4 채우기·글꼴·정렬을 읽어 V4 에 같은 값으로 쓴다(null 속성 제외)", async () => {
    route();
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res).toEqual({ ok: true, written: true });
    expect(find("PATCH", "address='V4')/format/fill")?.body).toEqual({ color: "#000000" });
    expect(find("PATCH", "address='V4')/format/font")?.body).toEqual({
      name: "맑은 고딕",
      size: 11,
      bold: true,
      color: "#FFFFFF",
    });
    expect(find("PATCH", "address='V4')/format")?.body).toEqual({
      horizontalAlignment: "Center",
      verticalAlignment: "Center",
    });
  });

  it("M5 글꼴을 V5:V3000 에 쓴다", async () => {
    route();
    await writeUnpaidSchools(["가대학"], "입금");
    expect(find("PATCH", "address='V5:V3000')/format/font")?.body).toEqual({
      name: "맑은 고딕",
      size: 10,
      bold: false,
      color: "#000000",
      italic: false,
    });
  });

  it("M4 채우기가 없거나 흰색이면 V4 채우기를 clear 한다", async () => {
    route({ "GET M4/format/fill": json({ color: "#FFFFFF" }) });
    await writeUnpaidSchools(["가대학"], "입금");
    expect(find("POST", "address='V4')/format/fill/clear")).toBeDefined();
    expect(find("PATCH", "address='V4')/format/fill")).toBeUndefined();
  });

  it("서식 PATCH 가 실패하면 ok:false 와 사유를 돌려준다", async () => {
    route({ "PATCH V4/format/font": fail(500) as Reply });
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.errorMessage).toContain("format V4");
    expect(res.ok === false && res.errorMessage).toContain("500");
  });

  it("목록이 같아 건너뛰면 서식 호출도 없다", async () => {
    route({ "GET V1:V3000": json({ values: [[""], [""], [""], ["미수 학교 (1곳)"], ["가대학"]] }) });
    const res = await writeUnpaidSchools(["가대학"], "입금");
    expect(res).toEqual({ ok: true, written: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("M~T 열로 가는 쓰기 호출이 하나도 없다", async () => {
    route();
    await writeUnpaidSchools(["가대학"], "입금");
    const writes = calls().filter((c) => c.method !== "GET");
    expect(writes.length).toBeGreaterThan(0);
    for (const w of writes) {
      expect(w.url).not.toMatch(/address='[M-T]\d/);
    }
  });
});
