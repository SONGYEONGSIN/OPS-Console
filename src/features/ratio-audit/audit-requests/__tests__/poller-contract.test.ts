import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 폴러(ps1)와 audit.py 가 요청 id 를 같은 이름으로 주고받는지 원문으로 대조한다.
 *
 * 둘은 다른 언어·다른 파일이라 한쪽만 고치기 쉽고, 어긋나도 에러가 나지 않는다 —
 * audit.py 가 요청 id 를 못 받으면 로그인 전에 멈추는데, 그것이 폴러 쪽 이름 오타 탓인지
 * 알아내기가 어렵다. 주석 처리로 정의를 지운 채 초록이 되지 않도록 주석부터 걷어낸다.
 */
describe("폴러 ↔ audit.py 요청 id 계약", () => {
  const ROOT = process.cwd();
  const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

  const ps1 = read("scripts/moa-ratio/poll-local.ps1")
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
  const py = read("scripts/moa-ratio/audit.py")
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, ""))
    .join("\n");

  it("폴러는 claim 한 id 를 요청 id 로 넘긴다", () => {
    expect(ps1).toMatch(/\$env:RATIO_AUDIT_REQUEST_ID = \$id/);
  });

  it("폴러는 조건 값을 다루지 않는다", () => {
    expect(ps1).not.toMatch(/filters|univ|recruit/i);
  });

  it("audit.py 가 같은 이름으로 읽고 대상 API 에 requestId 로 보낸다", () => {
    expect(py).toContain('REQUEST_ID_ENV = "RATIO_AUDIT_REQUEST_ID"');
    expect(py).toMatch(/params=\{"requestId": request_id\}/);
  });

  it("Moa 시작일 필터를 쓰지 않는다 — 기간은 서버가 정한다", () => {
    expect(py).not.toMatch(/listfilter|filter_by_start_date|september_first/);
    expect(existsSync(join(ROOT, "scripts/moa-ratio/listfilter.py"))).toBe(false);
  });
});
