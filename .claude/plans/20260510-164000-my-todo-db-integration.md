---
plan_id: 20260510-164000-my-todo-db-integration
status: in_progress
created: 2026-05-10T16:40:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260510-163500-my-todo-db-integration.md
---

# Plan: my-todo DB 연동

## Goal

`/dashboard/my-todo`를 mock(`[slug]` fallback)에서 영구 저장 본인 전용 다이어리로 전환. 운영자가 매일 입실 후 schedule 옆에서 오늘 할 일을 체크하고 done 토글로 즉시 완료 표시.

## Approach

schedule 풀스택 패턴을 `todos` 테이블로 미러링하되 RLS는 본인 only(`assignee_email = jwt email OR is_admin()`)로 변경. ListPattern `my-todo` variant 추가 — 우선순위·제목·마감·done 체크박스 4컬럼. 체크박스 클릭은 stopPropagation으로 인스펙터 열림과 분리. 위임/admin overview/반복 todo는 본 epic 외.

## Out of Scope

- 위임 작성 (타인에게 todo 만들기) — `assignee_email = me.email` 강제
- 반복 todo / 알림 / 카테고리 / 태그
- admin overview UI (RLS 허용은 하되 별도 페이지)
- sidebar `my-todo.count: "7"` hardcode 동적화
- ListPattern 컴포지션 리팩토링 (variant 6 도달 — 본 epic 직후 별도 follow-up)

## 영향 파일

| 파일 | 변경 | 설명 |
|---|---|---|
| `supabase/migrations/20260514_todos_table.sql` | 신규 | 테이블 + 시드 2~3건 + 인덱스 + 트리거 |
| `supabase/migrations/20260514b_todos_rls.sql` | 신규 | RLS 4정책 본인 only + GRANT |
| `src/features/todos/schemas.ts` | 신규 | row/create/update zod + priority enum |
| `src/features/todos/queries.ts` | 신규 | `listMyTodos()` |
| `src/features/todos/actions.ts` | 신규 | create/update/delete/toggleDone |
| `src/features/todos/__tests__/schemas.test.ts` | 신규 | zod RED |
| `src/features/todos/__tests__/queries.test.ts` | 신규 | mock 테스트 |
| `src/features/todos/__tests__/actions.test.ts` | 신규 | 시그니처 보호 |
| `src/app/dashboard/my-todo/page.tsx` | 신규 | RSC + onPersist + toggleDone |
| `src/app/dashboard/my-todo/__tests__/page.test.tsx` | 신규 | 시그니처 |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 | `my-todo` variant + 체크박스 컬럼 |
| `src/app/dashboard/_components/inspector/InspectorListBody.tsx` | 수정 | my-todo 폼 |
| `src/app/dashboard/_data/page-meta-config.ts` | 수정 | description |
| `e2e/my-todo.spec.ts` | 신규 (T9) | 본인 작성 / done 토글 / 타인 차단 |
| `scripts/cleanup-test-todos.mjs` | 신규 (T9) | `[E2E]` 접두사 cleanup |

총 15파일. 분할 정책: PR-A(백엔드) / PR-B(UI) / PR-C(e2e) — schedule epic과 동일.

## 단계

### T1: schemas RED 테스트
- **상태**: pending
- **파일**: `src/features/todos/__tests__/schemas.test.ts`
- **변경**: priority enum (low/medium/high) / done bool / due_at nullable / title 빈 reject
- **DoD**: vitest fail (모듈 없음)
- **의존**: 없음 (T3과 병렬)

### T2: schemas GREEN
- **상태**: pending
- **파일**: `src/features/todos/schemas.ts`
- **변경**: row/create/update + priority enum
- **DoD**: T1 통과
- **의존**: T1

### T3: 마이그레이션 테이블 + 시드
- **상태**: pending
- **파일**: `supabase/migrations/20260514_todos_table.sql`
- **변경**: id/title/body/done/done_at/due_at/priority/assignee_email/created_by_email + 인덱스(assignee_email, due_at) + updated_at 트리거. 시드 2~3건 (송영석 본인)
- **DoD**: SQL Editor 실행 후 select 확인
- **의존**: 없음

### T4: 마이그레이션 RLS + GRANT
- **상태**: pending
- **파일**: `supabase/migrations/20260514b_todos_rls.sql`
- **변경**: select/insert/update/delete = `assignee_email = jwt email OR is_admin()`. GRANT auth + service_role. notify pgrst.
- **DoD**: pg_policies 4정책 확인
- **의존**: T3

### T5: queries + actions + 시그니처 테스트
- **상태**: pending
- **파일**: `src/features/todos/queries.ts`, `actions.ts`, `__tests__/queries.test.ts`, `__tests__/actions.test.ts`
- **변경**: listMyTodos (assignee = me filter) / create / update / delete / toggleDone (revalidatePath). canEdit helper는 RLS에 위임 — 별도 permission.ts 불필요
- **DoD**: vitest GREEN + tsc OK
- **의존**: T2, T4

### T6: ListPattern `my-todo` variant + InspectorListBody 폼
- **상태**: pending
- **파일**: `ListPattern.tsx`, `InspectorListBody.tsx`
- **변경**: 컬럼(우선순위·제목·마감·done 체크박스), 필터(전체/미완/완료/오늘/마감 임박), blank row, 폼(title/body/priority/due_at/done). 체크박스 onClick stopPropagation
- **DoD**: 단위 테스트 GREEN
- **의존**: T2

### T7: page.tsx + meta
- **상태**: pending
- **파일**: `src/app/dashboard/my-todo/page.tsx`, `__tests__/page.test.tsx`, `page-meta-config.ts`
- **변경**: RSC, listMyTodos → ListRow 매핑, onPersist 분기 (deleted/done 토글/일반 update)
- **DoD**: dev에서 시드 표시
- **의존**: T5, T6

### T8: PR 분할 머지 + SQL 실행 + dev 검증
- **상태**: pending
- **파일**: 없음 (운영)
- **변경**: 2개 PR 흐름 — PR-A(백엔드) / PR-B(UI)
- **DoD**: dev `/dashboard/my-todo` 시드 표시 + done 토글 동작
- **의존**: T7

### T9: e2e
- **상태**: pending
- **파일**: `e2e/my-todo.spec.ts`, `scripts/cleanup-test-todos.mjs`
- **변경**: 본인 todo 작성 + done 토글 + 본인 외 todo 안 보임 시나리오
- **DoD**: 3 시나리오 PASS
- **의존**: T8

### T10: /verify 마무리
- **상태**: pending
- **파일**: 없음 (실행)
- **변경**: lint + typecheck + unit + e2e
- **DoD**: 0 에러
- **의존**: T9

DAG: `T1→T2`, `T3→T4`, `T2+T4→T5`, `T2→T6`, `T5+T6→T7→T8→T9→T10`. T1·T3 병렬.

## 리스크

- **R1 RLS-UI 정합성**: select 정책은 admin overview 허용. UI에서 `eq("assignee_email", me.email)` 명시 필요 (admin이라도 본인 todo만 표시). T5 queries에서 강제.
- **R2 ListPattern variant 6 도달**: 본 epic 직후 컴포지션 리팩토링 follow-up issue 등록 강제.
- **R3 done 토글 UX**: 별도 체크박스 컬럼 + stopPropagation. 행 클릭은 인스펙터 열림 (사용자 결정).
- **R4 due_at KST/UTC 표기**: schedule `isoToLocalKst` / `localKstToIso` helper 재사용 또는 분리.

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T16:40:00Z | plan | created | brainstorm 20260510-163500 기반, R3 결정(체크박스+stopPropagation) |
| 2026-05-10T17:00:00Z | T1~T7 | done | PR-A(#27) 백엔드 / PR-B(#28) UI 머지. 사이드바 active bar 보너스 포함 |
| 2026-05-10T17:14:00Z | T9 | done | e2e 3 시나리오 (작성 / 체크박스 토글 / viewer 차단) PASS |
