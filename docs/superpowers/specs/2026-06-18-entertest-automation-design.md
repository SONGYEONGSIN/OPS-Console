# entertest 원서접수 케이스별 테스트 자동화 — 설계 (Subsystem A)

> 상위 요청은 개발·테스트 메뉴 신규 2기능. 본 스펙은 **A. 원서접수 테스트 자동화**만 다룬다.
> B(고객 TR/TD 영역 선택 수정요청)는 별도 스펙으로 분리한다.

**작성일**: 2026-06-18
**대상 메뉴**: `/dashboard/dev-test` (현재 placeholder slug → 실체화)
**테스트 대상**: `https://entertest.jinhakapply.com/Notice/{serviceId}/A` (예: `/Notice/1098146/A`)

---

## 1. 목표

운영자가 OPS `/dashboard/dev-test`에서 원서접수 **테스트 URL + 본인 테스트계정**으로 표준 케이스
자동 테스트를 실행하고, **케이스별 PASS/FAIL · 실패 스크린샷 · 실행 이력**을 확인한다.

검증 가능한 성공 기준:
- 운영자가 버튼 1회로 테스트 실행을 요청할 수 있다
- 회사 PC 러너가 실제 브라우저로 로그인→작성→테스트 결제 접수완료까지 완주하고 케이스별 결과를 적재한다
- dev-test 페이지에서 실행 이력과 케이스별 상세(PASS/FAIL + 스크린샷)를 볼 수 있다

## 2. 배경 / 제약 (조사 결과)

- **entertest는 Cloudflare + 브라우저 게이트**: plain HTTP fetch는 `접속중인 브라우저는 사용이 불가능`
  alert로 차단됨. Chrome/Edge 실제 브라우저 필요. jinhakapply 계열이라 데이터센터 IP는 CF 차단 가능성 →
  **회사 PC(residential IP) + 실제 Chrome 필수**.
- **로그인은 단순**: entertest 테스트 로그인은 **2단계 인증·CAPTCHA 없음**. 테스트 **ID/PW만 입력**
  (Moa 운영자 로그인과 다름). 계정 규칙: **ID = PW 동일**.
- **테스트 계정은 운영자별로 다름** (jt29001~jt29999 중 운영자마다 본인 계정). 글로벌 풀 회전이 아니라
  **실행한 운영자 본인 계정**을 사용한다.
- **실결제 위험 없음**: 테스트 서버이며 '테스트 결제' 버튼으로 접수 완료까지 완주 가능. 실결제 불가.
- **기존 재사용 자산**: closing(Moa 서비스마감) 스크래핑이 동일 인프라를 이미 검증.
  - `scripts/moa-closing/` — Python + Selenium(undetected-chromedriver), 회사 PC 작업 스케줄러
  - pull 기반 트리거: 웹 버튼 → DB pending → 회사 PC 폴러 claim → 로컬 실행 → 결과 인제스트
  - `src/features/closing/scrape-requests/` (actions/queries/schemas) + `src/app/api/closing/{scrape-request,ingest,run-log}`
  - `scripts/moa-closing/{poll-local.ps1,run-local.ps1,register-poll-task.ps1,scrape.py}`

## 3. 접근법 결정

**Python + Selenium 로컬 러너 (closing 패턴 100% 재사용)** — 검증된 CF 우회(undetected-chromedriver),
pull 트리거, 인제스트 패턴을 그대로 사용. Playwright(TS) 재구현은 CF 통과 미검증이라 제외.

## 4. 아키텍처 (pull 기반, closing 동치)

```
[운영자] dev-test "테스트 실행"
   └─> entertest_test_runs INSERT (status=pending, target_url, test_account, requested_by)
[회사 PC 폴러] (작업 스케줄러 N분 간격)
   ├─ GET  /api/entertest/test-request           → pending 1건 claim (status=running)
   ├─ run-local.ps1 → test_run.py (Python+Selenium)
   │     로그인(ID/PW) → 원서접수 흐름 진행 → 표준 케이스 검증 → 실패 시 스크린샷
   ├─ POST /api/entertest/ingest                  → 케이스별 결과 + 스크린샷 적재 (status=done/failed)
   └─ POST /api/entertest/test-request            → 완료 보고
[dev-test] 이력 + 케이스별 상세 렌더
```

## 5. 데이터 모델

### 5.1 마이그레이션 — `entertest_test_runs`

```sql
create table public.entertest_test_runs (
  id uuid primary key default gen_random_uuid(),
  requested_by text not null,            -- operators.email
  requested_at timestamptz not null default now(),
  target_url text not null,
  test_account text,                     -- 실행 시 스냅샷(운영자 본인 계정 ID). null이면 미해결
  status text not null default 'pending' -- pending|running|done|failed|error
    check (status in ('pending','running','done','failed','error')),
  claimed_at timestamptz,
  finished_at timestamptz,
  result jsonb,                          -- { checks:[{key,label,status,message,screenshot_url}], summary:{pass,fail,total} }
  error_message text
);
alter table public.entertest_test_runs enable row level security;
-- 운영부 공개 read
create policy entertest_test_runs_read on public.entertest_test_runs for select using (true);
-- 쓰기는 service_role만 (server only) — 별도 정책 없이 service_role 우회
grant select on public.entertest_test_runs to authenticated;
```

`result.checks[].status`: `pass | fail | skip`.
`result.checks[].screenshot_url`: 실패 시 Supabase Storage signed URL (성공 시 생략).

### 5.2 마이그레이션 — `operators.entertest_account`

```sql
alter table public.operators add column if not exists entertest_account text;
comment on column public.operators.entertest_account is 'entertest 원서접수 테스트 계정 ID (ID=PW 동일). 운영자별 상이.';
```

### 5.3 Supabase Storage

- 버킷 `entertest-screenshots` (private). 러너가 service_role로 업로드 → ingest가 signed URL 생성하여
  `result.checks[].screenshot_url`에 저장. 경로: `{run_id}/{check_key}.png`.

## 6. 표준 체크 (확장 가능)

체크는 러너 내부 `CHECKS` 리스트로 정의: `{ key, label, run(driver, ctx) -> (status, message, screenshot?) }`.
**확장 = 리스트 1 항목 추가.**

### v1 표준 체크 (가설 → 구현 Task 1에서 실측 확정)

| key | label | 검증 |
|---|---|---|
| `page_load` | 페이지 로드 | Notice 안내 페이지 정상 렌더(브라우저 게이트 통과 포함) |
| `login` | 로그인/접수 진입 | 테스트 계정(ID/PW)으로 로그인 → 작성 화면 진입 |
| `fill_steps` | 작성 단계 진행 | 전형/학과 선택 + 필수 입력 채우고 다음 단계 통과 |
| `required_validation` | 필수항목 검증 동작 | 빈 값/오입력 제출 시 검증 메시지 노출 확인 |
| `test_payment_complete` | 테스트 결제 접수완료 | '테스트 결제' 버튼으로 접수 완료 → 접수번호/완료 화면 검증 |

> **구현 Task 1 = DOM 디스커버리**: 회사 PC에서 인증 로그인 후 실제 원서접수 흐름의 단계·셀렉터를
> 스냅샷/codegen으로 캡처한다. 위 5개는 스캐폴드 가설이며 실측으로 셀렉터·단계를 확정한다.

## 7. API (Bearer `CRON_SECRET`, proxy PUBLIC_PATHS 등록 필수)

closing scrape-request/ingest 라우트와 동치 구조.

### 7.1 `/api/entertest/test-request`
- `GET`: pending 1건을 `running`으로 claim하여 반환 (`{ request: {id, target_url, test_account, requested_by} }` 또는 `{request: null}`)
- `POST` `{ id, ok, message }`: 폴러 완료 보고 (ok=false → status=error, message 적재)

### 7.2 `/api/entertest/ingest`
- `POST` `{ id, status, result, error_message? }` (zod 검증): 케이스별 결과 적재 → status=done/failed
- 스크린샷: 러너가 먼저 service_role로 Storage에 업로드 → `result.checks[].screenshot_url`에 경로/URL만 담아 POST (multipart 미사용)

> **proxy.ts PUBLIC_PATHS에 `/api/entertest/test-request`, `/api/entertest/ingest` 등록** —
> 미등록 시 미인증 호출이 `/login` HTML로 리다이렉트됨 (closing #550 동일 교훈).

## 8. 회사 PC 러너 (`scripts/entertest/`)

| 파일 | 역할 |
|---|---|
| `poll-local.ps1` | 작업 스케줄러가 N분마다 호출. pending claim → run-local 실행 → 완료 보고 (moa-closing/poll-local.ps1 복제) |
| `run-local.ps1` | venv 활성화 + `test_run.py` 실행 |
| `test_run.py` | Python+Selenium. 로그인→흐름 진행→표준 체크→스크린샷→ingest POST |
| `register-poll-task.ps1` | 작업 스케줄러 등록 |
| `requirements.txt` | selenium, undetected-chromedriver, python-dotenv, requests |

- `.env.local`: `CRON_SECRET`, `OPS_CONSOLE_BASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`(스크린샷 업로드), `SUPABASE_URL`
- 계정: claim 응답의 `test_account`(운영자 본인 계정) 사용, PW = 계정 ID와 동일
- 실패 시 해당 체크 스크린샷 캡처 후 다음 체크 진행(또는 치명적 단계 실패 시 이후 skip)

## 9. dev-test 페이지 (`/dashboard/dev-test/`)

- `page.tsx`: 서버 컴포넌트 — 본인 operator + 실행 이력 fetch
- **상단 패널**: 테스트 URL 입력(기본값 `https://entertest.jinhakapply.com/Notice/1098146/A`) +
  본인 계정 표시(`operators.entertest_account`, 없으면 "설정 필요" 안내) + "테스트 실행" 버튼
- **하단 이력 테이블**: 상태 배지 / 요청시각 / 요청자 / 요약(pass/fail) → 행 클릭 시 케이스별 PASS/FAIL + 스크린샷
- 계정 미등록 시: 본인 계정 등록 입력(설정 또는 dev-test 내) → `operators.entertest_account` 업데이트 액션
- 권한: 기존 메뉴 권한(allowed_menus) 따름 (admin 전용 아님)

서버 액션:
- `requestEntertestRun(targetUrl)`: 본인 계정 해결 → pending insert (`features/entertest/actions.ts`)
- `setMyEntertestAccount(account)`: operators.entertest_account 업데이트

## 10. TDD (단위 테스트 대상)

순수 로직/라우트 — Vitest:
- `features/entertest/result.ts` — 체크 결과 → summary 집계 (pass/fail/total)
- `features/entertest/schemas.ts` — ingest/test-request zod 스키마 검증
- `app/api/entertest/test-request/route.ts` — claim(pending→running) / 완료 보고 분기
- `app/api/entertest/ingest/route.ts` — 결과 적재 + 잘못된 페이로드 거부

Python `test_run.py`는 회사 PC 실측(E2E 성격)으로 검증 — DOM 디스커버리(Task 1) 결과로 셀렉터 확정 후
실 실행으로 happy-path 완주 확인.

## 11. 안전장치

- 실결제 불가능한 테스트 서버 + 테스트 결제 버튼 → 결제 안전장치 불필요
- 로그인/단계 실패 시: 명확한 에러 메시지 + 실패 스크린샷, status=failed/error
- 동시 실행: v1은 폴러가 1건씩 claim (단일 동시). 병렬은 확장

## 12. 범위 (YAGNI)

**v1 포함**: 표준 체크 5개(실측 확정) + 단일 동시 실행 + 이력/상세 UI + 본인 계정 자동 사용

**v1 제외(확장)**: 병렬 실행, 스케줄(정기 자동), 실패 알림(메일/Teams), 서비스별 맞춤 케이스 등록,
Subsystem B(고객 TR/TD 수정요청 — 별도 스펙)

## 13. 영향받는 파일 (요약)

신규:
- `supabase/migrations/20260618_entertest_test_runs.sql`, `20260618_operators_entertest_account.sql`
- `src/features/entertest/{schemas,result,queries,actions}.ts` (+ `__tests__`)
- `src/app/api/entertest/{test-request,ingest}/route.ts` (+ `__tests__`)
- `src/app/dashboard/dev-test/{page.tsx,DevTestClient.tsx,_runs.ts}` 등
- `scripts/entertest/{poll-local.ps1,run-local.ps1,test_run.py,register-poll-task.ps1,requirements.txt}`

수정:
- `src/proxy.ts` — PUBLIC_PATHS에 entertest API 2개 추가
- (sidebar dev-test slug는 이미 존재 — 페이지만 실체화)
