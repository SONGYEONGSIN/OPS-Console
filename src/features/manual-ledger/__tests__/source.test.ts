import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "tok"),
}));

import { ManualSourceError } from "../parse";
import {
  fetchManualSource,
  folderChildrenUrl,
  sheetValuesUrl,
  worksheetsUrl,
} from "../source";

const GRAPH = "https://graph.microsoft.com/v1.0";

const ledger = [
  ["업무", "문서명", "담당자", "최종 수정"],
  ["원서접수", "A01. 원서접수 매뉴얼.docx", "담당자A", "2026.03.02"],
  ["정산", "D01. 정산 체크리스트.xlsx", "담당자B", ""],
];
const schedule = [
  ["구분", "업무", "담당자"],
  ["▪ 진행 중", "", ""],
  ["A", "원서접수", "담당자A"],
  ["▪ 이관/중단", "", ""],
  ["D", "정산", "담당자B"],
];
const children = [
  { id: "folder1", name: "하위 폴더", webUrl: "https://example.test/f" },
  {
    id: "file1",
    name: "A01. 원서접수 매뉴얼.docx",
    webUrl: "https://example.test/a01",
    lastModifiedDateTime: "2026-11-08T11:00:00Z",
    cTag: "c1",
    file: {},
  },
  { id: "file2", name: "D01. 정산 체크리스트.xlsx", file: {} },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const SHEET_NAMES = [
  "0. 한눈 요약",
  "1. 관리 가이드",
  "2. 연간 일정",
  "3. 매뉴얼 대장",
  "4. 기타(책갈피 설정)",
];

type Routes = {
  ledger?: Response;
  schedule?: Response;
  children?: Response[];
  sheets?: Response;
};

function stubFetch(routes: Routes = {}) {
  const pages = [...(routes.children ?? [json({ value: children })])];
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("/workbook/worksheets?")) {
      return (
        routes.sheets ?? json({ value: SHEET_NAMES.map((name) => ({ name })) })
      );
    }
    if (url.includes(encodeURIComponent("3. 매뉴얼 대장"))) {
      return routes.ledger ?? json({ values: ledger });
    }
    if (url.includes(encodeURIComponent("2. 연간 일정"))) {
      return routes.schedule ?? json({ values: schedule });
    }
    return pages.shift() ?? json({ value: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("SHAREPOINT_DRIVE_ID", "drive1");
  vi.stubEnv("SHAREPOINT_MANUAL_ITEM_ID", "folderX");
  vi.stubEnv("SHAREPOINT_MANUAL_LEDGER_ITEM_ID", "ledgerX");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("URL", () => {
  it("시트 이름을 인코딩하고 작은따옴표는 두 번 쓴다", () => {
    expect(sheetValuesUrl("d", "i", "2. 매뉴얼 대장")).toContain(
      encodeURIComponent("2. 매뉴얼 대장"),
    );
    expect(sheetValuesUrl("d", "i", "a'b")).toContain(
      encodeURIComponent("a''b"),
    );
    expect(sheetValuesUrl("d", "i", "s")).toContain(
      "/usedRange(valuesOnly=true)?$select=values",
    );
  });

  it("폴더 목록은 item id 로 부르고 cTag 를 함께 받는다", () => {
    const url = folderChildrenUrl("d", "f");
    expect(url).toBe(
      `${GRAPH}/drives/d/items/f/children?$top=200&$select=id,name,webUrl,lastModifiedDateTime,cTag,file`,
    );
  });
});

describe("fetchManualSource", () => {
  it("두 시트와 폴더를 읽어 원천을 만든다 — 폴더 항목은 뺀다", async () => {
    const fetchMock = stubFetch();
    const source = await fetchManualSource();
    expect(source.ledger).toHaveLength(2);
    expect(source.activeTasks).toEqual(new Set(["원서접수"]));
    expect(source.files).toEqual([
      {
        id: "file1",
        name: "A01. 원서접수 매뉴얼.docx",
        webUrl: "https://example.test/a01",
        lastModifiedDateTime: "2026-11-08T11:00:00Z",
        cTag: "c1",
      },
      {
        id: "file2",
        name: "D01. 정산 체크리스트.xlsx",
        webUrl: null,
        lastModifiedDateTime: null,
        cTag: null,
      },
    ]);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(folderChildrenUrl("drive1", "folderX"));
    expect(urls).toContain(
      sheetValuesUrl("drive1", "ledgerX", "3. 매뉴얼 대장"),
    );
    expect(urls).toContain(sheetValuesUrl("drive1", "ledgerX", "2. 연간 일정"));
  });

  it("시트 목록을 먼저 읽고 고른 이름으로 usedRange 를 부른다", async () => {
    const fetchMock = stubFetch();
    await fetchManualSource();
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toBe(worksheetsUrl("drive1", "ledgerX"));
    expect(urls[0]).toBe(
      `${GRAPH}/drives/drive1/items/ledgerX/workbook/worksheets?$select=name`,
    );
  });

  it("시트 목록 읽기 실패는 ManualSourceError 로 끝난다", async () => {
    stubFetch({ sheets: new Response("x", { status: 404 }) });
    await expect(fetchManualSource()).rejects.toThrow(
      "시트 목록 읽기 실패 (404)",
    );
  });

  it("대장 시트가 없으면 실패한다", async () => {
    stubFetch({
      sheets: json({ value: [{ name: "2. 연간 일정" }] }),
    });
    await expect(fetchManualSource()).rejects.toThrow(ManualSourceError);
  });

  it("다음 쪽(Graph 주소)을 따라가 합친다", async () => {
    stubFetch({
      children: [
        json({
          value: [children[1]],
          "@odata.nextLink": `${GRAPH}/drives/drive1/items/folderX/children?$skiptoken=x`,
        }),
        json({ value: [children[2]] }),
      ],
    });
    const source = await fetchManualSource();
    expect(source.files.map((f) => f.id)).toEqual(["file1", "file2"]);
  });

  it("Graph 밖 다음 쪽 주소는 따라가지 않는다", async () => {
    stubFetch({
      children: [
        json({
          value: [],
          "@odata.nextLink": "https://evil.example.test/next",
        }),
      ],
    });
    await expect(fetchManualSource()).rejects.toThrow(ManualSourceError);
  });

  it("시트 읽기 실패는 상태 코드와 함께 실패한다", async () => {
    stubFetch({ ledger: new Response("x", { status: 500 }) });
    await expect(fetchManualSource()).rejects.toThrow(
      "매뉴얼 대장 읽기 실패 (500)",
    );
  });

  it("구성표 item id 가 없으면 부르지도 않고 실패한다", async () => {
    vi.stubEnv("SHAREPOINT_MANUAL_LEDGER_ITEM_ID", "");
    const fetchMock = stubFetch();
    await expect(fetchManualSource()).rejects.toThrow(ManualSourceError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
