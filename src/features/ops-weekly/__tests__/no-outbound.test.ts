import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// 메일·Teams·Graph 발송은 A2 의 `notify/deliver.ts` 한 곳에서만 — 소스 원문 가드.
// 화면·action 이 직접 보내기 시작하면 중복 방지(이력·슬롯)와 시험 실행(DRY_RUN)을 건너뛴다.
// (@types/node 에 globSync 타입이 없어 readdirSync 재귀로 훑는다.)
const FEATURE_DIR = "src/features/ops-weekly";
const APP_DIR = "src/app/dashboard/ops-weekly";
const SELF = "__tests__/no-outbound.test.ts";
const SENDER = `${FEATURE_DIR}/notify/deliver.ts`;
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

  it("@/lib/microsoft 는 notify/deliver.ts 에서만 import 한다", () => {
    const files = [...sourcesUnder(FEATURE_DIR), ...sourcesUnder(APP_DIR)];
    expect(files.map(norm)).toContain(SENDER);
    for (const f of files) {
      if (norm(f).endsWith(SELF) || norm(f) === SENDER) continue;
      if (norm(f).includes("/__tests__/")) continue;
      expect(readFileSync(f, "utf8"), f).not.toMatch(/@\/lib\/microsoft/);
    }
  });
});
