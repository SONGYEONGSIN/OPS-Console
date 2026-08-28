import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  token: "tok" as string | null,
  webUrl: "https://sp/계약관리대장.xlsx" as string | null,
  asked: [] as (string | undefined)[],
};

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => {
    if (!state.token) return Promise.reject(new Error("토큰 실패"));
    return Promise.resolve(state.token);
  },
}));

vi.mock("@/lib/microsoft/workbook-web-url", () => ({
  fetchWorkbookWebUrl: (
    _t: string,
    _d: string,
    itemId: string | undefined,
  ) => {
    state.asked.push(itemId);
    return Promise.resolve(state.webUrl);
  },
}));

const { getContractsWorkbookUrl } = await import("../workbook-link");

/**
 * 계약 목록은 SharePoint 엑셀의 사본이다. 원본으로 가는 길이 화면에 없으면
 * 고칠 게 있을 때 파일을 따로 찾아 헤매게 된다 — 미수채권·우편물이 이미
 * 같은 버튼을 갖고 있다.
 */
describe("getContractsWorkbookUrl", () => {
  beforeEach(() => {
    state.token = "tok";
    state.webUrl = "https://sp/계약관리대장.xlsx";
    state.asked = [];
    process.env.SHAREPOINT_DRIVE_ID = "DRIVE";
    process.env.SHAREPOINT_CONTRACTS_ITEM_ID = "ITEM";
  });

  it("계약 엑셀의 webUrl 을 돌려준다 — 목록이 읽는 그 파일이다", async () => {
    expect(await getContractsWorkbookUrl()).toBe(
      "https://sp/계약관리대장.xlsx",
    );
    expect(state.asked).toEqual(["ITEM"]);
  });

  it("드라이브 설정이 없으면 null — 버튼을 안 그린다", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;
    expect(await getContractsWorkbookUrl()).toBeNull();
  });

  it("토큰을 못 받아도 던지지 않는다 — 링크 하나 때문에 목록이 죽으면 안 된다", async () => {
    state.token = null;
    expect(await getContractsWorkbookUrl()).toBeNull();
  });

  it("조회가 실패하면 null", async () => {
    state.webUrl = null;
    expect(await getContractsWorkbookUrl()).toBeNull();
  });
});
