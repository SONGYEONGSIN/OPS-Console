# 현황 최신화 버튼 (PR-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 내부관리자 화면의 `현황 최신화` 버튼 한 번으로 회사 PC 가 Moa 발신번호 목록을 수집해 Teams 에 저장하고, 현황 파일의 `06. Moa 대조`·`07. PIMS 대조` 를 새로 계산해 Excel COM 으로 써 넣은 뒤 검사를 통과했을 때만 If-Match 로 올리며, 무엇이 됐는지 화면 이력에 남긴다.

**Architecture:** 웹은 `sms_status_refresh_requests` 에 pending 1건을 넣고(server action, DB 에서 권한 재확인), 회사 PC 의 5분 폴러(`scripts/sms-status-refresh/poll-local.ps1`)가 `/api/sms-status-refresh/request` 로 claim 해 Python 오케스트레이터 `refresh.py` 를 돌린다. 오케스트레이터는 단계(Step) 목록을 차례로 돌리고 단계마다 구조화된 결과(`StepResult`)를 남기며, 앞 단계 실패가 그 결과에 기대지 않는 뒤 단계를 막지 않는다. 결과 본문은 Python 이 ASCII JSON 으로 만들고 ps1 은 바이트 그대로 POST 한다. 서버는 결과를 저장하고 `recordAutomationRun` 을 부르며, 실패 코드를 사람이 할 일 문구로 바꾸는 것은 서버(`contract.ts`)가 한다.

**Tech Stack:** Next.js App Router(server action·route handler) + TS + zod + Supabase(service_role) + vitest · Python 3.13(`-I`, unittest, openpyxl, oletools, selenium, requests) · PowerShell 5.1(폴러) / pwsh 7(Excel COM) · Microsoft Graph(app-only, Files)

**Spec:** `docs/superpowers/specs/2026-11-06-sms-status-refresh-design.md` — §2 버튼 권한 행, §3 실패로 볼 것, §6.1 전체, §6.2 ②·④ 중 COM 쓰기·restore-vba·verify·If-Match·올린 뒤 확인, §6.3, §7 PR-2 행, §8 '요약 열람 범위'·'첫 실행 기준점(단계별 watermark)'. ① 메일·③ PDF·④ 본체(`_번호`·`_학교`·`_서류`·`00. 요약`)는 범위 밖이다(PR-3·PR-4) — 단, 그 단계가 끼워질 자리(단계 목록·watermark·결과 형식)는 이번에 만든다.

## 나눠 넣기 제안 — PR-2a / PR-2b

PR-2 는 TS 약 25개 + Python/PS 약 20개 파일이다(HARD-GATE '전체 설계'). 한 PR 로는 리뷰가 어렵고, 가장 위험한 부분(현황 파일 쓰기)이 웹·큐 리뷰에 묻힌다. **두 PR 로 나눈다.** 이 문서는 둘을 함께 계획하되 각자 끝에 검증·PR 태스크가 있다.

| PR | 태스크 | 끝나면 되는 것 | DB |
|---|---|---|---|
| **PR-2a** 웹·큐·폴러 뼈대·Moa 수집 | 1~10 | 버튼 → 회사 PC 가 Moa 목록을 `02. Moa 등록 리스트/Moa 등록 리스트_YYMMDD.xlsx` 로 저장 → 이력에 결과 | 마이그레이션 1건(승인 필요) |
| **PR-2b** 06·07 갱신·COM·verify·업로드 | 11~15 | 같은 버튼이 06·07 을 갱신해 올림. 412/423 은 할 일 문구로 | 없음 |

PR-2b 의 단계는 PR-2a 의 단계 목록에 `workbook` 한 줄을 더하는 것으로 끼워진다(Task 14). PR-2b 브랜치는 PR-2a 머지 후 main 에서 새로 판다.

## Global Constraints

- 작업 위치: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-sms-status-refresh-btn`(브랜치 `feat/sms-status-refresh-button`). 원래 폴더 `...\Build\OPS-Console` 은 건드리지 않는다. `node_modules` 는 정션이다 — **지우지 않는다.** `scripts/moa-applyprice/` 는 스테이징하지 않는다. push 는 PR 태스크에서만.
- TDD: 테스트 먼저, 실패 확인, 구현(RED → GREEN).
- vitest 는 **`npm test -- <경로…> --maxWorkers=1`, 관련 파일만**. dev 서버·`next build`·전체 스위트 금지(메모리 부족). `npm run typecheck` 는 태스크 끝에 한 번씩 허용.
- Python 은 **반드시 `-I -X utf8`**: 테스트는 `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -v`(필요하면 `-p test_xxx.py`). `-I` 는 스크립트 폴더를 `sys.path` 에 넣지 않으므로 `refresh.py` 가 자기 폴더와 `scripts/moa-closing` 을 직접 넣는다. stdout 은 UTF-8.
- 구현·테스트 중 **Moa 로그인 금지, Graph 쓰기 호출 금지, Teams 파일·DB 수정 금지.** 실제 호출은 전부 가짜(fake/mock)로 대신한다. 실 실행은 런북 태스크(10·15)에서 컨트롤러가 사용자와 함께만 한다 — Moa 로그인마다 사용자 폰으로 문자가 1통 간다.
- **개인정보:** 코드·주석·테스트 fixture·로그·`automation_runs` 메시지·결과 `summary`/`detail` 에 사람 이름·메일 주소·전화/발신번호를 넣지 않는다. fixture 번호는 `010-0000-0001` 같은 가짜만, 학교는 `테스트대학교A`, 대학 ID 는 `9001` 류, 메일 자리는 메일 모양이 아닌 토큰(`op-a`, `mgr-x`)을 쓴다. 예외 처리에서 `str(e)` 를 결과에 싣지 않는다(셀 값이 섞일 수 있다) — 클래스 이름만.
- **xlsm 을 openpyxl 로 저장하지 않는다.** openpyxl 은 읽기 전용으로만 연다. 쓰기는 Excel COM(`excel_apply.ps1`), 매크로 복원은 zip 파트 교체(`vba.py`)뿐이다.
- **검사(verify) 통과 전에는 올리지 않는다.** 올릴 때는 처음 기록한 eTag 로 `If-Match`.
- supabase-js 는 오류를 던지지 않는다. 모든 쿼리에서 `error` 를 확인한다.
- SQL 원문 대조 테스트는 주석을 먼저 지운다(`request-notify/__tests__/store.test.ts` 의 정규식).
- 불변 패턴, 파일 400줄 미만, 함수 50줄 이하. `any`·`@ts-ignore`·`eslint-disable`·`console.log` 금지. 날짜 표시는 `@/lib/kst-format` 의 `kstFormat`.
- UI: 목록 머리 오른쪽 액션은 `HeaderActionButton` 하나뿐(변형 없음). 색 하드코딩 금지.
- 한글이 든 기존 파일은 Edit 도구로만 고친다. 주석·문구는 한국어.
- 커밋: 한국어 conventional, 끝에 두 줄
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```

## 고정한 결정

1. **요청 상태는 모든 단계가 `ok` 일 때만 `done`**, 하나라도 실패·건너뜀이거나 결과가 없으면 `failed`. 부분 성공도 화면에서 '실패'로 보여 다시 누르게 한다.
2. **동시에 활성(pending/running) 요청은 1건** — enqueue 조회 + DB 부분 유니크 인덱스 두 겹. 두 번 눌러도 1건이다. claim 후 **40분**(`STALE_RUNNING_MS`) 넘게 보고가 없으면 다음 enqueue 가 `failed` 로 마감한다. 작업 스케줄러 실행 제한은 **30분** — 두 값은 테스트로 묶는다.
3. **실패 코드 → 할 일 문구는 서버 한 곳**(`contract.ts` `FAILURE_COPY`). Python 은 코드만 보낸다. 모르는 단계·코드는 400 이 아니라 그대로 저장하고 일반 문구로 보인다(새 폴러가 먼저 배포돼도 결과가 사라지지 않게). Python 코드 목록 ⊆ TS 문구 키는 테스트로 묶는다.
4. **결과 본문은 Python 이 `json.dumps(..., ensure_ascii=True)` 로 쓰고, ps1 은 `[IO.File]::ReadAllBytes` 로 그대로 보낸다.** Windows PowerShell 5.1 의 `ConvertTo-Json`(기본 깊이 2)과 문자열 본문 인코딩(ISO-8859-1)을 둘 다 피한다.
5. **06·07 은 같은 자리에서 지우고 다시 쓴다**(`Cells.Clear()` 후 기존 배치 그대로). 시트를 삭제·재추가하지 않는다 — 위치·시트 범위 이름을 지킨다. 시트가 없으면 `afterSheet` 뒤에 넣는다(첫 실행 호환).
6. **eTag 를 먼저 읽고 그다음 내려받는다.** 순서가 반대면 그 사이 저장된 판의 eTag 로 옛 내용을 덮어쓴다. 올리기 직전에도 eTag 를 다시 보고 다르면 PUT 없이 `changed`.
7. **폴러는 로그온 세션에서만 돈다**(`register-poll-task.ps1` 에 S4U·비밀번호 저장 모드 없음). Excel COM 은 비대화형 세션에서 안정적으로 돌지 않는다.
8. **watermark 칸은 지금 만든다**(단계별 jsonb). PR-2 의 단계는 watermark 를 내지 않지만, ①·③ 이 PR-3·4 에서 마이그레이션 없이 끼워지게 한다. 다음 실행은 claim 응답으로 '키마다 가장 늦은 값'을 받고, 키가 없으면 Python 이 `2026-10-16T15:00:00Z`(= 2026-10-17 00:00 KST, `python -I` 로 계산 확인)부터 본다.
9. **`requested_by` 는 운영자 메일**(경쟁률 점검 큐와 같다). 화면은 `OPERATORS` 로 이름을 찾아 보이고, `automation` 은 '자동화', 못 찾으면 '알 수 없음'.
10. **이력은 모달**(최근 5건). 버튼은 누르기 전에 `window.confirm` 으로 'Moa 인증 문자가 1통 간다'를 묻는다. 진행 상태는 다시 읽을 때 갱신된다(폴링 없음).
11. **화면 캐시 무효화는 결과 보고 때 그 인스턴스만**(`__resetSmsSenderCache` + `revalidatePath`). 다른 서버리스 인스턴스는 모듈 TTL(10분) 안에 따라온다 — 기존 `새로고침` 과 같은 한계.
12. **oletools 가 없으면 verify 실패**(조용히 건너뛰지 않는다). 원본 `moa_compare.py` 는 없으면 검사를 생략했다.

## Review Focus

1. **누가 현황 파일을 열어 둔 채(423) 또는 그 사이 저장한 채(412) 누른 경우** — 아무것도 덮어쓰지 않고, 이력에 "닫고 다시 누르세요"/"다시 누르면 새 파일로" 가 떠야 한다. 내려받기와 eTag 순서가 뒤집히면 조용히 덮어쓴다. → Task 14 `eTag 를 먼저 읽는다`·`423 → locked`·`412 → changed`·`올리기 직전 eTag 가 바뀌면 PUT 없이 changed`, Task 2 문구 테스트
2. **결과 본문이 PowerShell 을 지나며 깨지는 경우**(한글 summary, 깊은 jsonb) — 서버에 잘린 JSON·물음표가 저장된다. → Task 6 `본문 파일은 ASCII 바이트뿐`, Task 9 `ps1 은 결과 파일을 바이트로 보낸다(ConvertFrom-Json 금지)`
3. **Moa 화면이 비었거나(세션 만료·검색 미완료) 열이 바뀐 경우** — 0행·엉뚱한 열의 목록을 저장하면 다음 06 이 전부 '세종만'으로 바뀐다. 저장하지 않고 그 단계만 실패해야 한다. → Task 8 `빈 표는 moa_empty, 저장 안 함`·`수정 열에 값이 있으면 moa_shape_changed`
4. **두 사람이 거의 동시에 누르거나 폴러가 claim 후 죽은 경우** — 활성 요청은 1건이어야 하고, 죽은 running 이 큐를 영영 막으면 안 된다. → Task 1 `활성 1건 부분 유니크 인덱스`, Task 3 `insert 23505 는 진행 중 안내`·`40분 지난 running 은 마감 후 적재`
5. **새 폴러가 서버보다 먼저 모르는 단계·코드를 보내는 경우** — 400 으로 버리면 running 이 40분 동안 큐를 막고 결과가 사라진다. → Task 2 `모르는 단계·코드도 받는다`, Task 4 `모르는 코드여도 저장하고 done/failed 판정`

---

## PR-2a — 웹·큐·폴러 뼈대·Moa 수집

### Task 1: 마이그레이션 + SQL 대조 테스트 (STOP: DB 승인)

**Files:**
- Create: `supabase/migrations/20261107_sms_status_refresh_requests.sql`
- Test: `src/features/sms-sender/status-refresh/__tests__/migration.test.ts`

**Interfaces:**
- Produces: 테이블 `public.sms_status_refresh_requests(id uuid, requested_at timestamptz, requested_by text, status text, claimed_at timestamptz, finished_at timestamptz, message text, result jsonb, watermarks jsonb, created_at timestamptz)`. 읽기·쓰기 모두 service_role 만.

- [ ] **Step 1: 실패하는 대조 테스트 작성** — 원문은 주석을 지우고(`/\/\*[\s\S]*?\*\//g`, `/--.*$/gm`) 공백을 하나로 접은 뒤 대조한다.

```ts
it("테이블과 칸", () => {
  expect(sql).toContain("create table if not exists public.sms_status_refresh_requests");
  for (const col of [
    "id uuid primary key default gen_random_uuid()",
    "requested_at timestamptz not null default now()",
    "requested_by text not null",
    "status text not null default 'pending' check (status in ('pending','running','done','failed'))",
    "claimed_at timestamptz", "finished_at timestamptz", "message text", "result jsonb",
    "watermarks jsonb not null default '{}'::jsonb",
  ]) expect(body).toContain(col);
});
it("활성 1건 부분 유니크 인덱스 + pending 인덱스", () => {
  expect(sql).toMatch(/create unique index if not exists sms_status_refresh_requests_one_active on public\.sms_status_refresh_requests \(\(true\)\) where status in \('pending','running'\)/);
  expect(sql).toMatch(/create index if not exists sms_status_refresh_requests_pending_idx on public\.sms_status_refresh_requests \(requested_at\) where status = 'pending'/);
});
it("직접 읽기 금지 — RLS, 정책 없음, authenticated 회수", () => {
  expect(sql).toContain("alter table public.sms_status_refresh_requests enable row level security");
  expect(sql).toContain("revoke all on public.sms_status_refresh_requests from public, anon, authenticated");
  expect(sql).toContain("grant all on public.sms_status_refresh_requests to service_role");
  expect(sql).not.toMatch(/create policy/i);
});
it("개인정보 칸이 없다", () => expect(body).not.toMatch(/email|phone|name/i));
```

- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/sms-sender/status-refresh/__tests__/migration.test.ts --maxWorkers=1` → 파일 없음 FAIL.
- [ ] **Step 3: 마이그레이션 작성** — `begin; … commit; notify pgrst, 'reload schema';` 형식은 `20261106_sms_sender_doc_upload_notices.sql` 과 같게. 머리 주석에 "버튼 요청 큐(회사 PC 폴러가 claim) · 결과 jsonb 에는 번호가 들어갈 수 있어 service_role 만 · 화면은 requireMenu 뒤 서버가 읽는다(§8)" 를 적는다. 인덱스 이름은 테스트 그대로.
- [ ] **Step 4: 실행해 통과 확인** — 같은 명령 PASS.
- [ ] **Step 5: 커밋** — `feat(sms-sender): 현황 최신화 요청 큐 마이그레이션`
- [ ] **Step 6: STOP — DB 변경 승인.** 컨트롤러가 사용자에게 SQL 을 보여 승인을 받고, **사용자가** Supabase 에 적용한다. 적용 후 service_role 로 `select count(*) from sms_status_refresh_requests` → 0, authenticated 세션 select → 권한 오류(42501) 를 확인한다. 승인 전에는 Task 4 이후 실 DB 를 기대하는 일을 하지 않는다(테스트는 전부 목이라 진행 가능).

### Task 2: 결과 계약 (TS) — 스키마·문구·판정·watermark

**Files:**
- Create: `src/features/sms-sender/status-refresh/contract.ts` (클라이언트에서도 import 하므로 `server-only` 금지)
- Test: `src/features/sms-sender/status-refresh/__tests__/contract.test.ts`

**Interfaces:**
- Produces:
  - `STEP_LABEL: Record<string, string>` = `{ moa: "Moa 수집", workbook: "현황 파일" }` · `stepLabel(id: string): string`(없으면 id 그대로)
  - `FAILURE_COPY: Record<string, string>` — 키: `lease_busy, login_failed, moa_empty, moa_shape_changed, source_missing, source_shape, excel_failed, verify_failed, changed, locked, after_check, dependency_failed, unknown, poller_crashed` · `failureCopy(code: string): string`(없으면 `FAILURE_COPY.unknown`)
  - `stepResultSchema`, `refreshResultSchema`, `completeBodySchema`(zod) 와 타입 `StepResult`, `RefreshResult`, `CompleteBody`
  - `finalStatus(body: CompleteBody): "done" | "failed"`
  - `runMessage(body: CompleteBody): string` — 단계 라벨·성패·코드만
  - `advancedWatermarks(result: RefreshResult): Record<string, string>` · `mergeWatermarks(list: readonly Record<string, string>[]): Record<string, string>`
  - 화면 타입 `RequestStatus = "pending"|"running"|"done"|"failed"`, `RefreshHistoryItem`, `StatusRefreshView`(Task 5 가 채운다):
    ```ts
    type RefreshHistoryItem = { id: string; requestedAt: string; finishedAt: string | null; requester: string;
      status: RequestStatus; steps: { label: string; status: "ok"|"failed"|"skipped"; summary: string; action: string | null }[];
      changes: string[]; note: string | null };
    type StatusRefreshView = { canRequest: boolean; active: { status: "pending"|"running"; requestedAt: string } | null;
      history: RefreshHistoryItem[]; loadError: string | null };
    ```

스키마(정확히):
```ts
stepResultSchema = z.object({
  step: z.string().min(1).max(20),
  status: z.enum(["ok", "failed", "skipped"]),
  summary: z.string().max(300),
  counts: z.record(z.string(), z.number().int()).default({}),
  error: z.object({ code: z.string().min(1).max(40), detail: z.string().max(300).optional() }).nullable(),
  watermark: z.iso.datetime({ offset: true }).nullable().optional(), // zod 4.3 — z.string().datetime 는 폐기 예정
});
refreshResultSchema = z.object({ version: z.literal(1), steps: z.array(stepResultSchema).max(10), changes: z.array(z.string().max(300)).max(200).default([]) });
completeBodySchema = z.object({ id: z.string().uuid(), ok: z.boolean(), message: z.string().max(500).optional(), result: refreshResultSchema.optional() });
```

문구(정확히):
| 코드 | 문구 |
|---|---|
| lease_busy | 다른 Moa 자동화(마감 스크랩·경쟁률 점검)가 로그인 중이라 Moa 수집을 건너뛰었습니다. 몇 분 뒤 다시 누르세요. |
| login_failed | Moa 로그인에 실패했습니다(인증 문자 또는 비밀번호). 관리자에게 알려 주세요. |
| moa_empty | Moa 발신번호 화면이 비어 있어 저장하지 않았습니다. 잠시 뒤 다시 누르세요. |
| moa_shape_changed | Moa 발신번호 화면의 열이 바뀌어 저장하지 않았습니다. 관리자에게 알려 주세요. |
| source_missing | Teams 에서 현황 파일이나 세종·Moa·PIMS 등록 리스트를 찾지 못했습니다. 폴더를 확인하세요. |
| source_shape | Teams 의 등록 리스트 파일 머리글이 예상과 다릅니다. 관리자에게 알려 주세요. |
| excel_failed | 회사 PC 의 Excel 작업이 실패했습니다. 현황 파일은 그대로입니다. 관리자에게 알려 주세요. |
| verify_failed | 검사에서 어긋난 곳이 있어 올리지 않았습니다. 현황 파일은 그대로입니다. 관리자에게 알려 주세요. |
| changed | 그 사이 누가 현황 파일을 저장했습니다. 다시 누르면 새 파일로 처음부터 합니다. |
| locked | 누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요. |
| after_check | 올린 뒤 다시 읽은 행 수가 맞지 않습니다. 관리자에게 알려 주세요. |
| dependency_failed | 앞 단계가 실패해 이 단계를 건너뛰었습니다. |
| unknown | 예상하지 못한 오류입니다. 관리자에게 알려 주세요. |
| poller_crashed | 회사 PC 처리 중 멈췄습니다. 다시 누르고, 또 멈추면 관리자에게 알려 주세요. |

- [ ] **Step 1: 실패하는 테스트 작성** (`ID` 는 버전 니블이 맞는 가짜 v4 uuid `"00000000-0000-4000-8000-000000000001"` — zod 4 의 `uuid()` 는 RFC 형식을 엄격히 본다, `step(id, status, code?, summary?, extra?)` 는 테스트 안 헬퍼)

```ts
it("모든 단계가 ok 여야 done", () => {
  expect(finalStatus({ id: ID, ok: true, result: res([step("moa", "ok"), step("workbook", "ok")]) })).toBe("done");
  expect(finalStatus({ id: ID, ok: false, result: res([step("moa", "failed", "lease_busy"), step("workbook", "ok")]) })).toBe("failed");
  expect(finalStatus({ id: ID, ok: true, result: res([step("moa", "skipped", "dependency_failed")]) })).toBe("failed");
  expect(finalStatus({ id: ID, ok: true, result: res([]) })).toBe("failed");
  expect(finalStatus({ id: ID, ok: false })).toBe("failed");
});
it("모르는 단계·코드도 받는다", () => {
  const body = { id: ID, ok: false, result: { version: 1, changes: [], steps: [{ step: "pdf", status: "failed", summary: "", counts: {}, error: { code: "brand_new" }, watermark: null }] } };
  expect(completeBodySchema.safeParse(body).success).toBe(true);
  expect(failureCopy("brand_new")).toBe(FAILURE_COPY.unknown);
  expect(stepLabel("pdf")).toBe("pdf");
});
it("412·423 은 사람이 할 일로", () => {
  expect(failureCopy("locked")).toBe("누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요.");
  expect(failureCopy("changed")).toBe("그 사이 누가 현황 파일을 저장했습니다. 다시 누르면 새 파일로 처음부터 합니다.");
});
it("실행 메시지는 단계·성패·코드만 — summary·message 원문을 싣지 않는다", () => {
  expect(runMessage({ id: ID, ok: false, result: res([step("moa", "ok", null, "010-0000-0001"), step("workbook", "failed", "locked")]) }))
    .toBe("Moa 수집 성공 · 현황 파일 실패(locked)");
  expect(runMessage({ id: ID, ok: false, message: "exit 1 — Traceback 010-0000-0001" })).toBe("회사 PC 처리 실패 — 결과 없음");
});
it("watermark 는 ok 단계 것만, 키마다 가장 늦은 값", () => {
  expect(advancedWatermarks(res([
    step("mail", "ok", null, "", { watermark: "2026-11-07T01:00:00Z" }),
    step("pdf", "failed", "unknown", "", { watermark: "2026-11-07T02:00:00Z" }),
  ]))).toEqual({ mail: "2026-11-07T01:00:00Z" });
  // 문자열로 비교하면 "+09:00" 쪽이 이긴다 — 실제로는 2026-11-01T15:00Z 라 20:00Z 가 더 늦다.
  expect(mergeWatermarks([{ mail: "2026-11-01T20:00:00Z" }, { mail: "2026-11-02T00:00:00+09:00", pdf: "2026-10-20T00:00:00Z" }, {}]))
    .toEqual({ mail: "2026-11-01T20:00:00Z", pdf: "2026-10-20T00:00:00Z" });
});
it("summary 300자 상한", () => {
  expect(stepResultSchema.safeParse({ ...step("moa", "ok"), summary: "가".repeat(301) }).success).toBe(false);
});
```

- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/sms-sender/status-refresh/__tests__/contract.test.ts --maxWorkers=1`
- [ ] **Step 3: `contract.ts` 구현** — 위 Interfaces 그대로. `runMessage` 는 `${stepLabel} 성공|실패(code)|건너뜀` 을 ` · ` 로 잇고, 결과가 없으면 `회사 PC 처리 실패 — 결과 없음`. `mergeWatermarks` 는 `Date.parse` 가 NaN 인 값은 버린다.
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 현황 최신화 결과 계약과 실패 문구`

### Task 3: 요청 적재 + 권한 + server action

**Files:**
- Create: `src/features/sms-sender/status-refresh/permission.ts` (순수)
- Create: `src/features/sms-sender/status-refresh/enqueue.ts` (`server-only`)
- Create: `src/features/sms-sender/status-refresh/actions.ts` (`"use server"`)
- Test: `__tests__/permission.test.ts`, `__tests__/enqueue.test.ts`, `__tests__/actions.test.ts` (모두 `src/features/sms-sender/status-refresh/` 아래)

**Interfaces:**
- Consumes: `getCurrentOperator()`·`CurrentOperator`(`@/features/auth/queries`), `canViewMenu`(`@/features/auth/permission`), `createAdminClient`
- Produces:
  - `canRequestStatusRefresh(me: Pick<CurrentOperator, "email" | "permission">, managerEmail: string | undefined): boolean` — admin 이거나, `managerEmail` 이 비어 있지 않고 trim·소문자 비교로 `me.email` 과 같을 때
  - `STATUS_REFRESH_AUTOMATION_REQUESTER = "automation"`, `STALE_RUNNING_MS = 40 * 60_000`
  - `enqueueStatusRefresh(requestedBy: string, now?: Date): Promise<{ ok: boolean; message: string }>`
  - `requestStatusRefresh(): Promise<{ ok: true; message: string } | { ok: false; error: string }>`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// permission.test.ts
expect(canRequestStatusRefresh({ email: "op-a", permission: "admin" }, "mgr-x")).toBe(true);
expect(canRequestStatusRefresh({ email: " MGR-X ", permission: "member" }, "mgr-x")).toBe(true);
expect(canRequestStatusRefresh({ email: "op-a", permission: "member" }, "mgr-x")).toBe(false);
expect(canRequestStatusRefresh({ email: "", permission: "member" }, "")).toBe(false); // 빈 값끼리 같다고 보지 않는다
expect(canRequestStatusRefresh({ email: "op-a", permission: null }, undefined)).toBe(false);
```
```ts
// enqueue.test.ts — ratio-audit enqueue.test.ts 의 mockAdmin 체인을 그대로 따른다(테이블명만 다름)
it("활성 요청이 없으면 pending 1건", …insert 가 { requested_by: "op-a", status: "pending" } 로 불림, ok:true, message 에 "인증 문자" 포함);
it("pending/running 이 있으면 적재하지 않는다", …ok:false, message "이미 대기/진행 중인 최신화가 있습니다. 끝나면 다시 누르세요.", insert 0회);
it("40분 지난 running 은 failed 로 마감한 뒤 적재", …update({status:"failed", finished_at, message:"폴러 claim 후 40분 이상 미응답 — 자동 마감"}).eq("id").eq("status","running") 후 insert);
it("39분 running 은 막는다", …);
it("insert 23505(동시에 누름)는 진행 중 안내", …insertError {code:"23505"} → ok:false 같은 문구);
it("조회 오류는 ok:false", …);
```
```ts
// actions.test.ts — getCurrentOperator·enqueueStatusRefresh·next/cache 를 vi.mock, vi.stubEnv("SMS_SENDER_REQUEST_MANAGER_EMAIL", "mgr-x")
it("메뉴 권한이 없으면 거절, 적재 안 함", …);
it("담당자도 admin 도 아니면 거절", …error "현황 최신화는 관리자와 SMS 발신번호 등록 담당자만 할 수 있습니다.");
it("담당자는 본인 메일로 적재", …enqueue 가 "mgr-x" 로 불림, revalidatePath("/dashboard/internal-admin"));
it("admin 은 적재", …);
it("적재 실패 메시지를 그대로 error 로", …);
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/sms-sender/status-refresh/__tests__/permission.test.ts src/features/sms-sender/status-refresh/__tests__/enqueue.test.ts src/features/sms-sender/status-refresh/__tests__/actions.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — enqueue 는 `ratio-audit/audit-requests/enqueue.ts` 의 흐름(조회 → stale 마감 → insert) 그대로, insert 오류 `code === "23505"` 만 진행 중 안내로 바꾼다. 성공 문구: `회사 PC 에 요청했습니다. 5분 안에 시작하고 약 10분 뒤 '최신화 이력'에 결과가 남습니다. Moa 인증 문자가 1통 갑니다.` action 은 `refreshSmsSenderCache` 처럼 `getCurrentOperator` → `canViewMenu("internal-admin", me)` → `canRequestStatusRefresh(me, process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL)` 를 **서버에서** 다시 본다(폼 값은 받지 않는다).
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-sender): 현황 최신화 요청 적재와 권한 재확인`

### Task 4: 폴러 API + 공개 경로 + 자동화 레지스트리 + 폴러 목록

**Files:**
- Create: `src/app/api/sms-status-refresh/request/route.ts`
- Create: `src/features/automations/jobs/sms-status-refresh.ts`
- Modify: `src/proxy.ts` (PUBLIC_PATHS + 머리 주석 한 줄)
- Modify: `src/features/automations/registry.ts` (잡 1건)
- Modify: `src/features/system-status/pollers.ts` (폴러 1건)
- Modify: `CLAUDE.md` (자동화 잡 표 1행)
- Test: `src/app/api/sms-status-refresh/__tests__/request-route.test.ts` · Modify: `src/__tests__/proxy-cron-paths.test.ts`, `src/features/automations/__tests__/registry.test.ts`, `src/features/system-status/__tests__/pollers.test.ts`

**Interfaces:**
- Consumes: Task 2 `completeBodySchema`, `finalStatus`, `runMessage`, `advancedWatermarks`, `mergeWatermarks`; Task 3 `enqueueStatusRefresh`, `STATUS_REFRESH_AUTOMATION_REQUESTER`; `recordAutomationRun`; `__resetSmsSenderCache`(`@/features/sms-sender/queries`); `QUEUED_MARK`(`@/features/automations/run-log-kind`)
- Produces:
  - `GET /api/sms-status-refresh/request` (Bearer CRON_SECRET) → `{ ok: true, request: { id, requested_at, requested_by, watermarks: Record<string,string> } | null }` — 가장 오래된 pending 을 `.eq("status","pending")` 조건부 update 로 claim. `watermarks` 는 `finished_at is not null` 행 최근 50건의 `watermarks` 를 `mergeWatermarks`.
  - `POST` 같은 경로, 본문 `CompleteBody` → 검증 실패 400. 성공 시 `update({ status: finalStatus, finished_at, message: body.message?.slice(0,500) ?? runMessage(body), result: body.result ?? null, watermarks: body.result ? advancedWatermarks(body.result) : {} }).eq("id", id)` → `recordAutomationRun("sms-status-refresh", { ok: status === "done", message: runMessage(body) })` → `__resetSmsSenderCache()` + `revalidatePath("/dashboard/internal-admin")`.
  - 잡 `{ id: "sms-status-refresh", label: "SMS 현황 최신화", cadence: "manual", manualOnly: true, cooldownMinutes: 30, scheduleInfo: "수동 실행 — 회사 PC 폴러가 수행 (cron 미등록)", run: runSmsStatusRefresh }` — run 은 `enqueueStatusRefresh(STATUS_REFRESH_AUTOMATION_REQUESTER)` 결과 message 앞에 `QUEUED_MARK` 를 붙인다(경쟁률 점검과 같은 이유 — 접수가 '성공'으로 보이지 않게).
  - `POLLERS` 항목 `{ id: "sms-status-refresh", label: "SMS 현황 최신화", table: "sms_status_refresh_requests", thresholdMinutes: 20, heartbeatStaleMinutes: 16, hint: "회사 PC의 scripts/sms-status-refresh/poll-local.ps1 등록 상태를 확인하세요 (로그온 세션 필요)" }` — 심박 라우트가 모르는 폴러 id 를 400 으로 거절하므로 필수.

- [ ] **Step 1: 실패하는 테스트 작성** — route 테스트는 `createAdminClient`·`recordAutomationRun`·`__resetSmsSenderCache`·`next/cache` 를 vi.mock.

```ts
it("Bearer 가 틀리면 401", …GET·POST 둘 다);
it("pending 이 없으면 request null", …);
it("claim 은 pending 조건부 update 이고 watermark 를 합쳐 준다", …update({status:"running", claimed_at}) .eq("id").eq("status","pending"); 응답 request.watermarks 가 mergeWatermarks 결과);
it("본문 형식이 틀리면 400, 아무것도 안 고친다", …update 0회);
it("모든 단계 ok → done, 결과·watermark 저장, 실행 기록 ok:true", …recordAutomationRun("sms-status-refresh", { ok: true, message: "Moa 수집 성공" }));
it("결과 없는 실패(폴러가 죽음) → failed, 실행 기록에 tail 을 싣지 않는다", …message 저장은 body.message, 기록은 "회사 PC 처리 실패 — 결과 없음");
it("모르는 코드여도 저장하고 판정한다", …step "pdf"/code "brand_new" → status failed, 200);
it("보고 때 화면 캐시를 비운다", …__resetSmsSenderCache 1회, revalidatePath("/dashboard/internal-admin"));
```
proxy 테스트 `SESSIONLESS_ROUTES` 에 `"/api/sms-status-refresh/request"` 추가. registry 테스트에 `it("sms-status-refresh 는 수동 전용", () => { const j = getJob("sms-status-refresh"); expect(j?.cadence).toBe("manual"); expect(j?.manualOnly).toBe(true); })`. pollers 테스트의 표 목록에 `"sms_status_refresh_requests"` 를 더하고 이름을 `"일곱 개 큐를 모두 본다"` 로.

- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/app/api/sms-status-refresh src/__tests__/proxy-cron-paths.test.ts src/features/automations/__tests__/registry.test.ts src/features/system-status/__tests__/pollers.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 라우트는 `ratio-audit/audit-request/route.ts` 모양(`authorized`, CRON_SECRET 미설정 500)을 따른다. PUBLIC_PATHS 는 정확한 경로 `"/api/sms-status-refresh/request"` 로 넣는다(`/api/sms-status-refresh` 로 뭉뚱그리지 않는다 — 접두사 매칭이라 그 아래 새 라우트가 자동 공개된다). CLAUDE.md 자동화 표에 `sms-status-refresh | 수동 — 내부관리자 '현황 최신화' 버튼 또는 자동화 페이지, 회사 PC 폴러(scripts/sms-status-refresh/poll-local.ps1) | Moa 발신번호 목록 수집 → Teams 저장 (+PR-2b: 06·07 갱신) | sms_status_refresh_requests + automation_runs` 1행.
- [ ] **Step 4: 실행해 통과 확인** + `npm run typecheck` → 0 errors
- [ ] **Step 5: 커밋** — `feat(sms-sender): 현황 최신화 폴러 API·자동화 등록`

### Task 5: 이력 조회 + 버튼·이력 모달 UI

**Files:**
- Create: `src/features/sms-sender/status-refresh/history.ts` (`server-only`)
- Create: `src/app/dashboard/internal-admin/_components/StatusRefreshControls.tsx` (`"use client"`)
- Create: `src/app/dashboard/internal-admin/_components/RefreshHistoryModal.tsx` (`"use client"`)
- Modify: `src/app/dashboard/internal-admin/_components/SourceBar.tsx` (`SourceInfo.refresh?` + 렌더 1줄)
- Modify: `src/app/dashboard/internal-admin/page.tsx` (성공 경로에서 view 를 읽어 `ctx.source.refresh` 로)
- Test: `src/features/sms-sender/status-refresh/__tests__/history.test.ts`, `src/app/dashboard/internal-admin/__tests__/StatusRefreshControls.test.tsx`, `src/app/dashboard/internal-admin/__tests__/RefreshHistoryModal.test.tsx`

**Interfaces:**
- Consumes: Task 2 타입·`failureCopy`·`stepLabel`, Task 3 `canRequestStatusRefresh`·`requestStatusRefresh`, `OPERATORS`(`@/features/auth/operators`), `ModalShell`, `HeaderActionButton`, `kstFormat`
- Produces:
  - `toHistoryItem(row: RequestRow, nameOf: (requestedBy: string) => string): RefreshHistoryItem` (순수, export) — `RequestRow = { id, requested_at, requested_by, status, finished_at, message, result }`. 결과가 없는 failed 는 `note = failureCopy("poller_crashed")`, 실패 단계의 `action = failureCopy(code)`, ok 단계는 `action = null`. `result` 는 `refreshResultSchema.safeParse` — 깨진 jsonb 면 `steps: []`, `note = failureCopy("unknown")`.
  - `requesterName(requestedBy: string): string` — `"automation"` → `자동화`, `OPERATORS` 이메일 일치 → 이름, 그 외 `알 수 없음`
  - `getStatusRefreshView(me: CurrentOperator): Promise<StatusRefreshView>` — admin client 로 `requested_at desc limit 5`. 오류면 `{ canRequest, active: null, history: [], loadError: "최신화 이력을 읽지 못했습니다." }`. `active` = 행들 중 pending/running 인 첫 행.
  - `StatusRefreshControls({ view }: { view: StatusRefreshView })`, `RefreshHistoryModal({ items, loadError, onClose })`
  - 화면 배치: SourceBar 의 라벨 다음, `새로고침` 앞에 `[현황 최신화]`(canRequest 일 때만) `[최신화 이력]`(모두). 진행 중이면 `현황 최신화` 자리에 비활성 `최신화 진행 중`.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// history.test.ts
it("실패 단계는 할 일 문구로", …locked → action "누가 현황 파일을 열어 두었습니다. 닫고 다시 누르세요.", label "현황 파일");
it("결과 없는 실패는 폴러 멈춤 문구", …note === FAILURE_COPY.poller_crashed);
it("깨진 result jsonb 는 단계 없이 일반 문구", …);
it("요청자: automation → 자동화, 모르는 값 → 알 수 없음", …requesterName("automation") === "자동화"; requesterName("op-zz") === "알 수 없음");
it("조회 오류는 빈 이력 + loadError, 버튼 권한은 그대로", …);
it("pending/running 첫 행이 active", …);
```
```tsx
// StatusRefreshControls.test.tsx — requestStatusRefresh 를 vi.mock, window.confirm 을 vi.spyOn
it("권한이 없으면 최신화 버튼 없이 이력 버튼만", …queryByRole("button", { name: "현황 최신화" }) null, getByRole("button", { name: "최신화 이력" }));
it("진행 중이면 '최신화 진행 중' 비활성", …);
it("확인을 취소하면 요청하지 않는다", …confirm 문구에 "인증 문자" 포함, action 0회);
it("확인하면 요청하고 결과 문구를 보인다", …ok → message 표시, ok:false → role=alert 에 error);
it("action 이 던져도 오류 경계로 올리지 않는다", …SourceBar.test.tsx 의 Boundary 패턴, 문구 "요청에 실패했습니다. 잠시 뒤 다시 시도하세요.");
it("버튼 모양은 헤더 액션 표준", …두 버튼 className === HEADER_ACTION_CLASS);
```
```tsx
// RefreshHistoryModal.test.tsx
it("요청 시각(KST)·요청자·상태·단계별 결과", …"2026-11-07T01:02:00Z" → "11.07 10:02" 형식(kstFormat month/day/hour/minute), "실패", "현황 파일", 할 일 문구);
it("바뀐 점 줄을 그대로", …);
it("이력이 없으면 '아직 최신화한 적이 없습니다.'", …);
it("loadError 를 보인다", …);
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/sms-sender/status-refresh/__tests__/history.test.ts src/app/dashboard/internal-admin/__tests__ --maxWorkers=1` (기존 `SourceBar.test.tsx`·`page.test.ts` 는 이 단계에서 아직 통과해야 한다)
- [ ] **Step 3: 구현** — `refresh` 는 SourceInfo 의 **선택** 칸(기존 SourceBar 테스트가 그대로 돈다). `page.tsx` 는 `const refresh = await getStatusRefreshView(me)` 를 성공 경로에서만 부르고, `renderView` 에 넘겨 `ctx.source.refresh` 로 싣는다. `permission === "admin"` 비교를 페이지에 쓰지 않는다(`page.test.ts` 가 금지). 요청 성공 후에는 action 의 `revalidatePath` 로 화면이 다시 읽힌다. 상태 라벨: pending `대기 중`, running `진행 중`, done `완료`, failed `실패`. 단계 상태: `성공`/`실패`/`건너뜀`.
- [ ] **Step 4: 실행해 통과 확인** — 같은 명령 전부 PASS + `npm test -- src/components/common --maxWorkers=1`(레포 전역 표준 가드) + `npm run typecheck`
- [ ] **Step 5: 커밋** — `feat(internal-admin): 현황 최신화 버튼과 이력 모달`

### Task 6: Python 결과 계약 + 오케스트레이터 (`refresh.py`)

**Files:**
- Create: `scripts/sms-status-refresh/contract.py`, `scripts/sms-status-refresh/refresh.py`, `scripts/sms-status-refresh/requirements.txt`
- Test: `scripts/sms-status-refresh/test_contract.py`, `scripts/sms-status-refresh/test_refresh.py`, `src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts`

**Interfaces:**
- Produces (`contract.py`):
  - `SMS_CONSUMER = "sms-status-refresh"`, `FIRST_WATERMARK = "2026-10-16T15:00:00Z"`
  - `FAILURE_CODES = ("lease_busy", "login_failed", "moa_empty", "moa_shape_changed", "source_missing", "source_shape", "excel_failed", "verify_failed", "changed", "locked", "after_check", "dependency_failed", "unknown")` — 한 줄 튜플로 쓴다(드리프트 테스트가 정규식으로 읽는다)
  - `STEP_IDS = ("moa",)` — PR-2b 가 `"workbook"` 을, PR-3·4 가 `"mail"`·`"pdf"` 를 더한다
  - `class StepFailure(Exception): __init__(self, code: str, detail: str = "")` — code 가 FAILURE_CODES 밖이면 `ValueError`
  - `@dataclass(frozen=True) StepResult(step: str, status: str, summary: str, counts: dict[str, int] = {}, error_code: str | None = None, detail: str | None = None, watermark: str | None = None, changes: tuple[str, ...] = ())` + `to_json() -> dict` (`error` = `None` 또는 `{"code", "detail"?}`, summary·detail 300자 자름)
  - `@dataclass(frozen=True) Context(request_id: str, watermarks: dict[str, str], dry_run: bool, work_dir: Path, results: dict[str, StepResult])`
  - `@dataclass(frozen=True) Step(id: str, run: Callable[[Context], StepResult], needs: tuple[str, ...] = ())`
  - `run_steps(steps: Sequence[Step], ctx: Context) -> list[StepResult]` — 차례로 돈다. `needs` 중 하나라도 ok 가 아니면 run 을 부르지 않고 `skipped`/`dependency_failed`. `StepFailure` → `failed`/그 코드. 그 밖의 예외 → `failed`/`unknown`, `detail = type(e).__name__`(메시지 금지). 각 단계 뒤 `ctx` 를 `dataclasses.replace` 로 새로 만든다.
  - `build_body(request_id: str, results: Sequence[StepResult]) -> dict` → `{"id", "ok": all ok and results, "result": {"version": 1, "steps": [...], "changes": [...flatten]}}`
- Produces (`refresh.py`): `REGISTERED: dict[str, Step]`(이 PR 은 `moa` 하나, Task 8 이 등록), `main(argv: list[str]) -> int` — 인자 `--request-id`(필수) `--out`(필수) `--work-dir`(필수) `--watermarks`(선택, 파일, `utf-8-sig` JSON 객체) `--steps`(선택, 쉼표, 기본 `STEP_IDS` 순서 전부; 모르는 id 면 2 반환). env: `SMS_STATUS_REFRESH_DRY_RUN=true` 면 dry_run, `SMS_STATUS_REFRESH_ENV_FILE`(없으면 레포 루트 `.env.local`)을 `load_dotenv(override=False)`. 본문은 `json.dumps(body, ensure_ascii=True)` 로 `--out` 에 쓴다. 본문을 썼으면 0.
  - 파일 첫머리에서 `sys.path.insert(0, 자기 폴더)` 와 `scripts/moa-closing` 을 넣는다(`-I` 대응). Moa·Graph 모듈은 단계 함수 안에서 늦게 import 한다(테스트가 selenium 없이 돈다).
- `requirements.txt`: `selenium>=4.20`, `requests>=2.31`, `python-dotenv>=1.0`, `openpyxl>=3.1`, `oletools>=0.60`

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# test_contract.py
def test_앞_단계가_실패해도_기대지_않는_뒤_단계는_돈다(self):
    seen = []
    a = Step("a", lambda c: (_ for _ in ()).throw(StepFailure("lease_busy")))
    b = Step("b", lambda c: seen.append("b") or StepResult("b", "ok", "끝"))
    r = run_steps([a, b], ctx())
    self.assertEqual([(x.step, x.status, x.error_code) for x in r], [("a", "failed", "lease_busy"), ("b", "ok", None)])
    self.assertEqual(seen, ["b"])
def test_기대는_단계가_실패하면_건너뛴다(self): # needs=("a",) → ("b","skipped","dependency_failed"), run 0회
def test_예상_못한_예외는_클래스_이름만(self):
    r = run_steps([Step("a", lambda c: (_ for _ in ()).throw(ValueError("010-0000-0001")))], ctx())
    self.assertEqual((r[0].error_code, r[0].detail), ("unknown", "ValueError"))
def test_뒤_단계는_앞_결과를_본다(self): # b.run 이 c.results["a"].status == "ok" 를 확인
def test_모르는_코드는_만들_수_없다(self): # StepFailure("nope") → ValueError
def test_본문(self): # build_body: ok False if any failed; changes 평탄화; summary 301자 → 300자
```
```python
# test_refresh.py — REGISTERED 를 가짜 단계로 바꿔치기(unittest.mock.patch.dict)
def test_본문_파일은_ASCII_바이트뿐(self):   # 한글 summary 단계 → out 파일 bytes.isascii() True, json.loads 로 한글 복원
def test_steps_로_고른다(self):             # --steps moa → moa 만
def test_모르는_단계는_2(self):
def test_watermarks_파일은_BOM_이_있어도_읽는다(self):  # utf-8-sig
def test_dry_run_env(self):                 # SMS_STATUS_REFRESH_DRY_RUN=true → ctx.dry_run True
```
```ts
// poller-drift.test.ts — scripts/sms-status-refresh/contract.py 원문을 읽는다
it("Python 실패 코드는 모두 화면 문구가 있다", () => {
  const codes = /FAILURE_CODES = \(([^)]*)\)/.exec(py)![1].match(/"([a-z_]+)"/g)!.map((s) => s.slice(1, -1));
  expect(codes.length).toBeGreaterThan(0);
  expect(codes.filter((c) => !(c in FAILURE_COPY))).toEqual([]);
});
it("Python 단계 id 는 모두 라벨이 있다", …STEP_IDS 각각 STEP_LABEL 에 있음);
```
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -v` → ImportError; `npm test -- src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts --maxWorkers=1` → FAIL
- [ ] **Step 3: 구현** — 위 Interfaces 그대로.
- [ ] **Step 4: 실행해 통과 확인** — 두 명령 PASS
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): 폴러 단계 계약과 오케스트레이터`

### Task 7: Graph 헬퍼 (Python)

**Files:**
- Create: `scripts/sms-status-refresh/graph.py`
- Test: `scripts/sms-status-refresh/test_graph.py` · Modify: `src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts`

**출처:** 지워진 `graph.py` 원문 — `C:\Users\ys1114\.claude\projects\C--Users-ys1114-ClaudeCode-Build-OPS-Console\4762a7cf-41ec-41ad-86a5-78f783b6b7f5\subagents\agent-afa431f5e376cd4c2.jsonl` 70번째 줄(Write tool_use, 앵커 `oauth2/v2.0/token`·`def children(path)`), If-Match 업로드는 같은 폴더 `agent-a37ae779fcb3b71c6.jsonl` 241번째 줄(Bash heredoc, 앵커 `"If-Match": m["eTag"]`·`def after(backup, out_dir)` — `APP_SHEETS` usedRange 확인). 줄 하나만 꺼내 읽는다: `python -I -X utf8 -c "import json,sys;l=open(sys.argv[1],encoding='utf-8').readlines()[int(sys.argv[2])-1];m=json.loads(l)['message'];[print(c['input'].get('content') or c['input'].get('command')) for c in m['content'] if c.get('type')=='tool_use']" <파일> <줄>`. **원문의 하드코딩 `ENV_FILE` 경로와 모듈 import 시점 토큰 발급은 옮기지 않는다.**

**Interfaces:**
- Produces:
  - 상수 `SMS_ROOT = "내부관리자/01. SMS 발신번호 사전등록"`, `LIST_DIR = SMS_ROOT + "/04. 발신번호 등록 리스트"`, `SEJONG_DIR = LIST_DIR + "/01. 세종 등록 리스트"`, `MOA_DIR = LIST_DIR + "/02. Moa 등록 리스트"`, `PIMS_DIR = LIST_DIR + "/03. PIMS 등록 리스트"`, `XLSX`·`XLSM` content-type
  - `@dataclass(frozen=True) DriveItem(id: str, name: str, etag: str, last_modified: str, is_file: bool)`
  - `class GraphError(Exception)` (`.status: int`), `class UploadRejected(Exception)` (`.code: "changed" | "locked"`)
  - `class Graph(drive_id: str, token: str, http=requests)` + `@classmethod from_env() -> Graph`(`AZURE_AD_TENANT_ID`·`AZURE_AD_CLIENT_ID`·`AZURE_AD_CLIENT_SECRET`·`SHAREPOINT_DRIVE_ID`, 없으면 `GraphError(0)`)
    - `children(path: str) -> list[DriveItem]` — `$select=id,name,eTag,lastModifiedDateTime,file,folder`, `@odata.nextLink` 를 끝까지
    - `item(item_id: str) -> DriveItem` · `download(item_id: str) -> bytes`
    - `put_new(folder: str, name: str, data: bytes, content_type: str) -> DriveItem` — `…/root:/{경로}:/content?@microsoft.graph.conflictBehavior=fail`
    - `put_if_match(item_id: str, data: bytes, etag: str, content_type: str) -> DriveItem` — 헤더 `If-Match: etag`, 412 → `UploadRejected("changed")`, 423 → `UploadRejected("locked")`, 그 밖 비 2xx → `GraphError`
    - `used_range_rows(item_id: str, sheet: str) -> int` — `/items/{id}/workbook/worksheets/{시트}/usedRange(valuesOnly=true)?$select=rowCount`
  - 경로는 조각마다 `urllib.parse.quote(seg, safe="")`

- [ ] **Step 1: 실패하는 테스트 작성** — `FakeHttp` 가 (method, url, headers, data) 를 기록하고 정해 둔 응답을 돌려준다.

```python
def test_children_은_다음_쪽까지(self): # nextLink 2쪽 → 3개
def test_경로_조각을_인코딩(self): # "내부관리자/01. SMS…" → '/' 는 그대로, 공백·한글은 %XX
def test_put_new_은_덮어쓰지_않는다(self): # url 에 "conflictBehavior=fail", 409 → GraphError(status=409)
def test_If_Match_로_올린다(self): # headers["If-Match"] == 'etag-1', 200 → 새 DriveItem
def test_412_는_changed_423_은_locked(self):
def test_env_가_없으면_GraphError(self):
```
드리프트 테스트에 `it("현황 폴더 경로가 화면과 같다", …graph.py 의 SMS_ROOT 문자열 === SMS_ROOT_PATH)` 추가.
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p test_graph.py -v`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인** — 위 명령 + `npm test -- src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts --maxWorkers=1`
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): Graph 헬퍼(If-Match·덮어쓰기 금지)`

### Task 8: ② Moa 발신번호 수집 단계 + SMS 소비자 이름

**Files:**
- Create: `scripts/sms-status-refresh/moa_collect.py`
- Modify: `scripts/sms-status-refresh/refresh.py` (`REGISTERED["moa"]`)
- Modify: `src/features/sms-codes/schemas.ts` (`SMS_CONSUMERS` 에 `"sms-status-refresh"`) · `src/features/sms-codes/__tests__/schemas.test.ts` · `CLAUDE.md`('소비자 이름은 … 셋뿐' → 넷)
- Test: `scripts/sms-status-refresh/test_moa_collect.py` · Modify: `poller-drift.test.ts`

**출처:** 지워진 `cmd/003.py` — `agent-aca2cd6ee9f0ad07c.jsonl` 123번째 줄(앵커 `table.tbl.type1`, `driver.execute_script("Search();")` — 1) 빈 조건 검색 부분만 옮긴다. 2) 단일 ID 검색·재진입·버튼 탐색은 옮기지 않는다). xlsx 모양 — `agent-afa431f5e376cd4c2.jsonl` 156번째 줄 `build_moa_xlsx.py`(앵커 `DROP = {"수정"}`). env dict 모양 — `scripts/moa-settlement/discover.py` `main()` 의 `env = {…}`. 상주 세션(`session.py`, 같은 파일 66번째 줄)은 옮기지 않는다.

**Interfaces:**
- Consumes: `contract.Step/StepResult/StepFailure/SMS_CONSUMER`, `graph.Graph/MOA_DIR/XLSX`, `scrape.setup_driver`·`scrape.login_and_2fa`·`scrape.sms_urls`·`scrape.sms_source_label`·`scrape.sms_inbox.LeaseHeldError`
- Produces:
  - `MOA_URL = "https://moa.jinhakapply.com/Message/CallBack"`, `MOA_COLS = ["UnivServiceID", "대학명", "모집시기", "모집년도", "CallBack", "파일", "등록일자", "등록상태"]`
  - `collect_callback_rows(driver) -> tuple[list[str], list[list[str]]]` — 검색 칸 셋(`txtServiceID`·`txtUnivServiceID`·`txtServiceType`)을 비우고 `Search();` → 대기 → 행 JS. **`SetCallBackUpdate` 는 절대 부르지 않는다**(수정 함수).
  - `clean_table(header: list[str], rows: list[list[str]]) -> list[list[str]]` — 머리글의 ` ⇅` 제거, 빈 `수정` 열 제외. `수정` 열에 값이 있거나 남은 머리글 ≠ `MOA_COLS` → `StepFailure("moa_shape_changed")`. 행 0 → `StepFailure("moa_empty")`.
  - `build_moa_xlsx(rows: list[list[str]], extracted_at: datetime) -> bytes` — 시트 이름 `Moa 등록 리스트_YYMMDD`, A1 `추출: YYYY-MM-DD HH:MM Moa 「알림톡 > 발신번호 관리」(/Message/CallBack), N행`(굵게), 2행 `MOA_COLS`(굵게), 3행부터 전부 문자열 + `number_format "@"`, 틀 고정 `A3`, 자동 필터 `A2:H{N+2}`. 새 xlsx 라 openpyxl 저장 허용.
  - `next_moa_name(existing: list[str], today: date) -> str` — `Moa 등록 리스트_{YYMMDD}.xlsx`, 같은 날 있으면 `_2`, `_3` …(가장 큰 번호 + 1)
  - `run_moa_step(ctx: Context, *, login=_login, graph_factory=Graph.from_env, now=_now_kst) -> StepResult` — `_login(env) -> (driver, source)` 는 `setup_driver(tmp, headless)` + `login_and_2fa(driver, WebDriverWait(driver, wait), env)`(env 는 discover.py 모양 + `base_url`·`secret`·`sms_consumer=SMS_CONSUMER`, `HEADLESS_MODE` 기본 true). `LeaseHeldError` → `lease_busy`(폴백 없음 — `prepare_sms_source` 가 이미 그렇게 올린다), 로그인 중 그 밖 예외 → `login_failed`. 드라이버는 `finally` 에서 `quit()`. dry_run 이면 `put_new` 를 부르지 않는다.
  - 결과: `summary = f"Moa {N}행 수집 · {파일명} 저장 (SMS: {우편함|make})"`(dry_run 이면 `저장 안 함(시험 실행)`), `counts = {"rows": N, "services": 고유 UnivServiceID, "univs": 고유 앞 4자리}`

- [ ] **Step 1: 실패하는 테스트 작성** — `FakeDriver` 는 `execute_script` 로 받은 스크립트를 기록하고 정해 둔 `[header, rows]` 를 돌려준다. fixture 행: `["9001001", "테스트대학교A", "수시", "2027", "010-0000-0001", "", "2026-10-01", "등록완료"]` 류.

```python
def test_빈_조건_Search_만_부르고_수정_함수는_안_부른다(self):
    collect_callback_rows(drv)
    joined = "\n".join(drv.scripts)
    self.assertIn("Search();", joined); self.assertNotIn("SetCallBackUpdate", joined)
def test_머리글_정리와_빈_수정_열_제외(self):
def test_수정_열에_값이_있으면_moa_shape_changed(self):
def test_열이_바뀌면_moa_shape_changed(self):
def test_빈_표는_moa_empty_저장_안_함(self):   # run_moa_step: login 가짜가 빈 표 드라이버 → failed/moa_empty, graph.put_new 0회
def test_xlsx_모양(self):  # openpyxl 로 다시 읽어 A1 에 "2026-11-07", 2행 == MOA_COLS, 데이터 칸 전부 str·"@", 시트 이름 "Moa 등록 리스트_261107", freeze "A3"
def test_같은_날_두_번째는__2(self):  # [] → "_261107.xlsx"; ["Moa 등록 리스트_261107.xlsx"] → "_261107_2.xlsx"; ["…_261107_2.xlsx", "…_261107.xlsx"] → "_261107_3.xlsx"; ["…_261104.xlsx"] → "_261107.xlsx"
def test_리스_점유는_lease_busy(self):    # login 가짜가 LeaseHeldError → failed/lease_busy
def test_로그인_실패는_login_failed(self):
def test_dry_run_은_올리지_않는다(self):
def test_결과에_번호를_싣지_않는다(self):  # summary·counts 직렬화 문자열에 "010-0000" 없음
def test_드라이버는_항상_닫는다(self):    # 수집 중 예외여도 quit 1회
```
드리프트 테스트에 `it("Python 소비자 이름이 서버 enum 에 있다", …contract.py 의 SMS_CONSUMER 가 SMS_CONSUMERS 에 포함)`, schemas 테스트 기대 목록에 `"sms-status-refresh"` 추가(이름 `"소비자 넷 — 마감·경쟁률·정산 탐색·현황 최신화"`).
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p test_moa_collect.py -v` + `npm test -- src/features/sms-codes src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — `REGISTERED["moa"] = Step("moa", run_moa_step)`(needs 없음).
- [ ] **Step 4: 실행해 통과 확인** — Python 전체 discover + 위 npm 명령
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): Moa 발신번호 수집 단계`

### Task 9: 회사 PC 폴러(ps1) + 작업 등록 + 실행 제한 대조

**Files:**
- Create: `scripts/sms-status-refresh/poll-local.ps1`, `scripts/sms-status-refresh/register-poll-task.ps1`
- Modify: `.gitignore` (`scripts/sms-status-refresh/poll-local.log`)
- Test: `scripts/sms-status-refresh/test_ps_static.py`, `src/features/sms-sender/status-refresh/__tests__/stale-vs-limit.test.ts`

**Interfaces:**
- Consumes: Task 4 API, Task 6 `refresh.py` 인자, `scripts/lib/Heartbeat.ps1`
- Produces:
  - `poll-local.ps1` 흐름(`scripts/moa-ratio/poll-local.ps1` 골격): `.env.local` 의 `CRON_SECRET`·`OPS_CONSOLE_BASE_URL` → `Send-PollerHeartbeat -PollerId "sms-status-refresh"` → `GET /api/sms-status-refresh/request` → 없으면 exit 0 → 작업 폴더 `$env:TEMP\sms-status-refresh\<id>` → `$claim.request.watermarks | ConvertTo-Json -Compress` 를 `watermarks.json`(평평한 객체라 깊이 문제 없음) → `python -I -X utf8 -u scripts\sms-status-refresh\refresh.py --request-id <id> --work-dir <폴더> --watermarks <폴더>\watermarks.json --out <폴더>\body.json` 를 한 줄씩 로그에 쓰며 실행(실행 구간만 `$ErrorActionPreference = "Continue"`) → exit 0 이고 `body.json` 이 있으면 **`[IO.File]::ReadAllBytes`** 로 POST(`Content-Type: application/json; charset=utf-8`) → 아니면 `{ id; ok = $false; message = "exit N — 마지막 3줄(300자)" }` POST → POST 가 2xx 가 아니면 같은 최소 본문으로 한 번 더 → 작업 폴더 삭제(`SMS_STATUS_REFRESH_KEEP_WORK=true` 면 남김). 결과 파일을 `ConvertFrom-Json` 하지 않는다.
  - `register-poll-task.ps1`: 작업 이름 `OPS-Console-Sms-Status-Refresh-Poll`, 5분 반복(TimeTrigger, `-Once -At (Get-Date) -RepetitionInterval 5분 -RepetitionDuration 3650일`), `-MultipleInstances IgnoreNew`, **`-ExecutionTimeLimit (New-TimeSpan -Minutes 30)`**, 로그온 세션만(인자 없음, S4U·비밀번호 저장 분기 없음 — Excel COM). 설명 주석에 "Excel 이 깔린 이 PC, 로그온 상태에서만".

- [ ] **Step 1: 실패하는 테스트 작성**

```python
# test_ps_static.py — 원문 대조(주석 줄 '#' 로 시작하는 줄을 지운 뒤)
def test_결과_파일을_바이트로_보낸다(self):
    self.assertIn("[IO.File]::ReadAllBytes(", poll); self.assertNotRegex(poll, r"body\.json[^\n]*ConvertFrom-Json")
def test_경로_심박_인터프리터(self):  # "/api/sms-status-refresh/request", '-PollerId "sms-status-refresh"', "python -I -X utf8 -u"
def test_실행_제한_30분_로그온_세션만(self):  # "-ExecutionTimeLimit (New-TimeSpan -Minutes 30)", "IgnoreNew", "S4U" 없음
```
```ts
// stale-vs-limit.test.ts — ratio-audit stale-vs-timeout.test.ts 와 같은 이유
it("죽었다고 보는 시간이 실행 제한보다 길다", () => {
  const m = /-ExecutionTimeLimit \(New-TimeSpan -Minutes (\d+)\)/.exec(script)!;
  expect(STALE_RUNNING_MS / 60_000).toBeGreaterThan(Number(m[1]));
});
it("실행 제한은 정상 소요(약 10분)의 두 배 이상", …Number(m[1]) >= 20);
```
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p test_ps_static.py -v` + `npm test -- src/features/sms-sender/status-refresh/__tests__/stale-vs-limit.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인** + `powershell -NoProfile -Command "$null = [scriptblock]::Create((Get-Content -Raw scripts/sms-status-refresh/poll-local.ps1))"` 로 구문만 확인(실행하지 않는다)
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): 회사 PC 폴러와 작업 등록`

### Task 10: PR-2a 검증 · 사전 시험 실행 · PR · 실운영 런북

- [ ] **Step 1: 관련 테스트 전부** — `npm test -- src/features/sms-sender src/features/sms-codes src/app/api/sms-status-refresh src/app/dashboard/internal-admin src/__tests__/proxy-cron-paths.test.ts src/features/automations/__tests__/registry.test.ts src/features/system-status --maxWorkers=1` → 0 failures · `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -v` → OK · `npm run typecheck` → 0 · `npm run lint -- src/features/sms-sender src/app/api/sms-status-refresh src/app/dashboard/internal-admin` → 0
- [ ] **Step 2: 개인정보 스캔** — `git diff main...HEAD` 에서 `010-[1-9]`, `@[a-z0-9.-]+\.(com|kr|net)`, 실제 학교·사람 이름이 없는지 grep. 있으면 고친다.
- [ ] **Step 3: STOP — 사전 시험 실행(컨트롤러 + 사용자, 문자 1통).** 사용자에게 "Moa 로그인 인증 문자가 1통 갑니다"를 알리고 승인을 받은 뒤, 워크트리에서:
  ```
  $env:SMS_STATUS_REFRESH_ENV_FILE = "C:\Users\ys1114\ClaudeCode\Build\OPS-Console\.env.local"
  $env:SMS_STATUS_REFRESH_DRY_RUN = "true"
  python -I -X utf8 -u scripts\sms-status-refresh\refresh.py --request-id local-smoke --steps moa --work-dir <scratchpad>\srr --out <scratchpad>\srr\body.json
  ```
  기대: exit 0, body 의 moa 단계 `ok`, `counts.rows` 가 수백 단위, summary 에 `저장 안 함(시험 실행)` 과 `(SMS: 우편함)`. Teams 에 파일이 생기지 않았는지 Graph 읽기로 확인. 마감·경쟁률 점검 폴러가 도는 중이면(409) `lease_busy` 가 정상 — 몇 분 뒤 다시.
- [ ] **Step 4: PR** — 제목 `feat: SMS 현황 최신화 버튼 — 요청 큐·폴러·Moa 수집 (PR-2a)`, 본문 `## Summary` + `## Test plan`(위 명령·결과 수치) + 머지 전 DB 적용 확인(Task 1 Step 6) + 머지 후 런북 링크. 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)` 와 세션 URL.
- [ ] **Step 5: 머지·배포 후 실운영 런북(컨트롤러 + 사용자, 문자 1통)**
  1. 사용자가 원래 폴더에서 `git pull`(작업 스케줄러는 워킹트리를 실행한다) — 브랜치 작업 흔적이 남지 않게 main 체크아웃 상태 확인.
  2. 원래 폴더에서 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\sms-status-refresh\register-poll-task.ps1`(로그온 상태) → `Get-ScheduledTask OPS-Console-Sms-Status-Refresh-Poll | Get-ScheduledTaskInfo` 의 `NextRunTime` 이 비어 있지 않은지(설정 ≠ 동작).
  3. 담당자 또는 admin 이 화면에서 `현황 최신화` → 확인 → '대기 중'. 다른 운영자 계정에는 버튼이 없고 이력 버튼만 있는지.
  4. 5분 안에 `poll-local.log` 에 claim 줄, 사용자 폰 문자 1통, 끝에 완료 보고 줄.
  5. Teams `02. Moa 등록 리스트` 에 `Moa 등록 리스트_YYMMDD.xlsx` 생성, 이력 모달에 'Moa 수집 성공', `automation_runs` 에 `sms-status-refresh` 행(메시지에 번호 없음), 시스템 상태 화면에 폴러 심박.

---

## PR-2b — 06·07 갱신 · COM 쓰기 · verify · If-Match 업로드

PR-2a 머지 후 main 에서 `feat/sms-status-refresh-workbook` 를 판다(워크트리 규칙 동일). DB 변경 없음.

### Task 11: 06·07 대조 계산 이식 (`compare.py`)

**Files:**
- Create: `scripts/sms-status-refresh/compare.py`
- Test: `scripts/sms-status-refresh/test_compare.py`, `scripts/sms-status-refresh/fixtures.py`(테스트용 xlsx 바이트 생성 헬퍼)

**출처:** `C:\Users\ys1114\ClaudeCode\report\SMS 발신번호 사전등록\moa_compare.py`(git 밖) 1~375행 — `digits`·`text`·`ymd`·`join_unique`·`load_moa`·`exclusion_reason`·`load_sejong`·`range_numbers`·`moa_status`·`build_rows`·`load_pims`·`status_text`·`build_pims_rows` 와 `cmd_build`·`cmd_build_pims` 의 데이터 dict 조립. 규칙(키 = 번호 숫자만, 대학 보조 키 = ID 4자리, 분류 순서, 열, 요약 행, `MIN_DIGITS = 8`)은 **바꾸지 않는다.** 바꾸는 것: 경로 대신 바이트를 받는다, `SystemExit` 대신 `StepFailure("source_shape")`, print 를 없앤다.

**Interfaces:**
- Consumes: `graph.DriveItem`, `contract.StepFailure`
- Produces:
  - `pick_latest_dated(items: Sequence[DriveItem]) -> DriveItem | None` — 파일만, `~$` 제외, 이름 끝 `(\d{6})(?:_(\d+))?\.xlsx$`. (날짜, 접미 번호, last_modified) 가장 큰 것. 세종 이름이 `발번 리스트261002`·`발번리스트_261015` 로 섞여 있어 날짜 6자리만 본다.
  - `pick_latest_workbook(items: Sequence[DriveItem]) -> DriveItem | None` — TS `pickLatestWorkbook` 과 같은 규칙(`_(\d{6})\.xlsm$`, `~$` 제외, 날짜 내림차순 → last_modified 내림차순)
  - `load_moa(data: bytes) -> tuple[list[dict], str]` · `load_sejong(data: bytes) -> tuple[list[dict], list[dict]]` · `load_pims(data: bytes) -> list[dict]`
  - `build_moa_sheet(moa, sej_valid, sej_excl, sejong_label: str, extracted: str) -> dict` · `build_pims_sheet(pims, sej_valid, sej_excl, sejong_label: str, pims_label: str) -> dict` — 원본 JSON 과 같은 키(`sheet, afterSheet, title, guide, summary, summaryNote, headerRow, firstDataRow, header, textColumns, rows, counts`) + 두 시트 모두 `order`·`other` 를 명시
  - `result_counts(rows: Sequence[Sequence], order: Sequence[str]) -> dict[str, int]`(결과 열 = 둘째 칸) · `delta_line(sheet: str, before: dict[str, int], after: dict[str, int], order: Sequence[str]) -> str` — `06. Moa 대조: Moa만 52→50 · 세종만 234→230 · 양쪽 349→351 · 대조 제외 11→11`(건수만)

- [ ] **Step 1: 실패하는 테스트 작성** — `fixtures.make_xlsx(rows: list[list]) -> bytes`(openpyxl 새 파일, 테스트 전용). 세종 fixture 머리글 `["Univ", "대학명", "번호", "비고", "등록일자"]`, 번호 `010-0000-0001`(유효), `02-0000-0001~0003`(범위), `""`(빈칸), `대표번호`(글자). Moa fixture 는 Task 8 `build_moa_xlsx` 로 만든다(왕복 검증).

```python
def test_Moa_목록은_수집_단계가_만든_파일을_그대로_읽는다(self):  # build_moa_xlsx → load_moa: 행 수·extracted 날짜
def test_분류_순서와_건수(self):  # 양쪽/세종만/Moa만/대조 제외 순, counts 합: 양쪽+세종만 == 세종 고유, 양쪽+Moa만 == Moa 고유
def test_하이픈이_달라도_같은_번호(self):  # "01000000001" vs "010-0000-0001" → 양쪽
def test_대학_ID_다름_비고(self):
def test_대조_제외_사유(self):  # 범위·빈칸·글자 → 사유 문구 원본 그대로
def test_PIMS_등록대기_등록불가_비고(self):
def test_머리글이_다르면_source_shape(self):
def test_최신_파일_고르기(self):
    names = ["진학어플라이 발번 리스트261002.xlsx", "진학어플라이 발번리스트_261015.xlsx", "~$진학어플라이 발번리스트_261020.xlsx", "메모.txt"]
    # → "_261015"; Moa: ["…_261104.xlsx", "…_261107.xlsx", "…_261107_2.xlsx"] → "_261107_2"
def test_현황_파일_고르기는_화면과_같다(self):  # "_261015.xlsm" vs "_261017.xlsm" → 261017; 날짜 같으면 last_modified 늦은 것; 날짜 없는 xlsm 은 제외
def test_바뀐_점은_건수만(self):  # delta_line 문자열에 번호·학교명 없음
```
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p test_compare.py -v`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): 06·07 대조 계산 이식`

### Task 12: Excel COM 쓰기 (`excel_apply.ps1`)

**Files:**
- Create: `scripts/sms-status-refresh/excel_apply.ps1`
- Modify: `scripts/sms-status-refresh/test_ps_static.py`

**출처:** `C:\Users\ys1114\ClaudeCode\report\SMS 발신번호 사전등록\moa_compare_apply.ps1` 전체(187행) — 열 정의 `$colSpec`, `Set-RangeValue2`(InvokeMember), 03 시트에서 서식 읽기, 요약·헤더·본문·필터·틀 고정, 자기 EXCEL PID 만 정리.

**Interfaces:**
- Produces: `pwsh -NoProfile -ExecutionPolicy Bypass -File excel_apply.ps1 -Workbook <xlsm> -Data <json> -PidFile <txt>` — `-Data` 는 `{ "sheets": [<build_moa_sheet>, <build_pims_sheet>] }`. 한 Excel 세션에서 시트마다:
  - 있으면 **같은 자리에서** `$ws.AutoFilterMode = $false; $ws.Cells.Clear(); $ws.Rows.RowHeight = $ws.StandardHeight` 후 원본과 같은 배치로 쓴다. 없으면 `afterSheet` 뒤에 추가.
  - **시트를 삭제하지 않는다**(`.Delete(` 금지). 다른 시트를 건드리지 않는다.
  - 원본에서 바꾸는 것: "이미 같은 이름의 시트가 있으면 멈춤" 분기를 위 교체로, 데이터 JSON 을 시트 배열로, Excel 을 띄운 직후 자기 PID 를 `-PidFile` 에 쓴다(Python 이 시간 초과 때 그 PID 만 죽인다 — COM 으로 뜬 Excel 은 pwsh 의 자식이 아니다).
  - 저장은 끝에 한 번 `$wb.Save()`, 출력 `applied: <시트>=<행 수>; …`. 실패면 저장 없이 닫고 throw(exit ≠ 0).

- [ ] **Step 1: 실패하는 정적 테스트 추가**

```python
def test_COM_안전_설정(self):  # "AutomationSecurity = 3", "DisplayAlerts = $false", "EnableEvents = $false"
def test_시트를_지우지_않고_같은_자리에서_비운다(self):  # ".Delete(" 없음, "Cells.Clear()" 있음, "AutoFilterMode = $false" 있음
def test_자기_PID_를_남긴다(self):  # "PidFile" 파라미터, Set-Content/Out-File 로 PID 기록
def test_저장은_한_번(self):  # "$wb.Save()" 1회, "SaveAs" 없음
```
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p test_ps_static.py -v`
- [ ] **Step 3: 구현** — 실제 실행 검증은 Task 15 Step 3(실 파일 사본) 에서 한다. 이 태스크에서는 Excel 을 띄우지 않는다.
- [ ] **Step 4: 실행해 통과 확인** + `pwsh -NoProfile -Command "$null = [scriptblock]::Create((Get-Content -Raw scripts/sms-status-refresh/excel_apply.ps1))"` 구문 확인
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): 06·07 을 같은 자리에서 다시 쓰는 Excel COM 스크립트`

### Task 13: 매크로 복원 + 검사 이식 (`vba.py`, `verify.py`)

**Files:**
- Create: `scripts/sms-status-refresh/vba.py`, `scripts/sms-status-refresh/verify.py`
- Test: `scripts/sms-status-refresh/test_vba.py`, `scripts/sms-status-refresh/test_verify.py`

**출처:** `moa_compare.py` 379~553행 — `cell_repr`·`sheet_cells`·`vba_info`·`vba_sources`·`cmd_restore_vba`·`raw_defined_names`·`names_of`·`sheet_meta`·`cmd_verify`.

**Interfaces:**
- Produces (`vba.py`):
  - `vba_part(path: Path) -> tuple[str, bytes] | None`
  - `restore_vba(before: Path, after: Path) -> tuple[int, int]` — `after` zip 의 `vbaProject.bin` 만 `before` 의 원본 바이트로 바꿔 같은 폴더 임시 파일에 쓰고 `shutil.move`. 다른 파트는 바이트·압축 방식 그대로. `after` 에 파트가 없으면 `StepFailure("verify_failed", "작업 사본에 매크로 파트 없음")`.
  - `vba_module_hashes(path: Path) -> dict[str, str]` — oletools 로 모듈 이름 → 소스 sha256. **ImportError 를 삼키지 않는다.**
- Produces (`verify.py`):
  - `@dataclass(frozen=True) Check(label: str, ok: bool, detail: str = "")` — detail 은 건수·시트 이름만
  - `verify_workbook(before: Path, after: Path, sheets: Sequence[dict], *, module_hashes: Callable[[Path], dict[str, str]] = vba_module_hashes) -> list[Check]` — openpyxl `load_workbook(..., keep_vba=True)` **읽기만**. 검사:
    1. 시트 목록(이름·숨김·순서): 대상 시트가 원본에 있었으면 원본과 **같아야** 하고, 없었으면 원본 + `afterSheet` 뒤 삽입
    2. `vbaProject.bin` 존재 · 3. 바이트 sha256 동일(복원 후) · 4. VBA 모듈 소스 동일
    5. `names_of` 동일 · 6. workbook.xml 이름 정의: 차이는 대상 시트 범위의 `_xlnm._FilterDatabase` 뿐
    7. 대상 외 시트 셀(값·수식 문자열) 불일치 0 · 8. 대상 외 시트 틀 고정·병합·조건부 서식·유효성 수 동일
    9. 대상 시트마다: 헤더(8행) · 데이터 = 생성 데이터(셀 단위) · 발신번호 칸 전부 텍스트 · 수식 0 · `양쪽+세종만 = 세종 고유` · `양쪽+{other}만 = {other} 고유` · 분류 건수 = 생성 데이터 · 틀 고정 `A9` · 자동 필터 `A8:`
  - `failed_labels(checks: Sequence[Check]) -> list[str]`

- [ ] **Step 1: 실패하는 테스트 작성** — fixture: `fixtures.make_xlsm_like(sheets: dict[str, list[list]], vba: bytes) -> bytes`(openpyxl 로 xlsx 를 만들고 zip 에 `xl/vbaProject.bin` 파트를 끼운 **테스트 전용** 파일; Excel 이 열 수 있을 필요는 없다). `module_hashes` 는 가짜를 주입.

```python
# test_vba.py
def test_원본_바이트로_되돌리고_다른_파트는_그대로(self):  # after 의 vba 를 b"short" 로 바꾼 뒤 restore → b"original…", 다른 파트 바이트 동일
def test_매크로_파트가_없으면_verify_failed(self):
def test_oletools_없음을_숨기지_않는다(self):  # builtins.__import__ 패치로 ImportError → vba_module_hashes 가 ImportError 를 올린다
# test_verify.py
def test_06_07_교체는_시트_목록이_그대로여야(self):  # 대상 시트를 바꾼 사본 → 전부 ok
def test_대상_외_시트_셀이_하나라도_다르면_실패(self):  # "_학교" 한 칸 변경 → 해당 Check ok False, detail 에 셀 값 없음
def test_생성_데이터와_다르면_실패(self):
def test_발신번호가_숫자면_실패(self):
def test_모듈_소스가_다르면_실패(self):  # 가짜 module_hashes 가 다른 dict
def test_실패_라벨에_값이_없다(self):  # failed_labels·detail 직렬화에 "010-0000" 없음
```
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p "test_v*.py" -v`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): 매크로 바이트 복원과 업로드 전 검사`

### Task 14: ④ 현황 파일 단계 (`workbook_step.py`) — 06·07 · 검사 · If-Match · 올린 뒤 확인

**Files:**
- Create: `scripts/sms-status-refresh/workbook_step.py`
- Modify: `scripts/sms-status-refresh/contract.py` (`STEP_IDS = ("moa", "workbook")`), `scripts/sms-status-refresh/refresh.py` (`REGISTERED["workbook"]`)
- Test: `scripts/sms-status-refresh/test_workbook_step.py` · Modify: `scripts/sms-status-refresh/test_ps_static.py`(xlsm 재저장 금지 대조)

**Interfaces:**
- Consumes: Task 7 `Graph`·`UploadRejected`·폴더 상수, Task 11 전부, Task 12 스크립트, Task 13 `restore_vba`·`verify_workbook`·`failed_labels`
- Produces:
  - `APP_SHEETS = ("_학교", "_서류", "_번호", "_확인")`, `TARGETS = ("06. Moa 대조", "07. PIMS 대조")`
  - `apply_excel(workbook: Path, data: Path, pid_file: Path, timeout_s: int = 900) -> None` — `shutil.which("pwsh")` 없으면 `StepFailure("excel_failed", "pwsh 없음")`. 비 0 종료 → `excel_failed`(detail = 마지막 줄의 `FAILED at line N` 만). 시간 초과 → pwsh 를 죽이고 `pid_file` 의 PID 를 `taskkill /F /PID` 로 정리 → `excel_failed`.
  - `run_workbook_step(ctx: Context, *, graph_factory=Graph.from_env, apply=apply_excel, restore=restore_vba, verify=verify_workbook, sleep=time.sleep) -> StepResult` — 순서(고정):
    1. `children(SMS_ROOT)` → `pick_latest_workbook` → 없으면 `source_missing`
    2. **`item(id)` 로 eTag 를 먼저 기록**, 그다음 `download(id)` → `before.xlsm`, 같은 바이트로 `work.xlsm`. `APP_SHEETS` 의 `used_range_rows` 를 기록.
    3. 세종·Moa·PIMS 폴더 각각 `pick_latest_dated` → 없으면 `source_missing` → 내려받아 `build_moa_sheet`·`build_pims_sheet` → `data.json`(`{"sheets": [...]}`, `ensure_ascii=False`, 작업 폴더 안에만)
    4. 기존 06·07 의 결과 건수를 `before.xlsm` 에서 읽어 둔다(바뀐 점용; 시트가 없으면 빈 dict)
    5. `apply(work, data.json, pid)` → `restore(before, work)` → `checks = verify(before, work, sheets)`. **하나라도 실패면 `verify_failed`(detail = `"{실패수}/{전체} 실패: " + 라벨들`), 올리지 않는다.**
    6. dry_run → `ok`, summary `06·07 갱신 · 검사 {n}/{n} 통과 · 올리지 않음(시험 실행)`
    7. **올리기 직전 `item(id).etag` 재확인** — 다르면 PUT 없이 `changed`. 같으면 `put_if_match(id, work 바이트, etag, XLSM)`; `UploadRejected` → 그 코드.
    8. 올린 뒤 확인: `APP_SHEETS` 행 수가 2 와 같고, 06·07 행 수가 `firstDataRow - 1 + len(rows)` 인지. 다르면 10초 쉬고 최대 3번 → 그래도 다르면 `after_check`.
    9. `ok`, summary `06·07 갱신 · 검사 {n}/{n} 통과 · 업로드 완료 (세종 {파일명} · Moa {파일명} · PIMS {파일명})` — `ctx.results.get("moa")` 가 ok 가 아니면 ` · Moa 는 지난 자료` 를 덧붙인다. `counts = {"moa_both", "moa_sejong_only", "moa_only", "moa_excluded", "pims_both", "pims_sejong_only", "pims_only", "pims_excluded", "checks", "uploaded"}`, `changes = (delta_line(06…), delta_line(07…))`.
  - `Step("workbook", run_workbook_step)` — **needs 없음**(②가 실패해도 Teams 의 그 시점 최신 Moa 목록으로 돈다, §6.2).
  - PR-3 이 이 단계 앞에 `_번호`·`_학교`·`_서류`·`00. 요약` 갱신을 같은 COM 세션에 더하게 되므로, 3~5 를 `build_sheet_payloads(...) -> list[dict]` 로 분리해 둔다(지금은 06·07 둘만 돌려준다).

- [ ] **Step 1: 실패하는 테스트 작성** — `FakeGraph` 는 호출 순서를 기록하고 폴더별 `children`·`download` 바이트(Task 11 fixture)·`item` eTag 순열·`put_if_match` 응답/예외·`used_range_rows` 값을 정해 둔다. `apply`·`restore` 는 no-op, `verify` 는 정해 둔 `Check` 목록.

```python
def test_eTag_를_먼저_읽는다(self):  # calls 에서 ("item", wb) 가 ("download", wb) 보다 앞
def test_검사가_하나라도_실패하면_올리지_않는다(self):  # verify → [Check("a", True), Check("b", False)] → failed/verify_failed, put_if_match 0회, detail "1/2 실패: b"
def test_올리기_직전_eTag_가_바뀌면_PUT_없이_changed(self):  # item 이 "e1" 다음 "e2"
def test_423_은_locked_412_는_changed(self):
def test_If_Match_는_처음_기록한_eTag(self):
def test_dry_run_은_올리지_않는다(self):
def test_올린_뒤_행_수가_다르면_after_check(self):  # sleep 가짜 3회
def test_Moa_단계가_실패해도_돈다_지난_자료라고_적는다(self):  # ctx.results={"moa": failed} → ok, summary 에 "Moa 는 지난 자료"
def test_세종_목록이_없으면_source_missing(self):
def test_바뀐_점은_건수만(self):  # changes 에 "→" 있고 "010-0000" 없음
def test_요약에_번호가_없다(self):
```
```python
# test_ps_static.py 에 추가 — xlsm 을 openpyxl 로 다시 저장하지 않는다
def test_xlsm_재저장_금지(self):
    for f in ("workbook_step.py", "verify.py", "vba.py", "compare.py"):
        self.assertNotRegex(read(f), r"\.save\(", f)
```
- [ ] **Step 2: 실행해 실패 확인** — `python -I -X utf8 -m unittest discover -s scripts/sms-status-refresh -t scripts/sms-status-refresh -p "test_[wp]*.py" -v`
- [ ] **Step 3: 구현** — `STEP_IDS` 에 `"workbook"` 을 더하면 Task 6 드리프트 테스트가 TS `STEP_LABEL.workbook`(이미 있음)을 확인한다.
- [ ] **Step 4: 실행해 통과 확인** — Python 전체 discover + `npm test -- src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts --maxWorkers=1`
- [ ] **Step 5: 커밋** — `feat(sms-status-refresh): 현황 파일 06·07 갱신·검사·If-Match 업로드 단계`

### Task 15: PR-2b 검증 · 실 파일 시험 실행 · PR · 실운영 런북

- [ ] **Step 1: 관련 테스트 전부** — Python 전체 discover → OK, `npm test -- src/features/sms-sender/status-refresh --maxWorkers=1` → 0 failures, `npm run typecheck` → 0
- [ ] **Step 2: 개인정보 스캔** — Task 10 Step 2 와 같다.
- [ ] **Step 3: STOP — 실 파일 시험 실행(컨트롤러 + 사용자, 문자 없음, 업로드 없음).** 회사 PC(Excel 설치·로그온)에서:
  ```
  $env:SMS_STATUS_REFRESH_ENV_FILE = "C:\Users\ys1114\ClaudeCode\Build\OPS-Console\.env.local"
  $env:SMS_STATUS_REFRESH_DRY_RUN = "true"; $env:SMS_STATUS_REFRESH_KEEP_WORK = "true"
  python -I -X utf8 -u scripts\sms-status-refresh\refresh.py --request-id local-wb --steps workbook --work-dir <scratchpad>\srr-wb --out <scratchpad>\srr-wb\body.json
  ```
  기대: workbook 단계 `ok`, summary `검사 n/n 통과 · 올리지 않음(시험 실행)`, changes 의 건수가 지난 06·07(11-04 기준 06 양쪽 349/세종만 234/Moa만 52/제외 11, 07 양쪽 460/세종만 123/PIMS만 13/제외 11)과 같은 자릿수. 작업 폴더의 `work.xlsm` 을 사용자가 Excel 로 열어 06·07 모양(제목·요약·필터·틀 고정)과 매크로 동작(StatusPick 등)을 눈으로 확인. 남은 EXCEL 프로세스가 없는지 `Get-Process EXCEL`. 확인 뒤 작업 폴더 삭제(번호가 든 파일).
- [ ] **Step 4: PR** — 제목 `feat: SMS 현황 최신화 — 06·07 갱신·검사·If-Match 업로드 (PR-2b)`, 본문에 Step 3 결과 수치와 검사 항목 수.
- [ ] **Step 5: 머지·배포 후 실운영 런북(컨트롤러 + 사용자, 문자 1통)**
  1. 원래 폴더 `git pull`. 작업은 이미 등록돼 있다(Task 10). 회사 PC 로그온 상태 확인.
  2. 아무도 현황 파일을 열지 않은 상태에서 `현황 최신화` → 이력에 'Moa 수집 성공 · 현황 파일 성공', 바뀐 점 두 줄. Teams 현황 파일 버전이 1 늘었는지, 화면 `새로고침` 후 목록이 정상인지(숨김 시트 행 수 그대로).
  3. (선택, 사용자 동의 시) 사용자가 현황 파일을 Excel 데스크톱으로 열어 둔 채 다시 누름 → 이력에 `locked` 문구, 파일 버전 그대로.
  4. `automation_runs` 의 `sms-status-refresh` 메시지에 번호·이름이 없는지.

---

## Self-Review (작성자 점검 결과)

- **스펙 대조:** §2 버튼 권한 → Task 3·5 / §3 사람 칸 보존·덮어쓰기·매크로·조용한 실패 → Task 13(대상 외 시트 셀 단위 동일)·14(eTag·If-Match)·13(VBA)·4(`recordAutomationRun`) / §6.1 큐·1건·잠금·API·PUBLIC_PATHS·레지스트리·이력·할 일 문구·권한 → Task 1~5 / §6.2 단계 독립 → Task 6·14(needs 없음) / ② → Task 8 / ④ 1·5·6·7 + 06·07 → Task 11~14 / §6.3 출처·개인정보 → 각 태스크 출처 줄 + Global Constraints / §8 RLS·화면 경계·단계별 watermark·로그 건수만 → Task 1·5·2·4. ④ 의 숨김 시트 행 수 변화에 따른 01~04 수식 범위 확인은 PR-2 에서 숨김 시트를 안 바꾸므로 해당 없음 — PR-3 몫(Task 14 `build_sheet_payloads` 자리만 마련).
- **이름 일관성:** `enqueueStatusRefresh`·`STALE_RUNNING_MS`(Task 3 → 4·9), `StatusRefreshView`·`RefreshHistoryItem`(Task 2 → 5), `StepResult`·`StepFailure`·`Context`·`Step`·`run_steps`·`build_body`(Task 6 → 8·14), `Graph.put_if_match`·`UploadRejected.code`(Task 7 → 14), `pick_latest_dated`·`pick_latest_workbook`·`build_moa_sheet`·`build_pims_sheet`·`delta_line`(Task 11 → 14), `restore_vba`·`verify_workbook`·`failed_labels`(Task 13 → 14) 를 대조했다.
- **비율:** 코드 본문은 테스트 단언과 스키마·문구뿐이고, 구현 본문은 출처 파일·줄로 가리켰다.
