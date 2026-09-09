import { describe, it, expect, vi, beforeEach } from "vitest";

const getAssignmentsWorkbookUrl = vi.hoisted(() => vi.fn());
const requireMenu = vi.hoisted(() => vi.fn());

vi.mock("@/features/assignments/workbook-link", () => ({
  getAssignmentsWorkbookUrl,
}));
vi.mock("@/features/auth/menu-guard", () => ({ requireMenu }));

const { GET } = await import("../route");

/**
 * 총괄장 원본 파일로 보내는 창구.
 *
 * 전에는 페이지가 링크를 먼저 조회해 **성공했을 때만 버튼을 그렸다.** 그래서
 * 조회가 실패하면 버튼이 아예 없었고, 사용자에게는 '기능이 안 만들어진 것'과
 * 구분되지 않았다(2026-09-09 실제로 그렇게 보고받았다).
 *
 * 이제 버튼은 늘 있고, 여기서 풀어 보낸다 — 실패하면 **이유가 보인다.**
 */
describe("GET /dashboard/assignments/source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMenu.mockResolvedValue({ email: "a@b.c" });
  });

  it("파일로 보낸다", async () => {
    getAssignmentsWorkbookUrl.mockResolvedValue("https://sp/x.xlsm");
    const res = await GET();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://sp/x.xlsm");
  });

  it("메뉴 권한을 먼저 본다 — 주소를 아는 사람이 곧장 못 들어온다", async () => {
    getAssignmentsWorkbookUrl.mockResolvedValue("https://sp/x.xlsm");
    await GET();
    expect(requireMenu).toHaveBeenCalledWith("assignments");
  });

  it("못 찾으면 이유를 말한다 — 조용히 아무 일도 안 일어나면 안 된다", async () => {
    getAssignmentsWorkbookUrl.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).toContain("총괄장");
    expect(text).toMatch(/SHAREPOINT_ASSIGNMENTS_ITEM_ID|담당자/);
  });

  it("캐시하지 않는다 — 링크가 바뀌면 따라가야 한다", async () => {
    getAssignmentsWorkbookUrl.mockResolvedValue("https://sp/x.xlsm");
    const res = await GET();
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
