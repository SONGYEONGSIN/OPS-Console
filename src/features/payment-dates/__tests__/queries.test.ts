import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "test-token"),
  __resetTokenCache: vi.fn(),
}));

describe("fetchPaymentDates", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SHAREPOINT_PAYMENT_DRIVE_ID = "drive-1";
    process.env.SHAREPOINT_PAYMENT_ITEM_ID = "item-1";
  });

  it("env 누락 시 [] 반환", async () => {
    delete process.env.SHAREPOINT_PAYMENT_DRIVE_ID;
    const { fetchPaymentDates } = await import("../queries");
    expect(await fetchPaymentDates()).toEqual([]);
  });

  it("최대 기수 시트를 골라 usedRange를 매핑한다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [
            { name: "25기비용지급일(24.04~25.03)" },
            { name: "27기비용지급일(26.04~27.03)" },
            { name: "요약" },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          text: [
            ["연도", "월", "일", "개인/공용"],
            ["2026년", "4월", "9일", "개인"],
            ["2026년", "4월", "15일", "공용"],
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchPaymentDates } = await import("../queries");
    const rows = await fetchPaymentDates();

    // 2번째 fetch(usedRange)는 최대 기수(27기) 시트를 대상으로 호출
    const usedRangeUrl = fetchMock.mock.calls[1][0] as string;
    expect(usedRangeUrl).toContain(
      encodeURIComponent("27기비용지급일(26.04~27.03)"),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      ymd: "2026-04-09",
      year: 2026,
      month: 4,
      day: 9,
      category: "개인",
      sheetName: "27기비용지급일(26.04~27.03)",
    });
    expect(rows[1].category).toBe("공용");
  });

  it("매칭 시트 없음 → []", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ value: [{ name: "Sheet1" }, { name: "요약" }] }),
      }),
    );
    const { fetchPaymentDates } = await import("../queries");
    expect(await fetchPaymentDates()).toEqual([]);
  });

  it("worksheets API 실패 → []", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );
    const { fetchPaymentDates } = await import("../queries");
    expect(await fetchPaymentDates()).toEqual([]);
  });
});
