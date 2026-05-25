---
plan_id: 20260510-020553-team-permission-system-field
status: completed
created: 2026-05-10T02:05:53Z
hard_gate: full
source: brainstorm:.claude/memory/brainstorms/20260510-015736-team-permission-system-field.md
worktree: ../Folio-feat-team-permission (branch feat/team-permission-system)
---

# Plan: 조직·권한 메뉴 시스템 권한 필드 신규

## Goal

`operators`에 `permission` 컬럼(`admin`/`member`/`viewer`)을 추가하고, 이를 기반으로 RLS·페이지 가드·UI(team list 컬럼·inspector select)를 일관되게 강제한다. 17명 시드는 직급 기반으로 `admin`/`member` 디폴트 부여하여 본인 잠김 없이 epic을 완료한다.

검증 가능한 성공 기준:
1. team list에 "권한" 컬럼이 이메일과 상태 사이에 노출
2. member 계정으로 operators update 시 Supabase가 401/403으로 차단
3. viewer 계정으로 `/dashboard/team` 진입 시 read-only (편집 버튼 hide)
4. 마이그레이션 후 `select count(*)` 시 admin ≥ 3, member ≥ 13, viewer = 0

## Approach

대안 A (풀스택 한 번에) 채택. 단계 내부는 TDD RED→GREEN을 강제 (zod schema / actions / queries는 unit 테스트 선행). DB 마이그레이션·UI는 TDD 예외 — e2e + manual 검증.

핵심 결정:
- **JWT custom claim 미사용 → 매 요청 `operators` 룩업** (즉시 회수 반영, 기존 `getCurrentOperator` round-trip에 흡수)
- **권한 가드는 `dashboard/layout.tsx`** (middleware는 supabase auth만 담당)
- **e2e는 단일 TEST_USER + DB 토글** (다중 계정 부담 제거)
- **viewer 라벨 = enum 키만 "뷰어"** (외부 게스트 라벨링은 별도 epic)

## Out of Scope

- viewer "외부 게스트" UX 라벨링
- 권한 변경 audit log / 알림
- alerts/services 다른 도메인 RLS 권한 기반 재작성 (후속 epic)
- JWT custom claim 도입 (성능 이슈 발견 시 재논의)
- 본인 잠김 방어 UI 메시지 (RLS는 차단, UX 카피 후속)

## 영향 파일

| 파일 | 변경 유형 | 비고 |
|------|----------|------|
| `supabase/migrations/20260510_operators_permission.sql` | 추가 | permission 컬럼 + CHECK + 시드 backfill + index |
| `supabase/migrations/20260510b_operators_permission_rls.sql` | 추가 | admin-only insert/update/delete + `is_admin()` helper + GRANT |
| `src/features/operators/schemas.ts` | 수정 | `operatorPermissionSchema` enum + Row/Update/Create 필드 |
| `src/features/operators/queries.ts` | 수정 | (자동 select * 포함, 테스트 fixture만 보강) |
| `src/features/operators/__tests__/queries.test.ts` | 수정 | validRow에 permission 추가 |
| `src/features/operators/actions.ts` | 수정 | updateOperator/createOperator/restoreOperator 에 admin 가드 + 본인 강등 차단 |
| `src/features/operators/__tests__/actions.test.ts` | 추가 | RED — 비-admin update / 본인 강등 / admin update |
| `src/features/auth/queries.ts` | 수정 | `getCurrentOperator()` DB 룩업으로 전환 + permission 반환 |
| `src/features/auth/queries.test.ts` | 수정 | permission 검증 케이스 |
| `src/features/auth/permission.ts` | 추가 | `requireAdmin()` / `canEditOperators()` 헬퍼 |
| `src/features/auth/__tests__/permission.test.ts` | 추가 | RED — admin/member/viewer 분기 |
| `src/app/dashboard/team/page.tsx` | 수정 | `requireAdmin` 가드 + ListPattern에 permission/readOnly 주입 |
| `src/app/dashboard/_components/patterns/ListPattern.tsx` | 수정 | team variant 권한 컬럼 + readOnly prop |
| `src/app/dashboard/_components/inspector/InspectorListBody.tsx` | 수정 | 권한 select(admin only) + read-only 가드 |
| `e2e/team-permission.spec.ts` | 추가 | admin/member/viewer 토글 시나리오 |
| `scripts/toggle-permission.ts` | 추가 | e2e 셋업 — TEST_USER permission 토글 |

총 **17개**.

## 단계

### T1: 마이그레이션 SQL — permission 컬럼 + 시드 backfill
- **상태**: pending
- **파일**: `supabase/migrations/20260510_operators_permission.sql`
- **변경**: `alter table ... add column permission` + CHECK + 직급 기준 backfill + 송영석 admin 명시 row + index + `notify pgrst, 'reload schema'`. **prerequisite**: `ysong2526@gmail.com`이 operators row에 있는지 확인, 없으면 row 추가 SQL 선행.
- **DoD**: SQL Editor 실행 후 `select email,role,permission from operators` → 부장1+팀장2+송영석 = admin 3~4명, 나머지 = member, viewer 0명
- **의존**: 없음
- **노트**: TDD 예외. 한 트랜잭션 블록(`begin; ... commit;`)으로 묶기. 한국어 paste 함정 주의.

### T2: RLS 정책 admin 가드 + helper function
- **상태**: pending
- **파일**: `supabase/migrations/20260510b_operators_permission_rls.sql`
- **변경**: `is_admin()` (security definer + search_path) → 기존 update/insert 정책 drop & recreate (`using public.is_admin()`) → delete 정책 추가 → `notify pgrst`
- **DoD**: 수동 — admin claim으로 update 1 row, member claim으로 update 0 rows
- **의존**: T1
- **노트**: RLS 무한 재귀 위험 → security definer 필수.

### T3: GRANT 갱신 (delete 추가)
- **상태**: pending
- **파일**: `supabase/migrations/20260510b_operators_permission_rls.sql` (T2와 합침)
- **변경**: `grant delete on public.operators to authenticated;`
- **DoD**: T2와 함께 실행 후 admin delete 가능
- **의존**: T2
- **노트**: GRANT 누락 시 42501 학습됨.

### T4 (RED): operators schemas 권한 필드 테스트
- **상태**: pending
- **파일**: `src/features/operators/__tests__/queries.test.ts` (수정), `src/features/operators/__tests__/schemas.test.ts` (없으면 추가)
- **변경**: validRow에 `permission: 'member'` 추가 + enum 검증 케이스
- **DoD**: 테스트 fail (RED)
- **의존**: 없음 (T1 이전 가능)

### T5 (GREEN): schemas.ts에 operatorPermissionSchema 추가
- **상태**: pending
- **파일**: `src/features/operators/schemas.ts`
- **변경**: `operatorPermissionSchema = z.enum(['admin','member','viewer'])` + `PERMISSION_LABEL` (관리자/구성원/뷰어) + Row/Update/Create 필드
- **DoD**: T4 통과, typecheck 통과
- **의존**: T4

### T6 (RED): updateOperator 권한 가드 테스트
- **상태**: pending
- **파일**: `src/features/operators/__tests__/actions.test.ts` (신규)
- **변경**: 비-admin update 차단 / 본인 강등 차단 / admin update 허용 케이스
- **DoD**: 테스트 fail (RED)
- **의존**: T5
- **노트**: getCurrentOperator 모킹 + supabase 클라이언트 모킹.

### T7 (GREEN): actions.ts admin 가드 + 본인 강등 차단
- **상태**: pending
- **파일**: `src/features/operators/actions.ts`
- **변경**: `requireAdmin()` 가드 + 본인 강등 차단 로직 (createOperator/updateOperator/restoreOperator)
- **DoD**: T6 통과
- **의존**: T6, T11
- **노트**: 함수 50줄 상한, RLS는 fallback 방어선.

### T8 (RED): getCurrentOperator permission 반환 테스트
- **상태**: pending
- **파일**: `src/features/auth/queries.test.ts`
- **변경**: 결과에 `permission` 필드 검증 (송영신 admin 케이스 등)
- **DoD**: 테스트 fail (RED)
- **의존**: T5

### T9 (GREEN): getCurrentOperator DB 룩업 전환
- **상태**: pending
- **파일**: `src/features/auth/queries.ts`
- **변경**: 정적 OPERATORS 매칭 → supabase from('operators').eq('email').maybeSingle() 룩업, 반환에 permission 포함
- **DoD**: T8 통과 + 호출처 typecheck
- **의존**: T8
- **노트**: 매칭 실패 시 permission=null (viewer 취급).

### T10 (RED): permission 헬퍼 unit 테스트
- **상태**: pending
- **파일**: `src/features/auth/__tests__/permission.test.ts` (신규)
- **변경**: `requireAdmin()` / `canEditOperators()` 분기 검증
- **DoD**: 테스트 fail (RED)
- **의존**: T9

### T11 (GREEN): permission 헬퍼 구현
- **상태**: pending
- **파일**: `src/features/auth/permission.ts` (신규)
- **변경**: `requireAdmin()` (admin 외 redirect) + `canEditOperators(perm)` + `canViewTeamPage(perm)`
- **DoD**: T10 통과
- **의존**: T10

### T12: ListRow 타입 + ListPattern 권한 컬럼
- **상태**: pending
- **파일**: `src/app/dashboard/_components/patterns/ListPattern.tsx`
- **변경**: ListRow에 `permission?` 필드 + team variant 컬럼 추가 + PERMISSION_LABEL/BADGE 상수 + `readOnly?` prop ("+ 신규" 버튼/편집 hide)
- **DoD**: 빌드 + lint(color hardcode 룰) 통과
- **의존**: T5
- **노트**: 색상은 design-tokens 또는 기존 시각 토큰 재사용.

### T13: InspectorListBody 권한 select + read-only 가드
- **상태**: pending
- **파일**: `src/app/dashboard/_components/inspector/InspectorListBody.tsx`
- **변경**: `currentUserPermission` prop + 권한 select(admin only) + readOnly 시 input disable + TeamView 의 권한 레벨 행을 op.permission 기반으로
- **DoD**: 빌드 + 매뉴얼 — admin/member에서 select 노출 차이
- **의존**: T12

### T14: team/page.tsx admin 가드 + currentUserPermission 주입
- **상태**: pending
- **파일**: `src/app/dashboard/team/page.tsx`
- **변경**: getCurrentOperator → operatorToListRow에 permission 매핑 → `<ListPattern readOnly={!isAdmin} currentUserPermission={...}>` + onPersist 진입 시 admin 가드
- **DoD**: e2e admin 동작 / member 차단
- **의존**: T9, T11, T12, T13

### T15: scripts/toggle-permission.ts (e2e 지원)
- **상태**: pending
- **파일**: `scripts/toggle-permission.ts`
- **변경**: argv email + permission, service-role로 update
- **DoD**: 수동 실행 시 DB 반영
- **의존**: T1
- **노트**: dotenv 명시 로드 + inspect-user.ts 패턴 차용.

### T16 (RED): e2e team permission 시나리오
- **상태**: pending
- **파일**: `e2e/team-permission.spec.ts` (신규)
- **변경**: admin/member/viewer 토글 후 진입 → 신규버튼/편집버튼 visible/hidden 검증, beforeEach/afterEach toggle
- **DoD**: 첫 실행 fail (RED)
- **의존**: T15

### T17 (GREEN): e2e 통과 + manual 검증 + /verify
- **상태**: pending
- **파일**: 없음
- **변경**: 검증만
- **DoD**: e2e 통과 + RLS 차단 확인 + 성공 기준 1~4 충족
- **의존**: T1~T16

## 단계 의존성 그래프

```
T1 (DB) ──┬─→ T2 (RLS) ──→ T3 (GRANT)
          └─→ T15 (script)

T4 (RED) ──→ T5 (GREEN schemas) ──┬─→ T8 → T9
                                  ├─→ T6 → T7 (T11 의존)
                                  ├─→ T10 → T11
                                  └─→ T12

T11 + T12 ──→ T13 ──→ T14
T1 + T15 ──→ T16 ──→ T17
```

권장 순서: T1 → T2 → T3 → T4 → T5 → T8 → T9 → T6 → T10 → T11 → T7 → T12 → T13 → T14 → T15 → T16 → T17.

## 리스크

- **송영석 본인 잠김** — `ysong2526@gmail.com`이 operators 시드 17명에 매칭 안 되면 admin 시드 누락. T1 prerequisite으로 row 존재 확인 + 명시 admin row.
- **RLS 무한 재귀** — `is_admin()`은 `security definer` + `set search_path = public`로 차단.
- **JWT email mismatch** — `auth.jwt()->>'email'` 의존. 후속 epic에서 `user_id` 컬럼 마이그레이션 권장.
- **PostgREST 캐시 stale** — 마이그레이션 끝에 `notify pgrst, 'reload schema'` 강제.
- **부분 실행** — `begin; ... commit;`로 한 블록 묶기.
- **e2e race** — `--workers=1`, toggle afterEach reset.
- **inspector readOnly 표류** — `editing && currentUserPermission==='admin'` 가드.

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T02:05:53Z | - | plan_created | full gate, 17 steps |
| 2026-05-10T02:08:00Z | T1 | pending → in_progress | prerequisite check 결과: 송영석은 operators 시드에 없음(dev 계정), 본인 잠김 리스크 무관. 정확한 admin 분포는 부장1+팀장1=admin 2명, 나머지=member 15 (성공기준 #4 "admin ≥ 3"을 admin=2로 정정). |
| 2026-05-10T02:08:00Z | - | worktree | ../Folio-feat-team-permission, branch feat/team-permission-system |
