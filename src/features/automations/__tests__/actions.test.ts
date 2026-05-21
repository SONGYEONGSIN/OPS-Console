import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/permission", () => ({
  requireAdmin: vi.fn(async () => ({ permission: "admin" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../registry", () => ({ getJob: vi.fn() }));
vi.mock("../queries", () => ({
  getJobLastRunAt: vi.fn(async () => null),
  computeCooldownRemaining: vi.fn(() => 0),
  getJobEnabled: vi.fn(async () => false),
}));

const upsertMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ upsert: upsertMock }),
  })),
}));

import { runAutomationAction, setAutomationEnabledAction } from "../actions";
import { getJob } from "../registry";
import { computeCooldownRemaining, getJobEnabled } from "../queries";
import { revalidatePath } from "next/cache";

const mockGetJob = getJob as unknown as ReturnType<typeof vi.fn>;
const mockCooldown = computeCooldownRemaining as unknown as ReturnType<typeof vi.fn>;
const mockEnabled = getJobEnabled as unknown as ReturnType<typeof vi.fn>;

function fd(jobId: string, force?: string) {
  const f = new FormData();
  f.set("jobId", jobId);
  if (force !== undefined) f.set("force", force);
  return f;
}

function fakeJob(run: () => Promise<unknown>) {
  return {
    id: "insights-collect",
    label: "x",
    description: "d",
    scheduleInfo: "s",
    cooldownMinutes: 60,
    run,
  };
}

describe("runAutomationAction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("빈 jobId면 zod 에러로 ok:false", async () => {
    const r = await runAutomationAction(undefined, fd(""));
    expect(r?.ok).toBe(false);
  });

  it("등록되지 않은 jobId면 ok:false", async () => {
    mockGetJob.mockReturnValue(undefined);
    const r = await runAutomationAction(undefined, fd("nope"));
    expect(r?.ok).toBe(false);
    expect(r?.message).toContain("알 수 없는");
  });

  it("쿨다운 진행 중 + force 아니면 실행하지 않고 ok:false", async () => {
    const run = vi.fn();
    mockGetJob.mockReturnValue(fakeJob(run));
    mockCooldown.mockReturnValue(15);
    const r = await runAutomationAction(undefined, fd("insights-collect"));
    expect(r?.ok).toBe(false);
    expect(r?.message).toContain("15분");
    expect(run).not.toHaveBeenCalled();
  });

  it("force=1이면 쿨다운 무시하고 실행 + 두 경로 revalidate", async () => {
    const run = vi.fn(async () => ({ ok: true, message: "5건 적재" }));
    mockGetJob.mockReturnValue(fakeJob(run));
    mockCooldown.mockReturnValue(15);
    const r = await runAutomationAction(undefined, fd("insights-collect", "1"));
    expect(run).toHaveBeenCalledOnce();
    expect(r).toEqual({ ok: true, message: "5건 적재" });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/automations");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/ai-insight");
  });

  it("쿨다운 0이면 실행한다", async () => {
    const run = vi.fn(async () => ({ ok: true, message: "ok" }));
    mockGetJob.mockReturnValue(fakeJob(run));
    mockCooldown.mockReturnValue(0);
    const r = await runAutomationAction(undefined, fd("insights-collect"));
    expect(run).toHaveBeenCalledOnce();
    expect(r?.ok).toBe(true);
  });

  it("자동 실행(enabled) 상태면 수동 실행 거부 + run 미호출", async () => {
    const run = vi.fn();
    mockGetJob.mockReturnValue(fakeJob(run));
    mockEnabled.mockResolvedValue(true);
    const r = await runAutomationAction(undefined, fd("insights-collect"));
    expect(r?.ok).toBe(false);
    expect(r?.message).toContain("자동 실행 중");
    expect(run).not.toHaveBeenCalled();
  });
});

describe("setAutomationEnabledAction", () => {
  beforeEach(() => vi.clearAllMocks());
  it("enabled 누락이면 ok:false", async () => {
    const f = new FormData();
    f.set("jobId", "insights-collect");
    const r = await setAutomationEnabledAction(undefined, f);
    expect(r?.ok).toBe(false);
  });
  it("정상 토글이면 upsert 호출 + ok:true", async () => {
    const f = new FormData();
    f.set("jobId", "insights-collect");
    f.set("enabled", "1");
    mockGetJob.mockReturnValue(
      fakeJob(async () => ({ ok: true, message: "ok" })),
    );
    const r = await setAutomationEnabledAction(undefined, f);
    expect(upsertMock).toHaveBeenCalled();
    expect(r?.ok).toBe(true);
  });
});
