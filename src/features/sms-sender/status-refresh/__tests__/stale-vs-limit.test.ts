import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STALE_RUNNING_MS } from "../enqueue";

/**
 * 죽었다고 보는 시간(40분)은 **작업 스케줄러 실행 제한(30분)보다 길어야** 한다.
 *
 * 짧으면 정상 실행 중인 것을 죽었다고 마감하고 새 요청을 받아 **둘이 겹쳐 돈다** —
 * 둘 다 Moa 로그인을 타서 인증 문자 두 통이 한 폰에 겹친다. 경쟁률 점검의
 * `stale-vs-timeout.test.ts` 와 같은 이유로, 두 값이 다른 파일(TS·ps1)에 있어 대조한다.
 */
describe("STALE 임계 vs 실행 제한", () => {
  const script = readFileSync(
    join(process.cwd(), "scripts/sms-status-refresh/register-poll-task.ps1"),
    "utf8",
  );
  const limitMin = (): number => {
    const m = /-ExecutionTimeLimit \(New-TimeSpan -Minutes (\d+)\)/.exec(
      script,
    );
    expect(m).not.toBeNull();
    return Number(m![1]);
  };

  it("죽었다고 보는 시간이 실행 제한보다 길다", () => {
    expect(limitMin()).toBeGreaterThan(0);
    expect(STALE_RUNNING_MS / 60_000).toBeGreaterThan(limitMin());
  });

  it("실행 제한은 정상 소요(약 10분)의 두 배 이상", () => {
    expect(limitMin()).toBeGreaterThanOrEqual(20);
  });
});
