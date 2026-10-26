import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rawSource, NUMBER_HEADER } from "./fixtures";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "test-token"),
  __resetTokenCache: vi.fn(),
}));
vi.mock("../source", async (orig) => ({
  ...(await orig<typeof import("../source")>()),
  fetchSmsSenderSource: vi.fn(),
}));

async function load() {
  vi.resetModules();
  const source = await import("../source");
  const queries = await import("../queries");
  vi.mocked(source.fetchSmsSenderSource).mockReset();
  return {
    fetchMock: vi.mocked(source.fetchSmsSenderSource),
    SourceFetchError: source.SourceFetchError,
    ...queries,
  };
}

describe("getSmsSenderData", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("10분 안에는 원천을 다시 읽지 않는다", async () => {
    const { fetchMock, getSmsSenderData } = await load();
    fetchMock.mockResolvedValue(rawSource());
    expect((await getSmsSenderData()).ok).toBe(true);
    await getSmsSenderData();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await getSmsSenderData();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("실패는 캐시하지 않는다", async () => {
    const { fetchMock, getSmsSenderData, SourceFetchError } = await load();
    fetchMock.mockRejectedValueOnce(new SourceFetchError("x"));
    fetchMock.mockResolvedValueOnce(rawSource());
    expect(await getSmsSenderData()).toEqual({ ok: false, message: "x" });
    expect((await getSmsSenderData()).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("헤더 오류는 시트·열 문구로", async () => {
    const { fetchMock, getSmsSenderData } = await load();
    const raw = rawSource();
    raw.sheets.numbers = [
      NUMBER_HEADER.map((h) => (h === "발신번호" ? "전화번호" : h)),
      ...raw.sheets.numbers.slice(1),
    ];
    fetchMock.mockResolvedValue(raw);
    expect(await getSmsSenderData()).toEqual({
      ok: false,
      message: "‘_번호’ 시트에서 ‘발신번호’ 열을 찾지 못했습니다.",
    });
  });

  it("예상 밖 오류는 일반 문구, 상세는 로그로", async () => {
    const { fetchMock, getSmsSenderData } = await load();
    fetchMock.mockRejectedValue(new Error("secret https://x?id=1"));
    expect(await getSmsSenderData()).toEqual({
      ok: false,
      message: "현황 파일을 읽지 못했습니다.",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("__resetSmsSenderCache 뒤에는 다시 읽는다", async () => {
    const { fetchMock, getSmsSenderData, __resetSmsSenderCache } = await load();
    fetchMock.mockResolvedValue(rawSource());
    await getSmsSenderData();
    __resetSmsSenderCache();
    await getSmsSenderData();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
