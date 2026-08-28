import { describe, it, expect } from "vitest";
import { runLogKind, QUEUED_MARK } from "../run-log-kind";

/**
 * 실행 로그 한 줄이 **무엇인가** — 접수·성공·실패·스킵.
 *
 * 회사 PC 잡은 큐에 적재만 하고 끝난다. 그 적재가 `성공` 으로 찍혀 있어서,
 * 2026-08-03 실행이 트레이스백으로 죽고 08-28 실행이 20분 제한에 잘렸는데도
 * 화면에는 **성공 세 줄**이 나란히 있었다. 접수는 성공이 아니다.
 *
 * `skipped` 와도 다르다 — 스킵은 "이번엔 할 일이 없어 안 했다" 이고,
 * 접수는 "요청은 했고 결과는 아직" 이다.
 */
const at = "2026-08-28T05:00:00Z";

describe("runLogKind", () => {
  it("접수 표식이 있으면 접수다", () => {
    expect(runLogKind({ ok: true, skipped: false, message: `${QUEUED_MARK} 곧 실행합니다` })).toBe("queued");
  });

  it("접수는 성공으로 보이지 않는다 — 이게 사고의 뿌리였다", () => {
    expect(runLogKind({ ok: true, skipped: false, message: `${QUEUED_MARK} x` })).not.toBe("ok");
  });

  it("실제 결과는 성공", () => {
    expect(runLogKind({ ok: true, skipped: false, message: "검사 108건 · 이상 3건" })).toBe("ok");
  });

  it("실패는 실패", () => {
    expect(runLogKind({ ok: false, skipped: false, message: "exit 1" })).toBe("failed");
  });

  it("스킵이 접수보다 앞선다 — 둘 다면 안 한 것이다", () => {
    expect(runLogKind({ ok: true, skipped: true, message: `${QUEUED_MARK} x` })).toBe("skipped");
  });

  it("실패는 접수 표식이 있어도 실패다 — 적재 자체가 막힌 경우", () => {
    expect(runLogKind({ ok: false, skipped: false, message: `${QUEUED_MARK} x` })).toBe("failed");
  });

  it("메시지가 없어도 던지지 않는다", () => {
    expect(runLogKind({ ok: true, skipped: false, message: "" })).toBe("ok");
    expect(runLogKind({ ok: true, skipped: false })).toBe("ok");
  });

  it("표식은 문장 앞에만 — 답 안에 우연히 섞인 말을 접수로 읽지 않는다", () => {
    expect(runLogKind({ ok: true, skipped: false, message: `이상 3건 ${QUEUED_MARK}` })).toBe("ok");
  });
});
