import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * claude 호출 제한은 **폴러 실행 제한보다 작아야** 한다.
 *
 * 크면 작업 스케줄러가 먼저 잘라서, 스크립트는 실패를 보고할 기회조차 없이
 * 죽는다 — 요청은 running 인 채로 남고 화면은 영영 '진행 중'이다.
 *
 * 2026-09-04 그 반대로 겪었다. 제한이 5분이라 파일 9건(87,355자)짜리가
 * ETIMEDOUT 으로 죽었다 — 폴러는 20분을 줬는데 스크립트가 스스로 포기했다.
 * **두 값이 다른 파일에 있어 한쪽만 고치기 쉽다.** 그래서 대조한다.
 */
describe("claude 제한 vs 폴러 실행 제한", () => {
  const script = readFileSync(
    join(process.cwd(), "scripts/dev-control-spec.mjs"),
    "utf8",
  );
  const task = readFileSync(
    join(process.cwd(), "scripts/dev-control/register-poll-task.ps1"),
    "utf8",
  );

  const timeoutMs = Number(
    /timeout:\s*([\d_]+)/.exec(script)?.[1].replace(/_/g, ""),
  );
  const limitMin = Number(
    /-ExecutionTimeLimit \(New-TimeSpan -Minutes (\d+)\)/.exec(task)?.[1],
  );

  it("두 값을 읽어낸다", () => {
    expect(timeoutMs, "스크립트 timeout 을 못 찾았습니다").toBeGreaterThan(0);
    expect(limitMin, "작업 실행 제한을 못 찾았습니다").toBeGreaterThan(0);
  });

  it("claude 제한이 실행 제한보다 작다 — 보고할 시간을 남긴다", () => {
    expect(timeoutMs).toBeLessThan(limitMin * 60_000);
  });

  it("가장 큰 서비스도 담을 만큼 넉넉하다 — 87,355자가 5분에 죽었다", () => {
    expect(timeoutMs).toBeGreaterThanOrEqual(900_000);
  });
});
