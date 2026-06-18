import type { EntertestCheck, EntertestSummary } from "./schemas";

/** 케이스별 체크 결과 → 요약. total은 전체, pass/fail은 해당 상태 수(skip 제외). */
export function summarizeChecks(checks: EntertestCheck[]): EntertestSummary {
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    total: checks.length,
  };
}
