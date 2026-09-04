import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * claim 응답에 **kind 가 실려야** 폴러가 무엇을 할지 안다.
 *
 * 빠지면 명세 요청이 조용히 '분석'으로 돈다 — 요청은 done 으로 끝나는데 명세는
 * 안 생기고, 화면은 "만들었는데 안 나온다"가 된다. 운영자는 원인을 알 길이 없다.
 */
describe("analyze-request claim", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/api/dev-controls/analyze-request/route.ts"),
    "utf8",
  );

  it("claim select 에 kind 가 들어 있다", () => {
    const claimSelect = /\.select\(\s*"([^"]*service_id[^"]*)"\s*\)/.exec(src)?.[1];
    expect(claimSelect, "claim 의 select 를 찾지 못했습니다").toBeTruthy();
    expect(claimSelect).toContain("kind");
  });
});

/**
 * 폴러는 kind 로 갈라진다 — 두 스크립트가 하는 일이 전혀 다르다.
 */
describe("폴러 분기", () => {
  const ps1 = readFileSync(
    join(process.cwd(), "scripts/dev-control/poll-local.ps1"),
    "utf8",
  );

  it("spec 이면 명세 스크립트를 부른다", () => {
    expect(ps1).toContain("dev-control-spec.mjs");
  });

  it("kind 가 없으면 분석으로 본다 — 구버전 요청이 멈추면 안 된다", () => {
    expect(ps1).toMatch(/if \(\$claim\.request\.kind\)/);
    expect(ps1).toContain('"analyze"');
  });
});
