import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 회사 PC 폴러의 **격리**를 파일 원문으로 지킨다(설계 §6.4 · 어시스턴트 선례).
 *
 * 실측(2026-08-16, 어시스턴트): `allowedTools` 만 주고 `permissionMode` 를
 * `bypassPermissions` 로 두면 그 PC 의 MCP 도구가 **그대로 열려 있다** — "구글
 * 캘린더 조회해줘" 한 줄로 개인 캘린더를 읽어냈다. `strictMcpConfig`·`mcpServers`·
 * `settingSources: []` 셋이 있어야 끊긴다.
 *
 * 배정 판정은 **도구가 하나도 필요 없다.** 서버가 표를 다 조립해 프롬프트로 주고,
 * 답은 JSON 한 덩이다. 그래서 여기서는 도구를 아예 안 연다 — 열 이유가 없는 것을
 * 열어 두면 나중에 프롬프트 한 줄이 그 PC 의 파일·메일에 닿는 경로가 된다.
 *
 * 스크립트라 vitest 가 실행하지 않는다. 그래서 **원문을 읽어 검사한다**(레포의
 * `proxy-cron-paths.test.ts` 와 같은 방식).
 */
const poller = readFileSync(
  join(process.cwd(), "scripts/assignments/propose-local.mjs"),
  "utf8",
);

describe("판정 폴러 — 격리", () => {
  it("이 PC 의 MCP 설정을 상속하지 않는다", () => {
    expect(poller).toContain("strictMcpConfig: true");
  });

  it("사용자·프로젝트 settings 를 읽지 않는다", () => {
    expect(poller).toContain("settingSources: []");
  });

  it("MCP 서버를 하나도 붙이지 않는다 — 판정에 도구가 필요 없다", () => {
    expect(poller).toContain("mcpServers: {}");
  });

  it("도구를 명시적으로 막는다 — allowedTools 만으로는 안 막힌다", () => {
    expect(poller).toContain("disallowedTools");
    for (const tool of ["Bash", "Write", "Edit", "WebFetch", "Read"]) {
      expect(poller).toContain(`"${tool}"`);
    }
  });

  it("프롬프트를 스스로 만들지 않는다 — 서버가 준 것을 그대로 넘긴다", () => {
    // 여기서 조립하면 표현을 고칠 때마다 회사 PC 를 만져야 하고, 그 PC 의 프롬프트가
    // 낡은 채로 판정이 돈다(§6.3 · 어시스턴트 선례).
    expect(poller).not.toMatch(/운영자별 실측|지켜야 할 것/);
    expect(poller).toMatch(/claimed\.prompt|request\.prompt|\bprompt\b/);
  });

  it("검산도 하지 않는다 — 게이트는 서버에만 있다", () => {
    expect(poller).not.toMatch(/runGates|ASSIGNMENT_LIMITS|Σdev/);
  });

  it("시간 제한을 둔다 — 안 끝나는 판정이 큐를 잠근다", () => {
    expect(poller).toMatch(/JUDGE_TIMEOUT_MS/);
  });

  it("실패도 보고한다 — 이 회신이 유일한 창구다", () => {
    // 보고 없이 죽으면 running 이 남아 STALE 까지 큐가 잠기고, 화면엔 큐 적재의
    // '성공' 만 떠 있다(2026-08-19 경쟁률 점검).
    expect(poller).toMatch(/ok:\s*false/);
  });
});
