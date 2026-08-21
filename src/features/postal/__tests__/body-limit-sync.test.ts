import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SERVER_ACTION_BODY_LIMIT } from "../upload-guard";

/**
 * `next.config.ts` 의 상한과 코드의 상수가 같아야 한다.
 *
 * 둘이 어긋나면 **화면은 통과라 하고 서버가 거절하는** 구간이 생긴다. 그 거절은
 * JSON 이 아니라 화면이 못 읽는 응답이라, 사용자에게는 아무 말도 안 나오고 콘솔에만
 * `unexpected response` 가 찍힌다 — 무엇이 잘못됐는지 알 길이 없다(2026-08-21).
 *
 * 설정 파일은 타입 검사도 테스트도 안 보는 자리라 여기서 대조한다.
 */
describe("서버 액션 본문 상한", () => {
  it("next.config.ts 와 코드가 같은 값을 쓴다", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const m = /bodySizeLimit:\s*"(\d+)mb"/.exec(config);
    expect(m, "next.config.ts 에 serverActions.bodySizeLimit 이 없습니다").not.toBeNull();
    expect(Number(m![1]) * 1024 * 1024).toBe(SERVER_ACTION_BODY_LIMIT);
  });
});
