# entertest 원서접수 테스트 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영자가 `/dashboard/dev-test`에서 원서접수 테스트 URL + 본인 테스트계정으로 표준 케이스 자동 테스트를 실행하고, 케이스별 PASS/FAIL · 실패 스크린샷 · 실행 이력을 확인한다.

**Architecture:** closing(Moa 서비스마감 스크래핑) 패턴을 100% 재사용. 웹에서 `entertest_test_runs` pending 적재 → 회사 PC 폴러(작업 스케줄러)가 `/api/entertest/test-request`로 claim → Python+Selenium `test_run.py`가 entertest 로그인→작성→테스트 결제 접수완료까지 표준 체크 실행 → `/api/entertest/ingest`로 결과 적재 → dev-test 페이지가 이력/상세 렌더.

**Tech Stack:** Next.js App Router + TypeScript, Supabase(@supabase/ssr + service_role admin), zod, Vitest, Python 3.12 + Selenium(undetected-chromedriver), PowerShell(회사 PC 작업 스케줄러).

**Spec:** `docs/superpowers/specs/2026-06-18-entertest-automation-design.md`

---

## File Structure

신규(웹):
- `supabase/migrations/20260627_entertest_test_runs.sql` — 실행 이력 테이블
- `supabase/migrations/20260627_operators_entertest_account.sql` — 운영자별 테스트 계정 컬럼
- `src/features/entertest/schemas.ts` — zod: status enum / check / test run row / ingest payload
- `src/features/entertest/result.ts` — `summarizeChecks` (순수 집계)
- `src/features/entertest/queries.ts` — `listEntertestRuns`, `getMyEntertestAccount`
- `src/features/entertest/actions.ts` — `requestEntertestRun`, `setMyEntertestAccount`
- `src/features/entertest/__tests__/{schemas,result}.test.ts`
- `src/app/api/entertest/test-request/route.ts` (+ `__tests__/route.test.ts`)
- `src/app/api/entertest/ingest/route.ts` (+ `__tests__/route.test.ts`)
- `src/app/dashboard/dev-test/page.tsx` — 서버 컴포넌트(이력+계정 fetch)
- `src/app/dashboard/dev-test/DevTestClient.tsx` — 클라이언트(실행 폼 + 이력 테이블 + 상세)

신규(회사 PC 러너):
- `scripts/entertest/poll-local.ps1` — pending claim → run-local → 완료 보고
- `scripts/entertest/run-local.ps1` — env 세팅 + test_run.py 실행
- `scripts/entertest/test_run.py` — Selenium 표준 체크 러너
- `scripts/entertest/register-poll-task.ps1` — 작업 스케줄러 등록
- `scripts/entertest/requirements.txt`

수정:
- `src/proxy.ts:12-25` — PUBLIC_PATHS에 entertest API 2개 추가

---

## Task 1: DB 마이그레이션

> **TDD 예외**: SQL 마이그레이션은 설정성 변경. RED-GREEN 대신 작성 → 사용자가 Supabase SQL Editor에 적용 → REST 검증. (프로젝트 관례: 스키마 변경 PR은 머지 전 적용.)

**Files:**
- Create: `supabase/migrations/20260627_entertest_test_runs.sql`
- Create: `supabase/migrations/20260627_operators_entertest_account.sql`

- [ ] **Step 1: entertest_test_runs 마이그레이션 작성**

`supabase/migrations/20260627_entertest_test_runs.sql`:

```sql
-- entertest 원서접수 테스트 자동화 — 실행 이력.
-- pending → running(claim) → done/failed/error. result는 케이스별 결과 jsonb.
create table if not exists public.entertest_test_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  target_url text not null,
  test_account text,
  status text not null default 'pending'
    check (status in ('pending','running','done','failed','error')),
  claimed_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  error_message text
);

alter table public.entertest_test_runs enable row level security;

-- 운영부 공개 read (로그인 사용자 전체)
drop policy if exists entertest_test_runs_read on public.entertest_test_runs;
create policy entertest_test_runs_read
  on public.entertest_test_runs for select
  to authenticated
  using (true);

grant select on public.entertest_test_runs to authenticated;

create index if not exists entertest_test_runs_status_idx
  on public.entertest_test_runs (status, requested_at);
```

- [ ] **Step 2: operators.entertest_account 마이그레이션 작성**

`supabase/migrations/20260627_operators_entertest_account.sql`:

```sql
-- 운영자별 entertest 테스트 계정 ID (ID=PW 동일). 운영자마다 상이.
alter table public.operators
  add column if not exists entertest_account text;

comment on column public.operators.entertest_account is
  'entertest 원서접수 테스트 계정 ID (로그인 PW는 ID와 동일). 운영자별 상이.';
```

- [ ] **Step 3: 사용자에게 적용 요청 + REST 검증**

사용자가 두 SQL을 Supabase SQL Editor에서 실행한 뒤, 적용 확인:

```bash
node -e "const{createClient}=require('@supabase/supabase-js');require('dotenv').config({path:'.env.local'});(async()=>{const s=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);const{error}=await s.from('entertest_test_runs').select('id').limit(1);console.log('entertest_test_runs:',error?error.message:'OK');const{error:e2}=await s.from('operators').select('entertest_account').limit(1);console.log('operators.entertest_account:',e2?e2.message:'OK');})()"
```

Expected: `entertest_test_runs: OK` 와 `operators.entertest_account: OK`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260627_entertest_test_runs.sql supabase/migrations/20260627_operators_entertest_account.sql
git commit -m "feat(entertest): 테스트 실행 이력 테이블 + operators 테스트계정 컬럼 마이그레이션"
```

---

## Task 2: zod 스키마

**Files:**
- Create: `src/features/entertest/schemas.ts`
- Test: `src/features/entertest/__tests__/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/entertest/__tests__/schemas.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  entertestCheckSchema,
  entertestIngestSchema,
  entertestRunSchema,
} from "../schemas";

describe("entertest schemas", () => {
  it("entertestCheckSchema — 유효 체크 파싱", () => {
    const parsed = entertestCheckSchema.parse({
      key: "login",
      label: "로그인",
      status: "pass",
      message: null,
    });
    expect(parsed.status).toBe("pass");
    expect(parsed.screenshot_url).toBeUndefined();
  });

  it("entertestCheckSchema — 잘못된 status 거부", () => {
    const r = entertestCheckSchema.safeParse({
      key: "x",
      label: "x",
      status: "weird",
      message: null,
    });
    expect(r.success).toBe(false);
  });

  it("entertestIngestSchema — done + checks 파싱", () => {
    const parsed = entertestIngestSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      status: "done",
      checks: [{ key: "login", label: "로그인", status: "pass", message: null }],
    });
    expect(parsed.checks).toHaveLength(1);
  });

  it("entertestIngestSchema — 잘못된 uuid 거부", () => {
    const r = entertestIngestSchema.safeParse({
      id: "not-uuid",
      status: "done",
      checks: [],
    });
    expect(r.success).toBe(false);
  });

  it("entertestRunSchema — nullable 필드 허용", () => {
    const parsed = entertestRunSchema.parse({
      id: "11111111-1111-1111-1111-111111111111",
      requested_by: "a@b.com",
      requested_at: "2026-06-18T00:00:00Z",
      target_url: "https://entertest.jinhakapply.com/Notice/1098146/A",
      test_account: null,
      status: "pending",
      claimed_at: null,
      finished_at: null,
      result: null,
      error_message: null,
    });
    expect(parsed.status).toBe("pending");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/entertest/__tests__/schemas.test.ts`
Expected: FAIL — `Cannot find module '../schemas'`

- [ ] **Step 3: Write minimal implementation**

`src/features/entertest/schemas.ts`:

```typescript
import { z } from "zod";

/** 테스트 실행 상태 — pending(대기) → running(claim) → done/failed/error. */
export const ENTERTEST_RUN_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "error",
] as const;
export const entertestRunStatusSchema = z.enum(ENTERTEST_RUN_STATUSES);
export type EntertestRunStatus = z.infer<typeof entertestRunStatusSchema>;

/** 케이스별 체크 결과. screenshot_url은 실패 시에만. */
export const entertestCheckSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pass", "fail", "skip"]),
  message: z.string().nullable(),
  screenshot_url: z.string().optional(),
});
export type EntertestCheck = z.infer<typeof entertestCheckSchema>;

/** 러너 → /api/entertest/ingest 페이로드. summary는 서버가 계산. */
export const entertestIngestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["done", "failed"]),
  checks: z.array(entertestCheckSchema),
  error_message: z.string().optional(),
});
export type EntertestIngest = z.infer<typeof entertestIngestSchema>;

/** 집계 요약 — result.checks 기준. */
export const entertestSummarySchema = z.object({
  pass: z.number().int(),
  fail: z.number().int(),
  total: z.number().int(),
});
export type EntertestSummary = z.infer<typeof entertestSummarySchema>;

/** result jsonb 형태. */
export const entertestResultSchema = z.object({
  checks: z.array(entertestCheckSchema),
  summary: entertestSummarySchema,
});
export type EntertestResult = z.infer<typeof entertestResultSchema>;

/** entertest_test_runs 행 (UI/쿼리용). */
export const entertestRunSchema = z.object({
  id: z.string().uuid(),
  requested_by: z.string(),
  requested_at: z.string(),
  target_url: z.string(),
  test_account: z.string().nullable(),
  status: entertestRunStatusSchema,
  claimed_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  result: entertestResultSchema.nullable(),
  error_message: z.string().nullable(),
});
export type EntertestRun = z.infer<typeof entertestRunSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/entertest/__tests__/schemas.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/entertest/schemas.ts src/features/entertest/__tests__/schemas.test.ts
git commit -m "feat(entertest): zod 스키마 (check/ingest/run)"
```

---

## Task 3: summarizeChecks (순수 집계)

**Files:**
- Create: `src/features/entertest/result.ts`
- Test: `src/features/entertest/__tests__/result.test.ts`

- [ ] **Step 1: Write the failing test**

`src/features/entertest/__tests__/result.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { summarizeChecks } from "../result";

describe("summarizeChecks", () => {
  it("pass/fail/total 집계 (skip은 total에만 포함)", () => {
    const summary = summarizeChecks([
      { key: "a", label: "A", status: "pass", message: null },
      { key: "b", label: "B", status: "fail", message: "에러" },
      { key: "c", label: "C", status: "skip", message: null },
    ]);
    expect(summary).toEqual({ pass: 1, fail: 1, total: 3 });
  });

  it("빈 배열 → 0/0/0", () => {
    expect(summarizeChecks([])).toEqual({ pass: 0, fail: 0, total: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/entertest/__tests__/result.test.ts`
Expected: FAIL — `Cannot find module '../result'`

- [ ] **Step 3: Write minimal implementation**

`src/features/entertest/result.ts`:

```typescript
import type { EntertestCheck, EntertestSummary } from "./schemas";

/** 케이스별 체크 결과 → 요약. total은 전체, pass/fail은 해당 상태 수(skip 제외). */
export function summarizeChecks(checks: EntertestCheck[]): EntertestSummary {
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    total: checks.length,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/entertest/__tests__/result.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/entertest/result.ts src/features/entertest/__tests__/result.test.ts
git commit -m "feat(entertest): summarizeChecks 집계 헬퍼"
```

---

## Task 4: queries (이력 목록 + 본인 계정)

> queries는 closing 패턴(safeParse + server-only)과 동일한 얇은 DB 래퍼. closing/queries에 단위테스트가 없는 관례를 따르되, **typecheck로 검증**한다.

**Files:**
- Create: `src/features/entertest/queries.ts`

- [ ] **Step 1: queries.ts 작성**

`src/features/entertest/queries.ts`:

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { entertestRunSchema, type EntertestRun } from "./schemas";

/** 최근 실행 이력 (기본 50건, 최신순). 파싱 실패 행은 제외. */
export async function listEntertestRuns(limit = 50): Promise<EntertestRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("entertest_test_runs")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data
    .map((row) => entertestRunSchema.safeParse(row))
    .filter((r): r is { success: true; data: EntertestRun } => r.success)
    .map((r) => r.data);
}

/** 로그인 운영자의 entertest 테스트 계정 ID. 미등록이면 null. */
export async function getMyEntertestAccount(email: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("operators")
    .select("entertest_account")
    .eq("email", email)
    .maybeSingle();
  if (error || !data) return null;
  const account = (data as { entertest_account: string | null }).entertest_account;
  return account && account.trim().length > 0 ? account : null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no errors in `src/features/entertest/queries.ts`

- [ ] **Step 3: Commit**

```bash
git add src/features/entertest/queries.ts
git commit -m "feat(entertest): 이력 목록 + 본인 테스트계정 쿼리"
```

---

## Task 5: /api/entertest/test-request 라우트 (claim/완료보고)

**Files:**
- Create: `src/app/api/entertest/test-request/route.ts`
- Test: `src/app/api/entertest/test-request/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/entertest/test-request/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: [] as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { GET, POST } from "../route";

function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(state.result),
  };
  for (const m of ["select", "eq", "order", "limit", "update", "insert"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(() => Promise.resolve(state.result));
  return b;
}

function get(secret?: string) {
  return new Request("http://localhost/api/entertest/test-request", {
    method: "GET",
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
  }) as unknown as Parameters<typeof GET>[0];
}
function post(opts: { secret?: string; body?: unknown }) {
  return new Request("http://localhost/api/entertest/test-request", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("/api/entertest/test-request", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    state.result = { data: [], error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("GET secret 없으면 401", async () => {
    expect((await GET(get())).status).toBe(401);
  });

  it("GET pending 없으면 request: null", async () => {
    state.result = { data: [], error: null };
    const res = await GET(get("s3cr3t"));
    expect(res.status).toBe(200);
    expect((await res.json()).request).toBeNull();
  });

  it("POST secret 없으면 401", async () => {
    expect((await POST(post({ body: { id: "x", ok: true } }))).status).toBe(401);
  });

  it("POST id 누락 시 400", async () => {
    const res = await POST(post({ secret: "s3cr3t", body: { ok: true } }));
    expect(res.status).toBe(400);
  });

  it("POST 완료 보고 → 200", async () => {
    state.result = { data: null, error: null };
    const res = await POST(
      post({ secret: "s3cr3t", body: { id: "abc", ok: true, message: "done" } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/entertest/test-request`
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Write minimal implementation**

`src/app/api/entertest/test-request/route.ts`:

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * entertest 테스트 '로컬 실행' 폴러 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 회사 PC 폴러(poll-local.ps1)가 호출한다.
 *   GET  → 가장 오래된 pending 1건을 원자적 claim(→running). 없으면 { request: null }.
 *   POST → 완료 보고 { id, ok, message } → ok=false면 status=error.
 * (ok=true여도 결과 적재는 /ingest가 done/failed로 별도 확정. 여기 POST는 실패-종료 보고용.)
 */

function authorized(request: NextRequest, secret: string): boolean {
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("entertest_test_runs")
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, request: null });
  }

  const { data: claimed, error } = await admin
    .from("entertest_test_runs")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select("id, target_url, test_account, requested_by")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, request: claimed ?? null });
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    ok?: unknown;
    message?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  }

  // ok=false (러너 비정상 종료/예외) → error로 마감. ok=true는 ingest가 별도로 done/failed 적재했으므로 무시.
  const admin = createAdminClient();
  if (body.ok !== true) {
    const message =
      typeof body.message === "string" ? body.message.slice(0, 500) : null;
    const { error } = await admin
      .from("entertest_test_runs")
      .update({ status: "error", finished_at: new Date().toISOString(), error_message: message })
      .eq("id", id);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/entertest/test-request`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/entertest/test-request/route.ts src/app/api/entertest/test-request/__tests__/route.test.ts
git commit -m "feat(entertest): test-request claim/완료보고 라우트"
```

---

## Task 6: /api/entertest/ingest 라우트 (결과 적재)

**Files:**
- Create: `src/app/api/entertest/ingest/route.ts`
- Test: `src/app/api/entertest/ingest/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

`src/app/api/entertest/ingest/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateAdminClient, state } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  state: { result: { data: null as unknown, error: null as unknown } },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

import { POST } from "../route";

function builder() {
  const b: Record<string, unknown> = {
    then: (resolve: (v: unknown) => void) => resolve(state.result),
  };
  for (const m of ["update", "eq", "select"]) b[m] = vi.fn(() => b);
  return b;
}

function post(opts: { secret?: string; body?: unknown }) {
  return new Request("http://localhost/api/entertest/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(opts.secret ? { authorization: `Bearer ${opts.secret}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  }) as unknown as Parameters<typeof POST>[0];
}

const VALID = {
  id: "11111111-1111-1111-1111-111111111111",
  status: "done",
  checks: [
    { key: "login", label: "로그인", status: "pass", message: null },
    { key: "pay", label: "결제", status: "fail", message: "타임아웃" },
  ],
};

describe("/api/entertest/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "s3cr3t";
    state.result = { data: null, error: null };
    mockCreateAdminClient.mockReturnValue({ from: vi.fn(() => builder()) });
  });

  it("secret 없으면 401", async () => {
    expect((await POST(post({ body: VALID }))).status).toBe(401);
  });

  it("잘못된 페이로드 400", async () => {
    const res = await POST(post({ secret: "s3cr3t", body: { id: "nope" } }));
    expect(res.status).toBe(400);
  });

  it("유효 페이로드 → 200 + summary 반환", async () => {
    const res = await POST(post({ secret: "s3cr3t", body: VALID }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toEqual({ pass: 1, fail: 1, total: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/api/entertest/ingest`
Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Write minimal implementation**

`src/app/api/entertest/ingest/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { entertestIngestSchema } from "@/features/entertest/schemas";
import { summarizeChecks } from "@/features/entertest/result";

/**
 * entertest 테스트 러너 결과 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 러너가 케이스별 체크 결과를 보낸다. 서버가 summary를 계산해 result jsonb로 적재하고
 * status를 done/failed로 마감한다. 스크린샷은 러너가 Storage에 업로드 후 URL만 담아 보낸다.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = entertestIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { id, status, checks, error_message } = parsed.data;
  const summary = summarizeChecks(checks);

  const admin = createAdminClient();
  const { error } = await admin
    .from("entertest_test_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      result: { checks, summary },
      error_message: error_message ?? null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, summary });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/api/entertest/ingest`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/entertest/ingest/route.ts src/app/api/entertest/ingest/__tests__/route.test.ts
git commit -m "feat(entertest): ingest 결과 적재 라우트 (summary 계산)"
```

---

## Task 7: proxy PUBLIC_PATHS 등록

> 설정성 변경. 미등록 시 미인증 폴러 호출이 `/login` HTML로 리다이렉트됨(closing #550 교훈). 검증 = typecheck + 주석/배열 확인.

**Files:**
- Modify: `src/proxy.ts:8-25`

- [ ] **Step 1: PUBLIC_PATHS에 entertest 2건 추가**

`src/proxy.ts`의 주석 블록 끝(`/api/closing/scrape-request — ...` 다음 줄)에 추가:

```
 *  /api/entertest/test-request — 회사 PC 폴러가 테스트 실행 요청을 claim/완료 보고.
 *  /api/entertest/ingest — entertest 테스트 러너가 케이스별 결과를 적재.
```

그리고 배열에서 `"/api/closing/scrape-request",` 다음 줄에 추가:

```typescript
  "/api/entertest/test-request",
  "/api/entertest/ingest",
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(entertest): proxy PUBLIC_PATHS에 entertest API 등록"
```

---

## Task 8: 서버 액션 (실행 요청 + 본인 계정 등록)

**Files:**
- Create: `src/features/entertest/actions.ts`

- [ ] **Step 1: actions.ts 작성**

`src/features/entertest/actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyEntertestAccount } from "./queries";

export type EntertestActionState = { ok: boolean; message: string } | undefined;

const urlSchema = z
  .string()
  .url("올바른 URL이 아닙니다.")
  .refine((u) => u.includes("entertest.jinhakapply.com"), {
    message: "entertest.jinhakapply.com 주소만 허용됩니다.",
  });

/**
 * 테스트 실행 요청 — pending 1건 적재. 회사 PC 폴러가 claim해 실행한다.
 * 본인 테스트 계정 미등록이면 거부. 이미 대기/진행 중이면 중복 적재 방지.
 */
export async function requestEntertestRun(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsedUrl = urlSchema.safeParse(formData.get("targetUrl"));
  if (!parsedUrl.success) {
    return { ok: false, message: parsedUrl.error.issues[0].message };
  }

  const account = await getMyEntertestAccount(me.email);
  if (!account) {
    return {
      ok: false,
      message: "테스트 계정이 등록되지 않았습니다. 먼저 본인 계정을 등록하세요.",
    };
  }

  const admin = createAdminClient();
  const { data: existing, error: selErr } = await admin
    .from("entertest_test_runs")
    .select("id")
    .in("status", ["pending", "running"])
    .limit(1);
  if (selErr) return { ok: false, message: selErr.message };
  if (existing && existing.length > 0) {
    return {
      ok: false,
      message: "이미 대기/진행 중인 테스트가 있습니다. 완료를 기다려 주세요.",
    };
  }

  const { error } = await admin.from("entertest_test_runs").insert({
    requested_by: me.email,
    target_url: parsedUrl.data,
    test_account: account,
    status: "pending",
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/dev-test");
  return {
    ok: true,
    message: "테스트 실행을 요청했습니다. 회사 PC 폴러가 곧 실행합니다.",
  };
}

const accountSchema = z
  .string()
  .trim()
  .regex(/^jt\d{5}$/, "jt + 5자리 숫자 형식이어야 합니다 (예: jt29001).");

/** 본인 entertest 테스트 계정(ID=PW 동일) 등록/수정. */
export async function setMyEntertestAccount(
  _prev: EntertestActionState,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const parsed = accountSchema.safeParse(formData.get("account"));
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("operators")
    .update({ entertest_account: parsed.data })
    .eq("email", me.email);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/dev-test");
  return { ok: true, message: "테스트 계정을 등록했습니다." };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/features/entertest/actions.ts
git commit -m "feat(entertest): 실행 요청 + 본인 테스트계정 등록 액션"
```

---

## Task 9: dev-test 페이지 (서버 컴포넌트 + 클라이언트)

> closing/page.tsx 패턴(requireMenu + PageHeader) 참고. dev-test는 list 패턴이 아니라 전용 페이지이므로 `dashboard/dev-test/page.tsx` 정적 세그먼트가 `[slug]` catch-all을 오버라이드한다. UI는 build/typecheck로 검증.

**Files:**
- Create: `src/app/dashboard/dev-test/page.tsx`
- Create: `src/app/dashboard/dev-test/DevTestClient.tsx`

- [ ] **Step 1: DevTestClient.tsx 작성 (클라이언트)**

`src/app/dashboard/dev-test/DevTestClient.tsx`:

```typescript
"use client";

import { useActionState } from "react";
import { useState } from "react";
import {
  requestEntertestRun,
  setMyEntertestAccount,
  type EntertestActionState,
} from "@/features/entertest/actions";
import type { EntertestRun, EntertestRunStatus } from "@/features/entertest/schemas";

const DEFAULT_URL = "https://entertest.jinhakapply.com/Notice/1098146/A";

const STATUS_LABEL: Record<EntertestRunStatus, string> = {
  pending: "대기",
  running: "실행 중",
  done: "완료",
  failed: "실패",
  error: "오류",
};

function StatusBadge({ status }: { status: EntertestRunStatus }) {
  const tone =
    status === "done"
      ? "text-ink bg-line-soft"
      : status === "failed" || status === "error"
        ? "text-paper bg-vermilion"
        : "text-ink-soft bg-cream";
  return (
    <span className={`inline-flex px-2 py-0.5 text-2xs ${tone}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DevTestClient({
  runs,
  myAccount,
}: {
  runs: EntertestRun[];
  myAccount: string | null;
}) {
  const [runState, runAction, runPending] = useActionState<
    EntertestActionState,
    FormData
  >(requestEntertestRun, undefined);
  const [acctState, acctAction, acctPending] = useActionState<
    EntertestActionState,
    FormData
  >(setMyEntertestAccount, undefined);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* 본인 테스트 계정 */}
      <section className="border border-line bg-paper p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">테스트 계정</h2>
        {myAccount ? (
          <p className="text-xs text-ink-soft">
            등록된 계정: <span className="font-semibold text-ink">{myAccount}</span>{" "}
            (ID=PW 동일)
          </p>
        ) : (
          <p className="mb-2 text-xs font-bold text-vermilion">
            테스트 계정이 등록되지 않았습니다. 본인 계정을 등록하세요.
          </p>
        )}
        <form action={acctAction} className="mt-2 flex items-center gap-2">
          <input
            name="account"
            defaultValue={myAccount ?? ""}
            placeholder="jt29001"
            className="border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <button
            type="submit"
            disabled={acctPending}
            className="cursor-pointer border border-line bg-paper px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
          >
            {myAccount ? "수정" : "등록"}
          </button>
          {acctState && (
            <span
              className={`text-2xs ${acctState.ok ? "text-ink-soft" : "text-vermilion"}`}
            >
              {acctState.message}
            </span>
          )}
        </form>
      </section>

      {/* 실행 요청 */}
      <section className="border border-line bg-paper p-3">
        <h2 className="mb-2 text-sm font-semibold text-ink">테스트 실행</h2>
        <form action={runAction} className="flex items-center gap-2">
          <input
            name="targetUrl"
            defaultValue={DEFAULT_URL}
            className="flex-1 border border-line bg-cream px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <button
            type="submit"
            disabled={runPending || !myAccount}
            className="cursor-pointer border border-line bg-paper px-3 py-1 text-xs text-ink transition-colors hover:border-vermilion hover:text-vermilion disabled:opacity-50"
          >
            테스트 실행
          </button>
        </form>
        {runState && (
          <p
            className={`mt-2 text-2xs ${runState.ok ? "text-ink-soft" : "text-vermilion"}`}
          >
            {runState.message}
          </p>
        )}
      </section>

      {/* 실행 이력 */}
      <section className="border border-line bg-paper">
        <h2 className="border-b border-line-soft px-3 py-2 text-sm font-semibold text-ink">
          실행 이력
        </h2>
        {runs.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted">
            실행 이력이 없습니다.
          </p>
        ) : (
          <ul className="divide-y divide-line-soft">
            {runs.map((run) => {
              const open = expanded === run.id;
              return (
                <li key={run.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : run.id)}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left text-xs hover:bg-washi-raised"
                  >
                    <StatusBadge status={run.status} />
                    <span className="text-muted">{run.requested_at.slice(0, 16).replace("T", " ")}</span>
                    <span className="text-ink-soft">{run.requested_by}</span>
                    {run.result && (
                      <span className="ml-auto text-ink">
                        {run.result.summary.pass}/{run.result.summary.total} 통과
                      </span>
                    )}
                  </button>
                  {open && run.result && (
                    <ul className="bg-cream px-3 py-2">
                      {run.result.checks.map((c) => (
                        <li key={c.key} className="flex items-center gap-2 py-1 text-2xs">
                          <span
                            className={
                              c.status === "pass"
                                ? "text-ink"
                                : c.status === "fail"
                                  ? "font-bold text-vermilion"
                                  : "text-muted"
                            }
                          >
                            {c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "–"}
                          </span>
                          <span className="text-ink-soft">{c.label}</span>
                          {c.message && <span className="text-muted">{c.message}</span>}
                          {c.screenshot_url && (
                            <a
                              href={c.screenshot_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-vermilion underline"
                            >
                              스크린샷
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {open && !run.result && run.error_message && (
                    <p className="bg-cream px-3 py-2 text-2xs text-vermilion">
                      {run.error_message}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: page.tsx 작성 (서버 컴포넌트)**

`src/app/dashboard/dev-test/page.tsx`:

```typescript
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  listEntertestRuns,
  getMyEntertestAccount,
} from "@/features/entertest/queries";
import { DevTestClient } from "./DevTestClient";

/**
 * /dashboard/dev-test — entertest 원서접수 케이스별 테스트 자동화.
 * 운영자가 URL+본인 계정으로 실행 요청 → 회사 PC 폴러가 실행 → 이력/상세 표시.
 * 정적 세그먼트라 [slug] list 패턴을 오버라이드한다.
 */
export default async function DevTestPage() {
  const slug = "dev-test";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const config = resolvePageMeta(slug, meta);

  const me = await getCurrentOperator();
  const [runs, myAccount] = await Promise.all([
    listEntertestRuns(50),
    me ? getMyEntertestAccount(me.email) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col">
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <DevTestClient runs={runs} myAccount={myAccount} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck`
Expected: exit 0

Run: `npm run lint`
Expected: 0 errors/warnings in dev-test files

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/dev-test/page.tsx src/app/dashboard/dev-test/DevTestClient.tsx
git commit -m "feat(entertest): dev-test 페이지 (실행 폼 + 계정 등록 + 이력 상세)"
```

---

## Task 10: 회사 PC 러너 (Python+Selenium + PowerShell 폴러)

> closing(`scripts/moa-closing/`) 패턴 복제. 검증은 회사 PC 실측(E2E). **Task 10-A(DOM 디스커버리)가 표준 체크 셀렉터를 확정**한 뒤 10-B에서 CHECKS를 채운다.

**Files:**
- Create: `scripts/entertest/requirements.txt`
- Create: `scripts/entertest/test_run.py`
- Create: `scripts/entertest/run-local.ps1`
- Create: `scripts/entertest/poll-local.ps1`
- Create: `scripts/entertest/register-poll-task.ps1`

- [ ] **Step 1: requirements.txt**

`scripts/entertest/requirements.txt`:

```
# entertest 원서접수 테스트 자동화 러너
selenium>=4.15.0
undetected-chromedriver>=3.5.5
python-dotenv>=1.0.0
requests>=2.31.0
```

- [ ] **Step 2: poll-local.ps1 (claim → run → 보고)**

`scripts/entertest/poll-local.ps1` — moa-closing/poll-local.ps1 복제, endpoint·전달 변수만 변경:

```powershell
# entertest 테스트 — 로컬 폴러 (회사 PC, 작업 스케줄러가 N분마다 호출)
#
# OPS의 '테스트 실행 요청'(entertest_test_runs pending)을 claim해 run-local.ps1을 실행하고
# 비정상 종료 시에만 완료(error) 보고한다. 정상 결과는 test_run.py가 /ingest로 직접 적재.
# 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

function Get-DotEnv([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return "" }
    foreach ($line in Get-Content $path) {
        if ($line -match "^\s*$([regex]::Escape($key))\s*=\s*(.*)$") {
            return $matches[1].Trim().Trim('"')
        }
    }
    return ""
}

$envPath = Join-Path $repo ".env.local"
$secret = Get-DotEnv $envPath "CRON_SECRET"
$base = (Get-DotEnv $envPath "OPS_CONSOLE_BASE_URL").TrimEnd("/")
if (-not $secret -or -not $base) {
    Write-Host "[poll] CRON_SECRET / OPS_CONSOLE_BASE_URL 미설정 — 종료"
    exit 1
}

$headers = @{ Authorization = "Bearer $secret" }
$uri = "$base/api/entertest/test-request"

# 1) pending claim
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $claim.request) { exit 0 }
$id = $claim.request.id
Write-Host "[poll] 요청 claim: $id ($($claim.request.target_url))"

# 2) run-local 실행 (run_id/url/account 전달)
$ok = $false
$msg = ""
try {
    $env:ENTERTEST_RUN_ID = $id
    $env:ENTERTEST_TARGET_URL = $claim.request.target_url
    $env:ENTERTEST_ACCOUNT = $claim.request.test_account
    & (Join-Path $PSScriptRoot "run-local.ps1")
    $code = $LASTEXITCODE
    $ok = ($code -eq 0)
    $msg = "exit $code"
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
}

# 3) 비정상 종료만 error 보고 (정상은 test_run.py가 ingest로 적재)
if (-not $ok) {
    $body = @{ id = $id; ok = $false; message = $msg } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
    Write-Host "[poll] error 보고: $msg"
}
exit 0
```

- [ ] **Step 3: run-local.ps1**

`scripts/entertest/run-local.ps1`:

```powershell
# entertest 테스트 러너 — 로컬 실행 래퍼 (poll-local.ps1이 호출).
# 회사 PC(residential IP)에서 실제 Chrome으로 Cloudflare 브라우저 게이트 통과.
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

$log = Join-Path $repo "scripts\entertest\run-local.log"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $ts 시작 (run=$($env:ENTERTEST_RUN_ID) url=$($env:ENTERTEST_TARGET_URL)) ===" |
    Out-File -Append -Encoding utf8 $log

python "scripts\entertest\test_run.py" *>> $log
$code = $LASTEXITCODE

"=== $ts 종료 (exit $code) ===" | Out-File -Append -Encoding utf8 $log
exit $code
```

- [ ] **Step 4: register-poll-task.ps1**

`scripts/entertest/register-poll-task.ps1` — moa-closing/register-poll-task.ps1과 동일 구조(태스크명/스크립트 경로만 변경). 5분 간격 작업 스케줄러 등록:

```powershell
# entertest 폴러 작업 스케줄러 등록 — 5분 간격.
$ErrorActionPreference = "Stop"
$script = Join-Path $PSScriptRoot "poll-local.ps1"
$taskName = "OPS-EntertestPoller"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "OPS entertest 테스트 실행 요청 폴러 (5분 간격)" -Force

Write-Host "등록 완료: $taskName (5분 간격)"
```

- [ ] **Step 5: test_run.py — 스캐폴드 + DOM 디스커버리 모드**

`scripts/entertest/test_run.py` (CHECKS는 10-A 디스커버리 후 10-B에서 채운다):

```python
#!/usr/bin/env python3
"""entertest 원서접수 케이스별 테스트 러너 (회사 PC, Selenium).

흐름: run-local.ps1이 ENTERTEST_RUN_ID/TARGET_URL/ACCOUNT 전달 →
  Chrome 기동(브라우저 게이트 통과) → ID/PW 로그인 → CHECKS 순차 실행 →
  실패 시 스크린샷 Storage 업로드 → /api/entertest/ingest POST.

DOM 디스커버리: ENTERTEST_DISCOVER=true 로 실행하면 로그인 후 단계별 page_source/
스크린샷을 scripts/entertest/discovery/ 에 저장하고 종료(셀렉터 확정용).
"""
import os
import sys
import time
import json

try:
    from dotenv import load_dotenv

    _repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    load_dotenv(os.path.join(_repo, ".env.local"))
except Exception:
    pass

import requests

try:
    import undetected_chromedriver as uc
except Exception:
    uc = None
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

RUN_ID = os.getenv("ENTERTEST_RUN_ID", "")
TARGET_URL = os.getenv("ENTERTEST_TARGET_URL", "")
ACCOUNT = os.getenv("ENTERTEST_ACCOUNT", "")  # ID=PW 동일
BASE = os.getenv("OPS_CONSOLE_BASE_URL", "").rstrip("/")
SECRET = os.getenv("CRON_SECRET", "")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DISCOVER = os.getenv("ENTERTEST_DISCOVER", "").lower() == "true"
BUCKET = "entertest-screenshots"


def make_driver():
    opts = (uc.ChromeOptions() if uc else Options())
    # 브라우저 게이트는 실제 Chrome UA면 통과. residential IP라 headless도 가능하나
    # CF 안정성 위해 비headless 권장(작업 스케줄러는 데스크톱 세션에서 실행).
    opts.add_argument("--start-maximized")
    if uc:
        return uc.Chrome(options=opts)
    return webdriver.Chrome(options=opts)


def login(driver, account: str) -> None:
    """ID/PW 로그인 (2FA·CAPTCHA 없음, ID=PW 동일). 셀렉터는 10-A에서 확정."""
    # placeholder: 10-A 디스커버리로 #txtId/#txtPw/#btnLogin 등 실제 셀렉터 확정 후 구현
    raise NotImplementedError("login 셀렉터는 DOM 디스커버리(10-A) 후 구현")


def upload_screenshot(driver, key: str) -> str | None:
    """실패 스크린샷을 Supabase Storage에 업로드하고 public URL 반환."""
    if not (SUPABASE_URL and SERVICE_KEY):
        return None
    png = driver.get_screenshot_as_png()
    path = f"{RUN_ID}/{key}.png"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "image/png",
            "x-upsert": "true",
        },
        data=png,
        timeout=30,
    )
    if r.status_code not in (200, 201):
        return None
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


# CHECKS: 각 항목 (key, label, fn). fn(driver, ctx) -> (status, message).
# 10-A 디스커버리로 실제 단계·셀렉터 확정 후 10-B에서 채운다.
CHECKS = []  # noqa: 10-B에서 page_load/login/fill_steps/required_validation/test_payment_complete 추가


def run_checks(driver) -> list[dict]:
    results = []
    for key, label, fn in CHECKS:
        try:
            status, message = fn(driver, {})
        except Exception as e:  # noqa: BLE001
            status, message = "fail", str(e)[:300]
        shot = upload_screenshot(driver, key) if status == "fail" else None
        item = {"key": key, "label": label, "status": status, "message": message}
        if shot:
            item["screenshot_url"] = shot
        results.append(item)
        if status == "fail":
            # 치명 단계 실패 시 이후는 skip
            break
    # break로 누락된 뒤 케이스는 skip 처리
    done_keys = {r["key"] for r in results}
    for key, label, _ in CHECKS:
        if key not in done_keys:
            results.append({"key": key, "label": label, "status": "skip", "message": None})
    return results


def discover(driver) -> None:
    """단계별 page_source/스크린샷 저장 (셀렉터 확정용)."""
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "discovery")
    os.makedirs(out, exist_ok=True)
    driver.get(TARGET_URL)
    time.sleep(3)
    with open(os.path.join(out, "01_notice.html"), "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    driver.save_screenshot(os.path.join(out, "01_notice.png"))
    print(f"[discover] saved to {out}")


def ingest(status: str, checks: list[dict], error: str | None = None) -> None:
    body = {"id": RUN_ID, "status": status, "checks": checks}
    if error:
        body["error_message"] = error[:500]
    r = requests.post(
        f"{BASE}/api/entertest/ingest",
        headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=30,
    )
    print(f"[ingest] {r.status_code} {r.text[:200]}")


def main() -> int:
    if not (RUN_ID and TARGET_URL and ACCOUNT and BASE and SECRET):
        print("[error] 필수 환경변수 누락 (RUN_ID/TARGET_URL/ACCOUNT/BASE/SECRET)")
        return 1
    driver = make_driver()
    try:
        if DISCOVER:
            login(driver, ACCOUNT)
            discover(driver)
            return 0
        checks = run_checks(driver)
        failed = any(c["status"] == "fail" for c in checks)
        ingest("failed" if failed else "done", checks)
        return 0
    except Exception as e:  # noqa: BLE001 — 비정상 종료는 poll-local이 error 보고
        print(f"[fatal] {e}")
        return 1
    finally:
        driver.quit()


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Commit (스캐폴드)**

```bash
git add scripts/entertest/
git commit -m "feat(entertest): 회사 PC 러너 스캐폴드 (폴러+런처+Selenium 러너)"
```

- [ ] **Step 7 (10-A): DOM 디스커버리 — 회사 PC에서 실제 흐름·셀렉터 확정**

회사 PC에서:
1. `.env.local`에 `OPS_CONSOLE_BASE_URL`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` 확인
2. `pip install -r scripts/entertest/requirements.txt`
3. 디스커버리 실행:

```powershell
$env:ENTERTEST_RUN_ID="discover"; $env:ENTERTEST_TARGET_URL="https://entertest.jinhakapply.com/Notice/1098146/A"; $env:ENTERTEST_ACCOUNT="<본인계정>"; $env:ENTERTEST_DISCOVER="true"; python scripts/entertest/test_run.py
```

4. `scripts/entertest/discovery/01_notice.html`·`.png` 및 로그인 화면을 보고 **실제 셀렉터 확정**:
   - 로그인: ID input / PW input / 로그인 버튼 셀렉터
   - 작성 단계: 전형·학과 선택, 필수 입력 필드, '다음' 버튼
   - 필수검증: 빈 제출 시 검증 메시지 요소
   - 테스트 결제: '테스트 결제' 버튼 + 접수완료 화면 요소
5. `login()` 함수에 실제 셀렉터로 로그인 구현 → 디스커버리 재실행해 로그인 후 각 단계 page_source도 저장하여 셀렉터 확정

> 이 단계 산출물 = 확정된 셀렉터 목록(주석 또는 `scripts/entertest/SELECTORS.md`). discovery/ 산출물은 커밋하지 않는다(`.gitignore`에 `scripts/entertest/discovery/` 추가).

- [ ] **Step 8 (10-B): CHECKS 5개 구현 (실측 셀렉터 기반)**

확정된 셀렉터로 `test_run.py`의 `login()`과 `CHECKS`를 채운다. 각 체크는 `(status, message)` 반환:

```python
def check_page_load(driver, ctx):
    driver.get(TARGET_URL)
    WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
    # 브라우저 게이트 alert 미발생 + Notice 핵심 요소 존재 확인 (셀렉터는 10-A 확정)
    return ("pass", None)

# check_login / check_fill_steps / check_required_validation / check_test_payment_complete
# 도 동일 패턴으로 10-A 셀렉터 기반 구현.

CHECKS = [
    ("page_load", "페이지 로드", check_page_load),
    ("login", "로그인/접수 진입", check_login),
    ("fill_steps", "작성 단계 진행", check_fill_steps),
    ("required_validation", "필수항목 검증 동작", check_required_validation),
    ("test_payment_complete", "테스트 결제 접수완료", check_test_payment_complete),
]
```

- [ ] **Step 9: 회사 PC E2E 검증 (실측)**

1. dev-test 페이지에서 본인 계정 등록 → "테스트 실행" 클릭 (pending 적재)
2. 회사 PC에서 `powershell scripts/entertest/poll-local.ps1` 수동 실행
3. dev-test 이력에 케이스별 PASS/FAIL + (실패 시) 스크린샷 표시되는지 확인
4. 정상 시 `register-poll-task.ps1`로 5분 폴러 등록

Expected: 실행 1건이 done/failed로 마감되고 dev-test에 케이스별 결과가 표시됨

- [ ] **Step 10: Commit**

```bash
git add scripts/entertest/test_run.py scripts/entertest/SELECTORS.md .gitignore
git commit -m "feat(entertest): CHECKS 5개 구현 (실측 셀렉터 기반)"
```

---

## Task 11: Storage 버킷 + 최종 검증

**Files:** (코드 없음 — 인프라 + 전체 검증)

- [ ] **Step 1: Supabase Storage 버킷 생성**

사용자가 Supabase 대시보드 또는 SQL로 `entertest-screenshots` private 버킷 생성:

```sql
insert into storage.buckets (id, name, public)
values ('entertest-screenshots', 'entertest-screenshots', true)
on conflict (id) do nothing;
```

> public=true (스크린샷 URL을 dev-test에서 직접 표시). service_role 업로드만 가능(anon insert 정책 없음).

- [ ] **Step 2: 전체 단위 테스트**

Run: `npm test -- src/features/entertest src/app/api/entertest`
Expected: 모든 테스트 PASS (schemas 5 + result 2 + test-request 5 + ingest 3 = 15)

- [ ] **Step 3: typecheck + lint + build**

Run: `npm run typecheck && npm run lint`
Expected: exit 0, 0 errors

Run: `npm run build`
Expected: 빌드 성공 (dev-test 라우트 포함)

- [ ] **Step 4: 요구사항 체크리스트 검증**

스펙 §1 성공 기준 대조:
- [ ] 운영자가 버튼 1회로 테스트 실행 요청 (Task 8/9)
- [ ] 회사 PC 러너가 로그인→작성→테스트 결제 접수완료까지 완주 + 결과 적재 (Task 10)
- [ ] dev-test에서 이력 + 케이스별 상세(PASS/FAIL + 스크린샷) (Task 9)

---

## Self-Review Notes

- **Spec coverage**: §5 데이터모델(Task 1), §6 표준체크(Task 10-A/B), §7 API(Task 5/6/7), §8 러너(Task 10), §9 페이지(Task 9), §10 TDD(Task 2/3/5/6), §11 안전장치(실결제 없음 — 코드 불필요), §12 범위(단일 동시실행 — actions.ts pending 가드). 모두 매핑됨.
- **타입 일관성**: `EntertestCheck`/`EntertestRun`/`EntertestSummary`는 schemas.ts 단일 정의, result.ts·ingest route·queries·UI가 import. `summarizeChecks` 시그니처 일관.
- **Subsystem B(고객 TR/TD 수정요청)는 본 계획 범위 외** — 별도 spec/plan.
