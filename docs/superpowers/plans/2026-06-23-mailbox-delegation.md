# 메일함 위임 (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자 A가 본인 메일함을 다른 운영자 B에게 위임하면, B가 메일함 화면에서 A 메일함으로 전환해 열람 + A 명의 회신 발송을 할 수 있게 한다.

**Architecture:** 신규 `mailbox_delegations` 테이블 + `canAccessMailbox(viewer, owner)` 단일 권한 게이트. 발송 가드(`sendMailReply`)와 페이지 열람 가드가 이 게이트를 공용한다. 위임 관리는 운영자 셀프(메일함 페이지 내 모달), 발신은 항상 주인(owner) 명의 + `sent_by_email=B` 감사.

**Tech Stack:** Next.js App Router(RSC + Server Actions), Supabase(admin client + RLS), zod, Vitest, Tailwind. 기존 mailbox 도메인(`src/features/mailbox/`) 확장.

## Global Constraints

- 발신 명의 = 항상 메일함 주인(`owner_email`), `sent_by_email` = 실제 처리자(me.email). 기존 `sendMailReply` 동작 보존.
- 쓰기(insert/update)는 **service_role**(admin client)만 — RLS는 SELECT 전원 허용 / I·U·D 정책 없음. GRANT 필수(42501 회피).
- 위임 관리·발송은 항상 **본인 기준**: grant/revoke는 owner=me 고정. 타 메일함 위임 불가.
- 하드코딩 색상 금지(토큰/Tailwind), `any` 금지, 미사용 import 금지. 모달은 `components/common/ModalShell` 사용.
- 한국어 conventional commit(접두사 영어). TDD: 순수 로직·액션은 RED→GREEN.

---

## File Structure

- `supabase/migrations/20260623d_mailbox_delegations.sql` (create) — 테이블
- `supabase/migrations/20260623e_mailbox_delegations_rls.sql` (create) — RLS + GRANT
- `src/features/mailbox/schemas.ts` (modify) — delegation zod 추가
- `src/features/mailbox/delegation.ts` (create) — `isOwnerOrActiveDelegate`(순수) + `canAccessMailbox`/`listMyDelegations`/`listMailboxesDelegatedTo`(DB)
- `src/features/mailbox/__tests__/delegation.test.ts` (create)
- `src/features/mailbox/actions.ts` (modify) — `grantMailboxDelegation`/`revokeMailboxDelegation` 추가 + `sendMailReply` 가드 확장
- `src/features/mailbox/__tests__/actions.test.ts` (modify)
- `src/app/dashboard/mailbox/MailboxOwnerSwitcher.tsx` (create) — `[내 메일함 ▼]`
- `src/app/dashboard/mailbox/MailboxDelegationPanel.tsx` (create) — 위임 관리 모달
- `src/app/dashboard/mailbox/page.tsx` (modify) — owner 파라미터·가드·switcher·panel

---

## Task 1: 마이그레이션 — mailbox_delegations 테이블 + RLS

**Files:**
- Create: `supabase/migrations/20260623d_mailbox_delegations.sql`
- Create: `supabase/migrations/20260623e_mailbox_delegations_rls.sql`

**Interfaces:**
- Produces: 테이블 `public.mailbox_delegations(id, owner_email, grantee_email, granted_at, revoked_at)`, unique(owner_email, grantee_email). 컨트롤러가 프로덕션 적용.

- [ ] **Step 1: 테이블 마이그레이션 작성**

`supabase/migrations/20260623d_mailbox_delegations.sql`:
```sql
-- 메일함 위임 (Phase 2) — A(owner)가 B(grantee)에게 열람+발송 위임
begin;

create table if not exists public.mailbox_delegations (
  id            uuid primary key default gen_random_uuid(),
  owner_email   text not null,
  grantee_email text not null,
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  unique (owner_email, grantee_email)
);

create index if not exists mailbox_delegations_grantee_active_idx
  on public.mailbox_delegations (grantee_email)
  where revoked_at is null;

commit;
```

- [ ] **Step 2: RLS + GRANT 마이그레이션 작성** (news_rls 패턴 차용)

`supabase/migrations/20260623e_mailbox_delegations_rls.sql`:
```sql
-- mailbox_delegations RLS + GRANT
-- 정책: SELECT 전원 read / I·U·D 정책 없음 → service_role(서버 액션)만 쓰기
begin;

alter table public.mailbox_delegations enable row level security;

drop policy if exists "mailbox_delegations_select_all" on public.mailbox_delegations;
create policy "mailbox_delegations_select_all"
  on public.mailbox_delegations for select
  to authenticated
  using (true);

grant select on public.mailbox_delegations to authenticated;
grant all on public.mailbox_delegations to service_role;

commit;

notify pgrst, 'reload schema';
```

- [ ] **Step 3: 마이그 SQL 적용은 컨트롤러에게 인계** (이 태스크는 파일 작성까지. 적용은 사용자 또는 controller가 별도 수행)

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/20260623d_mailbox_delegations.sql supabase/migrations/20260623e_mailbox_delegations_rls.sql
git commit -m "feat(mailbox): 위임 테이블 + RLS 마이그레이션"
```

---

## Task 2: delegation 스키마 + canAccessMailbox 권한 게이트

**Files:**
- Modify: `src/features/mailbox/schemas.ts`
- Create: `src/features/mailbox/delegation.ts`
- Test: `src/features/mailbox/__tests__/delegation.test.ts`

**Interfaces:**
- Consumes: `createAdminClient` from `@/lib/supabase/admin`.
- Produces:
  - `mailboxDelegationSchema`, `type MailboxDelegation`, `delegationInputSchema` (schemas.ts)
  - `isOwnerOrActiveDelegate(viewer: string, owner: string, active: {owner_email: string; grantee_email: string}[]): boolean` (순수)
  - `canAccessMailbox(viewer: string, owner: string): Promise<boolean>`
  - `listMyDelegations(ownerEmail: string): Promise<MailboxDelegation[]>` (owner=me, 활성)
  - `listMailboxesDelegatedTo(granteeEmail: string): Promise<string[]>` (나에게 위임한 owner 이메일, 활성)

- [ ] **Step 1: 스키마 추가**

`src/features/mailbox/schemas.ts` 끝에 추가:
```ts
export const mailboxDelegationSchema = z.object({
  id: z.string().uuid(),
  owner_email: z.string(),
  grantee_email: z.string(),
  granted_at: z.string(),
  revoked_at: z.string().nullable(),
});
export type MailboxDelegation = z.infer<typeof mailboxDelegationSchema>;

export const delegationInputSchema = z.object({
  granteeEmail: z.string().email("올바른 이메일이 아닙니다."),
});
```

- [ ] **Step 2: 순수 함수 RED 테스트**

`src/features/mailbox/__tests__/delegation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { isOwnerOrActiveDelegate } from "../delegation";

describe("isOwnerOrActiveDelegate", () => {
  const active = [{ owner_email: "a@x.com", grantee_email: "b@x.com" }];
  it("본인(viewer===owner) → true", () => {
    expect(isOwnerOrActiveDelegate("a@x.com", "a@x.com", [])).toBe(true);
  });
  it("활성 위임(owner=a, grantee=b) → b가 a 접근 true", () => {
    expect(isOwnerOrActiveDelegate("b@x.com", "a@x.com", active)).toBe(true);
  });
  it("위임 없는 타인 → false", () => {
    expect(isOwnerOrActiveDelegate("c@x.com", "a@x.com", active)).toBe(false);
  });
  it("방향 반대(b 메일함을 a가) → false", () => {
    expect(isOwnerOrActiveDelegate("a@x.com", "b@x.com", active)).toBe(false);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/features/mailbox/__tests__/delegation.test.ts`
Expected: FAIL ("isOwnerOrActiveDelegate is not a function" / 모듈 없음)

- [ ] **Step 4: delegation.ts 구현**

`src/features/mailbox/delegation.ts`:
```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailboxDelegationSchema, type MailboxDelegation } from "./schemas";

/** 순수 — viewer가 owner 메일함을 볼 수 있는가(본인 또는 활성 위임). */
export function isOwnerOrActiveDelegate(
  viewer: string,
  owner: string,
  active: { owner_email: string; grantee_email: string }[],
): boolean {
  if (viewer === owner) return true;
  return active.some(
    (d) => d.owner_email === owner && d.grantee_email === viewer,
  );
}

/** viewer가 owner 메일함 접근 가능 여부 — 본인이거나 활성 위임 존재. */
export async function canAccessMailbox(
  viewer: string,
  owner: string,
): Promise<boolean> {
  if (viewer === owner) return true;
  const admin = createAdminClient();
  const { data } = await admin
    .from("mailbox_delegations")
    .select("id")
    .eq("owner_email", owner)
    .eq("grantee_email", viewer)
    .is("revoked_at", null)
    .maybeSingle();
  return !!data;
}

/** 내가 준 활성 위임 목록(owner=me). 위임 관리 패널용. */
export async function listMyDelegations(
  ownerEmail: string,
): Promise<MailboxDelegation[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_delegations")
    .select("*")
    .eq("owner_email", ownerEmail)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  if (error) {
    console.error("[listMyDelegations] error:", error.message);
    return [];
  }
  const rows: MailboxDelegation[] = [];
  for (const r of data ?? []) {
    const p = mailboxDelegationSchema.safeParse(r);
    if (p.success) rows.push(p.data);
  }
  return rows;
}

/** 나에게 위임한 owner 이메일 목록(활성). [내 메일함 ▼] 드롭다운용. */
export async function listMailboxesDelegatedTo(
  granteeEmail: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_delegations")
    .select("owner_email")
    .eq("grantee_email", granteeEmail)
    .is("revoked_at", null);
  if (error) {
    console.error("[listMailboxesDelegatedTo] error:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.owner_email as string);
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/features/mailbox/__tests__/delegation.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**
```bash
git add src/features/mailbox/schemas.ts src/features/mailbox/delegation.ts src/features/mailbox/__tests__/delegation.test.ts
git commit -m "feat(mailbox): canAccessMailbox 권한 게이트 + 위임 쿼리"
```

---

## Task 3: grant/revoke 위임 액션

**Files:**
- Modify: `src/features/mailbox/actions.ts`
- Test: `src/features/mailbox/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `createAdminClient`, `getCurrentOperator`, `delegationInputSchema`, `MailboxActionResult`.
- Produces:
  - `grantMailboxDelegation(granteeEmail: string): Promise<MailboxActionResult>`
  - `revokeMailboxDelegation(granteeEmail: string): Promise<MailboxActionResult>`

- [ ] **Step 1: RED 테스트 추가** (`actions.test.ts`)

기존 `makeAdmin`은 `mailbox_settings.upsert`만 다룬다. delegation 테이블 분기를 추가하기 위해 별도 가짜 admin을 쓴다. `actions.test.ts` 끝에 추가:
```ts
import { grantMailboxDelegation, revokeMailboxDelegation } from "../actions";

function makeDelegationAdmin() {
  const delegationUpsert = vi.fn().mockResolvedValue({ error: null });
  const operatorMaybe = vi.fn().mockResolvedValue({
    data: { email: "b@x.com" },
    error: null,
  });
  const delegationUpdateEq2 = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => {
    if (table === "operators") {
      return { select: () => ({ eq: () => ({ maybeSingle: operatorMaybe }) }) };
    }
    if (table === "mailbox_delegations") {
      return {
        upsert: delegationUpsert,
        update: () => ({ eq: () => ({ eq: delegationUpdateEq2 }) }),
      };
    }
    throw new Error("unexpected table " + table);
  });
  return { client: { from }, delegationUpsert, operatorMaybe, delegationUpdateEq2 };
}

describe("grantMailboxDelegation", () => {
  it("본인(owner=me) → B에게 위임 upsert(revoked_at=null)", async () => {
    const { client, delegationUpsert } = makeDelegationAdmin();
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("b@x.com");
    expect(r.ok).toBe(true);
    expect(delegationUpsert.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        owner_email: "op@x.com",
        grantee_email: "b@x.com",
        revoked_at: null,
      }),
    );
    expect(delegationUpsert.mock.calls[0][1]).toEqual(
      expect.objectContaining({ onConflict: "owner_email,grantee_email" }),
    );
  });

  it("본인에게 위임 → 거부", async () => {
    const { client } = makeDelegationAdmin();
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("op@x.com");
    expect(r.ok).toBe(false);
  });

  it("미존재 운영자 → 거부", async () => {
    const { client, operatorMaybe } = makeDelegationAdmin();
    operatorMaybe.mockResolvedValue({ data: null, error: null });
    mockAdmin.mockReturnValue(client);
    const r = await grantMailboxDelegation("ghost@x.com");
    expect(r.ok).toBe(false);
  });
});

describe("revokeMailboxDelegation", () => {
  it("revoked_at update 호출", async () => {
    const { client, delegationUpdateEq2 } = makeDelegationAdmin();
    mockAdmin.mockReturnValue(client);
    const r = await revokeMailboxDelegation("b@x.com");
    expect(r.ok).toBe(true);
    expect(delegationUpdateEq2).toHaveBeenCalled();
  });
});
```
(`mockAdmin`, `mockGetOperator`는 파일 상단 기존 hoisted mock 재사용. `beforeEach`가 `mockGetOperator`를 `{permission:"member", email:"op@x.com"}`로 설정함.)

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/mailbox/__tests__/actions.test.ts`
Expected: FAIL ("grantMailboxDelegation is not a function")

- [ ] **Step 3: 액션 구현** (`actions.ts` 끝에 추가, import에 `delegationInputSchema` 포함)

`schemas` import 줄에 `delegationInputSchema` 추가 후:
```ts
/** 위임 등록 — owner=me 고정. B는 실 운영자여야 하고 본인은 불가. 재위임 시 revoked_at 복구. */
export async function grantMailboxDelegation(
  granteeEmail: string,
): Promise<MailboxActionResult> {
  const parsed = delegationInputSchema.safeParse({ granteeEmail });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const grantee = parsed.data.granteeEmail;

  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "로그인이 필요합니다." };
  if (me.email === grantee) {
    return { ok: false, error: "본인에게 위임할 수 없습니다." };
  }

  const admin = createAdminClient();
  const { data: op } = await admin
    .from("operators")
    .select("email")
    .eq("email", grantee)
    .maybeSingle();
  if (!op) {
    return { ok: false, error: "등록되지 않은 운영자입니다." };
  }

  const { error } = await admin.from("mailbox_delegations").upsert(
    {
      owner_email: me.email,
      grantee_email: grantee,
      granted_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "owner_email,grantee_email" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}

/** 위임 해제 — owner=me 고정. revoked_at 설정(soft). */
export async function revokeMailboxDelegation(
  granteeEmail: string,
): Promise<MailboxActionResult> {
  const parsed = delegationInputSchema.safeParse({ granteeEmail });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "로그인이 필요합니다." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("mailbox_delegations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("owner_email", me.email)
    .eq("grantee_email", parsed.data.granteeEmail);
  if (error) return { ok: false, error: error.message };

  revalidatePath(MAILBOX_PATH);
  return { ok: true };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/mailbox/__tests__/actions.test.ts`
Expected: PASS (기존 + 신규 전부)

- [ ] **Step 5: Commit**
```bash
git add src/features/mailbox/actions.ts src/features/mailbox/__tests__/actions.test.ts
git commit -m "feat(mailbox): 위임 등록/해제 서버 액션"
```

---

## Task 4: sendMailReply 발송 가드 확장

**Files:**
- Modify: `src/features/mailbox/actions.ts`
- Test: `src/features/mailbox/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `canAccessMailbox` from `./delegation`.
- Produces: `sendMailReply` 가드가 본인 OR 활성 위임 허용으로 확장.

- [ ] **Step 1: RED 테스트 추가** (`actions.test.ts`)

`./delegation` 모듈을 mock 한다. 파일 상단 mock 블록 근처에 추가:
```ts
const { mockCanAccess } = vi.hoisted(() => ({ mockCanAccess: vi.fn() }));
vi.mock("../delegation", () => ({ canAccessMailbox: mockCanAccess }));
```
그리고 `describe("sendMailReply")` 안에 추가:
```ts
it("위임받은 B가 A 메일함 발송 허용 (canAccessMailbox=true)", async () => {
  mockGetOperator.mockResolvedValue({ permission: "member", email: "b@x.com" });
  mockCanAccess.mockResolvedValue(true);
  const { client } = makeAdmin(msg); // msg.owner_email = "op@x.com"
  mockAdmin.mockReturnValue(client);
  mockSendGraphMail.mockResolvedValue({ ok: true });
  const r = await sendMailReply(msg.id, "회신");
  expect(r.ok).toBe(true);
  // 발신 명의는 owner(op@x.com), 처리자는 b@x.com
  expect(mockSendGraphMail.mock.calls[0][0].senderUserId).toBe("op@x.com");
});

it("위임 없는 타인 발송 거부 (canAccessMailbox=false)", async () => {
  mockGetOperator.mockResolvedValue({ permission: "member", email: "c@x.com" });
  mockCanAccess.mockResolvedValue(false);
  const { client } = makeAdmin(msg);
  mockAdmin.mockReturnValue(client);
  const r = await sendMailReply(msg.id, "회신");
  expect(r.ok).toBe(false);
});
```
기존 "본인 메일함이 아니면 권한 거부" 테스트는 `mockCanAccess.mockResolvedValue(false)`를 명시하도록 수정(기본 mock 반환이 undefined이므로). `beforeEach`에 `mockCanAccess.mockResolvedValue(false)` 추가하고, 본인 정상발송 테스트(`op@x.com`)는 owner===me라 canAccess 호출 없이 통과함(아래 구현은 owner===me 단축).

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/mailbox/__tests__/actions.test.ts`
Expected: FAIL (위임 B 발송이 기존 가드에 막혀 ok=false)

- [ ] **Step 3: 가드 교체** (`actions.ts` `sendMailReply` 내 `import { canAccessMailbox } from "./delegation";` 추가)

기존:
```ts
  // Phase 1: 본인 메일함만 발송 가능 (Phase 2에서 canAccessMailbox로 확장).
  if (msg.owner_email !== me.email) {
    return { ok: false, error: "권한 없음 — 본인 메일함이 아닙니다." };
  }
```
교체:
```ts
  // 본인 메일함이거나 활성 위임을 받은 경우만 발송 가능 (발신 명의는 주인).
  if (!(await canAccessMailbox(me.email, msg.owner_email))) {
    return { ok: false, error: "권한 없음 — 본인 또는 위임받은 메일함이 아닙니다." };
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/mailbox/__tests__/actions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/features/mailbox/actions.ts src/features/mailbox/__tests__/actions.test.ts
git commit -m "feat(mailbox): 발송 가드 canAccessMailbox로 확장 — 위임 발송 허용"
```

---

## Task 5: 메일함 페이지 owner 전환 + 가드 + Switcher

**Files:**
- Create: `src/app/dashboard/mailbox/MailboxOwnerSwitcher.tsx`
- Modify: `src/app/dashboard/mailbox/page.tsx`

**Interfaces:**
- Consumes: `canAccessMailbox`, `listMailboxesDelegatedTo` from `@/features/mailbox/delegation`; `operatorNameByEmail` from `@/features/auth/operators`.
- Produces: `?owner=` 쿼리로 위임 메일함 열람. `MailboxOwnerSwitcher` 컴포넌트.

- [ ] **Step 1: Switcher 컴포넌트 작성** (thin client UI — 테스트 면제, 기존 NewsControls 선례)

`src/app/dashboard/mailbox/MailboxOwnerSwitcher.tsx`:
```tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

type OwnerOption = { email: string; label: string };

/** [내 메일함 ▼] — 본인 + 위임받은 메일함 전환. ?owner= 네비게이션. */
export function MailboxOwnerSwitcher({
  options,
  current,
}: {
  options: OwnerOption[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  if (options.length <= 1) return null;

  const onChange = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("owner", v);
    else next.delete("owner");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <select
      aria-label="메일함 선택"
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className="border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion"
    >
      {options.map((o) => (
        <option key={o.email} value={o.email}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: page.tsx owner 파라미터 + 가드 + switcher 배선**

`src/app/dashboard/mailbox/page.tsx` 수정:
- import 추가:
```ts
import { canAccessMailbox, listMailboxesDelegatedTo } from "@/features/mailbox/delegation";
import { operatorNameByEmail } from "@/features/auth/operators";
import { MailboxOwnerSwitcher } from "./MailboxOwnerSwitcher";
```
- 시그니처에 searchParams 추가:
```ts
export default async function MailboxPage({
  searchParams,
}: {
  searchParams: Promise<{ owner?: string }>;
}) {
```
- `myEmail` 계산 직후, `ensureMailboxSettings` 호출 다음에 owner 결정 + 가드:
```ts
  const sp = await searchParams;
  const requestedOwner = sp.owner?.trim() || myEmail;
  // 본인 또는 활성 위임만 열람. 권한 없으면 본인 메일함으로 폴백.
  const owner =
    requestedOwner === myEmail ||
    (myEmail && (await canAccessMailbox(myEmail, requestedOwner)))
      ? requestedOwner
      : myEmail;

  const delegatedOwners = myEmail
    ? await listMailboxesDelegatedTo(myEmail)
    : [];
  const ownerOptions = [
    { email: myEmail, label: "내 메일함" },
    ...delegatedOwners.map((e) => ({
      email: e,
      label: `${operatorNameByEmail(e) || e} 메일함`,
    })),
  ];
```
- `listMailbox(myEmail)` / `getAutoDraftEnabled(myEmail)` 호출을 `owner`로 교체:
```ts
  const entries = owner ? await listMailbox(owner) : [];
  const autoEnabled = owner ? await getAutoDraftEnabled(owner) : true;
```
- `AutoDraftToggle`의 `ownerEmail={myEmail}`는 **그대로 myEmail 유지**(자동초안 토글은 본인 메일함 설정만; 위임 열람 중엔 토글 비표시가 자연스러우나 1차는 본인일 때만 노출). `extraActions`를 다음으로 교체:
```tsx
      extraActions={
        <div className="flex items-center gap-2">
          <MailboxOwnerSwitcher options={ownerOptions} current={owner} />
          {owner === myEmail && myEmail ? (
            <AutoDraftToggle
              key="mailbox-toggle"
              ownerEmail={myEmail}
              initialEnabled={autoEnabled}
            />
          ) : null}
        </div>
      }
```

- [ ] **Step 3: 빌드/타입 검증**

Run: `npm run typecheck && npx eslint src/app/dashboard/mailbox/page.tsx src/app/dashboard/mailbox/MailboxOwnerSwitcher.tsx`
Expected: exit 0

- [ ] **Step 4: Commit**
```bash
git add src/app/dashboard/mailbox/MailboxOwnerSwitcher.tsx src/app/dashboard/mailbox/page.tsx
git commit -m "feat(mailbox): [내 메일함 ▼] 위임 전환 + 열람 가드"
```

---

## Task 6: 위임 관리 모달 패널

**Files:**
- Create: `src/app/dashboard/mailbox/MailboxDelegationPanel.tsx`
- Modify: `src/app/dashboard/mailbox/page.tsx`

**Interfaces:**
- Consumes: `grantMailboxDelegation`/`revokeMailboxDelegation` (actions), `listMyDelegations` (delegation), `operatorNameByEmail`, `ModalShell`.
- Produces: 메일함 상단 "위임 관리" 버튼 → 모달(목록 + 추가/해제).

- [ ] **Step 1: 패널 컴포넌트 작성** (thin client UI — 테스트 면제)

`src/app/dashboard/mailbox/MailboxDelegationPanel.tsx`:
```tsx
"use client";

import { useState } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import {
  grantMailboxDelegation,
  revokeMailboxDelegation,
} from "@/features/mailbox/actions";
import type { MailboxDelegation } from "@/features/mailbox/schemas";
import { operatorNameByEmail } from "@/features/auth/operators";

/** 위임 관리 — 내가 준 위임 목록 + 추가/해제(owner=me 고정 서버 액션). */
export function MailboxDelegationPanel({
  delegations,
}: {
  delegations: MailboxDelegation[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setPending(true);
    setMsg(null);
    const r = await fn();
    setPending(false);
    if (!r.ok) setMsg(r.error ?? "실패했습니다.");
    else setMsg(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center border border-line bg-transparent px-3 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-cream"
      >
        위임 관리
      </button>
      {open ? (
        <ModalShell title="메일함 위임 관리" onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-4 px-1 py-1">
            <p className="text-xs text-muted">
              위임하면 상대가 내 메일함을 열람하고 내 명의로 회신할 수 있습니다.
            </p>

            <div className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="위임할 운영자 이메일"
                className="flex-1 border border-line bg-cream px-3 py-2 text-sm text-ink outline-none focus:bg-white focus:border-vermilion"
              />
              <button
                type="button"
                disabled={pending || !email.trim()}
                onClick={() =>
                  run(async () => {
                    const r = await grantMailboxDelegation(email.trim());
                    if (r.ok) setEmail("");
                    return r;
                  })
                }
                className="inline-flex items-center border border-vermilion bg-vermilion px-3 py-2 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                위임
              </button>
            </div>
            {msg ? <span className="text-xs text-vermilion">{msg}</span> : null}

            <ul className="flex flex-col divide-y divide-line border-t border-line">
              {delegations.length === 0 ? (
                <li className="py-3 text-xs text-muted">위임한 운영자가 없습니다.</li>
              ) : (
                delegations.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between py-2 text-sm text-ink"
                  >
                    <span>
                      {operatorNameByEmail(d.grantee_email) || d.grantee_email}
                      <span className="ml-2 text-xs text-muted">
                        {d.grantee_email}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() =>
                        run(() => revokeMailboxDelegation(d.grantee_email))
                      }
                      className="text-xs text-muted transition-colors hover:text-vermilion disabled:opacity-50"
                    >
                      해제
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
```
(목록은 서버에서 받은 `delegations` prop. revoke/grant 후 `revalidatePath`로 페이지 갱신 → 모달 닫았다 열면 최신. 1차는 액션 후 페이지 refresh에 의존.)

- [ ] **Step 2: page.tsx에 패널 배선**

`page.tsx` import 추가:
```ts
import { listMyDelegations } from "@/features/mailbox/delegation";
import { MailboxDelegationPanel } from "./MailboxDelegationPanel";
```
owner 계산부 근처에 본인 위임 목록 조회:
```ts
  const myDelegations = myEmail ? await listMyDelegations(myEmail) : [];
```
`extraActions` div에 패널 버튼 추가(switcher 옆, **본인 메일함일 때만**):
```tsx
      extraActions={
        <div className="flex items-center gap-2">
          <MailboxOwnerSwitcher options={ownerOptions} current={owner} />
          {owner === myEmail && myEmail ? (
            <>
              <MailboxDelegationPanel delegations={myDelegations} />
              <AutoDraftToggle
                key="mailbox-toggle"
                ownerEmail={myEmail}
                initialEnabled={autoEnabled}
              />
            </>
          ) : null}
        </div>
      }
```

- [ ] **Step 3: 검증**

Run: `npm run typecheck && npx eslint src/app/dashboard/mailbox/MailboxDelegationPanel.tsx src/app/dashboard/mailbox/page.tsx`
Expected: exit 0

- [ ] **Step 4: 전체 mailbox 테스트 + 빌드**

Run: `npx vitest run src/features/mailbox && (unset NODE_ENV; npm run build)`
Expected: 테스트 PASS, build 성공(/dashboard/mailbox 라우트)

- [ ] **Step 5: Commit**
```bash
git add src/app/dashboard/mailbox/MailboxDelegationPanel.tsx src/app/dashboard/mailbox/page.tsx
git commit -m "feat(mailbox): 위임 관리 모달 패널"
```

---

## 운영 선행 (구현 후)

- Task 1 마이그(`20260623d`, `20260623e`)를 프로덕션 Supabase에 적용 — 컨트롤러가 pg 직접 적용 + RLS/GRANT 검증(`mailbox_delegations` select 권한, unique 제약 확인).
- cron ingest 무변경(위임은 열람 권한만, 수집과 독립).

## Self-Review 결과

- **Spec coverage**: §2 테이블→T1, §3 canAccessMailbox→T2, §4 페이지 전환/가드→T5, §5 발송 가드→T4, §6 관리 패널→T6, §8 테스트→T2/T3/T4 커버. 전 섹션 매핑 확인.
- **Placeholder**: 없음(모든 코드 블록 실제 구현).
- **Type 일관성**: `canAccessMailbox(viewer, owner)` 인자 순서 T2 정의 = T4/T5 사용 일치. `grantMailboxDelegation(granteeEmail)`/`revokeMailboxDelegation(granteeEmail)` T3 정의 = T6 사용 일치. `MailboxDelegation` 타입 T2 정의 = T6 prop 일치. `onConflict: "owner_email,grantee_email"` upsert 키 = T1 unique 제약 일치.
