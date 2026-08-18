import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeToolRequest } from "@/features/assistant/tool-auth";
import {
  FETCH_CONFIG,
  buildFullText,
  type FetchConfig,
} from "@/features/assistant/fetch-ops";
import type { SourceDomain } from "@/features/assistant/search";

/**
 * 어시스턴트 도구 — 레코드 **전문** 조회. `Authorization: Bearer ${CRON_SECRET}`.
 *
 * `search_ops`는 200자 발췌만 준다. 어시스턴트가 2026-08-18에 그 한계를 직접
 * 진단해 gap으로 남겼다 — "레코드 ID로 전문을 읽는 도구가 필요하다".
 * 검색이 전문을 뱉으면 여러 건 검색할 때 컨텍스트가 터지므로 도구를 갈랐다.
 *
 * 설계: docs/superpowers/specs/2026-08-18-assistant-tools-design.md
 */

const DOMAINS = Object.keys(FETCH_CONFIG) as [SourceDomain, ...SourceDomain[]];

const querySchema = z.object({
  // 모르는 도메인을 조용히 빈 결과로 만들지 않는다 — 모델이 "없다"고 답해버린다.
  domain: z.enum(DOMAINS),
  id: z.string().trim().min(1, "id는 필수"),
  as: z.string().trim().min(1, "as는 필수"),
});

/** 설정의 select 문자열 — id·제목·본문 컬럼과 조인을 합친다. */
function selectFor(cfg: FetchConfig): string {
  const cols = [
    cfg.idColumn,
    ...cfg.titleFields,
    ...cfg.bodyFields.map((f) => f.key),
  ];
  return cfg.embed ? `${cols.join(", ")}, ${cfg.embed}` : cols.join(", ");
}

function titleFor(cfg: FetchConfig, row: Record<string, unknown>): string {
  if (cfg.titleFields.length > 0) {
    const parts = cfg.titleFields
      .map((k) => row[k])
      .filter((v): v is string => typeof v === "string" && Boolean(v.trim()));
    if (parts.length > 0) return parts.join(" — ");
  }
  // 인수인계는 제목 컬럼이 없어 서비스에서 가져온다.
  const svc = row.services as
    | { university_name?: string | null; service_name?: string | null }
    | null
    | undefined;
  const joined = [svc?.university_name, svc?.service_name]
    .filter(Boolean)
    .join(" — ");
  return joined || "(제목 없음)";
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    domain: sp.get("domain") ?? undefined,
    id: sp.get("id") ?? undefined,
    as: sp.get("as") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: operator } = await admin
    .from("operators")
    .select("email, permission, status")
    .eq("email", parsed.data.as)
    .maybeSingle();

  const auth = authorizeToolRequest(
    operator as { permission: string | null; status: string | null } | null,
  );
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }
  if (!auth.allowed.has(parsed.data.domain)) {
    return NextResponse.json(
      { ok: false, error: "이 권한으로는 볼 수 없는 자료입니다" },
      { status: 403 },
    );
  }

  const cfg = FETCH_CONFIG[parsed.data.domain];
  const { data: row } = await admin
    .from(cfg.table)
    .select(selectFor(cfg))
    .eq(cfg.idColumn, parsed.data.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { ok: false, error: "해당 레코드를 찾지 못했습니다" },
      { status: 404 },
    );
  }

  const record = row as unknown as Record<string, unknown>;
  const body = buildFullText(record, cfg.bodyFields);
  return NextResponse.json({
    ok: true,
    domain: parsed.data.domain,
    id: parsed.data.id,
    title: titleFor(cfg, record),
    body,
    // 빈 문자열만 주면 모델이 "내용이 없다"와 "못 읽었다"를 구분 못 한다.
    empty: body.length === 0,
  });
}
