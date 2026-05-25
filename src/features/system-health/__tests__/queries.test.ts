import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/microsoft/auth", () => ({
  getGraphToken: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { getGraphToken } from "@/lib/microsoft/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSystemHealth } from "../queries";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  vi.resetAllMocks();
  process.env = { ...ORIG_ENV };
  process.env.SHAREPOINT_DRIVE_ID = "drive-1";
});

function mockAdminClient(opts: {
  receivables?: { sent: number; failed: number };
  feedback?: { sent: number; failed: number };
  backup?: { sent: number; failed: number };
  /** Supabase ping용 — operators select 결과 (null이면 에러) */
  operatorsError?: string | null;
  /** insight_videos 24h count + 최신 collected_at */
  insightVideos?: { count24h: number; latestCollectedAt: string | null };
}) {
  const counts: Record<string, { sent: number; failed: number }> = {
    receivables_mail_sends: opts.receivables ?? { sent: 0, failed: 0 },
    feedback_mail_sends: opts.feedback ?? { sent: 0, failed: 0 },
    backup_request_mail_sends: opts.backup ?? { sent: 0, failed: 0 },
  };
  const insight = opts.insightVideos ?? { count24h: 0, latestCollectedAt: null };
  const from = vi.fn((table: string) => {
    if (table === "operators") {
      return {
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: opts.operatorsError ? null : [{ id: "x" }],
          error: opts.operatorsError ? { message: opts.operatorsError } : null,
        }),
      };
    }
    if (table === "insight_videos") {
      return {
        select: vi.fn().mockImplementation((_cols: string, options?: { head?: boolean; count?: string }) => {
          if (options?.head) {
            // count 24h
            return {
              gte: vi.fn().mockResolvedValue({
                count: insight.count24h,
                error: null,
              }),
            };
          }
          // order/limit chain for latest collected_at
          return {
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({
              data: insight.latestCollectedAt
                ? [{ collected_at: insight.latestCollectedAt }]
                : [],
              error: null,
            }),
          };
        }),
      };
    }
    // mail_sends 3 테이블
    const c = counts[table];
    return {
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((_col: string, val: string) => {
        return Promise.resolve({
          count: val === "sent" ? c.sent : c.failed,
          error: null,
        });
      }),
    };
  });
  vi.mocked(createAdminClient).mockReturnValue({
    from,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

describe("getSystemHealth — graph", () => {
  it("getGraphToken 성공 → graph.ok=true", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok-A");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "drive-1", name: "ops" }),
      }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.graph.ok).toBe(true);
  });

  it("getGraphToken 실패 → graph.ok=false + detail에 사유", async () => {
    vi.mocked(getGraphToken).mockRejectedValue(new Error("AZURE_AD 누락"));
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.graph.ok).toBe(false);
    expect(r.graph.detail).toContain("AZURE_AD");
  });
});

describe("getSystemHealth — sharepoint", () => {
  it("/drives/{id} 200 → sharepoint.ok=true", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "drive-1" }),
      }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.sharepoint.ok).toBe(true);
  });

  it("/drives/{id} 401 → sharepoint.ok=false", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "unauthorized",
      }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.sharepoint.ok).toBe(false);
    expect(r.sharepoint.detail).toMatch(/401|HTTP/);
  });

  it("DRIVE_ID env 누락 → sharepoint.ok=false", async () => {
    delete process.env.SHAREPOINT_DRIVE_ID;
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.sharepoint.ok).toBe(false);
  });
});

describe("getSystemHealth — Microsoft SSO", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://sb.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("external.azure=true → sso.ok=true", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/auth/v1/settings")) {
          return {
            ok: true,
            json: async () => ({ external: { azure: true, email: true } }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.sso.ok).toBe(true);
    expect(r.sso.detail).toMatch(/Azure|활성/);
  });

  it("external.azure=false → sso.ok=false", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/auth/v1/settings")) {
          return {
            ok: true,
            json: async () => ({ external: { azure: false } }),
          };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.sso.ok).toBe(false);
    expect(r.sso.detail).toMatch(/비활성|disabled/i);
  });

  it("/auth/v1/settings 5xx → sso.ok=false", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/auth/v1/settings")) {
          return { ok: false, status: 500, text: async () => "err" };
        }
        return { ok: true, json: async () => ({}) };
      }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.sso.ok).toBe(false);
    expect(r.sso.detail).toMatch(/500|HTTP/);
  });
});

describe("getSystemHealth — Supabase Connection (ping)", () => {
  it("operators select 성공 → supabase.ok=true + ms 표시", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.supabase.ok).toBe(true);
    expect(r.supabase.detail).toMatch(/ms$/);
  });

  it("operators select error → supabase.ok=false", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    mockAdminClient({ operatorsError: "connection refused" });
    const r = await getSystemHealth();
    expect(r.supabase.ok).toBe(false);
    expect(r.supabase.detail).toContain("connection");
  });
});

describe("getSystemHealth — Cron (insight_videos 최신)", () => {
  it("24h 이내 수집 → cron.ok=true + N시간 전", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const latest = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(); // 3h 전
    mockAdminClient({
      insightVideos: { count24h: 5, latestCollectedAt: latest },
    });
    const r = await getSystemHealth();
    expect(r.cron.ok).toBe(true);
    expect(r.cron.detail).toMatch(/3.*시간/);
  });

  it("36h 초과 지연 → cron.ok=false", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    const stale = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    mockAdminClient({
      insightVideos: { count24h: 0, latestCollectedAt: stale },
    });
    const r = await getSystemHealth();
    expect(r.cron.ok).toBe(false);
    expect(r.cron.detail).toMatch(/지연|시간/);
  });

  it("수집 이력 없음 → cron.ok=false", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    mockAdminClient({
      insightVideos: { count24h: 0, latestCollectedAt: null },
    });
    const r = await getSystemHealth();
    expect(r.cron.ok).toBe(false);
  });
});

describe("getSystemHealth — YouTube quota (추정)", () => {
  it("24h 수집 N건 → search.list 호출 추정값 표시", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    mockAdminClient({
      insightVideos: { count24h: 12, latestCollectedAt: new Date().toISOString() },
    });
    const r = await getSystemHealth();
    expect(r.youtube.ok).toBe(true);
    // search.list 1회 = 100 units, 7 키워드 = 700/day
    expect(r.youtube.detail).toMatch(/700|units|quota/i);
  });
});

describe("getSystemHealth — mail stats", () => {
  it("3 테이블 sent/failed 합산 + 성공률 계산", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    mockAdminClient({
      receivables: { sent: 10, failed: 0 },
      feedback: { sent: 5, failed: 1 },
      backup: { sent: 3, failed: 1 },
    });
    const r = await getSystemHealth();
    expect(r.mail.sent24h).toBe(18);
    expect(r.mail.failed24h).toBe(2);
    // 성공률 18 / 20 = 0.9
    expect(r.mail.successRate).toBeCloseTo(0.9, 2);
  });

  it("전혀 발송 안 됨 → successRate=null (분모 0)", async () => {
    vi.mocked(getGraphToken).mockResolvedValue("tok");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
    mockAdminClient({});
    const r = await getSystemHealth();
    expect(r.mail.sent24h).toBe(0);
    expect(r.mail.failed24h).toBe(0);
    expect(r.mail.successRate).toBeNull();
  });
});
