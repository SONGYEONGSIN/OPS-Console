# Brainstorm: onboarding 메일 초대 + 수락 워크플로

작성: 2026-05-10 / 사용자: 송영석

PR #32 이후 사용자 명시 1순위 후속 epic.

## 의도

- **산출물**:
  - admin이 회차 생성 시 trainee_email로 초대 메일 자동 발송
  - 신입이 메일 링크 클릭 → 비밀번호 설정 → 첫 로그인 시 본인 회차 자동 매칭 → `/dashboard/onboarding` 진입
  - 수락 시 cohort `accepted_at` 기록, `status: planned → in_progress` 자동 전환
  - admin이 회차 리스트에서 미수락 회차 식별 + 재초대 버튼
- **사용자**:
  - admin: 회차 생성 = 자동 초대 (별도 액션 불필요), 미수락 시 재초대
  - 신입: 메일 받음 → 클릭 → 비밀번호 설정 → 환영 배너 + 가이드 탭 자동
  - 운영자: 변화 없음 (read는 RLS 그대로)
- **트리거**: 사용자 명시 1순위. 김지나 사례에서 admin이 외부 채널로 안내해야 하는 비효율 해소
- **성공 기준**:
  1. 회차 생성 → 1분 내 trainee_email 수신함에 invite 메일
  2. 메일 내 링크 클릭 → 비밀번호 설정 → 자동 로그인 → onboarding 페이지
  3. 회차 자동 매칭 (trainee_email = me.email)
  4. cohort `accepted_at` timestamp 기록
  5. admin 회차 리스트에서 미수락 표시 (예: ⏳ 아이콘)

## 제약

- **기술**:
  - **Supabase Auth `inviteUserByEmail`** (admin API) 사용 — 사용자 합의
  - SMTP 설정: Supabase Studio → Authentication → Email Templates + SMTP Settings에서 커스텀 SMTP(Resend/SendGrid) 또는 기본 SMTP. 본 epic은 코드 외 — 운영자 설정 안내 문서 동봉
  - Service role key 사용 — server action에서만 호출 (action 'use server' 안에서 admin client 분리)
  - Redirect URL: `${APP_URL}/auth/onboarding-callback?next=/dashboard/onboarding`
  - 비밀번호 설정 화면 — Supabase 호스팅 기본 OR 자체 페이지 `/auth/set-password`
- **비즈니스**:
  - **수락 후 권한**: `viewer`로 시작, admin이 수동 승계 — 사용자 합의
  - operators 시드(17명)에 trainee 미존재 시 자동 추가는 별도 결정 포인트 (본 epic은 viewer로만 등록, operators 명단 추가는 admin 수동)
  - 메일 템플릿 한국어 — Supabase Email Templates에 등록
- **코드베이스**:
  - cohort 테이블에 컬럼 추가: `invited_at`, `accepted_at` (마이그레이션)
  - 새 server action `inviteCohortTrainee(cohortId)` — admin 전용
  - 새 라우트 `/auth/onboarding-callback/route.ts` — 토큰 처리 + 회차 매칭 + redirect
  - getCurrentOperator() 확장: trainee email로 cohort 매칭 helper

## 대안 비교

| 항목 | A: Supabase Auth invite + 자체 callback (Recommended) | B: 자체 invite token 테이블 + 메일 발송 분리 | C: 메일 없이 admin이 링크 복사 (MVP) | Z: 외부 채널 (Slack/카톡) 안내만 |
|---|---|---|---|---|
| 비용 | ~10파일 | ~16파일 | ~5파일 | 0 |
| 위험 | Supabase SMTP 설정 의존 | 토큰 만료/재사용 자체 관리 | 사용자 경험 저하 | 자동화 0 |
| 가역성 | invite API는 표준 | 마이그레이션 부담 | 메일 추가 시 큰 작업 | n/a |
| 학습 효과 | Supabase Auth admin API 1차 적용 | 토큰/만료 자체 관리 | 거의 없음 | 없음 |

## 추천 + 근거

**추천: 대안 A — Supabase Auth invite + 자체 callback**

근거:
1. 사용자 명시 (Supabase Auth 내장)
2. 토큰·만료·재사용 보안 처리를 Supabase가 담당 — 자체 코드 최소
3. SMTP는 Supabase Studio에서 설정, 환경 분리 깔끔
4. 비밀번호 설정 화면도 Supabase 기본 제공 (`?type=invite&access_token=...&refresh_token=...&type=invite`)

**기각 B**: 자체 토큰 시스템은 보안 리스크 + 분량 ↑. Supabase 이미 제공하는 기능 재구현
**기각 C**: 사용자 경험 떨어지고 자동화 가치 0
**기각 Z**: 자동화 안 하면 본 epic 의미 없음

### 본 epic 스코프 (PR-1 우선)

#### PR-1: backend infra (~7파일)
- Migration: `cohorts.invited_at`, `accepted_at` 컬럼 + index
- Server action `inviteCohortTrainee(id)` — admin 전용, `supabase.auth.admin.inviteUserByEmail(trainee_email, { redirectTo: ... })`
- 라우트 `/auth/onboarding-callback/route.ts`:
  1. URL에서 access/refresh token 추출 → setSession
  2. me.email로 매칭하는 cohort 찾아 `accepted_at = now()`, `status: planned → in_progress` update (service_role)
  3. `/dashboard/onboarding?welcome=1` redirect
- 설정 안내 문서: `docs/supabase-smtp-setup.md` (or README 추가) — Supabase Studio SMTP 설정 절차

#### PR-2: cohort 생성 통합 (~4파일)
- `createCohort` 액션이 성공 시 자동으로 invite 트리거 (옵션 toggle: `silent_invite?: boolean` 또는 무조건)
- Inspector 회차 폼에 "초대 메일 발송" 체크박스 (기본 ON)
- 회차 리스트에 미수락(⏳) 표시 + 재초대 버튼

#### PR-3: 환영 배너 (~3파일)
- onboarding/page.tsx에서 `?welcome=1` 쿼리 + 본인 회차 매칭 시 상단 배너 표시
- 첫 진입은 자동으로 가이드 탭

### Out of Scope (후속)
- operators 자동 등록 (admin 수동 승계)
- 24시간 미수락 reminder
- 메일 템플릿 커스터마이징 UI
- 다른 도메인 invite (operators, 사수 추가 등)

## 다음 단계

- HARD-GATE: PR-1만 보면 간략 (10파일 미만)
- 다음 세션: `/plan from-brainstorm 20260510-204000-onboarding-invite.md` → PR-1부터
- **사전 작업 (사용자)**: Supabase Studio → Authentication → Email Templates에서 한국어 invite 템플릿 작성 + SMTP 설정 (커스텀 또는 기본). 코드 작업과 병렬 진행 가능

## 사용자 합의 기록 (이번 세션)

- **메일 발송**: Supabase Auth 내장 invite ✓
- **수락 후 권한**: viewer로 시작, admin이 수동 승계 ✓
