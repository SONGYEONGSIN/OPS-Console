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

  it("모든 잡은 고유 id를 가진다", () => {
    const ids = AUTOMATION_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("없는 id는 undefined", () => {
    expect(getJob("nope")).toBeUndefined();
  });
});
