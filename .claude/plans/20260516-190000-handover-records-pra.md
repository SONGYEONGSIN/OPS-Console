---
plan_id: 20260516-190000-handover-records-pra
status: in_progress
created: 2026-05-16T19:00:00Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260516-183000-handover-menu.md
branch: feat/handover-records
phase: PR-A
---

# Plan: 인수인계 내용 (탭 1) — settings pattern (PR-A)

## Goal

`handover_records` 테이블 + `/dashboard/handover` 서비스 list + `/dashboard/handover/[serviceId]` settings pattern (좌측 카테고리 6 nav + 우측 form). 14 sub-field markdown textarea 저장. 탭 2(진행) / 탭 3(이력)은 별도 PR-B.

## Approach

- handover_records 테이블 신설 (service 1:1, 14 markdown 컬럼 + status)
- categories.ts에 카테고리 메타 single source-of-truth → CategoryNav / HandoverForm에서 import
- services left join으로 list 표시 + 작성 상태 chip
- 페이지 분리: list (`/handover`) vs detail (`/handover/[serviceId]`)
- 폼은 14 필드 *모두* client state 유지 → 저장 1회 upsert (변경 안 된 카테고리도 그대로 전송)

## Out of Scope

- 탭 2 인수인계 진행 wizard (PR-B)
- 탭 3 인수인계 확인 이력 (PR-B)
- 시트 22 row import (PR-C)
- 본인 운영 서비스만 작성 제한 (현재 admin/member 모두)
- PDF/메일 알림/첨부

## 영향 파일

```
T1 마이그 table ──┐
T2 마이그 RLS ────┤
T3 categories.ts ─┼──────────────────────┐
T4 schemas.ts ────┤                       │
                  ├─→ T5 queries ──→ T6 actions ─→ T7 tests
                  │                                       │
T8 HandoverTabs ──┤                                      │
T9 HandoverControls ─────────────────────────────────────┤
T10 page.tsx (list) ─────────────────────────────────────┤
T11 CategoryNav ──────────────┐                          │
T12 HandoverForm ──────────────┼─→ T13 [serviceId]/page.tsx ─→ T15 verify
T14 menu-counts + _data.ts ───┘
```

## 단계

### T1: 마이그 — handover_records 테이블

- **상태**: pending
- **파일**: `supabase/migrations/20260601_handover_records_table.sql` (신규)
- **변경**:
  ```sql
  begin;
  create table if not exists public.handover_records (
    id                 uuid primary key default gen_random_uuid(),
    service_id         uuid not null unique
                         references public.services(id) on delete cascade,
    contract_info_md   text,
    contract_data_md   text,
    work_basic_md      text,
    work_generator_md  text,
    work_site_md       text,
    work_output_md     text,
    work_rate_md       text,
    work_file_md       text,
    work_etc_md        text,
    payment_fee_md     text,
    payment_invoice_md text,
    school_contact_md  text,
    docs_md            text,
    notes_md           text,
    author_email       text not null,
    author_name        text not null,
    status             text not null default 'draft'
                         check (status in ('draft','ready','published')),
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
  );
  create index handover_records_service_idx on public.handover_records (service_id);
  create index handover_records_status_idx  on public.handover_records (status);
  notify pgrst, 'reload schema';
  commit;
  ```
- **DoD**: SQL Editor 적용 후 service_role로 `select count(*) from public.handover_records` → 0
- **의존**: 없음

### T2: 마이그 — RLS + GRANT

- **상태**: pending
- **파일**: `supabase/migrations/20260601b_handover_records_rls.sql` (신규)
- **변경**: backup_requests 패턴 mirror — authenticated read 모두 / admin·member insert·update / admin delete + GRANT
  ```sql
  begin;
  alter table public.handover_records enable row level security;

  drop policy if exists "handover_read_authenticated" on public.handover_records;
  create policy "handover_read_authenticated"
    on public.handover_records for select to authenticated using (true);

  drop policy if exists "handover_write_admin_member" on public.handover_records;
  create policy "handover_write_admin_member"
    on public.handover_records for insert to authenticated
    with check (exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission in ('admin','member')
    ));

  drop policy if exists "handover_update_admin_member" on public.handover_records;
  create policy "handover_update_admin_member"
    on public.handover_records for update to authenticated
    using (exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission in ('admin','member')
    ));

  drop policy if exists "handover_delete_admin" on public.handover_records;
  create policy "handover_delete_admin"
    on public.handover_records for delete to authenticated
    using (exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email'
        and o.status = 'active'
        and o.permission = 'admin'
    ));

  grant select on public.handover_records to authenticated;
  grant insert, update, delete on public.handover_records to authenticated;
  grant all on public.handover_records to service_role;

  notify pgrst, 'reload schema';
  commit;
  ```
- **DoD**: viewer로 insert 시도 → 차단 / admin·member insert → OK
- **의존**: T1

### T3: categories.ts — 카테고리 메타 single source-of-truth

- **상태**: pending
- **파일**: `src/features/handover/categories.ts` (신규)
- **변경**:
  ```ts
  export const HANDOVER_CATEGORIES = [
    {
      key: "contract",
      label: "계약",
      fields: [
        { key: "contract_info_md", label: "계약정보" },
        { key: "contract_data_md", label: "계약자료" },
      ],
    },
    {
      key: "work",
      label: "작업",
      fields: [
        { key: "work_basic_md", label: "기초작업" },
        { key: "work_generator_md", label: "생성툴" },
        { key: "work_site_md", label: "사이트·페이지" },
        { key: "work_output_md", label: "출력물" },
        { key: "work_rate_md", label: "경쟁률" },
        { key: "work_file_md", label: "전산파일" },
        { key: "work_etc_md", label: "기타" },
      ],
    },
    {
      key: "payment",
      label: "정산",
      fields: [
        { key: "payment_fee_md", label: "전형료" },
        { key: "payment_invoice_md", label: "계산서" },
      ],
    },
    { key: "contact", label: "연락처", fields: [{ key: "school_contact_md", label: "학교담당자" }] },
    { key: "docs", label: "서류제출", fields: [{ key: "docs_md", label: "서류제출" }] },
    { key: "etc", label: "기타", fields: [{ key: "notes_md", label: "특이사항" }] },
  ] as const;

  export type HandoverCategoryKey =
    | "contract"
    | "work"
    | "payment"
    | "contact"
    | "docs"
    | "etc";

  export type HandoverFieldKey =
    | "contract_info_md"
    | "contract_data_md"
    | "work_basic_md"
    | "work_generator_md"
    | "work_site_md"
    | "work_output_md"
    | "work_rate_md"
    | "work_file_md"
    | "payment_fee_md"
    | "payment_invoice_md"
    | "school_contact_md"
    | "docs_md"
    | "notes_md"
    | "work_etc_md";

  /** 14 필드 모두 nullable text. 초기 default = null */
  export const HANDOVER_FIELD_KEYS: readonly HandoverFieldKey[] = [
    "contract_info_md", "contract_data_md",
    "work_basic_md", "work_generator_md", "work_site_md", "work_output_md",
    "work_rate_md", "work_file_md", "work_etc_md",
    "payment_fee_md", "payment_invoice_md",
    "school_contact_md", "docs_md", "notes_md",
  ] as const;
  ```
- **DoD**: typecheck pass. unit test — 카테고리 6 + 합산 14 필드 검증
- **의존**: 없음

### T4: schemas.ts — zod schema

- **상태**: pending
- **파일**: `src/features/handover/schemas.ts` (신규)
- **변경**:
  ```ts
  import { z } from "zod";

  export const STATUS_VALUES = ["draft", "ready", "published"] as const;
  export const statusSchema = z.enum(STATUS_VALUES);
  export type HandoverStatus = z.infer<typeof statusSchema>;

  const mdField = z.string().max(10000).nullable().optional();

  export const handoverRecordRowSchema = z.object({
    id: z.string().uuid(),
    service_id: z.string().uuid(),
    contract_info_md: mdField,
    contract_data_md: mdField,
    work_basic_md: mdField,
    work_generator_md: mdField,
    work_site_md: mdField,
    work_output_md: mdField,
    work_rate_md: mdField,
    work_file_md: mdField,
    work_etc_md: mdField,
    payment_fee_md: mdField,
    payment_invoice_md: mdField,
    school_contact_md: mdField,
    docs_md: mdField,
    notes_md: mdField,
    author_email: z.string().email(),
    author_name: z.string().min(1),
    status: statusSchema,
    created_at: z.string(),
    updated_at: z.string(),
  });

  export type HandoverRecordRow = z.infer<typeof handoverRecordRowSchema>;

  /** upsert input — 14 필드 모두 optional. service_id로 매칭 (unique constraint) */
  export const handoverRecordUpsertSchema = z.object({
    service_id: z.string().uuid(),
    contract_info_md: mdField,
    contract_data_md: mdField,
    work_basic_md: mdField,
    work_generator_md: mdField,
    work_site_md: mdField,
    work_output_md: mdField,
    work_rate_md: mdField,
    work_file_md: mdField,
    work_etc_md: mdField,
    payment_fee_md: mdField,
    payment_invoice_md: mdField,
    school_contact_md: mdField,
    docs_md: mdField,
    notes_md: mdField,
  });
  export type HandoverRecordUpsert = z.infer<typeof handoverRecordUpsertSchema>;
  ```
- **DoD**: unit test — row parse / upsert parse 정상·거부 케이스
- **의존**: 없음

### T5: queries.ts — services left join handover_records

- **상태**: pending
- **파일**: `src/features/handover/queries.ts` (신규)
- **변경**:
  ```ts
  import "server-only";
  import { createClient } from "@/lib/supabase/server";
  import {
    handoverRecordRowSchema,
    type HandoverRecordRow,
    type HandoverStatus,
  } from "./schemas";

  export type ListInput = {
    q?: string;
    status?: HandoverStatus | "none"; // none = 작성 안 됨
    page?: number;
    pageSize?: number;
  };

  const DEFAULT_PAGE_SIZE = 30;

  export type HandoverListRow = {
    service_id: string;
    service_number: number;
    university_name: string;
    service_name: string;
    application_type: string;
    operator_name: string | null;
    handover_status: HandoverStatus | null; // null = 미작성
  };

  export async function listServicesWithHandover(
    input: ListInput = {},
  ): Promise<{ rows: HandoverListRow[]; total: number }> {
    const supabase = await createClient();
    let q = supabase
      .from("services")
      .select(
        "id, service_id, university_name, service_name, application_type, operator_name, handover_records(status)",
        { count: "exact" },
      )
      .order("service_id", { ascending: true });

    if (input.q) {
      const like = `%${input.q}%`;
      q = q.or(`university_name.ilike.${like},service_name.ilike.${like}`);
    }

    const page = Math.max(1, input.page ?? 1);
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
    q = q.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error, count } = await q;
    if (error) {
      console.error("[listServicesWithHandover]", error);
      return { rows: [], total: 0 };
    }

    type RawRow = {
      id: string;
      service_id: number;
      university_name: string;
      service_name: string;
      application_type: string;
      operator_name: string | null;
      handover_records: { status: HandoverStatus }[] | null;
    };
    const rows: HandoverListRow[] = (data as RawRow[] | null ?? []).map((r) => ({
      service_id: r.id,
      service_number: r.service_id,
      university_name: r.university_name,
      service_name: r.service_name,
      application_type: r.application_type,
      operator_name: r.operator_name,
      handover_status: r.handover_records?.[0]?.status ?? null,
    }));

    // status 필터는 client-side (left join 결과)
    const filtered = input.status
      ? rows.filter((r) =>
          input.status === "none"
            ? r.handover_status === null
            : r.handover_status === input.status,
        )
      : rows;

    return { rows: filtered, total: count ?? 0 };
  }

  export async function getHandoverByServiceId(
    serviceId: string,
  ): Promise<HandoverRecordRow | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("handover_records")
      .select("*")
      .eq("service_id", serviceId)
      .maybeSingle();
    if (error) {
      console.error("[getHandoverByServiceId]", error);
      return null;
    }
    if (!data) return null;
    const r = handoverRecordRowSchema.safeParse(data);
    if (!r.success) {
      console.error("[getHandoverByServiceId] zod fail:", r.error.issues);
      return null;
    }
    return r.data;
  }
  ```
- **DoD**: unit test (mock supabase) — q 필터, pagination, status none/ready/published 필터, getById 정상/null
- **의존**: T4

### T6: actions.ts — upsertHandoverRecord

- **상태**: pending
- **파일**: `src/features/handover/actions.ts` (신규)
- **변경**:
  ```ts
  "use server";
  import { revalidatePath } from "next/cache";
  import { createClient } from "@/lib/supabase/server";
  import { getCurrentOperator } from "@/features/auth/queries";
  import {
    handoverRecordUpsertSchema,
    type HandoverRecordRow,
    type HandoverStatus,
  } from "./schemas";
  import { HANDOVER_FIELD_KEYS } from "./categories";

  export type UpsertResult =
    | { ok: true; row: HandoverRecordRow }
    | { ok: false; error: string };

  const AUTH_ERROR = "로그인이 필요합니다.";

  export async function upsertHandoverRecord(
    input: unknown,
  ): Promise<UpsertResult> {
    const me = await getCurrentOperator();
    if (!me) return { ok: false, error: AUTH_ERROR };

    const parsed = handoverRecordUpsertSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
    }

    // 14 필드 중 1개 이상 채워졌으면 'draft' 또는 'ready'
    const allFilled = HANDOVER_FIELD_KEYS.every((k) => {
      const v = parsed.data[k];
      return v != null && String(v).trim().length > 0;
    });
    const anyFilled = HANDOVER_FIELD_KEYS.some((k) => {
      const v = parsed.data[k];
      return v != null && String(v).trim().length > 0;
    });
    const status: HandoverStatus = !anyFilled
      ? "draft"
      : allFilled
        ? "ready"
        : "draft";

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("handover_records")
      .upsert(
        {
          ...parsed.data,
          author_email: me.email,
          author_name: me.displayName ?? me.email,
          status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "service_id" },
      )
      .select()
      .single();

    if (error) return { ok: false, error: error.message };

    revalidatePath("/dashboard/handover");
    revalidatePath(`/dashboard/handover/${parsed.data.service_id}`);
    return { ok: true, row: data as HandoverRecordRow };
  }
  ```
- **DoD**: unit test — 비인증 차단 / zod fail / 14 필드 모두 비었으면 status=draft / 모두 채우면 status=ready / 일부만 채우면 status=draft / upsert payload에 author_*, status 포함
- **의존**: T3, T4, T5

### T7: features/handover/__tests__ — categories / schemas / queries / actions 통합

- **상태**: pending
- **파일**: `src/features/handover/__tests__/{categories,schemas,queries,actions}.test.ts` (신규)
- **변경**: 위 T3~T6 DoD 케이스 통합 실행
- **DoD**: `npx vitest run src/features/handover/__tests__/` 모두 PASS
- **의존**: T3, T4, T5, T6

### T8: HandoverTabs.tsx — 3탭 nav (client)

- **상태**: pending
- **파일**: `src/app/dashboard/handover/HandoverTabs.tsx` (신규)
- **변경**:
  ```tsx
  "use client";
  import Link from "next/link";
  import { useSearchParams } from "next/navigation";

  const TABS = [
    { key: "content", label: "인수인계 내용" },
    { key: "progress", label: "인수인계 진행" },
    { key: "history", label: "인수인계 확인" },
  ] as const;

  export function HandoverTabs() {
    const params = useSearchParams();
    const active = params.get("tab") ?? "content";
    return (
      <div className="flex gap-1 border-b border-line-soft">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={t.key === "content" ? "/dashboard/handover" : `/dashboard/handover?tab=${t.key}`}
              className={`-mb-px px-4 py-2 text-sm ${
                isActive
                  ? "border-b-2 border-vermilion font-semibold text-vermilion"
                  : "border-b-2 border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    );
  }
  ```
- **DoD**: 신규 unit test — 활성 tab 검증, click 시 href 검증
- **의존**: 없음

### T9: HandoverControls.tsx — 검색 + 작성상태 필터 (client)

- **상태**: pending
- **파일**: `src/app/dashboard/handover/HandoverControls.tsx` (신규)
- **변경**: services 패턴 mirror — `ListSearch` + `ListSelect`
  ```tsx
  "use client";
  import { useEffect, useState } from "react";
  import { useRouter, useSearchParams, usePathname } from "next/navigation";
  import { ListSearch } from "@/components/common/ListSearch";
  import { ListSelect } from "@/components/common/ListSelect";

  const STATUS_OPTIONS = ["미작성", "draft", "ready", "published"] as const;

  const DEBOUNCE_MS = 300;

  export function HandoverControls() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const [q, setQ] = useState(params.get("q") ?? "");
    const status = params.get("status") ?? "";

    useEffect(() => {
      const current = params.get("q") ?? "";
      if (q === current) return;
      const id = setTimeout(() => {
        const next = new URLSearchParams(params.toString());
        if (q.trim()) next.set("q", q.trim());
        else next.delete("q");
        next.delete("page");
        router.push(`${pathname}?${next.toString()}`);
      }, DEBOUNCE_MS);
      return () => clearTimeout(id);
    }, [q, pathname, params, router]);

    function navigate(updates: Record<string, string | null>) {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v == null || v === "") next.delete(k);
        else next.set(k, v);
      }
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    }

    return (
      <div className="flex flex-wrap items-center gap-2 px-7 pt-3">
        <ListSearch
          value={q}
          onChange={setQ}
          placeholder="대학명·서비스명 검색"
          ariaLabel="인수인계 검색"
        />
        <ListSelect
          value={status}
          onChange={(v) => navigate({ status: v || null })}
          options={STATUS_OPTIONS}
          placeholder="작성상태 전체"
          ariaLabel="작성상태 필터"
        />
      </div>
    );
  }
  ```
- **DoD**: unit test (services controls 패턴 mirror) — 검색 debounce push, status select push
- **의존**: 없음

### T10: app/dashboard/handover/page.tsx — 화면 1 (서비스 list)

- **상태**: pending
- **파일**: `src/app/dashboard/handover/page.tsx` (신규)
- **변경**: server component. 탭 nav + Controls + Table (Link 사용)
  ```tsx
  import Link from "next/link";
  import { findSidebarMeta } from "../_data";
  import { resolvePageMeta } from "../_data/page-meta-derive";
  import { PageHeader } from "../_components/page-header/PageHeader";
  import { ListPagination } from "@/components/common/ListPagination";
  import { HandoverTabs } from "./HandoverTabs";
  import { HandoverControls } from "./HandoverControls";
  import { requireMenu } from "@/features/auth/menu-guard";
  import { listServicesWithHandover } from "@/features/handover/queries";
  import type { HandoverStatus } from "@/features/handover/schemas";

  const PAGE_SIZE = 30;

  const STATUS_TONE: Record<HandoverStatus | "none", string> = {
    none: "bg-washi-raised text-muted",
    draft: "bg-vermilion/15 text-vermilion",
    ready: "bg-sage/15 text-sage",
    published: "bg-ink/10 text-ink",
  };
  const STATUS_LABEL: Record<HandoverStatus | "none", string> = {
    none: "미작성",
    draft: "작성중",
    ready: "작성완료",
    published: "인계완료",
  };

  type SearchParams = { q?: string; status?: string; page?: string; tab?: string };

  export default async function HandoverPage({
    searchParams,
  }: {
    searchParams: Promise<SearchParams>;
  }) {
    const slug = "handover";
    await requireMenu(slug);

    const params = await searchParams;
    const meta = findSidebarMeta(slug);
    if (!meta) return null;
    const pathname = `/dashboard/${slug}`;
    const config = resolvePageMeta(slug, meta);

    const tab = params.tab ?? "content";
    if (tab !== "content") {
      // PR-B에서 구현. 임시로 빈 상태 표시
      return (
        <div>
          <PageHeader
            pathname={pathname}
            meta={config.meta}
            headline={config.headline}
            description={config.description}
          />
          <HandoverTabs />
          <div className="p-7 text-sm text-muted">PR-B에서 구현 예정</div>
        </div>
      );
    }

    const page = Math.max(1, Number(params.page) || 1);
    const statusParam = (params.status ?? "") as HandoverStatus | "none" | "";
    const { rows, total } = await listServicesWithHandover({
      q: params.q,
      status: statusParam || undefined,
      page,
      pageSize: PAGE_SIZE,
    });

    return (
      <div>
        <PageHeader
          pathname={pathname}
          meta={config.meta}
          headline={config.headline}
          description={config.description}
        />
        <HandoverTabs />
        <HandoverControls />
        <section className="p-7">
          <div className="overflow-x-auto border border-line-soft">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-washi-raised text-left text-xs uppercase tracking-[0.06em] text-muted">
                  <th className="px-3 py-2">대학명·서비스</th>
                  <th className="px-3 py-2">운영자</th>
                  <th className="px-3 py-2">접수구분</th>
                  <th className="px-3 py-2">작성상태</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      데이터 없음
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const key = (r.handover_status ?? "none") as keyof typeof STATUS_TONE;
                    return (
                      <tr key={r.service_id} className="border-b border-line-soft hover:bg-washi-raised">
                        <td className="px-3 py-2">
                          <Link href={`/dashboard/handover/${r.service_id}`} className="block">
                            <span className="font-medium text-ink">{r.university_name}</span>
                            <span className="ml-1 text-xs text-muted">· {r.service_name}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs text-ink-soft">{r.operator_name ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-ink-soft">{r.application_type}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[key]}`}>
                            {STATUS_LABEL[key]}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <ListPagination total={total} pageSize={PAGE_SIZE} />
        </section>
      </div>
    );
  }
  ```
- **DoD**: 로컬 `/dashboard/handover` 진입 시 services 30 row + 작성상태 chip(모두 "미작성") + 페이지네이션 노출
- **의존**: T5, T8, T9

### T11: CategoryNav.tsx — settings pattern 좌측 카테고리 (client)

- **상태**: pending
- **파일**: `src/app/dashboard/handover/[serviceId]/CategoryNav.tsx` (신규)
- **변경**:
  ```tsx
  "use client";
  import Link from "next/link";
  import { usePathname, useSearchParams } from "next/navigation";
  import { HANDOVER_CATEGORIES, type HandoverCategoryKey } from "@/features/handover/categories";

  export function CategoryNav() {
    const pathname = usePathname();
    const params = useSearchParams();
    const active = (params.get("cat") ?? "contract") as HandoverCategoryKey;

    return (
      <nav aria-label="카테고리" className="border-r border-line-soft py-4">
        {HANDOVER_CATEGORIES.map((c) => {
          const isActive = c.key === active;
          const href = `${pathname}?cat=${c.key}`;
          return (
            <Link
              key={c.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2 px-6 py-3 text-sm ${
                isActive
                  ? "bg-vermilion/10 font-semibold text-vermilion"
                  : "text-ink-soft hover:bg-washi-raised hover:text-ink"
              }`}
            >
              <span className={isActive ? "text-vermilion" : "text-muted"}>
                {isActive ? "⊙" : "·"}
              </span>
              {c.label}
            </Link>
          );
        })}
      </nav>
    );
  }
  ```
- **DoD**: unit test — default active=contract, ?cat=work 시 active=work, click 시 href 변경
- **의존**: T3

### T12: HandoverForm.tsx — 우측 form (client, 14 필드 client state)

- **상태**: pending
- **파일**: `src/app/dashboard/handover/[serviceId]/HandoverForm.tsx` (신규)
- **변경**:
  ```tsx
  "use client";
  import { useState, useTransition } from "react";
  import { useRouter, useSearchParams } from "next/navigation";
  import {
    HANDOVER_CATEGORIES,
    HANDOVER_FIELD_KEYS,
    type HandoverCategoryKey,
    type HandoverFieldKey,
  } from "@/features/handover/categories";
  import { upsertHandoverRecord } from "@/features/handover/actions";

  type Props = {
    serviceId: string;
    initial: Record<HandoverFieldKey, string | null>;
  };

  export function HandoverForm({ serviceId, initial }: Props) {
    const router = useRouter();
    const params = useSearchParams();
    const active = (params.get("cat") ?? "contract") as HandoverCategoryKey;
    const [values, setValues] = useState<Record<HandoverFieldKey, string>>(() => {
      const v = {} as Record<HandoverFieldKey, string>;
      for (const k of HANDOVER_FIELD_KEYS) v[k] = initial[k] ?? "";
      return v;
    });
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);

    const dirty = HANDOVER_FIELD_KEYS.some(
      (k) => values[k] !== (initial[k] ?? ""),
    );

    const cat = HANDOVER_CATEGORIES.find((c) => c.key === active)!;

    function setField(k: HandoverFieldKey, v: string) {
      setValues((prev) => ({ ...prev, [k]: v }));
    }

    function handleSave() {
      setError(null);
      const payload: Record<string, unknown> = { service_id: serviceId };
      for (const k of HANDOVER_FIELD_KEYS) {
        payload[k] = values[k].trim() === "" ? null : values[k];
      }
      startTransition(async () => {
        const r = await upsertHandoverRecord(payload);
        if (!r.ok) setError(r.error);
        else router.refresh();
      });
    }

    return (
      <div className="p-10">
        <h2 className="mb-8 text-2xl font-bold text-ink">{cat.label}</h2>
        {cat.fields.map((f) => (
          <label key={f.key} className="mb-7 grid grid-cols-[120px_1fr] items-start gap-4">
            <span className="pt-2 text-sm text-ink-soft">{f.label}</span>
            <textarea
              aria-label={f.label}
              value={values[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              rows={5}
              maxLength={10000}
              className="w-full border border-line bg-transparent px-3 py-2 text-sm text-ink"
            />
          </label>
        ))}
        {error && <p className="mb-3 text-sm text-vermilion">{error}</p>}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || isPending}
            className="border border-ink bg-ink px-8 py-2.5 text-sm text-cream disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/handover")}
            className="border border-line bg-transparent px-8 py-2.5 text-sm text-ink"
          >
            취소
          </button>
        </div>
      </div>
    );
  }
  ```
- **DoD**: unit test —
  - default cat=contract, 2 필드 textarea 노출
  - ?cat=work, 7 필드 textarea 노출
  - textarea 변경 → dirty=true, 저장 버튼 enabled
  - 저장 클릭 → upsertHandoverRecord 호출 (payload 검증 — service_id + 14 필드)
- **의존**: T3, T6

### T13: app/dashboard/handover/[serviceId]/page.tsx — 화면 2/3 shell

- **상태**: pending
- **파일**: `src/app/dashboard/handover/[serviceId]/page.tsx` (신규)
- **변경**:
  ```tsx
  import Link from "next/link";
  import { findSidebarMeta } from "../../_data";
  import { resolvePageMeta } from "../../_data/page-meta-derive";
  import { PageHeader } from "../../_components/page-header/PageHeader";
  import { HandoverTabs } from "../HandoverTabs";
  import { CategoryNav } from "./CategoryNav";
  import { HandoverForm } from "./HandoverForm";
  import { requireMenu } from "@/features/auth/menu-guard";
  import { getHandoverByServiceId } from "@/features/handover/queries";
  import { getServiceById } from "@/features/services/queries";
  import { HANDOVER_FIELD_KEYS, type HandoverFieldKey } from "@/features/handover/categories";

  type Props = { params: Promise<{ serviceId: string }> };

  export default async function HandoverDetailPage({ params }: Props) {
    const slug = "handover";
    await requireMenu(slug);

    const { serviceId } = await params;
    const meta = findSidebarMeta(slug);
    if (!meta) return null;
    const pathname = "/dashboard/handover";
    const config = resolvePageMeta(slug, meta);

    const service = await getServiceById(serviceId);
    if (!service) {
      return (
        <div className="p-7">
          <Link href="/dashboard/handover" className="text-sm text-vermilion">
            ← 서비스 목록
          </Link>
          <p className="mt-4 text-muted">서비스를 찾을 수 없습니다.</p>
        </div>
      );
    }

    const record = await getHandoverByServiceId(serviceId);
    const initial = {} as Record<HandoverFieldKey, string | null>;
    for (const k of HANDOVER_FIELD_KEYS) initial[k] = record?.[k] ?? null;

    return (
      <div>
        <PageHeader
          pathname={pathname}
          meta={config.meta}
          headline={`${service.university_name} · ${service.service_name}`}
          description={`운영자 ${service.operator_name ?? "—"} · ${service.application_type}`}
        />
        <div className="px-7 pt-4">
          <Link href="/dashboard/handover" className="text-sm text-vermilion">
            ← 서비스 목록
          </Link>
        </div>
        <HandoverTabs />
        <div className="grid grid-cols-[280px_1fr] border-t border-line-soft">
          <CategoryNav />
          <HandoverForm serviceId={serviceId} initial={initial} />
        </div>
      </div>
    );
  }
  ```
- **DoD**: 로컬 `/dashboard/handover/{service_id}` 진입 → settings pattern shell + textarea 노출. `?cat=work` → 우측 form 7 필드로 갱신
- **의존**: T10, T11, T12. `getServiceById` 존재 가정 (없으면 services queries 확인 + 추가)

### T14: menu-counts + _data.ts — handover count 추가

- **상태**: pending
- **파일**: `src/features/menu-counts/queries.ts` + `src/app/dashboard/_data.ts`
- **변경**:
  - `menu-counts/queries.ts`: `countOf("handover", supabase.from("handover_records").select("*", head).neq("status", "draft"))` 추가 (draft 제외 카운트)
  - `_data.ts`: handover slug의 `count: "..."` → `count: ""`로 변경 (menu-counts가 채움)
- **DoD**: 사이드바 handover count 동적 (ready/published 합)
- **의존**: T1 (테이블 존재)

### T15: 회귀 + verify + 로컬 확인

- **상태**: pending
- **파일**: 신규 없음
- **변경**: `npm run lint && npx tsc --noEmit && npm test`
- **DoD**:
  - 모든 unit PASS (handover __tests__ 포함)
  - typecheck 0 / lint 0 error
  - 로컬 dev:
    - `/dashboard/handover` 진입 → 서비스 list 30 row + 페이지네이션
    - row click → `/dashboard/handover/{id}` 진입
    - 좌측 카테고리 6개 + ⊙ active
    - 우측 form 카테고리별 필드 노출 (계약 2, 작업 7, ...)
    - textarea 입력 → 저장 버튼 enable
    - 저장 → status 자동 (anyFilled→draft, allFilled→ready)
    - 사이드바 handover count 동적
- **의존**: T1~T14

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| 마이그 prod 미적용 상태 머지 → 런타임 schema mismatch | PR 본문에 "SQL Editor 수동 적용" 명시 + 자동 schema 검증 스크립트 |
| `getServiceById` 미존재 | T13 진입 시 services queries에 헬퍼 추가 (단순 maybeSingle) |
| 14 필드 client state — page refresh로 메모리 손실 | T6 저장 후 `router.refresh()`로 server state 동기. 다른 경로로 leave 시 dirty 경고는 후속 |
| left join handover_records — 한 service에 record 여러 개 가능성? | service_id `unique` 제약으로 1개만. supabase 응답 array `[0]` 안전 |
| 카테고리 nav 클릭 시 URL 변경 + form state 보존 | client state는 router 변경 시 unmount 안 되므로 유지. SSR 진입 시만 initial 다시 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-16T19:00:00Z | — | plan 생성 | brainstorm 20260516-183000 입력 |
