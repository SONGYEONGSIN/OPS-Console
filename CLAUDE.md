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
│   │   └── auth/       # OAuth callback
│   ├── components/     # React 컴포넌트 (auth/AuthChrome 등 도메인별 폴더)
│   ├── features/       # 도메인 로직 (auth, operators — schemas/actions/queries)
│   ├── lib/            # 유틸리티, Supabase 클라이언트
│   └── middleware.ts   # 미인증 가드 + /login 리다이렉트
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
