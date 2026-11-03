import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: () => Promise.resolve("tok"),
}));

const { pickSheetName, resolvePettyCashSheetName } = await import("../queries");

/**
 * 시트는 사람이 장부를 닫을 때 넘어간다 — 3월 하순 어느 날이다(`2025` 시트가
 * 2026-03-26, `2024` 가 2025-03-19 에 끝났다). 달력으로 정하면 그 날짜를 맞힐 수 없어,
 * **있는 시트 중 KST 올해 이하로 가장 큰 연도** 를 고른다.
 */
describe("pickSheetName — 있는 연도 시트 중 올해 이하 최대", () => {
  const JAN_2027 = new Date("2027-01-15T03:00:00Z");
  const NOV_2026 = new Date("2026-11-03T03:00:00Z");

  it("1월인데 새해 시트가 아직 없으면 전년도 시트다", () => {
    expect(pickSheetName(["2026", "2025", "2024"], JAN_2027)).toBe("2026");
  });

  it("1월이라도 새해 시트를 이미 만들었으면 새해 시트다", () => {
    expect(pickSheetName(["2027", "2026", "2025"], JAN_2027)).toBe("2027");
  });

  it("11월은 그해 시트다", () => {
    expect(pickSheetName(["2026", "2025", "Sheet1"], NOV_2026)).toBe("2026");
  });

  it("미래 연도 시트는 고르지 않는다 — 미리 만들어 둔 빈 시트에 쓰면 안 된다", () => {
    expect(pickSheetName(["2027", "2026", "2025"], NOV_2026)).toBe("2026");
  });

  it("연도가 아닌 이름은 뺀다 — Sheet1·'2026 사본' 같은 것", () => {
    expect(pickSheetName(["Sheet1", "2026 사본", "2025"], NOV_2026)).toBe("2025");
  });

  it("KST 로 센다 — 12-31 15:00Z 는 이미 새해다", () => {
    expect(pickSheetName(["2027", "2026"], new Date("2026-12-31T15:00:00Z"))).toBe("2027");
  });

  it("연도 시트가 없으면 null", () => {
    expect(pickSheetName(["Sheet1", "Sheet2"], NOV_2026)).toBeNull();
    expect(pickSheetName([], NOV_2026)).toBeNull();
  });
});

describe("resolvePettyCashSheetName — 시트 목록을 읽어 고른다", () => {
  const NOV_2026 = new Date("2026-11-03T03:00:00Z");
  const calls: string[] = [];
  let reply: { ok: boolean; body: unknown } = { ok: true, body: {} };

  beforeEach(() => {
    calls.length = 0;
    process.env.SHAREPOINT_DRIVE_ID = "d";
    process.env.SHAREPOINT_PETTY_CASH_ITEM_ID = "i";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        return {
          ok: reply.ok,
          status: reply.ok ? 200 : 500,
          json: async () => reply.body,
          text: async () => "err",
        };
      }),
    );
  });

  it("워크시트 이름 목록으로 정한다", async () => {
    reply = { ok: true, body: { value: [{ name: "2026" }, { name: "2025" }, { name: "Sheet1" }] } };
    expect(await resolvePettyCashSheetName(NOV_2026)).toEqual({ ok: true, name: "2026" });
    expect(calls[0]).toMatch(/\/drives\/d\/items\/i\/workbook\/worksheets\?\$select=name$/);
  });

  it("목록을 못 읽으면 그렇다고 말한다", async () => {
    reply = { ok: false, body: {} };
    expect(await resolvePettyCashSheetName(NOV_2026)).toEqual({
      ok: false,
      error: "전도금 장부의 시트 목록을 읽지 못했습니다",
    });
  });

  it("연도 시트가 없으면 어떤 시트가 없는지 말한다", async () => {
    reply = { ok: true, body: { value: [{ name: "Sheet1" }] } };
    expect(await resolvePettyCashSheetName(NOV_2026)).toEqual({
      ok: false,
      error: "전도금 장부에 2026년 이하 연도 이름 시트(예: '2026')가 없습니다",
    });
  });

  it("설정이 없으면 부르지 않는다", async () => {
    delete process.env.SHAREPOINT_PETTY_CASH_ITEM_ID;
    expect((await resolvePettyCashSheetName(NOV_2026)).ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});
