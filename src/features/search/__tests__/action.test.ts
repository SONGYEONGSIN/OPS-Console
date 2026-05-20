import { describe, it, expect, vi, beforeEach } from "vitest";

const searchAll = vi.fn();
vi.mock("../queries", () => ({
  searchAll: (...a: unknown[]) => searchAll(...a),
}));

import { searchAllAction } from "../action";

beforeEach(() => searchAll.mockReset());

describe("searchAllAction", () => {
  it("searchAll에 query 위임", async () => {
    const fake = { services: [], contacts: [], incidents: [], handover: [] };
    searchAll.mockResolvedValue(fake);
    const r = await searchAllAction("부산대");
    expect(searchAll).toHaveBeenCalledWith("부산대");
    expect(r).toBe(fake);
  });
});
