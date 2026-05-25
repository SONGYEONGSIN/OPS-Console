---
plan_id: 20260510-132230-team-menu-permission
status: completed
created: 2026-05-10T13:22:30Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260510-124209-team-menu-permission.md
worktree: ../Folio-feat-team-menu-permission (branch feat/team-menu-permission)
---

# Plan: 조직·권한 메뉴 권한 (allowed_menus)

## Goal

운영자별로 사이드바 메뉴 접근 권한(`allowed_menus text[]`)을 부여/회수할 수 있게 한다. admin은 전체 자동 통과, member/viewer는 부여된 slug만 사이드바에 노출되며 직접 URL 접근 시 차단된다. team page inspector에서 admin이 사용자별 메뉴 체크박스로 토글한다.

성공 기준:
1. admin이 사용자 X의 'team' 회수 → X 새로고침 시 사이드바 hide
2. X가 `/dashboard/team` 직접 입력 → 차단 (redirect)
3. admin은 allowed_menus 무관 통과
4. 직급 시드 적용 후 부장·팀장 = 빈 배열 (bypass) / TL·매니저 = 운영+정보+분석+프로젝트 (12+ slug) / team·settings 제외

## Approach

대안 A — `operators.allowed_menus text[]` 단일 컬럼.

레이어:
- DB: `text[] not null default '{}'` + 직급 backfill + GIN 인덱스. RLS는 기존 `is_admin()` 재사용 (admin-only update 자동 적용).
- Schema: zod에 `allowed_menus: z.array(z.string()).default([])`
- Auth: `getCurrentOperator`에 `allowedMenus: string[]` 추가
- Permission: `canViewMenu(slug, op)` + `filterSidebarSections(sections, op)`
- Guard: `requireMenu(slug)` server-only 헬퍼
- UI: layout에서 sections 필터 → Chrome prop drill, InspectorListBody team+admin에 체크박스 그룹
- Action: 자기-잠김 가드는 기존 SELF_DEMOTE_ERROR로 충분 (admin bypass)

## Out of Scope

- read/write 분리 (대안 B — 향후 마이그레이션)
- audit log
- 신규 slug 자동 분배 (운영 절차로 admin 수동)

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260511_operators_allowed_menus.sql` | 추가 | 컬럼 + 직급 backfill + GIN + notify pgrst |
| `src/features/operators/schemas.ts` | 수정 | row/update/create 에 allowed_menus |
| `src/features/operators/__tests__/schemas.test.ts` | 수정 | RED 케이스 추가 |
| `src/features/operators/queries.ts` | 검증 | select * 자동 포함, parse만 통과 |
| `src/features/operators/actions.ts` | 수정 (조건부) | 기존 SELF_DEMOTE_ERROR로 충분, 검증만 |
| `src/features/operators/__tests__/actions.test.ts` | 수정 | 자기-잠김 검증 |
| `src/features/auth/queries.ts` | 수정 | CurrentOperator.allowedMenus, select 컬럼 추가 |
| `src/features/auth/queries.test.ts` | 수정 | RED 케이스 |
| `src/features/auth/permission.ts` | 수정 | canViewMenu, filterSidebarSections 추가 |
| `src/features/auth/__tests__/permission.test.ts` | 수정 | RED |
| `src/features/auth/menu-guard.ts` | 추가 | requireMenu server-only |
| `src/features/auth/__tests__/menu-guard.test.ts` | 추가 | RED |
| `src/app/dashboard/layout.tsx` | 수정 | sections 필터 + Chrome prop drill |
| `src/app/dashboard/_components/chrome/Chrome.tsx` | 수정 | sections prop 받기 |
| `src/app/dashboard/_components/Sidebar.tsx` | 검증 | 이미 sections prop 받음 |
| `src/app/dashboard/[slug]/page.tsx` | 수정 | requireMenu 진입 가드 (server wrapper 또는 client+effect) |
| `src/app/dashboard/team/page.tsx` | 수정 | requireMenu("team") + allowedMenus 매핑 + persist |
| `src/app/dashboard/feedback/page.tsx` | 수정 | requireMenu("feedback") |
| `src/app/dashboard/notices/page.tsx` | 수정 | requireMenu("notices") |
| `src/app/dashboard/_components/inspector/InspectorListBody.tsx` | 수정 | admin 체크박스 그룹 |
| `src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx` | 수정 | RED |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 | ListRow.allowedMenus + props 전파 |
| `e2e/dashboard-menu-permission.spec.ts` | 추가 | 토글 후 hide + 직접 URL 차단 |

총 18~19 (검증/조건부 제외 시).

## 단계

### T1: 마이그레이션 SQL — allowed_menus 컬럼 + 직급 backfill
- 상태: pending
- 파일: `supabase/migrations/20260511_operators_allowed_menus.sql`
- 변경: `alter table add column allowed_menus text[] not null default '{}'` + 직급별 update + `create index ... using gin (allowed_menus)` + `notify pgrst`. admin = 빈 배열 / TL·매니저 = 운영+정보+분석+프로젝트 slug / viewer = 정보 일부.
- DoD: SQL Editor 실행 후 `select role, array_length(allowed_menus,1) from operators` 분포 확인
- 의존: 없음

### T2: schemas RED
- 상태: pending
- 파일: `src/features/operators/__tests__/schemas.test.ts`
- 변경: validRow에 allowed_menus 추가 + 정상 array 통과 + 잘못된 type 거부
- DoD: 테스트 fail
- 의존: 없음

### T3: schemas GREEN
- 상태: pending
- 파일: `src/features/operators/schemas.ts`
- 변경: row/update/create 에 `allowed_menus: z.array(z.string()).default([])`
- DoD: T2 GREEN
- 의존: T2

### T4: getCurrentOperator RED
- 상태: pending
- 파일: `src/features/auth/queries.test.ts`
- 변경: result.allowedMenus 검증 케이스
- DoD: RED
- 의존: 없음

### T5: getCurrentOperator GREEN
- 상태: pending
- 파일: `src/features/auth/queries.ts`
- 변경: CurrentOperator.allowedMenus, select에 allowed_menus, fallback []
- DoD: T4 GREEN
- 의존: T3, T4

### T6: canViewMenu / filterSidebarSections RED
- 상태: pending
- 파일: `src/features/auth/__tests__/permission.test.ts`
- 변경: admin 모든 slug true / member allowed_menus만 true / slug 없는 item 통과 / 빈 group hide
- DoD: RED
- 의존: 없음

### T7: canViewMenu / filterSidebarSections GREEN
- 상태: pending
- 파일: `src/features/auth/permission.ts`
- 변경: 두 함수 추가
- DoD: T6 GREEN
- 의존: T6

### T8: requireMenu RED
- 상태: pending
- 파일: `src/features/auth/__tests__/menu-guard.test.ts`
- 변경: admin 통과 / 권한 없는 member redirect /dashboard / 비로그인 redirect /login
- DoD: RED
- 의존: 없음

### T9: requireMenu GREEN
- 상태: pending
- 파일: `src/features/auth/menu-guard.ts`
- 변경: server-only requireMenu(slug)
- DoD: T8 GREEN
- 의존: T7, T8

### T10: layout + Chrome sections prop drill
- 상태: pending
- 파일: `src/app/dashboard/layout.tsx`, `src/app/dashboard/_components/chrome/Chrome.tsx`, `src/app/dashboard/_components/Sidebar.tsx`(검증)
- 변경: layout에서 filterSidebarSections 호출 후 Chrome.sections 전달
- DoD: 매뉴얼 admin 전체 / member backfill 메뉴만 노출
- 의존: T7, T5
- 노트: T10 직전 Sidebar의 sections import 흐름 grep 확인 — 정적 import 끊기 필요 시 영향 +1 파일

### T11: [slug] 페이지 requireMenu 가드
- 상태: pending
- 파일: `src/app/dashboard/[slug]/page.tsx`
- 변경: server wrapper로 requireMenu(slug) 호출 후 client child 그대로 또는 server 변환
- DoD: 권한 없는 slug 직접 URL → /dashboard redirect
- 의존: T9

### T12: team/feedback/notices 페이지 requireMenu
- 상태: pending
- 파일: `team/page.tsx`, `feedback/page.tsx`, `notices/page.tsx`
- 변경: 각 페이지 첫 줄 requireMenu 추가
- DoD: 매뉴얼
- 의존: T9

### T13: InspectorListBody 메뉴 체크박스 RED
- 상태: pending
- 파일: `src/app/dashboard/_components/inspector/__tests__/InspectorListBody.test.tsx`
- 변경: team+admin → 체크박스 노출 / 비-admin → hide / 토글 시 onSave에 allowedMenus 포함
- DoD: RED
- 의존: 없음

### T14: ListRow + InspectorListBody 체크박스 GREEN
- 상태: pending
- 파일: `src/app/dashboard/_components/patterns/ListPattern.tsx`, `src/app/dashboard/_components/inspector/InspectorListBody.tsx`
- 변경: ListRow.allowedMenus, InspectorListBody team+admin 분기에 fieldset(섹션별 체크박스), draft 토글
- DoD: T13 GREEN, lint 0 errors (디자인 토큰만)
- 의존: T13

### T15: team page allowedMenus 매핑 + persist
- 상태: pending
- 파일: `src/app/dashboard/team/page.tsx`
- 변경: operatorToListRow 매핑 + onPersist에 allowed_menus 포함
- DoD: 매뉴얼 토글→DB 반영→사용자 새로고침 변경
- 의존: T14, T3

### T16: 자기-잠김 가드 검증 RED
- 상태: pending
- 파일: `src/features/operators/__tests__/actions.test.ts`
- 변경: admin 본인 allowed_menus 비우기 + admin 유지 → 통과(bypass) / admin → member 강등 시 SELF_DEMOTE_ERROR
- DoD: RED 또는 즉시 GREEN (기존 가드로 충분 시)
- 의존: 없음

### T17: 자기-잠김 가드 GREEN (조건부)
- 상태: pending
- 파일: `src/features/operators/actions.ts`
- 변경: 필요 시 SELF_DEMOTE_ERROR에 allowed_menus 자기-잠김 통합. 그 외 변경 없음.
- DoD: T16 GREEN
- 의존: T16

### T18: e2e 시나리오
- 상태: pending
- 파일: `e2e/dashboard-menu-permission.spec.ts`
- 변경: admin 토글 → member 새로고침 → 사이드바 hide / 직접 URL → redirect / admin 자동 통과 / 빈 group hide. TEST_ADMIN/TEST_MEMBER fixture 신규.
- DoD: `npm run test:e2e -- --workers=1` 통과
- 의존: T12, T15

### T19: typecheck + lint + build
- 상태: pending
- 파일: 없음
- 변경: 검증
- DoD: 0 errors / 0 warnings (기존 외)
- 의존: T1~T18

## 단계 의존성 그래프

```
T1 (DB)         ─────────────────────────────────────────────┐
T2 → T3 ──┐                                                   │
T4 ───────┴→ T5 (auth query)                                  │
T6 → T7 ──┬──────────┐                                        │
T8 → T9 ──┴→ T10/T11/T12 ─────────────────────┐               │
T13 → T14 → T15 ──────────────────────────────┤               │
T16 → T17 ────────────────────────────────────┤               │
                                              ↓               ↓
                                          T18 (e2e) → T19 (verify)
```

병렬 lane: {T1}, {T2-T3}, {T4-T5}, {T6-T7}, {T8-T9}, {T13-T14}, {T16-T17}.

## 리스크

1. 사이드바 prop drill 흐름 — T10 직전 grep 필요. 정적 import 끊기 시 +1 파일.
2. [slug] page client→server 변환 위험. 우회: server wrapper만 추가, client child 유지.
3. admin 본인 잠김은 기존 SELF_DEMOTE_ERROR로 차단됨. 추가 가드 불필요.
4. slug 변경 시 동기 — admin이 운영 절차로 재할당 (운영 노트).
5. 빈 group hide — 정보 leak 방지.
6. e2e — TEST_ADMIN/TEST_MEMBER 2-fixture 필요. 단일 fixture는 한쪽만 검증.
7. PostgREST cache reload 강제 (학습된 함정).
8. RLS는 컬럼 단위 제한 없음 — admin이 모든 사용자 allowed_menus 변경 가능 (의도).

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T13:22:30Z | - | plan_created | full gate, 19 steps |
