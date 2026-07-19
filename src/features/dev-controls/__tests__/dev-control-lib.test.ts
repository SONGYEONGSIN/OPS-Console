import { describe, it, expect } from "vitest";
// vitest는 .mjs 상대 import를 타입 에러 없이 지원한다
import {
  parseDevInfo,
  parseClaudeJson,
  sha256,
  sanitizeFlags,
  buildClaudePrompt,
} from "../../../../scripts/lib/dev-control-lib.mjs";

describe("parseDevInfo", () => {
  it("d(JSON string)에서 js 파일만 kind 판별해 추출", () => {
    const d = JSON.stringify([
      { FileName: "Apply1_A.aspx", Extension: ".aspx", FileContents: "" },
      { FileName: "Apply1_A.js", Extension: "js", FileContents: "var a=1;" },
      { FileName: "Apply1_AU.js", Extension: "js", FileContents: "var u=1;" },
    ]);
    const out = parseDevInfo(JSON.stringify({ d }));
    expect(out).toEqual([
      { fileName: "Apply1_A.js", kind: "A", content: "var a=1;" },
      { fileName: "Apply1_AU.js", kind: "AU", content: "var u=1;" },
    ]);
  });
});

describe("buildClaudePrompt", () => {
  it("코드와 kind별 역할을 포함한다", () => {
    const a = buildClaudePrompt("A", "var a=1;");
    const au = buildClaudePrompt("AU", "var u=1;");
    expect(a).toContain("var a=1;");
    expect(a).toContain("운영자가 직접 관리");
    expect(au).toContain("개발자만 관리");
  });

  it("장황한 '## 제어 요약' 마크다운 형식을 강제하지 않는다", () => {
    expect(buildClaudePrompt("A", "code")).not.toContain("## 제어 요약");
  });

  it("운영자 관점·간결을 지시한다", () => {
    expect(buildClaudePrompt("A", "code")).toContain("간결");
  });

  it("AU(개발자 제어)는 더 짧게 지시한다 (운영자 직접 관리 아님)", () => {
    expect(buildClaudePrompt("AU", "code")).toMatch(/짧|1~3줄|간단/);
  });
});

describe("parseClaudeJson", () => {
  it("```json 펜스/전후 텍스트가 섞여도 JSON을 추출한다", () => {
    const stdout =
      '설명\n```json\n{"summary_md":"요약","flags":[{"key":"k","label":"L","snippet":"s","severity":"warn"}]}\n```';
    expect(parseClaudeJson(stdout).flags[0].key).toBe("k");
  });
  it("JSON 없으면 throw", () => {
    expect(() => parseClaudeJson("no json here")).toThrow();
  });
});

describe("sha256", () => {
  it("같은 입력 같은 해시", () => {
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});

describe("sanitizeFlags", () => {
  it("severity가 warn/info 외 값이면 info로 클램프", () => {
    const out = sanitizeFlags([
      { key: "k1", label: "L1", snippet: "s", severity: "critical" },
    ]);
    expect(out).toEqual([
      { key: "k1", label: "L1", snippet: "s", severity: "info" },
    ]);
  });

  it("snippet 누락이면 빈 문자열 기본값", () => {
    const out = sanitizeFlags([{ key: "k1", label: "L1", severity: "warn" }]);
    expect(out[0]).toEqual({
      key: "k1",
      label: "L1",
      snippet: "",
      severity: "warn",
    });
  });

  it("label이 빈 문자열/공백이면 해당 flag 제거", () => {
    const out = sanitizeFlags([
      { key: "k1", label: "", snippet: "s", severity: "warn" },
      { key: "k2", label: "   ", snippet: "s", severity: "warn" },
      { key: "k3", label: "정상", snippet: "s", severity: "warn" },
    ]);
    expect(out.map((f) => f.key)).toEqual(["k3"]);
  });

  it("key 누락 flag 제거", () => {
    const out = sanitizeFlags([
      { label: "L", snippet: "s", severity: "warn" },
      { key: "k1", label: "L", snippet: "s", severity: "warn" },
    ]);
    expect(out.map((f) => f.key)).toEqual(["k1"]);
  });

  it("정상 flag는 그대로 통과", () => {
    const flag = { key: "k1", label: "L1", snippet: "s", severity: "warn" };
    expect(sanitizeFlags([flag])).toEqual([flag]);
  });
});
