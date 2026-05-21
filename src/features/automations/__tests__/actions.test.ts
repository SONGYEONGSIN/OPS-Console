import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/permission", () => ({
  requireAdmin: vi.fn(async () => ({ permission: "admin" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../registry", () => ({ getJob: vi.fn() }));
vi.mock("../queries", () => ({
  getJobLastRunAt: vi.fn(async () => null),
  computeCooldownRemaining: vi.fn(() => 0),
}));

import { runAutomationAction } from "../actions";
import { getJob } from "../registry";
import { computeCooldownRemaining } from "../queries";
import { revalidatePath } from "next/cache";

const mockGetJob = getJob as unknown as ReturnType<typeof vi.fn>;
const mockCooldown = computeCooldownRemaining as unknown as ReturnType<typeof vi.fn>;

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
});
