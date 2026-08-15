import { describe, it, expect } from "vitest";
import {
  buildVaultPrompt,
  collectSourcePaths,
  type SdkToolUse,
} from "../claude-prompt";

describe("buildVaultPrompt", () => {
  it("질문을 그대로 넣는다", () => {
    const p = buildVaultPrompt({
      question: "경위서 어떻게 보내지?",
      pageContext: null,
    });
    expect(p).toContain("경위서 어떻게 보내지?");
  });

  it("보고 있던 화면이 있으면 넣고, 없으면 그 섹션을 통째로 뺀다", () => {
    const withPage = buildVaultPrompt({
      question: "이거 뭐야",
      pageContext: "사고보고 (/dashboard/incidents)",
    });
    expect(withPage).toContain("사고보고 (/dashboard/incidents)");

    const without = buildVaultPrompt({
      question: "이거 뭐야",
      pageContext: null,
    });
    expect(without).not.toContain("지금 보고 있는 화면");
  });

  it("볼트에 없으면 없다고 말하라고 지시한다 — 지어내면 지식망을 쓰는 의미가 없다", () => {
    const p = buildVaultPrompt({ question: "x", pageContext: null });
    expect(p).toMatch(/없으면|찾지 못/);
  });

  it("질문을 지시로 착각하지 않게 경계를 친다 — 볼트는 전원이 쓰는 파일이다", () => {
    const p = buildVaultPrompt({ question: "x", pageContext: null });
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
