import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getDelegatedGraphToken } from "../delegated-token";

function makeAdmin(row: { provider_refresh_token: string } | null) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const maybeSingle = vi.fn().mockResolvedValue({ data: row });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select, update }));
  return { client: { from }, update, updateEq };
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.AZURE_AD_TENANT_ID = "tenant";
  process.env.AZURE_AD_CLIENT_ID = "cid";
  process.env.AZURE_AD_CLIENT_SECRET = "sec";
});

describe("getDelegatedGraphToken", () => {
  it("저장된 토큰 없으면 null, 토큰 엔드포인트 호출 안 함", async () => {
    const { client } = makeAdmin(null);
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const r = await getDelegatedGraphToken("a@x.com");
    expect(r).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refresh_token으로 access_token 발급 + 회전된 refresh_token 저장", async () => {
    const { client, update, updateEq } = makeAdmin({ provider_refresh_token: "OLD" });
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "AT", refresh_token: "NEW" }), { status: 200 }),
    );
    const r = await getDelegatedGraphToken("a@x.com");
    expect(r).toBe("AT");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ provider_refresh_token: "NEW" }),
    );
    expect(updateEq).toHaveBeenCalled();
  });

  it("토큰 엔드포인트 실패 → null", async () => {
    const { client } = makeAdmin({ provider_refresh_token: "OLD" });
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(client);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("bad", { status: 400 }));
    const r = await getDelegatedGraphToken("a@x.com");
    expect(r).toBeNull();
  });
});
