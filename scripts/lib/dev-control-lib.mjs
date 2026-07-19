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
  // A: 운영자가 직접 손대는 파일 → 운영자가 확인·관리할 지점 위주. AU: 개발자 전용 →
  // 운영자는 직접 관리하지 않으므로 접수 운영에 영향 주는 점만 아주 짧게(1~3줄).
  const focus =
    kind === "A"
      ? "운영자가 직접 관리하는 파일이다. 운영자가 확인·관리해야 할 지점만 최대 4줄."
      : "개발자만 관리하는 파일이라 운영자가 직접 손댈 일은 없다. 접수 운영에 영향 주는 점만 1~3줄로 짧게.";
  return [
    `다음은 대입 원서접수 시스템의 ${role} 코드다.`,
    "운영자(비개발자)가 '봐야 할 것'만 골라 간결하게 정리하라.",
    "코드 동작을 처음부터 끝까지 훑는 '제어 요약'은 쓰지 말 것. 무엇을·언제·어떻게 제어하는지 장황하게 나열 금지.",
    focus,
    "반드시 아래 JSON만 출력:",
    '{"summary_md":"운영자 확인용 핵심만. 각 줄은 \\"- \\"로 시작하는 짧은 한 문장, 줄 사이는 \\n 하나. 마크다운 기호(##, **, 굵게) 절대 쓰지 말 것","flags":[{"key":"<규칙>:<식별자>","label":"확인 필요 사유 한줄","snippet":"해당 코드 조각(1~3줄)","severity":"warn|info"}]}',
    "summary 관점: 이 제어가 지원자 접수에 주는 영향 + 운영자가 눈여겨볼 지점(과거 연도/학년도, 마감일·기간 문구, 하드코딩 전형코드/학년도). 내부 동작 상세 설명은 넣지 말 것.",
    "flags 추출 기준: ① 지난 연도/학년도(올해 2026 기준 과거) 날짜·문구 ② 마감일·기간 안내 alert/문구 ③ 하드코딩 학년도·전형코드 ④ 주석 처리된 의심 코드. 확인 불필요하면 빈 배열.",
    "key는 재분석 시에도 동일 항목이면 같아야 한다 — 규칙명:코드조각 앞 20자 형태로.",
    "```js",
    code,
    "```",
  ].join("\n");
}

/**
 * claude -p가 생성한 flags가 스키마(devControlFlagSchema)를 벗어나는 경우를 방어한다.
 * - key/label 누락(빈 문자열/공백 포함)이면 해당 flag를 제거
 * - snippet 누락이면 빈 문자열 기본값
 * - severity가 "warn"|"info" 외 값이면 "info"로 클램프
 */
export function sanitizeFlags(flags) {
  if (!Array.isArray(flags)) return [];
  return flags
    .filter((f) => typeof f?.key === "string" && f.key.trim() !== "")
    .filter((f) => typeof f?.label === "string" && f.label.trim() !== "")
    .map((f) => ({
      key: f.key,
      label: f.label,
      snippet: typeof f.snippet === "string" ? f.snippet : "",
      severity: f.severity === "warn" || f.severity === "info" ? f.severity : "info",
    }));
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
