import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetJob, mockGetJobEnabled, mockRun } = vi.hoisted(() => ({
  mockGetJob: vi.fn(),
  mockGetJobEnabled: vi.fn(),
  mockRun: vi.fn(),
}));

vi.mock("@/features/automations/registry", () => ({
  getJob: mockGetJob,
}));
vi.mock("@/features/automations/queries", () => ({
  getJobEnabled: mockGetJobEnabled,
}));

import { POST } from "../route";

function req(opts: { secret?: string; jobId?: string } = {}) {
  const url = opts.jobId
    ? `http://localhost/api/automations/run?jobId=${opts.jobId}`
    : "http://localhost/api/automations/run";
  return new NextRequest(url, {
    method: "POST",
    headers: opts.secret ? { authorization: `Bearer ${opts.secret}` } : {},
  });
}

describe("/api/automations/run — enabled gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    mockGetJob.mockReturnValue({
      id: "receivables-mail-operator",
      label: "운영자 미수채권 알림",
      run: mockRun,
    });
    mockRun.mockResolvedValue({ ok: true, message: "done" });
  });

  it("enabled=false → job.run() 미호출 + ok:true skipped:true 반환 (cron silent skip)", async () => {
    mockGetJobEnabled.mockResolvedValue(false);
    const res = await POST(
      req({ secret: "s3cr3t", jobId: "receivables-mail-operator" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.skipped).toBe(true);
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("enabled=true → job.run() 호출 + 결과 그대로 반환", async () => {
    mockGetJobEnabled.mockResolvedValue(true);
    const res = await POST(
      req({ secret: "s3cr3t", jobId: "receivables-mail-operator" }),
    );
    expect(res.status).toBe(200);
    expect(mockRun).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toBe("done");
  });

  it("시크릿 불일치 → 401 + enabled 조회조차 안 함", async () => {
    const res = await POST(
      req({ secret: "wrong", jobId: "receivables-mail-operator" }),
    );
    expect(res.status).toBe(401);
    expect(mockGetJobEnabled).not.toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it("jobId 미지정 → 400 + enabled 조회 안 함", async () => {
    const res = await POST(req({ secret: "s3cr3t" }));
    expect(res.status).toBe(400);
    expect(mockGetJobEnabled).not.toHaveBeenCalled();
  });

  it("알 수 없는 jobId → 404", async () => {
    mockGetJob.mockReturnValue(undefined);
    const res = await POST(req({ secret: "s3cr3t", jobId: "ghost" }));
    expect(res.status).toBe(404);
    expect(mockGetJobEnabled).not.toHaveBeenCalled();
  });
});
