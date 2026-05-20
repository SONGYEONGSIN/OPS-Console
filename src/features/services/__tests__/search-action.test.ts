import { describe, it, expect, vi, beforeEach } from "vitest";

const listServicesMock = vi.fn();
vi.mock("../queries", () => ({
  listServices: (...args: unknown[]) => listServicesMock(...args),
}));

import { searchServices } from "../search-action";

beforeEach(() => listServicesMock.mockReset());

describe("searchServices", () => {
  it("빈 쿼리 → 빈 배열 (listServices 미호출)", async () => {
    const r = await searchServices("   ");
    expect(r).toEqual([]);
    expect(listServicesMock).not.toHaveBeenCalled();
  });

  it("매칭 결과를 light hit으로 매핑", async () => {
    listServicesMock.mockResolvedValue({
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
    const r = await searchServices("부산대");
    expect(r).toEqual([
      {
        id: "s1",
        universityName: "부산대학교",
        serviceName: "정시 1차",
        operatorName: "송영신",
      },
    ]);
    expect(listServicesMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: "부산대", pageSize: 8 }),
    );
  });
});
