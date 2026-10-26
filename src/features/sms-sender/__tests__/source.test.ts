import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CRITERIA_SHEET, DOCS_FOLDER, SMS_ROOT_PATH } from "../types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "test-token"),
  __resetTokenCache: vi.fn(),
}));

import {
  childrenUrl,
  usedRangeUrl,
  fetchSmsSenderSource,
  SourceFetchError,
} from "../source";

const file = (name: string) => ({
  id: `id-${name}`,
  name,
  webUrl: `https://example.invalid/${name}`,
  size: 10,
  lastModifiedDateTime: "2026-10-19T00:00:00Z",
  file: {},
});
const folder = (name: string) => ({ id: `fid-${name}`, name, folder: {} });
const json = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => "raw-body",
  }) as Response;

const NEXT = "https://graph.microsoft.com/v1.0/__next/page2";

type Routes = {
  children: Record<string, unknown>;
  sheets?: Record<string, Response>;
};

function installFetch(routes: Routes) {
  let calls = 0;
  const fn = vi.fn(async (input: string, _init?: RequestInit) => {
    if (++calls > 1000) throw new Error("runaway fetch loop");
    if (input.startsWith(NEXT)) {
      return json(routes.children["__next"]);
    }
    const url = decodeURIComponent(input);
    const m = /\/root:\/(.*?):\/children/.exec(url);
    if (m) {
      const rel = m[1].slice(SMS_ROOT_PATH.length).replace(/^\//, "");
      const hit = routes.children[rel];
      return hit ? json(hit) : json({ error: "nf" }, 404);
    }
    const s = /worksheets\('(.*?)'\)/.exec(url);
    if (s) return routes.sheets?.[s[1]] ?? json({ values: [["h"]] });
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const fullTree = (): Routes["children"] => ({
  "": {
    value: [
      file("현황_261010.xlsm"),
      file("현황_261017.xlsm"),
      folder(DOCS_FOLDER),
    ],
  },
  [DOCS_FOLDER]: {
    value: [folder("완료"), folder("진행 중")],
    "@odata.nextLink": NEXT,
  },
  __next: { value: [file("루트.pdf")] },
  [`${DOCS_FOLDER}/완료`]: { value: [folder("제출완료"), folder("검토완료")] },
  [`${DOCS_FOLDER}/완료/제출완료`]: { value: [folder("접수+PIMS")] },
  [`${DOCS_FOLDER}/완료/제출완료/접수+PIMS`]: {
    value: [file("a.pdf"), file("memo.txt")],
  },
  [`${DOCS_FOLDER}/완료/검토완료`]: { value: [file("b.pdf")] },
  [`${DOCS_FOLDER}/진행 중`]: { value: [file("c.pdf")] },
});

describe("url builders", () => {
  it("childrenUrl 은 조각마다 인코딩 — + 와 공백", () => {
    const u = childrenUrl(
      "d1",
      `${SMS_ROOT_PATH}/${DOCS_FOLDER}/완료/제출완료/접수+PIMS`,
    );
    expect(
      u.startsWith("https://graph.microsoft.com/v1.0/drives/d1/root:/"),
    ).toBe(true);
    expect(u).toContain("%2BPIMS");
    expect(u).not.toContain("+PIMS");
    expect(u).not.toContain(" ");
    expect(u).toContain(":/children?");
  });
  it("usedRangeUrl 은 시트 이름을 인코딩하고 valuesOnly", () => {
    expect(usedRangeUrl("d1", "i1", "_번호")).toContain(
      `worksheets('${encodeURIComponent("_번호")}')/usedRange(valuesOnly=true)`,
    );
  });
  it("usedRangeUrl 은 시트 이름의 작은따옴표를 겹친다 (OData 리터럴)", () => {
    expect(usedRangeUrl("d1", "i1", "a'b")).toContain(
      `worksheets('${encodeURIComponent("a''b")}')`,
    );
  });
});

describe("fetchSmsSenderSource", () => {
  beforeEach(() => {
    process.env.SHAREPOINT_DRIVE_ID = "d1";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("폴더를 재귀로 훑고 nextLink 를 따라간다", async () => {
    installFetch({ children: fullTree() });
    const raw = await fetchSmsSenderSource();
    expect(raw.workbook.name).toBe("현황_261017.xlsm");
    expect(raw.pdfs.map((p) => `${p.folder}|${p.name}`).sort()).toEqual([
      "|루트.pdf",
      "완료/검토완료|b.pdf",
      "완료/제출완료/접수+PIMS|a.pdf",
      "진행 중|c.pdf",
    ]);
    expect(Object.keys(raw.sheets).sort()).toEqual([
      "checks",
      "docs",
      "numbers",
      "schools",
    ]);
    expect(raw.criteria).not.toBeNull();
    expect(raw.fetchedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it("모든 Graph 호출은 no-store + Bearer 토큰", async () => {
    const fn = installFetch({ children: fullTree() });
    await fetchSmsSenderSource();
    expect(fn.mock.calls.length).toBeGreaterThan(0);
    for (const [, init] of fn.mock.calls) {
      expect(init).toEqual(
        expect.objectContaining({
          cache: "no-store",
          headers: { Authorization: "Bearer test-token" },
        }),
      );
    }
  });

  it("Graph 밖 nextLink 는 따라가지 않는다 — 토큰도 안 보낸다", async () => {
    const tree = fullTree();
    tree[DOCS_FOLDER] = {
      value: [],
      "@odata.nextLink": "https://evil.invalid/page2",
    };
    const fn = installFetch({ children: tree });
    const err = await fetchSmsSenderSource().catch((e: Error) => e);
    expect(err).toBeInstanceOf(SourceFetchError);
    expect((err as Error).message).not.toMatch(/evil|https?:/);
    expect(
      fn.mock.calls.some(([u]) => String(u).includes("evil.invalid")),
    ).toBe(false);
  });

  it("nextLink 가 끝나지 않으면 쪽 수 상한에서 멈춘다", async () => {
    const tree = fullTree();
    tree.__next = { value: [], "@odata.nextLink": NEXT };
    const fn = installFetch({ children: tree });
    const err = await fetchSmsSenderSource().catch((e: Error) => e);
    expect(err).toBeInstanceOf(SourceFetchError);
    expect((err as Error).message).not.toMatch(/https?:/);
    const pages = fn.mock.calls.filter(([u]) => String(u).startsWith(NEXT));
    expect(pages.length).toBeLessThan(100);
  });

  it("05 시트 404 는 criteria null — 실패 아님", async () => {
    installFetch({
      children: fullTree(),
      sheets: { [CRITERIA_SHEET]: json({}, 404) },
    });
    const raw = await fetchSmsSenderSource();
    expect(raw.criteria).toBeNull();
  });

  it("숨김 시트 실패는 SourceFetchError(상태 코드 포함)", async () => {
    installFetch({ children: fullTree(), sheets: { _번호: json({}, 500) } });
    await expect(fetchSmsSenderSource()).rejects.toThrow(/_번호.*500/);
    await expect(fetchSmsSenderSource()).rejects.toBeInstanceOf(
      SourceFetchError,
    );
  });

  it("SHAREPOINT_DRIVE_ID 없으면 SourceFetchError", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;
    installFetch({ children: fullTree() });
    await expect(fetchSmsSenderSource()).rejects.toBeInstanceOf(
      SourceFetchError,
    );
  });

  it("현황 파일이 없으면 SourceFetchError", async () => {
    const tree = fullTree();
    tree[""] = { value: [file("메모.xlsm"), folder(DOCS_FOLDER)] };
    installFetch({ children: tree });
    await expect(fetchSmsSenderSource()).rejects.toThrow(/현황 파일/);
  });

  it("오류 메시지에 토큰·원문 본문이 새지 않는다", async () => {
    installFetch({ children: fullTree(), sheets: { _번호: json({}, 500) } });
    const err = await fetchSmsSenderSource().catch((e: Error) => e);
    expect((err as Error).message).not.toMatch(
      /test-token|raw-body|d1|graph\.microsoft/,
    );
  });
});
