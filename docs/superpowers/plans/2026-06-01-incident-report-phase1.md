# 경위서(Incident Report) 1차 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사고(incidents) 1건에서 경위서를 생성해 4섹션을 다듬고, 팀장 승인을 거쳐 고객에게 PDF/Word를 메일로 발송하는 도메인을 OPS Console 안에 추가한다. (SharePoint 연동은 2차)

**Architecture:** 신규 `incident_reports` 테이블 + `incident_report_mail_sends` 이력. incidents 패턴(zod schema → queries → Server Actions)을 그대로 따른다. 결재라인은 operators 테이블 조회로 계산. 문서는 `@react-pdf/renderer`(PDF)와 신규 `docx`(Word) 두 경로로 생성, 메일은 기존 `sendGraphMail`(운영자 메일박스) 재사용. UI는 list-variants에 `incident-reports` variant 1개 신설 + 자료보관 사이드바 등록.

**Tech Stack:** Next.js App Router, TypeScript, Supabase(@supabase/ssr), zod, @react-pdf/renderer, **docx(신규)**, Microsoft Graph sendMail, Vitest.

**Spec:** `docs/refs/경위서-메뉴-설계노트.md` (확정본)

---

## File Structure

**DB 마이그레이션**
- Create `supabase/migrations/20260601_incident_reports.sql` — incident_reports 테이블 + 인덱스 + set_updated_at 트리거
- Create `supabase/migrations/20260601b_incident_reports_rls.sql` — RLS 정책 + GRANT
- Create `supabase/migrations/20260601c_incident_report_mail_sends.sql` — 이력 테이블 + RLS
- Create `supabase/migrations/20260601d_operators_role_expand.sql` — operators.role check 제약에 본부장/사장 추가

**features/incident-reports**
- Create `src/features/incident-reports/schemas.ts` — zod row/create/update + status enum
- Create `src/features/incident-reports/queries.ts` — list/get + `resolveApprovalChain` + contacts 수신자 조회
- Create `src/features/incident-reports/actions.ts` — create/update/submit/approve/reject/send
- Create `src/features/incident-reports/mail-actions.ts` — sendIncidentReport 메일 + 이력
- Create `src/features/incident-reports/mail-template.ts` — 고객 발송 HTML 본문
- Create `src/features/incident-reports/__tests__/*.test.ts` — 단위 테스트

**문서 생성**
- Modify `package.json` — `docx` 의존성 추가
- Create `src/lib/pdf/incident-report-pdf.tsx` — 공문+경위서 2장 PDF → Buffer
- Create `src/lib/docx/incident-report-docx.ts` — 동일 2장 Word → Buffer
- Create `src/lib/pdf/__tests__/incident-report-pdf.test.ts` / `src/lib/docx/__tests__/incident-report-docx.test.ts`

**operators schema (앱 레벨)**
- Modify `src/features/operators/schemas.ts` — `operatorRoleSchema`에 본부장/사장 추가

**UI (list-variants)**
- Create `src/app/dashboard/_components/inspector/list-variants/incident-reports/{filters.ts,View.tsx,EditForm.tsx,Table.tsx}`
- Modify `.../list-variants/types.ts` — Variant union에 "incident-reports" 추가
- Modify `.../list-variants/registry.ts` — import + 엔트리 1개
- Modify `.../patterns/ListPattern.tsx` (ListRow 타입) — incidentReport* 필드 추가
- Create `src/app/dashboard/incident-reports/page.tsx` + `_row-mapper.ts` — 페이지 + DB row → ListRow 매핑
- Modify `src/app/dashboard/_data*` (sidebar) — 자료보관 그룹에 "경위서" slug 추가
- Modify page-meta-config — incident-reports 메타 등록

---

## Task 1: DB 마이그레이션 — incident_reports 테이블

**Files:**
- Create: `supabase/migrations/20260601_incident_reports.sql`
- Create: `supabase/migrations/20260601b_incident_reports_rls.sql`

- [ ] **Step 1: 테이블 마이그레이션 작성**

`supabase/migrations/20260601_incident_reports.sql`:
```sql
-- incident_reports — 경위서 도메인 (1차)
-- 사고(incidents)에서 생성하는 문서화→결재→발송 레이어. 4섹션 스냅샷 + 결재라인 + 상태.
-- SharePoint 연동(doc_number 채번/업로드)은 2차 — doc_number는 1차에서 null 허용.

begin;

create table if not exists public.incident_reports (
  id                  uuid primary key default gen_random_uuid(),
  incident_id         uuid references public.incidents(id) on delete set null,
  recipient_university text not null,
  title               text not null,
  draft_date          date not null default current_date,
  -- 4섹션 스냅샷 (incidents에서 복사, 편집 가능)
  gyeongwi            text,   -- 1. 경위
  cause               text,   -- 2. 원인
  handling            text,   -- 3. 처리
  prevention          text,   -- 4. 향후 대책
  apology             text,   -- 공문 사과 본문 (기본값 생성 후 편집)
  -- 결재라인 스냅샷
  author_name         text not null,
  author_email        text not null,
  approver_name       text,
  approver_email      text,
  director_name       text,   -- 본부장
  ceo_name            text,   -- 사장
  -- 상태
  status              text not null default 'draft'
                      check (status in ('draft','pending_approval','approved','rejected','sent')),
  reject_reason       text,
  approved_at         timestamptz,
  -- 발송 수신 스냅샷 (contacts에서 선택)
  recipient_emails    text[] not null default '{}',
  -- 2차: 시행번호 (1차 null)
  doc_number          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists incident_reports_incident_id_idx on public.incident_reports (incident_id);
create index if not exists incident_reports_status_idx       on public.incident_reports (status);
create index if not exists incident_reports_created_at_idx   on public.incident_reports (created_at desc);

drop trigger if exists incident_reports_set_updated_at on public.incident_reports;
create trigger incident_reports_set_updated_at
before update on public.incident_reports
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.incident_reports;  -- → 0
-- select column_name from information_schema.columns
--  where table_schema='public' and table_name='incident_reports';  -- → 24 columns
```

- [ ] **Step 2: RLS 마이그레이션 작성**

`supabase/migrations/20260601b_incident_reports_rls.sql`:
```sql
-- incident_reports RLS — read 전체(운영부 공개), 작성/수정 본인, 승인 팀장, 발송 작성자/admin.
begin;

alter table public.incident_reports enable row level security;

-- 읽기: authenticated 전체
drop policy if exists incident_reports_read on public.incident_reports;
create policy incident_reports_read on public.incident_reports
  for select to authenticated using (true);

-- 작성: authenticated insert (author_email 본인은 app action에서 보장)
drop policy if exists incident_reports_insert on public.incident_reports;
create policy incident_reports_insert on public.incident_reports
  for insert to authenticated with check (true);

-- 수정: 작성자 본인(draft/rejected) 또는 승인자(팀장) 또는 admin
--   세밀한 상태 가드는 Server Action에서 수행. RLS는 행 소유 가드만.
drop policy if exists incident_reports_update on public.incident_reports;
create policy incident_reports_update on public.incident_reports
  for update to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or approver_email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email' and o.permission = 'admin'
    )
  );

-- 삭제: 작성자 본인 또는 admin
drop policy if exists incident_reports_delete on public.incident_reports;
create policy incident_reports_delete on public.incident_reports
  for delete to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email' and o.permission = 'admin'
    )
  );

grant select, insert, update, delete on public.incident_reports to authenticated;

notify pgrst, 'reload schema';
commit;
```

- [ ] **Step 3: 적용 + 검증**

DB 적용 (메모리 [[db-migration-apply]] 참조 — Supabase CLI 없음):
```bash
psql "$DATABASE_URL" --no-save -f supabase/migrations/20260601_incident_reports.sql
psql "$DATABASE_URL" --no-save -f supabase/migrations/20260601b_incident_reports_rls.sql
psql "$DATABASE_URL" --no-save -c "select count(*) from public.incident_reports;"
```
Expected: `count = 0`, 에러 없음.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260601_incident_reports.sql supabase/migrations/20260601b_incident_reports_rls.sql
git commit -m "feat(incident-reports): incident_reports 테이블 + RLS 마이그레이션"
```

---

## Task 2: DB 마이그레이션 — 이력 테이블 + operators role 확장

**Files:**
- Create: `supabase/migrations/20260601c_incident_report_mail_sends.sql`
- Create: `supabase/migrations/20260601d_operators_role_expand.sql`

- [ ] **Step 1: 이력 테이블 작성** (incident_mail_sends 구조 그대로)

`supabase/migrations/20260601c_incident_report_mail_sends.sql`:
```sql
-- 경위서 고객 발송 이력. backup_request_mail_sends / incident_mail_sends 동일 구조.
begin;

create table if not exists public.incident_report_mail_sends (
  id                  uuid primary key default gen_random_uuid(),
  sent_at             timestamptz not null default now(),
  sender_operator_id  uuid references public.operators(id) on delete set null,
  report_id           uuid references public.incident_reports(id) on delete cascade,
  recipient_email     text not null,
  recipient_name      text,
  graph_message_id    text,
  status              text not null check (status in ('sent','failed','dry_run')),
  error_message       text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists irms_report_id_idx on public.incident_report_mail_sends (report_id);

drop trigger if exists irms_set_updated_at on public.incident_report_mail_sends;
create trigger irms_set_updated_at
before update on public.incident_report_mail_sends
for each row execute function public.set_updated_at();

alter table public.incident_report_mail_sends enable row level security;
drop policy if exists irms_read on public.incident_report_mail_sends;
create policy irms_read on public.incident_report_mail_sends
  for select to authenticated using (true);
-- insert는 service_role(server action)만 → authenticated insert 정책 미부여

grant select on public.incident_report_mail_sends to authenticated;

notify pgrst, 'reload schema';
commit;
```

- [ ] **Step 2: operators role 확장**

먼저 기존 제약 확인:
```bash
psql "$DATABASE_URL" --no-save -c "\d+ public.operators" | grep -i role
```
role check 제약이 있으면 아래로 교체. `20260601d_operators_role_expand.sql`:
```sql
-- operators.role 에 본부장/사장 추가 (경위서 결재라인용)
begin;
alter table public.operators drop constraint if exists operators_role_check;
alter table public.operators add constraint operators_role_check
  check (role in ('부장','팀장','TL','매니저','본부장','사장'));
notify pgrst, 'reload schema';
commit;
```
> 제약명이 다르면 `\d+`로 확인한 실제 이름 사용. check 제약이 없으면 이 마이그는 no-op 주석만 남기고 생략.

- [ ] **Step 3: 적용**
```bash
psql "$DATABASE_URL" --no-save -f supabase/migrations/20260601c_incident_report_mail_sends.sql
psql "$DATABASE_URL" --no-save -f supabase/migrations/20260601d_operators_role_expand.sql
```
Expected: 에러 없음.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260601c_incident_report_mail_sends.sql supabase/migrations/20260601d_operators_role_expand.sql
git commit -m "feat(incident-reports): 발송 이력 테이블 + operators role(본부장/사장) 확장"
```

---

## Task 3: operators 앱 스키마 role 확장

**Files:**
- Modify: `src/features/operators/schemas.ts`
- Test: `src/features/operators/__tests__/schemas.test.ts` (없으면 생성)

- [ ] **Step 1: 실패 테스트 작성**

`src/features/operators/__tests__/role-expand.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { operatorRoleSchema } from "../schemas";

describe("operatorRoleSchema 확장", () => {
  it("본부장/사장 role을 허용한다", () => {
    expect(operatorRoleSchema.safeParse("본부장").success).toBe(true);
    expect(operatorRoleSchema.safeParse("사장").success).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- role-expand`
Expected: FAIL (본부장 not in enum)

- [ ] **Step 3: 스키마 수정**

`src/features/operators/schemas.ts`:
```ts
export const operatorRoleSchema = z.enum(["부장", "팀장", "TL", "매니저", "본부장", "사장"]);
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- role-expand`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/operators/schemas.ts src/features/operators/__tests__/role-expand.test.ts
git commit -m "feat(operators): role enum에 본부장/사장 추가"
```

---

## Task 4: incident-reports zod 스키마

**Files:**
- Create: `src/features/incident-reports/schemas.ts`
- Test: `src/features/incident-reports/__tests__/schemas.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/features/incident-reports/__tests__/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { incidentReportCreateSchema, reportStatusSchema } from "../schemas";

describe("incidentReportCreateSchema", () => {
  it("최소 필드(제목/수신대학)로 통과", () => {
    const r = incidentReportCreateSchema.safeParse({
      recipient_university: "건국대학교",
      title: "전산파일 오류 건",
    });
    expect(r.success).toBe(true);
  });
  it("제목 누락 시 실패", () => {
    const r = incidentReportCreateSchema.safeParse({ recipient_university: "x" });
    expect(r.success).toBe(false);
  });
  it("status enum 5종", () => {
    for (const s of ["draft","pending_approval","approved","rejected","sent"]) {
      expect(reportStatusSchema.safeParse(s).success).toBe(true);
    }
    expect(reportStatusSchema.safeParse("xxx").success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- incident-reports/__tests__/schemas` → FAIL (module not found)

- [ ] **Step 3: 스키마 구현**

`src/features/incident-reports/schemas.ts`:
```ts
import { z } from "zod";

export const REPORT_STATUS_VALUES = [
  "draft", "pending_approval", "approved", "rejected", "sent",
] as const;
export const reportStatusSchema = z.enum(REPORT_STATUS_VALUES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "작성중",
  pending_approval: "승인대기",
  approved: "승인완료",
  rejected: "반려",
  sent: "발송완료",
};

export const incidentReportRowSchema = z.object({
  id: z.string().uuid(),
  incident_id: z.string().uuid().nullable(),
  recipient_university: z.string().min(1),
  title: z.string().min(1),
  draft_date: z.string(),
  gyeongwi: z.string().nullable(),
  cause: z.string().nullable(),
  handling: z.string().nullable(),
  prevention: z.string().nullable(),
  apology: z.string().nullable(),
  author_name: z.string(),
  author_email: z.string().email(),
  approver_name: z.string().nullable(),
  approver_email: z.string().email().nullable(),
  director_name: z.string().nullable(),
  ceo_name: z.string().nullable(),
  status: reportStatusSchema,
  reject_reason: z.string().nullable(),
  approved_at: z.string().nullable(),
  recipient_emails: z.array(z.string()),
  doc_number: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type IncidentReportRow = z.infer<typeof incidentReportRowSchema>;

/** 생성 입력 — incident_id 지정 시 4섹션 프리필은 action에서 수행. */
export const incidentReportCreateSchema = z.object({
  incident_id: z.string().uuid().nullable().optional(),
  recipient_university: z.string().min(1, "수신대학 누락"),
  title: z.string().min(1, "제목 누락").max(200),
  gyeongwi: z.string().max(5000).nullable().optional(),
  cause: z.string().max(5000).nullable().optional(),
  handling: z.string().max(5000).nullable().optional(),
  prevention: z.string().max(5000).nullable().optional(),
  apology: z.string().max(5000).nullable().optional(),
});
export type IncidentReportCreate = z.infer<typeof incidentReportCreateSchema>;

export const incidentReportUpdateSchema = incidentReportCreateSchema.partial();
export type IncidentReportUpdate = z.infer<typeof incidentReportUpdateSchema>;

/** 발송 입력 — 수신 이메일 1개 이상. */
export const incidentReportSendSchema = z.object({
  id: z.string().uuid(),
  recipient_emails: z.array(z.string().email()).min(1, "수신 이메일을 1개 이상 선택하세요."),
});
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- incident-reports/__tests__/schemas` → PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/incident-reports/schemas.ts src/features/incident-reports/__tests__/schemas.test.ts
git commit -m "feat(incident-reports): zod 스키마 + status enum"
```

---

## Task 5: queries — 결재라인 해석 + 목록/단건 + 수신자 후보

**Files:**
- Create: `src/features/incident-reports/queries.ts`
- Test: `src/features/incident-reports/__tests__/approval-chain.test.ts`

승인 체인: 담당자=작성자, 팀장=작성자 소속 팀의 `leader`(operators.leader, nullable이면 같은 team & role='팀장' fallback), 본부장=role='본부장' 1명, 사장=role='사장' 1명.

- [ ] **Step 1: 실패 테스트 작성** (순수 함수 `pickApprovalChain` 분리해 테스트 용이화)

`src/features/incident-reports/__tests__/approval-chain.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { pickApprovalChain } from "../queries";

const rows = [
  { email: "a@x.com", name: "이해영", team: "운영1팀", role: "매니저", leader: "송영신" },
  { email: "b@x.com", name: "송영신", team: "운영1팀", role: "팀장", leader: null },
  { email: "c@x.com", name: "이이화", team: "운영1팀", role: "본부장", leader: null },
  { email: "d@x.com", name: "주정현", team: "운영2팀", role: "사장", leader: null },
];

describe("pickApprovalChain", () => {
  it("작성자 leader 이름으로 팀장 매칭 + 본부장/사장 자동", () => {
    const chain = pickApprovalChain(rows[0], rows);
    expect(chain.approver?.name).toBe("송영신");
    expect(chain.approver?.email).toBe("b@x.com");
    expect(chain.director?.name).toBe("이이화");
    expect(chain.ceo?.name).toBe("주정현");
  });
  it("leader 없으면 같은 팀 role=팀장 fallback", () => {
    const author = { email: "z@x.com", name: "신입", team: "운영1팀", role: "매니저", leader: null };
    const chain = pickApprovalChain(author, [...rows, author]);
    expect(chain.approver?.name).toBe("송영신");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- approval-chain` → FAIL

- [ ] **Step 3: queries 구현**

`src/features/incident-reports/queries.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type OperatorLite = {
  email: string; name: string; team: string | null; role: string; leader: string | null;
};
export type ApprovalChain = {
  author: { name: string; email: string };
  approver: { name: string; email: string } | null;
  director: { name: string } | null;
  ceo: { name: string } | null;
};

/** 순수 함수 — operators 목록에서 작성자 기준 결재라인 계산. */
export function pickApprovalChain(
  author: OperatorLite,
  all: OperatorLite[],
): ApprovalChain {
  const byLeaderName = author.leader
    ? all.find((o) => o.name === author.leader) ?? null
    : null;
  const teamLead =
    byLeaderName ??
    all.find((o) => o.team === author.team && o.role === "팀장") ??
    null;
  const director = all.find((o) => o.role === "본부장") ?? null;
  const ceo = all.find((o) => o.role === "사장") ?? null;
  return {
    author: { name: author.name, email: author.email },
    approver: teamLead ? { name: teamLead.name, email: teamLead.email } : null,
    director: director ? { name: director.name } : null,
    ceo: ceo ? { name: ceo.name } : null,
  };
}

/** DB에서 작성자 결재라인 조회. */
export async function resolveApprovalChain(authorEmail: string): Promise<ApprovalChain | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("operators")
    .select("email,name,team,role,leader")
    .in("status", ["active", "inactive"]);
  if (!data) return null;
  const author = data.find((o) => o.email === authorEmail);
  if (!author) return null;
  return pickApprovalChain(author as OperatorLite, data as OperatorLite[]);
}

/** university_name으로 contacts 수신자 후보 (email 있는 것만). */
export async function listRecipientCandidates(university: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("customer_name,job_title,contact_email")
    .eq("university_name", university)
    .not("contact_email", "is", null);
  return (data ?? []).filter((c) => !!c.contact_email);
}

export async function listIncidentReports() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getIncidentReport(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("incident_reports").select("*").eq("id", id).maybeSingle();
  return data;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- approval-chain` → PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/incident-reports/queries.ts src/features/incident-reports/__tests__/approval-chain.test.ts
git commit -m "feat(incident-reports): 결재라인 해석 + 목록/수신자 쿼리"
```

---

## Task 6: Server Actions — 생성/수정/상태전이

**Files:**
- Create: `src/features/incident-reports/actions.ts`
- Test: `src/features/incident-reports/__tests__/actions.test.ts` (Supabase mock — incidents 테스트 패턴 참조)

create는 incident_id 지정 시 incidents row에서 4섹션+university+title 프리필, author=본인, 결재라인 스냅샷 채움. apology 기본값은 `defaultApology(university)` 생성.

- [ ] **Step 1: 실패 테스트 — 상태 전이 가드**

`src/features/incident-reports/__tests__/actions.test.ts` (핵심 1개):
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));

import { approveIncidentReport } from "../actions";
import { getCurrentOperator } from "@/features/auth/queries";

beforeEach(() => vi.clearAllMocks());

describe("approveIncidentReport", () => {
  it("비로그인 → 에러", async () => {
    (getCurrentOperator as any).mockResolvedValue(null);
    const r = await approveIncidentReport("id-1");
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- incident-reports/__tests__/actions` → FAIL

- [ ] **Step 3: actions 구현**

`src/features/incident-reports/actions.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import { resolveApprovalChain } from "./queries";
import {
  incidentReportCreateSchema,
  incidentReportUpdateSchema,
  type IncidentReportRow,
} from "./schemas";

export type ReportActionResult =
  | { ok: true; row: IncidentReportRow }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const PATH = "/dashboard/incident-reports";

export function defaultApology(university: string): string {
  return `${university}의 무궁한 발전을 기원합니다.\n\n서비스 제공 중 업무에 불편을 드린 점 진심으로 사과드립니다. 향후 유사한 문제가 재발하지 않도록 서비스 프로세스를 개선하고 더 나은 서비스 제공을 위하여 최선의 노력을 다하겠습니다.`;
}

export async function createIncidentReport(input: unknown): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  const parsed = incidentReportCreateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };

  const supabase = await createClient();
  let prefill = { ...parsed.data };

  // incident 연결 시 4섹션 프리필
  if (parsed.data.incident_id) {
    const { data: inc } = await supabase
      .from("incidents")
      .select("university_name,title,cause_summary,root_cause,resolution,prevention")
      .eq("id", parsed.data.incident_id)
      .maybeSingle();
    if (inc) {
      prefill = {
        ...prefill,
        recipient_university: prefill.recipient_university || inc.university_name,
        title: prefill.title || inc.title,
        gyeongwi: prefill.gyeongwi ?? inc.cause_summary,
        cause: prefill.cause ?? inc.root_cause,
        handling: prefill.handling ?? inc.resolution,
        prevention: prefill.prevention ?? inc.prevention,
      };
    }
  }

  const chain = await resolveApprovalChain(me.email);

  const { data, error } = await supabase
    .from("incident_reports")
    .insert({
      incident_id: parsed.data.incident_id ?? null,
      recipient_university: prefill.recipient_university,
      title: prefill.title,
      gyeongwi: prefill.gyeongwi ?? null,
      cause: prefill.cause ?? null,
      handling: prefill.handling ?? null,
      prevention: prefill.prevention ?? null,
      apology: prefill.apology ?? defaultApology(prefill.recipient_university),
      author_name: me.displayName ?? me.email,
      author_email: me.email,
      approver_name: chain?.approver?.name ?? null,
      approver_email: chain?.approver?.email ?? null,
      director_name: chain?.director?.name ?? null,
      ceo_name: chain?.ceo?.name ?? null,
      status: "draft",
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    domain: "incident-reports", action: "create",
    target_type: "incident_reports", target_id: data.id, target_name: data.title,
    msg: `경위서 생성 — ${data.recipient_university}`,
  });
  revalidatePath(PATH);
  return { ok: true, row: data as IncidentReportRow };
}

export async function updateIncidentReport(id: string, input: unknown): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  const parsed = incidentReportUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_reports")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, row: data as IncidentReportRow };
}

/** 공통 상태 전이 헬퍼 — 현재 상태 검사 후 set. */
async function transition(
  id: string,
  from: string[],
  patch: Record<string, unknown>,
  errMsg: string,
): Promise<ReportActionResult> {
  const supabase = await createClient();
  const { data: cur } = await supabase.from("incident_reports").select("status").eq("id", id).maybeSingle();
  if (!cur) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (!from.includes(cur.status)) return { ok: false, error: errMsg };
  const { data, error } = await supabase
    .from("incident_reports")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as IncidentReportRow };
}

export async function submitForApproval(id: string): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  const r = await transition(id, ["draft", "rejected"], { status: "pending_approval", reject_reason: null }, "제출할 수 없는 상태입니다.");
  if (r.ok) { await logActivity({ domain: "incident-reports", action: "submit", target_type: "incident_reports", target_id: id, target_name: r.row.title, msg: "승인 요청" }); revalidatePath(PATH); }
  return r;
}

export async function approveIncidentReport(id: string): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  const supabase = await createClient();
  const { data: rep } = await supabase.from("incident_reports").select("status,approver_email,title").eq("id", id).maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.approver_email !== me.email) return { ok: false, error: "승인 권한이 없습니다." };
  const r = await transition(id, ["pending_approval"], { status: "approved", approved_at: new Date().toISOString() }, "승인할 수 없는 상태입니다.");
  if (r.ok) { await logActivity({ domain: "incident-reports", action: "approve", target_type: "incident_reports", target_id: id, target_name: rep.title, msg: "팀장 승인" }); revalidatePath(PATH); }
  return r;
}

export async function rejectIncidentReport(id: string, reason: string): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  const supabase = await createClient();
  const { data: rep } = await supabase.from("incident_reports").select("approver_email,title").eq("id", id).maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.approver_email !== me.email) return { ok: false, error: "반려 권한이 없습니다." };
  const r = await transition(id, ["pending_approval"], { status: "rejected", reject_reason: reason }, "반려할 수 없는 상태입니다.");
  if (r.ok) { await logActivity({ domain: "incident-reports", action: "reject", target_type: "incident_reports", target_id: id, target_name: rep.title, level: "WARN", msg: `반려: ${reason}` }); revalidatePath(PATH); }
  return r;
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test -- incident-reports/__tests__/actions` → PASS
- [ ] **Step 5: typecheck** — Run: `npm run typecheck` → 에러 없음
- [ ] **Step 6: Commit**
```bash
git add src/features/incident-reports/actions.ts src/features/incident-reports/__tests__/actions.test.ts
git commit -m "feat(incident-reports): CRUD + 상태전이(제출/승인/반려) actions"
```

---

## Task 7: PDF 생성 (공문 + 경위서 2장)

**Files:**
- Create: `src/lib/pdf/incident-report-pdf.tsx`
- Test: `src/lib/pdf/__tests__/incident-report-pdf.test.ts`

handover-pdf.tsx 구조를 그대로 따른다(`import "server-only"`, @react-pdf, Pretendard Font.register singleton, fixed header/footer, `renderToBuffer`).

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/pdf/__tests__/incident-report-pdf.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { renderIncidentReportPdf } from "../incident-report-pdf";

describe("renderIncidentReportPdf", () => {
  it("Buffer(PDF magic %PDF)를 반환한다", async () => {
    const buf = await renderIncidentReportPdf({
      recipientUniversity: "건국대학교",
      title: "전산파일 오류 건",
      draftDate: "2024. 09. 27",
      authorName: "이해영",
      approverName: "송영신", directorName: "이이화", ceoName: "주정현",
      docNumber: null,
      apology: "건국대학교의 무궁한 발전을 기원합니다.",
      gyeongwi: "...", cause: "...", handling: "...", prevention: "...",
    });
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test -- incident-report-pdf` → FAIL

- [ ] **Step 3: PDF 구현** (handover-pdf.tsx의 Font/StyleSheet/header/footer 패턴 복제)

`src/lib/pdf/incident-report-pdf.tsx` — 핵심 구조:
```tsx
import "server-only";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import path from "node:path";

const REG = path.join(process.cwd(), "public", "fonts", "Pretendard-Regular.ttf");
const BOLD = path.join(process.cwd(), "public", "fonts", "Pretendard-Bold.otf");
let fontRegistered = false;
function ensureFont() {
  if (fontRegistered) return;
  Font.register({ family: "Pretendard", fonts: [{ src: REG, fontWeight: 400 }, { src: BOLD, fontWeight: 700 }] });
  fontRegistered = true;
}

export type IncidentReportPdfInput = {
  recipientUniversity: string;
  title: string;
  draftDate: string;
  authorName: string;
  approverName: string | null;
  directorName: string | null;
  ceoName: string | null;
  docNumber: string | null;
  apology: string;
  gyeongwi: string | null;
  cause: string | null;
  handling: string | null;
  prevention: string | null;
};

const s = StyleSheet.create({
  page: { fontFamily: "Pretendard", fontSize: 10.5, padding: 48, lineHeight: 1.6, color: "#15120c" },
  brand: { fontSize: 8.5, textAlign: "center", marginBottom: 16, color: "#6b6253" },
  recvRow: { marginBottom: 4 },
  bold: { fontWeight: 700 },
  apology: { marginVertical: 14 },
  approvalTable: { flexDirection: "row", borderTop: "1px solid #15120c", marginTop: 24 },
  approvalCell: { flex: 1, borderRight: "1px solid #ddd", padding: 6, fontSize: 8.5, textAlign: "center" },
  reportTitle: { fontSize: 18, fontWeight: 700, textAlign: "center", letterSpacing: 8, marginBottom: 18 },
  sectionH: { fontWeight: 700, marginTop: 12, marginBottom: 4 },
  sectionBody: { marginBottom: 6 },
});

function Section({ no, label, body }: { no: number; label: string; body: string | null }) {
  return (
    <View>
      <Text style={s.sectionH}>{no}. {label}</Text>
      <Text style={s.sectionBody}>{body ?? ""}</Text>
    </View>
  );
}

export async function renderIncidentReportPdf(input: IncidentReportPdfInput): Promise<Buffer> {
  ensureFont();
  const doc = (
    <Document>
      {/* 1장: 공문 */}
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>대한민국 대표 원서접수 사이트 진학어플라이 · 대한민국 최대 입시전문 포탈사이트 진학닷컴</Text>
        <Text style={s.recvRow}>수신자  {input.recipientUniversity}</Text>
        <Text style={s.recvRow}>제  목  {input.title}</Text>
        <Text style={s.apology}>{input.apology}</Text>
        <Text>붙임 : 1. {input.title} 경위서 1부.  끝.</Text>
        <View style={s.approvalTable}>
          <Text style={s.approvalCell}>담당자{"\n"}{input.authorName}</Text>
          <Text style={s.approvalCell}>팀장{"\n"}{input.approverName ?? ""}</Text>
          <Text style={s.approvalCell}>본부장{"\n"}{input.directorName ?? ""}</Text>
          <Text style={s.approvalCell}>사장{"\n"}{input.ceoName ?? ""}</Text>
        </View>
        {input.docNumber ? <Text>시행  {input.docNumber}</Text> : null}
      </Page>
      {/* 2장: 경위서 */}
      <Page size="A4" style={s.page}>
        <Text style={s.reportTitle}>경 위 서</Text>
        <Text style={s.recvRow}>작 성 일 자 : {input.draftDate}      작 성 자 : {input.authorName}</Text>
        <Text style={[s.recvRow, s.bold]}>제    목 : {input.title}</Text>
        <Section no={1} label="경위" body={input.gyeongwi} />
        <Section no={2} label="원인" body={input.cause} />
        <Section no={3} label="처리" body={input.handling} />
        <Section no={4} label="향후 대책" body={input.prevention} />
        <Text style={s.apology}>이번 오류로 업무에 불편을 드린 점 거듭 사과드립니다. 향후 이러한 문제가 다시 발생하지 않도록 하겠습니다.</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
```
> 시인성/fixed header·footer는 handover-pdf.tsx를 참조해 동일 수준으로 다듬는다(이번 step은 구조 완성, 디테일은 후속 커밋 허용).

- [ ] **Step 4: 통과 확인** — Run: `npm test -- incident-report-pdf` → PASS
- [ ] **Step 5: Commit**
```bash
git add src/lib/pdf/incident-report-pdf.tsx src/lib/pdf/__tests__/incident-report-pdf.test.ts
git commit -m "feat(incident-reports): 공문+경위서 2장 PDF 생성"
```

---

## Task 8: Word(.docx) 생성 + 의존성 추가

**Files:**
- Modify: `package.json`
- Create: `src/lib/docx/incident-report-docx.ts`
- Test: `src/lib/docx/__tests__/incident-report-docx.test.ts`

- [ ] **Step 1: 의존성 추가**
```bash
npm install docx
```
Expected: package.json dependencies에 `docx` 추가.

- [ ] **Step 2: 실패 테스트 작성**

`src/lib/docx/__tests__/incident-report-docx.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { renderIncidentReportDocx } from "../incident-report-docx";

describe("renderIncidentReportDocx", () => {
  it("docx(zip PK magic)를 반환한다", async () => {
    const buf = await renderIncidentReportDocx({
      recipientUniversity: "건국대학교", title: "전산파일 오류 건",
      draftDate: "2024. 09. 27", authorName: "이해영",
      approverName: "송영신", directorName: "이이화", ceoName: "주정현",
      docNumber: null, apology: "...", gyeongwi: "a", cause: "b", handling: "c", prevention: "d",
    });
    // .docx = zip → 첫 2바이트 "PK"
    expect(buf.subarray(0, 2).toString()).toBe("PK");
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npm test -- incident-report-docx` → FAIL

- [ ] **Step 4: docx 구현** (PDF와 동일 IncidentReportPdfInput 타입 재사용)

`src/lib/docx/incident-report-docx.ts`:
```ts
import "server-only";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from "docx";
import type { IncidentReportPdfInput } from "@/lib/pdf/incident-report-pdf";

function p(text: string, opts?: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] }) {
  return new Paragraph({ alignment: opts?.align, children: [new TextRun({ text, bold: opts?.bold, font: "맑은 고딕" })] });
}
function section(no: number, label: string, body: string | null) {
  return [p(`${no}. ${label}`, { bold: true }), p(body ?? "")];
}

export async function renderIncidentReportDocx(input: IncidentReportPdfInput): Promise<Buffer> {
  const approvalRow = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [
      ["담당자", input.authorName], ["팀장", input.approverName ?? ""],
      ["본부장", input.directorName ?? ""], ["사장", input.ceoName ?? ""],
    ].map(([h, v]) => new TableCell({ children: [p(h, { align: AlignmentType.CENTER }), p(v, { align: AlignmentType.CENTER })] }))) })],
  });

  const doc = new Document({
    sections: [
      { children: [
        p("대한민국 대표 원서접수 사이트 진학어플라이 · 대한민국 최대 입시전문 포탈사이트 진학닷컴", { align: AlignmentType.CENTER }),
        p(`수신자  ${input.recipientUniversity}`),
        p(`제  목  ${input.title}`),
        p(input.apology),
        p(`붙임 : 1. ${input.title} 경위서 1부.  끝.`),
        approvalRow,
        ...(input.docNumber ? [p(`시행  ${input.docNumber}`)] : []),
      ] },
      { children: [
        new Paragraph({ alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "경 위 서", bold: true })] }),
        p(`작성일자 : ${input.draftDate}      작성자 : ${input.authorName}`),
        p(`제목 : ${input.title}`, { bold: true }),
        ...section(1, "경위", input.gyeongwi),
        ...section(2, "원인", input.cause),
        ...section(3, "처리", input.handling),
        ...section(4, "향후 대책", input.prevention),
        p("이번 오류로 업무에 불편을 드린 점 거듭 사과드립니다."),
      ] },
    ],
  });
  return Packer.toBuffer(doc);
}
```

- [ ] **Step 5: 통과 확인** — Run: `npm test -- incident-report-docx` → PASS
- [ ] **Step 6: Commit**
```bash
git add package.json package-lock.json src/lib/docx/incident-report-docx.ts src/lib/docx/__tests__/incident-report-docx.test.ts
git commit -m "feat(incident-reports): docx 의존성 + Word 문서 생성"
```

---

## Task 9: 메일 발송 + 이력

**Files:**
- Create: `src/features/incident-reports/mail-template.ts`
- Create: `src/features/incident-reports/mail-actions.ts`
- Test: `src/features/incident-reports/__tests__/mail-actions.test.ts`

발송: approved 상태만, 작성자/admin만. PDF 첨부, 운영자 메일박스 from, `MAIL_DRY_RUN=true`면 발송 생략 + 이력 dry_run. 발송 성공 시 status→sent.

- [ ] **Step 1: 메일 템플릿 작성**

`src/features/incident-reports/mail-template.ts`:
```ts
export function incidentReportMailHtml(args: { university: string; title: string; authorName: string }): string {
  return `<div style="font-family:sans-serif;line-height:1.7;color:#15120c">
  <p>${args.university} 담당자님께,</p>
  <p>[운영부 상황실] <strong>${args.title}</strong> 관련 경위서를 첨부드립니다.</p>
  <p>첨부된 PDF를 확인 부탁드립니다. 업무에 불편을 드린 점 진심으로 사과드립니다.</p>
  <p>${args.authorName} 드림</p>
</div>`;
}
export function incidentReportMailSubject(title: string): string {
  return `[운영부 상황실] ${title} 경위서`;
}
```

- [ ] **Step 2: 실패 테스트 작성** (DRY_RUN 분기)

`src/features/incident-reports/__tests__/mail-actions.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: vi.fn() }));
vi.mock("@/lib/pdf/incident-report-pdf", () => ({ renderIncidentReportPdf: vi.fn(async () => Buffer.from("%PDF")) }));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));

import { sendIncidentReport } from "../mail-actions";
import { getCurrentOperator } from "@/features/auth/queries";

beforeEach(() => vi.clearAllMocks());
describe("sendIncidentReport", () => {
  it("비로그인 → 에러", async () => {
    (getCurrentOperator as any).mockResolvedValue(null);
    const r = await sendIncidentReport({ id: "x", recipient_emails: ["a@b.com"] });
    expect(r).toEqual({ ok: false, error: "로그인이 필요합니다." });
  });
});
```

- [ ] **Step 3: 실패 확인** — Run: `npm test -- incident-reports/__tests__/mail-actions` → FAIL

- [ ] **Step 4: mail-actions 구현**

`src/features/incident-reports/mail-actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { renderIncidentReportPdf } from "@/lib/pdf/incident-report-pdf";
import { incidentReportMailHtml, incidentReportMailSubject } from "./mail-template";
import { incidentReportSendSchema, type IncidentReportRow } from "./schemas";

const AUTH_ERROR = "로그인이 필요합니다.";
const PATH = "/dashboard/incident-reports";
const DRY_RUN = process.env.MAIL_DRY_RUN === "true";

export async function sendIncidentReport(input: unknown):
  Promise<{ ok: true; row: IncidentReportRow } | { ok: false; error: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  const parsed = incidentReportSendSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };

  const supabase = await createClient();
  const { data: rep } = await supabase.from("incident_reports").select("*").eq("id", parsed.data.id).maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.status !== "approved") return { ok: false, error: "승인 완료된 경위서만 발송할 수 있습니다." };
  if (rep.author_email !== me.email && me.permission !== "admin") return { ok: false, error: "발송 권한이 없습니다." };

  const pdf = await renderIncidentReportPdf({
    recipientUniversity: rep.recipient_university, title: rep.title,
    draftDate: rep.draft_date, authorName: rep.author_name,
    approverName: rep.approver_name, directorName: rep.director_name, ceoName: rep.ceo_name,
    docNumber: rep.doc_number, apology: rep.apology ?? "",
    gyeongwi: rep.gyeongwi, cause: rep.cause, handling: rep.handling, prevention: rep.prevention,
  });
  const attachment = { name: `${rep.title}.pdf`, contentBytes: pdf.toString("base64"), contentType: "application/pdf" };

  // 본인 operators.id (이력 FK)
  const { data: opRow } = await supabase.from("operators").select("id").eq("email", me.email).maybeSingle();

  for (const to of parsed.data.recipient_emails) {
    let status: "sent" | "failed" | "dry_run" = "dry_run";
    let messageId: string | null = null;
    let errMsg: string | null = null;
    if (!DRY_RUN) {
      const res = await sendGraphMail({
        senderUserId: me.email, toEmail: to,
        subject: incidentReportMailSubject(rep.title),
        html: incidentReportMailHtml({ university: rep.recipient_university, title: rep.title, authorName: rep.author_name }),
        attachments: [attachment],
      });
      status = res.ok ? "sent" : "failed";
      messageId = res.ok ? res.messageId ?? null : null;
      errMsg = res.ok ? null : res.error;
    }
    await supabase.from("incident_report_mail_sends").insert({
      sender_operator_id: opRow?.id ?? null, report_id: rep.id,
      recipient_email: to, status, graph_message_id: messageId, error_message: errMsg,
    });
  }

  const { data: updated } = await supabase
    .from("incident_reports")
    .update({ status: "sent", recipient_emails: parsed.data.recipient_emails, updated_at: new Date().toISOString() })
    .eq("id", rep.id).select().single();

  await logActivity({ domain: "incident-reports", action: "send", target_type: "incident_reports", target_id: rep.id, target_name: rep.title, msg: `경위서 발송 (${parsed.data.recipient_emails.length}명)${DRY_RUN ? " [dry_run]" : ""}` });
  revalidatePath(PATH);
  return { ok: true, row: updated as IncidentReportRow };
}
```

- [ ] **Step 5: 통과 확인** — Run: `npm test -- incident-reports/__tests__/mail-actions` → PASS
- [ ] **Step 6: typecheck** — Run: `npm run typecheck` → 에러 없음
- [ ] **Step 7: Commit**
```bash
git add src/features/incident-reports/mail-template.ts src/features/incident-reports/mail-actions.ts src/features/incident-reports/__tests__/mail-actions.test.ts
git commit -m "feat(incident-reports): PDF 첨부 고객 메일 발송 + 이력"
```

---

## Task 10: list-variant UI + 사이드바 등록

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/types.ts` — Variant union
- Modify: `src/app/dashboard/_components/inspector/list-variants/registry.ts` — import + 엔트리
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` — ListRow에 incidentReport* 필드
- Create: `.../list-variants/incident-reports/filters.ts`
- Create: `.../list-variants/incident-reports/Table.tsx`
- Create: `.../list-variants/incident-reports/View.tsx`
- Create: `.../list-variants/incident-reports/EditForm.tsx`
- Create: `src/app/dashboard/incident-reports/page.tsx`
- Create: `src/app/dashboard/incident-reports/_row-mapper.ts`
- Modify: 사이드바 `_data` + page-meta-config

> **참고**: `incidents` variant(같은 폴더)가 가장 가까운 템플릿. View/EditForm/Table/filters 4파일 형상·import·ListRow 매핑을 그대로 본떠라. 차이점만 아래 명시.

- [ ] **Step 1: Variant union 추가**

`.../list-variants/types.ts` — 기존 union에 추가:
```ts
// 예: export type Variant = "incidents" | "handover" | ... | "incident-reports";
```
(파일을 열어 union 정의 줄에 `| "incident-reports"` 추가)

- [ ] **Step 2: ListRow 필드 추가**

`.../patterns/ListPattern.tsx`의 `ListRow` 타입에 incidentReport 필드 추가(incidents가 `incidentTitle` 등 prefix 쓰는 패턴 동일):
```ts
// ListRow에 추가:
incidentReportStatus?: "draft" | "pending_approval" | "approved" | "rejected" | "sent";
incidentReportUniversity?: string;
incidentReportTitle?: string;
incidentReportAuthorName?: string;
incidentReportApproverName?: string | null;
incidentReportIncidentId?: string | null;
```

- [ ] **Step 3: filters.ts 작성** (incidents/filters.ts 패턴)

`.../incident-reports/filters.ts`:
```ts
import type { ListRow } from "../../../patterns/ListPattern";
export const INCIDENT_REPORT_FILTERS = [] as const;
export function blankIncidentReportRow(opts?: { currentUserName?: string }): ListRow {
  return {
    id: "", name: "", status: "active", owner: opts?.currentUserName ?? "",
    incidentReportStatus: "draft",
    incidentReportUniversity: "",
    incidentReportTitle: "",
    incidentReportAuthorName: opts?.currentUserName ?? "",
    incidentReportApproverName: null,
    incidentReportIncidentId: null,
  };
}
```

- [ ] **Step 4: Table.tsx / View.tsx / EditForm.tsx 작성**

incidents variant의 3파일을 복제해 필드를 incidentReport*로 치환. 핵심 차이:
- **Table**: 컬럼 = 제목 / 수신대학 / 상태 배지(REPORT_STATUS_LABEL) / 작성자 / 팀장
- **View**: 4섹션(경위/원인/처리/대책) + 결재라인 + 상태별 액션 버튼:
  - draft/rejected → "승인 요청"(submitForApproval)
  - pending_approval + 본인이 approver → "승인"(approve) / "반려"(reject + 사유)
  - approved + 작성자/admin → "발송"(send + contacts 수신자 선택)
- **EditForm**: 제목/수신대학/4섹션/사과본문 textarea + createIncidentReport/updateIncidentReport 호출. (incident_id 연결은 page에서 쿼리 파라미터로 프리필)

각 파일은 incidents 대응 파일과 동일한 props/패턴을 사용한다(`ViewProps`/`EditFormProps` from types.ts).

- [ ] **Step 5: registry 엔트리 추가**

`.../registry.ts` 상단 import:
```ts
import { IncidentReportView } from "./incident-reports/View";
import { IncidentReportEditForm } from "./incident-reports/EditForm";
import { IncidentReportTable } from "./incident-reports/Table";
import { INCIDENT_REPORT_FILTERS, blankIncidentReportRow } from "./incident-reports/filters";
```
엔트리(incidents 엔트리 옆):
```ts
  "incident-reports": {
    View: IncidentReportView,
    EditForm: IncidentReportEditForm,
    Table: IncidentReportTable,
    Filters: INCIDENT_REPORT_FILTERS,
    blank: blankIncidentReportRow,
  },
```

- [ ] **Step 6: page + row-mapper 작성**

`src/app/dashboard/incident-reports/_row-mapper.ts` — DB row → ListRow:
```ts
import type { ListRow } from "../_components/patterns/ListPattern";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";
export function toListRow(r: IncidentReportRow): ListRow {
  return {
    id: r.id, name: r.title, status: "active", owner: r.author_name,
    incidentReportStatus: r.status,
    incidentReportUniversity: r.recipient_university,
    incidentReportTitle: r.title,
    incidentReportAuthorName: r.author_name,
    incidentReportApproverName: r.approver_name,
    incidentReportIncidentId: r.incident_id,
  };
}
```
`src/app/dashboard/incident-reports/page.tsx` — incidents/page.tsx 패턴 복제(variant="incident-reports", listIncidentReports() → toListRow 매핑, ListPattern 렌더).

- [ ] **Step 7: 사이드바 + page-meta 등록**

`src/app/dashboard/_data*`(sidebar) 자료보관 그룹에 `{ slug: "incident-reports", label: "경위서" }` 추가. page-meta-config에 incident-reports 메타(제목/설명) 등록. incidents 항목을 참고.

- [ ] **Step 8: 검증**
```bash
npm run typecheck && npm run lint && npm test
```
Expected: 전부 통과.

- [ ] **Step 9: Commit**
```bash
git add src/app/dashboard/incident-reports src/app/dashboard/_components/inspector/list-variants/incident-reports src/app/dashboard/_components/inspector/list-variants/registry.ts src/app/dashboard/_components/inspector/list-variants/types.ts src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/_data*
git commit -m "feat(incident-reports): 경위서 list-variant UI + 자료보관 사이드바 등록"
```

---

## Task 11: 통합 점검

- [ ] **Step 1: 전체 검증**
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
Expected: 전부 통과 (build는 `unset NODE_ENV` 후 실행 — CLAUDE.md 빌드 메모).

- [ ] **Step 2: 수동 스모크** — `npm run dev` 후 `/dashboard/incident-reports` 진입 → 신규 생성(사고 선택 프리필) → 승인 요청 → (팀장 계정) 승인 → 발송(`MAIL_DRY_RUN=true`로 이력만 확인).

- [ ] **Step 3: Commit (필요 시 미세 수정)**

---

## Self-Review — 스펙 커버리지

| 스펙 요구사항 | Task |
|---|---|
| incident_reports 테이블 + 4섹션 스냅샷 + 결재라인 + status | Task 1 |
| 이력 테이블 incident_report_mail_sends | Task 2 |
| operators role 본부장/사장 확장 (DB+앱) | Task 2, 3 |
| zod 스키마 + status enum | Task 4 |
| 결재라인 계산(담당자/팀장=leader/본부장/사장) | Task 5 |
| contacts 수신자 후보(university 필터, email nullable 가드) | Task 5 |
| incidents 4섹션 프리필 생성 | Task 6 |
| 상태 전이: 제출/승인(팀장만)/반려 | Task 6 |
| PDF 공문+경위서 2장 | Task 7 |
| Word(.docx) 생성 + docx 의존성 | Task 8 |
| 고객 메일 발송(운영자 메일박스, PDF 첨부, DRY_RUN, 이력) | Task 9 |
| list-variant UI + registry/types + 사이드바 | Task 10 |
| 권한/RLS (read 전체, 작성 본인, 승인 팀장, 발송 작성자/admin) | Task 1(RLS) + Task 6/9(action 가드) |
| 통합 검증 | Task 11 |

**2차 제외 확인**: SharePoint 공문관리대장 채번 / 06.경위서 업로드 / 위임 인증 — 본 계획에 없음(의도적). doc_number는 1차 null 허용으로 스키마만 준비됨.

**미해결/실행 시 주의**:
- ListRow 필드·`ViewProps`/`EditFormProps` 정확한 형상은 Task 10에서 실제 `types.ts`/`ListPattern.tsx`를 열어 확인 후 맞출 것(추측 금지).
- operators.role DB check 제약명은 Task 2 Step 2에서 `\d+`로 실제 확인.
- PDF/docx의 회사 주소·연락처·시행정보 푸터 디테일은 handover-pdf.tsx 수준으로 후속 다듬기 허용(구조 우선).
