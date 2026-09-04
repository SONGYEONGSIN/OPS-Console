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
 * 학교 담당자용 명세 프롬프트.
 *
 * `buildClaudePrompt` 와 **정반대 목적**이다 — 그쪽은 운영자가 확인할 것만 뽑느라
 * "제어 요약은 쓰지 말 것"이라고 못박는다. 이쪽은 걸려 있는 제어를 빠짐없이 쓰되,
 * 코드를 모르는 사람이 읽을 수 있게 쓴다.
 *
 * A(운영자 관리)와 AU(개발자 관리)를 **한 문서로 합친다** — 학교는 '누가 관리하는
 * 파일인가'가 아니라 '지원자에게 무엇이 걸리는가'를 묻는다.
 *
 * @param files `{ kind, code }[]` — 저장된 raw_code. 수집을 다시 하지 않는다.
 */
export function buildSpecPrompt(files) {
  const blocks = files
    .map((f) => ["[" + f.kind + "]", "```js", f.code, "```"].join("\n"))
    .join("\n\n");
  return [
    "다음은 대입 원서접수 시스템의 원서제어 코드다.",
    "이 서비스에 **지금 걸려 있는 제어**를 학교 담당자에게 안내할 명세서를 만든다.",
    "",
    "독자는 비개발자다 — 대학 입학처 담당자이지 개발자가 아니다.",
    "지원자가 겪는 일로 서술하라. 코드가 어떻게 생겼는지는 관심 밖이다.",
    "",
    "금지:",
    "- 파일명(A.js, AU.js)과 A/AU 구분을 드러내지 말 것. 학교는 누가 관리하는지 묻지 않는다.",
    "- 함수명·변수명·코드 조각을 본문에 넣지 말 것.",
    "- '검증 로직', '유효성 체크' 같은 개발 용어를 쓰지 말 것.",
    "",
    "예:",
    "  ✗ chkBirth() 로 생년월일 형식을 검증한다",
    "  ✓ 생년월일을 잘못 적으면 다음 단계로 넘어가지 않습니다",
    "",
    "지원자 접수에 영향을 주는 제어를 **빠짐없이** 담아라. 접수 기간·입력 제한·",
    "결제·첨부파일·안내 문구·자격 제한 등 걸려 있는 것을 모두 항목으로 만든다.",
    "",
    "반드시 아래 JSON만 출력:",
    '{"items":[{"key":"<분류>:<식별자>","title":"제어 이름 한 줄","body":"지원자가 겪는 일 1~3문장"}]}',
    "",
    "key 는 재생성해도 같은 제어면 동일해야 한다 — 분류:핵심어 형태로.",
    "운영자가 항목을 빼 두면 그 결정을 key 로 이어받기 때문에, key 가 흔들리면 뺀 항목이 되살아난다.",
    "",
    blocks,
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

/** claude -p stdout에서 JSON 덩어리만 꺼낸다 (펜스/전후 텍스트 허용). */
function extractJson(stdout) {
  const fence = stdout.match(/```json\s*([\s\S]*?)```/);
  const raw = fence
    ? fence[1]
    : stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
  return JSON.parse(raw);
}

/** claude -p stdout에서 JSON 추출 (펜스/전후 텍스트 허용). */
export function parseClaudeJson(stdout) {
  const obj = extractJson(stdout);
  if (typeof obj.summary_md !== "string" || !Array.isArray(obj.flags))
    throw new Error("claude 응답 형식 불일치");
  return obj;
}

/**
 * 명세 응답 파서.
 *
 * `parseClaudeJson` 을 같이 쓸 수 없다 — 그쪽은 분석 전용이라 `summary_md` 와
 * `flags` 를 요구해서, 명세 응답을 넣으면 "형식 불일치"로 죽는다(실제로 겪었다).
 * 응답 모양이 다르면 검사도 달라야 한다.
 */
export function parseSpecJson(stdout) {
  const obj = extractJson(stdout);
  if (!Array.isArray(obj.items))
    throw new Error("claude 응답에 items 가 없습니다");
  return obj;
}

/**
 * 접수구분이 원서GEN 호스트를 정한다.
 *
 * 공통원서와 반응형원서는 **호스트만 다르다** — 창구 이름(`GetDevInfoByUnivServiceId`)도
 * 요청 형식도 응답 모양도 같다. 분석기가 공통원서 쪽만 알고 있어서 반응형 서비스는
 * 늘 빈 응답을 받았고, 화면에는 '미수집'으로만 떠 **분석이 실패한 것처럼 보였다**
 * (2026-08-21 연세대 UIC).
 *
 * 두 곳에 다 물어볼 수도 있지만 `closing_services.admission_type` 에 값이 있으니
 * 한 번만 부른다. 모르는 값이면 **null 을 준다** — 엉뚱한 호스트에 물어보면
 * 빈 응답을 받고 또 '미수집'이 된다.
 */
const GEN_HOST_BY_ADMISSION = {
  공통원서: "https://generator.jinhakapply.com",
  반응형원서: "https://entergenerator.jinhakapply.com",
  // 일반접수는 원서GEN으로 만들지 않는다 — 제어파일 자체가 없다.
};

export function genHostFor(admissionType) {
  if (!admissionType) return null;
  return GEN_HOST_BY_ADMISSION[admissionType.trim()] ?? null;
}

/**
 * 훑을 GenFlag — 원서(W)와 추가 페이지(P).
 *
 * 원서GEN 화면에 `원서` 탭과 `[PA]자기소개서` 탭이 따로 있고 URL 이 `&GenFlag=PA` 다.
 * 분석기가 W 계열만 보고 있어 **자기소개서 쪽 제어파일을 통째로 놓쳤다**
 * (2026-08-21 연세대 UIC — PA 에 5개가 더 있었다).
 *
 * 서비스마다 추가 페이지 수가 달라 A~D 까지 본다. 없으면 빈 응답이라 그냥 넘어간다 —
 * 있는지 없는지는 물어봐야 알고, 안 물어보면 오늘처럼 조용히 빠진다.
 */
export const GEN_FLAGS = ["WA", "WB", "WC", "WD", "PA", "PB", "PC", "PD"];
