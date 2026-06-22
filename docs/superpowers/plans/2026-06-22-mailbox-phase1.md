# 메일함 Phase 1 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan. 각 Task를 독립 subagent에 위임하되, Task 간 의존 순서(아래 명시)를 지킨다. 모든 코드 Task는 RED→GREEN→REFACTOR(TDD Iron Law)를 강제하고, 각 Step의 "기대 출력"을 실제 명령 실행 결과로 검증한 뒤에만 다음 Step으로 진행한다. TDD 예외(마이그/스타일/타입정의)는 §rules/tdd.md 기준으로만 적용하고, 예외라도 검증(빌드/렌더/typecheck)은 필수다.

## Goal

OPS-Console "고객 응대" 그룹에 **메일함(slug `mailbox`)** 메뉴를 추가한다 (Phase 1 = 본인 메일함 한정).
- 운영자 계정별 Outlook 수신함을 DB 캐시로 준실시간 확인
- 받은 메일에 로컬 LLM(Ollama)이 회신 초안 자동 작성 (auto 토글 ON 시)
- 운영자가 초안 검토·편집 후 **본인(메일함 주인) 명의로 발송**
- Phase 2(위임 열람)는 본 계획에서 제외. `mailbox_delegations` 테이블·`canAccessMailbox`·`[내 메일함 ▼]` 전환 미포함.

근거 스펙: `docs/superpowers/specs/2026-06-22-mailbox-feature-design.md` §12 (Phase 1 경계).

## Architecture

```
[로컬 Mac · cron(launchd) — scripts/mailbox-ingest.mjs]
  1. getInboxMessages(owner, since)  ← Graph Application 토큰 (Mail.Read)
  2. mailbox_messages upsert (service_role, onConflict graph_message_id)
  3. auto_draft_enabled=true 운영자의 미초안·미필터 메일
        → Ollama(http://localhost:11434, MAILBOX_LLM_MODEL) 회신 초안
        → mailbox_drafts insert (status='draft', model_used)
        ▼ (페이지 autoRefresh)
[Vercel 웹앱 /dashboard/mailbox — SSR]
  - owner_email = me 메일 + 최신 draft 조회 → ListRow(mail* 필드)
  - ListPattern variant="mailbox" + 인스펙터(본문/초안편집/발송·폐기·재생성)
  - 자동초안 토글 → setAutoDraftEnabled server action
  - 발송 → sendMailReply → sendGraphMail(sender=owner_email) + MAIL_DRY_RUN 안전장치
```

권한 경계: Application `Mail.Read`는 로컬 ingest 잡만 보유. 웹앱은 DB만 읽는다(앱이 직접 Graph 메일 조회 안 함). "누가 어떤 메일함을 보는가"는 RLS read(운영부 공개) + 페이지의 `owner_email = me` 필터로 게이트.

## Tech Stack

- Next.js App Router(RSC + Server Action) / TypeScript / Tailwind 4(디자인 토큰)
- Supabase(@supabase/ssr server client, admin service_role) + zod
- Vitest(unit) — `vi.hoisted` mock 패턴(`src/features/contacts/__tests__/actions.test.ts` 동일)
- Microsoft Graph: `getGraphToken()`(`src/lib/microsoft/auth.ts`) + fetch/status 에러 패턴(`src/lib/microsoft/sendmail.ts`)
- 로컬 LLM: Ollama HTTP `POST /api/generate` (외부 전송 0)

재사용 자산(실측):
- ListRow / onPersist / variant dispatch: `src/app/dashboard/_components/patterns/ListPattern.tsx`
- variant registry/types: `.../inspector/list-variants/registry.ts`, `types.ts`
- variant 슬롯 3종 템플릿: `.../list-variants/contacts/{View,Table,filters}.tsx` (편집형), `.../worklog/View.tsx` (View-only 형)
- 도메인 feature 3종 + 테스트: `src/features/contacts/{schemas,queries,actions}.ts` + `__tests__/`
- 페이지 SSR + onPersist + autoRefresh: `src/app/dashboard/contacts/page.tsx` + `_row-mapper.ts`
- 마이그(table/RLS/GRANT/PostgREST reload): `supabase/migrations/20260523_contacts_table.sql`, `20260523b_contacts_rls.sql`, `20260604b_worklog_rls.sql`(service_role write 패턴)
- 표준 로컬 스크립트 env 로딩 + supabase-js admin: `scripts/services-import.mjs`
- 사이드바: `src/app/dashboard/_data.ts` "고객 응대" group(line 71~99)
- 페이지 메타: `src/app/dashboard/_data/page-meta-config.ts`(`data-requests` 항목 참고)

---

## Task 1 — Supabase 마이그레이션 (3 테이블 + RLS + GRANT + realtime)

스펙 §8. TDD 예외(.sql) — 검증은 typecheck/적용 후 RLS 동작 확인으로 대체. **DB 적용은 메모리 `db-migration-apply` 절차**(Supabase CLI 없음 — DATABASE_URL 풀러 + `pg` 인라인)를 따른다. 본 Task는 파일 작성까지 범위로 하고, 적용은 운영 단계에서 수행.

### Files
- Create `supabase/migrations/20260622_mailbox_tables.sql`
- Create `supabase/migrations/20260622b_mailbox_rls.sql`

### Steps

- [ ] **Step 1: 테이블 마이그 작성** — `20260622_mailbox_tables.sql`. 3 테이블 + 인덱스 + updated_at 트리거 재사용 + PostgREST reload. `contacts_table.sql` 구조 그대로 차용.

```sql
-- 메일함 도메인 — 운영자별 Outlook 수신 메일 캐시 + 회신 초안/발송 이력 + 토글
-- 사이드바: '고객 응대' 그룹 > '메일함' (slug `mailbox`, pattern `list`)
-- Phase 1: messages / drafts / settings 3 테이블 (delegations는 Phase 2)
-- RLS는 별도 20260622b — worklog(service_role write) + contacts(authenticated read) 혼합 패턴

begin;

------------------------------------------------------------
-- 1) mailbox_messages — 수신 메일 캐시 (ingest 잡이 upsert)
------------------------------------------------------------
create table if not exists public.mailbox_messages (
  id                uuid primary key default uuid_generate_v4(),
  owner_email       text not null,                 -- 메일함 주인 (operators.email)
  graph_message_id  text not null unique,          -- Graph 메시지 id (멱등 upsert 키)
  from_name         text,
  from_email        text,
  subject           text,
  body_preview      text,
  body              text,
  received_at       timestamptz,
  is_read           boolean not null default false,
  draft_skipped     boolean not null default false, -- no-reply/자동발신 등 초안 생략
  created_at        timestamptz not null default now()
);

create index if not exists mailbox_messages_owner_received_idx
  on public.mailbox_messages (owner_email, received_at desc);

------------------------------------------------------------
-- 2) mailbox_drafts — 회신 초안 / 발송 이력
------------------------------------------------------------
create table if not exists public.mailbox_drafts (
  id            uuid primary key default uuid_generate_v4(),
  message_id    uuid not null references public.mailbox_messages(id) on delete cascade,
  draft_body    text,
  model_used    text,
  status        text not null default 'draft'
                check (status in ('draft','sent','discarded','dry_run')),
  sent_at       timestamptz,
  sent_by_email text,                              -- 실제 발송 클릭한 운영자 (감사 추적)
  created_at    timestamptz not null default now()
);

create index if not exists mailbox_drafts_message_idx
  on public.mailbox_drafts (message_id, created_at desc);

------------------------------------------------------------
-- 3) mailbox_settings — 메일함별 토글 + 증분 커서
------------------------------------------------------------
create table if not exists public.mailbox_settings (
  owner_email         text primary key,
  auto_draft_enabled  boolean not null default true,
  last_synced_at      timestamptz,
  updated_at          timestamptz not null default now()
);

-- updated_at 자동 (operators 마이그의 set_updated_at 재사용)
drop trigger if exists mailbox_settings_set_updated_at on public.mailbox_settings;
create trigger mailbox_settings_set_updated_at
before update on public.mailbox_settings
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 2: RLS + GRANT + realtime 마이그 작성** — `20260622b_mailbox_rls.sql`. read는 authenticated 전원(운영부 공개, owner 필터는 페이지가 처리), insert/update는 service_role only(worklog 패턴). realtime publication 등록.

```sql
-- mailbox RLS — read: authenticated 전원 / write: service_role only (ingest 잡 + server action)
-- worklog(20260604b) service_role-write 패턴 차용. owner 게이트는 페이지 owner_email=me 필터.

begin;

alter table public.mailbox_messages enable row level security;
alter table public.mailbox_drafts   enable row level security;
alter table public.mailbox_settings enable row level security;

-- read: authenticated 전원 (운영부 공개 조회)
drop policy if exists mailbox_messages_read on public.mailbox_messages;
create policy mailbox_messages_read on public.mailbox_messages
  for select to authenticated using (true);

drop policy if exists mailbox_drafts_read on public.mailbox_drafts;
create policy mailbox_drafts_read on public.mailbox_drafts
  for select to authenticated using (true);

drop policy if exists mailbox_settings_read on public.mailbox_settings;
create policy mailbox_settings_read on public.mailbox_settings
  for select to authenticated using (true);

-- insert/update/delete 정책 없음 → authenticated 차단. service_role만 쓰기.
grant select on public.mailbox_messages to authenticated;
grant select on public.mailbox_drafts   to authenticated;
grant select on public.mailbox_settings to authenticated;
grant all on public.mailbox_messages to service_role;
grant all on public.mailbox_drafts   to service_role;
grant all on public.mailbox_settings to service_role;

-- 준실시간 표시 — realtime publication 등록 (이미 멤버면 무시)
do $$
begin
  alter publication supabase_realtime add table public.mailbox_messages;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.mailbox_drafts;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 3: 검증** — SQL 문법 lint(로컬 적용 전 dry parse). 적용은 운영 단계에서 메모리 `db-migration-apply` 절차로 수행하고, 적용 후 다음으로 확인:
  - 명령: `npm run typecheck` (마이그는 빌드 비대상이나 후속 Task가 테이블 의존 — 여기선 파일 존재만 확인)
  - 기대 출력: 파일 2개 생성됨. 적용 시 `select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename like 'mailbox%';` → `mailbox_messages`, `mailbox_drafts` 2행.

- [ ] **Step 4: 커밋** — `git add supabase/migrations/20260622_mailbox_tables.sql supabase/migrations/20260622b_mailbox_rls.sql && git commit -m "feat(mailbox): messages/drafts/settings 테이블 + RLS + realtime 마이그"`

**의존**: 없음

---

## Task 2 — zod 스키마 + queries (RED 먼저)

스펙 §8. TDD 적용 — 스키마 검증 테스트 RED → 스키마 구현 GREEN.

### Files
- Create `src/features/mailbox/__tests__/schemas.test.ts`
- Create `src/features/mailbox/schemas.ts`
- Create `src/features/mailbox/queries.ts`

### Steps

- [ ] **Step 1: RED — 스키마 테스트 작성** — `__tests__/schemas.test.ts`. `contacts/__tests__/schemas.test.ts` 구조 차용.

```ts
import { describe, it, expect } from "vitest";
import {
  mailboxMessageSchema,
  mailboxDraftSchema,
  sendReplySchema,
  setAutoDraftSchema,
} from "../schemas";

const validMessage = {
  id: "11111111-1111-4111-8111-111111111111",
  owner_email: "op@x.com",
  graph_message_id: "AAMkAD...",
  from_name: "김민수",
  from_email: "kim@univ.ac.kr",
  subject: "견적 문의",
  body_preview: "안녕하세요",
  body: "안녕하세요. 견적 문의드립니다.",
  received_at: "2026-06-22T00:12:00+00:00",
  is_read: false,
  draft_skipped: false,
  created_at: "2026-06-22T00:12:30+00:00",
};

describe("mailboxMessageSchema", () => {
  it("유효 메시지 통과", () => {
    expect(mailboxMessageSchema.safeParse(validMessage).success).toBe(true);
  });
  it("owner_email 누락 시 fail", () => {
    expect(
      mailboxMessageSchema.safeParse({ ...validMessage, owner_email: "" })
        .success,
    ).toBe(false);
  });
  it("nullable 필드(from_name/subject) null 허용", () => {
    expect(
      mailboxMessageSchema.safeParse({
        ...validMessage,
        from_name: null,
        subject: null,
      }).success,
    ).toBe(true);
  });
});

describe("sendReplySchema", () => {
  it("messageId(uuid) + editedBody(min 1) 통과", () => {
    const r = sendReplySchema.safeParse({
      messageId: "11111111-1111-4111-8111-111111111111",
      editedBody: "회신드립니다.",
    });
    expect(r.success).toBe(true);
  });
  it("빈 본문 거부", () => {
    const r = sendReplySchema.safeParse({
      messageId: "11111111-1111-4111-8111-111111111111",
      editedBody: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("setAutoDraftSchema", () => {
  it("ownerEmail + enabled:boolean 통과", () => {
    expect(
      setAutoDraftSchema.safeParse({ ownerEmail: "op@x.com", enabled: false })
        .success,
    ).toBe(true);
  });
});
```

  - 명령: `npm test -- src/features/mailbox/__tests__/schemas.test.ts`
  - 기대 출력: 모듈 미존재로 import 실패 → `FAIL`(RED 확인).

- [ ] **Step 2: GREEN — schemas.ts 구현** — 테스트 통과 최소 스키마.

```ts
import { z } from "zod";

/** mailbox_messages 행 — Phase 1: 수신 메일 캐시 (ingest 잡 upsert). */
export const mailboxMessageSchema = z.object({
  id: z.string().uuid(),
  owner_email: z.string().min(1),
  graph_message_id: z.string().min(1),
  from_name: z.string().nullable(),
  from_email: z.string().nullable(),
  subject: z.string().nullable(),
  body_preview: z.string().nullable(),
  body: z.string().nullable(),
  received_at: z.string().nullable(),
  is_read: z.boolean(),
  draft_skipped: z.boolean(),
  created_at: z.string(),
});
export type MailboxMessage = z.infer<typeof mailboxMessageSchema>;

/** mailbox_drafts 행 — 회신 초안/발송 이력. */
export const mailboxDraftSchema = z.object({
  id: z.string().uuid(),
  message_id: z.string().uuid(),
  draft_body: z.string().nullable(),
  model_used: z.string().nullable(),
  status: z.enum(["draft", "sent", "discarded", "dry_run"]),
  sent_at: z.string().nullable(),
  sent_by_email: z.string().nullable(),
  created_at: z.string(),
});
export type MailboxDraft = z.infer<typeof mailboxDraftSchema>;

/** sendMailReply 액션 입력. */
export const sendReplySchema = z.object({
  messageId: z.string().uuid(),
  editedBody: z.string().min(1, "회신 본문을 입력하세요."),
});
export type SendReplyInput = z.infer<typeof sendReplySchema>;

/** setAutoDraftEnabled 액션 입력. */
export const setAutoDraftSchema = z.object({
  ownerEmail: z.string().min(1),
  enabled: z.boolean(),
});
export type SetAutoDraftInput = z.infer<typeof setAutoDraftSchema>;
```

  - 명령: `npm test -- src/features/mailbox/__tests__/schemas.test.ts`
  - 기대 출력: `PASS` (전 케이스 green).

- [ ] **Step 3: queries.ts 구현 (타입 정의·SSR fetch — TDD 예외, typecheck로 검증)** — `listContacts` 패턴 차용. owner_email 필터 + 메시지별 최신 draft join. **server-only**.

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  mailboxMessageSchema,
  mailboxDraftSchema,
  type MailboxMessage,
  type MailboxDraft,
} from "./schemas";

export type MailboxEntry = {
  message: MailboxMessage;
  /** 가장 최근 draft (없으면 null) */
  latestDraft: MailboxDraft | null;
};

/** 본인 메일함(owner_email) 수신 메일 + 최신 초안. received_at desc. */
export async function listMailbox(
  ownerEmail: string,
  limit = 50,
): Promise<MailboxEntry[]> {
  const supabase = await createClient();
  const { data: msgs, error } = await supabase
    .from("mailbox_messages")
    .select("*")
    .eq("owner_email", ownerEmail)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[listMailbox] supabase error:", error);
    return [];
  }

  const messages: MailboxMessage[] = [];
  for (const row of msgs ?? []) {
    const r = mailboxMessageSchema.safeParse(row);
    if (r.success) messages.push(r.data);
    else console.error("[listMailbox] zod parse fail:", r.error.issues);
  }
  if (messages.length === 0) return [];

  const ids = messages.map((m) => m.id);
  const { data: drafts } = await supabase
    .from("mailbox_drafts")
    .select("*")
    .in("message_id", ids)
    .order("created_at", { ascending: false });

  const latestByMsg = new Map<string, MailboxDraft>();
  for (const row of drafts ?? []) {
    const r = mailboxDraftSchema.safeParse(row);
    if (!r.success) continue;
    if (!latestByMsg.has(r.data.message_id))
      latestByMsg.set(r.data.message_id, r.data); // created_at desc → 첫 건이 최신
  }

  return messages.map((message) => ({
    message,
    latestDraft: latestByMsg.get(message.id) ?? null,
  }));
}

/** 메일함 토글 상태 조회 (없으면 기본 ON). */
export async function getAutoDraftEnabled(ownerEmail: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("mailbox_settings")
    .select("auto_draft_enabled")
    .eq("owner_email", ownerEmail)
    .maybeSingle();
  return data?.auto_draft_enabled ?? true;
}
```

  - 명령: `npm run typecheck`
  - 기대 출력: 에러 0 (`mailbox/` 신규 모듈 타입 통과).

- [ ] **Step 4: 커밋** — `git commit -m "feat(mailbox): zod schemas + queries (RED→GREEN)"`

**의존**: Task 1 (테이블)

---

## Task 3 — Graph 메일 읽기 라이브러리 (RED 먼저)

스펙 §11. `sendmail.ts`의 fetch+status 에러 패턴 차용. TDD 적용 — fetch mock 테스트 RED → 구현 GREEN.

### Files
- Create `src/lib/microsoft/__tests__/mail-read.test.ts`
- Create `src/lib/microsoft/mail-read.ts`

### Steps

- [ ] **Step 1: RED — fetch mock 테스트** — `getGraphToken` + global `fetch` mock. 200 응답 파싱 / 401 에러 키 / since 필터 URL 검증.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth", () => ({ getGraphToken: vi.fn().mockResolvedValue("tok") }));

import { getInboxMessages } from "../mail-read";

const okBody = {
  value: [
    {
      id: "AAMkAD1",
      subject: "견적 문의",
      bodyPreview: "안녕하세요",
      body: { content: "<p>본문</p>", contentType: "html" },
      from: { emailAddress: { name: "김민수", address: "kim@u.ac.kr" } },
      receivedDateTime: "2026-06-22T00:12:00Z",
      isRead: false,
    },
  ],
};

beforeEach(() => vi.restoreAllMocks());

describe("getInboxMessages", () => {
  it("200 응답을 정규화 배열로 반환", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(okBody), { status: 200 }),
      );
    const r = await getInboxMessages("op@x.com");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.messages).toHaveLength(1);
      expect(r.messages[0].graphMessageId).toBe("AAMkAD1");
      expect(r.messages[0].fromEmail).toBe("kim@u.ac.kr");
    }
    // mailFolders/inbox/messages 경로 + owner 인코딩 확인
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain(
      "/users/op%40x.com/mailFolders/inbox/messages",
    );
  });

  it("since 지정 시 $filter receivedDateTime gt 포함", async () => {
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(okBody), { status: 200 }));
    await getInboxMessages("op@x.com", "2026-06-21T00:00:00Z");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("receivedDateTime+gt+2026-06-21T00:00:00Z");
  });

  it("401은 unauthorized 에러 키", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("nope", { status: 401 }),
    );
    const r = await getInboxMessages("op@x.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^unauthorized/);
  });
});
```

  - 명령: `npm test -- src/lib/microsoft/__tests__/mail-read.test.ts`
  - 기대 출력: import 실패 → `FAIL`(RED).

- [ ] **Step 2: GREEN — mail-read.ts 구현** — `sendmail.ts`의 token try/catch + status 분기 + `safeText` 동일 패턴.

```ts
import "server-only";
import { getGraphToken } from "./auth";

export type InboxMessage = {
  graphMessageId: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  bodyPreview: string | null;
  body: string | null;
  receivedAt: string | null;
  isRead: boolean;
};

export type GetInboxResult =
  | { ok: true; messages: InboxMessage[] }
  | { ok: false; error: string };

type GraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  isRead?: boolean;
};

/**
 * Microsoft Graph 수신함 조회 (Application 토큰, Mail.Read).
 * GET /users/{ownerEmail}/mailFolders/inbox/messages
 * since(ISO) 지정 시 receivedDateTime gt 증분. sendmail.ts 에러 패턴 차용.
 */
export async function getInboxMessages(
  ownerEmail: string,
  since?: string,
  top = 50,
): Promise<GetInboxResult> {
  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    return {
      ok: false,
      error: `token_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const params = new URLSearchParams();
  params.set("$top", String(top));
  params.set("$orderby", "receivedDateTime desc");
  params.set(
    "$select",
    "id,subject,bodyPreview,body,from,receivedDateTime,isRead",
  );
  if (since) params.set("$filter", `receivedDateTime gt ${since}`);
  // URLSearchParams는 공백을 '+'로 인코딩 — Graph가 허용. (sendmail.ts와 동일 fetch 스타일)
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    ownerEmail,
  )}/mailFolders/inbox/messages?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return {
      ok: false,
      error: `network_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (res.status === 401)
    return { ok: false, error: `unauthorized: ${await safeText(res)}` };
  if (res.status === 429)
    return { ok: false, error: `rate_limited: ${await safeText(res)}` };
  if (res.status !== 200)
    return { ok: false, error: `graph_${res.status}: ${await safeText(res)}` };

  const json = (await res.json()) as { value?: GraphMessage[] };
  const messages: InboxMessage[] = (json.value ?? []).map((m) => ({
    graphMessageId: m.id,
    fromName: m.from?.emailAddress?.name ?? null,
    fromEmail: m.from?.emailAddress?.address ?? null,
    subject: m.subject ?? null,
    bodyPreview: m.bodyPreview ?? null,
    body: m.body?.content ?? null,
    receivedAt: m.receivedDateTime ?? null,
    isRead: m.isRead ?? false,
  }));
  return { ok: true, messages };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
```

  - 명령: `npm test -- src/lib/microsoft/__tests__/mail-read.test.ts`
  - 기대 출력: `PASS`.

- [ ] **Step 3: REFACTOR + typecheck** — 중복 없음 확인. `npm run typecheck` → 에러 0.

- [ ] **Step 4: 커밋** — `git commit -m "feat(mailbox): Graph 수신함 읽기 라이브러리 mail-read (RED→GREEN)"`

**의존**: 없음 (Task 2와 병렬 가능)

---

## Task 4 — 발송 + 토글 server actions (RED 먼저)

스펙 §6,§7. `sendMailReply`(sendGraphMail + MAIL_DRY_RUN) + `setAutoDraftEnabled`. `contacts/actions.ts`의 zod safeParse + `getCurrentOperator` 권한 + `issues[0].message` + `revalidatePath` + `logActivity` 패턴. write는 service_role(admin client)로 RLS 우회.

### Files
- Create `src/features/mailbox/__tests__/actions.test.ts`
- Create `src/features/mailbox/actions.ts`

### Steps

- [ ] **Step 1: RED — actions 테스트** — `vi.hoisted` mock(`contacts/__tests__/actions.test.ts` 동일). admin client + getCurrentOperator + sendGraphMail + getInboxMessages mock.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdmin, mockGetOperator, mockSendGraphMail } = vi.hoisted(() => ({
  mockAdmin: vi.fn(),
  mockGetOperator: vi.fn(),
  mockSendGraphMail: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetOperator,
}));
vi.mock("@/lib/microsoft/sendmail", () => ({
  sendGraphMail: mockSendGraphMail,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/worklog/log", () => ({ logActivity: vi.fn() }));

import { sendMailReply, setAutoDraftEnabled } from "../actions";

/** message_id로 owner/from/subject join 조회 → 결과를 반환하는 가짜 admin client */
function makeAdmin(message: Record<string, unknown> | null) {
  const draftInsert = vi.fn().mockResolvedValue({ error: null });
  const settingsUpsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "mailbox_messages") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: message, error: null }),
          }),
        }),
      };
    }
    if (table === "mailbox_drafts") return { insert: draftInsert };
    if (table === "mailbox_settings") return { upsert: settingsUpsert };
    throw new Error("unexpected table " + table);
  });
  return { client: { from }, draftInsert, settingsUpsert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOperator.mockResolvedValue({ permission: "member", email: "op@x.com" });
});

describe("sendMailReply", () => {
  const msg = {
    id: "11111111-1111-4111-8111-111111111111",
    owner_email: "op@x.com",
    from_email: "kim@u.ac.kr",
    from_name: "김민수",
    subject: "견적 문의",
  };

  it("빈 본문 거부 (zod issues[0].message)", async () => {
    const r = await sendMailReply("11111111-1111-4111-8111-111111111111", "");
    expect(r.ok).toBe(false);
  });

  it("본인 메일함이 아니면 권한 거부", async () => {
    mockGetOperator.mockResolvedValue({ permission: "member", email: "other@x.com" });
    const { client } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(false);
  });

  it("정상 발송 — sendGraphMail(sender=owner_email) 호출 + draft status='sent'", async () => {
    const { client, draftInsert } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    mockSendGraphMail.mockResolvedValue({ ok: true });
    const r = await sendMailReply(msg.id, "회신드립니다.");
    expect(r.ok).toBe(true);
    expect(mockSendGraphMail).toHaveBeenCalledWith(
      expect.objectContaining({ senderUserId: "op@x.com", toEmail: "kim@u.ac.kr" }),
    );
    expect(draftInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: "sent", sent_by_email: "op@x.com" }),
    );
  });

  it("MAIL_DRY_RUN=true 시 sendGraphMail 미호출 + status='dry_run'", async () => {
    vi.stubEnv("MAIL_DRY_RUN", "true");
    const { client, draftInsert } = makeAdmin(msg);
    mockAdmin.mockReturnValue(client);
    const r = await sendMailReply(msg.id, "회신");
    expect(r.ok).toBe(true);
    expect(mockSendGraphMail).not.toHaveBeenCalled();
    expect(draftInsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ status: "dry_run" }),
    );
    vi.unstubAllEnvs();
  });
});

describe("setAutoDraftEnabled", () => {
  it("settings upsert 호출", async () => {
    const { client, settingsUpsert } = makeAdmin(null);
    mockAdmin.mockReturnValue(client);
    const r = await setAutoDraftEnabled("op@x.com", false);
    expect(r.ok).toBe(true);
    expect(settingsUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({ owner_email: "op@x.com", auto_draft_enabled: false }),
    );
  });
});
```

  - 명령: `npm test -- src/features/mailbox/__tests__/actions.test.ts`
  - 기대 출력: import 실패 → `FAIL`(RED).

- [ ] **Step 2: GREEN — actions.ts 구현** — `"use server"`. zod 검증 → 권한(본인 메일함) → DRY_RUN 분기 → sendGraphMail → draft insert → revalidate + logActivity.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { logActivity } from "@/features/worklog/log";
import { sendReplySchema, setAutoDraftSchema } from "./schemas";

export type MailboxActionResult = { ok: true } | { ok: false; error: string };

const MAILBOX_PATH = "/dashboard/mailbox";

/** 회신 발송 — 본인 메일함 한정. sendGraphMail(sender=owner_email). MAIL_DRY_RUN 안전장치. */
export async function sendMailReply(
  messageId: string,
  editedBody: string,
): Promise<MailboxActionResult> {
  const parsed = sendReplySchema.safeParse({ messageId, editedBody });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { data: msg, error: msgErr } = await admin
    .from("mailbox_messages")
    .select("id, owner_email, from_email, from_name, subject")
    .eq("id", parsed.data.messageId)
    .maybeSingle();
  if (msgErr) return { ok: false, error: msgErr.message };
  if (!msg) return { ok: false, error: "메일을 찾을 수 없습니다." };

  // Phase 1: 본인 메일함만 발송 가능 (Phase 2에서 canAccessMailbox로 확장).
  if (msg.owner_email !== me.email) {
    return { ok: false, error: "권한 없음 — 본인 메일함이 아닙니다." };
  }
  if (!msg.from_email) {
    return { ok: false, error: "원발신자 주소가 없어 회신할 수 없습니다." };
  }

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  const subject = msg.subject?.startsWith("RE:")
    ? msg.subject
    : `RE: ${msg.subject ?? ""}`;

  if (!dryRun) {
    const result = await sendGraphMail({
      senderUserId: msg.owner_email, // 메일함 주인 명의 발송
      toEmail: msg.from_email,
      toName: msg.from_name ?? undefined,
      subject,
      text: parsed.data.editedBody,
    });
    if (!result.ok) return { ok: false, error: result.error };
  }

  const { error: draftErr } = await admin.from("mailbox_drafts").insert({
    message_id: msg.id,
    draft_body: parsed.data.editedBody,
    status: dryRun ? "dry_run" : "sent",
    sent_at: new Date().toISOString(),
    sent_by_email: me.email, // 실제 처리자 감사 추적
  });
  if (draftErr) return { ok: false, error: draftErr.message };

  await logActivity({
    domain: "mailbox",
    action: dryRun ? "reply_dry_run" : "reply_sent",
    target_type: "mailbox_messages",
    target_id: msg.id,
    target_name: `${msg.from_name ?? msg.from_email} · ${subject}`,
    msg: dryRun ? "회신 메일 (dry-run)" : "회신 메일 발송",
  });
  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}

/** 메일함 자동초안 토글 (요구사항 4). settings upsert. */
export async function setAutoDraftEnabled(
  ownerEmail: string,
  enabled: boolean,
): Promise<MailboxActionResult> {
  const parsed = setAutoDraftSchema.safeParse({ ownerEmail, enabled });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me?.email || me.email !== parsed.data.ownerEmail) {
    return { ok: false, error: "권한 없음 — 본인 메일함 설정만 변경할 수 있습니다." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("mailbox_settings").upsert(
    {
      owner_email: parsed.data.ownerEmail,
      auto_draft_enabled: parsed.data.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_email" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}
```

  - 명령: `npm test -- src/features/mailbox/__tests__/actions.test.ts`
  - 기대 출력: `PASS` (전 케이스 green).

- [ ] **Step 3: typecheck + lint** — `npm run typecheck && npm run lint` → 에러/경고 0.

- [ ] **Step 4: 커밋** — `git commit -m "feat(mailbox): sendMailReply + setAutoDraftEnabled actions (RED→GREEN)"`

**의존**: Task 2 (schemas), Task 1 (테이블). sendGraphMail은 기존 모듈.

---

## Task 5 — 로컬 ingest 잡 (mailbox-ingest.mjs)

스펙 §4,§5. Graph 수신 → upsert → auto ON 운영자 미초안 메일 Ollama 초안 생성. standalone 스크립트라 Vitest 대상 외 — **검증은 `--dry-run` 실행 + DB 미변경 확인**(TDD 예외, 스크립트 검증 절차). `services-import.mjs`의 env 로딩 + supabase-js admin client 패턴 차용.

### Files
- Create `scripts/mailbox-ingest.mjs`

### Steps

- [ ] **Step 1: env 로딩 + supabase-js admin client + 인자 파싱** — `.env.local` 로딩(`services-import.mjs` 동일) + `--dry-run`. Graph 토큰은 client_credentials 직접 발급(`auth.ts` 로직 인라인 — 스크립트는 server-only 모듈 import 불가).

```js
// scripts/mailbox-ingest.mjs
//
// 메일함 ingest — 로컬 cron(launchd) 진입점. Vercel(서버리스)은 로컬 LLM 불가하여
// 수신→DB→초안 생성은 이 로컬 잡이 담당하고, 웹앱은 표시·승인·발송만 한다.
//
// 흐름:
//   1) Graph Application 토큰(client_credentials)으로 대상 운영자 수신함 조회
//   2) mailbox_messages upsert (onConflict graph_message_id — 멱등)
//   3) auto_draft_enabled=true 운영자의 미초안·미필터 메일을 Ollama로 회신 초안 생성
//   4) mailbox_drafts insert
//
// 대상 운영자: mailbox_settings에 row 존재하는 운영자 (스펙 §13 — 메뉴 사용 운영자 한정).
//
// 사용:
//   node scripts/mailbox-ingest.mjs --dry-run     # Graph/DB read만, write·LLM 생략
//   node scripts/mailbox-ingest.mjs               # 실제 적재 + 초안 생성
//
// 필요 env(.env.local): AZURE_AD_TENANT_ID/CLIENT_ID/CLIENT_SECRET,
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   MAILBOX_LLM_MODEL(기본 exaone3.5:7.8b), OLLAMA_URL(기본 http://localhost:11434)

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

function loadEnv() {
  const fromFile = existsSync(".env.local")
    ? readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .reduce((acc, l) => {
          const [k, ...v] = l.split("=");
          if (k) acc[k.trim()] = v.join("=").trim();
          return acc;
        }, {})
    : {};
  return { ...fromFile, ...process.env };
}

const env = loadEnv();
const DRY_RUN = process.argv.slice(2).includes("--dry-run");
const OLLAMA_URL = env.OLLAMA_URL ?? "http://localhost:11434";
const LLM_MODEL = env.MAILBOX_LLM_MODEL ?? "exaone3.5:7.8b";

for (const k of [
  "AZURE_AD_TENANT_ID",
  "AZURE_AD_CLIENT_ID",
  "AZURE_AD_CLIENT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!env[k]) {
    console.error(`Missing required env: ${k}`);
    process.exit(1);
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
```

  - 명령: `node -c scripts/mailbox-ingest.mjs` (문법 체크)
  - 기대 출력: 에러 없음(exit 0).

- [ ] **Step 2: Graph 토큰 + 수신함 조회 + no-reply 필터 헬퍼** — `auth.ts`의 client_credentials + `mail-read.ts`의 GET 경로 인라인.

```js
async function getGraphToken() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AZURE_AD_CLIENT_ID,
    client_secret: env.AZURE_AD_CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
  });
  const res = await fetch(
    `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  if (!res.ok) throw new Error(`graph auth ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function fetchInbox(token, ownerEmail, since) {
  const params = new URLSearchParams({
    $top: "50",
    $orderby: "receivedDateTime desc",
    $select: "id,subject,bodyPreview,body,from,receivedDateTime,isRead",
  });
  if (since) params.set("$filter", `receivedDateTime gt ${since}`);
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    ownerEmail,
  )}/mailFolders/inbox/messages?${params.toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`inbox ${res.status} ${await res.text()}`);
  return (await res.json()).value ?? [];
}

const SKIP_PATTERNS = [/no-?reply/i, /mailer-daemon/i, /postmaster/i, /newsletter/i];
function isAutoSender(fromEmail) {
  if (!fromEmail) return true;
  return SKIP_PATTERNS.some((re) => re.test(fromEmail));
}
```

  - 명령: `node -c scripts/mailbox-ingest.mjs`
  - 기대 출력: 에러 없음.

- [ ] **Step 3: Ollama 초안 생성 + main 루프** — 대상 운영자 순회, upsert, auto ON + 미초안 + 미필터 메일 초안 생성.

```js
async function generateDraft(message) {
  const prompt = [
    "당신은 대학 입학 원서접수 운영부의 담당자입니다.",
    "아래 받은 메일에 대한 회신 초안을 한국어 비즈니스 정중체로 작성하세요.",
    "인사 → 용건 확인 → 안내/조치 → 마무리 인사 순. 서명은 제외.",
    "",
    `[제목] ${message.subject ?? ""}`,
    `[본문] ${(message.bodyPreview ?? message.body ?? "").slice(0, 2000)}`,
  ].join("\n");

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: LLM_MODEL, prompt, stream: false }),
  });
  if (!res.ok) throw new Error(`ollama ${res.status} ${await res.text()}`);
  return (await res.json()).response?.trim() ?? "";
}

async function main() {
  const token = await getGraphToken();

  // 대상 운영자 = mailbox_settings row 존재 (메뉴 사용 운영자 한정, 스펙 §13)
  const { data: settings, error: setErr } = await supabase
    .from("mailbox_settings")
    .select("owner_email, auto_draft_enabled, last_synced_at");
  if (setErr) throw new Error(`settings: ${setErr.message}`);
  if (!settings || settings.length === 0) {
    console.log("대상 메일함 없음 (mailbox_settings 비어있음).");
    return;
  }

  let ingested = 0;
  let drafted = 0;

  for (const s of settings) {
    const inbox = await fetchInbox(token, s.owner_email, s.last_synced_at);
    for (const m of inbox) {
      const skip = isAutoSender(m.from?.emailAddress?.address);
      const rowData = {
        owner_email: s.owner_email,
        graph_message_id: m.id,
        from_name: m.from?.emailAddress?.name ?? null,
        from_email: m.from?.emailAddress?.address ?? null,
        subject: m.subject ?? null,
        body_preview: m.bodyPreview ?? null,
        body: m.body?.content ?? null,
        received_at: m.receivedDateTime ?? null,
        is_read: m.isRead ?? false,
        draft_skipped: skip,
      };

      if (DRY_RUN) {
        console.log(`[dry] ${s.owner_email} ← ${rowData.from_email} | ${rowData.subject}${skip ? " (skip)" : ""}`);
        continue;
      }

      const { data: up, error: upErr } = await supabase
        .from("mailbox_messages")
        .upsert(rowData, { onConflict: "graph_message_id", ignoreDuplicates: false })
        .select("id")
        .single();
      if (upErr) {
        console.error(`upsert fail: ${upErr.message}`);
        continue;
      }
      ingested++;

      // 초안 생성 조건: auto ON + 미필터 + 기존 draft 없음
      if (!s.auto_draft_enabled || skip) continue;
      const { count } = await supabase
        .from("mailbox_drafts")
        .select("id", { count: "exact", head: true })
        .eq("message_id", up.id);
      if ((count ?? 0) > 0) continue;

      try {
        const draftBody = await generateDraft(m);
        const { error: dErr } = await supabase.from("mailbox_drafts").insert({
          message_id: up.id,
          draft_body: draftBody,
          model_used: LLM_MODEL,
          status: "draft",
        });
        if (dErr) console.error(`draft insert fail: ${dErr.message}`);
        else drafted++;
      } catch (e) {
        console.error(`draft gen fail (${s.owner_email}):`, e.message);
      }
    }

    if (!DRY_RUN) {
      await supabase
        .from("mailbox_settings")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("owner_email", s.owner_email);
    }
  }

  console.log(`done — ingested=${ingested} drafted=${drafted} dryRun=${DRY_RUN}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

  - 명령(검증): `node scripts/mailbox-ingest.mjs --dry-run` (실 env 있을 때). DB write·LLM 호출 없이 수신 메일 목록만 stdout.
  - 기대 출력: `[dry] ...` 라인들 또는 `대상 메일함 없음`. DB `mailbox_messages` count 변화 0건(`scripts/list-tables.mjs` 또는 수동 count로 확인).

- [ ] **Step 4: 커밋** — `git commit -m "feat(mailbox): 로컬 ingest 잡 mailbox-ingest (Graph→DB→Ollama 초안)"`

**의존**: Task 1 (테이블). mail-read.ts(Task 3)와 로직 정합(인라인 복제).

---

## Task 6 — 사이드바 메뉴 + 페이지 메타 (slug mailbox)

스펙 §6. "고객 응대" group에 1줄 + 페이지 메타 1항목. 타입 정의/설정 변경 — TDD 예외, `_data.test.ts` 통과 + 빌드로 검증.

### Files
- Modify `src/app/dashboard/_data.ts` (line 91~97 사이 — '대학 연락처' item 뒤)
- Modify `src/app/dashboard/_data/page-meta-config.ts` (`data-requests` 항목 인접)

### Steps

- [ ] **Step 1: 사이드바 item 추가** — `_data.ts` "고객 응대" group items 배열 끝(대학 연락처 `contacts` item 다음)에 추가.

```ts
          {
            ico: "·",
            label: "메일함",
            count: "",
            slug: "mailbox",
            pattern: "list",
          },
```

- [ ] **Step 2: 페이지 메타 추가** — `page-meta-config.ts`에 `data-requests` 항목과 동일 형식으로 `mailbox` 추가.

```ts
  mailbox: {
    headline: { accent: "고객 응대", title: "메일함" },
    description:
      "본인 Outlook 수신함을 확인하고 AI 회신 초안을 검토·발송합니다.",
  },
```

- [ ] **Step 3: 검증** — `npm test -- src/app/dashboard/__tests__/_data.test.ts` (사이드바 구조 테스트 통과) + `npm run typecheck`.
  - 기대 출력: 테스트 `PASS`, typecheck 에러 0.

- [ ] **Step 4: 커밋** — `git commit -m "feat(mailbox): 사이드바 메뉴 + 페이지 메타 (slug mailbox)"`

**의존**: 없음 (페이지 Task 7 전에 slug 등록 필요 — 7의 선행 권장)

---

## Task 7 — 인스펙터 variant (mailbox) + ListRow 필드 + registry/types

스펙 §6. variant 폴더(View/Table/filters) + registry 1줄 + types union 1줄 + ListRow `mail*` 옵셔널 필드. View는 본문(읽기) + 초안편집 textarea + 발송/폐기/재생성. `worklog/View.tsx`(View-only) + `contacts/Table.tsx` 차용. View 내 상호작용은 client.

### Files
- Modify `src/app/dashboard/_components/patterns/ListPattern.tsx` (`ListRow` 타입에 `mail*` 필드 — line 488 부근 meetings 필드 뒤)
- Modify `src/app/dashboard/_components/inspector/list-variants/types.ts` (`Variant` union line 31 `| "performance"` 뒤)
- Modify `src/app/dashboard/_components/inspector/list-variants/registry.ts` (import + `mailbox:` 엔트리)
- Create `src/app/dashboard/_components/inspector/list-variants/mailbox/View.tsx`
- Create `src/app/dashboard/_components/inspector/list-variants/mailbox/Table.tsx`
- Create `src/app/dashboard/_components/inspector/list-variants/mailbox/filters.ts`

### Steps

- [ ] **Step 1: ListRow에 mail* 필드 추가** — `ListPattern.tsx` ListRow 타입 끝(meetings 블록 line 488 뒤, `};` 직전).

```ts
  /** mailbox variant — Graph 메시지 id (발송/재생성 키) */
  mailId?: string;
  /** mailbox — 메일함 주인 (owner_email = me) */
  mailOwnerEmail?: string;
  /** mailbox — 발신자 이름/주소 */
  mailFromName?: string | null;
  mailFromEmail?: string | null;
  /** mailbox — 제목 */
  mailSubject?: string | null;
  /** mailbox — 본문(읽기 전용 표시용) */
  mailBody?: string | null;
  /** mailbox — 수신 시각 (ISO) */
  mailReceivedAt?: string | null;
  /** mailbox — 열람 여부 (● 미열람 / ○ 열람) */
  mailIsRead?: boolean;
  /** mailbox — 초안 존재 여부 (✎초안준비 배지) */
  mailHasDraft?: boolean;
  /** mailbox — AI 초안 본문 (textarea 초기값) */
  mailDraftBody?: string | null;
  /** mailbox — 최신 draft 상태 (sent면 발송 완료 표시) */
  mailDraftStatus?: "draft" | "sent" | "discarded" | "dry_run" | null;
```

- [ ] **Step 2: types.ts Variant union + filters.ts** — union에 `| "mailbox"` 추가. `filters.ts`는 빈 filter + blank factory(`worklog`처럼 신규 생성 흐름 없음 — blank 생략, FILTERS 빈 배열).

`types.ts` (line 31 `| "performance";` → ):
```ts
  | "performance"
  | "mailbox";
```

`mailbox/filters.ts`:
```ts
import type { Filter } from "../../../patterns/ListPattern";

// mailbox: 수신 메일은 신규 생성 흐름 없음 (ingest 잡이 적재). filter chip 비활성.
export const MAILBOX_FILTERS: { value: Filter; label: string }[] = [];
```

- [ ] **Step 3: Table.tsx** — `contacts/Table.tsx` 차용. 열람표시(●/○) + 발신자 + 제목 + 수신시각 + 초안배지. 하드코딩 색상 금지(토큰 클래스).

```tsx
"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function formatTime(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function MailboxTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">발신자</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">초안</th>
          <th className="px-3 py-2">수신</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={5} className="px-3 py-6 text-center text-muted">
              수신 메일 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-washi-raised" : ""
              }`}
            >
              <td className="px-3 py-2 text-sm">
                <span className={row.mailIsRead ? "text-muted" : "text-vermilion"}>
                  {row.mailIsRead ? "○" : "●"}
                </span>
              </td>
              <td className="px-3 py-2 font-medium text-ink">
                {row.mailFromName || row.mailFromEmail || "-"}
              </td>
              <td className="px-3 py-2 text-sm text-ink">
                {row.mailSubject || "(제목 없음)"}
              </td>
              <td className="px-3 py-2">
                {row.mailHasDraft ? (
                  <span className="inline-block bg-line-soft px-2 py-0.5 text-xs text-ink">
                    {row.mailDraftStatus === "sent" ? "발송됨" : "✎ 초안"}
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {formatTime(row.mailReceivedAt)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: View.tsx** — 메일 헤더 → 본문(읽기) → 초안 편집 textarea → [발송][폐기][다시 생성]. client 상태(편집 본문) + 발송은 `onMailReply` prop(페이지 server action 배선). **재생성(다시 생성)은 Phase 1에서 비활성 버튼 + 안내**(로컬 ingest 잡이 재생성 — 웹앱은 LLM 직접 호출 안 함, 스펙 §3 보안 경계). `worklog/View.tsx` 구조 + `Section/Divider` 차용.

```tsx
"use client";

import { useState } from "react";
import { Section, DefList, Divider } from "../shared";
import type { ViewProps } from "../types";

function formatTs(iso?: string | null): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function MailboxView({ row, onMailReply }: ViewProps) {
  const [draft, setDraft] = useState(row.mailDraftBody ?? "");
  const [busy, setBusy] = useState(false);
  const sent = row.mailDraftStatus === "sent" || row.mailDraftStatus === "dry_run";

  async function handleSend() {
    if (!onMailReply || !row.mailId) return;
    setBusy(true);
    const r = await onMailReply(row.id, draft);
    setBusy(false);
    if (!r.ok) alert(`발송 실패: ${r.error ?? "알 수 없는 오류"}`);
  }

  return (
    <div className="space-y-6">
      <Section title="메일">
        <DefList
          items={[
            { term: "보낸이", desc: row.mailFromName || row.mailFromEmail || "-" },
            { term: "주소", desc: row.mailFromEmail || "-" },
            { term: "제목", desc: row.mailSubject || "(제목 없음)" },
            { term: "수신", desc: <span>{formatTs(row.mailReceivedAt)}</span> },
          ]}
        />
      </Section>

      <Divider />

      <Section title="본문">
        <p className="whitespace-pre-wrap text-sm text-ink-soft">
          {row.mailBody || row.mailDraftBody || "(본문 없음)"}
        </p>
      </Section>

      <Divider />

      <Section title="AI 회신 초안">
        {sent ? (
          <p className="text-sm text-muted">
            이미 발송된 메일입니다. ({row.mailDraftStatus})
          </p>
        ) : (
          <div className="space-y-3">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              className="w-full border border-line bg-washi px-3 py-2 text-sm text-ink"
              placeholder="회신 본문 (AI 초안 — 검토 후 편집)"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy || draft.trim().length === 0}
                onClick={handleSend}
                className="cursor-pointer border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream hover:bg-vermilion-deep disabled:opacity-50"
              >
                발송
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft("")}
                className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:bg-ink hover:text-cream"
              >
                폐기
              </button>
              <button
                type="button"
                disabled
                title="초안 재생성은 로컬 수집 잡이 담당합니다 (Phase 1)"
                className="cursor-not-allowed border border-line bg-transparent px-3 py-1 text-xs text-muted opacity-50"
              >
                다시 생성
              </button>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
```

- [ ] **Step 5: types.ts ViewProps에 onMailReply 추가** — `ViewProps`(types.ts)에 옵셔널 콜백.

```ts
  /** mailbox variant — 회신 발송 (페이지 server action 배선). */
  onMailReply?: (
    messageId: string,
    editedBody: string,
  ) => Promise<{ ok: boolean; error?: string }>;
```

- [ ] **Step 6: registry.ts 등록** — import 3줄 + 엔트리. (View만 — Table은 dispatch, EditForm 없음).

import 추가:
```ts
import { MailboxView } from "./mailbox/View";
import { MailboxTable } from "./mailbox/Table";
import { MAILBOX_FILTERS } from "./mailbox/filters";
```

엔트리(`performance:` 뒤):
```ts
  mailbox: {
    View: MailboxView,
    Table: MailboxTable,
    Filters: MAILBOX_FILTERS,
    // blank 없음 — 수신 메일은 ingest 잡이 적재 (신규 생성 흐름 없음)
  },
```

- [ ] **Step 7: InspectorListBody onMailReply 전달 배선** — `onMailReply`를 ListPattern → InspectorListBody → MailboxView로 전달. (참고: ListPattern Props + InspectorListBody 전달부에 prop 추가. `onChecklistToggle` 전달 패턴 동일 — 해당 파일 grep 후 동형 추가.)
  - 명령(탐색): `rg "onChecklistToggle" src/app/dashboard/_components/inspector/InspectorListBody.tsx`
  - 변경: ListPattern Props에 `onMailReply?` 추가 → `<InspectorListBody onMailReply={onMailReply} ... />` → InspectorListBody가 MailboxView에 forward.

- [ ] **Step 8: 검증** — `npm run typecheck && npm run lint && npm run build`.
  - 기대 출력: typecheck/lint 에러 0. 빌드 시 design-lint 하드코딩 색상 미검출(토큰 클래스만 사용). registry `satisfies Record<Variant, RegistryEntry>` 통과(union에 mailbox 추가했으므로).

- [ ] **Step 9: 커밋** — `git commit -m "feat(mailbox): 인스펙터 variant(View/Table/filters) + ListRow mail* 필드 + registry"`

**의존**: Task 4 (onMailReply가 sendMailReply에 배선되는 페이지는 Task 8). registry/types/ListRow는 독립.

---

## Task 8 — 전용 페이지 (SSR + onPersist 미사용, onMailReply/토글 배선)

스펙 §6. `/dashboard/mailbox/page.tsx`. `contacts/page.tsx` SSR + `requireMenu` + autoRefresh 차용. owner_email=me 메일 조회 → ListRow 매핑 → ListPattern variant="mailbox" + 자동초안 토글 + onMailReply=sendMailReply.

### Files
- Create `src/app/dashboard/mailbox/page.tsx`
- Create `src/app/dashboard/mailbox/_row-mapper.ts`
- Create `src/app/dashboard/mailbox/AutoDraftToggle.tsx`

### Steps

- [ ] **Step 1: _row-mapper.ts** — `MailboxEntry` → `ListRow`(mail* 필드). `contacts/_row-mapper.ts` 차용.

```ts
import type { ListRow } from "../_components/patterns/ListPattern";
import type { MailboxEntry } from "@/features/mailbox/queries";

export function mailboxEntryToListRow(e: MailboxEntry): ListRow {
  const { message: m, latestDraft: d } = e;
  return {
    id: m.id,
    name: m.subject ?? "(제목 없음)",
    status: "active",
    owner: m.owner_email,
    mailId: m.graph_message_id,
    mailOwnerEmail: m.owner_email,
    mailFromName: m.from_name,
    mailFromEmail: m.from_email,
    mailSubject: m.subject,
    mailBody: m.body,
    mailReceivedAt: m.received_at,
    mailIsRead: m.is_read,
    mailHasDraft: d !== null,
    mailDraftBody: d?.draft_body ?? null,
    mailDraftStatus: d?.status ?? null,
  };
}
```

- [ ] **Step 2: AutoDraftToggle.tsx (client)** — 상단 자동초안 ON/OFF. `setAutoDraftEnabled` 호출. 디자인 토큰 클래스만.

```tsx
"use client";

import { useState, useTransition } from "react";
import { setAutoDraftEnabled } from "@/features/mailbox/actions";

type Props = { ownerEmail: string; initialEnabled: boolean };

export function AutoDraftToggle({ ownerEmail, initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    startTransition(async () => {
      const r = await setAutoDraftEnabled(ownerEmail, next);
      if (!r.ok) {
        setEnabled(!next);
        alert(`설정 변경 실패: ${r.error ?? "알 수 없는 오류"}`);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={enabled}
      className={`cursor-pointer border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        enabled
          ? "border-vermilion bg-vermilion text-cream hover:bg-vermilion-deep"
          : "border-line bg-transparent text-muted hover:bg-ink hover:text-cream"
      }`}
    >
      자동 초안 {enabled ? "ON" : "OFF"}
    </button>
  );
}
```

- [ ] **Step 3: page.tsx (SSR)** — `contacts/page.tsx` 골격. requireMenu → me → listMailbox(me.email) → rows. ListPattern: variant="mailbox", readOnly(신규 생성 없음 — canCreate 미지정), extraActions=토글, onMailReply=sendMailReply 배선. onPersist 미사용(발송은 onMailReply 경로).

```tsx
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import { listMailbox, getAutoDraftEnabled } from "@/features/mailbox/queries";
import { sendMailReply } from "@/features/mailbox/actions";
import { mailboxEntryToListRow } from "./_row-mapper";
import { AutoDraftToggle } from "./AutoDraftToggle";

export default async function MailboxPage() {
  const slug = "mailbox";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const me = await getCurrentOperator();
  const myEmail = me?.email ?? "";

  const entries = myEmail ? await listMailbox(myEmail) : [];
  const autoEnabled = myEmail ? await getAutoDraftEnabled(myEmail) : true;
  const rows: ListRow[] = entries.map(mailboxEntryToListRow);
  const config = resolvePageMeta(slug, meta, entries.length);

  const header = (
    <div key="mailbox-header">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
    </div>
  );

  async function onMailReply(
    messageId: string,
    editedBody: string,
  ): Promise<{ ok: boolean; error?: string }> {
    "use server";
    const r = await sendMailReply(messageId, editedBody);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }

  return (
    <ListPattern
      title={meta.label}
      data={{ rows }}
      header={header}
      variant="mailbox"
      readOnly
      liveData
      currentUserName={me?.displayName ?? me?.email ?? ""}
      onMailReply={onMailReply}
      extraActions={
        myEmail ? (
          <AutoDraftToggle
            key="mailbox-toggle"
            ownerEmail={myEmail}
            initialEnabled={autoEnabled}
          />
        ) : undefined
      }
    />
  );
}
```

- [ ] **Step 4: 검증** — `npm run typecheck && npm run lint && npm run build`. (E2E는 인증·실 메일 의존이라 Phase 1 범위 외 — 빌드 통과 + 라우트 생성 확인.)
  - 기대 출력: `/dashboard/mailbox` 라우트가 빌드 산출에 포함. typecheck/lint 에러 0. design-lint 색상 위반 0.

- [ ] **Step 5: 커밋** — `git commit -m "feat(mailbox): 전용 페이지 SSR + 자동초안 토글 + 회신 발송 배선"`

**의존**: Task 2(queries), Task 4(actions), Task 6(slug 등록), Task 7(variant + onMailReply 배선)

---

## 통합 검증 (최종)

- [ ] `npm test` (mailbox 단위 전체 green) → `npm run typecheck` → `npm run lint` → `npm run build` 순차 통과.
- [ ] 마이그 적용(운영 단계, `db-migration-apply` 절차) 후 RLS 동작: authenticated read 성공, authenticated insert 차단, service_role insert 성공.
- [ ] `node scripts/mailbox-ingest.mjs --dry-run`으로 Graph 연결·필터 동작 확인(DB 미변경).
- [ ] PR 제목(conventional): `feat(mailbox): 메일함 Phase 1 — 수신 캐시·AI 회신 초안·본인 명의 발송`. 본문에 `## Summary` + `## Test plan`. 영향 파일 20+ → 전체 설계 등급(본 문서가 충족), worktree 격리 권장.

---

## 스펙 커버리지 self-review

스펙 §12 Phase 1 항목을 Task로 1:1 매핑했다. ①3 테이블 + RLS(read 운영부/write service_role) + GRANT + realtime publication = **Task 1** (worklog의 service_role-write 패턴 + contacts의 authenticated-read 혼합, realtime은 `alter publication ... add table` + duplicate 가드). ②zod/queries/actions(`sendMailReply`/`setAutoDraftEnabled`) = **Task 2·4**, `issues[0].message`·`getCurrentOperator`·`vi.hoisted` mock·service_role admin write 등 프로젝트 컨벤션 준수. ③`mail-read.ts`의 `getInboxMessages(owner, since)` = **Task 3**, `getGraphToken` + sendmail.ts의 token try/catch·status 분기·`safeText` 패턴 차용. ④`scripts/mailbox-ingest.mjs`(Graph→upsert→auto ON 미초안 메일 Ollama 초안→drafts insert, no-reply 필터) = **Task 5**, `services-import.mjs` env 로딩 + supabase-js admin client. ⑤사이드바 1줄 = **Task 6**(`_data.ts` "고객 응대" group + page-meta-config 동반). ⑥전용 페이지 SSR(owner=me, 토글, onMailReply 발송) = **Task 8**. ⑦variant 폴더 + registry 1줄 + types union 1줄 + ListRow mail* = **Task 7**. ⑧발송 sendGraphMail(sender=owner_email) + MAIL_DRY_RUN = **Task 4**에 포함(dry-run 시 status='dry_run' 이력만).

설계상 스펙 보강·이탈 2건을 명시한다: (a) **재생성("다시 생성") 버튼은 Phase 1에서 비활성**으로 둔다 — 스펙 §3 보안 경계상 웹앱(Vercel)은 로컬 Ollama를 호출할 수 없고 초안 생성은 로컬 ingest 잡 전담이므로, 버튼 활성화는 별도 트리거 메커니즘(예: 재생성 플래그 큐)이 필요해 Phase 1.5로 분리. (b) **발송 경로는 `onPersist`가 아닌 신규 `onMailReply` prop**으로 배선한다 — 메일 발송은 row CRUD가 아니라 외부 Graph 호출이라 onPersist(저장) 의미와 다르고, ListRow를 변형하지 않기 때문(InspectorListBody·ListPattern에 옵셔널 prop 1개 추가, 기존 variant 무영향). 실시간(realtime publication)은 등록까지만 하고 Phase 1 UI는 `autoRefresh`(기존 PageHeader)로 준실시간을 충족하며, Realtime 구독 UI는 후속 과제로 남긴다(스펙 §4 "Realtime 또는 자동 새로고침" 중 후자 채택). Phase 2 위임(`mailbox_delegations`·`canAccessMailbox`·`[내 메일함 ▼]`)은 전 Task에서 제외했고, 발송 권한 가드를 "본인 메일함" 조건으로 좁혀 Phase 2 확장 지점(`msg.owner_email !== me.email`)을 1곳에 격리했다.
