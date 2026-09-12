import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { fetchSpy, tokenSpy } = vi.hoisted(() => ({
  fetchSpy: vi.fn(),
  tokenSpy: vi.fn(),
}));

vi.mock("@/lib/microsoft/workbook-web-url", () => ({
  fetchWorkbookWebUrl: (...a: unknown[]) => fetchSpy(...a),
}));
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => tokenSpy(),
}));

const { resolveWorkbookUrl } = await import("../resolve");
const { WORKBOOKS } = await import("../registry");

/**
 * 등록부가 적어 둔 env **이름**으로 값을 읽어 Graph 에 묻는다.
 *
 * 드라이브를 헷갈리면 Graph 가 404 를 내는데, 502 문구는 "env 를 확인하세요"라고
 * 말해 **오진으로 유도한다.** 그래서 어느 드라이브를 읽었는지 단언한다.
 */
describe("resolveWorkbookUrl", () => {
  beforeEach(() => {
    fetchSpy.mockReset().mockResolvedValue("https://sp/x.xlsx");
    tokenSpy.mockReset().mockResolvedValue("tok");
    vi.stubEnv("SHAREPOINT_DRIVE_ID", "main-drive");
    vi.stubEnv("SHAREPOINT_RECEIVABLES_DRIVE_ID", "recv-drive");
    vi.stubEnv("SHAREPOINT_CONTRACTS_ITEM_ID", "item-contracts");
    vi.stubEnv("SHAREPOINT_DEPOSIT_ITEM_ID", "item-deposit");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("등록부의 드라이브·아이템으로 묻는다", async () => {
    await resolveWorkbookUrl(WORKBOOKS["contracts-ledger"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "tok",
      "main-drive",
      "item-contracts",
      expect.anything(),
    );
  });

  /** 미수채권은 메인 드라이브가 아니다 — 섞이면 조용히 404 가 난다. */
  it("미수채권은 전용 드라이브로 묻는다", async () => {
    await resolveWorkbookUrl(WORKBOOKS["receivables-deposit"]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "tok",
      "recv-drive",
      "item-deposit",
      expect.anything(),
    );
  });

  /** 값이 없는데 Graph 를 부르면 헛왕복이고, 실패 이유도 흐려진다. */
  it("드라이브 env 가 없으면 묻지 않고 null", async () => {
    vi.stubEnv("SHAREPOINT_RECEIVABLES_DRIVE_ID", "");
    const r = await resolveWorkbookUrl(WORKBOOKS["receivables-ledger"]);
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("아이템 env 가 없으면 묻지 않고 null", async () => {
    vi.stubEnv("SHAREPOINT_MAIL_ITEM_ID", "");
    const r = await resolveWorkbookUrl(WORKBOOKS["postal-ledger"]);
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  /** 토큰 실패가 목록 전체를 깨면 안 된다 — null 로 내려 502 가 이유를 말한다. */
  it("토큰 획득이 실패하면 null", async () => {
    tokenSpy.mockRejectedValue(new Error("boom"));
    expect(await resolveWorkbookUrl(WORKBOOKS["contracts-ledger"])).toBeNull();
  });

  it("Graph 가 못 찾으면 null", async () => {
    fetchSpy.mockResolvedValue(null);
    expect(await resolveWorkbookUrl(WORKBOOKS["contracts-ledger"])).toBeNull();
  });
});
