# dev-test 재설계 — closing_services 기반 목록 + 전용 패널 (Subsystem A v2)

> v1(standalone DevTestClient)을 대체한다. 같은 브랜치 `feat/entertest-automation`에서 완성 후 일괄 머지.
> 구현 방식 (나): `dashboard/dev-test/` 내 격리 구현 — 공유 list-variants 인스펙터(ViewProps/registry) **미변경**.

**작성일**: 2026-06-18

## 1. 목표

운영자가 `/dashboard/dev-test`에서 **서비스 마감 실데이터(closing_services)** 목록을 칩필터로 좁혀 보고,
서비스 행을 클릭하면 전용 패널에서 그 서비스의 **테스트 URL(유도) · 본인 테스트계정 · 테스트 실행 ·
실행 로그**를 보고 실행할 수 있다.

성공 기준:
- closing_services 483건이 표준룩 목록으로 보이고, category/region/university_type/admission_type 칩 +
  검색(대학명·서비스명) + 페이지네이션이 동작한다
- 행 클릭 → 패널에 `https://entertest.jinhakapply.com/Notice/{service_id}/A` 표시
- 패널에서 본인 계정 등록/수정, "테스트 실행" → 그 서비스에 대한 pending 생성
- 패널에 해당 서비스의 실행 로그(케이스별 PASS/FAIL + 실패 스크린샷)가 보인다

## 2. 핵심 결정 (조사로 확정)

- **테스트 URL = `https://entertest.jinhakapply.com/Notice/{service_id}/A`** — closing_services.service_id(7자리)로
  유도. 확인: service_id `1098146` = 숙명여대 2026 Fall(테스트 URL과 일치). 수동 URL 입력 불필요.
- **테스트 계정 = 운영자별**(`operators.entertest_account`, ID=PW 동일). 현행 유지 — 모든 서비스에 본인 계정 사용.
- closing_services 483건은 작아 **서버 1회 fetch → 클라이언트 필터/페이지네이션**(쿼리 변경·공유 계약 변경 회피).

## 3. 데이터 모델 변경 (최소)

마이그레이션 `supabase/migrations/20260628_entertest_runs_service_id.sql`:
```sql
alter table public.entertest_test_runs add column if not exists service_id bigint;
-- 인스펙터 로그를 서비스별로 필터하려면 authenticated가 service_id를 읽어야 한다 → 컬럼 grant에 추가.
grant select (id, requested_by, requested_at, target_url, status, claimed_at, finished_at, result, error_message, service_id)
  on public.entertest_test_runs to authenticated;
create index if not exists entertest_test_runs_service_idx on public.entertest_test_runs (service_id);
```
- `operators.entertest_account` 유지. `test_account` 비노출(컬럼 grant 제외) 유지.

## 4. 컴포넌트/파일

- `src/app/dashboard/dev-test/page.tsx` (서버) — closing_services 라이트 목록 + 본인 계정 + 최근 runs(service_id 포함) fetch → 클라이언트로 전달
- `src/app/dashboard/dev-test/DevTestClient.tsx` (클라이언트, 컨테이너) — 좌측 목록 + 우측 패널 상태 관리
- `src/app/dashboard/dev-test/DevTestList.tsx` (클라이언트) — 칩필터(category/region/university_type/admission_type) + 검색 + 페이지네이션 + 행 클릭 select. 공통 컴포넌트(ListSearch·ListSelect·ListPagination) 재사용
- `src/app/dashboard/dev-test/DevTestInspector.tsx` (클라이언트) — 선택 서비스의 URL·계정·실행 버튼·로그
- v1의 단일 DevTestClient 내용은 위 구조로 재작성(파일명 유지, 내용 교체 + 보조 파일 신설)

## 5. features/entertest 변경

- `schemas.ts`: `entertestRunSchema`에 `service_id: z.number().nullable()` 추가. (ingest 스키마 불변 — service_id는 insert 시점에만 기록)
- `queries.ts`:
  - `listEntertestRuns`: select에 `service_id` 추가
  - 신규 `listTestableServices()`: closing_services 라이트 컬럼 전체(service_id, university_name, service_name, category, region, university_type, admission_type, operator_name, write_end_at) — `created_at` 무관, 최신 마감일/대학명 정렬
- `actions.ts`:
  - `requestEntertestRun` 시그니처 변경: `targetUrl` 대신 **`serviceId`**(FormData hidden field). 서버에서 `https://entertest.jinhakapply.com/Notice/{serviceId}/A` 유도. 본인 계정 조회 → pending insert에 `service_id` + 유도 URL + 계정. 중복 가드(전역 pending/running) 유지
  - `setMyEntertestAccount`: 불변

## 6. 러너/API 변경

- 없음. `test_run.py`는 claim의 `target_url`을 사용(유도된 URL이 들어옴). `ingest`/`test-request`는 그대로.
  (test-request claim select는 `target_url, test_account` 반환 — 변경 불필요. service_id는 러너가 몰라도 됨.)

## 7. UI 상세

좌측 목록(표준룩):
- 칩/셀렉트 4종: category·region·university_type·admission_type (각 distinct 값). 다중 선택 아닌 단일 선택 + "전체"
- 검색: 대학명·서비스명 contains
- 페이지네이션: 클라이언트, pageSize 30
- 행: `대학명 — 서비스명(service_id)` + 카테고리/지역/운영자/마감일. 선택 시 하이라이트

우측 패널(선택 시):
- 헤더: `대학명 — 서비스명(service_id)`
- 테스트 URL: `https://entertest.jinhakapply.com/Notice/{service_id}/A` (복사 가능 텍스트)
- 테스트 계정: 본인 계정 표시 + 등록/수정 인풋(jt##### 검증) — 미등록 시 경고
- "테스트 실행" 버튼: 계정 미등록/실행중이면 비활성. 클릭 → requestEntertestRun(serviceId)
- 실행 로그: 이 service_id의 runs 최신순 — 상태 배지 + 요약(pass/total) + 펼치면 케이스별 ✓/✗ + 실패 스크린샷 링크

## 8. 범위 (YAGNI)

- v1 체크 로직(5 stage-reachability)·러너·DB 기반은 그대로 재사용
- 칩필터는 단일 선택(다중선택·조합필터는 비범위)
- Subsystem B(원서작성 폼 풀 자동완주)는 여전히 별도 후속

## 9. 검증

- 단위: schemas(service_id nullable 파싱), actions(requestEntertestRun URL 유도) — TDD 가능 범위
- typecheck/lint/build
- E2E: dev-test에서 특정 서비스 행 클릭 → URL 유도 확인 → 테스트 실행 → 폴러 → 로그에 해당 서비스 5/5
