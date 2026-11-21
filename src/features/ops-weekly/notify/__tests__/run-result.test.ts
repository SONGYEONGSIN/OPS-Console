import { describe, expect, it } from "vitest";
import { toRunResult } from "../run-result";

const T = { sent: 3, failed: 0, dryRun: 0, skipped: 1, errors: [] };

describe("toRunResult — 자동화 실행 기록 한 줄", () => {
  it("보냄·이미 보냄을 적고, 실패가 없으면 ok", () => {
    expect(toRunResult("작성 요청", { kind: "sent", tally: T })).toEqual({
      ok: true,
      message: "작성 요청 — 보냄 3 · 이미 보냄 1",
      details: { sent: 3, failed: 0, dryRun: 0, skipped: 1 },
    });
  });

  it("실패가 있으면 ok=false, 첫 오류를 붙인다", () => {
    const r = toRunResult("미제출 알림", {
      kind: "sent",
      tally: { ...T, failed: 1, errors: ["a@x: 403", "b@x: 500"] },
    });
    expect(r.ok).toBe(false);
    expect(r.message).toBe("미제출 알림 — 보냄 3 · 이미 보냄 1 · 실패 1 (a@x: 403)");
  });

  it("시험 실행·Teams 미설정을 드러낸다", () => {
    const r = toRunResult("작성 요청", {
      kind: "sent",
      tally: { ...T, sent: 0, skipped: 0, dryRun: 2 },
      teams: "unset",
    });
    expect(r.message).toBe("작성 요청 — 시험 실행 2 · Teams 채팅 id 미설정(메일만)");
  });

  it("스킵은 스킵, 실패는 실패", () => {
    expect(toRunResult("미제출 알림", { kind: "skipped", reason: "모두 제출했습니다" })).toEqual({
      ok: true,
      skipped: true,
      message: "미제출 알림 — 모두 제출했습니다",
    });
    expect(toRunResult("작성 요청", { kind: "failed", reason: "명단 없음" })).toEqual({
      ok: false,
      message: "작성 요청 — 명단 없음",
    });
  });
});
