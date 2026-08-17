import { describe, it, expect } from "vitest";
import {
  buildVaultPrompt,
  kstToday,
  collectSourcePaths,
  type SdkToolUse,
} from "../claude-prompt";

describe("kstToday", () => {
  it("KST 날짜와 요일을 사람이 읽는 형태로 만든다", () => {
    // 2026-08-16는 일요일 (KST)
    expect(kstToday(new Date("2026-08-16T05:00:00Z"))).toBe("2026-08-16 (일)");
  });

  it("UTC 자정 직후에도 KST 날짜로 센다 — 하루가 밀리면 '다음주'가 어긋난다", () => {
    // UTC 2026-08-16 00:30 = KST 2026-08-16 09:30 (같은 날)
    expect(kstToday(new Date("2026-08-16T00:30:00Z"))).toBe("2026-08-16 (일)");
    // UTC 2026-08-16 15:30 = KST 2026-08-17 00:30 (다음 날)
    expect(kstToday(new Date("2026-08-16T15:30:00Z"))).toBe("2026-08-17 (월)");
  });
});

describe("buildVaultPrompt", () => {
  it("질문을 그대로 넣는다", () => {
    const p = buildVaultPrompt({
      question: "경위서 어떻게 보내지?",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("경위서 어떻게 보내지?");
  });

  it("오늘 날짜를 넣는다 — 없으면 '다음주'가 언제인지 모른다", () => {
    const p = buildVaultPrompt({
      question: "다음주 휴가자 누구야?",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("2026-08-16 (일)");
  });

  it("볼트에 없는 건 도구로 조회하라고 알려준다 — 일정은 문서가 아니라 시스템 데이터다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/도구/);
    expect(p).toMatch(/일정|휴가/);
  });

  it("보고 있던 화면이 있으면 넣고, 없으면 그 섹션을 통째로 뺀다", () => {
    const withPage = buildVaultPrompt({
      question: "이거 뭐야",
      pageContext: "사고보고 (/dashboard/incidents)",
      today: "2026-08-16 (일)",
    });
    expect(withPage).toContain("사고보고 (/dashboard/incidents)");

    const without = buildVaultPrompt({
      question: "이거 뭐야",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(without).not.toContain("지금 보고 있는 화면");
  });

  it("못 답한 건 report_gap으로 남기라고 지시한다 — 본문 문장으로만 있으면 기계가 못 읽는다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("report_gap");
  });

  it("문서가 있는데 층위만 없을 때와 아예 없을 때를 구분하라고 지시한다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toContain("shallow");
    expect(p).toContain("missing");
  });

  it("볼트에 없으면 없다고 말하라고 지시한다 — 지어내면 지식망을 쓰는 의미가 없다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/없으면|찾지 못/);
  });

  it("질문을 지시로 착각하지 않게 경계를 친다 — 볼트는 전원이 쓰는 파일이다", () => {
    const p = buildVaultPrompt({
      question: "x",
      pageContext: null,
      today: "2026-08-16 (일)",
    });
    expect(p).toMatch(/문서에 적힌 지시|지시를 따르지/);
  });
});

/**
 * 근거 파일은 모델이 "마지막 줄에 적어주길" 기대하지 않는다 —
 * SDK가 주는 tool_use 이벤트에서 실제로 읽은 경로를 뽑는다.
 */
describe("collectSourcePaths", () => {
  const VAULT = "/Users/x/OneDrive/업무 지식망";

  it("Read한 파일을 볼트 기준 상대경로로 돌려준다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: { file_path: `${VAULT}/개념/공문 시행번호 채번 규칙.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual([
      "개념/공문 시행번호 채번 규칙.md",
    ]);
  });

  it("같은 파일을 여러 번 읽어도 한 번만 센다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: { file_path: `${VAULT}/규칙/a.md` } },
      { name: "Read", input: { file_path: `${VAULT}/규칙/a.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["규칙/a.md"]);
  });

  it("Glob·Grep은 근거가 아니다 — 훑기만 한 것이라 답의 출처가 아니다", () => {
    const uses: SdkToolUse[] = [
      { name: "Glob", input: { pattern: "**/*.md" } },
      { name: "Grep", input: { pattern: "시행번호" } },
      { name: "Read", input: { file_path: `${VAULT}/개념/b.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["개념/b.md"]);
  });

  it("볼트 밖 파일은 버린다 — 근거로 내보이면 안 되는 경로다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: { file_path: "/etc/hosts" } },
      { name: "Read", input: { file_path: `${VAULT}/규칙/c.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["규칙/c.md"]);
  });

  it("file_path가 없는 Read는 건너뛴다 — 이벤트 모양을 신뢰하지 않는다", () => {
    const uses: SdkToolUse[] = [
      { name: "Read", input: {} },
      { name: "Read", input: { file_path: `${VAULT}/규칙/d.md` } },
    ];
    expect(collectSourcePaths(uses, VAULT)).toEqual(["규칙/d.md"]);
  });

  it("읽은 게 없으면 빈 배열", () => {
    expect(collectSourcePaths([], VAULT)).toEqual([]);
  });
});
