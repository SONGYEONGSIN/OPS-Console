# Folio

에디토리얼 톤 사내 운영 관리 시스템.

## Tech Stack

- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Tailwind CSS 4
- **Database / Auth**: Supabase (@supabase/ssr)
- **Validation**: zod
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Linting**: ESLint + Prettier

## Project Structure

```
Folio/
├── .claude/
│   ├── settings.local.json
│   ├── agents/
│   ├── rules/
│   ├── hooks/
│   ├── skills/
│   ├── memory/          # 학습 패턴/에러 해결법 축적
│   ├── metrics/         # 자동 수집 메트릭
│   └── messages/        # 에이전트 간 통신 (inbox, debates 등)
├── src/
│   ├── app/            # Next.js App Router 페이지
│   │   ├── login/      # 인증 (signin/signup/SSO)
│   │   ├── dashboard/  # OPS Console — chrome / sidebar / patterns / inspector
│   │   │   └── _components/inspector/list-variants/  # 10 variant registry (cohort/team/receivables/ai-work/post-feedback/post-notice/schedule/my-todo/default/backup) — View/EditForm/Table/Filters/blank 슬롯 완비. status.ts 공통 상수. Variant union은 types.ts 단일 정의 → InspectorListBody/ListPattern import 재사용
│   │   ├── global-error.tsx  # 한글 에러 페이지 (root layout 대체)
│   │   └── auth/       # OAuth callback
│   ├── components/     # React 컴포넌트 (auth/AuthChrome 등 도메인별 폴더)
│   ├── features/       # 도메인 로직 (auth, operators — schemas/actions/queries)
│   ├── lib/            # 유틸리티, Supabase 클라이언트
│   └── proxy.ts        # 미인증 가드 + /login 리다이렉트 (Next 16 middleware→proxy rename)
├── e2e/                # Playwright spec (login/dashboard/smoke/reset/forgot)
├── supabase/migrations/ # operators 테이블 + RLS + GRANT
├── scripts/            # 일회성 운영 도구 (inspect-user, restore-operator)
├── CLAUDE.md
└── package.json
```

## Design System

- **Design Tokens**: `src/lib/design-tokens.ts` — 색상, 간격, 타이포 중앙 정의
- **Common Components**: `src/components/common/` — 재사용 UI 패턴 (3회+ 반복 추출)
- **색상 규칙**: 컴포넌트에서 하드코딩 hex/rgb/hsl 금지, Tailwind 클래스 또는 토큰 사용
- **검증**: `hooks/design-lint.sh`가 Write/Edit 시 자동 감지, `/design-audit`로 전체 스캔

## list-variants 아키텍처 (open/closed)

- **위치**: `src/app/dashboard/_components/inspector/list-variants/`
- **레지스트리**: `registry.ts`가 import-time static binding으로 10 variant → 컴포넌트 매핑 (RSC 직렬화 호환 — inline factory 금지)
- **슬롯**: 각 variant 폴더에 `View.tsx`(인스펙터 읽기) / `EditForm.tsx`(인스펙터 편집) / `Table.tsx`(리스트 행) / `filters.ts`(filter 옵션 + blank 행 factory). 모두 optional
- **신규 도메인 추가 비용**: 1 폴더 신설 + `registry.ts` 1줄. `ListPattern.tsx` / `InspectorListBody.tsx`는 dispatcher만이므로 무변경
- **dispatcher 크기**: `ListPattern.tsx` ~473줄 (backup 도메인 ListRow 필드 +22줄), `InspectorListBody.tsx` 128줄 (둘 다 800 상한 안전 마진)
- **Variant union 단일 정의**: `list-variants/types.ts`에 한 곳만 정의. `InspectorListBody.tsx` / `ListPattern.tsx`는 `import type { Variant }`로 재사용 — 신규 variant 추가 시 1 곳 갱신
- **공통 상수**: `status.ts` — STATUS_LABEL / STATUS_COLOR / STATUS_RING. variant별로 미묘하게 다른 라벨은 각 variant 모듈에서 자체 override
- **post 예외**: `variant: "post-feedback" \| "post-notice"` prop이 필요해 InspectorListBody/ListPattern dispatcher에서 직접 분기 (registry 우회)
- **my-todo Table 예외**: `onToggleDone` 콜백 prop 필요 — dispatcher closure로 전달

## Commands

```bash
npm run dev                          # 개발 서버 (포트 3000)
npm run build                        # 프로덕션 빌드
npm run lint                         # ESLint
npm run typecheck                    # tsc --noEmit
npm test                             # Vitest unit (TZ=Asia/Seoul)
npm run test:e2e                     # Playwright E2E (기본 webServer 3010)
npm run test:e2e -- --workers=1      # parallel race 회피 (dashboard 인증 테스트)
```

E2E 운영 메모:
- 로컬에서 `npm run dev` 띄운 상태로 e2e 실행 시 `E2E_BASE_URL=http://localhost:3000` 설정 + `--workers=1`
- `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`가 Supabase 실 사용자와 동기되어야 인증 의존 테스트(~30건) 동작
- viewer 권한 테스트 시 `allowed_menus`도 함께 설정 필요 (예: `ALLOWED_MENUS=receivables PERMISSION=member node scripts/toggle-permission.mjs`)

빌드 운영 메모:
- `NODE_ENV=development` shell leak 시 `next build`가 dev React로 prerender → `/_global-error` useContext 에러 발생. `unset NODE_ENV` 또는 `NODE_ENV=production` 강제. CI는 unset 정상 동작

## 미수채권 독려 메일 (Microsoft Graph sendMail)

- 트리거: 미수채권 페이지에서 admin이 수동 클릭 → 미리보기 모달 → 일괄 발송
- 그룹화: 경과일수 ≥ `MAIL_REMINDER_THRESHOLD_DAYS`(기본 10일)인 청구건을 `학교담당자` 컬럼 이메일로 묶음
- 발신자: 로그인한 운영자 본인 메일박스 (Azure AD UPN = operators.email 가정). Azure AD App에 `Mail.Send` Application permission + admin consent 필요
- 안전장치: `MAIL_DRY_RUN=true` 시 실제 발송 안 함, `receivables_mail_sends`에 `status='dry_run'`만 적재. 운영 검증 후 `false`로 토글
- 이력: `supabase/migrations/20260511_receivables_mail_sends_*` — RLS: 조회 admin/member, 변경 admin

## Rules

프로젝트 규칙은 `.claude/rules/`에 분리 관리:

- `conventions.md` — 설계 선행 원칙, 코드 스타일, Server Action 패턴
- `git.md` — Conventional Commits, HARD-GATE 설계 등급, Git Worktree
- `donts.md` — 금지 사항, 완료 기준, 합리화 방지 표
- `tdd.md` — TDD Iron Law (RED-GREEN-REFACTOR 강제)
- `debugging.md` — 4단계 체계적 디버깅 프로세스
- `design.md` — 디자인 토큰, 색상 규칙, 공통 컴포넌트

## Learning System

코드 수정 시 메트릭이 자동 수집되고, 학습 내용이 `.claude/memory/`에 축적된다:

- 새 세션 시작 시 `.claude/memory/patterns.md`를 읽어 이전 학습 활용
- `/learn save pattern` — 발견한 코드 패턴 저장
- `/learn save error` — 해결한 에러 패턴 저장
- `/metrics` — 빌드 성공률, 에러 빈도 대시보드
- `/retrospective` — 종합 회고 분석 실행
