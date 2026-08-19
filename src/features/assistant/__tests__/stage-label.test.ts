import { describe, it, expect } from "vitest";
import {
  stageLabel,
  pendingNoteFor,
  elapsedLabel,
  STAGE_START,
  STAGE_QUEUED,
  STAGE_STILL_QUEUED,
  STAGE_COMPOSING,
} from "../stage-label";

/**
 * 진행 문구는 **실제로 하고 있는 일**이어야 한다.
 *
 * 지금은 두 문구가 고정으로 떠 있어 멈춘 것처럼 보인다("회사 PC로 보냈습니다…").
 * 폴러는 도구 호출을 실시간으로 받고 있으므로, 그걸 그대로 문장으로 바꾼다.
 * 돌아가는 문구를 지어내면 안 하는 일을 한다고 쓰는 셈이라 하지 않는다.
 */
describe("stageLabel", () => {
  it("볼트 문서를 읽으면 파일 이름까지 보여준다", () => {
    const s = stageLabel({
      name: "Read",
      input: { file_path: "C:/볼트/엔티티/부산대학교 수시 서비스 세팅.md" },
    });
    expect(s).toContain("읽는 중");
    // 무엇을 읽는지가 빠지면 어느 문서에서 멈췄는지 알 수 없다.
    expect(s).toContain("부산대학교 수시 서비스 세팅");
    expect(s).not.toContain(".md");
  });

  it("훑기(Glob·Grep)는 읽기와 구분한다", () => {
    expect(stageLabel({ name: "Glob", input: {} })).toContain("훑는 중");
    expect(stageLabel({ name: "Grep", input: {} })).toContain("훑는 중");
  });

  it("운영 기록 검색은 어느 영역을 뒤지는지 보여준다", () => {
    const s = stageLabel({
      name: "mcp__ops__search_ops",
      input: { domains: ["handover", "incidents"] },
    });
    expect(s).toContain("찾는 중");
    expect(s).toContain("인수인계");
    expect(s).toContain("사고");
  });

  it("도메인이 없으면 영역 없이도 문장이 성립한다", () => {
    const s = stageLabel({ name: "mcp__ops__search_ops", input: {} });
    expect(s).toContain("찾는 중");
    expect(s).not.toContain("—");
  });

  it("전문 조회·초안·빈틈·일정을 각각 구분한다", () => {
    expect(stageLabel({ name: "mcp__ops__fetch_ops", input: {} })).toContain("전문");
    expect(stageLabel({ name: "mcp__ops__propose_doc", input: {} })).toContain("초안");
    expect(stageLabel({ name: "mcp__ops__report_gap", input: {} })).toContain("빈틈");
    expect(stageLabel({ name: "mcp__ops__schedule_range", input: {} })).toContain("일정");
  });

  it("모르는 도구는 뭉뚱그리되 거짓말하지 않는다", () => {
    const s = stageLabel({ name: "mcp__ops__새도구", input: {} });
    // 새 도구가 늘어도 "읽는 중" 같은 틀린 말이 뜨면 안 된다.
    expect(s).toBe(STAGE_START);
  });

  it("claim 전과 claim 직후를 구분한다 — 안 도는데 실행 중이라 하면 거짓", () => {
    expect(STAGE_QUEUED).not.toContain("실행 중");
    expect(STAGE_START).toBe("에이전트 실행 중");
  });

  it("답을 쓰는 단계가 따로 있다", () => {
    expect(STAGE_COMPOSING).toContain("정리");
  });
});

/**
 * 화면이 어떤 문구를 보여줄지 — 서버가 준 단계가 있으면 그게 우선이다.
 *
 * 단계가 아직 안 왔을 때 "지식망 문서를 읽는 중"을 띄우면 안 읽고 있을 수도 있는
 * 상태를 단정하는 것이다. claim 됐다는 사실만 아는 구간에서는 그 사실만 말한다.
 */
describe("pendingNoteFor", () => {
  it("서버가 준 단계가 있으면 그대로 보여준다", () => {
    expect(
      pendingNoteFor({ status: "running", stage: "기록 전문을 읽는 중" }),
    ).toBe("기록 전문을 읽는 중");
  });

  it("claim은 됐는데 단계가 아직 없으면 '에이전트 실행 중'", () => {
    expect(pendingNoteFor({ status: "running", stage: null })).toBe(STAGE_START);
  });

  it("아직 아무도 안 가져갔으면 실행 중이라 하지 않는다", () => {
    expect(pendingNoteFor({ status: "pending" })).toBe(STAGE_QUEUED);
  });

  it("상태를 모르면 대기로 본다 — 도는 척하지 않는다", () => {
    expect(pendingNoteFor({})).toBe(STAGE_QUEUED);
  });

  it("빈 문자열 단계는 무시한다", () => {
    expect(pendingNoteFor({ status: "running", stage: "  " })).toBe(STAGE_START);
  });
});

describe("elapsedLabel", () => {
  it("1분 미만은 초로", () => {
    expect(elapsedLabel(12_400)).toBe("12초");
  });

  it("1분 넘으면 분과 초로 — 40초짜리가 보통이라 분 표시가 곧 이상 신호다", () => {
    expect(elapsedLabel(65_000)).toBe("1분 5초");
  });

  it("음수·0도 문장이 성립한다", () => {
    expect(elapsedLabel(0)).toBe("0초");
    expect(elapsedLabel(-5)).toBe("0초");
  });
});

/**
 * 오래 안 가져갈 때 뜨는 줄.
 *
 * 예전 문구는 "회사 PC가 응답하지 않습니다 … 빠른 답변 모드로 물어보세요"였다.
 * 빠른 답변(Gemini)을 걷어내면서 갈 곳이 없어졌고, 무엇보다 **꺼진 건지 느린
 * 건지 화면은 모른다** — 단정하지 않는 말투가 사실에도 맞다.
 */
describe("STAGE_STILL_QUEUED", () => {
  it("계속 부르고 있다는 걸 먼저 말한다 — 멈춘 게 아니다", () => {
    expect(STAGE_STILL_QUEUED).toContain("계속 부르는 중");
  });

  it("단정하지 않는다 — 꺼진 건지 느린 건지 모른다", () => {
    expect(STAGE_STILL_QUEUED).toMatch(/같아요/);
    expect(STAGE_STILL_QUEUED).not.toMatch(/꺼져|응답하지 않습니다/);
  });

  it("없어진 모드로 안내하지 않는다", () => {
    expect(STAGE_STILL_QUEUED).not.toContain("빠른 답변");
  });
});
