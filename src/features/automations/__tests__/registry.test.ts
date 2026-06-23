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

  it("mailbox-ingest는 localOnly 잡이고 run은 안내 메시지(ok:false)를 반환한다", async () => {
    const job = getJob("mailbox-ingest");
    expect(job).toBeDefined();
    expect(job?.localOnly).toBe(true);
    const result = await job!.run();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/로컬|Mac/i);
  });

  it("모든 잡은 고유 id를 가진다", () => {
    const ids = AUTOMATION_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("없는 id는 undefined", () => {
    expect(getJob("nope")).toBeUndefined();
  });
});
