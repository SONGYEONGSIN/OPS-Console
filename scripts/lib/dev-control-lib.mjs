import crypto from "node:crypto";

export const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

/** GetDevInfoByUnivServiceId 응답 → js 파일(A/AU)만 추출. */
export function parseDevInfo(resText) {
  const files = JSON.parse(JSON.parse(resText).d);
  return files
    .filter((f) => f.Extension === "js" && f.FileContents)
    .map((f) => ({
      fileName: f.FileName,
      kind: /U\.js$/i.test(f.FileName) ? "AU" : "A",
      content: f.FileContents,
    }));
}

export function buildClaudePrompt(kind, code) {
  const role =
    kind === "A"
      ? "운영자가 직접 관리하는 원서제어(A.js)"
      : "개발자만 관리하는 원서제어(AU.js)";
  return [
    `다음은 대입 원서접수 시스템의 ${role} 코드다.`,
    "운영자(비개발자)가 이해할 수 있게 정리하라. 반드시 아래 JSON만 출력:",
    '{"summary_md":"## 제어 요약\\n- ...(markdown, 무엇을 언제 어떻게 제어하는지 항목별로)","flags":[{"key":"<규칙>:<식별자>","label":"확인 필요 사유 한줄","snippet":"해당 코드 조각(1~3줄)","severity":"warn|info"}]}',
    "flags 추출 기준: ① 지난 연도/학년도(올해 2026 기준 과거) 날짜·문구 ② 마감일·기간 안내 alert/문구 ③ 하드코딩 학년도·전형코드 ④ 주석 처리된 의심 코드. 확인 불필요하면 빈 배열.",
    "key는 재분석 시에도 동일 항목이면 같아야 한다 — 규칙명:코드조각 앞 20자 형태로.",
    "```js",
    code,
    "```",
  ].join("\n");
}

/** claude -p stdout에서 JSON 추출 (펜스/전후 텍스트 허용). */
export function parseClaudeJson(stdout) {
  const fence = stdout.match(/```json\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
  const obj = JSON.parse(raw);
  if (typeof obj.summary_md !== "string" || !Array.isArray(obj.flags))
    throw new Error("claude 응답 형식 불일치");
  return obj;
}
