import { describe, it, expect } from "vitest";
import { depositFetchFailMessage } from "../deposit-queries";

/**
 * 실패 메시지는 **왜 실패했는지**를 먼저 말해야 한다.
 *
 * 2026-08-31 문구가 "파일 이동/이름변경/권한"만 말해서, 실제로는 Graph 가 잠깐
 * 흔들린 것인데 SharePoint 휴지통까지 뒤지게 만들었다. 상태 코드 한 줄이면
 * 바로 갈렸다.
 */
describe("depositFetchFailMessage", () => {
  it("사유가 있으면 사유를 싣는다", () => {
    const m = depositFetchFailMessage(true, "Graph 503 (재시도 후에도 실패) — service unavailable");
    expect(m).toContain("503");
  });

  it("파일을 찾아다니게 만드는 문구를 앞세우지 않는다", () => {
    const m = depositFetchFailMessage(true, "Graph 503 — x");
    // '파일 이동/이름변경'이 사유보다 먼저 나오면 또 휴지통을 뒤진다.
    expect(m.indexOf("503")).toBeLessThan(
      m.includes("이동") ? m.indexOf("이동") : Number.MAX_SAFE_INTEGER,
    );
  });

  it("env 미설정은 그 사실을 그대로 말한다 — 이건 진짜 설정 문제다", () => {
    expect(depositFetchFailMessage(false)).toContain("환경변수 미설정");
  });

  it("사유를 못 얻었으면 지어내지 않는다", () => {
    const m = depositFetchFailMessage(true, null);
    expect(m).toContain("사유 불명");
  });
});
