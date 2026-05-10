import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ marker: "mocked-admin" })),
}));

describe("admin client", () => {
  it("env 누락 시 throw", async () => {
    const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.resetModules();
    const { createAdminClient } = await import("../admin");
    expect(() => createAdminClient()).toThrow(/환경 변수/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  });

  it("env 있으면 supabase client 반환", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    vi.resetModules();
    const { createAdminClient } = await import("../admin");
    const client = createAdminClient();
    expect(client).toEqual({ marker: "mocked-admin" });
  });
});
