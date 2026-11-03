import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FIELD } from "../types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(async () => "test-token"),
  __resetTokenCache: vi.fn(),
}));

import { fetchRequestItems, RequestListError } from "../list-source";

const json = (body: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => "raw-body",
  }) as Response;

const fields = (over: Record<string, unknown> = {}) => ({
  [FIELD.title]: "가짜 제목",
  [FIELD.status]: "요청",
  [FIELD.university]: "가짜대학교",
  [FIELD.kind]: "수시",
  [FIELD.serviceId]: "12345",
  ...over,
});

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  webUrl: `https://example.invalid/item/${id}`,
  createdBy: {
    user: { displayName: "홍길동", email: "fake@example.invalid", id: "u1" },
  },
  lastModifiedDateTime: "2026-11-03T00:00:00Z",
  fields: fields(),
  ...over,
});

const NEXT = "https://graph.microsoft.com/v1.0/sites/s/lists/l/items?$skiptoken=2";

function installFetch(pages: Response[]) {
  let i = 0;
  const fn = vi.fn(async (_u: string, _init?: RequestInit) => pages[i++]);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("fetchRequestItems", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("필드 키를 RequestItem 으로 옮긴다", async () => {
    const fn = installFetch([json({ value: [row("7")] })]);
    const r = await fetchRequestItems("s", "l");
    expect(r).toEqual({
      malformed: 0,
      items: [
        {
          id: "7",
          status: "요청",
          university: "가짜대학교",
          kind: "수시",
          serviceId: "12345",
          title: "가짜 제목",
          applicantEmail: "fake@example.invalid",
          applicantName: "홍길동",
          webUrl: "https://example.invalid/item/7",
        },
      ],
    });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe(
      "https://graph.microsoft.com/v1.0/sites/s/lists/l/items?$expand=fields&$top=200",
    );
    expect(init).toEqual(
      expect.objectContaining({
        cache: "no-store",
        headers: { Authorization: "Bearer test-token" },
      }),
    );
  });

  it("필수 키(예: 상태, 구분) 중 하나라도 없으면 malformed 로 센다", async () => {
    const noStatus = fields();
    delete (noStatus as Record<string, unknown>)[FIELD.status];
    const noKind = fields({ [FIELD.kind]: undefined });
    installFetch([
      json({
        value: [
          row("1", { fields: noStatus }),
          row("2", { fields: noKind }),
          row("3"),
        ],
      }),
    ]);
    const r = await fetchRequestItems("s", "l");
    expect(r.items.map((i) => i.id)).toEqual(["3"]);
    expect(r.malformed).toBe(2);
  });

  it("Graph 호스트의 nextLink 는 따라간다", async () => {
    const fn = installFetch([
      json({ value: [row("1")], "@odata.nextLink": NEXT }),
      json({ value: [row("2")] }),
    ]);
    const r = await fetchRequestItems("s", "l");
    expect(r.items.map((i) => i.id)).toEqual(["1", "2"]);
    expect(fn.mock.calls[1][0]).toBe(NEXT);
  });

  it("Graph 밖 nextLink 는 RequestListError", async () => {
    const fn = installFetch([
      json({
        value: [row("1")],
        "@odata.nextLink": "https://evil.invalid/page2",
      }),
    ]);
    const err = await fetchRequestItems("s", "l").catch((e: Error) => e);
    expect(err).toBeInstanceOf(RequestListError);
    expect((err as Error).message).not.toMatch(/evil|https?:/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("nextLink 가 끝나지 않으면 쪽 수 상한에서 RequestListError", async () => {
    const fn = vi.fn(async () =>
      json({ value: [], "@odata.nextLink": NEXT }),
    );
    vi.stubGlobal("fetch", fn);
    await expect(fetchRequestItems("s", "l")).rejects.toBeInstanceOf(
      RequestListError,
    );
    expect(fn.mock.calls.length).toBeLessThanOrEqual(51);
  });

  it("HTTP 403 이면 RequestListError, 메시지에 403", async () => {
    installFetch([json({}, 403)]);
    const err = await fetchRequestItems("s", "l").catch((e: Error) => e);
    expect(err).toBeInstanceOf(RequestListError);
    expect((err as Error).message).toContain("403");
    expect((err as Error).message).not.toMatch(/test-token|raw-body/);
  });

  it("createdBy.user.email 이 빈 문자열이면 applicantEmail null", async () => {
    installFetch([
      json({
        value: [
          row("1", {
            createdBy: { user: { displayName: "홍길동", email: "" } },
          }),
        ],
      }),
    ]);
    const r = await fetchRequestItems("s", "l");
    expect(r.items[0].applicantEmail).toBeNull();
    expect(r.items[0].applicantName).toBe("홍길동");
  });
});
