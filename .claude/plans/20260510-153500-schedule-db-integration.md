---
plan_id: 20260510-153500-schedule-db-integration
status: in_progress
created: 2026-05-10T15:35:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260510-152800-schedule-db-integration.md
---

# Plan: schedule DB 연동

## Goal

`/dashboard/schedule`을 mock(`[slug]` dynamic fallback)에서 영구 저장 게시판으로 전환. 운영자 매일 입실 첫 화면으로서 팀 공통 일정 공유 + 본인 일정 자율 관리. admin은 전체 CRUD, member는 본인 일정만 수정/삭제, 모두 read 가능.

## Approach

posts epic의 풀스택 패턴을 `schedule_events` 테이블로 미러링. 단일 테이블 + type enum (`shift / event / leave / training`). RLS는 모두 select / 본인+admin update·delete 패턴. ListPattern에는 일정 도메인 1차 정보(시간축)에 맞춘 `schedule` variant 신설 (post 재해석 비추 — 라벨 의미 왜곡 + 후속 my-todo/handover에서 깨짐).

## Out of Scope

- my-todo / handover 도메인 (별도 epic — 모델 의존성)
- 반복 일정 / 캘린더 뷰 / 알림 / 댓글
- sidebar count 동적화 (현재 `_data.ts` hardcode "14")
- ListPattern variant 6개째 도달 시 컴포지션 리팩토링 (본 PR 후속 follow-up)

## 영향 파일

| 파일 | 변경 | 설명 |
|---|---|---|
| `supabase/migrations/20260513_schedule_events_table.sql` | 신규 | 테이블 + 시드 3건 + index + trigger |
| `supabase/migrations/20260513b_schedule_events_rls.sql` | 신규 | RLS 4정책 + GRANT (auth+service_role) |
| `src/features/schedule/schemas.ts` | 신규 | row/create/update zod + type enum |
| `src/features/schedule/queries.ts` | 신규 | `listScheduleEvents()` |
| `src/features/schedule/actions.ts` | 신규 | create/update/delete + 권한 helper |
| `src/features/schedule/__tests__/schemas.test.ts` | 신규 | RED 테스트 |
| `src/features/schedule/__tests__/permission.test.ts` | 신규 | canEdit 분기 |
| `src/app/dashboard/schedule/page.tsx` | 신규 | RSC + onPersist |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 | `schedule` variant + 컬럼/필터 |
| `src/app/dashboard/_components/inspector/InspectorListBody.tsx` | 수정 | schedule 편집 UI (start_at/end_at/type) |
| `src/app/dashboard/_data/page-meta-config.ts` | 수정 | schedule.description 추가 |
| `e2e/schedule.spec.ts` | 신규 | 권한 분기 3 시나리오 |

추가 후보: `scripts/cleanup-test-schedule.mjs` (e2e 정리). 13파일 시 여전히 간략.

## 단계

### T1: zod 스키마 RED 테스트
- **상태**: pending
- **파일**: `src/features/schedule/__tests__/schemas.test.ts`
- **변경**: `scheduleEventCreateSchema` parse 케이스 — type enum 4종 / end_at < start_at reject / title 빈문자 reject
- **DoD**: `npm test -- schedule/schemas` fail (모듈 없음)
- **의존**: 없음 (T3과 병렬 시작 가능)

### T2: zod 스키마 GREEN
- **상태**: pending
- **파일**: `src/features/schedule/schemas.ts`
- **변경**: row / create / update + `z.refine(end >= start)` + type enum
- **DoD**: T1 테스트 통과
- **의존**: T1

### T3: 마이그레이션 — 테이블 + 시드
- **상태**: pending
- **파일**: `supabase/migrations/20260513_schedule_events_table.sql`
- **변경**: posts 미러 + `start_at/end_at timestamptz / type text check / assignee_email / all_day bool`. 시드 3건(shift/event/leave 각 1). `notify pgrst`.
- **DoD**: Supabase SQL Editor 실행 → `select count(*) from schedule_events` = 3
- **의존**: 없음 (T1과 병렬)

### T4: 마이그레이션 — RLS + GRANT
- **상태**: pending
- **파일**: `supabase/migrations/20260513b_schedule_events_rls.sql`
- **변경**: select=true / insert·update·delete = `is_admin() OR assignee_email = jwt email` (OR 풀어쓰기). GRANT auth+service_role. `notify pgrst`.
- **DoD**: `pg_policies`에서 4정책 확인. service_role 시드 insert 통과.
- **의존**: T3

### T5: 권한 helper 테스트 RED + GREEN
- **상태**: pending
- **파일**: `src/features/schedule/__tests__/permission.test.ts`, `src/features/schedule/actions.ts` (canEdit만 export)
- **변경**: admin 모두 / member 본인만 / viewer 차단
- **DoD**: vitest 통과
- **의존**: T2

### T6: queries + actions 본체
- **상태**: pending
- **파일**: `src/features/schedule/queries.ts`, `src/features/schedule/actions.ts`
- **변경**: `listScheduleEvents()` (start_at asc), create/update/delete + `revalidatePath("/dashboard/schedule")`
- **DoD**: typecheck 통과 + 다음 단계 page에서 import OK
- **의존**: T2, T4, T5

### T7: ListPattern `schedule` variant
- **상태**: pending
- **파일**: `src/app/dashboard/_components/patterns/ListPattern.tsx`, `InspectorListBody.tsx`
- **변경**: variant 추가 / 컬럼(시각·타입·담당·상태) / 필터(전체·shift·event·leave·training) / 신규 blank `{type:"shift", start_at:now, ...}`
- **DoD**: 다음 page 구동 시 시각 검증 가능
- **의존**: T2 (타입)

### T8: schedule/page.tsx + meta
- **상태**: pending
- **파일**: `src/app/dashboard/schedule/page.tsx`, `src/app/dashboard/_data/page-meta-config.ts`
- **변경**: RSC, `listScheduleEvents` → ListRow 매핑, onPersist, `requireMenu("schedule")`. meta description 추가.
- **DoD**: 로컬 `/dashboard/schedule` 시드 3건 표시, 새로고침 유지
- **의존**: T6, T7

### T9: e2e 스펙
- **상태**: pending
- **파일**: `e2e/schedule.spec.ts`, 필요 시 `scripts/cleanup-test-schedule.mjs`
- **변경**: ① admin 작성→optimistic ② member 본인 일정 수정 ③ member 타인 일정 수정 시도 alert
- **DoD**: `npm run test:e2e -- schedule --workers=1` 통과
- **의존**: T8

### T10: 마무리 검증
- **상태**: pending
- **파일**: 없음 (실행만)
- **변경**: `npm run build && npm run lint && npm run typecheck`
- **DoD**: 모두 0 에러
- **의존**: T9

DAG: `T1→T2`, `T3→T4`, `T2+T4→T5→T6`, `T2→T7`, `T6+T7→T8→T9→T10`. T1·T3 병렬 시작.

## 리스크

- **R1 RLS 회귀** (member가 admin 일정 수정 가능): T4 끝나고 SQL Editor에서 member JWT로 수동 update 시도 → 0 rows 확인. e2e T9에 RLS 차단 케이스 포함.
- **R2 ListPattern 분기 폭증** (현재 default/team/post×2 + schedule = 5): 6개째(my-todo) 전에 컴포넌트 분리 follow-up. 본 PR 스코프 외.
- **R3 timestamptz/KST 표기 어긋남**: `Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul', hour:'2-digit', minute:'2-digit'})` helper 한 곳에서만. posts `formatKstDate` 패턴 재사용.
- **R4 `language plpgsql` $$ 파서**: helper 추가 없음(기존 `is_admin()` 재사용)으로 회피.
- **R5 e2e cleanup 누락**: `[E2E]` 접두어 + `cleanup-test-schedule.mjs` `afterEach` 강제.

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T15:35:00Z | plan | created | brainstorm 20260510-152800 기반, 사용자 yes |
| 2026-05-10T15:51:00Z | T1+T2+T5+T6 | done | 27/27 vitest GREEN, typecheck OK |
| 2026-05-10T15:52:00Z | T3+T4 | done | 마이그레이션 SQL 작성 — Supabase SQL Editor 실행 대기 |
| 2026-05-10T15:55:00Z | strategy | split | PR-A(백엔드) 분리 머지 → SQL 실행 → PR-B(UI) |
| 2026-05-10T16:14:00Z | T7+T8 | done | PR-B 머지 (#25), dev 시각 검증 OK |
| 2026-05-10T16:25:00Z | T9 | done | e2e 3 시나리오 (admin 작성 / member 노출 / viewer 차단) PASS |
