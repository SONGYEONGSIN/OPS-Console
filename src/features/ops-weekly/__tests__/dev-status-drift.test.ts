import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SMS_CONSUMERS } from "@/features/sms-codes/schemas";

/**
 * 회사 PC 수집기(Python)와 서버 우편함 enum 이 같은 소비자 이름을 쓰는지 원문으로 대조한다.
 * 둘은 다른 언어·다른 배포라 한쪽만 고치기 쉽고, 어긋나도 에러가 나지 않는다.
 */
describe("개발 구분 수집기 계약 드리프트", () => {
  it("python 소비자 상수가 서버 enum 에 있다", () => {
    // 없으면 우편함이 400 → python 은 InboxUnavailable 로 읽어 조용히 make 로 넘어간다.
    const py = readFileSync(
      join(process.cwd(), "scripts/moa-dev-status/collect.py"),
      "utf8",
    );
    const m = /^SMS_CONSUMER = "([^"]+)"/m.exec(py);
    expect(m?.[1]).toBe("ops-weekly-dev-status");
    expect(SMS_CONSUMERS as readonly string[]).toContain(m![1]);
  });
});
