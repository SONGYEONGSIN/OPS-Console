import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 스크립트의 **전체 예산**은 폴러 실행 제한보다 작아야 한다.
 *
 * 크면 작업 스케줄러가 먼저 잘라서, 스크립트는 실패를 보고할 기회조차 없이
 * 죽는다 — 요청은 running 인 채로 남고 화면은 영영 '진행 중'이다.
 *
 * 2026-09-04 그 반대로 겪었다(호출 제한 5분 < 필요 시간). 그 뒤 파일별 생성으로
 * 바꾸면서 **한 번 호출이 아니라 여러 번**이 됐고, 순차로 돌렸더니 9건이 20분을
 * 넘겨 또 잘렸다. 그래서 병렬 + 전체 예산으로 바꿨고, 대조 대상도 전체 예산이다.
 * **두 값이 다른 파일에 있어 한쪽만 고치기 쉽다.**
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

  const num = (re) => Number(re.exec(script)?.[1].replace(/_/g, ""));
  const budgetMs = num(/DEFAULT_BUDGET_MS = ([\d_]+)/);
  const perFileMs = num(/PER_FILE_TIMEOUT_MS = ([\d_]+)/);
  const limitMin = Number(
    /-ExecutionTimeLimit \(New-TimeSpan -Minutes (\d+)\)/.exec(task)?.[1],
  );

  it("값들을 읽어낸다", () => {
    expect(budgetMs, "DEFAULT_BUDGET_MS 를 못 찾았습니다").toBeGreaterThan(0);
    expect(perFileMs, "PER_FILE_TIMEOUT_MS 를 못 찾았습니다").toBeGreaterThan(0);
    expect(limitMin, "작업 실행 제한을 못 찾았습니다").toBeGreaterThan(0);
  });

  /**
   * SPEC_BUDGET_MS 로 늘릴 수 있게 열어 뒀지만 **기본값**은 작아야 한다.
   * 자택은 작업 스케줄러 제한이 없어 늘려 쓰고, 회사 PC 는 기본값으로 돈다.
   */
  it("기본 예산이 실행 제한보다 작다 — 보고할 시간을 남긴다", () => {
    expect(budgetMs).toBeLessThan(limitMin * 60_000);
  });

  /** 한 파일이 예산을 통째로 먹으면 나머지가 통째로 빠진다. */
  it("파일 하나가 전체 예산을 다 쓰지 못한다", () => {
    expect(perFileMs).toBeLessThan(budgetMs);
  });

  /** 20KB 짜리가 수 분 걸린다 — 너무 짧으면 큰 파일이 매번 죽는다. */
  it("파일 하나에 최소 5분은 준다", () => {
    expect(perFileMs).toBeGreaterThanOrEqual(300_000);
  });
});
