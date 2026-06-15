import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockGetJob, mockGetJobEnabled, mockRun, mockRecord } = vi.hoisted(
  () => ({
    mockGetJob: vi.fn(),
    mockGetJobEnabled: vi.fn(),
    mockRun: vi.fn(),
    mockRecord: vi.fn(async () => {}),
  }),
);

vi.mock("@/features/automations/registry", () => ({
  getJob: mockGetJob,
}));
vi.mock("@/features/automations/queries", () => ({
  getJobEnabled: mockGetJobEnabled,
}));
vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: mockRecord,
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

  it("enabled=true → job.run() 호출 + 결과 그대로 반환 + 실행 기록", async () => {
    mockGetJobEnabled.mockResolvedValue(true);
    const res = await POST(
      req({ secret: "s3cr3t", jobId: "receivables-mail-operator" }),
    );
    expect(res.status).toBe(200);
    expect(mockRun).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toBe("done");
    expect(mockRecord).toHaveBeenCalledWith(
      "receivables-mail-operator",
      expect.objectContaining({ ok: true, message: "done" }),
    );
  });

  it("enabled=false → 스킵도 실행 이력에 기록(skipped:true)", async () => {
    mockGetJobEnabled.mockResolvedValue(false);
    await POST(req({ secret: "s3cr3t", jobId: "receivables-mail-operator" }));
    expect(mockRecord).toHaveBeenCalledWith(
      "receivables-mail-operator",
      expect.objectContaining({ skipped: true }),
    );
  });

  it("job.run() 예외 → 500 + 실패(ok:false) 기록", async () => {
    mockGetJobEnabled.mockResolvedValue(true);
    mockRun.mockRejectedValueOnce(new Error("시트 미연결"));
    const res = await POST(
      req({ secret: "s3cr3t", jobId: "receivables-mail-operator" }),
    );
    expect(res.status).toBe(500);
    expect(mockRecord).toHaveBeenCalledWith(
      "receivables-mail-operator",
      expect.objectContaining({ ok: false, message: "시트 미연결" }),
    );
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
