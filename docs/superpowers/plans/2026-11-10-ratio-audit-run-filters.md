# 경쟁률 점검 실행 조건 창 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동화 페이지 '경쟁률 세팅 점검'·'경쟁률 페이지 점검'의 [지금 실행]을 누르면 조건 창이 뜬다. 창에서 대학구분(4년제/2년제)·모집구분(수시/정시)을 각각 하나 이상 고른다. 기간은 '접수 마감 전'으로 고정이다. 그 조건에 맞는 서비스만 회사 PC 가 점검하고, 결과(관리자 메시지 머리·실행 로그)에 그 조건이 한 줄로 남는다.

**Architecture:** 조건 창은 전용 server action(`runRatioAuditAction`)을 부른다. 이 action 은 zod 로 조건을 검증하고, 일반 실행과 같은 판정(자동 실행·쿨다운)을 거친 뒤, 대상 건수를 센다. 0건이면 거절하고, 아니면 `ratio_audit_requests` 에 `kind`·`filters` 를 실어 적재한다. 회사 PC 폴러는 claim 한 **요청 id 만** `RATIO_AUDIT_REQUEST_ID` 로 audit.py 에 넘긴다. audit.py 는 `GET /api/ratio-audit/targets?requestId=` 로 서버가 고른 대상과 조건 한 줄을 받는다. 서버는 요청 행의 조건으로 `closing_services` 를 거른다(`write_end_at >= now` + 대학구분·모집구분 판정). audit.py 는 Moa 목록 전체와 이 대상을 교집합만 한다(시작일 필터 삭제). 인제스트 payload 에는 서버가 준 `condition` 을 그대로 다시 싣는다. 두 잡의 `run()` 은 더 이상 적재하지 않는다.

**Tech Stack:** Next.js App Router(server action·route handler) + TS + zod 4 + Supabase(service_role) + vitest/RTL · Python 3(unittest, requests, selenium — 테스트에서는 로그인하지 않는다) · PowerShell 5.1(폴러)

**Spec:** `docs/superpowers/specs/2026-11-10-ratio-audit-run-filters-design.md` — §2 결정 1~9, §4 실패로 볼 것, §6 배포 순서, §7 사용자 확인 2건.

**규모:** TS 약 19 + 테스트 약 17 + Python/PS 5 + SQL 1 + 문서 1 ≈ 43 파일(HARD-GATE '전체 설계'). 그래도 **PR 은 하나로 낸다.** 서버(대상 API 가 요청 id 를 요구)와 폴러(audit.py 가 요청 id 를 보냄)의 계약이 함께 바뀌기 때문이다. 나눠서 배포하면 그 사이의 모든 실행이 실패한다.

## Global Constraints

- 작업 위치: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-ratio-filter`(브랜치 `feat/ratio-audit-filters`). 원래 폴더 `...\Build\OPS-Console` 은 건드리지 않는다. `node_modules` 가 정션이면 **지우지 않는다.** 추적되지 않은 `scripts/moa-applyprice/` 는 스테이징하지 않는다. push 는 PR 태스크에서만 한다.
- TDD: 테스트를 먼저 쓰고, 실패를 확인한 뒤 구현한다(RED → GREEN).
- vitest 는 **`npm test -- <경로…> --maxWorkers=1`** 로 관련 파일만 돌린다. dev 서버·`next build`·전체 스위트는 금지한다(메모리 부족). `npm run typecheck` 는 태스크 끝에 한 번씩만 허용한다.
- Python 테스트는 `python -X utf8 -m unittest discover -s scripts/moa-ratio -t scripts/moa-ratio -p "<파일>" -v` 로 돌린다. `-I` 는 쓰지 않는다. audit.py 가 모듈 첫머리에서 selenium·scrape 를 import 하는데, `-I` 는 사용자 site-packages 를 빼서 폴러와 다른 환경이 되기 때문이다(다운로드 파일이 아니라 레포 코드다). 구현자가 먼저 확인할 것: `python -X utf8 -c "import sys; sys.path.insert(0, 'scripts/moa-ratio'); import audit"` 가 import 오류 없이 끝나는지. 실패하면 멈추고 보고한다.
- 구현·테스트 중에는 **Moa 로그인, Teams 발송, DB 수정을 모두 금지한다.** 실제 호출은 전부 가짜(mock/fake)로 대신한다. 실제 실행은 런북(Task 16)에서 컨트롤러가 사용자와 함께만 한다 — Moa 로그인마다 사용자 폰에 문자가 1통 간다.
- **claim API(`GET /api/ratio-audit/audit-request`)는 손으로 부르지 않는다.** pending 을 running 으로 바꿔 폴러 몫을 가로챈다. 대상 API(`/api/ratio-audit/targets`)는 읽기 전용이라 확인용으로 불러도 된다.
- **개인정보:** 코드·주석·테스트 fixture·로그·실행 메시지에 사람 이름·메일·전화번호를 넣지 않는다. fixture 는 학교 `테스트대학교A`, 서비스ID `9001001`, 운영자 `운영자A`, 요청자 `automation` 으로 쓴다. 기존 테스트의 실명 fixture 는 **그 줄을 고칠 때만** 가짜로 바꾼다(Task 5).
- supabase-js 는 오류를 던지지 않는다. 모든 쿼리에서 `error` 를 확인한다. 행이 없는 것(`maybeSingle` 의 data null)과 오류는 따로 다룬다.
- SQL 원문을 대조하는 테스트는 주석부터 지운다(`/\/\*[\s\S]*?\*\//g`, `/--.*$/gm`) — 정의를 주석 처리해도 초록이 되는 일을 막는다.
- 불변 패턴, 새 함수 50줄 이하, `any`·`@ts-ignore`·`eslint-disable`·`console.log` 금지. 주석·문구는 한국어로 쓴다. 한글이 든 기존 파일은 Edit 도구로만 고친다.
- UI: 색을 하드코딩하지 않는다(토큰 클래스만 쓴다). 창 안의 새 버튼은 표준 호버(`hover:bg-ink hover:text-cream`, 보더가 있으면 `hover:border-ink`)를 쓴다. 표 안의 [지금 실행]은 다른 잡과 같은 클래스(공유 상수)를 쓴다(스펙 결정 9). 모달은 기존 `ModalShell` 을 재사용한다.
- 커밋은 한국어 conventional 형식으로 쓰고, 끝에 두 줄을 붙인다:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```

## 고정한 결정

1. **조건 창은 이 두 잡만 띄운다.** 잡 정의에 표식 `conditionForm: "ratio-audit"` 를 두고 UI 가 이것으로 분기한다. 다른 잡의 [지금 실행]은 그대로 둔다. 두 잡의 `run()` 은 적재하지 않고 `RATIO_RUN_NEEDS_CONDITIONS` 로 거절한다. 일반 실행 액션과 cron route 가 모두 `run()` 을 부르므로, 조건 없는 요청이 생기는 길이 여기서 함께 닫힌다.
2. **조건 값은 화면 라벨 그대로 저장한다:** `{"univ": ["4년제"|"2년제"…], "recruit": ["수시"|"정시"…]}`. 같은 값이 겹치면 하나로 줄이고, 순서는 화면 순서(4년제→2년제, 수시→정시)로 맞춘다. 저장할 때(action)와 읽을 때(대상 API) 모두 같은 zod 스키마를 거친다.
3. **대학구분**은 앞뒤 공백을 뗀 뒤 정확히 일치로 본다. `4년제` → {`4년제`}, `2년제` → {`2년제`, `전문대`}. 그 밖의 값(`대학원`·`초중고교`·`기타`·`학위취득`·null)은 어느 쪽에도 안 든다.
4. **모집구분:** `수시` 는 `category` 를 trim 한 값이 정확히 `수시` 인 것, `정시` 는 trim 한 값이 `정시` 로 시작하는 것이다. 근거는 이렇다. 정시 뒤의 말(가나다·나다·가다·나·다)은 같은 모집의 **군**이고, 수시 뒤의 `재외국민`은 서비스·경쟁률 세팅이 따로 있는 **별도 전형**이다. 이 해석은 사용자가 지정했다(2026-11-10). 정시 접두가 군이 아닌 값(예: `정시 재외국민`)까지 끌어와도 사용자 규칙대로 포함한다. 구현자는 실제 distinct 목록을 PR 본문에 적는다(Task 16).
5. **기간 비교는 DB 에서 한다** — `.gte("write_end_at", now.toISOString())`. timestamptz 비교라 시간대 계산이 없다. 대학구분·모집구분 판정은 TS 순수 함수 하나(`matchesRatioAuditFilters`)가 맡는다. 규칙이 한 곳에 있어 표 테스트로 고정할 수 있다.
6. **폴러에는 요청 id 만 넘긴다.** 대상 API 가 그 id 로 `filters` 를 읽는다. claim 응답 모양은 바꾸지 않는다. 대상 API 는 요청 상태를 보지 않는다(시험 실행이 기존 id 를 다시 쓸 수 있게).
7. **대상 API 응답 코드:** `requestId` 가 없거나 uuid 가 아니면 400(`code: "bad_request"`), 요청이 없으면 404(`not_found`), 조건이 없거나 zod 를 못 넘으면 409(`missing_filters`), DB 오류는 500 이다. 성공하면 `{ ok: true, targets, condition: { requestId, line } }` 을 돌려준다. 오류 본문에는 늘 ASCII `code` 를 싣는다 — 폴러 완료 보고가 PS 5.1 문자열 본문이라 한글이 깨질 수 있다.
8. **조건 없는 옛 요청:** 마이그레이션이 적용 시점의 `pending ∧ filters is null` 을 `failed` 로 마감한다. 그 뒤에 남는 것은 결정 7 의 409 로 처리된다. `filters` 칸은 nullable 로 두고 제약은 걸지 않는다 — 적용부터 배포까지의 사이에 옛 화면이 적재하는 것을 막지 않기 위해서다.
9. **대상이 0건이면 적재하지 않고 실행 로그에도 남기지 않는다**(쿨다운 거절과 같은 '실행 전 판정'). 적재 뒤에 0건이 되면 audit.py 가 로그인 없이 빈 결과를 인제스트한다.
10. **조건 한 줄은 `조건: {라벨} — 대상 {N}건` 형식이다.** 라벨은 `{대학구분} · {모집구분} · 접수 마감 전` 이고, 같은 묶음 안의 여러 값은 `, ` 로 잇는다(예: `조건: 4년제, 2년제 · 수시 · 접수 마감 전 — 대상 120건`). 관리자 메시지에서는 제목 단락 바로 다음 단락에, 실행 로그에서는 기존 문장 끝에 ` (조건: …)` 로 붙인다. 붙임 위치를 끝으로 잡은 이유: 앞쪽에는 `QUEUED_MARK` 같은 접두가 오고, 끝에 붙여야 기존 테스트 문자열이 그대로 산다. 조건이 없는 옛 payload 는 줄을 붙이지 않는다.
11. **쿨다운·강제 실행·자동 실행 판정은 `runAutomationAction` 에서 꺼낸 비공개 함수 `runBlocker` 를 둘이 함께 쓴다**(동작 변화 없음 — 기존 `actions.test.ts` 가 증거다). 조건 창이 확인 단계를 겸하므로, 쿨다운 중에는 창의 실행 버튼이 곧 '강제 실행'이다(`force=1`). 'quota 소모 — 확인' 2단계는 이 창에 두지 않는다.
12. **창은 열 때마다 빈 상태로 시작한다**(닫으면 언마운트). 실패하면 창이 열린 채로 고른 값을 유지하고 `role="alert"` 로 이유를 보인다. 성공하면 창이 닫히고, 결과 문구는 표의 버튼 아래(일반 실행과 같은 자리)에 뜬다.
13. `requested_by` 는 지금처럼 `AUTOMATION_REQUESTER`(`"automation"`)로 둔다.

## Review Focus

1. **1~2월에 12월 시작 정시가 빠지던 결함, 접수가 끝난 서비스를 다시 보던 문제** — 기간 판정이 서버 한 곳으로 가고, Python 의 시작일 필터가 사라져야 한다. → Task 3 `기간은 DB 에서 write_end_at ≥ now`, Task 13 `목록 전체와 교집합`, Task 14 `audit.py 는 listfilter 를 쓰지 않는다`·`listfilter.py 가 없다`
2. **조건 없거나 깨진 요청이 Moa 로그인(문자)까지 가는 경우** → Task 1 `pending 마감`, Task 5 `조건 없는 요청은 409`, Task 8 `run() 은 적재하지 않는다`, Task 13 `요청 id 가 없으면 로그인 전에 멈춘다`·`대상 조회 실패는 이유를 찍고 로그인 전에 멈춘다`
3. **고른 것과 다른 대상** — 수시 재외국민이 끼거나, 정시 군이나 2년제의 전문대가 빠지는 경우. → Task 2 판정 표 테스트
4. **조건이 결과에서 안 보이는 경우**(이상 0건이면 관리자 메시지 자체가 없다) → Task 6 `제목 바로 아래 조건 줄`, Task 7 `실행 로그 끝에 조건`
5. **다른 잡의 실행 버튼이 바뀌는 경우** → Task 12 `다른 잡은 일반 실행 그대로`·`두 지금 실행 버튼의 모양이 같다`
6. **대상 0건 조합인데 문자만 가는 경우** → Task 10 `0건이면 적재·기록 안 함`, Task 13 `대상 0건이면 로그인하지 않는다`

---

### Task 1: 마이그레이션 + SQL 대조 테스트 (STOP: DB 승인)

**Files:**
- Create: `supabase/migrations/20261110_ratio_audit_request_filters.sql`
- Test: `src/features/ratio-audit/audit-requests/__tests__/filters-migration.test.ts`

**Interfaces:**
- Produces: `public.ratio_audit_requests.filters jsonb`(nullable). 적용하는 순간 `status='pending' and filters is null` 인 행이 `failed` 가 된다. RLS·GRANT 는 바꾸지 않는다(기존 테이블 단위 권한이 새 칸에도 적용된다. 값은 조건 라벨뿐이라 운영부 전체 읽기 그대로 둔다).

마이그레이션 원문(그대로):
```sql
-- 경쟁률 점검 실행 조건 — [지금 실행] 조건 창이 고른 대학구분·모집구분을 요청 행에 싣는다.
-- 폴러는 요청 id 만 넘기고, 대상 API(/api/ratio-audit/targets?requestId=)가 이 칸을 읽어 대상을 고른다.
-- 값 예: {"univ": ["2년제"], "recruit": ["수시"]} — 검증은 서버 zod(run-filters.ts)가 쓸 때·읽을 때 한다.
-- nullable 이고 제약이 없다: 옛 요청 이력은 조건이 없고, 적용~배포 사이 옛 화면의 적재를 막지 않기 위해서다
-- (그 사이 생긴 조건 없는 요청은 새 대상 API 가 409 로 거절해 Moa 로그인 전에 멈춘다).

begin;

alter table public.ratio_audit_requests
  add column if not exists filters jsonb;

-- 조건 없이 대기 중인 요청은 새 흐름에서 돌 수 없다 — 지금 마감해 두고 다시 누르게 한다.
update public.ratio_audit_requests
   set status = 'failed',
       finished_at = now(),
       message = '실행 조건 도입 전 요청 — 자동화 페이지에서 조건을 골라 다시 실행하세요'
 where status = 'pending'
   and filters is null;

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select data_type, is_nullable from information_schema.columns
--  where table_name = 'ratio_audit_requests' and column_name = 'filters';            → jsonb, YES
-- select status, count(*) from public.ratio_audit_requests where filters is null group by status; → pending 없음
```

- [ ] **Step 1: 실패하는 대조 테스트 작성** — 원문에서 주석을 지우고 공백을 하나로 접은 문자열(`body`)로 대조한다.

```ts
it("filters 칸을 nullable jsonb 로 더한다", () => {
  expect(body).toContain("alter table public.ratio_audit_requests add column if not exists filters jsonb;");
  expect(body).not.toMatch(/filters jsonb not null/);
});
it("조건 없이 대기 중인 요청만 마감한다", () => {
  expect(body).toMatch(/update public\.ratio_audit_requests set status = 'failed', finished_at = now\(\), message = '[^']+' where status = 'pending' and filters is null;/);
});
it("제약·정책은 건드리지 않는다", () => {
  expect(body).not.toMatch(/add constraint|create policy|drop policy|revoke|grant/i);
});
it("트랜잭션 + 스키마 캐시 갱신", () => {
  expect(body).toMatch(/^begin;/);
  expect(body).toContain("notify pgrst, 'reload schema'; commit;");
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/audit-requests/__tests__/filters-migration.test.ts --maxWorkers=1` → 파일이 없어 FAIL.
- [ ] **Step 3: 마이그레이션 작성** — 위 원문 그대로.
- [ ] **Step 4: 실행해 통과 확인** — 같은 명령 PASS.
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 실행 조건 칸 마이그레이션`
- [ ] **Step 6: STOP — DB 변경 승인.** 컨트롤러가 사용자에게 SQL 을 보여 승인을 받는다. 적용은 **사용자가** Supabase SQL Editor 에서 한다. 적용 후 위 '검증' 두 쿼리로 확인한다(jsonb·YES, pending 0). 승인 전에도 Task 2~15 는 진행할 수 있다(테스트는 전부 목이다). 머지는 승인·적용 뒤에만 한다.

### Task 2: 조건 규칙(순수) — `run-filters.ts`

**Files:**
- Create: `src/features/ratio-audit/run-filters.ts`(클라이언트에서도 import 하므로 `server-only` 금지)
- Test: `src/features/ratio-audit/__tests__/run-filters.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const RATIO_UNIV_OPTIONS = ["4년제", "2년제"] as const;
  export const RATIO_RECRUIT_OPTIONS = ["수시", "정시"] as const;
  export type RatioUniv = (typeof RATIO_UNIV_OPTIONS)[number];
  export type RatioRecruit = (typeof RATIO_RECRUIT_OPTIONS)[number];
  export const UNIV_TYPE_VALUES: Readonly<Record<RatioUniv, readonly string[]>> = { "4년제": ["4년제"], "2년제": ["2년제", "전문대"] };
  export const RATIO_PERIOD_LABEL = "접수 마감 전";
  export const ratioAuditFiltersSchema; // z.object({ univ, recruit }) — 필드 단위 transform(중복 제거 + 화면 순서). 최상위 transform 금지(Task 10 이 .extend 한다)
  export type RatioAuditFilters = { univ: RatioUniv[]; recruit: RatioRecruit[] };
  export function matchesRatioAuditFilters(row: { university_type: string | null; category: string | null }, f: RatioAuditFilters): boolean;
  export function ratioFilterLabel(f: RatioAuditFilters): string;   // "4년제, 2년제 · 수시 · 접수 마감 전"
  export function conditionLine(f: RatioAuditFilters, targetCount: number): string; // "조건: 2년제 · 수시 · 접수 마감 전 — 대상 12건"
  export const RATIO_RUN_NEEDS_CONDITIONS = "실행 조건(대학구분·모집구분)을 골라야 합니다 — 자동화 페이지의 [지금 실행]에서 조건 창으로 실행하세요.";
  ```
- zod 메시지(정확히): 빈 배열 → `대학구분을 하나 이상 고르세요.` / `모집구분을 하나 이상 고르세요.`, 허용값 밖 → `대학구분 값이 올바르지 않습니다.` / `모집구분 값이 올바르지 않습니다.` (zod 4 의 메시지 문법은 기존 `src/features/**/schemas.ts` 를 따른다)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
const row = (university_type: string | null, category: string | null) => ({ university_type, category });
const F = (univ: RatioUniv[], recruit: RatioRecruit[]): RatioAuditFilters => ({ univ, recruit });

it.each([
  ["2년제", "수시", true], ["전문대", "수시", true], [" 2년제 ", "수시", true],
  ["4년제", "수시", false], ["대학원", "수시", false], ["초중고교", "수시", false],
  ["기타", "수시", false], ["학위취득", "수시", false], [null, "수시", false],
])("2년제·수시 — 대학구분 %s / %s → %s", (u, c, ok) => expect(matchesRatioAuditFilters(row(u, c), F(["2년제"], ["수시"]))).toBe(ok));

it.each([
  ["수시", true], [" 수시 ", true], ["수시 재외국민", false], ["정시", false], [null, false],
])("수시는 정확히 — %s → %s", (c, ok) => expect(matchesRatioAuditFilters(row("4년제", c), F(["4년제"], ["수시"]))).toBe(ok));

it.each([
  ["정시", true], ["정시 가나다", true], ["정시 나다", true], ["정시 가다", true], ["정시 나", true], ["정시 다", true],
  ["수시", false], ["추가모집", false], [null, false],
])("정시는 접두 — %s → %s", (c, ok) => expect(matchesRatioAuditFilters(row("4년제", c), F(["4년제"], ["정시"]))).toBe(ok));

it("두 묶음 모두 맞아야 한다(교집합)", () => {
  expect(matchesRatioAuditFilters(row("4년제", "정시 나"), F(["2년제"], ["정시"]))).toBe(false);
  expect(matchesRatioAuditFilters(row("4년제", "정시 나"), F(["4년제", "2년제"], ["수시", "정시"]))).toBe(true);
});

it("하나 이상 골라야 한다 — 문구 그대로", () => {
  const r = ratioAuditFiltersSchema.safeParse({ univ: [], recruit: ["수시"] });
  expect(r.success).toBe(false);
  expect(r.error!.issues[0].message).toBe("대학구분을 하나 이상 고르세요.");
  expect(ratioAuditFiltersSchema.safeParse({ univ: ["4년제"], recruit: [] }).error!.issues[0].message).toBe("모집구분을 하나 이상 고르세요.");
});
it("허용값 밖은 거절", () => {
  expect(ratioAuditFiltersSchema.safeParse({ univ: ["전문대"], recruit: ["수시"] }).success).toBe(false); // 화면 선택지는 4년제/2년제 뿐
  expect(ratioAuditFiltersSchema.safeParse({ univ: ["4년제"], recruit: ["수시 재외국민"] }).success).toBe(false);
  expect(ratioAuditFiltersSchema.safeParse(null).success).toBe(false); // 옛 요청의 filters
});
it("중복 제거 + 화면 순서", () => {
  expect(ratioAuditFiltersSchema.parse({ univ: ["2년제", "4년제", "2년제"], recruit: ["정시", "수시"] }))
    .toEqual({ univ: ["4년제", "2년제"], recruit: ["수시", "정시"] });
});
it("라벨과 조건 한 줄", () => {
  expect(ratioFilterLabel(F(["2년제"], ["수시"]))).toBe("2년제 · 수시 · 접수 마감 전");
  expect(conditionLine(F(["4년제", "2년제"], ["수시", "정시"]), 120)).toBe("조건: 4년제, 2년제 · 수시, 정시 · 접수 마감 전 — 대상 120건");
  expect(conditionLine(F(["2년제"], ["정시"]), 0)).toBe("조건: 2년제 · 정시 · 접수 마감 전 — 대상 0건");
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/__tests__/run-filters.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 위 Interfaces 그대로 만든다. 판정은 `trim()` 뒤 비교하고 null 은 false 다. 파일 머리 주석에 고정한 결정 3·4 의 근거(군 vs 별도 전형)를 두 줄로 적는다.
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 실행 조건 판정 규칙(대학구분·모집구분)`

### Task 3: 대상 조회 — `listRatioAuditTargets(filters, now)`

**Files:**
- Modify: `src/features/ratio-audit/queries.ts`
- Test: `src/features/ratio-audit/__tests__/queries.test.ts`(새 파일)

**Interfaces:**
- Consumes: Task 2 `RatioAuditFilters`, `matchesRatioAuditFilters`
- Produces: `listRatioAuditTargets(filters: RatioAuditFilters, now: Date): Promise<RatioAuditTarget[]>` — `RatioAuditTarget` 모양은 그대로 둔다. 쿼리는 `from("closing_services").select("service_id, university_name, service_name, operator_name, university_type, category").gte("write_end_at", now.toISOString())` 이고, 이어서 `matchesRatioAuditFilters` 로 거른 뒤 기존과 같이 매핑한다. `.eq("category", "수시")` 는 없앤다.

- [ ] **Step 1: 실패하는 테스트 작성** — `@/lib/supabase/admin` 을 vi.mock 하고 체인 `from → select → gte` 를 기록한다(`gte` 가 `{ data, error }` 를 돌려준다).

```ts
const NOW = new Date("2026-11-10T01:00:00Z");
it("기간은 DB 에서 — 접수 마감이 지금 이후인 것만", async () => {
  await listRatioAuditTargets({ univ: ["4년제"], recruit: ["수시"] }, NOW);
  expect(from).toHaveBeenCalledWith("closing_services");
  expect(gte).toHaveBeenCalledWith("write_end_at", NOW.toISOString());
  expect(select.mock.calls[0][0]).toMatch(/university_type/);
  expect(select.mock.calls[0][0]).toMatch(/category/);
});
it("대학구분·모집구분은 판정 함수로 거른다", async () => {
  data = [
    { service_id: 9001001, university_name: "테스트대학교A", service_name: "2027학년도 수시모집", operator_name: "운영자A", university_type: "전문대", category: "수시" },
    { service_id: 9001002, university_name: "테스트대학교B", service_name: "재외국민", operator_name: "운영자A", university_type: "2년제", category: "수시 재외국민" },
    { service_id: 9001003, university_name: "테스트대학교C", service_name: "정시", operator_name: "운영자B", university_type: "4년제", category: "정시 가나다" },
  ];
  const r = await listRatioAuditTargets({ univ: ["2년제"], recruit: ["수시"] }, NOW);
  expect(r).toEqual([{ serviceId: 9001001, universityName: "테스트대학교A", serviceName: "2027학년도 수시모집", operatorName: "운영자A" }]);
});
it("조회 오류는 던진다 — 조용한 0건 금지", async () => {
  error = { message: "boom" };
  await expect(listRatioAuditTargets({ univ: ["4년제"], recruit: ["수시"] }, NOW)).rejects.toThrow(/대상 조회 실패/);
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/__tests__/queries.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 함수 주석의 '점검 대상 = closing_services 의 수시 서비스'를 '실행 조건(대학구분·모집구분) × 접수 마감 전'으로 고친다. 'Moa 서버 필터를 믿지 않고 교집합으로 정한다'는 문장은 그대로 둔다. 기존 호출자(대상 라우트)는 Task 5 에서 고친다 — 그 전까지 typecheck 가 빨간 것은 정상이다.
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 대상 조회를 실행 조건과 접수 마감 전으로`

### Task 4: 요청 적재에 조건 싣기 — `enqueueLocalAuditRequest`

**Files:**
- Modify: `src/features/ratio-audit/audit-requests/enqueue.ts`
- Modify: `src/features/ratio-audit/audit-requests/__tests__/enqueue.test.ts`

**Interfaces:**
- Consumes: Task 2 `RatioAuditFilters`
- Produces: `enqueueLocalAuditRequest(requestedBy: string, now: Date, kind: RatioAuditKind, filters: RatioAuditFilters): Promise<EnqueueResult>` — 기본값 없이 전부 필수로 받는다(호출자는 Task 10 의 action 하나가 된다). insert 는 `{ requested_by, status: "pending", kind, filters }`. 활성 1건 정책·stale 마감·성공 문구(`QUEUED_MARK` 로 시작)는 그대로 둔다.

- [ ] **Step 1: 테스트 수정(먼저 실패하게)** — 모든 호출을 `enqueueLocalAuditRequest("admin@x.com", NOW, "schedule", F)` 꼴로 바꾸고(`const F = { univ: ["2년제"], recruit: ["수시"] }`), insert 기대값 세 곳에 `filters: F` 를 더한다. 새 테스트도 추가한다:
```ts
it("조건을 요청 행에 싣는다 — 폴러는 id 만 넘기고 대상 API 가 이 칸을 읽는다", async () => {
  const { insert } = mockAdmin({ existing: [] });
  await enqueueLocalAuditRequest("automation", NOW, "page", { univ: ["4년제", "2년제"], recruit: ["정시"] });
  expect(insert).toHaveBeenCalledWith({ requested_by: "automation", status: "pending", kind: "page", filters: { univ: ["4년제", "2년제"], recruit: ["정시"] } });
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/audit-requests/__tests__/enqueue.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — JSDoc 의 `@param kind` 아래에 `@param filters 실행 조건 — 대상 API 가 요청 id 로 읽는다` 를 더한다. 구현자가 확인할 것: `grep -rn "enqueueLocalAuditRequest" src` 결과가 잡 두 개와 이 테스트뿐인지 본다. 그 밖의 호출처가 있으면 멈추고 보고한다.
- [ ] **Step 4: 실행해 통과 확인**(잡 두 개의 호출은 Task 8 에서 없어진다 — 그 전까지 typecheck 가 빨간 것은 정상이다)
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 점검 요청에 실행 조건을 싣는다`

### Task 5: 대상 API — 요청 id 로 조건 읽기

**Files:**
- Create: `src/features/ratio-audit/audit-requests/request-filters.ts`(`server-only`)
- Modify: `src/app/api/ratio-audit/targets/route.ts`
- Test: `src/features/ratio-audit/audit-requests/__tests__/request-filters.test.ts`(새 파일) · Modify: `src/app/api/ratio-audit/targets/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 2 `ratioAuditFiltersSchema`·`conditionLine`, Task 3 `listRatioAuditTargets`
- Produces:
  - `type RequestFiltersLookup = { status: "found"; filters: RatioAuditFilters } | { status: "missing_filters" } | { status: "not_found" }`
  - `loadRequestFilters(requestId: string): Promise<RequestFiltersLookup>` — `from("ratio_audit_requests").select("id, filters").eq("id", requestId).maybeSingle()`. `error` 가 있으면 throw 한다. data 가 null 이면 `not_found`, `ratioAuditFiltersSchema.safeParse(data.filters)` 가 실패하면 `missing_filters` 다(null·옛 요청·깨진 값을 한 경로로 다룬다).
  - `GET /api/ratio-audit/targets?requestId=<uuid>` — 결정 7 의 코드표 그대로:
    - `z.object({ requestId: z.string().uuid() })` 를 searchParams 로 검증한다. 실패하면 400 `{ ok: false, code: "bad_request", error: "requestId(uuid)가 필요합니다." }`
    - `not_found` → 404 `{ ok: false, code: "not_found", error: "실행 요청을 찾지 못했습니다." }`
    - `missing_filters` → 409 `{ ok: false, code: "missing_filters", error: "실행 조건이 없는 요청입니다 — 자동화 페이지에서 조건을 골라 다시 실행하세요." }`
    - 성공하면 `targets = await listRatioAuditTargets(filters, new Date())` 를 구해 `{ ok: true, targets, condition: { requestId, line: conditionLine(filters, targets.length) } }` 를 돌려준다
    - throw 는 지금처럼 500 이다. CRON_SECRET 검사(미설정 500 / 불일치 401)는 그대로 둔다

- [ ] **Step 1: 실패하는 테스트 작성** (uuid 는 버전 니블이 맞는 가짜 v4 `"00000000-0000-4000-8000-000000000001"` — zod 4 `uuid()` 는 RFC 형식을 엄격히 본다)

```ts
// request-filters.test.ts — @/lib/supabase/admin 목, 체인 from→select→eq→maybeSingle
it("조건이 있으면 found + 정규화된 조건", …data { id, filters: { univ: ["2년제","4년제"], recruit: ["수시"] } } → { status: "found", filters: { univ: ["4년제","2년제"], recruit: ["수시"] } });
it("옛 요청(filters null)은 missing_filters", …);
it("허용값 밖 조건도 missing_filters", …filters { univ: ["대학원"], recruit: ["수시"] });
it("행이 없으면 not_found", …data null, error null);
it("조회 오류는 던진다", …error { message: "boom" } → rejects);
```
```ts
// route.test.ts — loadRequestFilters·listRatioAuditTargets 를 vi.mock. 기존 '인증되면 대상 목록을 반환' 은 요청 id 를 붙인 형태로 고치고, 그 fixture 를 가짜 값(테스트대학교A·운영자A)으로 바꾼다
it("requestId 가 없거나 uuid 가 아니면 400 bad_request, 조회 안 함", …);
it("없는 요청은 404 not_found", …);
it("조건 없는 요청은 409 missing_filters — 폴러가 로그인 전에 멈춘다", …json.code === "missing_filters");
it("대상과 조건 한 줄을 함께 준다", async () => {
  vi.mocked(loadRequestFilters).mockResolvedValue({ status: "found", filters: { univ: ["2년제"], recruit: ["수시"] } });
  vi.mocked(listRatioAuditTargets).mockResolvedValue([{ serviceId: 9001001, universityName: "테스트대학교A", serviceName: "수시", operatorName: "운영자A" }]);
  const json = await (await GET(getReq("Bearer s3cret", ID))).json();
  expect(json.condition).toEqual({ requestId: ID, line: "조건: 2년제 · 수시 · 접수 마감 전 — 대상 1건" });
  expect(listRatioAuditTargets).toHaveBeenCalledWith({ univ: ["2년제"], recruit: ["수시"] }, expect.any(Date));
});
it("조건 조회가 던지면 500", …);
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/audit-requests/__tests__/request-filters.test.ts src/app/api/ratio-audit/targets --maxWorkers=1`
- [ ] **Step 3: 구현** — 라우트 머리 주석에 '대상은 요청 행의 실행 조건으로 서버가 고른다 — 폴러는 id 만 넘긴다(PS 5.1 이 한글 조건을 깨뜨리지 않게)'를 더한다. 오류 본문의 `code` 는 ASCII 다(결정 7).
- [ ] **Step 4: 실행해 통과 확인** + `npm run typecheck`(잡 두 개의 enqueue 호출 오류만 남아야 한다 — Task 8 에서 없어진다)
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 대상 API 가 요청 id 로 실행 조건을 읽는다`

### Task 6: 결과에 조건 한 줄 — 인제스트 계약·관리자 메시지

**Files:**
- Modify: `src/features/ratio-audit/schemas.ts`, `src/features/ratio-audit/summary.ts`
- Modify: `src/features/ratio-audit/__tests__/schemas.test.ts`, `src/features/ratio-audit/__tests__/summary.test.ts`

**Interfaces:**
- Produces:
  - `ratioRunConditionSchema = z.object({ requestId: z.string().uuid(), line: z.string().min(1).max(200) })`, `type RatioRunCondition`
  - `ratioAuditIngestSchema` 에 `condition: ratioRunConditionSchema.optional()` 추가(옛 payload 호환 — 없으면 줄을 붙이지 않는다)
  - `buildAdminRatioAuditHtml` — `args.input.condition` 이 있으면 제목 단락(`<p>{title} — 순회 …</p>`) **바로 다음에** `<p>${escapeHtml(condition.line)}</p>` 를 넣는다. 인자 모양은 바꾸지 않는다(`dispatch.ts` 무변경 — 이미 `input` 을 넘긴다)

- [ ] **Step 1: 실패하는 테스트 작성**
```ts
// schemas.test.ts
it("condition 은 선택 — 없어도 통과", …기존 fixture 그대로 success);
it("condition 은 요청 id(uuid)와 한 줄", …{ requestId: ID, line: "조건: 2년제 · 수시 · 접수 마감 전 — 대상 3건" } success; requestId "x" → fail; line "가".repeat(201) → fail);
// summary.test.ts
it("관리자 메시지 제목 바로 아래에 조건 한 줄", () => {
  const html = buildAdminRatioAuditHtml({ input: { ...base, condition: { requestId: ID, line: "조건: 2년제 · 수시 · 접수 마감 전 — 대상 3건" } }, unassigned: [], sentCount: 0, failed: [] });
  const head = html.indexOf("경쟁률 세팅 점검 — 순회");
  const cond = html.indexOf("<p>조건: 2년제 · 수시 · 접수 마감 전 — 대상 3건</p>");
  expect(cond).toBeGreaterThan(head);
  expect(cond).toBeLessThan(html.indexOf("개인 채팅 발송"));
});
it("조건 줄도 이스케이프", …line "조건: <b>" → "&lt;b&gt;");
it("조건이 없으면 지금 모양 그대로", …html 에 "조건:" 없음);
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/__tests__/schemas.test.ts src/features/ratio-audit/__tests__/summary.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 구현자가 확인할 것: `summary.test.ts` 의 기존 입력 fixture 이름(`base` 등)을 맞춘다.
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 관리자 메시지 머리에 실행 조건 한 줄`

### Task 7: 실행 로그에 조건 — `buildRunMessage` + 인제스트 라우트

**Files:**
- Modify: `src/features/ratio-audit/run-message.ts`, `src/app/api/ratio-audit/ingest/route.ts`
- Modify: `src/features/ratio-audit/__tests__/run-message.test.ts`, `src/app/api/ratio-audit/ingest/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 6 `input.condition`
- Produces: `buildRunMessage(summary, dispatch, condition?: string): string` — 조건이 있으면 기존 문장 끝에 ` (${condition})` 를 붙인다. 인제스트는 `recordAutomationRun(..., { ok, message: buildRunMessage(s, dispatch, input.condition?.line) })` 로 부른다. `ratio_audit_runs.payload` 는 `input` 그대로라 `condition` 도 함께 남는다.

- [ ] **Step 1: 실패하는 테스트 작성**
```ts
// run-message.test.ts
it("조건이 있으면 끝에 괄호로", () => {
  expect(buildRunMessage(sum({ scannedCount: 3 }), disp(), "조건: 2년제 · 수시 · 접수 마감 전 — 대상 3건"))
    .toBe("검사 3건 · 이상 없음 · 발송 0명 (조건: 2년제 · 수시 · 접수 마감 전 — 대상 3건)");
});
it("조건이 없으면 지금 문장 그대로", …기존 기대 문자열 하나를 세 번째 인자 없이 다시 확인);
// ingest route.test.ts
it("실행 로그에 조건을 싣는다 — 이상 0건이면 관리자 메시지가 없어 여기가 유일한 자리", …payload 에 condition → recordAutomationRun 메시지가 "(조건: …)" 로 끝남);
it("payload 에 condition 이 그대로 남는다", …ratio_audit_runs insert 인자의 payload.condition 확인);
it("condition 형식이 틀리면 400", …requestId "x");
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/__tests__/run-message.test.ts src/app/api/ratio-audit/ingest --maxWorkers=1`
- [ ] **Step 3: 구현** — 구현자가 확인할 것: `sum`·`disp` 같은 헬퍼 이름과 인제스트 테스트의 목 구조(`dispatchRatioAudit`·`recordAutomationRun` 목)를 기존 파일에 맞춘다. `src/app/api/ratio-audit/__tests__/run-log.test.ts` 도 함께 돌려 초록을 확인한다.
- [ ] **Step 4: 실행해 통과 확인** — 위 명령 + `npm test -- src/app/api/ratio-audit/__tests__/run-log.test.ts --maxWorkers=1`
- [ ] **Step 5: 커밋** — `feat(ratio-audit): 실행 로그 끝에 실행 조건`

### Task 8: 잡 `run()` 은 적재하지 않는다 + 잡 id ↔ 점검 종류

**Files:**
- Modify: `src/features/automations/jobs/ratio-audit.ts`, `src/features/automations/jobs/ratio-page-check.ts`, `src/features/ratio-audit/run-message.ts`
- Modify: `src/features/automations/jobs/__tests__/ratio-audit.test.ts`, `src/features/automations/jobs/__tests__/ratio-page-check.test.ts`, `src/features/ratio-audit/__tests__/run-message.test.ts`

**Interfaces:**
- Consumes: Task 2 `RATIO_RUN_NEEDS_CONDITIONS`
- Produces:
  - `runRatioAudit()`·`runRatioPageCheck()` → `{ ok: false, message: RATIO_RUN_NEEDS_CONDITIONS }`. enqueue import 를 지운다(이 변경으로 생긴 고아다). 머리 주석에 '조건 없는 요청을 만들지 않는다 — 일반 실행 액션·cron route 가 이 함수를 부른다. 실행은 조건 창(runRatioAuditAction)'을 적는다
  - `run-message.ts`: `export const RATIO_AUDIT_JOB_IDS = ["ratio-audit", "ratio-page-check"] as const;` · `export type RatioAuditJobId = (typeof RATIO_AUDIT_JOB_IDS)[number];` · `export function ratioKindOfJob(jobId: RatioAuditJobId): RatioAuditKind`

- [ ] **Step 1: 테스트 수정·추가(먼저 실패하게)**
```ts
// ratio-audit.test.ts (page 도 같은 꼴)
it("조건 없이 적재하지 않는다 — 조건 창에서만 실행", async () => {
  const r = await runRatioAudit();
  expect(r).toEqual({ ok: false, message: RATIO_RUN_NEEDS_CONDITIONS });
});
// enqueue 목은 지운다(잡이 더 이상 import 하지 않는다). 기존 두 테스트는 위 하나로 바꾼다.
// run-message.test.ts
it("잡 id ↔ 점검 종류는 서로 되돌아온다", () => {
  for (const id of RATIO_AUDIT_JOB_IDS) expect(automationJobIdFor(ratioKindOfJob(id))).toBe(id);
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/automations/jobs/__tests__/ratio-audit.test.ts src/features/automations/jobs/__tests__/ratio-page-check.test.ts src/features/ratio-audit/__tests__/run-message.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인** + `npm run typecheck` → 0 errors
- [ ] **Step 5: 커밋** — `feat(automations): 경쟁률 점검 잡은 조건 없이 적재하지 않는다`

### Task 9: 잡에 조건 창 표식 + 설명

**Files:**
- Modify: `src/features/automations/types.ts`, `src/features/automations/registry.ts`, `src/features/automations/queries.ts`
- Modify: `src/features/automations/__tests__/registry.test.ts`(+ 구현자가 확인할 것: `queries.test.ts` 에 status 매핑 단언이 있으면 거기에도)

**Interfaces:**
- Produces:
  - `AutomationJob.conditionForm?: "ratio-audit"`, `AutomationStatus.conditionForm?: "ratio-audit"` — JSDoc 는 '[지금 실행]이 바로 실행하지 않고 띄울 조건 창. 없으면 일반 실행'
  - registry 의 두 잡에 `conditionForm: "ratio-audit"` 을 넣는다. 두 설명에서 `여기서 '실행'을 누르면 로컬 실행 요청만 적재되고` 문장 앞에 다음 한 줄을 더한다: `'지금 실행'을 누르면 실행 조건 창이 뜹니다 — 대학구분(4년제/2년제)·모집구분(수시/정시)을 하나 이상 골라야 실행되고, 기간은 접수 마감 전(진행 중 + 오픈 예정)으로 고정입니다.` 나머지 문장은 그대로 둔다
  - `getAutomationStatuses` 가 `conditionForm` 을 status 로 옮긴다(구현자가 확인할 것: `manualOnly` 를 옮기는 자리를 찾아 같은 방식으로)

- [ ] **Step 1: 실패하는 테스트 작성**
```ts
it("조건 창은 경쟁률 두 잡만", () => {
  expect(AUTOMATION_JOBS.filter((j) => j.conditionForm).map((j) => j.id).sort()).toEqual(["ratio-audit", "ratio-page-check"]);
  expect(getJob("ratio-audit")?.conditionForm).toBe("ratio-audit");
});
it("설명이 조건 창을 말한다", …두 잡 description 에 "실행 조건 창" 포함);
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/automations/__tests__/registry.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — 구현자가 확인할 것: `src/features/automations/__tests__/feature-intro-pins.test.ts` 가 설명 문구를 고정하고 있으면 함께 고친다.
- [ ] **Step 4: 실행해 통과 확인** — `npm test -- src/features/automations --maxWorkers=1`
- [ ] **Step 5: 커밋** — `feat(automations): 경쟁률 점검 잡에 조건 창 표식`

### Task 10: server action `runRatioAuditAction`

**Files:**
- Modify: `src/features/automations/actions.ts`, `src/features/automations/schemas.ts`
- Test: `src/features/automations/__tests__/ratio-run-action.test.ts`(새 파일)

**Interfaces:**
- Consumes: Task 2 `ratioAuditFiltersSchema`·`conditionLine`·`ratioFilterLabel`, Task 3 `listRatioAuditTargets`, Task 4 `enqueueLocalAuditRequest`·`AUTOMATION_REQUESTER`, Task 8 `RATIO_AUDIT_JOB_IDS`·`ratioKindOfJob`
- Produces:
  - `runRatioAuditInputSchema = ratioAuditFiltersSchema.extend({ jobId: z.enum(RATIO_AUDIT_JOB_IDS, <"조건 창을 쓰는 자동화가 아닙니다.">), force: z.boolean() })`
  - 비공개 `async function runBlocker(job: AutomationJob, force: boolean): Promise<RunActionState | null>` — `runAutomationAction` 의 localOnly·자동 실행(enabled)·쿨다운 판정을 **그대로 옮긴 것**이다. `runAutomationAction` 도 이것을 부른다(동작 변화 없음)
  - `runRatioAuditAction(_prev: RunActionState, formData: FormData): Promise<RunActionState>` — 순서(고정):
    1. `requireAdmin()`
    2. `runRatioAuditInputSchema.safeParse({ jobId: get("jobId"), force: get("force") === "1", univ: getAll("univ"), recruit: getAll("recruit") })` → 실패하면 `{ ok: false, message: 첫 이슈 메시지 }`
    3. `getJob(jobId)` → 없으면 `알 수 없는 자동화: …` → `runBlocker(job, force)` 가 값을 주면 그대로 돌려준다
    4. `now = new Date()`. `listRatioAuditTargets(filters, now)` 가 던지면 `{ ok: false, message: "점검 대상을 읽지 못했습니다. 잠시 뒤 다시 시도하세요." }`(기록 안 함)
    5. 0건이면 `{ ok: false, message: `조건에 맞는 점검 대상이 없어 요청하지 않았습니다 — ${ratioFilterLabel(filters)}` }`(적재·기록 안 함)
    6. `enqueueLocalAuditRequest(AUTOMATION_REQUESTER, now, ratioKindOfJob(jobId), filters)` → message 는 성공이면 `${r.message} ${conditionLine(filters, targets.length)}`, 실패면 `r.message`
    7. `recordAutomationRun(jobId, { ok: r.ok, message, durationMs })` → `revalidatePath("/dashboard/automations")` → `{ ok: r.ok, message }`

- [ ] **Step 1: 실패하는 테스트 작성** — 목은 `actions.test.ts` 와 같은 구성에 두 가지를 더한다: `@/features/ratio-audit/queries` 의 `listRatioAuditTargets`, `@/features/ratio-audit/audit-requests/enqueue` 의 `enqueueLocalAuditRequest`·`AUTOMATION_REQUESTER: "automation"`. `fd({ jobId, force?, univ: [...], recruit: [...] })` 헬퍼는 `append` 로 여러 값을 넣는다.
```ts
it("대학구분이 비면 거절 — 대상 조회·적재 안 함", …message "대학구분을 하나 이상 고르세요.", listRatioAuditTargets 0회, enqueue 0회);
it("모집구분이 비면 거절", …"모집구분을 하나 이상 고르세요.");
it("허용값 밖은 거절", …univ "대학원");
it("조건 창 잡이 아니면 거절", …jobId "insights-collect" → "조건 창을 쓰는 자동화가 아닙니다.");
it("자동 실행 ON·쿨다운은 일반 실행과 같은 판정", …getJobEnabled true → "자동 실행 중" 포함; 쿨다운 15 + force 없음 → "15분" 포함; force=1 → 진행);
it("대상 0건이면 적재·기록하지 않는다", async () => {
  vi.mocked(listRatioAuditTargets).mockResolvedValue([]);
  const r = await runRatioAuditAction(undefined, fd({ jobId: "ratio-audit", univ: ["2년제"], recruit: ["정시"] }));
  expect(r).toEqual({ ok: false, message: "조건에 맞는 점검 대상이 없어 요청하지 않았습니다 — 2년제 · 정시 · 접수 마감 전" });
  expect(enqueueLocalAuditRequest).not.toHaveBeenCalled();
  expect(recordRunMock).not.toHaveBeenCalled();
});
it("대상 조회가 던지면 적재 안 함", …);
it("종류와 조건을 함께 적재 — 같은 시각으로 세고 적재한다", async () => {
  vi.mocked(listRatioAuditTargets).mockResolvedValue([T1, T2, T3]);
  vi.mocked(enqueueLocalAuditRequest).mockResolvedValue({ ok: true, message: "[접수] 회사 PC 폴러에 요청했습니다." });
  const r = await runRatioAuditAction(undefined, fd({ jobId: "ratio-page-check", univ: ["2년제", "4년제", "2년제"], recruit: ["수시"] }));
  const F = { univ: ["4년제", "2년제"], recruit: ["수시"] };
  expect(enqueueLocalAuditRequest).toHaveBeenCalledWith("automation", expect.any(Date), "page", F);
  expect(vi.mocked(listRatioAuditTargets).mock.calls[0]).toEqual([F, vi.mocked(enqueueLocalAuditRequest).mock.calls[0][1]]);
  expect(r?.message).toBe("[접수] 회사 PC 폴러에 요청했습니다. 조건: 4년제, 2년제 · 수시 · 접수 마감 전 — 대상 3건");
  expect(recordRunMock).toHaveBeenCalledWith("ratio-page-check", expect.objectContaining({ ok: true, message: r?.message }));
});
it("대기 중 요청이 있어 적재 실패면 그대로 실패로 기록", …);
it("관리자 확인을 먼저 한다", …requireAdmin 이 던지면 아무것도 안 부름);
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/automations/__tests__/ratio-run-action.test.ts src/features/automations/__tests__/actions.test.ts --maxWorkers=1`
- [ ] **Step 3: 구현** — `"use server"` 파일이라 export 는 async 함수만 할 수 있다(`runBlocker` 는 export 하지 않는다). 스키마는 `schemas.ts` 에 둔다. 구현자가 확인할 것: `QUEUED_MARK` 가 문구 맨 앞에 와야 하는지 `run-log-kind.ts` 에서 보고, 조건 줄은 **끝에** 붙인다.
- [ ] **Step 4: 실행해 통과 확인**(기존 `actions.test.ts` 가 그대로 초록이어야 한다 — `runBlocker` 추출의 증거) + `npm run typecheck`
- [ ] **Step 5: 커밋** — `feat(automations): 경쟁률 점검 조건 실행 action`

### Task 11: 조건 창 UI — `RatioRunControl`

**Files:**
- Create: `src/app/dashboard/automations/_components/run-control-shared.ts`, `src/app/dashboard/automations/_components/RatioRunControl.tsx`(`"use client"`)
- Test: `src/app/dashboard/automations/_components/__tests__/RatioRunControl.test.tsx`

**Interfaces:**
- Consumes: Task 2 `RATIO_UNIV_OPTIONS`·`RATIO_RECRUIT_OPTIONS`·`RATIO_PERIOD_LABEL`, Task 10 `runRatioAuditAction`, `ModalShell`(구현자가 확인할 것: `grep -rn "export function ModalShell" src` 로 위치·props 와 role="dialog"·제목 연결을 확인한다. 없으면 멈추고 보고한다), `AutomationStatus`
- Produces:
  - `run-control-shared.ts`: `ADMIN_ONLY_MSG = "관리자만 실행 가능합니다."`, `RUN_NOW_CLASS`(= 지금 `RunControl` 의 '지금 실행' 버튼 클래스 문자열 그대로), `RUN_COOLDOWN_CLASS`(= '쿨다운 N분 — 강제 실행' 버튼 클래스 그대로)
  - `RatioRunControl({ status, isAdmin }: { status: AutomationStatus; isAdmin: boolean })`
    - 트리거: `type="button"`, 라벨은 `지금 실행`(쿨다운이면 `쿨다운 {N}분 — 강제 실행`, 클래스 `RUN_COOLDOWN_CLASS`). 비admin 이면 `alert(ADMIN_ONLY_MSG)` 만 띄우고 창을 열지 않는다
    - 창(ModalShell): 제목 `{status.label} — 실행 조건` / form(`useActionState(runRatioAuditAction)`): hidden `jobId`, 쿨다운이면 hidden `force=1`
      - `<fieldset><legend>대학구분</legend>` 에 체크박스 `name="univ"` `4년제`·`2년제`. 라벨 밖에 도움말 `2년제는 전문대·폴리텍·전공대학을 함께 봅니다.`
      - `<fieldset><legend>모집구분</legend>` 에 체크박스 `name="recruit"` `수시`·`정시`. 도움말 `정시는 가·나·다군을 모두 보고, 수시 재외국민은 빠집니다.`
      - 고정 줄(고를 수 없음) `기간: 접수 마감 전(진행 중 + 오픈 예정)`
      - 쿨다운이면 `최근 실행 후 쿨다운 {N}분이 남았습니다 — 실행하면 강제 실행됩니다.`
      - 안내 `실행하면 Moa 인증 문자가 1통 갑니다. 회사 PC 폴러가 5분 안에 시작합니다.`
      - 이 창을 연 뒤 받은 실패는 `role="alert"` 로 보인다
      - 버튼 `[취소]`(type=button) `[실행]`(submit, 쿨다운이면 라벨 `강제 실행`, 보내는 중이면 `요청 중…`). 대학구분·모집구분이 각각 하나 이상일 때만 켜진다(체크 상태는 창 안 local state)
    - 성공하면 창이 닫히고 트리거 아래에 `state.message`(`text-ink`). 실패면 창이 열린 채 값을 유지한다(결정 12)
    - 체크박스: 구현자가 확인할 것 — `src/components/common` 에 체크박스 공용 컴포넌트가 있으면 그것을 쓴다. 없으면 네이티브 `<input type="checkbox">` + `<label>` 을 쓰고, 색은 토큰 클래스(예: `accent-vermilion`)만 쓴다
    - 창 버튼 클래스: 취소 `border border-line … text-ink hover:border-ink hover:bg-ink hover:text-cream`, 실행 `border border-vermilion bg-vermilion … text-cream hover:border-ink hover:bg-ink disabled:opacity-50`(기존 모달 사용처에 맞는 크기 클래스가 있으면 따른다)

- [ ] **Step 1: 실패하는 테스트 작성** — `@/features/automations/actions` 의 `runRatioAuditAction` 을 vi.mock 한다. useActionState + 목 action 제출 패턴은 `src/app/dashboard/internal-admin/__tests__/StatusRefreshControls.test.tsx` 를 따른다.
```tsx
const ratio: AutomationStatus = { id: "ratio-audit", label: "경쟁률 세팅 점검", description: "d", scheduleInfo: "s", cadence: "manual", cooldownMinutes: 60, lastRunAt: null, cooldownRemainingMinutes: 0, enabled: false, localOnly: false, manualOnly: true, conditionForm: "ratio-audit" };
it("지금 실행 → 아무것도 안 고른 창, 실행은 꺼져 있다", …4 체크박스 not checked, getByRole("button", { name: "실행" }) disabled);
it("두 묶음에서 하나씩 골라야 켜진다", …"2년제"만 → disabled; "수시"까지 → enabled);
it("고른 값이 FormData 로 간다", …action 의 formData: get("jobId")==="ratio-audit", getAll("univ")==["2년제"], getAll("recruit")==["수시"], get("force")===null);
it("기간은 고를 수 없고 '접수 마감 전'", …체크박스 4개뿐, getByText(/기간: 접수 마감 전/));
it("쿨다운이면 강제 실행 — force=1", …cooldownRemainingMinutes 12 → 트리거 "쿨다운 12분 — 강제 실행", 창 실행 버튼 "강제 실행", formData force "1");
it("성공하면 창이 닫히고 결과 문구", …queryByRole("dialog") null, getByText(message));
it("실패하면 창이 열린 채 이유와 고른 값 유지", …role=alert 에 message, "2년제" checked 유지);
it("닫았다 다시 열면 빈 상태", …취소 → 다시 지금 실행 → 전부 unchecked);
it("비admin 은 창 없이 알럿", …alert("관리자만 실행 가능합니다."), dialog 없음);
it("모양 — 트리거는 다른 잡과 같은 클래스, 창 버튼은 표준 호버", () => {
  expect(trigger.className).toBe(RUN_NOW_CLASS);
  expect(runBtn.className).toMatch(/hover:bg-ink/); expect(cancelBtn.className).toMatch(/hover:bg-ink/);
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/app/dashboard/automations/_components/__tests__/RatioRunControl.test.tsx --maxWorkers=1`
- [ ] **Step 3: 구현** — 이 파일만으로 300줄을 넘기면 창 본문(`RatioRunDialog`)을 같은 폴더의 파일로 나눈다. 성공·실패 판정에 useEffect + setState 를 쓰지 말고, `RunControl` 의 `armedAgainst` 처럼 '연 시점의 state'와 비교해 파생한다.
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(automations): 경쟁률 점검 실행 조건 창`

### Task 12: 자동화 표에 끼우기 — `AutomationHub`

**Files:**
- Modify: `src/app/dashboard/automations/_components/AutomationHub.tsx`
- Modify: `src/app/dashboard/automations/_components/__tests__/AutomationHub.test.tsx`

**Interfaces:**
- Consumes: Task 11 `RatioRunControl`·`run-control-shared`
- Produces: `AutomationRow` 의 수동 실행 칸이 `pendingDraft → DraftControl` / `localOnly → —` / **`conditionForm === "ratio-audit"` → `RatioRunControl`** / 그 밖 → `RunControl` 순으로 분기한다. 이 파일의 `ADMIN_ONLY_MSG` 상수와 두 버튼 클래스 문자열은 `run-control-shared` import 로 바꾼다(모양 변화 없음).

- [ ] **Step 1: 실패하는 테스트 작성** — 파일 머리 `vi.mock("@/features/automations/actions", …)` 에 `runRatioAuditAction: vi.fn()` 을 더한다.
```tsx
it("경쟁률 두 잡은 지금 실행이 조건 창을 연다 — 일반 실행 액션을 부르지 않는다", …ratio 상태로 클릭 → getByRole("dialog"), runAutomationAction 0회);
it("다른 잡은 일반 실행 그대로", …base 클릭 → dialog 없음);
it("두 지금 실행 버튼의 모양이 같다", () => {
  render(<AutomationHub statuses={[base, ratio]} />);
  const [a, b] = screen.getAllByRole("button", { name: "지금 실행" });
  expect(a.className).toBe(b.className);
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/app/dashboard/automations --maxWorkers=1`
- [ ] **Step 3: 구현**
- [ ] **Step 4: 실행해 통과 확인** — 같은 명령 전부 PASS(기존 AutomationHub 테스트 포함) + `npm test -- src/components/common src/__tests__ --maxWorkers=1`(레포 전역 표준 가드)
- [ ] **Step 5: 커밋** — `feat(automations): 경쟁률 점검 행에 조건 창 연결`

### Task 13: audit.py — 요청 id · 서버 대상 · 시작일 필터 제거 · 빈 대상은 로그인 안 함

**Files:**
- Modify: `scripts/moa-ratio/audit.py`
- Delete: `scripts/moa-ratio/listfilter.py`, `scripts/moa-ratio/test_listfilter.py`(구현자가 확인할 것: `grep -rn listfilter scripts` 결과가 audit.py 하나일 때만 지운다. 아니면 멈추고 보고한다)
- Test: `scripts/moa-ratio/test_audit_targets.py`(새 파일, unittest)

**Interfaces:**
- Consumes: Task 5 응답 `{ ok, targets, condition: { requestId, line } }` / 오류 `{ ok:false, code, error }`, Task 6 인제스트 `condition`
- Produces:
  - `REQUEST_ID_ENV = "RATIO_AUDIT_REQUEST_ID"`
  - `class TargetsUnavailable(RuntimeError)`
  - `fetch_targets(base_url: str, secret: str, request_id: str, http=requests) -> tuple[dict[int, dict], dict]` — `http.get(f"{base_url}/api/ratio-audit/targets", params={"requestId": request_id}, headers=…, timeout=30)`. 2xx 가 아니면 본문 JSON 의 `code`·`error` 를(JSON 이 아니면 `text[:200]` 을) 담아 `TargetsUnavailable(f"targets {status} {code}: {error}")` 를 던진다. 성공하면 `print(f"[OK] {condition['line']}")` 후 `({int(r["serviceId"]): r …}, condition)` 를 돌려준다
  - `build_payload(kind, scanned, findings, link_errors, skipped, condition) -> dict` — 기존 다섯 키 + `"condition": condition`
  - `_report(payload, out, dry_run, base_url, secret) -> int` — 지금 `main()` 끝의 '파일 저장 → DRY RUN 이면 0 → 인제스트 POST' 를 그대로 옮긴다
  - `main()` 변경(이 외에는 그대로):
    1. kind 검사 바로 뒤: `request_id = os.getenv(REQUEST_ID_ENV, "").strip()`. 비었으면 `print("[FAIL] RATIO_AUDIT_REQUEST_ID missing — 실행 조건은 요청이 정합니다(폴러가 넣습니다)")` 후 `return 1`(대상 조회·로그인 전)
    2. `try: targets, condition = fetch_targets(base_url, secret, request_id)` / `except TargetsUnavailable as e: print(f"[FAIL] {e}"); return 1`(로그인 전 — 폴러 보고 tail 의 마지막 줄이 이 줄이 된다)
    3. `if not targets:` → `print("[INFO] 대상 0건 — Moa 로그인 없이 빈 결과를 보고합니다")` → `return _report(build_payload(kind, 0, [], [], [], condition), …)`(드라이버를 만들지 않는다)
    4. 세팅·페이지 갈래 모두 `filter_by_start_date` 호출과 '시작일 필터 후' 출력을 없애고 원본 목록(`*_list_raw`)과 바로 교집합한다. 진단 함수에도 원본 목록을 넘긴다
    5. 끝: `return _report(build_payload(kind, scanned_count(...), findings, link_errors, skipped, condition), …)`
  - 모듈 docstring 흐름의 'listfilter.py 시작일 필터(9월 1일 이후)' 두 곳을 '대상 로딩(서버가 실행 조건·접수 마감 전으로 고른 집합, 요청 id 로 조회) → 대상 0건이면 로그인 없이 보고'로 고친다

- [ ] **Step 1: 실패하는 테스트 작성** — `FakeHttp`/`FakeRes`(status_code·ok·json()·text)로 GET 을 기록한다. main 테스트는 `unittest.mock.patch` 로 `audit.fetch_targets`·`audit.scrape.setup_driver`·`audit.scrape.sms_urls`·`audit._report` 를 바꾸고, `patch.dict(os.environ, {...})` 로 env 를 넣는다(구현자가 확인할 것: main 이 읽는 env 순서 — kind → 요청 id → base_url/secret → 자격 → 대상).
```python
COND = {"requestId": "00000000-0000-4000-8000-000000000001", "line": "조건: 2년제 · 수시 · 접수 마감 전 — 대상 1건"}

def test_대상_조회는_요청_id_를_쿼리로_보낸다(self):
    http = FakeHttp(FakeRes(200, {"ok": True, "targets": [{"serviceId": 9001001, "universityName": "테스트대학교A", "serviceName": "수시", "operatorName": "운영자A"}], "condition": COND}))
    targets, cond = audit.fetch_targets("https://ops.test", "s", COND["requestId"], http=http)
    self.assertEqual(http.calls[0]["params"], {"requestId": COND["requestId"]})
    self.assertEqual(list(targets), [9001001]); self.assertEqual(cond, COND)
def test_대상_조회_실패는_ASCII_코드와_이유를_담는다(self):
    http = FakeHttp(FakeRes(409, {"ok": False, "code": "missing_filters", "error": "실행 조건이 없는 요청입니다"}))
    with self.assertRaises(audit.TargetsUnavailable) as cm: audit.fetch_targets("https://ops.test", "s", COND["requestId"], http=http)
    self.assertIn("409 missing_filters", str(cm.exception))
def test_결과에_서버가_준_조건을_그대로_싣는다(self):
    p = audit.build_payload("page", 0, [], [], [], COND)
    self.assertEqual(p["condition"], COND); self.assertEqual(p["scannedCount"], 0); self.assertEqual(p["kind"], "page")
def test_요청_id_가_없으면_대상_조회도_로그인도_안_한다(self):  # env 에서 RATIO_AUDIT_REQUEST_ID 제거 → main() == 1, fetch_targets·setup_driver 0회
def test_대상_조회가_거절되면_로그인_전에_멈춘다(self):        # fetch_targets → TargetsUnavailable → main() == 1, setup_driver 0회
def test_대상이_0건이면_Moa_에_로그인하지_않는다(self):        # fetch_targets → ({}, COND) → main() == _report 반환값, setup_driver 0회, _report 의 payload condition == COND
```
- [ ] **Step 2: 실행해 실패 확인** — `python -X utf8 -m unittest discover -s scripts/moa-ratio -t scripts/moa-ratio -p "test_audit_targets.py" -v`
- [ ] **Step 3: 구현** — `main()` 은 원래 길다. `_report` 추출과 위 다섯 곳 말고는 손대지 않는다(Surgical). 파일이 800줄을 넘으면 멈추고 보고한다.
- [ ] **Step 4: 실행해 통과 확인** — 위 명령 + `python -X utf8 -c "import ast,sys; ast.parse(open('scripts/moa-ratio/audit.py', encoding='utf-8').read())"`
- [ ] **Step 5: 커밋** — `feat(moa-ratio): 요청 id 로 서버가 고른 대상만 점검, 시작일 필터 제거`

### Task 14: 폴러가 요청 id 를 넘긴다 + 원문 대조 테스트

**Files:**
- Modify: `scripts/moa-ratio/poll-local.ps1`
- Test: `src/features/ratio-audit/audit-requests/__tests__/poller-contract.test.ts`(새 파일)

**Interfaces:**
- Produces: `$env:RATIO_AUDIT_KIND = $kind` 바로 아래에 다음을 넣는다.
  ```powershell
  # 무엇을(대학구분·모집구분) 볼지는 서버가 이 요청 id 로 정한다 — 조건 값은 여기를 지나가지 않는다.
  # PowerShell 5.1 은 charset 없는 JSON 응답의 한글을 깨뜨리므로 ASCII 인 id 만 넘긴다.
  $env:RATIO_AUDIT_REQUEST_ID = $id
  ```
  claim·완료 보고 흐름은 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성** — 원문을 읽어(ps1 은 `#` 로 시작하는 줄, py 는 `#` 뒤를 지운 뒤) 대조한다. 파일 읽기 방식은 같은 폴더의 `stale-vs-timeout.test.ts` 를 따른다.
```ts
it("폴러는 claim 한 id 를 요청 id 로 넘긴다", () => expect(ps1).toMatch(/\$env:RATIO_AUDIT_REQUEST_ID = \$id/));
it("폴러는 조건 값을 다루지 않는다", () => expect(ps1).not.toMatch(/filters|univ|recruit/i));
it("audit.py 가 같은 이름으로 읽고 대상 API 에 requestId 로 보낸다", () => {
  expect(py).toContain('REQUEST_ID_ENV = "RATIO_AUDIT_REQUEST_ID"');
  expect(py).toMatch(/params=\{"requestId": request_id\}/);
});
it("Moa 시작일 필터를 쓰지 않는다 — 기간은 서버가 정한다", () => {
  expect(py).not.toMatch(/listfilter|filter_by_start_date|september_first/);
  expect(existsSync(join(ROOT, "scripts/moa-ratio/listfilter.py"))).toBe(false);
});
```
- [ ] **Step 2: 실행해 실패 확인** — `npm test -- src/features/ratio-audit/audit-requests/__tests__/poller-contract.test.ts --maxWorkers=1`(ps1 줄이 아직 없어 FAIL)
- [ ] **Step 3: 구현** — ps1 세 줄. 실행하지 않고 구문만 본다: `powershell -NoProfile -Command "$null = [scriptblock]::Create((Get-Content -Raw scripts/moa-ratio/poll-local.ps1))"`
- [ ] **Step 4: 실행해 통과 확인**
- [ ] **Step 5: 커밋** — `feat(moa-ratio): 폴러가 점검 요청 id 를 audit.py 에 넘긴다`

### Task 15: CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`(Edit 도구로만)

- [ ] **Step 1: 자동화 잡 표 두 행**
  - `ratio-audit`: 실행 칸을 `수동 실행 — [지금 실행] 조건 창(대학구분·모집구분, 기간은 접수 마감 전 고정) → 회사 PC 폴러가 수행 (cron 미등록)` 으로 바꾼다. 기능 칸 끝에 `대상은 고른 조건 × 접수 마감 전(closing_services.write_end_at ≥ 지금)` 을 붙인다
  - `ratio-page-check`: `대상은 StartDate ≥ 올해 9월 1일 — 수시 경쟁률이 열리는 9월부터 대상이 생깁니다` 를 `대상은 세팅 점검과 같은 조건 창으로 고른다(접수 마감 전)` 로 바꾼다. 실행 칸도 위와 같이 바꾼다
- [ ] **Step 2: '경쟁률 점검은 두 잡으로 나뉜다' 단락 끝에 한 단락 추가**
  > **[지금 실행]은 바로 적재하지 않고 조건 창을 띄운다** — 대학구분(4년제 / 2년제=`2년제`·`전문대`)·모집구분(수시=정확히 `수시`, 정시=`정시`로 시작하는 값 전부)을 각각 하나 이상 골라야 실행되고, 기간은 접수 마감 전으로 고정이다. 조건은 요청 행(`ratio_audit_requests.filters`)에만 적고 폴러는 **요청 id 만** 넘긴다 — 대상은 서버(`/api/ratio-audit/targets?requestId=`)가 고른다(PS 5.1 이 한글 조건을 깨뜨리지 않게). Moa 목록 시작일 필터(올해 9월 1일)는 없앴다 — 1~2월에 12월 시작 정시를 빼던 결함. 대상이 0건이면 적재하지 않는다(Moa 인증 문자 없음). 관리자 메시지 머리와 실행 로그 끝에 `조건: … — 대상 N건` 이 붙는다. 두 잡의 `run()` 은 적재하지 않는다(조건 없는 요청 금지). 설계: `docs/superpowers/specs/2026-11-10-ratio-audit-run-filters-design.md`
- [ ] **Step 3: 확인** — `grep -n "올해 9월 1일" CLAUDE.md` 결과가 위 단락의 '없앴다' 문장 하나뿐인지 본다.
- [ ] **Step 4: 커밋** — `docs: 경쟁률 점검 실행 조건 창 반영`

### Task 16: 검증 · PR · 실운영 런북 (STOP)

- [ ] **Step 1: 관련 테스트 전부** — 아래 셋을 차례로 돌린다(메모리 때문에 나눈다). 셋 다 0 failures 여야 한다.
  1. `npm test -- src/features/ratio-audit src/app/api/ratio-audit src/app/dashboard/automations --maxWorkers=1`
  2. `npm test -- src/features/automations src/app/api/automations src/features/agent-org src/app/dashboard/settings --maxWorkers=1`
  3. `npm test -- src/components/common src/__tests__ --maxWorkers=1`
  
  그다음 `python -X utf8 -m unittest discover -s scripts/moa-ratio -t scripts/moa-ratio -p "test_audit_targets.py" -v` → OK, `npm run typecheck` → 0, `npm run lint -- src/features/ratio-audit src/features/automations src/app/api/ratio-audit src/app/dashboard/automations` → 0.
- [ ] **Step 2: 개인정보 스캔** — `git diff main...HEAD` 에서 `010-[0-9]`, `@[a-z0-9.-]+\.(com|kr|net)`(테스트의 `x.com` 같은 가짜 도메인은 제외), 실제 학교·사람 이름이 없는지 grep 한다. 있으면 고친다.
- [ ] **Step 3: 실데이터 distinct 확인(읽기 전용, 결정 4)** — 컨트롤러가 service_role 로 `closing_services` 의 `category`·`university_type` distinct 목록과 건수를 조회한다(값만, 사람 이름 없음). 정시 접두에 걸리는 값 목록을 PR 본문에 적는다. 군이 아닌 값(예: `정시 재외국민`)이 있으면 사용자에게 알린다(규칙은 바꾸지 않는다).
- [ ] **Step 4: PR** — 제목 `feat: 경쟁률 점검 실행 조건 창 — 대학구분·모집구분·접수 마감 전`. 본문에는 `## Summary`, `## Test plan`(위 명령·결과 수치), **머지 전 DB 적용 확인**(Task 1 Step 6), **배포 직후 회사 PC `git pull` 필수**(스펙 §6), Step 3 의 distinct 목록을 넣는다. 끝에 `🤖 Generated with [Claude Code](https://claude.com/claude-code)` 와 세션 URL 을 붙인다.
- [ ] **Step 5: STOP — 머지·배포 후 실운영 런북(컨트롤러 + 사용자, 문자 최대 3통 — 시작 전에 알리고 승인을 받는다).** 평일 09:00 마감 스크랩과 겹치지 않는 시각에 한다(우편함 점유 409).
  1. 사용자가 원래 폴더에서 `git pull` 한다(작업 스케줄러는 워킹트리를 실행한다). main 체크아웃인지 확인한다. `select status, count(*) from ratio_audit_requests where filters is null group by status` 에 pending 이 없는지 본다.
  2. 화면에서 '경쟁률 세팅 점검' [지금 실행] → 창이 빈 상태이고 [실행]이 꺼져 있는지 본다. 비admin 계정은 알럿만 뜨는지 본다. 조건 하나(예: 2년제 · 수시)를 골라 실행한다 → 버튼 아래에 `[접수] … 조건: 2년제 · 수시 · 접수 마감 전 — 대상 N건` 이 뜬다.
  3. 대상 API 로 같은 조건을 확인한다(문자 없음, 읽기 전용): `curl.exe -s -H "Authorization: Bearer <CRON_SECRET>" "<BASE>/api/ratio-audit/targets?requestId=<그 요청 id>" | python -X utf8 -c "import json,sys; d=json.load(sys.stdin); print(d['condition']['line'], len(d['targets']))"` — 사람 이름이 출력되지 않게 줄과 건수만 찍는다.
  4. 5분 안에 `scripts\moa-ratio\poll-local.log` 에 claim 줄과 `[OK] 조건: …` 줄이 찍히고, '시작일 필터' 문구가 없는지 본다. 사용자 폰에 문자 1통(①)이 온다. 끝나면 자동화 실행 로그 메시지가 `(조건: …)` 로 끝나는지 본다. 관리자 노트 채팅이 왔다면 제목 아래 조건 줄이 있는지 본다.
  5. **페이지 점검은 먼저 DRY RUN 으로 한다**(스펙 §7-2). 원래 폴더에서 `$env:RATIO_AUDIT_KIND="page"; $env:RATIO_AUDIT_REQUEST_ID="<2의 요청 id>"; $env:RATIO_AUDIT_DRY_RUN="true"; python -u scripts\moa-ratio\audit.py`(문자 ②, 발송 없음)를 돌린다. 결과 파일의 linkErrors 중 오픈 예정(`write_start_at > 지금`) 서비스의 비율을 컨트롤러가 대상 API 결과와 맞대어 센다. **오픈 예정에 404 가 몰리면 실발송하지 말고 멈춰서 사용자에게 보고한다.**
  6. 괜찮으면 화면에서 '경쟁률 페이지 점검'을 같은 방식으로 실행한다(문자 ③). 실행 로그에 `(조건: …)` 가 붙고, 담당자 개인 채팅이 정상인지 본다.

---

## Self-Review (작성자 점검 결과)

- **스펙 대조:** §2 사용자 결정 — 조건 창·두 점검 공통 → Task 9·11·12 / 대학구분·모집구분 규칙 → Task 2 / 빈 상태·각각 하나 이상 → Task 2(zod)·11(버튼) / 기간 접수 마감 전 → Task 3. 설계 결정 1(요청 id) → Task 4·5·13·14, 2(시작일 필터 제거) → Task 13·14, 3(조건 없는 요청) → Task 1·5·13, 4(조건 없는 적재 경로 차단) → Task 8·10, 5(0건) → Task 10·13, 6(조건 한 줄) → Task 6·7, 7·8(매핑·근거) → Task 2, 9(버튼 클래스) → Task 11·12. §4 실패로 볼 것 1~7 → Review Focus 1~6 + Task 14(PS 를 지나는 값은 id 뿐). §6 배포 순서 → Task 16 Step 4·5.
- **이름 일관성:** `RatioAuditFilters`·`ratioAuditFiltersSchema`·`matchesRatioAuditFilters`·`conditionLine`·`ratioFilterLabel`·`RATIO_RUN_NEEDS_CONDITIONS`(Task 2 → 3·5·8·10·11), `listRatioAuditTargets(filters, now)`(Task 3 → 5·10), `enqueueLocalAuditRequest(requestedBy, now, kind, filters)`(Task 4 → 10), `loadRequestFilters`(Task 5), `ratioRunConditionSchema`·`condition { requestId, line }`(Task 5·6 → 7·13), `RATIO_AUDIT_JOB_IDS`·`ratioKindOfJob`(Task 8 → 10), `conditionForm: "ratio-audit"`(Task 9 → 11·12), `runRatioAuditAction`·`runBlocker`(Task 10 → 11), `RUN_NOW_CLASS`·`RUN_COOLDOWN_CLASS`·`ADMIN_ONLY_MSG`(Task 11 → 12), `RATIO_AUDIT_REQUEST_ID`·`REQUEST_ID_ENV`·`TargetsUnavailable`·`build_payload`·`_report`(Task 13 → 14) 를 대조했다.
- **확인 못 한 세부:** 각 태스크의 '구현자가 확인할 것' 줄로 남겼다 — ModalShell 위치·props, `getAutomationStatuses` 매핑 자리, `feature-intro-pins` 고정 문구, `enqueueLocalAuditRequest`·`listfilter` 의 다른 호출처, 기존 테스트 헬퍼 이름, Python 테스트 인터프리터의 selenium import.
