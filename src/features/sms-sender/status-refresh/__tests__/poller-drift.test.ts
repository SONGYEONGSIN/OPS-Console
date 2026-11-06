import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FAILURE_COPY, STEP_LABEL } from "../contract";
import { SMS_ROOT_PATH } from "../../types";
import { SMS_CONSUMERS } from "@/features/sms-codes/schemas";

/**
 * 회사 PC(Python)와 서버(TS)가 같은 이름을 쓰는지 원문으로 대조한다.
 *
 * 둘은 다른 언어·다른 배포라 한쪽만 고치기 쉽다. 어긋나도 에러는 안 난다 —
 * 모르는 코드는 일반 문구로 보여서 '관리자에게 알려 주세요' 가 할 일 문구를 대신할 뿐이다.
 */
describe("폴러 계약 드리프트", () => {
  const py = readFileSync(
    join(process.cwd(), "scripts/sms-status-refresh/contract.py"),
    "utf8",
  );

  function tupleOf(name: string): string[] {
    const m = new RegExp(`${name} = \\(([^)]*)\\)`).exec(py);
    return (m?.[1].match(/"([a-z_]+)"/g) ?? []).map((s) => s.slice(1, -1));
  }

  it("Python 실패 코드는 모두 화면 문구가 있다", () => {
    const codes = tupleOf("FAILURE_CODES");
    expect(codes.length).toBeGreaterThan(0);
    expect(codes.filter((c) => !(c in FAILURE_COPY))).toEqual([]);
  });

  it("Python 단계 id 는 모두 라벨이 있다", () => {
    const ids = tupleOf("STEP_IDS");
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id) => !(id in STEP_LABEL))).toEqual([]);
  });

  it("현황 폴더 경로가 화면과 같다", () => {
    const graph = readFileSync(
      join(process.cwd(), "scripts/sms-status-refresh/graph.py"),
      "utf8",
    );
    const m = /^SMS_ROOT = "([^"]+)"/m.exec(graph);
    expect(m?.[1]).toBe(SMS_ROOT_PATH);
  });

  it("Python 소비자 이름이 서버 enum 에 있다", () => {
    // 없으면 우편함이 400 으로 거절하고, 폴러는 그걸 '우편함 장애'로 읽어 make 로 넘어간다.
    const m = /^SMS_CONSUMER = "([^"]+)"/m.exec(py);
    expect(m).not.toBeNull();
    expect(SMS_CONSUMERS as readonly string[]).toContain(m![1]);
  });
});
