# 매뉴얼 반기 점검 알림 (PR-A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3월·8월 영업일에 `2. 매뉴얼 대장` 의 진행 중 업무 매뉴얼을 담당자마다 한 통(본인 메일함 → 본인) 보내고, 관리자 두 명에게 반기 1회 요약(담당자 미확인·파일 연결 안 됨)을 보낸다.

**Architecture:** 원천 읽기는 PR-B 와 같이 쓰는 모듈 `src/features/manual-ledger/` 로 둔다 — 순수 파서(`parse.ts`)·Graph 읽기(`source.ts`)·대장↔파일↔운영자 연결(`resolve.ts`). 반기 알림 고유 로직은 `src/features/manual-review/`(반기 판정·담당자별 묶음·메일 HTML·이력 저장)에 두고, 잡 `manual-review-reminder` 가 그것을 엮는다. cron-job.org 가 매일 10:00 부르고, 3월·8월이 아니거나 주말·공휴일이면 `skipped` 로 끝난다. 중복 방지는 `manual_review_reminders`(반기 키 + 수신자 키) 의 `sent` 행이다.

**Tech Stack:** Next.js App Router + TypeScript + zod 없음(입력은 시트 값·env) + Supabase(service_role) + Microsoft Graph(app-only, GET 과 sendMail 만) + Vitest

**Spec:** `docs/superpowers/specs/2026-11-09-manual-ledger-notify-design.md` — §2(발신 메일함), §3, §4 전체, §5 전체, §7, §8 PR-A 행, §9 중 '점검 기한=그 달 말'·'담당자 둘이면 둘 다'·'재시도는 대장을 다시 읽는다'·'관리자 요약은 반기 1회(`__summary__`)'·'최종 수정일=대장 칸 값'·'매일 호출 + 스킵 기록'. §6(수정 알림)은 PR-B 다 — 단 `source.ts` 가 돌려주는 파일 목록에 `cTag`·`lastModifiedDateTime` 을 실어 PR-B 가 다시 쓰게 한다.

## Global Constraints

- 작업 위치: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-manual-notify`(브랜치 `feat/manual-ledger-notify`). 원래 폴더는 건드리지 않는다. `node_modules` 는 정션 — 지우지 않는다. push 금지.
- TDD: 테스트 먼저 → 실패 확인 → 구현 → 통과 → 태스크별 커밋.
- 메모리 부족 PC: dev 서버·build·전체 스위트 금지. `npx vitest run <경로…> --maxWorkers=1`, `npm run typecheck`, `npx eslint <파일…>` 만. 메모리로 죽으면 재시작 반복 금지.
- 마이그레이션은 **어디에도 적용하지 않는다**(사용자가 SQL 을 실행). 실제 메일 발송·Graph 쓰기 호출 금지.
- 개인정보: 코드·fixture·로그·`automation_runs` 메시지·details 에 실명·실주소 금지. fixture 는 `담당자A`·`a@example.test`. 실행 메시지·details 는 **건수만**(§7). 메일 오류는 `mailErrorCode` 로 코드만 저장(`@/features/sms-sender/mail-error-code`).
- supabase-js 는 오류를 던지지 않는다 — 모든 쿼리의 `error` 를 확인해 던진다.
- SQL 원문 대조 테스트는 주석을 먼저 지운다(`sms-sender/upload-notify/__tests__/store.test.ts` 의 두 정규식).
- 날짜는 KST. 연·월은 `kstFormat({ year: "numeric", month: "numeric" }).formatToParts` 로 얻는다(`@/lib/kst-format`). 주말·공휴일은 `canSendOn`(`@/features/receivables/mail-schedule`) + `fetchKoreanHolidays`(`@/lib/holidays/google-ical`) 재사용.
- 메일 HTML: 인라인 스타일만, 요소마다 글꼴 명시(Outlook 은 상속 안 함 — `upload-notify/mail.ts` 의 `FONT` 관례), `white-space: pre-wrap` 금지, 표는 `<table>`, 링크는 `https://` 로 시작할 때만 앵커, 값은 `escapeHtml`(`@/features/receivables/mail-template`).
- 발신: `sendGraphMail({ senderUserId: X, toEmail: X, … })` — 받는 사람 본인 메일함에서 본인에게. `MAIL_DRY_RUN=true` 면 Graph 호출 없이 `dry_run` 기록.
- 불변 패턴, 함수 50줄 이하, 파일 400줄 미만, `any`·`console.log`·`eslint-disable` 금지. 주석·문구는 한국어, 한글이 든 기존 파일은 Edit 도구로. `git diff | grep -c $'\xef\xbf\xbd'` = 0.
- 커밋: 한국어 conventional, 끝에 두 줄
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG`

## Review Focus

1. **대장 헤더가 바뀐 경우** — 필수 열(업무·문서명·담당자)을 못 찾으면 '보낼 것 0건'으로 조용히 끝나지 않고 실패(`ok:false`)로 끝나야 한다. → Task 1 `parseLedgerSheet` 의 throw 테스트 + Task 7 의 `ManualSourceError → ok:false` 테스트.
2. **연간 일정의 구역 머리행을 못 찾는 경우** — '진행 중' 이 0개 업무로 읽혀 아무에게도 안 가는 것을 막는다. → Task 1 `parseActiveTasks` throw 테스트.
3. **같은 반기 두 번째 호출** — 이미 `sent` 인 담당자·관리자 요약은 다시 안 간다. 실패했던 사람만 간다. → Task 7 '모두 sent 면 발송 0' + '실패분만 재시도' 테스트.
4. **이름 표기 흔들림** — 대장 셀의 앞뒤 공백, 쉼표·슬래시로 붙은 두 담당자, NFD 로 들어온 파일명이 '미확인/연결 안 됨'으로 새지 않는다. 반대로 같은 코드의 옛 버전 파일이 접두 일치로 걸리지 않는다. → Task 1 `splitOwners`, Task 3 `resolveLedger` 테스트.
5. **실행 기록에 개인정보가 새는 것** — 결과 message·details 를 직렬화해 `@` 가 없음을 단언한다. → Task 7.

---

### Task 1: 대장·연간 일정 파서 (순수 함수)

**Files:**
- Create: `src/features/manual-ledger/types.ts`
- Create: `src/features/manual-ledger/parse.ts`
- Test: `src/features/manual-ledger/__tests__/parse.test.ts`

**Interfaces:**
- Produces:
  - `class ManualSourceError extends Error` — 화면·실행 기록에 그대로 실어도 되는 짧은 한국어 메시지만.
  - `type LedgerRow = { code: string | null; task: string; docName: string; ownerText: string; owners: string[]; lastModified: string | null }`
  - `const LEDGER_SHEET = "2. 매뉴얼 대장"`, `const SCHEDULE_SHEET = "1. 연간 일정"`
  - `splitOwners(cell: string): string[]`
  - `parseLedgerSheet(values: unknown[][]): LedgerRow[]`
  - `parseActiveTasks(values: unknown[][]): Set<string>`

규칙:
- 헤더 셀은 공백을 모두 지우고 비교한다(`"최종 수정"` → `"최종수정"`). 헤더 행 = 필수 열 이름(`업무`·`문서명`·`담당자`)이 모두 있는 첫 행. 없으면 `ManualSourceError("매뉴얼 대장 머리행을 찾지 못했습니다 (업무·문서명·담당자)")`.
- 선택 열: `코드`, `최종수정`. 없으면 `null`.
- 데이터 행: 셀은 `String(v).trim()`(null/undefined → `""`). `업무`·`문서명` 이 모두 빈 행은 버린다. `lastModified` 는 빈 문자열이면 `null`, 아니면 칸 값 문자열 그대로(§9).
- `splitOwners`: `/[,，/·、\n]+/` 로 나눠 trim, 빈 것 제거, 순서 유지 중복 제거.
- `parseActiveTasks`: 헤더 행 = `업무` 와 `담당자` 가 있는 첫 행(없으면 throw). 그 아래에서 어떤 셀이든 trim 해 `▪` 로 시작하면 구역 머리행. 구역 판정은 공백 제거 문자열로 `진행하지` 포함 → 비진행, `이관`·`중단` 포함 → 비진행, `진행중` 포함 → 진행 중, 그 외 → 비진행. 진행 중 구역 행의 `업무` 칸(빈 칸 제외)을 모은다. 진행 중 머리행이 하나도 없으면 `ManualSourceError("연간 일정에서 '진행 중' 구역을 찾지 못했습니다")`.

- [ ] **Step 1: 실패하는 테스트 작성** — `parse.test.ts`:
  - `parseLedgerSheet` — 제목·안내 3행 뒤 4행 헤더(`코드·구분·업무·종류·문서명·담당자·보관 위치·최종 수정·링크 상태·개정 이력 점검`) + 데이터 2행 + 빈 행 1 → `toEqual([{ code: "A01", task: "원서접수", docName: "A01. 원서접수 매뉴얼.docx", ownerText: "담당자A", owners: ["담당자A"], lastModified: "2026.03.02" }, …])`, 빈 행 제외로 길이 2.
  - 열 순서를 바꾸고 `코드`·`최종 수정` 열을 뺀 시트 → `code: null`, `lastModified: null`, 나머지 동일.
  - 헤더 셀 `" 담당자 "`·`"최종\n수정"` 도 인식.
  - `담당자` 열이 없는 시트 → `toThrow(ManualSourceError)`, 메시지에 `"담당자"` 포함.
  - 숫자 셀(`45678`) → `lastModified: "45678"`.
  - `splitOwners(" 담당자A , 담당자B ")` → `["담당자A","담당자B"]`; `"담당자A/담당자B"`·`"담당자A·담당자B"`·`"담당자A\n담당자B"` 동일; `""` → `[]`; `"담당자A, 담당자A"` → `["담당자A"]`.
  - `parseActiveTasks` — 헤더 `구분·업무·담당자·3월…` 아래 `▪ 진행 중` 구역에 업무 `원서접수`·`정산`, `▪ 진행하지 않는 사업` 에 `구사업`, `▪ 이관/중단` 에 `이관업무` → `new Set(["원서접수","정산"])`. 머리행 문구가 `"▪ 진행중 (10)"` 이어도 같음.
  - 진행 중 머리행이 없는 시트 → `toThrow(ManualSourceError)`; 헤더 행이 없는 시트 → throw.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/manual-ledger/__tests__/parse.test.ts --maxWorkers=1` → 모듈 없음으로 FAIL.
- [ ] **Step 3: `types.ts`·`parse.ts` 구현** — 위 시그니처·규칙대로. `ManualSourceError` 는 `name = "ManualSourceError"`.
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.
- [ ] **Step 5: 커밋** — `feat(manual-ledger): 매뉴얼 대장·연간 일정 파서`

---

### Task 2: Graph 원천 읽기

**Files:**
- Create: `src/features/manual-ledger/source.ts`
- Test: `src/features/manual-ledger/__tests__/source.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `parseLedgerSheet`, `parseActiveTasks`, `ManualSourceError`, `LEDGER_SHEET`, `SCHEDULE_SHEET`.
- Produces (types 는 `types.ts` 에 추가):
  - `type ManualFolderFile = { id: string; name: string; webUrl: string | null; lastModifiedDateTime: string | null; cTag: string | null }`
  - `type ManualSource = { ledger: LedgerRow[]; activeTasks: Set<string>; files: ManualFolderFile[] }`
  - `const MANUAL_SOURCE_ENV = ["SHAREPOINT_DRIVE_ID","SHAREPOINT_MANUAL_ITEM_ID","SHAREPOINT_MANUAL_LEDGER_ITEM_ID"] as const`
  - `folderChildrenUrl(driveId: string, folderId: string): string` — `…/drives/{d}/items/{f}/children?$top=200&$select=id,name,webUrl,lastModifiedDateTime,cTag,file`
  - `sheetValuesUrl(driveId: string, itemId: string, sheet: string): string` — sms-sender `usedRangeUrl` 과 같은 모양(`worksheets('…')/usedRange(valuesOnly=true)?$select=values`, 작은따옴표 이중화 + encodeURIComponent)
  - `fetchManualSource(): Promise<ManualSource>` — `server-only`.

규칙: env 하나라도 없으면 `ManualSourceError("매뉴얼 원천 설정이 없습니다")`(이름은 `console.error` 로만). 토큰 실패 → `ManualSourceError("Microsoft 인증에 실패했습니다.")`. 두 시트·폴더 목록을 `Promise.all` 로 읽는다. 목록은 `@odata.nextLink` 를 따라가되 `https://graph.microsoft.com/v1.0/` 밖 주소면 throw, 50쪽 상한. `file` facet 이 있는 항목만 파일. HTTP 실패는 `ManualSourceError("{매뉴얼 대장|연간 일정|매뉴얼 폴더} 읽기 실패 ({status})")`. `fetch` 는 `cache: "no-store"`.

- [ ] **Step 1: 실패하는 테스트 작성** — `vi.stubGlobal("fetch", …)`, `vi.mock("@/lib/microsoft/auth", () => ({ getGraphToken: vi.fn(async () => "tok") }))`, env 는 `vi.stubEnv`:
  - `sheetValuesUrl("d","i","2. 매뉴얼 대장")` 이 `encodeURIComponent("2. 매뉴얼 대장")` 을 포함; 시트명 `"a'b"` → `"a''b"` 인코딩.
  - 정상 응답(대장 values·일정 values·폴더 children 에 폴더 1 + 파일 2) → `ledger` 길이·`activeTasks` 내용·`files` 2개(폴더 제외), 파일의 `cTag`·`webUrl` 매핑. 요청 URL 3종이 모두 불렸는지.
  - children 첫 응답에 graph nextLink → 두 쪽 합쳐 파일 수; 외부 nextLink(`https://evil.example.test/…`) → `rejects.toThrow(ManualSourceError)`.
  - 대장 시트 응답 500 → `rejects.toThrow("매뉴얼 대장 읽기 실패 (500)")`.
  - `SHAREPOINT_MANUAL_LEDGER_ITEM_ID` 빈 값 → `rejects.toThrow(ManualSourceError)` 이고 `fetch` 미호출.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/manual-ledger/__tests__/source.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현** — 위 시그니처대로.
- [ ] **Step 4: 통과 확인** — 같은 명령 + Task 1 테스트 → PASS.
- [ ] **Step 5: 커밋** — `feat(manual-ledger): 매뉴얼 폴더·구성표 시트 Graph 읽기`

---

### Task 3: 대장 ↔ 파일 ↔ 운영자 연결 + 관리자 주소

**Files:**
- Create: `src/features/manual-ledger/resolve.ts`
- Create: `src/features/manual-ledger/operators.ts`
- Create: `src/features/manual-ledger/admins.ts`
- Test: `src/features/manual-ledger/__tests__/resolve.test.ts`, `__tests__/operators.test.ts`, `__tests__/admins.test.ts`

**Interfaces:**
- Consumes: `LedgerRow`, `ManualSource`, `ManualFolderFile`.
- Produces (types 는 `types.ts`):
  - `type OperatorEntry = { name: string; email: string; status: string }`
  - `type ResolvedManual = LedgerRow & { file: ManualFolderFile | null; active: boolean; recipients: { name: string; email: string }[]; unresolvedOwners: string[] }`
  - `resolveLedger(source: ManualSource, operators: OperatorEntry[]): ResolvedManual[]`
  - `loadOperatorDirectory(db: SupabaseClient): Promise<OperatorEntry[]>` — `server-only`, `operators` 에서 `name,email,status` select, `error` 면 `throw new Error("운영자 명부 조회 실패: …")`.
  - `parseAdminEmails(raw: string | undefined): string[]` — 쉼표 분리, trim, 소문자, `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` 통과분만, 중복 제거.

규칙: 파일 매칭은 `docName.normalize("NFC")` === `file.name.normalize("NFC")` 정확 일치(접두·코드 매칭 금지). 운영자는 `status !== "deleted"` 만, 이름 `trim().normalize("NFC")` 키. 같은 이름이 둘 이상 남으면 그 이름은 미확인으로 둔다(누구에게 보낼지 모른다). `active = source.activeTasks.has(row.task)`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - resolve: `"A01. 매뉴얼.docx"` 행은 같은 이름 파일과 연결되고, `"A01. 매뉴얼_v2.docx"` 만 있으면 `file: null`. NFD 파일명(`"가".normalize("NFD")…`)도 연결.
  - resolve: owners `["담당자A","담당자B"]` 중 A 만 명부에 있으면 `recipients: [{ name: "담당자A", email: "a@example.test" }]`, `unresolvedOwners: ["담당자B"]`.
  - resolve: 명부의 `status: "deleted"` 담당자A + `active` 담당자A → active 쪽으로 연결; `active` 둘 → 미확인.
  - resolve: `active` 는 activeTasks 포함 여부 그대로.
  - operators: 체인 목(`from().select()` 이 `{ data, error }`)으로 `error` → `rejects.toThrow("운영자 명부 조회 실패")`; 정상 → 행 그대로.
  - admins: `" A@example.test , b@example.test,not-mail,, a@example.test"` → `["a@example.test","b@example.test"]`; `undefined` → `[]`.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/manual-ledger/__tests__ --maxWorkers=1` → 새 테스트 FAIL.
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.
- [ ] **Step 5: 커밋** — `feat(manual-ledger): 대장 행을 파일·운영자 메일과 연결`

---

### Task 4: 반기 판정 + 담당자별 묶음

**Files:**
- Create: `src/features/manual-review/half.ts`
- Create: `src/features/manual-review/plan.ts`
- Test: `src/features/manual-review/__tests__/half.test.ts`, `__tests__/plan.test.ts`

**Interfaces:**
- Consumes: `ResolvedManual`.
- Produces:
  - `type ReviewHalf = { key: string; label: string; month: 3 | 8 }`
  - `reviewHalfFor(now: Date): ReviewHalf | null` — KST 월이 8 → `{ key: "{Y}-H1", label: "1·2분기(4~9월)", month: 8 }`, 3 → `{ key: "{Y-1}-H2", label: "3·4분기(10~3월)", month: 3 }`, 그 외 `null`.
  - `type ReviewItem = { task: string; docName: string; webUrl: string | null; lastModified: string | null }`
  - `type ReviewRecipient = { key: string; email: string; name: string; items: ReviewItem[] }` — `key` = 소문자 메일.
  - `type ReviewIssue = { task: string; docName: string; ownerText: string }`
  - `type ReviewPlan = { recipients: ReviewRecipient[]; manualCount: number; unresolvedOwners: ReviewIssue[]; unlinked: ReviewIssue[] }`
  - `buildReviewPlan(manuals: ResolvedManual[]): ReviewPlan`

규칙: `active` 행만. 수신자별 `items` 는 업무 → 문서명 순(`localeCompare(…, "ko")`), 수신자는 이름 순. 파일 없는 행도 담당자 메일에는 링크 없이 넣고 `unlinked` 에도 올린다. `unresolvedOwners` 이슈의 `ownerText` = 미확인 이름을 `", "` 로 이은 것, 담당자 칸이 비면 `"(빈칸)"`. `manualCount` = active 행 수.

- [ ] **Step 1: 실패하는 테스트 작성**
  - half: `2026-08-03T01:00:00Z` → `{ key: "2026-H1", label: "1·2분기(4~9월)", month: 8 }`; `2027-03-02T01:00:00Z` → `{ key: "2026-H2", label: "3·4분기(10~3월)", month: 3 }`; `2026-07-31T15:30:00Z`(KST 8/1 00:30) → H1; `2026-08-31T15:00:00Z`(KST 9/1) → `null`; `2026-11-09T01:00:00Z` → `null`.
  - plan: 비활성 행 제외(`manualCount` 에 안 셈); 두 담당자 행은 두 수신자 모두의 items 에; 같은 메일 대소문자 다른 두 행 → 수신자 1명(key 소문자); items 정렬; 파일 없는 활성 행 → 담당자 items 에 `webUrl: null` + `unlinked` 1건; 담당자 칸 빈 행 → `unresolvedOwners[0].ownerText === "(빈칸)"`; 일부 미확인 → `ownerText: "담당자B"`.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/manual-review/__tests__ --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현** — 연·월은 `kstFormat({ year: "numeric", month: "numeric" }).formatToParts(now)`.
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.
- [ ] **Step 5: 커밋** — `feat(manual-review): 반기 판정과 담당자별 매뉴얼 묶음`

---

### Task 5: 메일 HTML (담당자 안내 + 관리자 요약)

**Files:**
- Create: `src/features/manual-review/mail.ts`
- Test: `src/features/manual-review/__tests__/mail.test.ts`

**Interfaces:**
- Consumes: `ReviewHalf`, `ReviewRecipient`, `ReviewIssue`.
- Produces:
  - `buildReviewMail(r: ReviewRecipient, half: ReviewHalf): { subject: string; html: string }`
  - `type ReviewSummary = { recipients: number; notified: number; pending: number; manualCount: number; unresolvedOwners: ReviewIssue[]; unlinked: ReviewIssue[] }`
  - `buildSummaryMail(s: ReviewSummary, half: ReviewHalf): { subject: string; html: string }`

고정 문구:
- 안내 제목 `[운영부] 매뉴얼 점검 안내 — {label}`; 본문 `안녕하세요, {name}님.` / `맡으신 진행 중 업무의 매뉴얼입니다. {month}월 말까지 내용을 점검하고 바뀐 점을 반영해 주세요.`; 표 머리 `업무 · 문서명 · 최종 수정일`; 링크 없는 문서명 뒤 `(파일을 찾지 못했습니다)`; `lastModified` null → `-`; 끝 문구 `이 메일은 매뉴얼 대장을 보고 자동으로 보냈습니다.`
- 요약 제목 `[운영부] 매뉴얼 점검 안내 발송 결과 — {label}`; 줄 `안내를 받은 담당자 {notified}명 / 대상 {recipients}명`, `대상 매뉴얼 {manualCount}건`, pending>0 이면 `아직 못 보낸 담당자 {pending}명 — 이번 달 영업일마다 다시 보냅니다.`; 섹션 `담당자 미확인 {n}건`·`파일 연결 안 됨 {n}건`(표 머리 `업무 · 문서명 · 담당자`), 0건이면 섹션 아래 `없음`(지우지 않는다).

- [ ] **Step 1: 실패하는 테스트 작성**
  - 안내: 제목 정확히 `"[운영부] 매뉴얼 점검 안내 — 1·2분기(4~9월)"`; html 이 `"8월 말까지"`·`"<table"` 포함, `"pre-wrap"` 미포함; `https://example.test/doc?a=1&b=2` 링크 → `href="https://example.test/doc?a=1&amp;b=2"`; `http://…` 또는 null → `<a` 없음 + `"(파일을 찾지 못했습니다)"`(null 일 때); 문서명 `<script>` → `&lt;script&gt;`; `lastModified: null` → 셀 `-`; 모든 `<td`·`<th`·`<p` 에 `font-family` 포함(`html.match(/<(td|th|p)\b[^>]*>/g)` 전부 `font-family`).
  - 요약: 제목 정확; `"안내를 받은 담당자 3명 / 대상 4명"`; pending 1 → `"아직 못 보낸 담당자 1명"`, pending 0 → 그 문구 없음; 미확인 0건 → `"담당자 미확인 0건"` 과 `"없음"`; 연결 안 됨 1건 → 그 문서명이 표에 있음.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/manual-review/__tests__/mail.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: 커밋** — `feat(manual-review): 점검 안내·관리자 요약 메일 HTML`

---

### Task 6: 마이그레이션 + 이력 저장소

**Files:**
- Create: `supabase/migrations/20261109_manual_review_reminders.sql`
- Create: `src/features/manual-review/store.ts`
- Test: `src/features/manual-review/__tests__/store.test.ts`

**Interfaces:**
- Produces:
  - `const SUMMARY_KEY_PREFIX = "__summary__:"`; `summaryKey(adminEmail: string): string` → `"__summary__:" + 소문자 메일`
  - `type ReminderStatus = "sent" | "failed" | "dry_run"`
  - `type ReminderRecord = { half_key: string; recipient_key: string; status: ReminderStatus; manual_count: number; message_id: string | null; error: string | null }`
  - `loadSentKeys(db: SupabaseClient, halfKey: string): Promise<Set<string>>` — `status = 'sent'` 행의 `recipient_key`.
  - `saveReminder(db: SupabaseClient, rec: ReminderRecord): Promise<void>` — `upsert({...rec, sent_at, updated_at}, { onConflict: "half_key,recipient_key" })`; `sent_at` 은 status 가 sent 일 때 now, 아니면 null.

테이블(정책 0개, service_role 전용, `20261106_sms_sender_doc_upload_notices.sql` 의 begin/enable rls/revoke/grant/commit/notify 모양):
`half_key text not null check (half_key ~ '^[0-9]{4}-H[12]$')`, `recipient_key text not null`(담당자 메일 또는 `__summary__:` + 관리자 메일 — 머리 주석에 §7 예외임을 적는다), `status text not null check (status in ('sent','failed','dry_run'))`, `manual_count int not null default 0`, `message_id text`, `error text`, `sent_at timestamptz`, `created_at`·`updated_at timestamptz not null default now()`, `primary key (half_key, recipient_key)`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 마이그레이션(주석 제거 후): `enable row level security` 있음; `create policy` 없음; `revoke all on public.manual_review_reminders from public, anon, authenticated`; `grant all on public.manual_review_reminders to service_role`; `primary key (half_key, recipient_key)`; status check 에 세 값.
  - `loadSentKeys` — 체인 목 호출 기록에 `eq("half_key","2026-H1")`·`eq("status","sent")`, 반환 Set 내용; `error` → `rejects.toThrow`.
  - `saveReminder` — `upsert` 인자의 `onConflict === "half_key,recipient_key"`, sent 면 `sent_at` 문자열·failed 면 `sent_at: null`; `error` → throw.
  - `summaryKey("Admin@Example.test") === "__summary__:admin@example.test"`.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/manual-review/__tests__/store.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: SQL·`store.ts` 구현** (적용하지 않는다).
- [ ] **Step 4: 통과 확인** → PASS.
- [ ] **Step 5: 커밋** — `feat(manual-review): 반기 알림 이력 테이블과 저장소`

---

### Task 7: 잡 `manual-review-reminder` + 등록 + 문서

**Files:**
- Create: `src/features/automations/jobs/manual-review-reminder.ts`
- Modify: `src/features/automations/registry.ts` (import 1줄 + 항목 1개, `service-notice-mail` 바로 뒤)
- Modify: `src/features/automations/__tests__/registry.test.ts` (테스트 1개)
- Modify: `CLAUDE.md` 자동화 표 1행, `.env.example` 2줄(`SHAREPOINT_MANUAL_ITEM_ID` 아래)
- Test: `src/features/automations/jobs/__tests__/manual-review-reminder.test.ts`

**Interfaces:**
- Consumes: `fetchManualSource`, `ManualSourceError`, `MANUAL_SOURCE_ENV`, `loadOperatorDirectory`, `resolveLedger`, `parseAdminEmails`, `reviewHalfFor`, `buildReviewPlan`, `buildReviewMail`, `buildSummaryMail`, `loadSentKeys`, `saveReminder`, `summaryKey`, `canSendOn`, `fetchKoreanHolidays`, `sendGraphMail`, `mailErrorCode`, `createAdminClient`.
- Produces: `runManualReviewReminder(now?: Date): Promise<AutomationRunResult>`; registry 항목 `{ id: "manual-review-reminder", label: "매뉴얼 반기 점검 알림", cadence: "monthly", cooldownMinutes: 60, scheduleInfo: "매일 10:00 호출 — 3월·8월 영업일만 발송 (cron-job.org)", run: runManualReviewReminder }`.

순서: ① env(`MANUAL_SOURCE_ENV` + `MANUAL_EDIT_ADMIN_EMAILS` 유효 주소 1개 이상) 없으면 `{ ok:false, message: "환경변수 없음: …" }` ② `reviewHalfFor` null → `{ ok:true, skipped:true, message:"3월·8월이 아님 — 발송 안 함" }` ③ `canSendOn` false → `{ ok:true, skipped:true, message:"주말·공휴일 — 발송 안 함" }` ④ 원천·명부 읽기 → 연결 → 계획 ⑤ `loadSentKeys` ⑥ `sent` 가 아닌 수신자에게 차례로 발송(또는 dry_run) 후 즉시 `saveReminder` ⑦ `sent` 가 아닌 관리자마다 요약(관리자 메일함 → 본인) 후 `saveReminder(summaryKey)` ⑧ 결과. 요약의 `notified` = 이번 반기 sent(기존 + 이번) + 이번 dry_run 인 수신자 수, `pending` = 이번 실패 수. `ManualSourceError` → `{ ok:false, message: e.message }`, 그 밖의 예외 → `console.error` + `"매뉴얼 점검 안내 처리 중 오류가 발생했습니다."`. 결과 `ok = 실패 0`, message 형식 `"{[DRY-RUN] }{label} 담당자 {n}명 — 보냄 {sent} / 실패 {failed} / 이미 보냄 {skipped} · 관리자 요약 {summarySent} · 담당자 미확인 {u}건 · 연결 안 됨 {l}건"`, details `{ recipients, sent, failed, dryRun, skipped, manuals, unresolved, unlinked, summarySent, summaryFailed }`.

- [ ] **Step 1: 실패하는 테스트 작성** — mock: `@/features/manual-ledger/source`(실제 모듈 + `fetchManualSource` 만 vi.fn), `@/features/manual-ledger/operators`, `@/features/manual-review/store`(실제 + `loadSentKeys`·`saveReminder` vi.fn), `@/lib/microsoft/sendmail`, `@/lib/holidays/google-ical`, `@/lib/supabase/admin`. env 는 `vi.stubEnv`(관리자 `adm1@example.test,adm2@example.test`). 원천 fixture: 활성 업무 1개에 담당자A·담당자B 각 1행 + 비활성 1행.
  - `2026-11-09T01:00:00Z` → `skipped: true`, `fetchManualSource` 미호출.
  - `2026-08-01T01:00:00Z`(토) → skipped, 미호출. `2027-03-01T01:00:00Z` + 휴일 `2027-03-01` → skipped.
  - `MANUAL_EDIT_ADMIN_EMAILS=""` → `ok:false`, message 에 `"MANUAL_EDIT_ADMIN_EMAILS"`.
  - `2026-08-03T01:00:00Z` 첫 발송: 담당자 메일 2통 + 요약 2통; 각 호출 `senderUserId === toEmail`; 담당자 제목 `"[운영부] 매뉴얼 점검 안내 — 1·2분기(4~9월)"`; `saveReminder` 가 `{ half_key: "2026-H1", recipient_key: "a@example.test", status: "sent" }` 와 `"__summary__:adm1@example.test"` 로 불림; `ok: true`, `details.sent === 2`, `details.summarySent === 2`.
  - `loadSentKeys` 가 `a@example.test` + 두 요약 키 → 담당자B 에게만 1통, 요약 0통, `details.skipped === 1`.
  - 담당자B 발송이 `{ ok:false, error: "throttled: …" }` → B 기록 `status: "failed", error: "throttled"`, `ok: false`, 요약은 여전히 2통이고 요약 html 에 `"아직 못 보낸 담당자 1명"`.
  - `MAIL_DRY_RUN=true` → `sendGraphMail` 미호출, 기록 `status: "dry_run"`, message 가 `"[DRY-RUN]"` 로 시작.
  - `fetchManualSource` 가 `new ManualSourceError("매뉴얼 대장 읽기 실패 (500)")` → `ok:false`, 그 메시지, 발송 0.
  - 모든 케이스에서 `JSON.stringify({ message, details })` 에 `"@"` 없음.
  - `registry.test.ts`: `getJob("manual-review-reminder")` 의 `cadence === "monthly"`, `localOnly`·`manualOnly` falsy.
- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/automations/jobs/__tests__/manual-review-reminder.test.ts src/features/automations/__tests__/registry.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: 잡 구현 + registry 등록** — 헬퍼(`deliverReminders`, `deliverSummaries`, `summarize`)로 나눠 함수 50줄 이하. registry `description`: 진행 중 업무 매뉴얼을 담당자 본인 메일함에서 본인에게 반기 1회, 관리자 요약 1회, 다른 날은 스킵임을 2~3줄로.
- [ ] **Step 4: 통과 확인** — 같은 명령 → PASS.
- [ ] **Step 5: 문서** — CLAUDE.md 자동화 표의 `sms-sender-request-notify` 행 바로 아래에 `manual-review-reminder` 1행(실행·기능·이력 테이블 `manual_review_reminders`, 필요 env 두 개 언급). `.env.example` 에 `SHAREPOINT_MANUAL_LEDGER_ITEM_ID=`(구성표 xlsx item id — 파일명이 바뀌어도 유지)·`MANUAL_EDIT_ADMIN_EMAILS=`(쉼표 구분) 주석과 함께.
- [ ] **Step 6: 정적 검사** — `npm run typecheck` 0 errors; `npx eslint` 새/수정 ts 파일 0 problems; `npx vitest run src/features/manual-ledger src/features/manual-review src/features/automations/jobs/__tests__/manual-review-reminder.test.ts src/features/automations/__tests__/registry.test.ts --maxWorkers=1` PASS; `git diff HEAD | grep -c $'\xef\xbf\xbd'` = 0.
- [ ] **Step 7: 커밋** — `feat(automations): 매뉴얼 반기 점검 알림 잡`

---

### Task 8: 실파일 읽기 확인 (커밋 없음)

**Files:** 임시 `_diag-manual-parse.test.ts`(레포 루트, 끝나면 삭제·미커밋)

- [ ] **Step 1:** 원래 폴더의 `.env.local` 을 **읽기만** 해 env 를 채운다(`SHAREPOINT_MANUAL_LEDGER_ITEM_ID` 가 없으면 사전 조사 노트의 item id). `fetchManualSource()` + `loadOperatorDirectory(createAdminClient())` + `resolveLedger` + `buildReviewPlan` 실행 — GET·SELECT 만.
- [ ] **Step 2:** scratchpad `manual-parse-check.txt` 에 **건수만**: 대장 행, 진행 중 업무 수, 진행 중 행, 파일 수, 연결/미연결(전체·진행 중), 담당자 매칭/미확인 행, 수신자 수. 이름·메일·URL 금지. 기대(사전 조사): 대장 49 · 진행 중 업무 10 · 진행 중 행 37 · 미연결 0 · 미확인 행 2(진행 중 범위에서는 그 이하).
- [ ] **Step 3:** 진단 파일 삭제, `git status` 에 남지 않음 확인.
