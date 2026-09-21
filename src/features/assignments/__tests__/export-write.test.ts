import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getGraphToken = vi.hoisted(() => vi.fn());
const getWorkbookSession = vi.hoisted(() => vi.fn());
const refreshWorkbookSession = vi.hoisted(() => vi.fn());
const listLedgerRows = vi.hoisted(() => vi.fn());

vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken }));
vi.mock("@/lib/microsoft/workbook-session", () => ({
  getWorkbookSession,
  refreshWorkbookSession,
}));
vi.mock("../ledger-queries", () => ({ listLedgerRows }));

import { exportAssignmentsToSheet } from "../export-write";
import { EXPORT_SHEET_NAME, EXPORT_WARNING } from "../export-rows";

const row = (o: Partial<Record<string, unknown>> = {}) => ({
  academic_year: 2027,
  university_name: "가천대학교",
  university_type: "4년제",
  work_kind: "원서접수",
  subtype: "수시",
  role: "운영",
  assignee_email: "a@x.com",
  assignee_name: "김운영",
  ...o,
});

const ok = (body: unknown = {}) =>
  ({ ok: true, status: 200, json: async () => body, text: async () => "" }) as Response;
const fail = (status: number, text = "boom") =>
  ({ ok: false, status, json: async () => ({}), text: async () => text }) as Response;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHAREPOINT_DRIVE_ID = "drive-1";
  process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID = "item-1";
  delete process.env.ASSIGNMENT_EXPORT_DRY_RUN;
  getGraphToken.mockResolvedValue("tok");
  getWorkbookSession.mockResolvedValue("sess");
  refreshWorkbookSession.mockResolvedValue("sess2");
  listLedgerRows.mockResolvedValue([row()]);
  fetchMock = vi.fn().mockResolvedValue(ok());
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exportAssignmentsToSheet — dry run", () => {
  it("ASSIGNMENT_EXPORT_DRY_RUN=true 면 Graph 를 한 번도 부르지 않는다", async () => {
    process.env.ASSIGNMENT_EXPORT_DRY_RUN = "true";

    const r = await exportAssignmentsToSheet();

    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getGraphToken).not.toHaveBeenCalled();
    expect(getWorkbookSession).not.toHaveBeenCalled();
  });

  it("dry run 이어도 조립은 한다 — 행 수와 열 수를 돌려준다", async () => {
    process.env.ASSIGNMENT_EXPORT_DRY_RUN = "true";

    const r = await exportAssignmentsToSheet();

    // 머리글 3줄 + 대학 1행
    expect(r.rows).toBe(4);
    expect(r.columns).toBeGreaterThan(2);
  });
});

describe("exportAssignmentsToSheet — 쓰기", () => {
  it("한 range 에 2차원 배열을 한 번에 쓴다 — 행별 PATCH 는 부분 실패 창을 만든다", async () => {
    await exportAssignmentsToSheet();

    const patches = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patches).toHaveLength(1);

    const body = JSON.parse((patches[0][1] as RequestInit).body as string);
    expect(Array.isArray(body.values)).toBe(true);
    expect(body.values.length).toBeGreaterThan(1);
    expect(body.values[0][0]).toBe(EXPORT_WARNING);
  });

  it("앱 전용 시트에만 쓴다 — 사람이 쓰는 02~08 은 주소에 없다", async () => {
    await exportAssignmentsToSheet();

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes(encodeURIComponent(EXPORT_SHEET_NAME)))).toBe(
      true,
    );
    for (const u of urls) {
      expect(u).not.toMatch(/02\.|03\.|04\.|05\.|06\.|07\.|08\./);
    }
  });

  it("토큰·세션은 한 번만 받는다", async () => {
    await exportAssignmentsToSheet();

    expect(getGraphToken).toHaveBeenCalledTimes(1);
    expect(getWorkbookSession).toHaveBeenCalledTimes(1);
  });

  it("남은 구간을 지운다 — 행이 줄면 지난 내보내기가 아래 남는다", async () => {
    await exportAssignmentsToSheet();

    const cleared = fetchMock.mock.calls.filter((c) =>
      String(c[0]).includes("/clear"),
    );
    expect(cleared.length).toBeGreaterThan(0);
  });

  it("시트가 없으면 만든다", async () => {
    // 시트 목록 조회가 빈 배열 → add 호출이 있어야 한다
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/worksheets") && (!init || init.method === "GET")) {
        return Promise.resolve(ok({ value: [] }));
      }
      return Promise.resolve(ok());
    });

    await exportAssignmentsToSheet();

    const added = fetchMock.mock.calls.filter(
      (c) =>
        (c[1] as RequestInit | undefined)?.method === "POST" &&
        String(c[0]).includes("/worksheets"),
    );
    expect(added.length).toBeGreaterThan(0);
  });
});

describe("exportAssignmentsToSheet — 실패", () => {
  it("504 면 세션을 다시 받아 한 번만 재시도한다", async () => {
    let patchCalls = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        patchCalls += 1;
        return Promise.resolve(patchCalls === 1 ? fail(504) : ok());
      }
      return Promise.resolve(ok());
    });

    const r = await exportAssignmentsToSheet();

    expect(refreshWorkbookSession).toHaveBeenCalledTimes(1);
    expect(patchCalls).toBe(2);
    expect(r.ok).toBe(true);
  });

  it("403 은 재시도하지 않는다 — 권한은 다시 부른다고 생기지 않는다", async () => {
    let patchCalls = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        patchCalls += 1;
        return Promise.resolve(fail(403, "forbidden"));
      }
      return Promise.resolve(ok());
    });

    const r = await exportAssignmentsToSheet();

    expect(r.ok).toBe(false);
    expect(patchCalls).toBe(1);
    expect(refreshWorkbookSession).not.toHaveBeenCalled();
  });

  it("env 가 없으면 Graph 를 부르지 않고 실패한다", async () => {
    delete process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID;

    const r = await exportAssignmentsToSheet();

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/SHAREPOINT_ASSIGNMENTS_ITEM_ID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("원장이 비면 쓰지 않는다 — 시트를 통째로 비우는 것은 사고다", async () => {
    listLedgerRows.mockResolvedValue([]);

    const r = await exportAssignmentsToSheet();

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/원장/);
    const patches = fetchMock.mock.calls.filter(
      (c) => (c[1] as RequestInit | undefined)?.method === "PATCH",
    );
    expect(patches).toHaveLength(0);
  });
});
