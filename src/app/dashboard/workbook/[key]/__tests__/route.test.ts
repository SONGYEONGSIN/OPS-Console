import { describe, it, expect, vi, beforeEach } from "vitest";

const resolveWorkbookUrl = vi.hoisted(() => vi.fn());
const requireMenu = vi.hoisted(() => vi.fn());

vi.mock("@/features/workbook/resolve", () => ({ resolveWorkbookUrl }));
vi.mock("@/features/auth/menu-guard", () => ({ requireMenu }));

const { GET } = await import("../route");

const req = () => new Request("http://localhost/dashboard/workbook/x");
const call = (key: string) =>
  GET(req(), { params: Promise.resolve({ key }) });

/**
 * 워크북 열람 창구 — 버튼은 늘 있고 여기서 푼다.
 *
 * 전에는 페이지가 먼저 조회해 **성공했을 때만 버튼을 그렸다.** 조회가 실패하면
 * 버튼이 아예 없어서 '기능이 없는 것'과 구분되지 않았다(2026-09-09 총괄장에서
 * 실제로 겪었고, 나머지 6버튼에 같은 함정이 남아 있었다).
 */
describe("GET /dashboard/workbook/[key]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireMenu.mockResolvedValue({ email: "a@b.c", permission: "admin" });
    resolveWorkbookUrl.mockResolvedValue("https://sp/x.xlsx");
  });

  it("파일로 보낸다", async () => {
    const res = await call("contracts-ledger");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://sp/x.xlsx");
  });

  it("그 대장의 메뉴 권한을 본다 — 주소를 아는 사람이 곧장 못 들어온다", async () => {
    await call("postal-ledger");
    expect(requireMenu).toHaveBeenCalledWith("postal");
  });

  /** 링크는 SharePoint 사정으로 바뀐다 — 캐시하면 죽은 주소를 계속 준다. */
  it("캐시하지 않는다", async () => {
    const res = await call("contracts-ledger");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  /** 모르는 키로 메뉴 가드를 먼저 돌리면 엉뚱한 곳으로 리다이렉트된다. */
  it("모르는 키는 404 이고, 메뉴 가드를 부르지 않는다", async () => {
    const res = await call("nope");
    expect(res.status).toBe(404);
    expect(requireMenu).not.toHaveBeenCalled();
    expect(await res.text()).toMatch(/대장/);
  });

  /** 이유 없이 실패만 알리면 담당자가 손쓸 수 없다 — env 이름을 적는다. */
  it("못 풀면 502 에 대장 이름과 env 이름을 적는다", async () => {
    resolveWorkbookUrl.mockResolvedValue(null);
    const res = await call("receivables-ledger");
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain("미수채권대장");
    expect(body).toContain("SHAREPOINT_RECEIVABLES_DRIVE_ID");
    expect(body).toContain("SHAREPOINT_RECEIVABLES_ITEM_ID");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  /**
   * **이 변경의 가장 큰 위험.** 수수료입금내역의 admin 제한은 이 변경 전까지
   * 렌더 게이팅뿐이었다 — admin 에게만 버튼이 그려져 안전했을 뿐이고 서버
   * 강제가 없었다. 라우트로 빼면 주소를 직접 칠 수 있고, 미수채권 화면 자체는
   * member·viewer 도 들어온다. 여기서 막지 않으면 권한이 후퇴한다.
   */
  it("admin 전용 대장은 member 를 막는다", async () => {
    requireMenu.mockResolvedValue({ email: "m@b.c", permission: "member" });
    const res = await call("receivables-deposit");
    expect(res.status).toBe(403);
    expect(resolveWorkbookUrl).not.toHaveBeenCalled();
  });

  /**
   * redirect 로 막으면 새 탭에 대시보드가 떠서 '아무 일도 안 일어남'이 된다 —
   * 이 PR 이 고치려는 증상과 똑같은 모양이다. 이유를 본문에 적는다.
   */
  it("막을 때도 이유를 본문에 적는다 — redirect 로 넘기지 않는다", async () => {
    requireMenu.mockResolvedValue({ email: "m@b.c", permission: "member" });
    const res = await call("receivables-deposit");
    expect(res.status).not.toBe(307);
    expect(await res.text()).toMatch(/수수료입금내역/);
  });

  it("admin 은 admin 전용 대장을 연다", async () => {
    const res = await call("receivables-deposit");
    expect(res.status).toBe(307);
  });

  it("admin 전용이 아니면 member 도 연다", async () => {
    requireMenu.mockResolvedValue({ email: "m@b.c", permission: "member" });
    const res = await call("postal-petty-cash");
    expect(res.status).toBe(307);
  });
});
