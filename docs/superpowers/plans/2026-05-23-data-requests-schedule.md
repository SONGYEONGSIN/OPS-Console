# 자료요청 예약 발송 (Phase 2 — Supabase pg_cron) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** 자료요청을 미래 시각으로 예약하면 Supabase pg_cron이 15분마다 Next.js dispatch 라우트를 호출해 만료된 예약을 운영자 본인 명의로 발송한다 (GH Actions 미사용).

**Architecture:** 작성 폼 "예약 발송" 버튼 → 단일 `sendDataRequestAction`이 `mode='schedule'`로 분기해 `data_request_sends`에 `status='scheduled'`+`scheduled_at` insert(발송 X). pg_cron(15분) → `net.http_post` → `/api/data-requests/dispatch`(시크릿 가드) → `claim_due_data_requests()` RPC로 원자적 claim(중복 방지) → `sendGraphMail`(앱 토큰, 평문) → status sent/failed.

**Tech Stack:** Next.js App Router(route handler), TypeScript, zod, Supabase(service-role + pg_cron/pg_net + SQL function), Microsoft Graph, Vitest.

**참조:**
- 현재 `actions.ts`: `sendDataRequestAction(prev, formData)` — getCurrentOperator → cc 파싱 → `sendDataRequestInputSchema` → MAIL_DRY_RUN 분기 → sendGraphMail(text) → insert(status sent/failed/dry_run) → revalidate. (전체 현재 코드는 spec/이 plan 기준)
- 현재 `schemas.ts`: `sendDataRequestInputSchema { serviceId?, universityName, toEmail, toName?, cc, subject, body }`.
- 현재 `View.tsx`: `<form action={formAction}>` + 수신자 typeahead + CC + 제목/본문(defaultValue) + 단일 "발송" submit.
- `sendGraphMail({ senderUserId, toEmail, toName, cc, subject, text })` — 앱 토큰, 평문.
- `createAdminClient()` (service_role). API 라우트 패턴: `src/app/api/worklog/log/route.ts`.
- spec: `docs/superpowers/specs/2026-05-23-data-requests-schedule-design.md`.

`data_request_sends` 테이블·`scheduled_at`/`status` 컬럼은 이미 존재(마이그 불필요). claim 함수 SQL은 마이그 파일로 추가(사용자 수동 적용). pg_cron·pg_net 활성화 + cron.schedule + `CRON_SECRET`은 수동 설정(spec 참조).

---

### Task 1: claim 함수 마이그레이션 (SQL)

**Files:** Create `supabase/migrations/20260523_claim_due_data_requests_fn.sql`

- [ ] **Step 1: SQL 파일 작성**
```sql
-- 만료된 예약 자료요청을 원자적으로 claim — status 'scheduled' → 'sending' (RETURNING).
-- dispatch 라우트가 rpc로 호출. 다음 cron run과 중복 발송 방지.
create or replace function public.claim_due_data_requests()
returns setof public.data_request_sends
language sql
as $$
  update public.data_request_sends
  set status = 'sending'
  where status = 'scheduled' and scheduled_at <= now()
  returning *;
$$;

grant execute on function public.claim_due_data_requests() to service_role;
```

- [ ] **Step 2: Commit**
```bash
git add supabase/migrations/20260523_claim_due_data_requests_fn.sql
git commit -m "feat: claim_due_data_requests() — 예약 자료요청 원자적 claim 함수"
```
(사용자가 Supabase SQL editor에 적용. `language sql` 함수 본문은 `$$` 구분자 — SQL editor 붙여넣기 정상.)

---

### Task 2: schema — mode + scheduledAt 추가

**Files:** Modify `src/features/data-requests/schemas.ts`; Test `src/features/data-requests/__tests__/schemas.test.ts`

- [ ] **Step 1: Write failing test (append to schemas.test.ts)**
```ts
import { sendDataRequestInputSchema } from "../schemas"; // 기존 import 유지
// 기존 describe 유지, 아래 추가
describe("sendDataRequestInputSchema — mode/scheduledAt", () => {
  const base = {
    universityName: "조선대학교", toEmail: "a@b.com", subject: "제목", body: "본문",
  };
  it("mode 기본값 now", () => {
    const r = sendDataRequestInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.mode).toBe("now");
  });
  it("mode schedule + scheduledAt 허용", () => {
    const r = sendDataRequestInputSchema.safeParse({ ...base, mode: "schedule", scheduledAt: "2026-12-01T10:00" });
    expect(r.success).toBe(true);
  });
  it("잘못된 mode 거부", () => {
    expect(sendDataRequestInputSchema.safeParse({ ...base, mode: "later" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** `npm test -- src/features/data-requests/__tests__/schemas.test.ts`

- [ ] **Step 3: Modify `schemas.ts`** — add two fields to `sendDataRequestInputSchema` (keep existing fields):
```ts
export const sendDataRequestInputSchema = z.object({
  serviceId: z.string().nullable().optional(),
  universityName: z.string().min(1),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  cc: z.array(dataRequestCcSchema).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
  mode: z.enum(["now", "schedule"]).default("now"),
  scheduledAt: z.string().optional(),
});
```

- [ ] **Step 4: Run → PASS**

- [ ] **Step 5: Commit**
```bash
git add src/features/data-requests/schemas.ts src/features/data-requests/__tests__/schemas.test.ts
git commit -m "feat: 자료요청 스키마 mode(now|schedule)+scheduledAt"
```

---

### Task 3: action — KST 파서 + 예약 분기

**Files:** Modify `src/features/data-requests/actions.ts`; Test `src/features/data-requests/__tests__/actions.test.ts`

- [ ] **Step 1: Write failing tests (KST parser + schedule branch)**
Add a pure-parser test + schedule-branch tests. In `actions.test.ts`, import the parser and add:
```ts
import { sendDataRequestAction, parseScheduledAtKst } from "../actions";

describe("parseScheduledAtKst", () => {
  it("KST datetime-local → UTC Date", () => {
    const d = parseScheduledAtKst("2026-05-25T14:30");
    expect(d?.toISOString()).toBe("2026-05-25T05:30:00.000Z");
  });
  it("빈 값/잘못된 값 → null", () => {
    expect(parseScheduledAtKst("")).toBeNull();
    expect(parseScheduledAtKst("nope")).toBeNull();
  });
});
```
And in the existing `describe("sendDataRequestAction", ...)` add (the `fd()` helper sets subject/body etc.; extend it to accept overrides for mode/scheduledAt — if the existing `fd(over)` already merges overrides, pass `{ mode, scheduledAt }`):
```ts
  it("mode=schedule 미래 시각이면 예약 insert (발송 안 함)", async () => {
    const future = "2099-01-01T09:00";
    const r = await sendDataRequestAction(undefined, fd({ mode: "schedule", scheduledAt: future }));
    expect(sendGraphMail).not.toHaveBeenCalled();
    expect(insertMock.mock.calls[0][0]).toMatchObject({ status: "scheduled" });
    expect(insertMock.mock.calls[0][0].scheduled_at).toBeTruthy();
    expect(r?.ok).toBe(true);
  });
  it("mode=schedule 과거 시각이면 ok:false (insert 안 함)", async () => {
    const r = await sendDataRequestAction(undefined, fd({ mode: "schedule", scheduledAt: "2000-01-01T09:00" }));
    expect(r?.ok).toBe(false);
    expect(insertMock).not.toHaveBeenCalled();
  });
  it("mode=schedule scheduledAt 없으면 ok:false", async () => {
    const r = await sendDataRequestAction(undefined, fd({ mode: "schedule" }));
    expect(r?.ok).toBe(false);
  });
```
Ensure `fd()` includes `mode` only when overridden (default omits → schema default 'now'); the existing immediate-send tests must still pass (no mode → 'now').

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Modify `actions.ts`**
Add the exported pure parser at top (after imports):
```ts
/** datetime-local(KST) 문자열 → UTC Date. 빈/잘못된 값 null. */
export function parseScheduledAtKst(value: string): Date | null {
  if (!value) return null;
  const hasSeconds = /T\d\d:\d\d:\d\d/.test(value);
  const normalized = (hasSeconds ? value : `${value}:00`) + "+09:00";
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}
```
In `sendDataRequestAction`, the `parsed` object must also read mode/scheduledAt:
```ts
  const parsed = sendDataRequestInputSchema.safeParse({
    serviceId: (formData.get("serviceId") as string) || null,
    universityName: formData.get("universityName"),
    toEmail: formData.get("toEmail"),
    toName: (formData.get("toName") as string) || undefined,
    cc,
    subject: formData.get("subject"),
    body: formData.get("body"),
    mode: (formData.get("mode") as string) || "now",
    scheduledAt: (formData.get("scheduledAt") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const input = parsed.data;
```
After `const input = parsed.data;`, BEFORE the dry-run/send block, add the schedule branch:
```ts
  // 예약 발송: 발송하지 않고 status='scheduled'로 적재 (pg_cron dispatch가 처리).
  if (input.mode === "schedule") {
    const when = parseScheduledAtKst(input.scheduledAt ?? "");
    if (!when) return { ok: false, message: "예약 시각을 선택하세요." };
    if (when.getTime() <= Date.now()) {
      return { ok: false, message: "예약 시각은 현재 이후여야 합니다." };
    }
    const supabase = createAdminClient();
    const { error: insertError } = await supabase.from("data_request_sends").insert({
      service_id: input.serviceId ?? null,
      university_name: input.universityName,
      sender_email: me.email,
      to_email: input.toEmail,
      to_name: input.toName ?? null,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      status: "scheduled",
      scheduled_at: when.toISOString(),
      created_by_email: me.email,
    });
    revalidatePath("/dashboard/data-requests");
    if (insertError) {
      return { ok: false, message: `예약 저장 실패: ${insertError.message}` };
    }
    return {
      ok: true,
      message: `예약되었습니다 (${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(when)})`,
    };
  }
```
Keep the rest (dry-run/immediate-send) unchanged.

- [ ] **Step 4: Run → PASS** (parser 2 + schedule 3 + 기존 즉시 6 등)

- [ ] **Step 5: Verify** `npm run lint` + `npm run typecheck`

- [ ] **Step 6: Commit**
```bash
git add src/features/data-requests/actions.ts src/features/data-requests/__tests__/actions.test.ts
git commit -m "feat: 자료요청 예약 분기 (mode=schedule + KST 파서 + scheduled insert)"
```

---

### Task 4: dispatch API 라우트

**Files:** Create `src/app/api/data-requests/dispatch/route.ts`; Test `src/app/api/data-requests/dispatch/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendGraphMail = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/microsoft/sendmail", () => ({ sendGraphMail: (...a: unknown[]) => sendGraphMail(...a) }));
const rpcMock = vi.fn();
const updateEqMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: rpcMock,
    from: () => ({ update: () => ({ eq: updateEqMock }) }),
  })),
}));

import { POST } from "../route";

function req(secret?: string) {
  return new Request("http://localhost/api/data-requests/dispatch", {
    method: "POST",
    headers: secret ? { "x-cron-secret": secret } : {},
  });
}

describe("dispatch route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    sendGraphMail.mockResolvedValue({ ok: true });
    rpcMock.mockResolvedValue({ data: [], error: null });
  });

  it("시크릿 불일치 → 401", async () => {
    const res = await POST(req("wrong"));
    expect(res.status).toBe(401);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("시크릿 일치 + due 행 → 각각 발송 + 상태 갱신", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { id: "1", sender_email: "me@op.com", to_email: "a@b.com", to_name: "A", cc: [], subject: "s1", body: "b1" },
        { id: "2", sender_email: "me@op.com", to_email: "c@d.com", to_name: null, cc: [], subject: "s2", body: "b2" },
      ],
      error: null,
    });
    sendGraphMail.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "401" });
    const res = await POST(req("s3cr3t"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(sendGraphMail).toHaveBeenCalledTimes(2);
    expect(sendGraphMail.mock.calls[0][0]).toMatchObject({ senderUserId: "me@op.com", toEmail: "a@b.com", text: "b1" });
    expect(json).toMatchObject({ ok: true, dispatched: 2, sent: 1, failed: 1 });
  });
});
```

- [ ] **Step 2: Run → FAIL** `npm test -- src/app/api/data-requests/dispatch/__tests__/route.test.ts`

- [ ] **Step 3: Write `route.ts`**
```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";

type DueRow = {
  id: string;
  sender_email: string;
  to_email: string;
  to_name: string | null;
  cc: { email: string; name?: string }[] | null;
  subject: string;
  body: string;
};

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_due_data_requests");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as DueRow[];

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await sendGraphMail({
      senderUserId: row.sender_email,
      toEmail: row.to_email,
      toName: row.to_name ?? undefined,
      cc: row.cc ?? [],
      subject: row.subject,
      text: row.body,
    });
    if (result.ok) {
      sent += 1;
      await supabase
        .from("data_request_sends")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      failed += 1;
      await supabase
        .from("data_request_sends")
        .update({ status: "failed", error: result.error })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, dispatched: rows.length, sent, failed });
}
```

- [ ] **Step 4: Run → PASS (2 tests)**

- [ ] **Step 5: Verify** `npm run lint` + `npm run typecheck`

- [ ] **Step 6: Commit**
```bash
git add src/app/api/data-requests/dispatch/route.ts src/app/api/data-requests/dispatch/__tests__/route.test.ts
git commit -m "feat: 예약 자료요청 dispatch 라우트 (시크릿 가드 + claim + 발송)"
```

---

### Task 5: View — 예약 시각 입력 + "예약 발송" 버튼

**Files:** Modify `src/app/dashboard/_components/inspector/list-variants/data-request/View.tsx`; Test `.../data-request/__tests__/View.test.tsx`

- [ ] **Step 1: Write failing test (append to View.test.tsx)**
```ts
  it("예약 시각 입력 + '예약 발송' 버튼 렌더", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByLabelText("예약 시각")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "예약 발송" })).toBeInTheDocument();
  });
  it("예약 시각 미입력 시 '예약 발송' 비활성", () => {
    render(<DataRequestView row={row()} />);
    expect(screen.getByRole("button", { name: "예약 발송" })).toBeDisabled();
  });
```

- [ ] **Step 2: Run → FAIL**

- [ ] **Step 3: Modify `View.tsx`**
(a) Add state near the other useState: `const [scheduledAt, setScheduledAt] = useState("");`
(b) Replace the single 발송 button block at the bottom with: a datetime field + two buttons. Replace
```tsx
      {state ? (
        <p className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending || !toEmail}
        className="w-full cursor-pointer border border-vermilion bg-vermilion px-3 py-1.5 text-sm font-medium text-cream transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
      >
        {pending ? "발송 중…" : "발송"}
      </button>
```
with:
```tsx
      <label className="block text-xs">
        <span className="mb-1 block text-muted">예약 시각</span>
        <input
          type="datetime-local"
          name="scheduledAt"
          aria-label="예약 시각"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className={inputClass}
        />
      </label>

      {state ? (
        <p className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>{state.message}</p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          name="mode"
          value="now"
          disabled={pending || !toEmail}
          className="flex-1 cursor-pointer border border-vermilion bg-vermilion px-3 py-1.5 text-sm font-medium text-cream transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
        >
          {pending ? "발송 중…" : "발송"}
        </button>
        <button
          type="submit"
          name="mode"
          value="schedule"
          disabled={pending || !toEmail || !scheduledAt}
          className="flex-1 cursor-pointer border border-vermilion bg-transparent px-3 py-1.5 text-sm font-medium text-vermilion transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
        >
          예약 발송
        </button>
      </div>
```
(The datetime input has `name="scheduledAt"` so it submits; each button submits `mode` now/schedule. The action branches.)

- [ ] **Step 4: Run → PASS** `npm test -- .../data-request/__tests__/View.test.tsx`

- [ ] **Step 5: Verify** `npm run lint` (no useEffect) + `npm run typecheck`

- [ ] **Step 6: Commit**
```bash
git add src/app/dashboard/_components/inspector/list-variants/data-request/View.tsx src/app/dashboard/_components/inspector/list-variants/data-request/__tests__/View.test.tsx
git commit -m "feat: 자료요청 폼 예약 시각 + '예약 발송' 버튼 (mode 분기)"
```

---

### Task 6: 전체 검증 + 수동 설정 안내

**Files:** (검증만; 코드 변경 없음)

- [ ] **Step 1: 전체 검증**
```bash
npm run lint
npm run typecheck
npm test
```
모두 통과.

- [ ] **Step 2: 로컬 dispatch 스모크 (선택)**
`.env.local`에 `CRON_SECRET=<local>` 추가 후, 예약 1건(1~2분 후) insert → `curl -X POST http://localhost:3000/api/data-requests/dispatch -H 'x-cron-secret: <local>'` → 발송 + status='sent' 확인. (claim 함수가 DB에 적용돼 있어야 함.)

- [ ] **Step 3: 수동 설정(배포 시)** — 사용자에게 안내 (spec과 동일):
  1. Vercel 환경변수 `CRON_SECRET` 설정.
  2. Supabase: claim 함수 마이그(Task 1) 적용 + `pg_cron`·`pg_net` 확장 활성화.
  3. cron.schedule 등록:
  ```sql
  select cron.schedule('data-requests-dispatch','*/15 * * * *', $$
    select net.http_post(
      url := 'https://<PROD_DOMAIN>/api/data-requests/dispatch',
      headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>')
    );
  $$);
  ```

(코드 변경 없으므로 커밋 없음.)

---

## Self-Review

- **Spec 커버리지**: 예약 분기(Task 3) / dispatch+claim(Task 4, Task 1) / UI 예약버튼(Task 5) / schema(Task 2) / 수동설정·검증(Task 6) / 중복방지 claim(Task 1 함수 + Task 4 rpc) / 실패=failed(Task 4). 이력 화면은 비범위(spec과 일치). ✅
- **Placeholder**: `<PROD_DOMAIN>`/`<CRON_SECRET>`/`<local>`는 배포별 치환 값(의도). 코드 스텝엔 placeholder 없음.
- **타입 일관성**: `parseScheduledAtKst`(Task3)↔action↔test / `mode`·`scheduledAt`(Task2 schema)↔action(Task3)↔View hidden/버튼(Task5) / DueRow(Task4) ↔ claim 함수 returning(Task1, data_request_sends 행) / sendGraphMail `text`(Phase1) 재사용. ✅
- **리스크**: (1) `fd()` 헬퍼가 mode override를 안 받는 형태면 Task3에서 헬퍼 시그니처 보정. (2) dispatch 라우트 테스트의 admin client mock 체인(`from().update().eq()`)이 실제 호출 형태와 일치하는지 확인. (3) datetime-local 값에 초가 포함될 수 있어 parser가 둘 다 처리.

---

## 프로덕션 배포 체크리스트 (2026-05-23 기준)

로컬 end-to-end 검증 완료. 프로덕션 자동(주기) 발송은 **Vercel 배포가 선행 조건**이다.
배포 시점에 아래를 순서대로 적용하면 켜진다.

**이미 완료된 것:**
- [x] 미들웨어 수정 (`/api/data-requests/dispatch` → `PUBLIC_PATHS`) — origin/main 머지 (commit `f1d37f5`)
- [x] DB 마이그레이션 적용 — `claim_due_data_requests()` 함수 + `data_request_sends_status_chk`
- [x] Supabase 확장 활성화 — `pg_cron`, `pg_net`
- [x] 로컬 검증 — `dispatched:1, sent:1` (즉시발송 + 예약발송 dispatch 둘 다)

**배포 시 해야 할 것:**
- [ ] **1. Vercel 배포** — repo 연결 + 환경변수 등록(MAIL_* / SUPABASE_* (SERVICE_ROLE_KEY 포함) / AZURE_AD_* / SHAREPOINT_*) + 첫 배포. 프로덕션 도메인 확보.
- [ ] **2. Vercel 환경변수 `CRON_SECRET`** — 값은 `.env.local`의 CRON_SECRET과 동일(이미 생성됨, 로컬 `.env.local`에 보관). Production scope. 등록 후 **재배포**해야 빌드에 주입됨.
- [ ] **3. cron.schedule 등록** — Supabase SQL Editor에서 (`<PROD_DOMAIN>`은 1번 도메인, `<CRON_SECRET>`은 2번 값으로 치환):
  ```sql
  select cron.schedule('data-requests-dispatch','*/15 * * * *', $$
    select net.http_post(
      url := 'https://<PROD_DOMAIN>/api/data-requests/dispatch',
      headers := jsonb_build_object('content-type','application/json','x-cron-secret','<CRON_SECRET>')
    );
  $$);
  ```
  > 시크릿이 `cron.job` 테이블에 평문 저장된다. 더 엄격히 가려면 Supabase Vault 사용.
- [ ] **4. 검증** — `select * from cron.job;`로 등록 확인 → 다음 실행 후 `select * from net._http_response order by created desc limit 5;`로 200/JSON 응답 확인 → 예약 1건 잡고 15분 내 status `sent` 전환 확인.

**롤백/중지:** `select cron.unschedule('data-requests-dispatch');`
