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
 * "제어 요약은 쓰지 말 것"이라고 못박는다. 이쪽은 걸려 있는 제어를 빠짐없이 쓴다.
 *
 * **지원자 안내문이 아니라 설정 명세다.** 처음엔 "지원자가 겪는 일로 서술하라"
 * 였는데 그 지시가 조건값을 통째로 지웠다 — 실측(service 1130058)에서 코드에
 * 15회 나오는 NEIS 코드 조건이 문서엔 1회만 남고 고교 지역 코드는 0회였다.
 * 담당자가 대조할 대상이 바로 그 값인데 "특정 고교"로 뭉개졌다.
 *
 * A(운영자 관리)와 AU(개발자 관리)를 **한 문서로 합친다** — 학교는 '누가 관리하는
 * 파일인가'가 아니라 '우리 원서에 무엇이 걸려 있나'를 묻는다.
 *
 * @param files `{ kind, code }[]` — 저장된 raw_code. 수집을 다시 하지 않는다.
 * @param admissionTypes `{ selTypeCode, univCode, name }[]` — 전형 이름표.
 *   코드에는 SelTypeCode 와 이름이 이어진 자리가 없어(실측), 대학 자료에서
 *   받아 넣는다. 없으면 코드값 그대로 쓴다 — 지어내는 것보다 낫다.
 */
export function buildSpecPrompt(files, admissionTypes = []) {
  const blocks = files
    .map((f) => ["[" + f.kind + "]", "```js", f.code, "```"].join("\n"))
    .join("\n\n");
  return [
    "다음은 대입 원서접수 시스템의 원서제어 코드다.",
    "이 서비스에 **지금 설정돼 있는 원서제어**를 정리해, 학교 담당자가 자기 원서 설정을 대조 확인할 수 있는 문서를 만든다.",
    "",
    "독자는 대학 입학처 담당자다. 개발자는 아니지만 **자기 대학의 전형·자격구분·코드값은 안다.**",
    "목적은 \"우리 원서에 무엇이 어떤 조건으로 걸려 있나\"를 확인하는 것이다.",
    "",
    "## 쓰는 방식",
    "",
    "- **조건과 결과를 짝으로** 쓴다: 어떤 값일 때 → 무엇이 열리는지/막히는지/필수인지.",
    "- **실제 설정값을 반드시 드러낸다** — 전형 코드, 구분 값, 날짜, 숫자, 코드에 박힌 문자열.",
    "  담당자가 대조하려면 값이 있어야 한다. 값을 지우면 확인할 수 없는 문서가 된다.",
    "- **조건에 쓰인 코드 목록은 생략하지 말고 전부 싣는다.** 고교 NEIS 코드(NEISCODE),",
    "  고교 지역 코드(HIGHREGIONCODE), 고교 유형 코드(HIGHTYPECODE), 학교 코드 같은 값이",
    "  조건에 들어 있으면 **그 목록 전체를 그대로** 쓴다 — 담당자가 대조할 대상이 바로 그 목록이다.",
    "  \"특정 고교\", \"일부 지역\" 같은 뭉뚱그린 표현으로 대체하지 마라.",
    "- **전형 단위로 묶는다.** 특정 전형에만 걸리는 제어는 그 전형 항목에, 전 전형 공통이면 공통에.",
    "- **전형·항목 이름은 코드 안의 설명 문자열(desc, 안내 문구, 오류 메시지)에서 가져온다.**",
    "  이름을 지어내지 마라. 코드에 이름이 없으면 코드값을 그대로 쓴다(예: \"전형 코드 12\").",
    "",
    "## 쓰지 않는 것",
    "",
    "- 함수명·변수명을 그대로 쓰지 마라. 무엇을 보는 값인지 말로 쓰고 값만 인용한다.",
    "  (✗ chkBirth() 가 검증  →  ✓ 생년월일이 1996-03-01 이전일 때만 선택 가능)",
    "- **지원자 안내문처럼 쓰지 마라. 이건 설정 명세지 지원자 안내가 아니다.**",
    "  (✗ \"잘못 적으면 다음 단계로 넘어가지 않습니다\"  →  ✓ \"형식 불일치 시 다음 단계 진행 차단\")",
    "- 코드 조각을 그대로 붙여넣지 마라. 파일명(A.js, AU.js)과 A/AU 구분도 드러내지 마라.",
    "",
    "## 담을 것",
    "",
    "전형 선택 시 노출/비노출되는 항목, 비활성 조건, 자격 제한 조건, 입력 필수·형식 제한,",
    "접수 기간, 첨부·서식, 결제 관련 설정 — **걸려 있는 것을 빠짐없이.**",
    "설정이 **비어 있는 것**도 확인 대상이다(예: 전형별 안내 문구 미등록).",
    "",
    "반드시 아래 JSON만 출력:",
    '{"items":[{"key":"<전형 이름 또는 공통>:<식별자>","title":"제어 한 줄 (전형 이름 포함)","body":"조건 → 결과. 값·코드 목록 포함. 1~4문장"}]}',
    "",
    ...(admissionTypes.length
      ? [
          "## 전형 이름표 (대학 자료에서 받은 정답)",
          "",
          "코드의 `SelTypeCode` 값이 어느 전형인지다. **이 이름을 그대로 써라.**",
          "여기 없는 코드는 이름을 지어내지 말고 `전형 코드 N` 으로 둔다.",
          "",
          ...admissionTypes.map(
            (t) => `- SelTypeCode ${t.selTypeCode} = ${t.name}`,
          ),
          "",
        ]
      : []),
    "key 는 재생성해도 같은 제어면 동일해야 한다.",
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

/**
 * 파일별 산출을 하나로 합친다.
 *
 * **한 번에 다 넣으면 대부분이 사라진다** — 실측(service 1130058):
 *   A.js 단독 18KB(JX.IF 44개) → 56항목
 *   9파일 87KB(JX.IF 83개) 합쳐서 → 74항목
 * 파일 하나가 56개를 내놓는데 아홉을 합치면 74개다. 뭉개진 것이다.
 * 그래서 파일마다 따로 뽑고 여기서 합친다.
 *
 * 같은 제어가 두 파일에 걸쳐 있으면 **먼저 온 것**을 쓴다. 한 파일이 실패해도
 * 나머지는 살린다 — 전부 버리면 아홉 번 중 한 번 실패에 문서가 통째로 없다.
 */
export function mergeFileItems(perFile) {
  const seen = new Set();
  const out = [];
  for (const items of perFile ?? []) {
    for (const it of items ?? []) {
      const key = String(it?.key ?? "").trim();
      // key 가 없으면 운영자의 '제외' 결정을 걸 수 없다 — 문서에 못 올린다.
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

/**
 * 큰 파일부터 — 명세 생성 순서.
 *
 * 실측: 가장 큰 파일(18,484자)이 per-file 제한에 두 번 걸려 죽었다. 그 파일이
 * 단독으로 60항목을 내놓는 **제어가 제일 많은 파일**이라 빠지면 손실이 크다.
 * 큰 것부터 시작하면 긴 활주로를 먼저 받고, 예산이 모자랄 때 빠지는 쪽이 작은
 * 파일이 된다(작업 스케줄링의 LPT 와 같은 이유).
 */
export function bySizeDesc(files) {
  return [...(files ?? [])].sort(
    (a, b) => (b.raw_code?.length ?? 0) - (a.raw_code?.length ?? 0),
  );
}
