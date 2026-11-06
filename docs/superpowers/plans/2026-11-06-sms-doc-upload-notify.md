# 학교별 제출 서류 업로드 알림 (PR-1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `내부관리자/01. SMS 발신번호 사전등록/03. 학교별 제출 서류` 아래에 새 파일이 생기거나 파일이 교체되면, 5분 안에 SMS 발신번호 등록 담당자에게 메일 한 통으로 알린다.

**Architecture:** 기존 5분 잡 `sms-sender-request-notify` 에 두 번째 단계 `runDocUploadStep` 을 붙인다. 이 단계는 제출 서류 폴더를 Graph 로 재귀 조회(`source.ts` 의 새 `fetchDocFiles`)하고, 그 결과를 DB 스냅샷(`sms_sender_doc_upload_notices`)과 순수 함수로 대조(`reconcileUploads`)한다. 보낼 행은 하나씩 조건부 UPDATE 로 잡은(claim) 다음, 잡은 행만 묶어 메일 한 통으로 보낸다. 잡은 두 단계를 차례로 돌리고 서로의 실패를 격리하며, 결과 메시지에 두 단계를 같이 적는다.

**Tech Stack:** Next.js server-only TS, Supabase(service_role, `createAdminClient`), Microsoft Graph(`getGraphToken`, `sendGraphMail`), vitest.

**Spec:** `docs/superpowers/specs/2026-11-06-sms-status-refresh-design.md` — §5 전체, §2 '업로드 알림 받는 사람·시점·담당자 본인이 올린 파일' 행, §3 '같은 알림 두 번·첫 실행 쏟아짐·조용한 실패', §8 '덮어쓴 업로드'. PR-2~4 는 범위 밖이다.

## Global Constraints

- 작업 위치: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-sms-status-refresh`(브랜치 `feat/sms-doc-upload-notify`). 원래 폴더 `...\Build\OPS-Console` 은 건드리지 않는다. `scripts/moa-applyprice/` 는 스테이징하지 않는다. push 금지.
- 모듈 위치: `src/features/sms-sender/upload-notify/`(테스트는 그 아래 `__tests__/`). 신청 알림 모듈 `request-notify/` 는 상수(`MAX_ATTEMPTS = 3`, `STALE_SENDING_MINUTES = 30`)를 import 해서 쓰고, 그 밖에는 고치지 않는다.
- TDD: 테스트를 먼저 쓰고, 실패하는 것을 본 다음 구현한다(RED → GREEN).
- vitest 는 **`npm test -- <경로…> --maxWorkers=1`, 관련 파일만** 돌린다. dev 서버·`next build`·전체 스위트는 금지한다(이 PC 메모리 부족). 실제 Graph·메일·DB 호출도 금지이며 전부 목으로 대신한다.
- 받는 사람 = 보내는 메일함 = env `SMS_SENDER_REQUEST_MANAGER_EMAIL`. 드라이브 env 는 이미 있는 `SHAREPOINT_DRIVE_ID` 를 쓴다. **새 env 는 만들지 않는다.**
- `MAIL_DRY_RUN` 판정은 `(process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true"` 이다. dry-run 이면 Graph sendMail 을 0회 부르고, 잡은 행을 `dry_run` 으로 기록한다.
- 메일 브랜드는 `[내부관리자]`. `[운영부 상황실]` 은 넣지 않는다. 제목은 정확히 `[내부관리자] 학교별 제출 서류 {N}건 업로드` 이다(N = 이번 메일에 담긴 행 수).
- 본문 끝 고지(정확히): `이 메일은 학교별 제출 서류 폴더를 보고 자동으로 보냈습니다.`
- **사람 이름·메일 주소·전화번호는 실행 message·details·로그·DB 컬럼에 넣지 않는다.** 파일명·학교명·item id 는 넣어도 된다. 테스트 fixture 의 메일은 `manager@example.test` 같은 가짜 값만 쓴다.
- supabase-js 는 오류를 던지지 않는다. 모든 쿼리에서 `error` 를 확인해 던지고, 조용히 빈 배열로 넘어가지 않는다.
- SQL 원문 대조 테스트는 **주석을 먼저 지우고** 대조한다(`request-notify/__tests__/store.test.ts` 와 같은 정규식).
- 불변: 객체·배열을 고치지 말고 새로 만든다. 파일 하나는 400줄 미만, 함수 하나는 50줄 이하로 둔다. `any`·`@ts-ignore`·`eslint-disable`·`console.log` 는 금지한다(`console.error` 는 관례대로 쓰되 주소·이름은 싣지 않는다).
- 주석과 문구는 주변처럼 한국어로 쓴다. 한글이 든 기존 파일은 Edit 도구로만 고친다(셸 치환 금지).
- 커밋 메시지는 한국어 conventional 로 쓰고 끝에 다음 두 줄을 붙인다.
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```

## 고정한 결정

1. **교체는 같은 행을 다시 무장(re-arm)한다. 키는 `item_id` 하나다.** 같은 id 에 저장 해시와 다른 `quickXorHash` 가 오면 그 행을 `content_hash = 새 해시, change_kind = 'replaced', state = 'pending'`(올린 사람이 담당자면 `'skipped_self'`)`, attempts = 0, error = null` 로 되돌린다. 이 UPDATE 는 `content_hash = 이전 해시 AND state <> 'sending'` 일 때만 적용된다. 지금 보내는 중인 행은 이번 실행에서 건너뛰고 다음 실행이 잡는다.
   - 이렇게 정한 이유: 스펙 §5 가 PK 를 item id 로 정했고, 버전 이력은 쓰는 곳이 없다. `(id, hash)` 키로 두면 파일을 고칠 때마다 행이 쌓이고, A→B→A 로 되돌린 경우를 알리지 못한다.
   - 아직 안 나간 행(`pending`)이 또 교체되면 해시만 바꾸고 `change_kind` 는 그대로 둔다. 담당자가 아직 '새 파일' 소식도 받지 못했기 때문이다.
2. **해시가 없으면 교체로 보지 않는다.** 저장된 해시가 null 이고 새 해시가 있으면 조용히 채운다. 새 해시가 null 이면 비교하지 않는다.
3. **업로드한 사람의 메일은 저장하지 않는다**(지시서의 `uploader email nullable` 컬럼을 뺐다). 신청 알림 테이블이 '신청자 메일·이름은 저장하지 않는다'는 선례를 세웠고, 그 메일을 쓰는 곳은 담당자 본인 판정 하나뿐인데 그 결과는 `skipped_self` 상태에 이미 남는다. 판정은 메모리에서만 한다. 새 파일은 `createdBy.user.email ?? lastModifiedBy.user.email`, 교체는 `lastModifiedBy.user.email` 을 담당자 메일과 비교하고, 비교는 trim·소문자로 한다. 메일이 없으면 본인이 아닌 것으로 보고 알린다.
4. **상태 enum 에 `sending` 을 더한다.** 스펙 §5 의 6값만으로는 claim 을 할 수 없다. 신청 알림 store 규칙을 그대로 따르면 7값 `seeded|skipped_self|pending|sending|sent|failed|dry_run` 이 된다.
5. **claim 은 행마다, 메일은 실행마다 한 통이다.** 보낼 행을 하나씩 `pending → sending` 으로 잡고, 잡은 행만 메일에 담는다. 결과는 `item_id in (…) AND state = 'sending'` 일괄 UPDATE 로 기록하고, 실제로 갱신된 id 목록을 돌려받는다. 발송이 실패하면 행마다 `attempts + 1 >= MAX_ATTEMPTS` 인 것은 `failed`, 나머지는 `pending` 으로 둔다. 그러면 다음 실행에서 남은 행만 다시 묶여 나가므로 이미 나간 행은 중복되지 않는다. claim 한 뒤 프로세스가 죽어 30분 넘게 `sending` 에 남은 행은 회수한다.
6. **메일의 '학교'는 폴더가 아니라 파일명에서 뽑는다.** 이 폴더의 하위 구조는 단계 폴더(`완료/제출완료/접수+PIMS`, `진행 중` …)이고 학교 폴더가 없다. 학교는 `parse.ts` 의 `pdfSchoolName(name) ?? "-"` 로 구한다. '단계 폴더' 칸에는 `DOCS_FOLDER` 아래 상대 경로를 적고, 최상위면 `(최상위)` 라고 적는다.
7. **첫 실행 판정은 '테이블이 비었나'로 한다**(신청 알림과 같다). 비었으면 지금 있는 파일 전부를 `seeded` 로 넣고 메일은 보내지 않는다.

## Review Focus

1. 파일이 1,000개를 넘는 경우: Supabase 기본 select 는 최대 1,000행만 준다. `loadUploadRows` 가 쪽을 나눠 끝까지 읽지 않으면 넘친 파일이 '새 파일'로 보이고, 교체도 감지하지 못한다. → Task 1 테스트 `1000행이 차면 다음 쪽을 더 읽는다`
2. `quickXorHash` 가 빠진 항목(Graph 가 해시를 아직 계산하지 않은 경우)이 교체 알림을 내거나 해시 비교를 깨뜨리면 안 된다. → Task 3 테스트 `해시 null` 두 건
3. 보내는 중(`sending`)인 행이 그새 교체된 경우: 이번 실행에서는 손대지 않아야 하고, 무장 UPDATE 는 이전 해시가 맞을 때만 적용돼야 한다. → Task 3 `sending 중 교체는 다음 실행으로`, Task 1 `rearmUploads 조건`
4. 담당자 메일의 대소문자·공백이 다르거나 올린 사람 메일이 없는 경우: 대소문자는 본인으로 판정하고, 메일이 없으면 알린다. → Task 3 테스트 2건
5. 한 단계가 실패하거나 던지는 경우: 다른 단계는 그대로 돌고, 합친 결과는 `ok:false` 이며 메시지에 오류 원문이 실리지 않아야 한다. → Task 6 테스트 3건(신청 목록 실패·업로드 ok:false·업로드 throw)

---

### Task 1: 마이그레이션 + 타입 + 저장소

**Files:**
- Create: `supabase/migrations/20261106_sms_sender_doc_upload_notices.sql`
- Create: `src/features/sms-sender/upload-notify/types.ts`
- Create: `src/features/sms-sender/upload-notify/store.ts`
- Test: `src/features/sms-sender/upload-notify/__tests__/store.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type UploadState = "seeded" | "skipped_self" | "pending" | "sending" | "sent" | "failed" | "dry_run";
  export type ChangeKind = "new" | "replaced";
  export type UploadRow = {
    item_id: string; name: string; folder_path: string; web_url: string | null;
    content_hash: string | null; change_kind: ChangeKind; state: UploadState;
    attempts: number; claimed_at: string | null;
  };
  export type UploadInsert = Omit<UploadRow, "claimed_at">;
  export type Rearm = { item_id: string; prevHash: string; name: string; folder_path: string;
    web_url: string | null; content_hash: string; change_kind: ChangeKind; state: "pending" | "skipped_self" };
  export type HashFill = { item_id: string; content_hash: string };
  export type UploadRecovery = { item_id: string; state: "pending" | "failed" };
  ```
- Produces (`store.ts`, 첫 인자 `db: SupabaseClient`, 테이블 상수 `sms_sender_doc_upload_notices`):
  - `loadUploadRows(db): Promise<UploadRow[]>` — 1,000행씩 `.order("item_id").range(from, from + 999)` 로 읽고, 받은 행이 1,000 미만이면 멈춘다.
  - `insertUploadRows(db, rows: UploadInsert[]): Promise<void>` — 500행씩 나눠 `upsert(…, { onConflict: "item_id", ignoreDuplicates: true })`. 빈 배열이면 호출하지 않는다.
  - `rearmUploads(db, rearms: Rearm[], now: Date): Promise<void>` — 행마다 `.eq("item_id").eq("content_hash", prevHash).neq("state", "sending")`, 값은 `attempts: 0, error: null, claimed_at: null, updated_at`.
  - `fillHashes(db, fills: HashFill[], now: Date): Promise<void>` — `.eq("item_id").is("content_hash", null)`.
  - `recoverUploads(db, recoveries: UploadRecovery[], now: Date): Promise<void>` — `.eq("state", "sending").lt("claimed_at", now − STALE_SENDING_MINUTES)`.
  - `claimUpload(db, itemId: string, attempts: number, now: Date): Promise<boolean>` — 조건 `state = 'pending' AND attempts = attempts` 로 `sending`, `attempts + 1`, `claimed_at = now` 로 바꾼다. `.select("item_id")` 로 받은 행이 1개이면 true.
  - `finishUploads(db, itemIds: string[], result: { state: "sent" | "dry_run" | "pending" | "failed"; messageId?: string; error?: string; now: Date }): Promise<string[]>` — `.in("item_id", ids).eq("state", "sending").select("item_id")` 로 갱신된 id 를 돌려준다. `sent`/`dry_run` 이면 `sent_at`·`message_id` 를 채우고 `error = null`. error 가 있으면 500자로 자른다. ids 가 비었으면 호출하지 않고 `[]` 를 돌려준다.
- 테이블(주석 머리는 신청 알림 마이그레이션처럼 '무엇을 기억하나 / 저장하지 않는 것 / 서버 전용, 정책 0개'):
  ```sql
  item_id text primary key, name text not null, folder_path text not null, web_url text,
  content_hash text,
  change_kind text not null default 'new' check (change_kind in ('new','replaced')),
  state text not null default 'pending'
    check (state in ('seeded','skipped_self','pending','sending','sent','failed','dry_run')),
  attempts int not null default 0, claimed_at timestamptz, sent_at timestamptz,
  message_id text, error text,
  first_seen_at timestamptz not null default now(), updated_at timestamptz not null default now()
  ```
  `begin; … commit;`, `enable row level security`, `revoke all … from public, anon, authenticated`, `grant all … to service_role`, `notify pgrst, 'reload schema';`. 정책이 없으므로 `is_admin()` 도 쓰지 않는다.

- [ ] **Step 1: 실패 테스트 작성** — `store.test.ts` 는 `request-notify/__tests__/store.test.ts` 의 Proxy 체인 목 `dbWith` 를 복사해 쓴다. 단, `range` 호출마다 다른 결과를 돌려주도록 결과를 배열로 받는 변형을 둔다.
  - `마이그레이션`: 주석을 지운 원문에 `create table if not exists public.sms_sender_doc_upload_notices`, `item_id text primary key`, 위 state check 7값 문자열, change_kind check, `enable row level security`, `revoke all on public.sms_sender_doc_upload_notices from public, anon, authenticated`, `grant all on public.sms_sender_doc_upload_notices to service_role` 가 있다. `create policy` 는 없다. 테이블 본문에 `email` 이 없다.
  - `1000행이 차면 다음 쪽을 더 읽는다`: 첫 쪽 1,000행, 둘째 쪽 3행 → 1,003행. `range` 인자가 `[0, 999]`, `[1000, 1999]` 이다.
  - `loadUploadRows 는 error 가 있으면 던진다`
  - `claimUpload 은 state=pending·attempts 조건, 0행이면 false`
  - `rearmUploads 조건`: eq `content_hash` = prevHash, neq `state` = `sending`, payload `attempts` 0.
  - `finishUploads 는 sending 인 id 만 갱신하고 갱신된 id 를 돌려준다`, `빈 ids 는 db 를 안 부른다`, `sent 면 sent_at·message_id, error 500자 자름`.
  - `insertUploadRows 는 500행씩 나눈다`: 1,001행이면 upsert 3회.
- [ ] **Step 2: 실패 확인** — `npm test -- src/features/sms-sender/upload-notify/__tests__/store.test.ts --maxWorkers=1` → 모듈 없음으로 FAIL.
- [ ] **Step 3: 구현** — 위 마이그레이션·`types.ts`·`store.ts`. `assertOk` 는 신청 알림 store 와 같은 모양으로 이 파일 안에 둔다.
- [ ] **Step 4: 통과 확인** — 같은 명령, PASS.
- [ ] **Step 5: 커밋** — `feat(sms-sender): 제출 서류 업로드 알림 테이블·저장소`
- [ ] **Step 6: STOP — DB 승인 요청.** 여기서 멈추고 컨트롤러에게 알린다. 컨트롤러가 사용자에게 DB 변경 승인을 받아 Supabase 에 `20261106_sms_sender_doc_upload_notices.sql` 을 적용하고, service_role 로 `select count(*)` 를 돌려 `count !== null` 인지 확인한다(없는 테이블도 `error: null` 일 수 있다). 구현자는 마이그레이션을 직접 적용하지 않는다. Task 2~6 은 전부 목으로 돌아가므로 승인을 기다리는 동안 진행해도 된다. 다만 **머지 전에 이 확인이 끝나 있어야 한다.**

### Task 2: 제출 서류 폴더 전체 파일 읽기 (Graph)

**Files:**
- Modify: `src/features/sms-sender/types.ts`(타입 하나 추가)
- Modify: `src/features/sms-sender/source.ts`
- Test: `src/features/sms-sender/__tests__/source.test.ts`(기존 테스트 유지 + 추가)

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  /** 제출 서류 폴더의 파일 하나(PDF 외 포함). folder 는 DOCS_FOLDER 아래 상대 경로, "" = 최상위. 메일 주소는 trim·소문자. */
  export type RawDocFile = { id: string; name: string; folder: string; webUrl: string | null;
    hash: string | null; createdByEmail: string | null; modifiedByEmail: string | null };
  ```
- Produces (`source.ts`):
  - `childrenUrl(driveId: string, path: string, select: string = CHILD_SELECT): string` — 기본값은 지금 문자열 `id,name,webUrl,size,lastModifiedDateTime,folder,file` 그대로다. **내부관리자 화면이 받는 필드는 바뀌지 않는다.**
  - `export const UPLOAD_CHILD_SELECT = `${CHILD_SELECT},createdBy,lastModifiedBy``. 해시는 `file` facet 안의 `file.hashes.quickXorHash` 로 이미 온다.
  - `fetchDocFiles(): Promise<RawDocFile[]>` — `SHAREPOINT_DRIVE_ID` 와 토큰 처리, 오류 문구는 `fetchSmsSenderSource` 와 같다(`SourceFetchError`). 재귀 범위는 `${SMS_ROOT_PATH}/${DOCS_FOLDER}`, 깊이 한도는 기존 `MAX_DEPTH`, 페이지 한도와 Graph 밖 nextLink 거부도 기존 `listChildren` 그대로다.
- 구현 모양: `listChildren` 에 `select` 매개변수를 더하고, `walkPdfs` 의 재귀를 `walkDocs(driveId, token, path, rel, depth, select): Promise<{ item: DriveItem; rel: string }[]>`(파일만, 확장자 무관)로 뽑아낸다. 그다음 `walkPdfs` 는 `walkDocs` 결과를 PDF 로 거르고 `RawPdf` 로 바꾸는 것으로 줄인다. `DriveItem` 의 `file`·`createdBy`·`lastModifiedBy` 타입은 필요한 만큼만 좁혀 둔다.

- [ ] **Step 1: 실패 테스트 작성** — 기존 `installFetch`·`fullTree` 를 그대로 쓴다.
  - `기본 childrenUrl 에는 createdBy 가 없다`(화면이 받는 필드 불변) / `fetchDocFiles 의 children 호출은 createdBy,lastModifiedBy 를 select 한다`
  - `fetchDocFiles 는 PDF 가 아닌 파일도 담는다`: fullTree 에서 `memo.txt` 가 `완료/제출완료/접수+PIMS` 폴더로 포함되고, `루트.pdf` 는 folder `""`.
  - `해시·올린 사람 메일을 옮긴다`: `file: { hashes: { quickXorHash: "h1" } }`, `createdBy: { user: { email: " Up@Example.Test " } }` → `hash: "h1"`, `createdByEmail: "up@example.test"`. facet 이 없으면 각각 null.
  - 기존 `fetchSmsSenderSource` 테스트 전부가 그대로 통과한다(`walkPdfs` 결과 불변).
- [ ] **Step 2: 실패 확인** — `npm test -- src/features/sms-sender/__tests__/source.test.ts --maxWorkers=1` → 새 테스트만 FAIL.
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 같은 명령으로 전부 PASS. 화면 쪽 소비처도 함께 돌린다: `npm test -- src/features/sms-sender/__tests__ --maxWorkers=1`.
- [ ] **Step 5: 커밋** — `feat(sms-sender): 제출 서류 폴더 전체 파일·해시·올린 사람 읽기`

### Task 3: 대조 순수 함수

**Files:**
- Create: `src/features/sms-sender/upload-notify/reconcile.ts`
- Test: `src/features/sms-sender/upload-notify/__tests__/reconcile.test.ts`

**Interfaces:**
- Consumes: `RawDocFile`(Task 2), `UploadRow`·`UploadInsert`·`Rearm`·`HashFill`·`UploadRecovery`(Task 1), `MAX_ATTEMPTS`·`STALE_SENDING_MINUTES`(`request-notify/types`)
- Produces:
  ```ts
  export type DueUpload = { file: RawDocFile; kind: ChangeKind; attempts: number };
  export type UploadPlan = { inserts: UploadInsert[]; rearms: Rearm[]; fills: HashFill[];
    recoveries: UploadRecovery[]; due: DueUpload[]; skippedSelf: number };
  export function seedUploadRows(files: RawDocFile[]): UploadInsert[];   // 전부 state 'seeded', change_kind 'new'
  export function isManager(email: string | null, manager: string): boolean;  // trim·소문자 비교, null → false
  export function reconcileUploads(files: RawDocFile[], rows: UploadRow[], manager: string, now: Date): UploadPlan;
  ```
- 규칙(파일마다, 목록에 있는 파일만 본다. DB 에만 있는 행은 무시한다):
  - 행 없음 → insert(`change_kind 'new'`). `createdByEmail ?? modifiedByEmail` 이 담당자면 `skipped_self` 로 넣고 `skippedSelf + 1`, 아니면 `pending` 으로 넣고 due(attempts 0).
  - 행 있음 + `state = 'sending'` → 30분이 지났으면 recovery(`attempts >= MAX_ATTEMPTS` 이면 `failed`, 아니면 `pending`). 회수해서 pending 이 된 행은 due. 교체 판정은 하지 않는다.
  - 행 있음 + 해시 둘 다 있고 서로 다름 → rearm. state 는 `modifiedByEmail` 기준으로 `skipped_self` 또는 `pending` 이다. `change_kind` 는 행이 `pending` 이면 행의 값을 그대로 두고, 아니면 `'replaced'`. pending 으로 무장한 행은 due(attempts 0, kind 는 무장 후 `change_kind`).
  - 행 있음 + 저장 해시 null + 새 해시 있음 → fill 만 한다.
  - 그 밖에 행이 `pending` 이고 `attempts < MAX_ATTEMPTS` → due(행의 attempts·change_kind).

- [ ] **Step 1: 실패 테스트 작성** (fixture 메일은 `manager@example.test`, 남은 `other@example.test`)
  - `seedUploadRows 는 전부 seeded`
  - `처음 보는 id 는 pending insert + due(new)`
  - `처음 보는 id 를 담당자가 올렸으면 skipped_self, due 없음, skippedSelf 1`
  - `담당자 메일 대소문자·공백이 달라도 본인` (`" Manager@Example.TEST "`)
  - `올린 사람 메일이 없으면 알린다` (둘 다 null → pending)
  - `같은 id 새 해시 → rearm(replaced) + due(replaced, attempts 0)`
  - `교체를 담당자가 했으면 skipped_self rearm, due 없음` (modifiedByEmail = 담당자, createdBy = 남)
  - `해시만 같고 폴더가 바뀌면(이동) 아무 일도 없다`
  - `해시 null — 저장 null·새 값 있음은 fill 만, 알림 없음`
  - `해시 null — 새 값 null 이면 비교하지 않는다`
  - `sending 중 교체는 다음 실행으로` (rearm·due 없음)
  - `30분 지난 sending 은 회수 — attempts 3 이면 failed, 1 이면 pending + due`
  - `아직 안 나간 pending 행의 교체는 change_kind new 유지`
  - `pending 이지만 attempts 3 이면 due 아님` / `sent·seeded·failed 행은 due 아님`
- [ ] **Step 2: 실패 확인** — `npm test -- src/features/sms-sender/upload-notify/__tests__/reconcile.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 결과 배열은 `map`·`filter`·`flatMap` 이나 지역 배열 생성으로 만들고, 인자는 고치지 않는다.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 제출 서류 업로드 대조(새 파일·교체·본인 업로드)`

### Task 4: 묶음 메일 본문

**Files:**
- Create: `src/features/sms-sender/upload-notify/mail.ts`
- Test: `src/features/sms-sender/upload-notify/__tests__/mail.test.ts`

**Interfaces:**
- Consumes: `DueUpload`(Task 3), `pdfSchoolName`(`../parse`), `escapeHtml`(`@/features/receivables/mail-template`)
- Produces: `buildUploadMail(uploads: DueUpload[]): { subject: string; html: string }`
- 정해 둔 것:
  - 제목 `[내부관리자] 학교별 제출 서류 ${uploads.length}건 업로드`
  - 첫 문단 `학교별 제출 서류 폴더에 파일이 올라왔습니다.`
  - 표 머리는 `구분 | 학교 | 파일명 | 단계 폴더`. 구분은 `새 파일` 또는 `교체`, 학교는 `pdfSchoolName(name) ?? "-"`, 단계 폴더는 `folder || "(최상위)"` 이다. 파일명은 `webUrl` 이 `https://` 로 시작할 때만 그 주소로 가는 링크로 만들고, 아니면 글자만 적는다.
  - 행 순서는 새 파일 먼저, 그다음 학교(`localeCompare(…, "ko")`), 그다음 파일명. 정렬할 때 원본 배열은 고치지 않는다(`toSorted` 또는 복사).
  - 끝 고지는 Global Constraints 문구 그대로 쓴다. 글꼴·스타일 상수(`FONT`·`TEXT_STYLE`·`NOTICE_STYLE`)는 `request-notify/mail.ts` 와 같은 값을 이 파일에 둔다(Outlook 이 표에 글꼴을 상속하지 않아 요소마다 명시한다).

- [ ] **Step 1: 실패 테스트 작성**
  - `제목에 건수` (3건 → `[내부관리자] 학교별 제출 서류 3건 업로드`)
  - `규칙 이름의 PDF 는 학교명, 아니면 -` (`(가나대학교) SMS 발신용 대학 전화번호 등록 서류.pdf` → `가나대학교`, `memo.txt` → `-`)
  - `새 파일이 교체보다 먼저, 같은 구분은 학교순`
  - `파일명·폴더의 <script> 는 이스케이프`, `https 가 아닌 webUrl 은 링크로 만들지 않는다`, `빈 folder 는 (최상위)`
  - `끝 고지 문구`, `[운영부 상황실] 없음`
- [ ] **Step 2: 실패 확인** — `npm test -- src/features/sms-sender/upload-notify/__tests__/mail.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 제출 서류 업로드 묶음 메일`

### Task 5: 업로드 단계 실행기

**Files:**
- Create: `src/features/sms-sender/mail-error-code.ts`
- Create: `src/features/sms-sender/upload-notify/step.ts`
- Test: `src/features/sms-sender/__tests__/mail-error-code.test.ts`
- Test: `src/features/sms-sender/upload-notify/__tests__/step.test.ts`

**Interfaces:**
- Consumes: `fetchDocFiles`·`SourceFetchError`(Task 2), store 함수들(Task 1), `seedUploadRows`·`reconcileUploads`(Task 3), `buildUploadMail`(Task 4), `sendGraphMail`, `createAdminClient`, `MAX_ATTEMPTS`
- Produces:
  - `mailErrorCode(error: string): string` — 지금 잡 파일의 private `errorCode` 와 같은 규칙이다(`/^([a-z][a-z0-9_]{0,31}):/` 의 코드, 아니면 `"send_failed"`). Task 6 에서 잡도 이것을 쓰게 바꾼다.
  - `runDocUploadStep(): Promise<AutomationRunResult>`(`@/features/automations/types` 의 type import). **던지지 않는다.** message 에 `[DRY-RUN]` 머리는 붙이지 않는다(합치는 쪽이 붙인다).
- 흐름과 정해 둔 문구:
  1. env `SMS_SENDER_REQUEST_MANAGER_EMAIL`·`SHAREPOINT_DRIVE_ID` 가 없으면 `{ ok: false, message: "환경변수 없음: <이름들>" }` 을 돌려주고 Graph·DB 를 부르지 않는다.
  2. `fetchDocFiles()` 가 `SourceFetchError` 를 던지면 그 message 를 쓴다. 다른 오류면 `"제출 서류 폴더를 읽지 못했습니다."`(원문은 `console.error` 로만, 주소 없이).
  3. 행이 0개이면 seed 하고 `처음 실행 — 기존 파일 ${n}개 적재, 발송 없음`, ok true.
  4. 순서는 recover → rearm → fill → insert → 배달. 배달에서는 due 를 하나씩 `claimUpload` 하고, 잡은 것만 모은다. 0개이면 메일을 보내지 않는다.
     - dry-run: `finishUploads(ids, { state: "dry_run" })`
     - 발송: `sendGraphMail({ senderUserId: manager, toEmail: manager, subject, html })` → 성공하면 `finishUploads(ids, { state: "sent", messageId })`. 실패하면 `code = mailErrorCode(res.error)` 이고, `attempts + 1 >= MAX_ATTEMPTS` 인 id 묶음은 `failed`, 나머지는 `pending` 으로 `finishUploads` 를 두 번 부른다(빈 묶음은 store 가 건너뛴다).
     - 성공 기록에서 돌려받은 id 에 없는 행은 `claim_lost` 실패로 센다. 새 파일·교체 건수는 돌려받은 id 의 kind 로 센다.
  5. DB 오류(store 가 던짐)면 `"제출 서류 업로드 알림 기록 처리 중 오류가 발생했습니다."`, ok false.
  6. 요약: 아무 변화가 없으면(보냄 0·실패 0·본인 0) `변화 없음 (파일 ${n}개)`. 아니면 `새 파일 ${a}건 · 교체 ${b}건 알림` 에 이어 `skippedSelf > 0` 이면 ` · 담당자 본인 업로드 ${s}건 제외`, `failed > 0` 이면 ` · 실패 ${f}건 (${코드들 중복 없이 ", "})` 를 붙인다. ok 는 `failed === 0`.
  7. details 키(합칠 때 신청 단계 키와 겹치지 않게): `uploadFiles`, `uploadNew`, `uploadReplaced`, `uploadSkippedSelf`, `uploadFailed`.

- [ ] **Step 1: 실패 테스트 작성** — `mail-error-code.test.ts`: `graph_403: body` → `graph_403`, `boom` → `send_failed`. `step.test.ts`: `server-only`·`@/lib/supabase/admin`·`@/lib/microsoft/sendmail`·`../store` 를 목으로 두고, `../../source` 는 `importActual` 에 `fetchDocFiles: vi.fn()` 을 덮어 쓴다(잡 테스트의 list-source 목과 같은 방식).
  - `env 없으면 ok:false, 이름을 적고 Graph 를 안 부른다`
  - `테이블이 비면 seed 만, 메일 0통`
  - `새 파일 2·교체 1 → 메일 1통, 제목 3건, 보내는 메일함=받는 사람=담당자`
  - `claim 을 놓친 행은 메일에 안 담기고 실패로 세지 않는다`
  - `모두 claim 을 놓치면 메일 0통, 실패 아님`: due 1건, claim false → `sendGraphMail` 0회, ok true, `변화 없음 (파일 1개)`.
  - `발송 실패 — attempts 2 인 행은 failed, 0 인 행은 pending, 코드만 메시지에` (`graph_403: secret-body` → 메시지에 `graph_403`, `secret-body` 없음)
  - `성공 기록이 일부만 갱신되면 claim_lost 로 센다`
  - `MAIL_DRY_RUN=true 면 sendGraphMail 0회, dry_run 으로 기록, message 에 [DRY-RUN] 없음`
  - `본인 업로드만 있으면 메일 0통, '담당자 본인 업로드 1건 제외'`
  - `SourceFetchError 는 그 문구, 다른 오류는 고정 문구(원문 없음)`
  - `DB 오류도 던지지 않고 ok:false`
  - `결과 JSON 에 @ 가 없다`
- [ ] **Step 2: 실패 확인** — `npm test -- src/features/sms-sender/__tests__/mail-error-code.test.ts src/features/sms-sender/upload-notify/__tests__/step.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 함수 하나가 50줄을 넘지 않게 `deliverBatch`·`summarizeUploads` 로 나눈다.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 제출 서류 업로드 알림 단계`

### Task 6: 잡에 두 번째 단계로 붙이기 + 문서

**Files:**
- Modify: `src/features/automations/jobs/sms-sender-request-notify.ts`
- Modify: `src/features/automations/jobs/__tests__/sms-sender-request-notify.test.ts`
- Modify: `src/features/automations/registry.ts`(이 잡의 `description` 만)
- Modify: `CLAUDE.md`(자동화 잡 표의 `sms-sender-request-notify` 행 + 그 아래 env·재발송 메모)

**Interfaces:**
- Consumes: `runDocUploadStep`(Task 5), `mailErrorCode`(Task 5)
- Produces (잡 파일):
  - `export async function runRequestStep(): Promise<AutomationRunResult>` — 지금의 `runSmsSenderRequestNotify` 본문을 그대로 옮긴다. 바뀌는 것은 두 가지다. `summarize` 가 `[DRY-RUN] ` 머리를 붙이지 않고, private `errorCode` 를 지우고 `mailErrorCode` 를 쓴다. 신청 단계의 env 판정·문구·details 키는 그대로다.
  - `export function combineSteps(request: AutomationRunResult, upload: AutomationRunResult, dryRun: boolean): AutomationRunResult` — message 는 `${dryRun ? "[DRY-RUN] " : ""}신청: ${request.message} / 업로드: ${upload.message}`, ok 는 `request.ok && upload.ok`, details 는 `{ ...request.details, ...upload.details }`.
  - `export async function runSmsSenderRequestNotify(): Promise<AutomationRunResult>` — 신청 단계를 먼저, 업로드 단계를 다음에 **차례로** 돌린다. 각 호출은 try/catch 로 감싼다. 던지면 `{ ok: false, message: "신청 단계 오류" }` 또는 `"업로드 단계 오류"` 로 바꾸고, 원문은 `console.error` 로만 남긴다. 그다음 `combineSteps` 를 부른다.
- registry `description` 끝에 한 줄을 더한다: `같은 실행에서 '03. 학교별 제출 서류' 폴더에 새로 올라오거나 교체된 파일을 담당 매니저에게 한 통으로 묶어 알립니다(담당 매니저 본인이 올린 파일은 제외).` id·cadence·cooldown 은 그대로 둔다.
- CLAUDE.md 표의 기능 칸에 `+ 제출 서류 폴더 새 파일·교체 → 담당 매니저 묶음 메일(본인 업로드 제외)` 를, 이력 칸에 `sms_sender_doc_upload_notices` 를 더한다. 재발송 메모에는 `업로드 알림의 failed 는 state='pending', attempts=0` 을 덧붙인다.

- [ ] **Step 1: 테스트 고치기·추가(먼저)** — 기존 테스트 파일에 `vi.mock("@/features/sms-sender/upload-notify/step", () => ({ runDocUploadStep: vi.fn() }))` 를 더한다. `beforeEach` 에서는 `{ ok: true, message: "변화 없음 (파일 0개)", details: { uploadFiles: 0 } }` 을 돌려주게 한다.
  - 기존 `describe("runSmsSenderRequestNotify")` 의 호출 대상을 `runRequestStep` 으로 바꾸고, describe 이름도 `runRequestStep` 으로 바꾼다. 단언은 그대로 둔다. 예외는 DRY-RUN 테스트 하나뿐으로, `r.message.startsWith("[DRY-RUN] ")` 단언을 `[DRY-RUN]` 이 **없다**로 뒤집는다(머리는 합치는 쪽으로 옮겼다).
  - 새 `describe("runSmsSenderRequestNotify — 두 단계")`:
    - `메시지는 '신청: … / 업로드: …', details 는 두 단계 합침`
    - `MAIL_DRY_RUN=true 면 합친 메시지 맨 앞에 [DRY-RUN] 한 번`
    - `신청 목록 읽기 실패여도 업로드 단계는 돈다, ok:false` (`fetchRequestItems` reject → `runDocUploadStep` 1회 호출)
    - `업로드 단계가 ok:false 면 전체 ok:false, 신청 메일은 그대로 나간다`
    - `업로드 단계가 던져도 신청 메일은 나가고 원문은 메시지에 없다` (`runDocUploadStep.mockRejectedValue(new Error("secret"))` → 메시지에 `업로드: 업로드 단계 오류`, `secret` 없음, ok:false). 신청 단계는 안에서 모든 오류를 잡으므로 던지는 경우는 순서 보장(신청 → 업로드)과 try/catch 코드로만 확인한다.
    - `env 하나(SITE_ID)만 없으면 신청만 실패하고 업로드는 돈다`
    - `합친 결과 JSON 에 @ 가 없다`
  - `registry` 테스트에 `description` 이 `03. 학교별 제출 서류` 를 담는지 단언을 더한다.
- [ ] **Step 2: 실패 확인** — `npm test -- src/features/automations/jobs/__tests__/sms-sender-request-notify.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 잡 파일, registry description, CLAUDE.md(Edit 도구).
- [ ] **Step 4: 통과 확인** — 아래 명령으로 이 PR 의 테스트를 모두 함께 돌린다.
  `npm test -- src/features/automations/jobs/__tests__/sms-sender-request-notify.test.ts src/features/sms-sender --maxWorkers=1` → 0 failed. 이어서 바뀐 파일만 `npx eslint <바뀐 .ts 파일들>` → 0 errors.
- [ ] **Step 5: 커밋** — `feat(automations): 신청 알림 잡에 제출 서류 업로드 단계 추가`
- [ ] **Step 6: 머지 전 확인(컨트롤러)** — Task 1 Step 6 의 DB 적용과 `count !== null` 확인이 끝났는지 본다. `npm run typecheck` 는 메모리 여유가 있을 때 컨트롤러가 한 번 돌린다(fresh worktree 면 먼저 `npx next typegen`). 배포 뒤 첫 실행 이력에 `업로드: 처음 실행 — 기존 파일 N개 적재, 발송 없음` 이 찍히는지 `automation_runs` 로 확인한다. 등록은 코드 밖에서 끝나므로 이력을 봐야 한다.

---

## Self-Review

- 스펙 대조: §5 의 '두 번째 단계·실패 격리·결과 메시지 둘'은 Task 6, '모든 파일·같은 깊이 한도'는 Task 2, 테이블·RLS 는 Task 1, 새 파일과 교체·이동은 알림 아님은 Task 3, 첫 실행 seeded 는 Task 3·5, skipped_self 는 Task 3, 메일 한 통·제목·칸은 Task 4·5, 재시도·failed 고착·claim·MAIL_DRY_RUN 은 Task 1·5 가 맡는다. §2 받는 사람·5분·본인 제외도 위와 같다. §3 '두 번 가지 않음'은 claim 과 `sending` 조건 갱신, '쏟아지지 않음'은 seed, '조용한 실패 없음'은 ok:false 와 automation_runs 가 맡는다. §8 덮어쓴 업로드는 Task 3 이 맡는다.
- 스펙과 다른 점은 둘이다(고정한 결정 3·4): uploader email 컬럼 없음, `sending` 상태 추가.
- 이름 일관성: `RawDocFile`·`UploadRow`·`UploadInsert`·`Rearm`·`HashFill`·`UploadRecovery`·`DueUpload`·`UploadPlan`·`fetchDocFiles`·`reconcileUploads`·`seedUploadRows`·`buildUploadMail`·`runDocUploadStep`·`runRequestStep`·`combineSteps`·`mailErrorCode` 가 정의한 Task 와 쓰는 Task 에서 같은 이름이다.
