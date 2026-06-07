import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const BASE_ENV = {
  GITHUB_DISPATCH_TOKEN: "ghp_xxx",
  GITHUB_DISPATCH_REPO: "acme/ops-console",
  GITHUB_DISPATCH_WORKFLOW: "moa-closing-scrape.yml",
} as unknown as NodeJS.ProcessEnv;

describe("dispatchWorkflow", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("필수 env 누락 시 ok:false + 누락 변수명 반환 (fetch 미호출)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchWorkflow } = await import("../dispatch-workflow");

    const r = await dispatchWorkflow({ env: {} as NodeJS.ProcessEnv });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("GITHUB_DISPATCH_TOKEN");
      expect(r.error).toContain("GITHUB_DISPATCH_REPO");
      expect(r.error).toContain("GITHUB_DISPATCH_WORKFLOW");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("repo 형식(owner/repo) 오류 시 ok:false (fetch 미호출)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchWorkflow } = await import("../dispatch-workflow");

    const r = await dispatchWorkflow({
      env: { ...BASE_ENV, GITHUB_DISPATCH_REPO: "no-slash" } as NodeJS.ProcessEnv,
    });

    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("정상 — 204 응답 시 ok:true + 올바른 URL/헤더/본문으로 호출", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchWorkflow } = await import("../dispatch-workflow");

    const r = await dispatchWorkflow({ env: BASE_ENV });

    expect(r.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.github.com/repos/acme/ops-console/actions/workflows/moa-closing-scrape.yml/dispatches",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer ghp_xxx");
    expect(init.headers.Accept).toBe("application/vnd.github+json");
    expect(JSON.parse(init.body)).toEqual({ ref: "main" });
  });

  it("ref 옵션 지정 시 본문 ref 반영", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchWorkflow } = await import("../dispatch-workflow");

    await dispatchWorkflow({ env: BASE_ENV, ref: "develop" });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ ref: "develop" });
  });

  it("비-204 응답 시 ok:false + status 포함", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ status: 404, text: async () => "Not Found" });
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchWorkflow } = await import("../dispatch-workflow");

    const r = await dispatchWorkflow({ env: BASE_ENV });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("404");
  });

  it("fetch throw 시 ok:false (예외를 결과로 변환)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);
    const { dispatchWorkflow } = await import("../dispatch-workflow");

    const r = await dispatchWorkflow({ env: BASE_ENV });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("network down");
  });
});
