import { describe, it, expect } from "vitest";
import { AUTOMATION_JOBS, getJob } from "../registry";

describe("automation registry", () => {
  it("insights-collect 잡이 등록되어 있다", () => {
    const job = getJob("insights-collect");
    expect(job).toBeDefined();
    expect(job?.label).toBeTruthy();
    expect(job?.cooldownMinutes).toBe(60);
    expect(typeof job?.run).toBe("function");
  });

  it("service-notice-mail 잡이 등록되어 있다", () => {
    const job = getJob("service-notice-mail");
    expect(job).toBeDefined();
    expect(typeof job?.run).toBe("function");
  });

  it("manual-review-reminder 는 월 단위 서버리스 잡", () => {
    const j = getJob("manual-review-reminder");
    expect(j?.cadence).toBe("monthly");
    expect(j?.localOnly).toBeFalsy();
    expect(j?.manualOnly).toBeFalsy();
  });

  it("mailbox-ingest는 localOnly 잡이고 run은 안내 메시지(ok:false)를 반환한다", async () => {
    const job = getJob("mailbox-ingest");
    expect(job).toBeDefined();
    expect(job?.localOnly).toBe(true);
    const result = await job!.run();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/로컬|Mac/i);
  });

  it("notice-teams-share 잡이 서버리스(비 localOnly)로 등록되어 있다", () => {
    const job = getJob("notice-teams-share");
    expect(job).toBeDefined();
    expect(job?.localOnly).toBeFalsy();
    expect(typeof job?.run).toBe("function");
  });

  it("sms-status-refresh 는 수동 전용", () => {
    const j = getJob("sms-status-refresh");
    expect(j?.cadence).toBe("manual");
    expect(j?.manualOnly).toBe(true);
  });

  it("조건 창은 경쟁률 두 잡만", () => {
    expect(
      AUTOMATION_JOBS.filter((j) => j.conditionForm)
        .map((j) => j.id)
        .sort(),
    ).toEqual(["ratio-audit", "ratio-page-check"]);
    expect(getJob("ratio-audit")?.conditionForm).toBe("ratio-audit");
    expect(getJob("ratio-page-check")?.conditionForm).toBe("ratio-audit");
  });

  it("설명이 조건 창을 말한다", () => {
    for (const id of ["ratio-audit", "ratio-page-check"]) {
      expect(getJob(id)?.description).toContain("실행 조건 창");
    }
  });

  it("모든 잡은 고유 id를 가진다", () => {
    const ids = AUTOMATION_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ops-weekly-dev-status 는 수요일 로컬 전용 weekly 잡", async () => {
    const job = getJob("ops-weekly-dev-status");
    expect(job).toMatchObject({
      label: "주간보고 개발 구분 수집",
      scheduleInfo: "매주 수요일 09:30 (회사 PC 로컬 예약 작업)",
      cadence: "weekly",
      localOnly: true,
      cooldownMinutes: 60,
    });
    expect(await job!.run()).toEqual({
      ok: false,
      message: "로컬 전용 — 회사 PC 작업 스케줄러가 실행합니다.",
    });
  });

  it("주간업무보고 발송 잡 둘 — 서버리스 weekly(cron-job.org)", () => {
    expect(getJob("ops-weekly-request")).toMatchObject({
      label: "주간업무보고 작성 요청",
      scheduleInfo: "매주 수요일 10:00 (cron-job.org)",
      cadence: "weekly",
    });
    expect(getJob("ops-weekly-remind")).toMatchObject({
      label: "주간업무보고 미제출 알림",
      scheduleInfo: "매주 목요일 12:00·17:00 (cron-job.org)",
      cadence: "weekly",
    });
    expect(getJob("ops-weekly-request")?.localOnly).toBeUndefined();
  });

  it("없는 id는 undefined", () => {
    expect(getJob("nope")).toBeUndefined();
  });
});
