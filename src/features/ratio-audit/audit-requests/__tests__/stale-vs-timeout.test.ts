import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STALE_RUNNING_MS } from "../enqueue";

/**
 * 죽었다고 보는 시간은 **폴러의 실행 제한보다 커야** 한다.
 *
 * 짧으면 정상 실행 중인 것을 죽었다고 보고 새 요청을 받아 **둘이 겹쳐 돈다.**
 * 경쟁률 점검은 Moa 로그인을 타므로 동시 실행을 막아야 한다.
 *
 * 2026-08-28 실행 제한 20분에 걸려 강제 종료됐다(정상 소요 17분). 제한을 늘리면서
 * 이 값도 같이 늘렸는데, **둘이 다른 파일에 있어 한쪽만 고치기 쉽다.** 그래서 대조한다.
 */
describe("STALE 임계 vs 실행 제한", () => {
  const script = readFileSync(
    join(process.cwd(), "scripts/lib/ensure-poller-restart.ps1"),
    "utf8",
  );

  /** `PT1H` · `PT90M` 같은 ISO 기간을 분으로. */
  function minutesOf(iso: string): number {
    const h = /(\d+)H/.exec(iso);
    const m = /(\d+)M/.exec(iso);
    return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  }

  it("스크립트가 실행 제한을 설정한다", () => {
    expect(script).toMatch(/<ExecutionTimeLimit>PT[^<]+<\/ExecutionTimeLimit>/);
  });

  it("죽었다고 보는 시간이 실행 제한보다 길다 — 겹쳐 돌면 안 된다", () => {
    const m = /<ExecutionTimeLimit>(PT[^<]+)<\/ExecutionTimeLimit>/.exec(script);
    const limitMin = minutesOf(m![1]);
    expect(limitMin).toBeGreaterThan(0);
    expect(STALE_RUNNING_MS / 60_000).toBeGreaterThan(limitMin);
  });

  it("정상 소요(17분)보다 실행 제한이 넉넉하다 — 경계에 걸치면 안 된다", () => {
    const m = /<ExecutionTimeLimit>(PT[^<]+)<\/ExecutionTimeLimit>/.exec(script);
    // 20분이던 때 17분짜리 실행이 잘렸다. 최소 두 배는 둔다.
    expect(minutesOf(m![1])).toBeGreaterThanOrEqual(34);
  });
});
