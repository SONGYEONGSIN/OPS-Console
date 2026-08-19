import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 도메인별 키워드 검색 → 에이전트 `search_ops` 도구가 쓸 top-N row 추출.
 * MVP: 단순 token 매칭 + 점수. 추후 phase에서 임베딩으로 확장.
 */

export type SourceDomain =
  | "incident"
  | "handover"
  | "ai-tip"
  | "backup"
  | "contact"
  | "service"
  | "knowledge";

export type Source = {
  domain: SourceDomain;
  id: string;
  title: string;
  /** 매칭 컨텍스트 일부 (텍스트 일부 발췌) */
  snippet: string;
  /** 인스펙터/도메인 페이지 deep-link */
  deepLink: string;
};

const TOP_PER_DOMAIN = 3;
const SNIPPET_MAX_LEN = 200;
/** 도메인별 최근 row 한도 — 검색 대상이 너무 커지지 않게 */
const FETCH_LIMIT_PER_DOMAIN = 200;

/** 질문을 토큰 배열로 분해 (공백 split + 길이 2+) */
export function tokenize(q: string): string[] {
  return q
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** 텍스트에 토큰이 포함된 개수 (대소문자 무관, 단순 includes) */
export function scoreText(text: string, tokens: string[]): number {
  if (!text || tokens.length === 0) return 0;
  const lower = text.toLowerCase();
  let s = 0;
  for (const t of tokens) {
    if (lower.includes(t.toLowerCase())) s += 1;
  }
  return s;
}

function snippet(text: string | null | undefined): string {
  if (!text) return "";
  // 모든 도메인이 여기를 지난다 — 마크다운 제거를 한 곳에서 건다.
  const trimmed = plainSnippet(text);
  return trimmed.length > SNIPPET_MAX_LEN
    ? trimmed.slice(0, SNIPPET_MAX_LEN) + "…"
    : trimmed;
}

/** 지식망 1행 — 검색에 쓰는 최소 형태. */
/**
 * 근거 스니펫에서 마크다운 기호를 걷어낸다.
 *
 * 스니펫은 문서 원문을 그대로 자른 것이라 `##`·`**`·백틱·표 파이프가 섞인다.
 * 좁은 패널에서는 그 기호가 글자를 덮어 읽기 어렵다. 렌더링이 아니라 **한 줄
 * 미리보기**라 마크다운으로 그리지 않고 기호만 없앤다.
 */
export function plainSnippet(text: string): string {
  return text
    .replace(/```+/g, " ") // 코드펜스
    .replace(/`/g, "") // 인라인 코드
    .replace(/^\s*#{1,6}\s*/gm, "") // 제목
    .replace(/\*\*|__/g, "") // 굵게
    .replace(/^\s*[-*+]\s+/gm, "") // 목록 기호
    .replace(/\|/g, " ") // 표 파이프
    .replace(/\s+/g, " ")
    .trim();
}

export type KnowledgeRow = {
  path: string;
  category: string;
  title: string;
  owner: string | null;
  body: string;
};

/**
 * 매칭 대상 텍스트. 분류·작성자까지 넣는 이유 — 운영자는 "규칙 중에 뭐 있어",
 * "송영신이 쓴 문서" 같은 식으로도 묻는다.
 */
export function knowledgeHaystack(r: KnowledgeRow): string {
  return [r.title, r.category, r.owner, r.body].filter(Boolean).join(" ");
}

/**
 * 지식망 행 → Source. 식별자는 uuid가 아니라 **경로**다 — 원본이 파일이고
 * 열람 화면도 경로로 문서를 연다. deep-link가 근거 확인 경로가 된다.
 */
export function knowledgeSource(r: KnowledgeRow): Source {
  return {
    domain: "knowledge",
    id: r.path,
    title: r.title,
    snippet: snippet(r.body),
    deepLink: `/dashboard/knowledge?doc=${encodeURIComponent(r.path)}`,
  };
}

type SearchInput = { question: string };


/**
 * 같은 검색을 **클라이언트를 받아서** 수행한다.
 *
 * 어시스턴트 도구(`/api/assistant/tools/search`)는 세션이 없다 — 큐를 통해
 * CRON_SECRET으로 불리므로 쿠키가 없다. 그래서 클라이언트를 주입받는다.
 * 권한은 그 라우트가 요청자를 확인해서 건다(설계 §2).
 */
export async function searchDomainsWith(
  supabase: SB,
  input: SearchInput,
): Promise<Source[]> {
  const tokens = tokenize(input.question);
  if (tokens.length === 0) return [];

  const [incidents, handovers, tips, backups, contacts, services, knowledge] =
    await Promise.all([
      searchIncidents(supabase, tokens),
      searchHandovers(supabase, tokens),
      searchAiTips(supabase, tokens),
      searchBackups(supabase, tokens),
      searchContacts(supabase, tokens),
      searchServices(supabase, tokens),
      searchKnowledge(supabase, tokens),
    ]);

  // 지식망을 앞에 둔다 — 절차·규칙을 묻는 질문에서 가장 신뢰할 근거다.
  // 사람이 쓰고 owner가 책임지는 문서이고, 나머지는 운영 데이터의 파편이다.
  return [
    ...knowledge,
    ...incidents,
    ...handovers,
    ...tips,
    ...backups,
    ...contacts,
    ...services,
  ];
}

type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * 업무 지식망 — knowledge_docs 인덱스를 검색한다.
 * 인덱스는 볼트(SharePoint 마크다운)의 사본이라, 여기 없으면 아직 인덱싱 전이다.
 */
/**
 * 도메인별 조회 컬럼 — 단일 소스.
 *
 * 여기 적힌 이름이 실제 스키마와 어긋나면 supabase-js가 예외를 던지지 않고
 * `{data: null}`을 돌려주고, 각 검색 함수의 `if (!data) return []`가 그것을
 * "자료 없음"으로 바꾼다. 즉 **틀린 컬럼은 조용한 0건**이 된다.
 * `__tests__/domain-selects.test.ts`가 마이그레이션과 대조해 이를 막는다.
 */
export const DOMAIN_SELECTS = {
  knowledge_docs: "path, category, title, owner, body",
  incidents:
    "id, title, university_name, category, cause_summary, root_cause, resolution, prevention",
  // 인수인계는 제목 컬럼이 없다 — 서비스에서 가져오고, 본문은 *_md 14개를 합친다.
  handover_records:
    "id, service_id, contract_info_md, contract_data_md, work_basic_md, work_generator_md, " +
    "work_site_md, work_output_md, work_rate_md, work_file_md, work_etc_md, payment_fee_md, " +
    "payment_invoice_md, school_contact_md, docs_md, notes_md, " +
    "services(university_name, service_name)",
  ai_tips: "id, title, summary_md, reuse_prompt, ai_tool, category, tags",
  backup_requests: "id, title, summary_md, substitute_name",
  // 연락 수단이 빠지면 "조선대 연락처 알려줘"에 이름·직함만 답하게 된다.
  // 실제로 그렇게 답하고 빈틈까지 남긴 적이 있다(2026-08-19).
  contacts:
    "id, customer_name, university_name, job_title, job_role, department_name, contact_phone, contact_ext, contact_email",
  services:
    "id, university_name, service_name, category, application_type, region",
} as const;

async function searchKnowledge(
  supabase: SB,
  tokens: string[],
): Promise<Source[]> {
  const { data } = await supabase
    .from("knowledge_docs")
    .select(DOMAIN_SELECTS.knowledge_docs)
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  const scored = (data as KnowledgeRow[]).map((r) => ({
    row: r,
    score: scoreText(knowledgeHaystack(r), tokens),
  }));
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((s) => knowledgeSource(s.row));
}

async function searchIncidents(
  supabase: SB,
  tokens: string[],
): Promise<Source[]> {
  const { data } = await supabase
    .from("incidents")
    .select(DOMAIN_SELECTS.incidents)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    title: string | null;
    university_name: string | null;
    category: string | null;
    cause_summary: string | null;
    root_cause: string | null;
    resolution: string | null;
    prevention: string | null;
  };
  const scored = (data as Row[]).map((r) => {
    const haystack = [
      r.title,
      r.university_name,
      r.category,
      r.cause_summary,
      r.root_cause,
      r.resolution,
      r.prevention,
    ]
      .filter(Boolean)
      .join(" ");
    return { row: r, score: scoreText(haystack, tokens), haystack };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "incident" as const,
      id: x.row.id,
      title: `${x.row.university_name ?? "—"} — ${x.row.title ?? "(제목 없음)"}`,
      snippet: snippet(
        x.row.cause_summary ?? x.row.resolution ?? x.row.root_cause,
      ),
      deepLink: `/dashboard/incidents`,
    }));
}

/**
 * 인수인계 — 제목 컬럼이 없어 서비스에서 가져오고, 본문은 *_md 필드를 합친다.
 * 필드가 14개로 나뉘어 있어 어느 항목에 적혔든 걸리게 하려면 합쳐서 훑어야 한다.
 */
async function searchHandovers(
  supabase: SB,
  tokens: string[],
): Promise<Source[]> {
  const { data } = await supabase
    .from("handover_records")
    .select(DOMAIN_SELECTS.handover_records)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];

  type Row = Record<string, unknown> & {
    id: string;
    services?: {
      university_name?: string | null;
      service_name?: string | null;
    } | null;
  };

  const bodyOf = (r: Row) =>
    Object.entries(r)
      .filter(([k, v]) => k.endsWith("_md") && typeof v === "string" && v)
      .map(([, v]) => v as string)
      .join("\n");

  const titleOf = (r: Row) => {
    const u = r.services?.university_name ?? "";
    const n = r.services?.service_name ?? "";
    const t = [u, n].filter(Boolean).join(" — ");
    return t || "(인수인계)";
  };

  const scored = (data as unknown as Row[]).map((r) => ({
    row: r,
    body: bodyOf(r),
    title: titleOf(r),
  }));
  return scored
    .map((x) => ({
      ...x,
      score: scoreText([x.title, x.body].join(" "), tokens),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "handover" as const,
      id: x.row.id,
      title: x.title,
      snippet: snippet(x.body),
      deepLink: `/dashboard/handover`,
    }));
}

async function searchAiTips(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("ai_tips")
    .select(DOMAIN_SELECTS.ai_tips)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    title: string | null;
    summary_md: string | null;
    reuse_prompt: string | null;
    ai_tool: string | null;
    category: string | null;
    tags: string[] | null;
  };
  const scored = (data as Row[]).map((r) => {
    const haystack = [
      r.title,
      r.summary_md,
      r.reuse_prompt,
      r.ai_tool,
      r.category,
      (r.tags ?? []).join(" "),
    ]
      .filter(Boolean)
      .join(" ");
    return { row: r, score: scoreText(haystack, tokens) };
  });
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "ai-tip" as const,
      id: x.row.id,
      title: x.row.title ?? "(TIP)",
      snippet: snippet(x.row.summary_md ?? x.row.reuse_prompt),
      deepLink: `/dashboard/ai-tips`,
    }));
}

async function searchBackups(
  supabase: SB,
  tokens: string[],
): Promise<Source[]> {
  const { data } = await supabase
    .from("backup_requests")
    .select(DOMAIN_SELECTS.backup_requests)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    title: string | null;
    summary_md: string | null;
    substitute_name: string | null;
  };
  const scored = (data as Row[]).map((r) => ({
    row: r,
    score: scoreText(
      [r.title, r.summary_md, r.substitute_name].filter(Boolean).join(" "),
      tokens,
    ),
  }));
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "backup" as const,
      id: x.row.id,
      title: x.row.title ?? "(백업 요청)",
      snippet: snippet(x.row.summary_md),
      deepLink: `/dashboard/backup`,
    }));
}

async function searchContacts(
  supabase: SB,
  tokens: string[],
): Promise<Source[]> {
  const { data } = await supabase
    .from("contacts")
    .select(DOMAIN_SELECTS.contacts)
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    customer_name: string;
    university_name: string;
    job_title: string | null;
    job_role: string | null;
    department_name: string | null;
    contact_phone: string | null;
    contact_ext: string | null;
    contact_email: string | null;
  };
  const scored = (data as Row[]).map((r) => ({
    row: r,
    score: scoreText(
      [
        r.customer_name,
        r.university_name,
        r.job_title,
        r.job_role,
        r.department_name,
      ]
        .filter(Boolean)
        .join(" "),
      tokens,
    ),
  }));
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "contact" as const,
      id: x.row.id,
      title: `${x.row.university_name} — ${x.row.customer_name}`,
      // 연락 수단을 앞에 둔다 — 연락처를 묻는 사람이 원하는 건 그것이다.
      // 라벨 '내선'은 화면(contacts/View.tsx)과 맞춘다. 괄호로 묶어 붙이면
      // 앞 번호의 내선처럼 읽히는데, 실제 값은 유선 전화번호다(02-710-9285 형태).
      snippet: snippet(
        [
          x.row.contact_phone,
          x.row.contact_ext ? `내선 ${x.row.contact_ext}` : null,
          x.row.contact_email,
          x.row.job_title,
          x.row.department_name,
        ]
          .filter(Boolean)
          .join(" / "),
      ),
      deepLink: `/dashboard/contacts`,
    }));
}

async function searchServices(
  supabase: SB,
  tokens: string[],
): Promise<Source[]> {
  const { data } = await supabase
    .from("services")
    .select(DOMAIN_SELECTS.services)
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    university_name: string;
    service_name: string;
    category: string | null;
    application_type: string | null;
    region: string | null;
  };
  const scored = (data as Row[]).map((r) => ({
    row: r,
    score: scoreText(
      [
        r.university_name,
        r.service_name,
        r.category,
        r.application_type,
        r.region,
      ]
        .filter(Boolean)
        .join(" "),
      tokens,
    ),
  }));
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "service" as const,
      id: x.row.id,
      title: `${x.row.university_name} — ${x.row.service_name}`,
      snippet: snippet(
        [x.row.category, x.row.application_type, x.row.region]
          .filter(Boolean)
          .join(" / "),
      ),
      deepLink: `/dashboard/services`,
    }));
}
