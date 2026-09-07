import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const fetchWorkbookWebUrl = vi.hoisted(() => vi.fn());
const getGraphToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/microsoft/workbook-web-url", () => ({ fetchWorkbookWebUrl }));
vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken }));

const { getAssignmentsWorkbookUrl } = await import("../workbook-link");

/**
 * 총괄장 원본 파일 바로가기.
 *
 * **던지지 않는다** — 링크 하나 때문에 배정 목록까지 못 뜨면 안 되고,
 * 깨진 링크를 누르게 하느니 버튼을 안 그리는 편이 낫다(계약·우편물과 같은 규칙).
 */
describe("getAssignmentsWorkbookUrl", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHAREPOINT_DRIVE_ID = "drive1";
    process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID = "item1";
    getGraphToken.mockResolvedValue("tok");
    fetchWorkbookWebUrl.mockResolvedValue("https://sp/x.xlsm");
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("목록이 읽는 그 파일을 준다 — 같은 ITEM_ID", async () => {
    await getAssignmentsWorkbookUrl();
    expect(fetchWorkbookWebUrl).toHaveBeenCalledWith(
      "tok",
      "drive1",
      "item1",
      expect.any(String),
    );
  });

  it("링크를 그대로 돌려준다", async () => {
    expect(await getAssignmentsWorkbookUrl()).toBe("https://sp/x.xlsm");
  });

  it("드라이브 설정이 없으면 null — 던지지 않는다", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;
    await expect(getAssignmentsWorkbookUrl()).resolves.toBeNull();
  });

  it("토큰을 못 받아도 null", async () => {
    getGraphToken.mockRejectedValue(new Error("no token"));
    await expect(getAssignmentsWorkbookUrl()).resolves.toBeNull();
  });

  it("조회가 실패하면 null — 깨진 링크를 안 그린다", async () => {
    fetchWorkbookWebUrl.mockResolvedValue(null);
    expect(await getAssignmentsWorkbookUrl()).toBeNull();
  });
});
