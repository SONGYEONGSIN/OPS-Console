import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

describe("getGraphToken", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.AZURE_AD_TENANT_ID = "tenant-123";
    process.env.AZURE_AD_CLIENT_ID = "client-456";
    process.env.AZURE_AD_CLIENT_SECRET = "secret-789";
  });

  it("env 누락 시 throw", async () => {
    delete process.env.AZURE_AD_CLIENT_SECRET;
    const { getGraphToken } = await import("../auth");
    await expect(getGraphToken()).rejects.toThrow(/AZURE/);
  });

  it("토큰 fetch 성공 → access_token 반환 + 캐시", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok-A", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getGraphToken } = await import("../auth");
    const t1 = await getGraphToken();
    const t2 = await getGraphToken();
    expect(t1).toBe("tok-A");
    expect(t2).toBe("tok-A");
    expect(fetchMock).toHaveBeenCalledTimes(1); // 캐시 사용
  });

  it("토큰 응답 실패 → throw", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "invalid_client",
      }),
    );
    const { getGraphToken } = await import("../auth");
    await expect(getGraphToken()).rejects.toThrow(/401/);
  });
});
