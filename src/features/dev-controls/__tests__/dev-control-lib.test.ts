import { describe, it, expect } from "vitest";
// vitest는 .mjs 상대 import를 타입 에러 없이 지원한다
import {
  parseDevInfo,
  parseClaudeJson,
  sha256,
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
