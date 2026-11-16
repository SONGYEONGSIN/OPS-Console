import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// A1 은 메일·Teams·Graph 를 보내지 않는다 — 소스 원문 가드. app 폴더는 Task 11 부터 생긴다.
// (@types/node 에 globSync 타입이 없어 readdirSync 재귀로 훑는다.)
const FEATURE_DIR = "src/features/ops-weekly";
const APP_DIR = "src/app/dashboard/ops-weekly";
const SELF = "__tests__/no-outbound.test.ts";
const norm = (f: string) => f.replaceAll("\\", "/");

/** 폴더 아래 .ts·.tsx 전부(없는 폴더는 빈 목록). */
function sourcesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map(norm)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f));
}

describe("ops-weekly 외부 발송 금지", () => {
  it("features 폴더를 실제로 훑는다(훑기가 헛돌면 가짜 초록)", () => {
    const files = sourcesUnder(FEATURE_DIR).map(norm);
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(`${FEATURE_DIR}/events.ts`);
    expect(files).toContain(`${FEATURE_DIR}/workflow-actions.ts`);
  });

  it("ops-weekly 는 @/lib/microsoft 를 import 하지 않는다", () => {
    const files = [...sourcesUnder(FEATURE_DIR), ...sourcesUnder(APP_DIR)];
    for (const f of files) {
      if (norm(f).endsWith(SELF)) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/@\/lib\/microsoft/);
    }
  });
});
