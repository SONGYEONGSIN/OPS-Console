# Brainstorm: 조직·권한 — 사용자별 메뉴 접근 권한

작성: 2026-05-10 / 사용자: 송영석 / 시드: project_menu_permission_next.md

## 의도

- **산출물**:
  - `operators.allowed_menus text[]` 컬럼 (사이드바 slug 배열) — 권한 부여된 메뉴 목록
  - admin이 team page inspector에서 사용자별 메뉴 권한 체크박스 편집
  - 사이드바 — 사용자 `allowed_menus`에 없는 항목 hide
  - dashboard 페이지 가드 — 직접 URL 접근 시 권한 체크 후 차단/리다이렉트
  - 시드: 직급 기반 디폴트 매핑 (부장·팀장 = 전체 / TL = 운영 + 정보 / 매니저 = 운영 + 정보 / viewer 디폴트 = 정보 일부)
- **사용자**:
  - admin: 운영자별 메뉴 권한 부여/회수 (사용자 합류 시 메뉴 세팅)
  - member: 자신의 권한 메뉴만 사이드바에서 본인 작업 (운영 도메인)
  - viewer: 일시 게스트 (정보 도메인 read-only)
- **트리거 (왜 지금)**: 시스템 권한(admin/member/viewer)만으로는 메뉴 접근 통제가 거친 단위. 운영부 도메인이 분화되면 (예: 정산 / 인사 / 알림 / 게시판 / 시스템 설정) 일부 사용자에게만 보여야 할 메뉴 발생. 게시판 epic(PR #14) 다음 자연 후속.
- **성공 기준** (검증 가능):
  1. admin이 inspector에서 사용자 X의 'team' 권한 회수 → 사용자 X 새로고침 시 사이드바에서 'team' hide
  2. 사용자 X가 직접 `/dashboard/team` URL 입력 → 차단 (redirect 또는 403)
  3. admin은 모든 메뉴 자동 접근 (allowed_menus 무관)
  4. 시드 후: 부장·팀장 admin = 전체 / TL·매니저 = 운영 도메인 + 정보 도메인

## 제약

- **기술**:
  - Postgres `text[]` 컬럼 사용 — 배열 연산자 (`@>`, `&&`) RLS에서 OK
  - PostgREST schema cache reload 필수 (`notify pgrst`)
  - 사이드바는 client component (`Sidebar.tsx`) — server에서 currentOperator + allowed_menus 룩업 후 prop drill 또는 layout context
  - admin은 allowed_menus 무시 (시스템 권한 우선) — 가드 함수 분기
  - middleware 변경 없음 (auth만 담당, 메뉴 가드는 layout/page에서)
- **비즈니스**:
  - 시드 디폴트는 admin이 운영 시작 후 UI에서 자유 변경 가능 — 시드는 첫 운영 편의일 뿐
  - allowed_menus는 sidebar slug 기반 — 사이드바 데이터 변경 시 권한 데이터도 동기 (slug 추가 시 admin 재할당)
- **코드베이스**:
  - 기존 `features/operators/{schemas,queries,actions}.ts` 4계층 모두 수정 (allowed_menus 필드)
  - `features/auth/permission.ts` 확장 (`canViewMenu(slug, operator)`)
  - `dashboard/_components/Sidebar.tsx` 권한 필터링
  - `dashboard/layout.tsx` 또는 각 페이지 가드 헬퍼
  - team page inspector — 권한 체크박스 UI

## 대안 비교

| 항목 | 대안 A: allowed_menus text[] (1차원) | 대안 B: menu_permissions 테이블 (2차원) | 대안 Z: do-nothing |
|------|---------|---------|---------|
| 비용 | 1 컬럼 + 시드 + 헬퍼 + UI 체크박스 (~12 파일) | 별도 테이블 + join + RLS + UI (~16 파일) | 0 |
| 위험 | read/write 세분화 어려움 (향후 확장 시 마이그레이션) | 정규화로 향후 확장 용이 | 메뉴 분화 시 사용자별 차별 불가 |
| 가역성 | 컬럼 drop만으로 롤백 | 테이블 drop, RLS 정리 필요 | n/a |
| 학습 효과 | Postgres array + RLS 패턴 | join + 정책 매트릭스 패턴 | 없음 |

## 추천 + 근거

**추천: 대안 A (allowed_menus text[])**

근거:
1. 사용자 명시 추천 — 단순 접근 가능 여부 (1차원)
2. 현 시점 운영부 17명 + ~12 메뉴 — 데이터량 작아 정규화 이득 작음
3. read/write 세분화 필요 발생 시 마이그레이션으로 B 전환 가능 (가역성 충분)
4. UI도 단순 (체크박스 1개/메뉴)

**기각 — 대안 B**: 향후 read/write 분리 또는 메뉴별 세부 권한(예: 일부 사용자는 알림 설정만 변경 가능, 알림 작성 불가)이 필요해지면 B로 전환. 현 시점은 over-engineering.

**기각 — 대안 Z**: 사용자 명시 거부 + 메뉴 분화 시 부채 발생.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260510-124209-team-menu-permission.md`
- 영향 파일 ~12개 → HARD-GATE **간략 설계** + 복잡도 보정(DB 스키마, auth 가드, UI) → **전체 설계** 등급 → **/plan 권장**
- planner 에이전트로 단계 분해
- worktree 격리 권장 (`feat/team-menu-permission`)

## 미해결 — plan 단계에서 결정

1. **시드 매핑 구체값** — 직급별 → allowed_menus 정확한 slug 리스트
   - 운영 도메인: services / alerts / schedule / handover / my-todo / [project slugs]
   - 정보 도메인: notices / feedback / onboarding
   - 인사 도메인: team
   - 시스템: settings
2. **admin bypass 방식** — `is_admin()` RLS 함수 재사용 vs 클라이언트 체크
3. **사이드바 group 처리** — group 안 모든 item이 hide면 group 자체도 hide?
4. **권한 회수 즉시 반영** — DB 룩업이 매 요청 일어나니 자동 반영. session token 영향 없음.
5. **새 메뉴 추가 시 정책** — admin에게 자동 부여 / 다른 사용자는 디폴트 권한 없음? 또는 직급 매핑 자동 적용?
6. **e2e 시나리오** — 토글 후 사이드바 hide / 직접 URL 차단 검증
