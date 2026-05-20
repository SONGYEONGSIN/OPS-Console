import { describe, it, expect, vi, beforeEach } from "vitest";

const listServices = vi.fn();
const listContacts = vi.fn();
const listIncidents = vi.fn();
const listServicesWithHandover = vi.fn();

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

import { searchAll } from "../queries";

beforeEach(() => {
  listServices.mockResolvedValue({ rows: [], total: 0 });
  listContacts.mockResolvedValue({ rows: [], total: 0 });
  listIncidents.mockResolvedValue({ rows: [], total: 0 });
  listServicesWithHandover.mockResolvedValue({ rows: [], total: 0 });
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
