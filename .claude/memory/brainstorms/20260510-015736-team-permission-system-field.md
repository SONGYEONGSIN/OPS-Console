# Brainstorm: 조직·권한 메뉴 — 시스템 권한 필드 신규

작성: 2026-05-10 / 사용자: 송영석

## 의도

- **산출물**:
  - `operators` 테이블에 `permission` enum 컬럼 추가 (`admin` / `member` / `viewer`)
  - `/dashboard/team` list view 컬럼 순서: 팀 / 이름 / 직급 / 이메일 / **권한** / 상태
  - 권한별 RLS 정책 — `admin`만 operators insert/update/delete, `member`+`viewer`는 read
  - 페이지 가드 — admin 전용 액션(operators 편집, 권한 부여)을 미들웨어/RSC level에서 차단
  - inspector 편집 폼에 권한 select 추가 (admin만 노출)
- **사용자**:
  - admin: 운영 책임자 — 권한 부여/회수, operators 관리
  - member: 근무 운영자 — read 가능, 자기 정보 일부 수정
  - viewer: 일시·실습·외부 — read-only
- **트리거 (왜 지금)**: chrome rebrand + team DB 연동 epic이 닫힌 시점. 다른 도메인 페이지(alerts/services) DB 연동 epic 시작 전에 권한 모델을 고정해야 후속 RLS 정책을 권한 기반으로 일관 작성 가능. 미루면 다른 페이지 마이그레이션 후 RLS를 다시 짜는 비용 발생.
- **성공 기준** (검증 가능):
  1. team list에 `권한` 컬럼이 이메일과 상태 사이에 노출
  2. member 계정으로 로그인 후 operators update 시도 → Supabase 401/403 응답
  3. viewer 계정으로 `/dashboard/team` 직접 접근 → 차단 또는 read-only 모드
  4. 마이그레이션 후 17명 시드: 부장·팀장 → admin / TL·매니저 → member (viewer 0명, 추후 UI에서 부여)

## 제약

- **기술**:
  - Supabase RLS 정책 추가 — 기존 `to authenticated` 정책을 `to authenticated using (auth.uid() ... )` 형태로 좁혀야 함. JWT custom claim에 permission을 박지 않으면 매 요청마다 operators 룩업 → 성능 부담.
  - PostgREST schema cache 자동 reload 안 됨 → 마이그레이션 끝에 `NOTIFY pgrst, 'reload schema'` 강제 (학습된 함정)
  - GRANT 추가 — admin 가드는 RLS에서 처리, GRANT는 authenticated에 한정 유지
  - middleware 권한 체크는 Supabase 호출 1회 추가 → /dashboard 첫 진입 latency
- **비즈니스**:
  - 17명 디폴트는 직급 기준(부장·팀장→admin / TL·매니저→member). 이후 admin이 UI에서 자유롭게 변경 가능 → "직급과 별개" 의미는 유지 (시드 단계의 편의 매핑일 뿐 강제 매핑 아님)
  - 첫 admin 부트스트랩: 마이그레이션 시드에서 직급 기반으로 부여 (현재 부장·팀장 직급자가 admin으로 시작)
- **코드베이스**:
  - 기존 `features/operators/{schemas,queries,actions}.ts` 4계층 모두 수정
  - `middleware.ts` 또는 `dashboard/layout.tsx`에 권한 체크 헬퍼 추가
  - `ListPattern.tsx` team variant 컬럼 추가
  - `InspectorListBody.tsx` 편집 폼에 권한 select 추가 + admin 외 hide 가드
  - `getCurrentOperator()` 결과에 permission 포함하도록 시그니처 확장

## 대안 비교

| 항목 | 대안 A: 풀스택 한 번에 | 대안 B: 점진적 3단 PR | 대안 Z: do-nothing |
|------|---------------------|----------------------|---------------------|
| 비용 | 9~10 파일, 1~2일 | 단계당 4~6 파일 × 3 PR | 0 |
| 위험 | RLS 실수 시 본인 잠김 | 중간 단계는 권한이 표시만 되고 강제 안 돼 혼선 | 다른 페이지 epic에서 RLS 재작성 부채 |
| 가역성 | DB 마이그레이션 + RLS 롤백 시 신중 | 단계별 롤백 쉬움 | n/a |
| 학습 효과 | RLS+가드+UI 일관 설계 한 번에 학습 | 단계별 검증 용이하지만 통합 시점이 멀어짐 | 없음 |

## 추천 + 근거

**추천: 대안 A (풀스택 한 번에)**

근거:
1. 사용자가 "RLS + 페이지 가드까지 한 번에" 명시
2. 표시만 먼저 머지하면 권한이 강제되지 않은 채 UI에 보여 사용자가 잘못 이해할 위험
3. RLS는 operators 한 테이블 범위라 risk가 제한적이고, 본인 잠김 위험은 마이그레이션에 송영석 admin 시드 보장으로 차단 가능

**기각 — 대안 B**: 단계별 머지가 안전하지만 본 epic은 한 도메인(operators)만 다루므로 풀스택 한 번에가 적정. 다른 도메인까지 확장될 때(차기 epic)는 B 패턴이 적합.

**기각 — 대안 Z**: 사용자 명시적 거부 + 후속 epic 부채 발생.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260510-015736-team-permission-system-field.md`
- 영향 파일 9~10개 → HARD-GATE **간략 설계** 등급 → **`/plan` 권장**
- planner 에이전트로 단계 분해 후 TDD 구현
- 변경 영역이 DB(RLS) + auth(가드) → security 에이전트 검토 권장
- worktree 격리 권장 (`feat/team-permission-system`)

## 미해결 — plan 단계에서 결정

- JWT custom claim에 permission을 넣을지(성능 ↑, JWT 만료 시점까지 stale) vs 매 요청 룩업(성능 ↓, 즉시 반영) — `auth.users.app_metadata` 수동 sync vs DB function `is_admin()` 호출 정책 결정
- viewer 디폴트 0명 → UI에서 viewer 부여 시 "외부 게스트" 라벨 사용할지 enum 키만 둘지
- middleware 가드 위치: `src/middleware.ts` global vs `dashboard/layout.tsx` per-route
- e2e 시나리오 — admin/member/viewer 별 TEST_USER 추가? 또는 단일 TEST_USER + permission 토글?
