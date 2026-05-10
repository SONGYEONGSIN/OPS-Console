---
plan_id: 20260510-205000-onboarding-invite-pr1
status: pending
created: 2026-05-10T20:50:00Z
hard_gate: brief
source: brainstorm:.claude/memory/brainstorms/20260510-204000-onboarding-invite.md
---

# Plan: onboarding 메일 초대 PR-1 (백엔드 인프라)

다음 세션 시작점. brainstorm 합의: Supabase Auth `inviteUserByEmail` + 자체 callback / viewer로 수락.

## Goal

회차 생성 시 admin이 trainee_email로 초대 메일을 발송할 수 있도록 server action + redirect callback 라우트 구축. 신입 클릭 → 비밀번호 설정 → 본인 회차 자동 매칭(`accepted_at`, `status: planned → in_progress`) → `/dashboard/onboarding?welcome=1` 진입.

## Approach

PR-1은 backend infra만. PR-2(cohort UI 통합), PR-3(환영 배너)는 별도. PR-1에 작성된 server action은 PR-2 진입 전까지 어떤 UI에서도 호출되지 않으나, 단위 테스트 + 수동 호출(`scripts/`)로 검증.

## Out of Scope (PR-1)

- cohort 생성 폼에 초대 토글 (PR-2)
- 회차 리스트 미수락 표시 + 재초대 버튼 (PR-2)
- 환영 배너 (PR-3)
- operators 자동 등록 / 24h reminder / 메일 템플릿 UI (별도 epic)

## 영향 파일 (PR-1)

| 파일 | 변경 | 설명 |
|---|---|---|
| `supabase/migrations/20260516_cohorts_invite_columns.sql` | 신규 | `invited_at`, `accepted_at` timestamptz 컬럼 + index |
| `src/features/onboarding/schemas.ts` | 수정 | row schema에 invited_at/accepted_at 추가 |
| `src/features/onboarding/actions.ts` | 수정 | `inviteCohortTrainee(id)` admin 전용 추가 |
| `src/features/onboarding/__tests__/actions.test.ts` | 수정 | 시그니처 |
| `src/features/onboarding/queries.ts` | 수정 (선택) | findCohortByTraineeEmail helper |
| `src/lib/supabase/admin.ts` | 신규 | service_role admin client (별도 모듈, 기존 server.ts와 분리) |
| `src/app/auth/onboarding-callback/route.ts` | 신규 | GET handler — 토큰 setSession + cohort 매칭 + redirect |
| `docs/onboarding-invite-setup.md` | 신규 | Supabase Studio SMTP / 메일 템플릿 한국어 등록 안내 |

총 8파일.

## 단계

### T1: 마이그레이션 — invited_at / accepted_at 컬럼
- **파일**: `supabase/migrations/20260516_cohorts_invite_columns.sql`
- **변경**: `alter table onboarding_cohorts add column invited_at timestamptz` 두 컬럼 + 인덱스. notify pgrst.
- **DoD**: SQL Editor 실행 후 `\d onboarding_cohorts` 확인
- **의존**: 없음

### T2: schemas.ts에 컬럼 추가
- **파일**: `src/features/onboarding/schemas.ts`
- **변경**: `cohortRowSchema`에 `invited_at`, `accepted_at` z.string().nullable().optional() 추가
- **DoD**: 기존 12 테스트 통과 + tsc OK
- **의존**: T1

### T3: admin client 모듈
- **파일**: `src/lib/supabase/admin.ts`
- **변경**: `createAdminClient()` — service_role key + autoRefreshToken: false. 기존 server.ts와 분리해 admin API 호출 전용
- **DoD**: typecheck + 모듈 import 가능
- **의존**: 없음 (T2와 병렬)

### T4: inviteCohortTrainee action
- **파일**: `src/features/onboarding/actions.ts`
- **변경**: 새 export, admin 권한 체크 + `admin.auth.admin.inviteUserByEmail(trainee_email, { redirectTo: ${APP_URL}/auth/onboarding-callback })` + `update onboarding_cohorts set invited_at = now()`
- **DoD**: 시그니처 테스트 통과 + 수동 호출(스크립트)로 메일 도착
- **의존**: T2, T3

### T5: callback 라우트
- **파일**: `src/app/auth/onboarding-callback/route.ts`
- **변경**: GET handler — Supabase Auth가 fragment로 access/refresh token 전달 시 클라이언트 처리이므로 실제로는 `?code=` (PKCE) 또는 redirect 후 client component에서 처리. 라우트는 `code` 받아 `exchangeCodeForSession` → me.email로 cohort lookup → service_role로 `accepted_at` update + status 전환 → `/dashboard/onboarding?welcome=1` redirect
- **DoD**: 수동 invite → 클릭 → callback 동작 → onboarding 진입
- **의존**: T2, T3, T4

### T6: 설정 안내 문서
- **파일**: `docs/onboarding-invite-setup.md`
- **변경**: Supabase Studio Authentication → SMTP Settings (Resend 등 커스텀 SMTP 또는 기본), Email Templates에서 invite 한국어 템플릿 등록 절차. redirect URL 화이트리스트 (`/auth/onboarding-callback`) 등록 단계
- **DoD**: 사용자가 문서대로 설정 후 메일 1건 수신
- **의존**: 없음 (T1과 병렬)

### T7: PR-1 머지
- **DoD**: CI pass + 사용자 dev 검증
- **의존**: T1~T6

DAG: `T1+T3 || T6` 병렬, `T1→T2`, `T2+T3→T4→T5→T7`.

## 리스크

- **R1 SMTP 설정 의존성**: Supabase 기본 SMTP는 발송 제한 (시간당 4건 등). 운영에는 Resend/SendGrid 등 커스텀 권장. T6 문서에 명시
- **R2 PKCE flow vs implicit flow**: Supabase Auth invite는 fragment(#) 기반 access_token이 기본. 라우트에서 처리하려면 query(`?code=`) PKCE로 설정 필요 — `flowType: 'pkce'` client option. T5에서 검증
- **R3 service_role exposure**: admin client는 절대 client component에서 import 금지. `'server-only'` 가드 추가
- **R4 redirect URL 화이트리스트**: Supabase Studio Authentication → URL Configuration에 `${APP_URL}/auth/onboarding-callback` 등록 안 하면 invite 후 redirect 차단. T6 문서 강조
- **R5 trainee_email이 이미 가입됨**: invite API는 이미 가입된 이메일에 다시 호출 시 에러 — 회차만 매칭하고 메일 안 보냄(별도 분기) 또는 에러 표시

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
| 2026-05-10T20:50:00Z | plan | created (pending) | 다음 세션 시작점, brainstorm 20260510-204000 기반 |

## 다음 세션 시작 명령

1. `git checkout -b feat/onboarding-invite`
2. T1 마이그레이션 SQL 작성 → Supabase 실행
3. T3 admin client → T2 schemas → T4 action → T5 callback 순으로
4. PR-1 머지 후 PR-2 (cohort UI 통합) 별도 plan
