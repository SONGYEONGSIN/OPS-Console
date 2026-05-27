import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * 도메인별 키워드 검색 → Gemini context용 top-N row 추출.
 * MVP: 단순 token 매칭 + 점수. 추후 phase에서 임베딩으로 확장.
 */

export type SourceDomain =
  | "incident"
  | "handover"
  | "ai-tip"
  | "backup"
  | "contact"
  | "service";

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
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > SNIPPET_MAX_LEN
    ? trimmed.slice(0, SNIPPET_MAX_LEN) + "…"
    : trimmed;
}

type SearchInput = { question: string };

/**
 * 모든 도메인을 병렬 검색하여 도메인별 top-3 source 합쳐 반환.
 * RLS로 권한 있는 row만 조회됨 (cookies 기반 supabase client).
 */
export async function searchAllDomains(
  input: SearchInput,
): Promise<Source[]> {
  const tokens = tokenize(input.question);
  if (tokens.length === 0) return [];

  const supabase = await createClient();

  const [incidents, handovers, tips, backups, contacts, services] =
    await Promise.all([
      searchIncidents(supabase, tokens),
      searchHandovers(supabase, tokens),
      searchAiTips(supabase, tokens),
      searchBackups(supabase, tokens),
      searchContacts(supabase, tokens),
      searchServices(supabase, tokens),
    ]);

  return [...incidents, ...handovers, ...tips, ...backups, ...contacts, ...services];
}

type SB = Awaited<ReturnType<typeof createClient>>;

async function searchIncidents(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("incidents")
    .select(
      "id, title, university_name, category, cause_summary, root_cause, resolution, prevention",
    )
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

async function searchHandovers(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("handover_records")
    .select("id, title, body_md, target_email")
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    title: string | null;
    body_md: string | null;
    target_email: string | null;
  };
  const scored = (data as Row[]).map((r) => ({
    row: r,
    score: scoreText([r.title, r.body_md].filter(Boolean).join(" "), tokens),
  }));
  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: "handover" as const,
      id: x.row.id,
      title: x.row.title ?? "(인수인계)",
      snippet: snippet(x.row.body_md),
      deepLink: `/dashboard/handover`,
    }));
}

async function searchAiTips(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("ai_tips")
    .select(
      "id, title, summary, reuse_prompt, ai_tool, category, tags",
    )
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    title: string | null;
    summary: string | null;
    reuse_prompt: string | null;
    ai_tool: string | null;
    category: string | null;
    tags: string[] | null;
  };
  const scored = (data as Row[]).map((r) => {
    const haystack = [
      r.title,
      r.summary,
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
      snippet: snippet(x.row.summary ?? x.row.reuse_prompt),
      deepLink: `/dashboard/ai-tips`,
    }));
}

async function searchBackups(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("backup_requests")
    .select("id, title, summary_md, substitute_name")
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

async function searchContacts(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("contacts")
    .select(
      "id, customer_name, university_name, job_title, job_role, department_name",
    )
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];
  type Row = {
    id: string;
    customer_name: string;
    university_name: string;
    job_title: string | null;
    job_role: string | null;
    department_name: string | null;
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
      snippet: snippet(
        [x.row.job_title, x.row.department_name].filter(Boolean).join(" / "),
      ),
      deepLink: `/dashboard/contacts`,
    }));
}

async function searchServices(supabase: SB, tokens: string[]): Promise<Source[]> {
  const { data } = await supabase
    .from("services")
    .select(
      "id, university_name, service_name, category, application_type, region",
    )
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
