import { describe, it, expect, vi, beforeEach } from "vitest";

const listServices = vi.fn();
const listContacts = vi.fn();
const listIncidents = vi.fn();
const listServicesWithHandover = vi.fn();
const fetchReceivablesSheet = vi.fn();

vi.mock("@/features/services/queries", () => ({
  listServices: (...a: unknown[]) => listServices(...a),
}));
vi.mock("@/features/contacts/queries", () => ({
  listContacts: (...a: unknown[]) => listContacts(...a),
}));
vi.mock("@/features/incidents/queries", () => ({
  listIncidents: (...a: unknown[]) => listIncidents(...a),
}));
vi.mock("@/features/handover/queries", () => ({
  listServicesWithHandover: (...a: unknown[]) =>
    listServicesWithHandover(...a),
}));
vi.mock("@/features/receivables/queries", () => ({
  fetchReceivablesSheet: (...a: unknown[]) => fetchReceivablesSheet(...a),
}));

import { searchAll } from "../queries";

const receivablesSheet = {
  worksheetName: "Sheet1",
  metaRows: [],
  headers: ["청구일자", "거래처", "내역", "청구금액", "입금여부", "운영자"],
  rows: [
    ["2026-05-01", "한양대학교", "정시 광고 게재", 1000000, "미수", "송영신"],
    ["2026-05-02", "고려대학교", "수시 배너", 500000, "수금완료", "한효진"],
  ],
  rowsText: [
    ["2026-05-01", "한양대학교", "정시 광고 게재", "1,000,000", "미수", "송영신"],
    ["2026-05-02", "고려대학교", "수시 배너", "500,000", "수금완료", "한효진"],
  ],
  validColIdx: [0, 1, 2, 3, 4, 5],
  headerRowNumber: 1,
  rowCount: 2,
  columnCount: 6,
  fetchedAt: "2026-05-20T00:00:00.000Z",
};

beforeEach(() => {
  listServices.mockResolvedValue({ rows: [], total: 0 });
  listContacts.mockResolvedValue({ rows: [], total: 0 });
  listIncidents.mockResolvedValue({ rows: [], total: 0 });
  listServicesWithHandover.mockResolvedValue({ rows: [], total: 0 });
  fetchReceivablesSheet.mockResolvedValue(null);
});

describe("searchAll", () => {
  it("빈 쿼리 → 전부 빈 배열 (도메인 query 미호출)", async () => {
    const r = await searchAll("  ");
    expect(r.services).toEqual([]);
    expect(listServices).not.toHaveBeenCalled();
  });

  it("services 결과 → primary=대학명, href=services?q=대학명", async () => {
    listServices.mockResolvedValue({
      rows: [
        {
          id: "s1",
          university_name: "부산대학교",
          service_name: "정시 1차",
          operator_name: "송영신",
        },
      ],
      total: 1,
    });
    const r = await searchAll("부산대");
    expect(r.services[0]).toMatchObject({
      id: "s1",
      primary: "부산대학교",
      secondary: "정시 1차 · 송영신",
      href: `/dashboard/services?q=${encodeURIComponent("부산대학교")}`,
    });
  });

  it("receivables 결과 → 거래처 매칭 hit, href=receivables?q", async () => {
    fetchReceivablesSheet.mockResolvedValue(receivablesSheet);
    const r = await searchAll("한양");
    expect(r.receivables).toHaveLength(1);
    expect(r.receivables[0]).toMatchObject({
      primary: "한양대학교",
      href: `/dashboard/receivables?q=${encodeURIComponent("한양")}`,
    });
  });

  it("receivables sheet null → 빈 배열", async () => {
    fetchReceivablesSheet.mockResolvedValue(null);
    const r = await searchAll("한양");
    expect(r.receivables).toEqual([]);
  });

  it("incidents 결과 → primary=사고제목, href=incidents?q", async () => {
    listIncidents.mockResolvedValue({
      rows: [{ id: "i1", title: "결제 오류", university_name: "고려대학교" }],
      total: 1,
    });
    const r = await searchAll("결제");
    expect(r.incidents[0]).toMatchObject({
      primary: "결제 오류",
      secondary: "고려대학교",
      href: `/dashboard/incidents?q=${encodeURIComponent("결제")}`,
    });
  });
});
