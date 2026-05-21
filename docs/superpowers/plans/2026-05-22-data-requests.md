# 자료 요청 발송 (data-requests) Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 운영자가 본인 담당 서비스를 클릭해 그 대학 연락처로 자료요청 HTML 메일을 본인 메일박스에서 즉시 발송한다.

**Architecture:** ListPattern + 신규 `data-request` list-variant (Table=본인 services, View=작성 폼). 수신자 후보는 page가 `row.dataRequestRecipients`로 첨부(client effect 불필요). 발송은 client View가 `sendDataRequestAction`(서버 액션, 발신=본인 operator email, `sendGraphMail`)을 직접 호출. 이력은 `data_request_sends` 테이블.

**Tech Stack:** Next.js App Router, TypeScript, zod, Supabase(server + service-role admin), Microsoft Graph sendMail, Vitest.

**참조:**
- `sendGraphMail({ senderUserId, toEmail, toName, cc[], subject, html })` — `src/lib/microsoft/sendmail.ts`
- `getCurrentOperator()` → `{ email, displayName, ... }` — `src/features/auth/queries.ts`
- `listServices({ ownerEmail })` (operator_email OR developer_email=me) — `src/features/services/queries.ts`
- `listContacts({ universityIn: [...], pageSize })` — `src/features/contacts/queries.ts` (ContactRow: customer_name/university_name/department_name/contact_email)
- `createAdminClient()` — `src/lib/supabase/admin.ts`
- list-variant 등록: `registry.ts` + `types.ts` Variant union
- spec: `docs/superpowers/specs/2026-05-22-data-requests-design.md`

마이그레이션은 **사용자가 수동 적용**(spec의 SQL). 구현 전제.

---

### Task 1: DB 마이그레이션 파일

**Files:** Create `supabase/migrations/20260522_data_request_sends_table.sql`

- [ ] **Step 1: 마이그레이션 파일 작성** (spec과 동일)

```sql
-- data_request_sends — 자료 요청 메일 발송 이력 (Phase 1: sent/failed/dry_run, Phase 2: scheduled)
begin;

create table if not exists public.data_request_sends (
  id uuid primary key default gen_random_uuid(),
  service_id uuid references public.services(id) on delete set null,
  university_name text not null,
  sender_email text not null,
  to_email text not null,
  to_name text,
  cc jsonb not null default '[]'::jsonb,
  subject text not null,
  body text not null,
  status text not null default 'sent',
  scheduled_at timestamptz,
  sent_at timestamptz,
  error text,
  created_by_email text not null,
  created_at timestamptz not null default now()
);

create index if not exists data_request_sends_created_by_idx
  on public.data_request_sends (created_by_email, created_at desc);
create index if not exists data_request_sends_scheduled_idx
  on public.data_request_sends (status, scheduled_at);

alter table public.data_request_sends enable row level security;

drop policy if exists "data_request_sends_select_own_or_admin" on public.data_request_sends;
create policy "data_request_sends_select_own_or_admin"
  on public.data_request_sends for select to authenticated
  using (public.is_admin() or created_by_email = (auth.jwt() ->> 'email'));

grant select on public.data_request_sends to authenticated;
grant all on public.data_request_sends to service_role;

commit;
notify pgrst, 'reload schema';
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260522_data_request_sends_table.sql
git commit -m "feat: data_request_sends 테이블 마이그레이션"
```
(사용자가 Supabase SQL editor에 적용. 코드 동작은 적용 후.)

---

### Task 2: 입력 스키마

**Files:** Create `src/features/data-requests/schemas.ts`; Test `src/features/data-requests/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect } from "vitest";
import { sendDataRequestInputSchema } from "../schemas";

const valid = {
  serviceId: "svc-1",
  universityName: "조선대학교",
  toEmail: "a@b.com",
  toName: "김담당",
  cc: [{ email: "c@d.com", name: "이참조" }],
  subject: "자료 요청",
  body: "안녕하세요.",
};

describe("sendDataRequestInputSchema", () => {
  it("정상 입력 파싱", () => {
    expect(sendDataRequestInputSchema.safeParse(valid).success).toBe(true);
  });
  it("cc 기본값 빈 배열", () => {
    const { cc: _c, ...rest } = valid;
    void _c;
    const r = sendDataRequestInputSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cc).toEqual([]);
  });
  it("toEmail 형식 불량 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...valid, toEmail: "x" }).success).toBe(false);
  });
  it("빈 제목 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...valid, subject: "" }).success).toBe(false);
  });
  it("빈 본문 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...valid, body: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL**
`npm test -- src/features/data-requests/__tests__/schemas.test.ts`

- [ ] **Step 3: Write `schemas.ts`**
```ts
import { z } from "zod";

export const dataRequestCcSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const sendDataRequestInputSchema = z.object({
  serviceId: z.string().nullable().optional(),
  universityName: z.string().min(1),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  cc: z.array(dataRequestCcSchema).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export type SendDataRequestInput = z.infer<typeof sendDataRequestInputSchema>;
export type DataRequestCc = z.infer<typeof dataRequestCcSchema>;
```

- [ ] **Step 4: Run → PASS (5 tests)**

- [ ] **Step 5: Commit**
```bash
git add src/features/data-requests/schemas.ts src/features/data-requests/__tests__/schemas.test.ts
git commit -m "feat: 자료요청 발송 입력 스키마"
```

---

### Task 3: 브랜드 HTML 템플릿 (escape + nl2br)

**Files:** Create `src/features/data-requests/mail-template.ts`; Test `src/features/data-requests/__tests__/mail-template.test.ts`

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect } from "vitest";
import { renderDataRequestHtml, escapeHtml, nl2br } from "../mail-template";

describe("escapeHtml", () => {
  it("HTML 특수문자 escape", () => {
    expect(escapeHtml(`<script>"&'`)).toBe("&lt;script&gt;&quot;&amp;&#39;");
  });
});

describe("nl2br", () => {
  it("줄바꿈을 <br>로", () => {
    expect(nl2br("a\nb")).toBe("a<br>b");
  });
});

describe("renderDataRequestHtml", () => {
  const html = renderDataRequestHtml({
    subject: "자료 요청",
    body: "줄1\n<b>굵게</b>",
    universityName: "조선대학교",
    serviceName: "원서접수",
  });
  it("브랜드 문자열 포함", () => {
    expect(html).toContain("운영부 상황실");
  });
  it("본문 escape 후 nl2br (주입 방지)", () => {
    expect(html).toContain("줄1<br>&lt;b&gt;굵게&lt;/b&gt;");
    expect(html).not.toContain("<b>굵게</b>");
  });
  it("대학명/서비스명 노출", () => {
    expect(html).toContain("조선대학교");
    expect(html).toContain("원서접수");
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `mail-template.ts`**
```ts
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function nl2br(s: string): string {
  return s.replace(/\n/g, "<br>");
}

export function renderDataRequestHtml(args: {
  subject: string;
  body: string;
  universityName: string;
  serviceName?: string | null;
}): string {
  const { subject, body, universityName, serviceName } = args;
  const safeBody = nl2br(escapeHtml(body));
  const svcLine = serviceName
    ? `${escapeHtml(universityName)} · ${escapeHtml(serviceName)}`
    : escapeHtml(universityName);
  return `<!DOCTYPE html><html lang="ko"><body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a1a1a;line-height:1.7;">
<div style="max-width:640px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #c0392b;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:13px;letter-spacing:0.04em;color:#c0392b;font-weight:700;">[운영부 상황실]</div>
    <div style="font-size:18px;font-weight:700;margin-top:6px;">${escapeHtml(subject)}</div>
    <div style="font-size:13px;color:#666;margin-top:4px;">${svcLine}</div>
  </div>
  <div style="font-size:14px;">${safeBody}</div>
  <div style="border-top:1px solid #ddd;margin-top:28px;padding-top:12px;font-size:11px;color:#999;">
    본 메일은 운영부 상황실에서 발송되었습니다.
  </div>
</div>
</body></html>`;
}
```

- [ ] **Step 4: Run → PASS (5 tests)**

- [ ] **Step 5: Commit**
```bash
git add src/features/data-requests/mail-template.ts src/features/data-requests/__tests__/mail-template.test.ts
git commit -m "feat: 자료요청 메일 브랜드 HTML 템플릿 (escape+nl2br)"
```

---

### Task 4: 발송 서버 액션

**Files:** Create `src/features/data-requests/actions.ts`; Test `src/features/data-requests/__tests__/actions.test.ts`

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const sendGraphMail = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: (...a: unknown[]) => sendGraphMail(...a) }));
const insertMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: () => ({ insert: insertMock }) })),
}));
const getCurrentOperator = vi.fn(async () => ({ email: "me@op.com", displayName: "나" }));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: () => getCurrentOperator() }));

import { sendDataRequestAction } from "../actions";

function fd(over: Record<string, string> = {}) {
  const f = new FormData();
  f.set("universityName", "조선대학교");
  f.set("serviceId", "svc-1");
  f.set("toEmail", "a@b.com");
  f.set("toName", "김담당");
  f.set("cc", JSON.stringify([{ email: "c@d.com" }]));
  f.set("subject", "자료 요청");
  f.set("body", "안녕하세요");
  for (const [k, v] of Object.entries(over)) f.set(k, v);
  return f;
}

describe("sendDataRequestAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendGraphMail.mockResolvedValue({ ok: true });
    getCurrentOperator.mockResolvedValue({ email: "me@op.com", displayName: "나" });
    delete process.env.MAIL_DRY_RUN;
  });

  it("미인증이면 ok:false", async () => {
    getCurrentOperator.mockResolvedValue(null);
    const r = await sendDataRequestAction(undefined, fd());
    expect(r?.ok).toBe(false);
  });

  it("toEmail 형식 불량이면 ok:false (발송 안 함)", async () => {
    const r = await sendDataRequestAction(undefined, fd({ toEmail: "x" }));
    expect(r?.ok).toBe(false);
    expect(sendGraphMail).not.toHaveBeenCalled();
  });

  it("정상 발송 — 발신자=본인 + sendGraphMail + insert(sent)", async () => {
    const r = await sendDataRequestAction(undefined, fd());
    expect(sendGraphMail).toHaveBeenCalledTimes(1);
    expect(sendGraphMail.mock.calls[0][0]).toMatchObject({ senderUserId: "me@op.com", toEmail: "a@b.com" });
    expect(insertMock).toHaveBeenCalled();
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: "sent", sender_email: "me@op.com" });
    expect(r?.ok).toBe(true);
  });

  it("MAIL_DRY_RUN=true면 미발송 + insert(dry_run)", async () => {
    process.env.MAIL_DRY_RUN = "true";
    const r = await sendDataRequestAction(undefined, fd());
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: "dry_run" });
    expect(r?.ok).toBe(true);
  });

  it("Graph 실패면 insert(failed) + ok:false", async () => {
    sendGraphMail.mockResolvedValue({ ok: false, error: "401" });
    const r = await sendDataRequestAction(undefined, fd());
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: "failed" });
    expect(r?.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `actions.ts`**
```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { sendDataRequestInputSchema, dataRequestCcSchema } from "./schemas";
import { renderDataRequestHtml } from "./mail-template";
import { z } from "zod";

export type DataRequestActionState = { ok: boolean; message: string } | undefined;

export async function sendDataRequestAction(
  _prev: DataRequestActionState,
  formData: FormData,
): Promise<DataRequestActionState> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const rawCc = formData.get("cc");
  let cc: { email: string; name?: string }[] = [];
  if (typeof rawCc === "string" && rawCc.trim()) {
    const parsedCc = z.array(dataRequestCcSchema).safeParse(JSON.parse(rawCc));
    if (!parsedCc.success) return { ok: false, message: "참조(CC) 형식이 올바르지 않습니다." };
    cc = parsedCc.data;
  }

  const parsed = sendDataRequestInputSchema.safeParse({
    serviceId: (formData.get("serviceId") as string) || null,
    universityName: formData.get("universityName"),
    toEmail: formData.get("toEmail"),
    toName: (formData.get("toName") as string) || undefined,
    cc,
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const input = parsed.data;
  const serviceName = (formData.get("serviceName") as string) || null;

  const html = renderDataRequestHtml({
    subject: input.subject,
    body: input.body,
    universityName: input.universityName,
    serviceName,
  });

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  let status: "sent" | "failed" | "dry_run" = "sent";
  let error: string | null = null;

  if (dryRun) {
    status = "dry_run";
  } else {
    const result = await sendGraphMail({
      senderUserId: me.email,
      toEmail: input.toEmail,
      toName: input.toName,
      cc: input.cc,
      subject: input.subject,
      html,
    });
    if (!result.ok) {
      status = "failed";
      error = result.error;
    }
  }

  const supabase = createAdminClient();
  await supabase.from("data_request_sends").insert({
    service_id: input.serviceId ?? null,
    university_name: input.universityName,
    sender_email: me.email,
    to_email: input.toEmail,
    to_name: input.toName ?? null,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    status,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    error,
    created_by_email: me.email,
  });

  revalidatePath("/dashboard/data-requests");

  if (status === "failed") {
    return { ok: false, message: `발송 실패: ${error ?? "알 수 없는 오류"}` };
  }
  return {
    ok: true,
    message: dryRun ? "테스트 모드 — 실제 발송하지 않았습니다." : "발송되었습니다.",
  };
}
```

- [ ] **Step 4: Run → PASS (5 tests)**

- [ ] **Step 5: Verify** `npm run lint` + `npm run typecheck` (dev server may run on :3000 — do NOT rm -rf .next)

- [ ] **Step 6: Commit**
```bash
git add src/features/data-requests/actions.ts src/features/data-requests/__tests__/actions.test.ts
git commit -m "feat: 자료요청 발송 서버 액션 (발신=본인 메일박스 + dry-run + 이력)"
```

---

### Task 5: 수신자 후보 빌더 (순수 함수) + 서비스/연락처 쿼리 헬퍼

**Files:** Create `src/features/data-requests/queries.ts`; Test `src/features/data-requests/__tests__/queries.test.ts`

- [ ] **Step 1: Write failing test** (순수 함수만 — DB 함수는 통합)
```ts
import { describe, it, expect } from "vitest";
import { toRecipients, filterRecipients, type DataRequestRecipient } from "../queries";

const contacts = [
  { customer_name: "김담당", university_name: "조선대학교", department_name: "입학처", contact_email: "kim@u.ac.kr" },
  { customer_name: "이담당", university_name: "조선대학교", department_name: null, contact_email: null },
  { customer_name: "박담당", university_name: "부산대학교", department_name: "교무처", contact_email: "park@p.ac.kr" },
];

describe("toRecipients", () => {
  it("이메일 있는 연락처만 변환", () => {
    const r = toRecipients(contacts);
    expect(r).toEqual([
      { email: "kim@u.ac.kr", name: "김담당", department: "입학처", universityName: "조선대학교" },
      { email: "park@p.ac.kr", name: "박담당", department: "교무처", universityName: "부산대학교" },
    ]);
  });
});

describe("filterRecipients", () => {
  const recs: DataRequestRecipient[] = toRecipients(contacts);
  it("대학명으로 필터", () => {
    expect(filterRecipients(recs, "조선대학교", "").map((r) => r.email)).toEqual(["kim@u.ac.kr"]);
  });
  it("검색어(이름/이메일) 부분일치", () => {
    expect(filterRecipients(recs, "부산대학교", "park").length).toBe(1);
    expect(filterRecipients(recs, "부산대학교", "없음").length).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `queries.ts`**
```ts
import "server-only";
import { listServices } from "@/features/services/queries";
import { listContacts } from "@/features/contacts/queries";

export type DataRequestRecipient = {
  email: string;
  name: string;
  department: string | null;
  universityName: string;
};

type ContactLike = {
  customer_name: string;
  university_name: string;
  department_name: string | null;
  contact_email: string | null;
};

/** 이메일 보유 연락처만 수신자 후보로 변환 (순수) */
export function toRecipients(contacts: ContactLike[]): DataRequestRecipient[] {
  const out: DataRequestRecipient[] = [];
  for (const c of contacts) {
    const email = (c.contact_email ?? "").trim();
    if (!email) continue;
    out.push({
      email,
      name: c.customer_name,
      department: c.department_name,
      universityName: c.university_name,
    });
  }
  return out;
}

/** 대학명 일치 + 검색어(이름/이메일 부분일치) 필터 (순수) */
export function filterRecipients(
  recs: DataRequestRecipient[],
  universityName: string,
  term: string,
): DataRequestRecipient[] {
  const t = term.trim().toLowerCase();
  return recs.filter(
    (r) =>
      r.universityName === universityName &&
      (t === "" || r.name.toLowerCase().includes(t) || r.email.toLowerCase().includes(t)),
  );
}

/** 본인 담당 services (operator/developer=me) */
export async function getMyDataRequestServices(meEmail: string) {
  const { rows } = await listServices({ ownerEmail: meEmail, pageSize: 1000 });
  return rows;
}

/** 본인 담당 대학들의 연락처 → 수신자 후보 */
export async function getRecipientsForUniversities(
  universityNames: string[],
): Promise<DataRequestRecipient[]> {
  if (universityNames.length === 0) return [];
  const { rows } = await listContacts({ universityIn: universityNames, pageSize: 1000 });
  return toRecipients(rows);
}
```
NOTE: confirm `listServices` accepts `{ ownerEmail, pageSize }` and returns `{ rows }`; confirm `listContacts` accepts `{ universityIn, pageSize }` returns `{ rows }`. Read those files and adapt the call shape if different (the pure functions `toRecipients`/`filterRecipients` are the tested core; the two async wrappers just adapt existing queries).

- [ ] **Step 4: Run → PASS (3 tests)**

- [ ] **Step 5: Commit**
```bash
git add src/features/data-requests/queries.ts src/features/data-requests/__tests__/queries.test.ts
git commit -m "feat: 자료요청 수신자 후보 빌더 + 서비스/연락처 쿼리 헬퍼"
```

---

### Task 6: ListRow 필드 + data-request Table

**Files:** Modify `src/app/dashboard/_components/patterns/ListPattern.tsx` (ListRow 타입); Create `src/app/dashboard/_components/inspector/list-variants/data-request/Table.tsx`; Test `.../data-request/__tests__/Table.test.tsx`

- [ ] **Step 1: ListRow에 수신자 필드 추가**
`ListRow` 타입(`assignment?:` 근처)에 추가:
```ts
  /** data-request variant — 이 서비스 대학의 수신자 후보 (page가 첨부) */
  dataRequestRecipients?: {
    email: string;
    name: string;
    department: string | null;
    universityName: string;
  }[];
```

- [ ] **Step 2: Write failing Table test**
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataRequestTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function row(over: Partial<ListRow> = {}): ListRow {
  return { id: "s1", name: "원서접수", status: "active", owner: "", universityName: "조선대학교", serviceName: "원서접수", operatorName: "송영신", developerName: "김지은", ...over } as ListRow;
}

describe("DataRequestTable", () => {
  it("대학명/서비스명/운영/개발 렌더", () => {
    render(<DataRequestTable rows={[row()]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("조선대학교")).toBeInTheDocument();
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("송영신")).toBeInTheDocument();
  });
  it("빈 목록 안내", () => {
    render(<DataRequestTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/담당 서비스가 없습니다/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run → FAIL**

- [ ] **Step 4: Write `Table.tsx`** (services Table 스타일, 행 클릭 → 인스펙터)
```tsx
"use client";

import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function DataRequestTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명</th>
          <th className="px-3 py-2">서비스명</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">개발자</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
              담당 서비스가 없습니다.
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
              <td className="px-3 py-2 font-medium text-ink">{row.universityName ?? "—"}</td>
              <td className="px-3 py-2 text-ink">{row.serviceName ?? row.name}</td>
              <td className="px-3 py-2 text-ink-soft">{row.operatorName ?? "—"}</td>
              <td className="px-3 py-2 text-ink-soft">{row.developerName ?? "—"}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 5: Run → PASS (2 tests)**

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/_components/inspector/list-variants/data-request/Table.tsx src/app/dashboard/_components/inspector/list-variants/data-request/__tests__/Table.test.tsx
git commit -m "feat: data-request Table + ListRow 수신자 후보 필드"
```

---

### Task 7: data-request View (작성 폼)

**Files:** Create `src/app/dashboard/_components/inspector/list-variants/data-request/View.tsx`; Test `.../data-request/__tests__/View.test.tsx`

- [ ] **Step 1: Write failing test**
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataRequestView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

vi.mock("@/features/data-requests/actions", () => ({ sendDataRequestAction: vi.fn(async () => ({ ok: true, message: "발송되었습니다." })) }));

function row(): ListRow {
  return {
    id: "s1", name: "원서접수", status: "active", owner: "",
    universityName: "조선대학교", serviceName: "원서접수",
    dataRequestRecipients: [
      { email: "kim@u.ac.kr", name: "김담당", department: "입학처", universityName: "조선대학교" },
      { email: "lee@u.ac.kr", name: "이담당", department: null, universityName: "조선대학교" },
    ],
  } as ListRow;
}

describe("DataRequestView", () => {
  it("서비스 헤더 + 발송 버튼 + 제목/본문 입력 렌더", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByText(/조선대학교/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /발송/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/제목/)).toBeInTheDocument();
  });
  it("수신자 후보(연락처)가 옵션으로 노출", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByText(/김담당/)).toBeInTheDocument();
  });
  it("이메일 후보가 없으면 안내", () => {
    const r = { ...row(), dataRequestRecipients: [] } as ListRow;
    render(<DataRequestView row={r} />);
    expect(screen.getByText(/등록된 연락처 이메일이 없습니다/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Write `View.tsx`** (client 작성 폼; 수신자 select + CC 칩 + 제목/본문 + 발송. 토큰 색, sharp 버튼, useEffect 금지)
```tsx
"use client";

import { useActionState, useState } from "react";
import type { ViewProps } from "../types";
import { Section } from "../shared";
import {
  sendDataRequestAction,
  type DataRequestActionState,
} from "@/features/data-requests/actions";

type Recipient = { email: string; name: string; department: string | null; universityName: string };

export function DataRequestView({ row }: ViewProps) {
  const recipients = (row.dataRequestRecipients ?? []) as Recipient[];
  const [state, formAction, pending] = useActionState<DataRequestActionState, FormData>(
    sendDataRequestAction,
    undefined,
  );
  const [search, setSearch] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [cc, setCc] = useState<Recipient[]>([]);

  const term = search.trim().toLowerCase();
  const filtered = recipients.filter(
    (r) => term === "" || r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term),
  );
  const toRecipient = recipients.find((r) => r.email === toEmail);

  const addCc = (email: string) => {
    const r = recipients.find((x) => x.email === email);
    if (r && !cc.some((c) => c.email === email) && email !== toEmail) setCc([...cc, r]);
  };
  const removeCc = (email: string) => setCc(cc.filter((c) => c.email !== email));

  if (recipients.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-medium text-ink">
          {row.universityName} · {row.serviceName ?? row.name}
        </h2>
        <p className="text-sm text-muted">이 대학에 등록된 연락처 이메일이 없습니다. 대학연락처에서 이메일을 먼저 등록하세요.</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <h2 className="text-lg font-medium text-ink">
        {row.universityName} · {row.serviceName ?? row.name}
      </h2>

      <input type="hidden" name="universityName" value={row.universityName ?? ""} />
      <input type="hidden" name="serviceId" value={row.id} />
      <input type="hidden" name="serviceName" value={row.serviceName ?? row.name} />
      <input type="hidden" name="toEmail" value={toEmail} />
      <input type="hidden" name="toName" value={toRecipient?.name ?? ""} />
      <input type="hidden" name="cc" value={JSON.stringify(cc.map((c) => ({ email: c.email, name: c.name })))} />

      <Section title="수신자">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="연락처 검색 (이름/이메일)"
          className="w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        />
        <select
          value={toEmail}
          onChange={(e) => setToEmail(e.target.value)}
          className="mt-2 w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        >
          <option value="">받는 사람 선택</option>
          {filtered.map((r) => (
            <option key={r.email} value={r.email}>
              {r.name}{r.department ? ` (${r.department})` : ""} · {r.email}
            </option>
          ))}
        </select>
      </Section>

      <Section title="참조 (CC)">
        <div className="flex flex-wrap gap-1.5">
          {cc.map((c) => (
            <span key={c.email} className="inline-flex items-center gap-1 border border-line px-2 py-0.5 text-xs text-ink">
              {c.name}
              <button type="button" onClick={() => removeCc(c.email)} className="cursor-pointer text-muted hover:text-vermilion">×</button>
            </span>
          ))}
        </div>
        <select
          value=""
          onChange={(e) => { if (e.target.value) addCc(e.target.value); }}
          className="mt-2 w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        >
          <option value="">참조 추가</option>
          {recipients.filter((r) => r.email !== toEmail && !cc.some((c) => c.email === r.email)).map((r) => (
            <option key={r.email} value={r.email}>{r.name} · {r.email}</option>
          ))}
        </select>
      </Section>

      <Section title="제목">
        <input
          type="text"
          name="subject"
          placeholder="제목을 입력하세요"
          className="w-full border border-line bg-transparent px-3 py-1.5 text-sm focus:border-vermilion focus:outline-none"
        />
      </Section>

      <Section title="본문">
        <textarea
          name="body"
          rows={8}
          placeholder="요청 내용을 입력하세요"
          className="w-full border border-line bg-transparent px-3 py-2 text-sm leading-relaxed focus:border-vermilion focus:outline-none"
        />
      </Section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !toEmail}
          className="inline-flex w-fit items-center border border-vermilion bg-vermilion px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "발송 중…" : "발송"}
        </button>
        {state ? (
          <span className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
```
NOTE: `Section` import from `"../shared"` (title + children). No `useEffect` (derived filter). All token colors. The submit is disabled until a 수신자 is chosen.

- [ ] **Step 4: Run → PASS (3 tests)**

- [ ] **Step 5: Verify** `npm run lint` (no react-hooks/set-state-in-effect — no useEffect) + `npm run typecheck`

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/_components/inspector/list-variants/data-request/View.tsx src/app/dashboard/_components/inspector/list-variants/data-request/__tests__/View.test.tsx
git commit -m "feat: data-request 작성 폼 View (수신자/CC/제목/본문 + 발송)"
```

---

### Task 8: variant 등록 (registry + types + filters)

**Files:** Create `src/app/dashboard/_components/inspector/list-variants/data-request/filters.ts`; Modify `registry.ts`, `types.ts`

- [ ] **Step 1: filters.ts**
```ts
// data-request — 칩 필터 없음 (본인 담당 서비스 목록만)
export const DATA_REQUEST_FILTERS: ReadonlyArray<{ value: string; label: string }> = [];
```

- [ ] **Step 2: types.ts Variant union에 추가** — `| "worklog"` 다음 줄에:
```ts
  | "data-request";
```
(기존 마지막 항목의 세미콜론 위치 주의 — union 끝에 추가)

- [ ] **Step 3: registry.ts** — import 추가 + 엔트리 추가:
```ts
import { DataRequestTable } from "./data-request/Table";
import { DataRequestView } from "./data-request/View";
import { DATA_REQUEST_FILTERS } from "./data-request/filters";
```
`variantRegistry` 객체에 (worklog 다음):
```ts
  "data-request": {
    View: DataRequestView,
    Table: DataRequestTable,
    Filters: DATA_REQUEST_FILTERS,
  },
```

- [ ] **Step 4: Verify** `npm run typecheck` (Variant union ↔ registry `satisfies Record<Variant, ...>` 정합) + `npm run lint`

- [ ] **Step 5: Commit**
```bash
git add src/app/dashboard/_components/inspector/list-variants/data-request/filters.ts src/app/dashboard/_components/inspector/list-variants/registry.ts src/app/dashboard/_components/inspector/list-variants/types.ts
git commit -m "feat: data-request variant 등록 (registry/types/filters)"
```

---

### Task 9: 페이지 + 전체 검증

**Files:** Create `src/app/dashboard/data-requests/page.tsx`

- [ ] **Step 1: Write `page.tsx`**
```tsx
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { ListPattern } from "../_components/patterns/ListPattern";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  getMyDataRequestServices,
  getRecipientsForUniversities,
} from "@/features/data-requests/queries";

export default async function DataRequestsPage() {
  const slug = "data-requests";
  await requireMenu(slug);
  const me = await getCurrentOperator();
  const meta = findSidebarMeta(slug);
  if (!meta || !me) return null;
  const pathname = `/dashboard/${slug}`;

  const services = await getMyDataRequestServices(me.email);
  const universities = [...new Set(services.map((s) => s.university_name))];
  const recipients = await getRecipientsForUniversities(universities);
  const byUniv = new Map<string, typeof recipients>();
  for (const r of recipients) {
    const arr = byUniv.get(r.universityName) ?? [];
    arr.push(r);
    byUniv.set(r.universityName, arr);
  }

  const rows: ListRow[] = services.map((s) => ({
    id: s.id,
    name: s.service_name,
    status: "active",
    owner: "",
    universityName: s.university_name,
    serviceName: s.service_name,
    operatorName: s.operator_name ?? s.operator_email ?? "",
    developerName: s.developer_name ?? s.developer_email ?? "",
    dataRequestRecipients: byUniv.get(s.university_name) ?? [],
  }));

  const config = resolvePageMeta(slug, meta, rows.length);

  return (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <ListPattern
        title="자료 요청"
        data={{ rows }}
        variant="data-request"
        readOnly
        liveData
      />
    </>
  );
}
```
NOTE: adapt `s.university_name / s.service_name / s.operator_name / s.operator_email / s.id` to the actual ServiceRow field names returned by `listServices` (read `src/features/services/queries.ts` + `schemas.ts`). If a `data-requests` page-meta entry is missing, add one to `src/app/dashboard/_data/page-meta-config.ts`: `"data-requests": { headline: { accent: "고객 응대", title: "자료 요청" }, description: "담당 서비스의 대학 연락처로 자료 요청 메일을 발송합니다." }`.

- [ ] **Step 2: page-meta 확인/추가** — `data-requests` 항목 없으면 위 NOTE대로 추가.

- [ ] **Step 3: 전체 검증**
```bash
npm run lint
npm run typecheck   # stale .next/types 보이면, dev server 떠있으면 끄지 말고 무시 / 아니면 rm -rf .next
npm test
```
모두 통과.

- [ ] **Step 4: dev 수동 검증** — 운영자 로그인 → /dashboard/data-requests → 본인 서비스 클릭 → 수신자 검색·선택 → 제목/본문 → 발송. **MAIL_DRY_RUN=true 권장** (dry_run 이력 확인). 비-admin은 allowed_menus에 data-requests 있어야 노출.

- [ ] **Step 5: Commit**
```bash
git add src/app/dashboard/data-requests/page.tsx src/app/dashboard/_data/page-meta-config.ts
git commit -m "feat: 자료 요청 발송 페이지 (본인 서비스 목록 + 작성 인스펙터)"
```

---

## Self-Review

- **Spec 커버리지**: 페이지/목록(Task 9/6) · 인스펙터 작성폼(Task 7) · 수신자 검색(Task 5 빌더 + Task 7 필터 + Task 9 첨부) · CC 다중(Task 7) · 발신=본인(Task 4) · HTML 브랜드+escape(Task 3) · 즉시발송+dry-run+failed(Task 4) · 이력 테이블(Task 1) · variant 등록(Task 8). Phase 2는 범위 외(테이블에 scheduled_at/status 선반영). ✅
- **Placeholder**: 없음 — 단, Task 5/9의 `listServices`/`listContacts`/ServiceRow 필드명은 "실제 시그니처 확인 후 적응" NOTE 명시(코드 블록은 가장 가능성 높은 형태로 제공). 구현자는 해당 파일을 읽고 필드명만 맞추면 됨.
- **타입 일관성**: `DataRequestActionState`(Task4)↔View(Task7) / `DataRequestRecipient`(Task5)↔ListRow 필드(Task6)↔View(Task7)/page(Task9) / `sendDataRequestInputSchema`(Task2)↔action(Task4) / Variant "data-request"(Task8)↔page variant(Task9). ✅
- **리스크**: (1) `listServices`/`listContacts` 호출 시그니처가 다르면 Task5/9에서 적응 필요. (2) ServiceRow 필드명(operator_name 등) 확인 필요. (3) page-meta 'data-requests' 엔트리 유무 확인. 모두 NOTE로 표시.
