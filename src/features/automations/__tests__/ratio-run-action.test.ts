import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAdminMock, recordRunMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(async () => ({ permission: "admin" })),
  recordRunMock: vi.fn(async () => {}),
}));

vi.mock("@/features/auth/permission", () => ({
  requireAdmin: requireAdminMock,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../registry", () => ({ getJob: vi.fn() }));
vi.mock("../queries", () => ({
  getJobLastRunAt: vi.fn(async () => null),
  computeCooldownRemaining: vi.fn(() => 0),
  getJobEnabled: vi.fn(async () => false),
}));
vi.mock("../run-recorder", () => ({ recordAutomationRun: recordRunMock }));
vi.mock("../jobs/team-briefing", () => ({ publishStagedDraft: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/features/ratio-audit/queries", () => ({
  listRatioAuditTargets: vi.fn(),
}));
vi.mock("@/features/ratio-audit/audit-requests/enqueue", () => ({
  enqueueLocalAuditRequest: vi.fn(),
  AUTOMATION_REQUESTER: "automation",
}));

import { runRatioAuditAction } from "../actions";
import { getJob } from "../registry";
import { computeCooldownRemaining, getJobEnabled } from "../queries";
import { listRatioAuditTargets } from "@/features/ratio-audit/queries";
import { enqueueLocalAuditRequest } from "@/features/ratio-audit/audit-requests/enqueue";
import { revalidatePath } from "next/cache";

const mockGetJob = getJob as unknown as ReturnType<typeof vi.fn>;
const mockCooldown = vi.mocked(computeCooldownRemaining);
const mockEnabled = vi.mocked(getJobEnabled);

function fd(input: {
  jobId: string;
  force?: string;
  univ?: string[];
  recruit?: string[];
}) {
  const f = new FormData();
  f.set("jobId", input.jobId);
  if (input.force !== undefined) f.set("force", input.force);
  for (const v of input.univ ?? []) f.append("univ", v);
  for (const v of input.recruit ?? []) f.append("recruit", v);
  return f;
}

function fakeJob(id: string) {
  return {
    id,
    label: "x",
    description: "d",
    scheduleInfo: "s",
    cooldownMinutes: 60,
    run: vi.fn(),
  };
}

const target = (serviceId: number) => ({
  serviceId,
  universityName: "테스트대학교A",
  serviceName: "2027학년도 수시모집",
  operatorName: "운영자A",
});
const T1 = target(9001001);
const T2 = target(9001002);
const T3 = target(9001003);

const OK_FORM = { jobId: "ratio-audit", univ: ["2년제"], recruit: ["정시"] };

describe("runRatioAuditAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJob.mockImplementation((id: string) => fakeJob(id));
    mockCooldown.mockReturnValue(0);
    mockEnabled.mockResolvedValue(false);
  });

  it("대학구분이 비면 거절 — 대상 조회·적재 안 함", async () => {
    const r = await runRatioAuditAction(
      undefined,
      fd({ jobId: "ratio-audit", recruit: ["수시"] }),
    );
    expect(r).toEqual({ ok: false, message: "대학구분을 하나 이상 고르세요." });
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
  });

  it("모집구분이 비면 거절", async () => {
    const r = await runRatioAuditAction(
      undefined,
      fd({ jobId: "ratio-audit", univ: ["4년제"] }),
    );
    expect(r).toEqual({ ok: false, message: "모집구분을 하나 이상 고르세요." });
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
  });

  it("허용값 밖은 거절", async () => {
    const r = await runRatioAuditAction(
      undefined,
      fd({ jobId: "ratio-audit", univ: ["대학원"], recruit: ["수시"] }),
    );
    expect(r?.ok).toBe(false);
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
  });

  it("조건 창 잡이 아니면 거절", async () => {
    const r = await runRatioAuditAction(
      undefined,
      fd({ jobId: "insights-collect", univ: ["4년제"], recruit: ["수시"] }),
    );
    expect(r).toEqual({
      ok: false,
      message: "조건 창을 쓰는 자동화가 아닙니다.",
    });
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
  });

  it("자동 실행 ON 이면 일반 실행과 같은 문구로 거절", async () => {
    mockEnabled.mockResolvedValue(true);
    const r = await runRatioAuditAction(undefined, fd(OK_FORM));
    expect(r?.ok).toBe(false);
    expect(r?.message).toContain("자동 실행 중");
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
  });

  it("쿨다운 중이면 force 없이는 거절, force=1 이면 진행", async () => {
    mockCooldown.mockReturnValue(15);
    const blocked = await runRatioAuditAction(undefined, fd(OK_FORM));
    expect(blocked?.ok).toBe(false);
    expect(blocked?.message).toContain("15분");
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();

    vi.mocked(listRatioAuditTargets).mockResolvedValue([T1]);
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: true,
      message: "[접수] 요청했습니다.",
    });
    const forced = await runRatioAuditAction(
      undefined,
      fd({ ...OK_FORM, force: "1" }),
    );
    expect(forced?.ok).toBe(true);
    expect(enqueueLocalAuditRequest).toHaveBeenCalledOnce();
  });

  it("대상 0건이면 적재·기록하지 않는다", async () => {
    vi.mocked(listRatioAuditTargets).mockResolvedValue([]);
    const r = await runRatioAuditAction(undefined, fd(OK_FORM));
    expect(r).toEqual({
      ok: false,
      message:
        "조건에 맞는 점검 대상이 없어 요청하지 않았습니다 — 2년제 · 정시 · 접수 마감 전",
    });
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
    expect(recordRunMock).not.toHaveBeenCalled();
  });

  it("대상 조회가 던지면 적재 안 함", async () => {
    vi.mocked(listRatioAuditTargets).mockRejectedValue(new Error("db down"));
    const r = await runRatioAuditAction(undefined, fd(OK_FORM));
    expect(r).toEqual({
      ok: false,
      message: "점검 대상을 읽지 못했습니다. 잠시 뒤 다시 시도하세요.",
    });
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
    expect(recordRunMock).not.toHaveBeenCalled();
  });

  it("종류와 조건을 함께 적재 — 같은 시각으로 세고 적재한다", async () => {
    vi.mocked(listRatioAuditTargets).mockResolvedValue([T1, T2, T3]);
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: true,
      message: "[접수] 회사 PC 폴러에 요청했습니다.",
    });
    const r = await runRatioAuditAction(
      undefined,
      fd({
        jobId: "ratio-page-check",
        univ: ["2년제", "4년제", "2년제"],
        recruit: ["수시"],
      }),
    );
    const F = { univ: ["4년제", "2년제"], recruit: ["수시"] };
    expect(enqueueLocalAuditRequest).toHaveBeenCalledWith(
      "automation",
      expect.any(Date),
      "page",
      F,
    );
    expect(vi.mocked(listRatioAuditTargets).mock.calls[0]).toEqual([
      F,
      vi.mocked(enqueueLocalAuditRequest).mock.calls[0][1],
    ]);
    expect(r?.message).toBe(
      "[접수] 회사 PC 폴러에 요청했습니다. 조건: 4년제, 2년제 · 수시 · 접수 마감 전 — 대상 3건",
    );
    expect(recordRunMock).toHaveBeenCalledWith(
      "ratio-page-check",
      expect.objectContaining({ ok: true, message: r?.message }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/automations");
  });

  it("큐 점유 거절은 기록하지 않고 메시지만 돌려준다", async () => {
    vi.mocked(listRatioAuditTargets).mockResolvedValue([T1]);
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: false,
      busy: true,
      message: "이미 대기/진행 중인 점검이 있습니다.",
    });
    const r = await runRatioAuditAction(undefined, fd(OK_FORM));
    expect(r).toEqual({
      ok: false,
      message: "이미 대기/진행 중인 점검이 있습니다.",
    });
    expect(recordRunMock).not.toHaveBeenCalled();
  });

  it("DB 오류로 적재 실패면 실패로 기록", async () => {
    vi.mocked(listRatioAuditTargets).mockResolvedValue([T1]);
    vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({
      ok: false,
      message: "connection refused",
    });
    const r = await runRatioAuditAction(undefined, fd(OK_FORM));
    expect(r).toEqual({ ok: false, message: "connection refused" });
    expect(recordRunMock).toHaveBeenCalledTimes(1);
    expect(recordRunMock).toHaveBeenCalledWith(
      "ratio-audit",
      expect.objectContaining({ ok: false, message: "connection refused" }),
    );
  });

  it("관리자 확인을 먼저 한다", async () => {
    requireAdminMock.mockRejectedValueOnce(new Error("forbidden"));
    await expect(runRatioAuditAction(undefined, fd(OK_FORM))).rejects.toThrow(
      "forbidden",
    );
    expect(mockGetJob).not.toHaveBeenCalled();
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
    expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
    expect(recordRunMock).not.toHaveBeenCalled();
  });
});
