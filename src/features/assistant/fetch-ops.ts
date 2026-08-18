import type { SourceDomain } from "./search";

/**
 * 도메인별 **전문 조회** 설정.
 *
 * `search_ops`는 200자 발췌만 준다 — 있는지는 알려주지만 내용을 옮길 수는 없다.
 * 어시스턴트가 2026-08-18에 그 한계를 직접 진단해 gap으로 남겼고, 그래서
 * 찾기(search)와 읽기(fetch)를 갈랐다. 검색이 전문을 뱉으면 여러 건 검색할 때
 * 컨텍스트가 터진다.
 *
 * 설계: docs/superpowers/specs/2026-08-18-assistant-tools-design.md
 */

/** 한 건에서 가져오는 최대 글자. 넘으면 자르고 잘렸다고 밝힌다. */
export const MAX_FETCH_CHARS = 20_000;

export type BodyField = { key: string; label: string };

export type FetchConfig = {
  table: string;
  /** 레코드를 찾는 컬럼. 대부분 id지만 볼트 문서는 path다. */
  idColumn: string;
  /** 제목을 만드는 컬럼들 — 순서대로 이어 붙인다. */
  titleFields: string[];
  /** 본문으로 펼칠 컬럼과 사람이 읽을 라벨. */
  bodyFields: BodyField[];
  /** 조인이 필요하면 select에 덧붙일 문자열. */
  embed?: string;
};

export const FETCH_CONFIG: Record<SourceDomain, FetchConfig> = {
  // 인수인계는 제목 컬럼이 없어 서비스에서 가져온다. 본문은 14개 필드로 나뉜다.
  handover: {
    table: "handover_records",
    idColumn: "id",
    titleFields: [],
    embed: "services(university_name, service_name)",
    bodyFields: [
      { key: "contract_info_md", label: "계약-기본" },
      { key: "contract_data_md", label: "계약-자료" },
      { key: "work_basic_md", label: "작업-기초" },
      { key: "work_generator_md", label: "작업-원서GEN" },
      { key: "work_site_md", label: "작업-사이트" },
      { key: "work_output_md", label: "작업-출력물" },
      { key: "work_rate_md", label: "작업-경쟁률" },
      { key: "work_file_md", label: "작업-전산파일" },
      { key: "work_etc_md", label: "작업-기타" },
      { key: "payment_fee_md", label: "정산-수수료" },
      { key: "payment_invoice_md", label: "정산-계산서" },
      { key: "school_contact_md", label: "학교 연락처" },
      { key: "docs_md", label: "서류제출" },
      { key: "notes_md", label: "비고" },
    ],
  },
  incident: {
    table: "incidents",
    idColumn: "id",
    titleFields: ["university_name", "title"],
    bodyFields: [
      { key: "cause_summary", label: "원인 요약" },
      { key: "root_cause", label: "근본 원인" },
      { key: "resolution", label: "조치" },
      { key: "prevention", label: "재발 방지" },
    ],
  },
  "ai-tip": {
    table: "ai_tips",
    idColumn: "id",
    titleFields: ["title"],
    bodyFields: [
      { key: "summary_md", label: "요약" },
      { key: "reuse_prompt", label: "재사용 프롬프트" },
    ],
  },
  backup: {
    table: "backup_requests",
    idColumn: "id",
    titleFields: ["title"],
    bodyFields: [{ key: "summary_md", label: "내용" }],
  },
  contact: {
    table: "contacts",
    idColumn: "id",
    titleFields: ["university_name", "customer_name"],
    bodyFields: [
      // 연락 수단이 먼저다 — 이 도메인을 여는 이유가 그것이다.
      { key: "contact_phone", label: "전화" },
      { key: "contact_ext", label: "내선" },
      { key: "contact_email", label: "이메일" },
      { key: "department_name", label: "부서" },
      { key: "job_title", label: "직함" },
      { key: "job_role", label: "담당 업무" },
    ],
  },
  service: {
    table: "services",
    idColumn: "id",
    titleFields: ["university_name", "service_name"],
    bodyFields: [
      { key: "category", label: "구분" },
      { key: "application_type", label: "전형 유형" },
      { key: "region", label: "지역" },
    ],
  },
  // 볼트 문서는 에이전트가 파일로 직접 읽지만, 인덱스로도 꺼낼 수 있게 둔다.
  knowledge: {
    table: "knowledge_docs",
    idColumn: "path",
    titleFields: ["title"],
    bodyFields: [{ key: "body", label: "본문" }],
  },
};

/**
 * 레코드 → 사람이 읽을 마크다운. 빈 필드는 건너뛴다.
 *
 * 상한을 넘으면 **자르고 잘렸다고 밝힌다** — 조용히 자르면 모델이 뒷부분이
 * 없다는 걸 모른 채 "전부 읽었다"고 답한다.
 */
export function buildFullText(
  row: Record<string, unknown>,
  fields: BodyField[],
): string {
  const parts: string[] = [];
  for (const f of fields) {
    const v = row[f.key];
    if (typeof v !== "string" || !v.trim()) continue;
    parts.push(`## ${f.label}\n\n${v.trim()}`);
  }
  const text = parts.join("\n\n");
  if (text.length <= MAX_FETCH_CHARS) return text;
  return `${text.slice(0, MAX_FETCH_CHARS)}\n\n…(${MAX_FETCH_CHARS}자를 넘어 잘렸습니다)`;
}
