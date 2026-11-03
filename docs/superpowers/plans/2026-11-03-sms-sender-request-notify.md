# SMS 발신번호 신청 알림 메일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teams 목록 'SMS 발신번호 사전등록 신청'을 5분마다 읽어, 새 행이면 담당 매니저에게, '완료'로 바뀐 행이면 신청자에게 메일을 보내는 자동화 잡.

**Architecture:** 목록 전량을 Graph 로 읽어(`list-source`) DB 스냅샷(`sms_sender_request_notices`)과 순수 함수로 대조(`reconcile`)하고, 보낼 알림마다 조건부 UPDATE 로 먼저 잡은(`store.claimNotice`) 뒤 `sendGraphMail` 로 보낸다. 진입점은 자동화 registry 잡이고 cron-job.org 가 `/api/automations/run?jobId=sms-sender-request-notify` 를 5분마다 부른다.

**Tech Stack:** Next.js server-only TS, Supabase(service_role, `createAdminClient` from `@/lib/supabase/admin`), Microsoft Graph(`getGraphToken` from `@/lib/microsoft/auth`, `sendGraphMail` from `@/lib/microsoft/sendmail`), zod, vitest.

**Spec:** `docs/superpowers/specs/2026-11-03-sms-sender-request-notify-design.md` (r2)

## Global Constraints

- 작업 위치: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-sms-request-notify` (브랜치 `feat/sms-request-notify`). 원래 폴더 `...\Build\OPS-Console` 은 건드리지 않는다.
- 모듈 위치: `src/features/sms-sender/request-notify/` (+ 테스트는 그 아래 `__tests__/`).
- 메일 제목 브랜드는 `[내부관리자]`. **`[운영부 상황실]` 문구는 어디에도 넣지 않는다.**
- 제목: 새 신청 `[내부관리자] SMS 발신번호 사전등록 신청 — {대학명}` / 완료 `[내부관리자] SMS 발신번호 사전등록 완료 — {대학명}` (대학명은 공백 정리 후, `—` 는 em dash U+2014).
- 본문 끝 고지(정확히): `이 메일은 SMS 발신번호 사전등록 신청 목록을 보고 자동으로 보냈습니다.`
- 보내는 메일함은 두 메일 모두 담당 매니저. 새 신청 받는 사람 = 매니저, 완료 받는 사람 = 행의 `createdBy.user.email`.
- env 이름: `SHAREPOINT_SMS_REQUEST_SITE_ID`, `SHAREPOINT_SMS_REQUEST_LIST_ID`, `SMS_SENDER_REQUEST_MANAGER_EMAIL`. 값은 코드·테스트·커밋에 쓰지 않는다(테스트는 가짜 값).
- **사람 이름·메일 주소는 실행 message·details·로그에 넣지 않는다.** 대학명·항목 id 는 된다.
- 목록 필드 키(상수): 제목 `Title`, 상태 `_xc0c1__xd0dc_`(값 `요청`/`완료`), 대학명 `_xb300__xd559__xba85_`, 구분 `_xc0ac__xc774__xd2b8__xad6c__xbd`, ServiceID `UnivID`(문자열). 구분 키 끝이 잘린 것은 오타가 아니다.
- 상태로 서버 쪽 `$filter` 를 걸지 않는다(`Prefer: HonorNonIndexedQueries…` 금지).
- 알림 상태 값: `pending` `sending` `sent` `dry_run` `seeded` `failed`. 시도 한도 `MAX_ATTEMPTS = 3`, 잡힌 채 남은 칸 회수 `STALE_SENDING_MINUTES = 30`.
- `MAIL_DRY_RUN` 판정: `(process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true"` — 잡에서 본다.
- 폴백 경로 금지(`/users/{id}` 보조 조회 없음). `any`·`@ts-ignore`·`eslint-disable`·`console.log` 금지(`console.error` 는 기존 관례대로 허용).
- vitest 는 **반드시 `--maxWorkers=1`, 관련 파일만**(이 PC 메모리 부족). dev 서버·전체 스위트 금지. 실제 Graph·메일·DB 호출 금지(전부 목).
- 커밋 메시지는 한국어 conventional, 끝에:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```
  push 금지. `scripts/moa-applyprice/` 스테이징 금지.

## Review Focus

1. 처음 보이는 행이 이미 `완료` — 새 신청 메일과 완료 메일 둘 다, 새 신청이 먼저(Task 1·5 테스트).
2. 완료 알림인데 신청자 메일이 비어 있음 — Graph 호출 없이 바로 `failed`, 실행 `ok:false`(Task 5).
3. 다른 실행이 먼저 잡음(claim 0행) — 보내지 않고 실패로도 세지 않음(Task 4·5).
4. nextLink 가 Graph 호스트가 아님 — 따라가지 않고 오류(Task 3).
5. 대학명에 `<script>`·줄바꿈 — 본문은 이스케이프, 제목은 공백 한 칸으로 접힘(Task 2).

---

### Task 1: 타입·상수 + 대조 순수 함수

**Files:**
- Create: `src/features/sms-sender/request-notify/types.ts`
- Create: `src/features/sms-sender/request-notify/reconcile.ts`
- Test: `src/features/sms-sender/request-notify/__tests__/reconcile.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export const FIELD = { title: "Title", status: "_xc0c1__xd0dc_", university: "_xb300__xd559__xba85_", kind: "_xc0ac__xc774__xd2b8__xad6c__xbd", serviceId: "UnivID" } as const;
  export const STATUS_DONE = "완료";
  export const MAX_ATTEMPTS = 3;
  export const STALE_SENDING_MINUTES = 30;
  export type NoticeKind = "new" | "done";
  export type NoticeState = "pending" | "sending" | "sent" | "dry_run" | "seeded" | "failed";
  export type RequestItem = { id: string; status: string; university: string; kind: string; serviceId: string; title: string; applicantEmail: string | null; applicantName: string | null; webUrl: string | null };
  export type NoticeRow = { item_id: string; last_status: string; new_state: NoticeState; new_attempts: number; new_claimed_at: string | null; done_state: NoticeState; done_attempts: number; done_claimed_at: string | null };
  export type DueNotice = { kind: NoticeKind; item: RequestItem; attempts: number };
  export type Recovery = { item_id: string; kind: NoticeKind; state: "pending" | "failed" };
  ```
- Produces (`reconcile.ts`):
  - `seedRows(items: RequestItem[]): NoticeRow[]` — 모든 행 `new_state:"seeded"`; `done_state` 는 `status === "완료"` 면 `"seeded"`, 아니면 `"pending"`; attempts 0, claimed_at null, `last_status` = 현재 상태.
  - `reconcile(items: RequestItem[], rows: NoticeRow[], now: Date): { inserts: NoticeRow[]; statusUpdates: { item_id: string; last_status: string }[]; recoveries: Recovery[]; due: DueNotice[] }`
    - 스냅샷에 없는 항목 → `inserts` 에 `new_state/done_state` 둘 다 `pending` 행, 그리고 `due` 에 `new`(그 행이 `완료` 면 `done` 도, new 다음 순서).
    - 있는 항목: `last_status` 가 다르면 `statusUpdates`.
    - `recoveries`: `*_state === "sending"` 이고 `*_claimed_at` 이 `now - 30분` 보다 이전 → attempts ≥ 3 이면 `failed`, 아니면 `pending`. 회수된 칸은 같은 실행의 `due` 판정에서 `pending` 으로 본다.
    - `due`(기존 행): `new_state === "pending"` 이고 attempts < 3 → `new`; 항목 상태 `완료` 이고 `done_state === "pending"` 이고 attempts < 3 → `done`. `due.attempts` = 그 칸의 현재 attempts(claim 의 낙관적 잠금 값).
    - 스냅샷에만 있고 목록에서 사라진 행은 무시(지우지 않는다).

- [ ] **Step 1: 실패 테스트 작성** — `reconcile.test.ts`, 각 `it` 이름과 단언:
  - `seedRows: 완료 행은 두 알림 모두 seeded` → `done_state === "seeded"`, `new_state === "seeded"`
  - `seedRows: 요청 행은 완료 알림을 pending 으로 남긴다` → `done_state === "pending"`
  - `새 행(요청)은 insert + new 하나만 due` → `due.map(d=>d.kind)` `["new"]`
  - `처음 보이는 행이 이미 완료면 new 다음 done` → `["new","done"]`
  - `요청→완료 전환이면 done due + statusUpdate` 
  - `done_state sent 인 행은 완료→요청→완료로 돌아와도 due 없음`
  - `attempts 3 인 pending 칸은 due 에서 빠진다`
  - `30분 넘은 sending 은 pending 으로 회수되고 같은 실행에서 due` (attempts 1 → recovery `pending`, due 포함)
  - `30분 넘은 sending 인데 attempts 3 이면 failed 로 회수, due 아님`
  - `30분 안 된 sending 은 건드리지 않는다`
  - `목록에서 사라진 행은 무시`
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/request-notify/__tests__/reconcile.test.ts --maxWorkers=1` → FAIL(모듈 없음)
- [ ] **Step 3: 구현** — 위 시그니처. 입력을 변경하지 않는다(새 객체).
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS
- [ ] **Step 5: 커밋** — `feat(sms-sender): 신청 알림 대조 규칙`

### Task 2: 메일 제목·본문

**Files:**
- Create: `src/features/sms-sender/request-notify/mail.ts`
- Test: `src/features/sms-sender/request-notify/__tests__/mail.test.ts`

**Interfaces:**
- Consumes: `RequestItem`, `NoticeKind` (Task 1)
- Produces: `buildRequestMail(kind: NoticeKind, item: RequestItem): { subject: string; html: string }`
  - 본문 행: new = 대학명·구분·ServiceID·신청자(`applicantName`, 없으면 `-`) + 목록 링크; done = 대학명·구분·ServiceID + 목록 링크 + 안내 한 줄 `신청하신 SMS 발신번호 사전등록 처리가 완료됐습니다.`. new 첫 줄은 `SMS 발신번호 사전등록 신청이 들어왔습니다.`
  - 링크는 `webUrl` 이 `https://` 로 시작할 때만 `<a href>`; 아니면 링크 줄을 뺀다.
  - 모든 목록 값은 HTML 이스케이프(기존 `escapeHtml` 하나를 재사용하거나 같은 규칙). 마지막 줄은 Global Constraints 의 고지 문구.

- [ ] **Step 1: 실패 테스트** — 
  - `새 신청 제목` → `"[내부관리자] SMS 발신번호 사전등록 신청 — 서울예술대학교"`
  - `완료 제목` → `"[내부관리자] SMS 발신번호 사전등록 완료 — 서울예술대학교"`
  - `제목의 대학명 줄바꿈·연속 공백은 한 칸으로` (`"서울\n예술  대학교"` → `"… — 서울 예술 대학교"`)
  - `본문은 값을 이스케이프한다` (`<script>` → `&lt;script&gt;`, 원문 `<script>` 없음)
  - `운영부 상황실 문구가 없다` (subject·html 둘 다 `not.toContain("운영부 상황실")`)
  - `고지 문구가 본문에 있다`
  - `https 가 아닌 webUrl 은 앵커를 만들지 않는다` (`javascript:` → `not.toContain("<a ")`)
  - `새 신청 본문에 신청자 표시 이름, 완료 본문에는 없다`
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/request-notify/__tests__/mail.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 신청 알림 메일 본문`

### Task 3: 목록 읽기 (Graph)

**Files:**
- Create: `src/features/sms-sender/request-notify/list-source.ts`
- Test: `src/features/sms-sender/request-notify/__tests__/list-source.test.ts`

**Interfaces:**
- Consumes: `FIELD`, `RequestItem` (Task 1), `getGraphToken()`
- Produces:
  - `export class RequestListError extends Error` — 화면·로그에 그대로 보여도 되는 짧은 한국어 메시지만(토큰·URL 금지). `sms-sender/source.ts` 의 `SourceFetchError` 와 같은 모양.
  - `fetchRequestItems(siteId: string, listId: string): Promise<{ items: RequestItem[]; malformed: number }>`
    - 첫 URL `https://graph.microsoft.com/v1.0/sites/{siteId}/lists/{listId}/items?$expand=fields&$top=200`, `cache: "no-store"`.
    - nextLink 는 `https://graph.microsoft.com/` 로 시작할 때만 따라간다. 아니면 `RequestListError`. 페이지 상한 50.
    - 응답 항목을 zod 로 검증. `fields` 에 필수 다섯 키(제목·상태·대학명·구분·ServiceID — 목록 설정상 필수, 스펙 §4)가 문자열로 없으면 그 항목은 `items` 에서 빼고 `malformed += 1`.
    - `applicantEmail` = `createdBy.user.email`(빈 문자열이면 null), `applicantName` = `createdBy.user.displayName ?? null`, `webUrl` = 항목 `webUrl ?? null`.
    - HTTP 비정상 응답 → `RequestListError("SMS 신청 목록을 읽지 못했습니다 (HTTP {status})")`.

- [ ] **Step 1: 실패 테스트** (`vi.mock("server-only")`, `vi.mock("@/lib/microsoft/auth")`, `fetch` 를 `vi.stubGlobal` 로):
  - `필드 키를 RequestItem 으로 옮긴다` (FIELD 키 → status/university/kind/serviceId, createdBy → applicant*)
  - `필수 키(예: 상태, 구분) 중 하나라도 없으면 malformed 로 센다`
  - `Graph 호스트의 nextLink 는 따라간다` (두 페이지 합쳐짐)
  - `Graph 밖 nextLink 는 RequestListError` 
  - `HTTP 403 이면 RequestListError, 메시지에 403`
  - `createdBy.user.email 이 빈 문자열이면 applicantEmail null`
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/request-notify/__tests__/list-source.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 신청 목록 Graph 읽기`

### Task 4: 마이그레이션 + 저장소

**Files:**
- Create: `supabase/migrations/20261103_sms_sender_request_notices.sql`
- Create: `src/features/sms-sender/request-notify/store.ts`
- Test: `src/features/sms-sender/request-notify/__tests__/store.test.ts`

**Interfaces:**
- Consumes: `NoticeRow`, `NoticeKind`, `NoticeState`, `Recovery` (Task 1)
- Produces (`store.ts`, 첫 인자 `db: SupabaseClient` — 기존 잡처럼 호출 쪽이 `createAdminClient()` 를 넘긴다):
  - `loadNoticeRows(db): Promise<NoticeRow[]>` — 오류면 throw(조용한 빈 배열 금지: supabase-js 는 안 던지므로 `error` 를 확인해 던진다).
  - `insertNoticeRows(db, rows: NoticeRow[]): Promise<void>` — `item_id` 충돌은 무시(`onConflict: "item_id", ignoreDuplicates: true`).
  - `updateLastStatus(db, updates: { item_id: string; last_status: string }[]): Promise<void>`
  - `applyRecoveries(db, recoveries: Recovery[]): Promise<void>` — 그 칸이 여전히 `sending` 일 때만.
  - `claimNotice(db, itemId: string, kind: NoticeKind, attempts: number, now: Date): Promise<boolean>` — `{kind}_state = 'pending' AND {kind}_attempts = attempts` 조건 UPDATE → `sending`, attempts+1, claimed_at=now. 갱신 행이 1이면 true.
  - `finishNotice(db, itemId, kind, result: { state: "sent" | "dry_run" | "pending" | "failed"; messageId?: string; error?: string; now: Date }): Promise<void>` — `sent`/`dry_run` 이면 `{kind}_sent_at`·`{kind}_message_id`, 오류면 `{kind}_error`(500자 자름).
- 테이블 `public.sms_sender_request_notices`:
  - `item_id text primary key`, `last_status text not null`
  - kind 별(`new_`, `done_`): `state text not null check (state in ('pending','sending','sent','dry_run','seeded','failed'))`, `attempts int not null default 0`, `claimed_at timestamptz`, `sent_at timestamptz`, `message_id text`, `error text`
  - `created_at`·`updated_at timestamptz not null default now()`
  - RLS enable, 정책 없음. anon/authenticated 권한은 최근 마이그레이션(service_role 전용 표) 관례를 따른다.
  - 신청자 메일·이름 컬럼 없음.

- [ ] **Step 1: 실패 테스트** — `store.test.ts`:
  - 마이그레이션 원문 대조(주석을 먼저 지우고 대조): `create table public.sms_sender_request_notices`, `item_id text primary key`, `enable row level security`, 상태 check 에 6개 값, `applicant`·`email` 이라는 컬럼이 **없다**.
  - `claimNotice` 가 `{kind}_state='pending'` 과 `{kind}_attempts=attempts` 를 조건으로 걸고, 0행이면 false (supabase 체인 목).
  - `loadNoticeRows` 가 `error` 가 있으면 throw.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/request-notify/__tests__/store.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 신청 알림 기록 테이블`

### Task 5: 잡 + registry + 문서

**Files:**
- Create: `src/features/automations/jobs/sms-sender-request-notify.ts`
- Modify: `src/features/automations/registry.ts` (import 1줄 + `AUTOMATION_JOBS` 항목 1개, `knowledge-index` 다음)
- Modify: `CLAUDE.md` (자동화 잡 표 1행 + 재발송 SQL 한 줄)
- Test: `src/features/automations/jobs/__tests__/sms-sender-request-notify.test.ts`

**Interfaces:**
- Consumes: Task 1~4 전부, `sendGraphMail`, `createAdminClient`.
- Produces: `runSmsSenderRequestNotify(): Promise<AutomationRunResult>`
- registry 항목: `id: "sms-sender-request-notify"`, `label: "SMS 발신번호 신청 알림"`, `description`: 무엇을 하는지 + 처음 실행은 적재만 한다는 것 + 보내는 메일함·받는 사람(이름 없이 '담당 매니저'), `scheduleInfo: "5분마다 (cron-job.org)"`, `cadence: "hourly"`(주석: 5분 값이 없다 — knowledge-index 와 같은 이유), `cooldownMinutes: 1`.
- 흐름:
  1. env 셋 중 빠진 것이 있으면 `ok:false`, message `환경변수 없음: {이름들}`. Graph·DB 호출 없음.
  2. `fetchRequestItems` → `RequestListError` 면 `ok:false` + 그 메시지. 스냅샷 무변경.
  3. `loadNoticeRows` 가 0행이면 `insertNoticeRows(seedRows(items))`, `ok:true`, message `처음 실행 — 기존 {n}행 적재, 발송 없음`, 메일 0통.
  4. 아니면 `reconcile` → `applyRecoveries` → `insertNoticeRows(inserts)` → `updateLastStatus` → `due` 순서대로:
     - `done` 인데 `applicantEmail` 이 null → claim 후 `finishNotice(failed, error:"신청자 메일 없음")`, 실패 1, Graph 호출 없음.
     - `claimNotice` false → 건너뜀(실패 아님).
     - dry_run → `finishNotice(dry_run)`.
     - 아니면 `sendGraphMail({ senderUserId: manager, toEmail: kind==="new" ? manager : applicantEmail, subject, html })` → ok 면 `sent`, 아니면 claim 후 attempts(=due.attempts+1) ≥ 3 이면 `failed` 아니면 `pending`, 실패 1.
  5. message: 보낸 것·실패·형식 오류가 모두 0 이면 `변화 없음 ({n}행)`; 아니면 `신규 {a}건 알림 · 완료 {b}건 알림` + (실패>0) ` · 실패 {k}건` + (malformed>0) ` · 형식이 맞지 않는 행 {m}건`; dry_run 이면 앞에 `[DRY-RUN] `. `ok` = 실패 0 이고 malformed 0. `details`: `{ items, newSent, doneSent, failed, malformed }` (숫자만).
- CLAUDE.md 자동화 잡 표 행: `| sms-sender-request-notify | 5분마다 (cron-job.org) | Teams 목록 'SMS 발신번호 사전등록 신청'의 새 행 → 담당 매니저, '완료' 전환 → 신청자에게 메일([내부관리자]). 처음 실행은 적재만 | sms_sender_request_notices |` + 표 아래 한 줄: `failed` 로 굳은 알림 재발송은 그 행의 `{new|done}_state='pending', {new|done}_attempts=0` 으로 되돌린다(화면 없음).

- [ ] **Step 1: 실패 테스트** (Task 3·4 모듈과 `sendGraphMail`·`createAdminClient` 를 목):
  - `env 하나라도 없으면 ok:false, 이름을 적고 Graph 를 안 부른다`
  - `스냅샷이 비면 seed 만 하고 메일 0통, 메시지 '처음 실행 — 기존 32행 적재, 발송 없음'`
  - `새 행 → 매니저 메일함에서 매니저에게` (`senderUserId === toEmail === 매니저`)
  - `완료 전환 → 매니저 메일함에서 신청자에게`
  - `처음 보이는 완료 행은 new 메일 다음 done 메일` (호출 순서)
  - `신청자 메일이 없으면 Graph 호출 없이 failed, ok:false`
  - `claim 을 놓치면 보내지 않고 실패로 세지 않는다`
  - `MAIL_DRY_RUN=true 면 sendGraphMail 0회, finishNotice dry_run, 메시지가 [DRY-RUN] 으로 시작`
  - `세 번째 시도 실패는 failed, 그 전은 pending`
  - `목록 읽기 실패면 ok:false 이고 스냅샷 함수를 안 부른다`
  - `malformed 가 있으면 ok:false, 메시지에 '형식이 맞지 않는 행'`
  - `메시지·details 에 메일 주소가 없다` (`JSON.stringify(result)` 가 `@` 를 포함하지 않음)
  - registry: `AUTOMATION_JOBS` 에 `sms-sender-request-notify` 가 있고 `cadence === "hourly"`
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/automations/jobs/__tests__/sms-sender-request-notify.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** (잡 함수 50줄 넘으면 내부 helper 로 나눈다)
- [ ] **Step 4: 통과 확인** + 관련 범위: `npx vitest run src/features/sms-sender src/features/automations --maxWorkers=1`
- [ ] **Step 5: 정적 검사** — `npm run typecheck` 오류 0, 변경 파일 `npx eslint <files>` 0
- [ ] **Step 6: 커밋** — `feat(sms-sender): 신청 알림 자동화 잡 등록`
