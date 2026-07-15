# 개발 탭 원서제어 수동 분석 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 개발 탭 인스펙터에서 특정 서비스의 원서제어 분석을 '지금 분석' 버튼으로 요청하면, 회사 PC 폴러가 claim해 `dev-control-analyze.mjs <serviceId>`를 실행한다.

**Architecture:** 서비스 마감 스크랩(closing, PR #549)과 동일한 풀(pull) 원격 트리거. 웹 server action이 `dev_control_analyze_requests(pending)`를 적재하고, 5분 간격 PC 폴러가 CRON_SECRET 인증 API로 원자적 claim → node 실행 → 완료 보고한다. UI는 요청 상태를 스냅샷 배지로 표시(실시간 폴링 없음).

**Tech Stack:** Next.js App Router(route handler + server action) + Supabase(admin client, RLS) + zod + Vitest / PowerShell 폴러 + Windows 작업 스케줄러

**Spec:** `docs/superpowers/specs/2026-07-15-dev-control-manual-run-design.md`

## Global Constraints

- 색상 하드코딩 금지 — Tailwind 토큰 클래스만. 목록/버튼 상호작용 표준 준수.
- Server Action: zod 검증 + `parsed.error.issues[0].message`, admin client(service_role) write, `revalidatePath`.
- 신규 CRON_SECRET 엔드포인트는 **반드시 `src/proxy.ts` PUBLIC_PATHS에 등록** (누락 시 폴러가 /login HTML 받아 조용히 실패 — 선례 함정).
- DB 마이그레이션은 **머지 전 Supabase 대시보드 수동 적용 + service_role 스모크 검증** (DB 직접 포트 차단).
- 커밋: conventional + 한국어. 파일당 800줄 상한. 크리덴셜 값 출력 금지.

---

### Task 1: DB 마이그레이션 — dev_control_analyze_requests

**Files:**
- Create: `supabase/migrations/20260715_dev_control_analyze_requests.sql`

**Interfaces:**
- Produces: 테이블 `dev_control_analyze_requests(id uuid, service_id bigint, requested_by text, status pending|running|done|failed, requested_at, claimed_at, finished_at, message)` + `(service_id, status)` 인덱스

- [x] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 개발 탭 원서제어 '수동 분석' 요청 큐 (웹 → PC 폴러 풀 트리거, closing_scrape_requests와 동형)
create table if not exists public.dev_control_analyze_requests (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  requested_by text,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'failed')),
  requested_at timestamptz not null default now(),
  claimed_at timestamptz,
  finished_at timestamptz,
  message text
);

alter table public.dev_control_analyze_requests enable row level security;

create policy "dev_control_analyze_requests_select"
  on public.dev_control_analyze_requests
  for select to authenticated using (true);

grant select on public.dev_control_analyze_requests to authenticated;
grant all on public.dev_control_analyze_requests to service_role;

create index if not exists dev_control_analyze_requests_service_status_idx
  on public.dev_control_analyze_requests (service_id, status);
```

- [x] **Step 2: Supabase 대시보드 SQL Editor에서 적용** (컨트롤러/사용자 수행 — DB 직접 포트 차단)

- [x] **Step 3: service_role 스모크 검증** (컨트롤러 수행)

```bash
node - <<'EOF'
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from("dev_control_analyze_requests").insert({ service_id: 1, requested_by: "smoke" }).select("id, status").single();
console.log("insert:", error?.message ?? `ok ${data.status}`);
if (data) await sb.from("dev_control_analyze_requests").delete().eq("id", data.id);
EOF
```
Expected: `insert: ok pending`

- [x] **Step 4: Commit** — `git add supabase/migrations/20260715_dev_control_analyze_requests.sql && git commit -m "feat(dev-control): 수동 분석 요청 큐 테이블 + RLS"`

---

### Task 2: Server action — requestDevControlAnalyze

**Files:**
- Modify: `src/features/dev-controls/actions.ts` (append 새 action + 스키마 import)
- Modify: `src/features/dev-controls/schemas.ts` (요청 스키마 + 타입 추가)
- Test: `src/features/dev-controls/__tests__/actions.test.ts` (기존 파일에 describe 추가 — 없으면 생성)

**Interfaces:**
- Consumes: Task 1 테이블, `createAdminClient`(`@/lib/supabase/admin`), `getCurrentOperator`(`@/features/auth/queries`)
- Produces:
  - `requestDevControlAnalyzeSchema = z.object({ serviceId: z.number().int().positive() })`
  - `type DevControlRequestStatus = "pending" | "running" | "done" | "failed"`
  - `type DevControlAnalyzeRequest = { id: string; service_id: number; requested_by: string | null; status: DevControlRequestStatus; requested_at: string; claimed_at: string | null; finished_at: string | null; message: string | null }`
  - `requestDevControlAnalyze(input: unknown): Promise<{ ok: boolean; error?: string }>` — 로그인 확인 + 중복(pending/running) 가드 + insert(requested_by = me.displayName ?? me.email) + `revalidatePath("/dashboard/dev-test")`

- [x] **Step 1: schemas.ts에 스키마·타입 추가**

```ts
// src/features/dev-controls/schemas.ts 에 append
export const requestDevControlAnalyzeSchema = z.object({
  serviceId: z.number().int().positive(),
});

export type DevControlRequestStatus =
  | "pending"
  | "running"
  | "done"
  | "failed";

export type DevControlAnalyzeRequest = {
  id: string;
  service_id: number;
  requested_by: string | null;
  status: DevControlRequestStatus;
  requested_at: string;
  claimed_at: string | null;
  finished_at: string | null;
  message: string | null;
};
```

- [x] **Step 2: 실패 테스트 작성** — `src/features/dev-controls/__tests__/actions.test.ts`에 describe 추가 (기존 파일의 supabase admin mock 관례 재사용; 없으면 아래 mock 구조로 신규 생성)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAdmin, mockGetOperator, state } = vi.hoisted(() => ({
  mockAdmin: vi.fn(),
  mockGetOperator: vi.fn(),
  state: { existing: [] as unknown[], insertErr: null as unknown },
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockAdmin }));
vi.mock("@/features/auth/queries", () => ({ getCurrentOperator: mockGetOperator }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requestDevControlAnalyze } from "../actions";

function adminBuilder() {
  const b: Record<string, unknown> = {
    then: (r: (v: unknown) => void) => r({ data: state.existing, error: null }),
  };
  for (const m of ["select", "eq", "in", "order", "limit"]) b[m] = vi.fn(() => b);
  b.insert = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: { id: "r1" }, error: state.insertErr }) }),
  }));
  return b;
}

describe("requestDevControlAnalyze", () => {
  beforeEach(() => {
    state.existing = [];
    state.insertErr = null;
    mockGetOperator.mockResolvedValue({ displayName: "송영신", email: "me@op.com" });
    mockAdmin.mockReturnValue({ from: () => adminBuilder() });
  });

  it("미로그인이면 거부", async () => {
    mockGetOperator.mockResolvedValueOnce(null);
    expect(await requestDevControlAnalyze({ serviceId: 5 })).toEqual({
      ok: false,
      error: "로그인이 필요합니다",
    });
  });

  it("serviceId 형식 오류면 거부", async () => {
    const r = await requestDevControlAnalyze({ serviceId: -1 });
    expect(r.ok).toBe(false);
  });

  it("동일 서비스 pending/running 있으면 거부", async () => {
    state.existing = [{ id: "x", status: "pending" }];
    expect(await requestDevControlAnalyze({ serviceId: 5 })).toEqual({
      ok: false,
      error: "이미 분석 대기/진행 중입니다",
    });
  });

  it("정상 요청이면 insert 후 ok", async () => {
    expect(await requestDevControlAnalyze({ serviceId: 5 })).toEqual({ ok: true });
  });
});
```

- [x] **Step 3: 실행 → FAIL 확인** — `npx vitest run src/features/dev-controls/__tests__/actions.test.ts`

- [x] **Step 4: action 구현** — `src/features/dev-controls/actions.ts`에 append

```ts
import { requestDevControlAnalyzeSchema } from "./schemas";

export async function requestDevControlAnalyze(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = requestDevControlAnalyzeSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data: existing, error: qErr } = await admin
    .from("dev_control_analyze_requests")
    .select("id")
    .eq("service_id", parsed.data.serviceId)
    .in("status", ["pending", "running"])
    .limit(1);
  if (qErr) return { ok: false, error: qErr.message };
  if (existing && existing.length > 0)
    return { ok: false, error: "이미 분석 대기/진행 중입니다" };

  const { error } = await admin
    .from("dev_control_analyze_requests")
    .insert({
      service_id: parsed.data.serviceId,
      requested_by: me.displayName ?? me.email ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/dev-test");
  return { ok: true };
}
```

주의: `getCurrentOperator` 반환 객체의 실제 필드명(`displayName`/`email`)을 `src/features/auth/queries.ts`에서 확인 후 맞출 것. `updateDevControlFlag`가 이미 `me.` 없이 존재 여부만 쓰므로 필드 접근은 이 action이 처음 — 반드시 확인.

- [x] **Step 5: 실행 → PASS + tsc** — `npx vitest run src/features/dev-controls` / `npx tsc --noEmit`

- [x] **Step 6: Commit** — `feat(dev-control): 수동 분석 요청 server action (중복 가드)`

---

### Task 3: API route — analyze-request (claim/report) + proxy 등록

**Files:**
- Create: `src/app/api/dev-controls/analyze-request/route.ts`
- Create: `src/app/api/dev-controls/analyze-request/__tests__/route.test.ts`
- Modify: `src/proxy.ts` (PUBLIC_PATHS에 1줄)

**Interfaces:**
- Consumes: Task 1 테이블, `createAdminClient`, `process.env.CRON_SECRET`
- Produces: `GET`(claim → `{ ok, request: { id, service_id, requested_at, requested_by } | null }`) / `POST { id, ok, message }`(→ done/failed)

- [x] **Step 1: 실패 테스트 작성** — `closing/scrape-request/__tests__/route.test.ts`의 mock 구조를 복사하되 GET이 `service_id`를 반환하는지, 미인증 401, POST done/failed 전이를 검증

```ts
// 핵심 케이스 (closing route.test.ts builder/get/post 헬퍼 복사):
// - GET without secret → 401
// - GET with secret, pending 존재 → claim 응답 request.service_id 포함
// - GET with secret, pending 없음 → { request: null }
// - POST { id, ok:true } → done, { id, ok:false } → failed
// - POST without id → 400
```

- [x] **Step 2: 실행 → FAIL 확인** — `npx vitest run src/app/api/dev-controls`

- [x] **Step 3: route 구현** (closing route를 미러링, 테이블명·claim select에 service_id 추가)

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 개발 탭 원서제어 '수동 분석' 폴러 endpoint — Authorization: Bearer ${CRON_SECRET}.
 * 회사 PC 폴러(scripts/dev-control/poll-local.ps1)가 호출.
 *   GET  → 가장 오래된 pending 1건 원자적 claim(→running). 없으면 { request: null }.
 *   POST → 완료 보고 { id, ok, message } → done/failed.
 */
function authorized(request: NextRequest, secret: string): boolean {
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ ok: false, error: "CRON_SECRET 미설정" }, { status: 500 });
  if (!authorized(request, secret))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("dev_control_analyze_requests")
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (!pending || pending.length === 0)
    return NextResponse.json({ ok: true, request: null });

  const { data: claimed, error } = await admin
    .from("dev_control_analyze_requests")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select("id, service_id, requested_at, requested_by")
    .maybeSingle();
  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, request: claimed ?? null });
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ ok: false, error: "CRON_SECRET 미설정" }, { status: 500 });
  if (!authorized(request, secret))
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    ok?: unknown;
    message?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  const status = body.ok === true ? "done" : "failed";
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("dev_control_analyze_requests")
    .update({ status, finished_at: new Date().toISOString(), message })
    .eq("id", id);
  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [x] **Step 4: proxy.ts PUBLIC_PATHS에 등록**

```ts
// src/proxy.ts PUBLIC_PATHS 배열에 추가 (closing 항목들 근처)
  "/api/dev-controls/analyze-request",
```

- [x] **Step 5: 실행 → PASS + tsc** — `npx vitest run src/app/api/dev-controls` / `npx tsc --noEmit`

- [x] **Step 6: Commit** — `feat(dev-control): 수동 분석 폴러 API + proxy PUBLIC_PATHS 등록`

---

### Task 4: PC 폴러 스크립트

**Files:**
- Create: `scripts/dev-control/poll-local.ps1`
- Create: `scripts/dev-control/register-poll-task.ps1`

**Interfaces:**
- Consumes: Task 3 API `/api/dev-controls/analyze-request`, `.env.local`의 `CRON_SECRET`/`OPS_CONSOLE_BASE_URL`, `scripts/dev-control-analyze.mjs`
- Produces: 작업 스케줄러 `OPS-Console-DevControl-Poll` (5분 간격)

- [x] **Step 1: poll-local.ps1 작성** (moa-closing/poll-local.ps1 복사 → 엔드포인트·실행 커맨드 치환. run-local 분리 없이 node 직접 호출)

```powershell
# 개발 탭 원서제어 '수동 분석' — 로컬 폴러 (회사 PC, 작업 스케줄러가 5분마다 호출)
#
# 웹 '지금 분석' 요청(dev_control_analyze_requests pending)을 claim해 특정 service_id만
# dev-control-analyze.mjs로 재수집·분석하고 완료를 보고한다. pending 없으면 즉시 종료.
# 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL.
# 등록: register-poll-task.ps1 (5분 간격).

$ErrorActionPreference = "Stop"
# scripts/dev-control → scripts → repo root
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
$uri = "$base/api/dev-controls/analyze-request"

# 1) pending claim
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $claim.request) { exit 0 }
$id = $claim.request.id
$serviceId = $claim.request.service_id
Write-Host "[poll] claim: $id (service $serviceId, by $($claim.request.requested_by))"

# 2) 해당 service_id만 분석
$ok = $false
$msg = ""
try {
    $node = "C:\Program Files\nodejs\node.exe"
    & $node (Join-Path $repo "scripts\dev-control-analyze.mjs") "$serviceId"
    $code = $LASTEXITCODE
    $ok = ($code -eq 0)
    $msg = "exit $code"
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
}

# 3) 완료 보고
$body = @{ id = $id; ok = $ok; message = $msg } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
Write-Host "[poll] 완료 보고: ok=$ok ($msg)"
exit 0
```

- [x] **Step 2: register-poll-task.ps1 작성** (moa-closing/register-poll-task.ps1 복사 → runner 경로·태스크명 치환)

```powershell
# 개발 탭 수동 분석 로컬 폴러 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-control/register-poll-task.ps1
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-DevControl-Poll" -Confirm:$false

param([switch]$Unattended, [switch]$StorePassword)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\dev-control\poll-local.ps1"
if (-not (Test-Path $runner)) { throw "poller 없음: $runner" }

$taskName = "OPS-Console-DevControl-Poll"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew
if ($Unattended) {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -User "SYSTEM" -RunLevel Highest -Force
} else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Force
}
Write-Host "등록 완료: $taskName (5분 간격)"
```

주의: moa-closing/register-poll-task.ps1의 실제 `-Settings`/`-User` 구성이 위와 다르면 그쪽을 정본으로 복사할 것 (S4U/StorePassword 분기 포함). 위는 축약본 — 원본 우선.

- [x] **Step 3: Commit** — `feat(dev-control): 수동 분석 PC 폴러 + 스케줄러 등록 스크립트`

(스크립트는 단위 테스트 없음 — Task 6 라이브 검증에서 확인)

---

### Task 5: UI — '지금 분석' 버튼 + 상태 배지

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/dev-control/View.tsx` (버튼 추가)
- Modify: `src/app/dashboard/dev-test/dev-control-rows.ts` (요청 상태 첨부)
- Modify: `src/app/dashboard/dev-test/DevControlSection.tsx` (요청 조회 + rows에 전달)
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` (ListRow에 `devControlRequest?` 필드)
- Create: `src/features/dev-controls/requests-query.ts` (최신 요청 조회)
- Test: `src/app/dashboard/_components/inspector/list-variants/dev-control/__tests__/View.test.tsx` (버튼 케이스 추가)

**Interfaces:**
- Consumes: `requestDevControlAnalyze`(Task 2), `DevControlAnalyzeRequest`(Task 2), Task 1 테이블
- Produces:
  - `listLatestDevControlRequests(): Promise<Map<number, DevControlAnalyzeRequest>>` (service_id → 최신 요청) in `requests-query.ts`
  - ListRow 확장 `devControlRequest?: DevControlAnalyzeRequest`
  - View: `serviceId`(row.serviceIdNum)로 '지금 분석' 버튼, pending/running이면 disabled + 배지

- [x] **Step 1: requests-query.ts 작성 (server) + 테스트는 View에서 커버**

```ts
// src/features/dev-controls/requests-query.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DevControlAnalyzeRequest } from "./schemas";

/** service_id별 최신 요청 1건 (배지 표시용). requested_at desc로 첫 건. */
export async function listLatestDevControlRequests(): Promise<
  Map<number, DevControlAnalyzeRequest>
> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dev_control_analyze_requests")
    .select("id, service_id, requested_by, status, requested_at, claimed_at, finished_at, message")
    .order("requested_at", { ascending: false });
  if (error) throw new Error(`요청 조회 실패: ${error.message}`);
  const map = new Map<number, DevControlAnalyzeRequest>();
  for (const r of (data ?? []) as DevControlAnalyzeRequest[])
    if (!map.has(r.service_id)) map.set(r.service_id, r);
  return map;
}
```

- [x] **Step 2: 실패 테스트 작성 (View 버튼)** — 기존 dev-control View.test.tsx에 케이스 추가

```ts
// 추가 케이스 (기존 파일의 렌더 헬퍼·mock 재사용):
// mock: vi.mock("@/features/dev-controls/actions", () => ({
//   updateDevControlFlag: vi.fn(async () => ({ ok: true })),
//   requestDevControlAnalyze: vi.fn(async () => ({ ok: true })),
// }))
// 1) '지금 분석' 버튼 렌더 + 클릭 시 requestDevControlAnalyze({ serviceId }) 호출
// 2) row.devControlRequest.status === "pending" → 버튼 disabled + "분석 대기" 배지
// 3) status === "running" → "분석 중" 배지 / disabled
// 4) status === "failed" → 버튼 활성 + message 노출
```

- [x] **Step 3: 실행 → FAIL**

- [x] **Step 4: 구현**
  - `ListPattern.tsx` ListRow: `devControlRequest?: DevControlAnalyzeRequest;` (import type 추가)
  - `dev-control-rows.ts` `buildDevControlRows(services, analyses, requests)` — 3번째 인자 `Map<number, DevControlAnalyzeRequest>` 추가, 각 row에 `devControlRequest: requests.get(s.service_id)` 첨부. 기존 호출부(DevControlSection) 함께 수정
  - `DevControlSection.tsx`: `listLatestDevControlRequests()`를 `Promise.all`에 추가, `buildDevControlRows(services, analyses, requests)` 호출
  - `View.tsx`: 상단에 '지금 분석' 버튼(`ViewProps.row.serviceIdNum` 사용, `useTransition`으로 `requestDevControlAnalyze({ serviceId })`). `row.devControlRequest`가 pending/running이면 `disabled` + 배지(`pending` → "분석 대기" `bg-vermilion/10 text-vermilion`, `running` → "분석 중" `bg-ink text-cream`). failed면 message를 `text-vermilion`로. 버튼 표준: 목록/버튼 표준에 맞춰 `border border-line hover:border-ink hover:bg-ink hover:text-cream`

주의: `ViewProps`에 `row`가 있고 `row.serviceIdNum`(number)이 rows에서 세팅됨(dev-control-rows.ts 확인). View는 client component이므로 `devControlRequest`도 row로 전달돼 접근 가능.

- [x] **Step 5: 실행 → PASS + tsc + inspector 회귀** — `npx vitest run "src/app/dashboard/_components/inspector/list-variants/dev-control" src/app/dashboard/dev-test` / `npx tsc --noEmit`

- [x] **Step 6: Commit** — `feat(dev-control): 개발탭 '지금 분석' 버튼 + 요청 상태 배지`

---

### Task 6: 최종 검증 + 라이브 + PR

- [x] **Step 1: 마이그레이션 적용 확인** (Task 1 Step 2-3 완료 상태 재확인)
- [ ] **Step 2: 폴러 등록** — `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dev-control/register-poll-task.ps1` → 작업 `OPS-Console-DevControl-Poll` 확인
- [ ] **Step 3: 라이브 e2e** — 프로덕션(또는 로컬) 개발탭에서 서비스 '지금 분석' 클릭 → `dev_control_analyze_requests` pending 확인 → 폴러 수동 트리거(`schtasks /Run /TN OPS-Console-DevControl-Poll`) → 상태 running→done 전이 + `dev_control_analyses` 갱신 확인
- [x] **Step 4: 정적 검증** — `npm run lint`(0 에러) / `npx tsc --noEmit`(0) / `npx vitest run src/features/dev-controls src/app/dashboard/dev-test src/app/dashboard/_components/inspector/list-variants/dev-control src/app/dashboard/api/dev-controls`(전부 통과)
- [x] **Step 5: PR** — `feat(dev-control): 개발 탭 수동 분석(웹→PC 폴러)` (Summary + Test plan, squash) + 설계·계획 문서 스테이징

## Self-Review 결과

- 스펙 커버리지: DB(1)·action 중복가드(2)·API claim/report+proxy(3)·폴러(4)·UI 버튼·배지(5)·라이브(6) — 전 섹션 커버.
- 플레이스홀더: Task 3 Step 1, Task 5 Step 2는 케이스 목록이나 mock 구조·복사 원본 명시로 실행 가능. Task 4 register 스크립트는 "원본 우선" 명시(축약본이 원본과 다를 수 있음).
- 타입 일관성: `DevControlAnalyzeRequest`/`requestDevControlAnalyze`/`listLatestDevControlRequests` Task 2·5에서 동일 시그니처. `devControlRequest` 필드명 Task 5 내 일관. `buildDevControlRows` 3-인자 확장은 호출부(DevControlSection) 동시 수정 명시.
- 위험: `getCurrentOperator` 필드명(displayName/email)은 Task 2에서 실제 확인 지시. register-poll-task 원본 구성 차이는 Task 4에서 원본 우선 지시.
