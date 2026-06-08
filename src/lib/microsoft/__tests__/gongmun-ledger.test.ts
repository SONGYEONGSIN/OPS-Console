import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ getGraphToken: vi.fn(async () => "tok") }));
vi.mock("../workbook-session", () => ({
  getWorkbookSession: vi.fn(async () => "sess-1"),
}));

import {
  formatDocPrefix,
  nextDocNumber,
  updateSenderRowLink,
} from "../gongmun-ledger";

// 시행번호 = 운영 + YY + MM + '-' + DD + 일련번호2자리 (그날 순번)
// 예 운영2512-1603 = 2025-12-16 그날 3번째

describe("formatDocPrefix", () => {
  it("운영{YY}{MM}-{DD}", () => {
    expect(formatDocPrefix(new Date(2026, 5, 2))).toBe("운영2606-02"); // 2026-06-02
    expect(formatDocPrefix(new Date(2025, 11, 16))).toBe("운영2512-16"); // 2025-12-16
  });
});

describe("nextDocNumber", () => {
  it("그날 기존 번호 없으면 01", () => {
    expect(nextDocNumber([], new Date(2026, 5, 2))).toBe("운영2606-0201");
  });

  it("그날 최대 NN + 1", () => {
    const existing = ["운영2606-0201", "운영2606-0202", "운영2605-2901"];
    expect(nextDocNumber(existing, new Date(2026, 5, 2))).toBe("운영2606-0203");
  });

  it("다른 날 번호는 무시 (DD 단위 순번)", () => {
    const existing = ["운영2606-0205", "운영2606-0301"]; // 06-02는 05까지
    expect(nextDocNumber(existing, new Date(2026, 5, 3))).toBe("운영2606-0302");
  });

  it("공백/잡음 행 안전 처리", () => {
    const existing = ["", "  ", "메모", "운영2606-0201"];
    expect(nextDocNumber(existing, new Date(2026, 5, 2))).toBe("운영2606-0202");
  });
});

describe("updateSenderRowLink", () => {
  // usedRange: 헤더 A1, 데이터 A2~ (startRow=2). B열(idx 1)=시행번호.
  const USED_RANGE = {
    address: "'(발신)2026년'!A1:G3",
    text: [
      ["순번", "시행번호", "날짜", "수신", "제목", "링크", "담당자"],
      ["1", "운영2606-0201", "2026-06-02", "건국대", "건A", "", "나"],
      ["2", "운영2606-0202", "2026-06-02", "조선대", "조B", "", "너"],
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("B열==docNumber 행을 찾아 그 행 F열만 PATCH 후 true", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      // 1) usedRange GET
      .mockResolvedValueOnce(
        new Response(JSON.stringify(USED_RANGE), { status: 200 }),
      )
      // 2) F셀 PATCH
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));

    const ok = await updateSenderRowLink(
      "drive-1",
      "item-1",
      2026,
      "운영2606-0202",
      "https://sp/x.docx",
    );

    expect(ok).toBe(true);
    // 운영2606-0202 = 데이터 2번째 행 → Excel 행 3 (startRow 2 + idx 1)
    const patchUrl = fetchMock.mock.calls[1][0] as string;
    expect(patchUrl).toContain(encodeURIComponent("F3:F3"));
    const patchInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(patchInit.body as string)).toEqual({
      values: [["https://sp/x.docx"]],
    });
  });

  it("docNumber 행을 못 찾으면 false, PATCH 호출 안 함", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify(USED_RANGE), { status: 200 }),
      );

    const ok = await updateSenderRowLink(
      "drive-1",
      "item-1",
      2026,
      "운영2606-9999",
      "https://sp/x.docx",
    );

    expect(ok).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1); // usedRange GET만
  });
});
