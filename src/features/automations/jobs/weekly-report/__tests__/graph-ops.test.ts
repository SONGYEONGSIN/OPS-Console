import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "tok"),
}));
vi.mock("@/lib/microsoft/workbook-session", () => ({
  getWorkbookSession: vi.fn(async () => "sess-1"),
}));

import { listFolderFiles, findReportFolder } from "../graph-ops";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("listFolderFiles", () => {
  it("폴더는 제외하고 파일만 매핑", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonRes({
        value: [
          { id: "1", name: "a.xlsx", lastModifiedDateTime: "2026-01-01T00:00:00Z" },
          { id: "2", name: "하위폴더", folder: {}, lastModifiedDateTime: "x" },
        ],
      }),
    );
    const files = await listFolderFiles("drv", "General/General");
    expect(files).toEqual([
      { id: "1", name: "a.xlsx", lastModifiedDateTime: "2026-01-01T00:00:00Z" },
    ]);
  });

  it("404면 빈 배열", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    expect(await listFolderFiles("drv", "없는경로")).toEqual([]);
  });
});

describe("findReportFolder", () => {
  it("후보 경로 순서대로 시도 — 첫 매칭 폴더 + 최신 파일 반환", async () => {
    const P = "주간업무보고서_진학어플라이본부";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes(encodeURIComponent("General/General"))) {
        return jsonRes({ value: [] }); // 첫 후보는 비어있음 → 다음으로
      }
      // 두 번째 후보에 파일 2개(다른 수정시각)
      return jsonRes({
        value: [
          { id: "old", name: `${P}_2026_1월2주차.xlsx`, lastModifiedDateTime: "2026-01-08T00:00:00Z" },
          { id: "new", name: `${P}_2026_1월3주차.xlsx`, lastModifiedDateTime: "2026-01-15T00:00:00Z" },
          { id: "noise", name: "기타.xlsx", lastModifiedDateTime: "2026-09-01T00:00:00Z" },
        ],
      });
    });
    const r = await findReportFolder("drv", ["General/General", P], P);
    expect(r?.folderPath).toBe(P);
    expect(r?.latest.id).toBe("new"); // prefix 매칭 중 최신(noise 제외)
    expect(r?.siblings.map((f) => f.id).sort()).toEqual(["new", "old"]);
  });

  it("어느 후보에도 없으면 null", async () => {
    // 후보마다 새 Response (body는 1회만 읽힘)
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      jsonRes({ value: [] }),
    );
    expect(await findReportFolder("drv", ["a", "b"], "prefix")).toBeNull();
  });
});
