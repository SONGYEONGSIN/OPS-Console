import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * 타임아웃 타이머는 **이벤트 루프를 잡아야** 한다.
 *
 * 2026-08-24 09:54 회사 PC 가 절전에 들어갔다. 진행 중이던 fetch 가 좀비가 됐는데
 * `AbortSignal.timeout()` 의 타이머는 **unref 되어 있어**(실측: 3초짜리가 프로세스를
 * 0ms 만 잡는다) 이벤트 루프가 통째로 비었다. Node 는 top-level await 가 pending 인
 * 채 종료했고(exit 13), **어시스턴트가 1시간 동안 멈춰 있었다.**
 *
 * 타이머가 루프를 잡고 있으면 깨어난 뒤 발화해 abort → reject → 재시도로 이어진다.
 * 그래서 "몇 초 뒤 취소되는가"보다 **그동안 프로세스가 살아 있는가**가 진짜 조건이다.
 *
 * 자식 프로세스로 재는 이유: 이벤트 루프가 비는지는 그 프로세스가 죽는지로만 안다.
 */
const LIB = pathToFileURL(
  join(process.cwd(), "scripts/lib/fetch-timeout.mjs"),
).href;

const HEAD = [
  'import { withTimeout } from "' + LIB + '";',
  "const t0 = Date.now();",
  'process.on("exit", () => process.stdout.write(String(Date.now() - t0)));',
].join("\n");

const TMP = join(process.cwd(), "_fetch-timeout-probe.mjs");

function keepsAliveMs(lines: string[]): number {
  writeFileSync(TMP, lines.join("\n"), "utf8");
  try {
    const out = execFileSync(process.execPath, [TMP], {
      encoding: "utf8",
      timeout: 15_000,
    });
    return Number(out.trim());
  } finally {
    rmSync(TMP, { force: true });
  }
}

describe("withTimeout — 절전에서 살아남는다", () => {
  it("타임아웃 타이머가 이벤트 루프를 잡는다", () => {
    // 응답하지 않는 상대를 흉내낸다 — 영영 pending 인 promise.
    const held = keepsAliveMs([
      HEAD,
      "const { signal, done } = withTimeout(1200);",
      "new Promise(() => {});",
      'signal.addEventListener("abort", () => done());',
    ]);
    expect(held).toBeGreaterThanOrEqual(1000);
  });

  it("일이 끝나면 타이머를 치운다 — 프로세스가 늘어지지 않는다", () => {
    const held = keepsAliveMs([
      HEAD,
      "const { done } = withTimeout(10000);",
      "done();",
    ]);
    expect(held).toBeLessThan(1000);
  });
});
