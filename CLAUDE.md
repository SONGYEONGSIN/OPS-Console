# OPS-Console

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
OPS-Console/
├── .claude/             # rules/agents/hooks/skills/memory/metrics/messages
├── src/
│   ├── app/
│   │   ├── login/                       # 인증 (signin/signup/SSO/reset)
│   │   ├── auth/                        # OAuth callback + onboarding callback
│   │   ├── api/worklog/log/             # 클라이언트 활동 로그 ingest (POST)
│   │   ├── global-error.tsx             # 한글 에러 페이지
│   │   └── dashboard/                   # OPS Console
│   │       ├── _components/             # chrome / sidebar / patterns / inspector / page-header
│   │       │   ├── PageActivityLogger.tsx  # 페이지 enter/leave 자동 worklog 적재
│   │       │   └── inspector/list-variants/  # 31 variant registry (open/closed)
│   │       ├── _data/                   # sidebar / page-meta-config / page-meta-derive
│   │       ├── services / contracts / contacts / incidents / backup / receivables  # 운영 list
│   │       ├── handover / onboarding / my-todo / my-ai-work / ai-tips             # 작업 list
│   │       ├── schedule / notices / feedback / team / worklog / ai-insight         # 일반 list
│   │       └── settings/                # admin only — env/build/deploy/db snapshot
│   ├── components/                      # auth/AuthChrome, common/(ScopeChips·ListPagination·ListSearch·ListSelect)
│   ├── features/                        # 도메인별 schemas/queries/actions (+ __tests__)
│   │   # auth · operators · services · contracts · contacts · incidents · backup-requests
│   │   # handover (records/progress/mail/categories) · onboarding (cohorts/checklist)
│   │   # ai-work · ai-tips · todos · worklog · schedule · posts · todos · menu-counts
│   ├── lib/
│   │   ├── pdf/                         # handover-pdf · backup-request-pdf (Pretendard Bold + fixed h/f)
│   │   ├── microsoft/                   # Graph sendMail · workbook-session · auth
│   │   └── supabase/                    # server / browser / admin
│   └── proxy.ts                         # 미인증 가드 + /login 리다이렉트 (Next 16)
├── e2e/                                 # Playwright spec
├── supabase/migrations/                 # 30+ 마이그 (operators / 도메인별 + RLS + GRANT)
├── public/fonts/                        # Pretendard-Regular.ttf + Pretendard-Bold.otf
├── scripts/                             # 운영/검증/import 도구 + mail-test
├── CLAUDE.md
└── package.json
```

## Design System

- **Design Tokens**: `src/lib/design-tokens.ts` — 색상, 간격, 타이포 중앙 정의
- **Common Components**: `src/components/common/` — 재사용 UI 패턴 (3회+ 반복 추출)
- **색상 규칙**: 컴포넌트에서 하드코딩 hex/rgb/hsl 금지, Tailwind 클래스 또는 토큰 사용
- **인터랙션 표준** (#846·#848): 목록/메뉴 항목형(테이블 행·nav·드롭다운·자동완성)은 호버 `hover:bg-line-soft`, 선택 `border-vermilion bg-vermilion/10 text-vermilion` — 운영가이드 좌측 nav가 기준. 버튼/토글/페이지네이션 호버는 별도 (이 표준 적용 금지)
- **표면·입력창 표준** (화이트 리뉴얼): 콘텐츠·크롬 배경 `bg-paper`(#ffffff, 사이드바만 웜 화이트 유지) / 카드·빈 상태 영역 `bg-situation-bg`(#fdfdfb, 운영리포트 카드 기준) / 기본 입력창(input/select/textarea) `border-line-soft bg-field-bg`(#fdfdfb) + `focus:border-ink focus:bg-white` / 검색창 `border-line-soft bg-search-field-bg`(잉크 4% 틴트) + 포커스 동일. 색 조정은 globals.css 토큰 한 줄로
- **검증**: `hooks/design-lint.sh`가 Write/Edit 시 자동 감지, `/design-audit`로 전체 스캔

## list-variants 아키텍처 (open/closed)

- **위치**: `src/app/dashboard/_components/inspector/list-variants/`
- **레지스트리**: `registry.ts`가 import-time static binding으로 **31 variant** → 컴포넌트 매핑 (전체 목록은 `list-variants/types.ts` Variant union 참조). RSC 직렬화 호환 — inline factory 금지
- **슬롯**: 각 variant 폴더에 `View.tsx` / `EditForm.tsx` / `Table.tsx` / `filters.ts` (filter 옵션 + blank 행 factory). 모두 optional
- **신규 도메인 추가 비용**: 1 폴더 신설 + `registry.ts` 1줄 + `types.ts` Variant union 1줄. dispatcher 무변경
- **Variant union 단일 정의**: `list-variants/types.ts`에 한 곳만. InspectorListBody / ListPattern이 import type으로 재사용
- **공통 상수**: `status.ts` — STATUS_LABEL / STATUS_COLOR / STATUS_RING. variant별 override 가능
- **dispatcher 예외**: `post-feedback`/`post-notice` variant prop 분기, `my-todo` Table은 `onToggleDone` closure, `handover`는 chip 비활성 (`Filters: []`)

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
- `next-env.d.ts`는 gitignore (dev/build마다 routes.d.ts 참조가 바뀌는 생성 파일). fresh clone에서 typecheck 전에 `npx next typegen` 필요 (CI 반영됨)

## 운영 메일·PDF (Microsoft Graph sendMail)

- **브랜드 통일**: 메일 제목/본문/PDF 헤더 모두 `[운영부 상황실]` (OPS-Console 노출 X)
- **발신자**: 로그인한 운영자 본인 메일박스 (Azure AD UPN = operators.email). Azure AD App에 `Mail.Send` Application permission + admin consent 필요
- **안전장치**: `MAIL_DRY_RUN=true` 시 실제 발송 안 함, 이력 테이블에 `status='dry_run'`만 적재
- **PDF 시인성** (`src/lib/pdf/*-pdf.tsx`): Pretendard Regular + Bold 다중 weight, 모든 페이지 fixed header(서비스명·브랜드) + footer(자동발송·페이지 번호), 카테고리 배지(흰 글씨 + vermilion 배경), `minPresenceAhead`로 헤더 외로움 방지, 배경색 제거(메일 클라이언트 테마)

도메인별 동작:
- **미수채권 독려** (receivables): admin 수동 트리거 → 경과일수 ≥ `MAIL_REMINDER_THRESHOLD_DAYS`(기본 10일) 청구건을 `학교담당자` 컬럼 이메일로 그룹화 일괄 발송. 이력 `receivables_mail_sends`
- **인수인계 요청** (handover): wizard step3에서 발송. 14 카테고리 → PDF 첨부. 이력 `handover_progress`
- **백업 요청** (backup-requests): 그룹별 발송 — 1명 일괄 모드 (single group) / 서비스별 모드 (per-substitute group). **PDF도 그룹별 본인 담당 services만 렌더** (메일 본문↔PDF 일관). 이력 `backup_request_mail_sends`

테스트 발송 스크립트 (DB 영향 없음, 단일 Graph 호출):
- `scripts/handover-mail-test.mjs` — `TARGET_EMAIL=` 환경 변수
- `scripts/backup-request-mail-test.mjs` — `MODE=bulk|per-service` + `TARGET_EMAIL` + `TARGET_EMAIL_2`

## 자동화 잡 (automations registry)

`/dashboard/automations` (admin only) + GitHub Actions cron. 등록: `src/features/automations/registry.ts` 1줄 + `jobs/{id}.ts` 1 모듈. cron 진입점은 `/api/automations/run` (Authorization: Bearer CRON_SECRET).

| Job ID | 실행 | 기능 | 이력 테이블 |
|---|---|---|---|
| `insights-collect` | 매일 08:00 (KST) | YouTube 인기 영상 수집 → 인사이트 페이지 | `insight_videos.collected_at` |
| `receivables-mail-operator` | 평일 10:00 (KST) | 운영자별 미수채권 본인 메일 알림 | `receivables_operator_mail_sends` |
| `receivables-deposit-match` | 매시간 | 미수 ↔ 입금내역 자동 매칭 (단건/N:1/N:M) + K/J열 PATCH + mismatch admin 알림 | `receivables_match_runs` (jsonb payload) |
| `team-briefing` | 매주 금 10:00 (KST) | 팀 보고 브리핑 Teams 발송 — 계약현황(누적)·차주 팀 업무(일정/마감)·AI 활용(내 AI 작업/TIP/인사이트 영상링크, 최근 7일) | `automation_runs` (공통) |

`MAIL_DRY_RUN` / `MAIL_MATCH_DRY_RUN` = `true` 시 외부 호출 없이 이력만 적재. 운영 전환 시 false.

GAS 미수채권 자동화는 4-PR 시리즈로 OPS-Console로 이전 완료 — 폐기 가이드: `docs/gas-receivables-decommission.md`.

## 운영 자동 기록 (worklog)

- **PageActivityLogger** (client) — `DashboardShell`에 mount, 페이지 진입/이탈을 `/api/worklog/log`로 POST (DEBUG/nav/enter|leave)
- **logActivity 서버 호출** — handover/contracts/contacts/services/incidents/onboarding-checklist actions에서 INFO 레벨 적재
- 사이드바: '분석 · AI > 분석 & 보고 > 업무 활동 로그' (slug `worklog`)
- 테이블 RLS: read all (운영부 공개) / insert는 service_role (server only)

## /dashboard/my-todo — services 기반 planner

- **좌측 (read-only)**: `services.write_start_at` D-60 이내, `operator_email = me OR developer_email = me`. 우선순위 자동(D-7=높음/D-30=중간/그 외=낮음)
- **우측 인스펙터 (sticky)**: `todos` 누적. 체크박스 → `toggleTodoDone` server action
- **link**: `todos.source_service_id` (FK services.id, on delete set null). 완료 시 좌측 row 음영 + 취소선
- **인터랙션**: HTML5 native drag(왼쪽 row → 인스펙터) + `+ 담기` 버튼 + 더블클릭

## /dashboard/settings — admin 시스템 운영

- **권한**: admin only (`me.permission !== 'admin'` → `/dashboard` redirect)
- **5 섹션**: 메일 설정 / 외부 연동 / 빌드 정보 / 배포 정보 / DB 정보
- **env 스냅샷** (`_env.ts`): MAIL_* / SHAREPOINT_* / AZURE_AD_* / NEXT_PUBLIC_VERCEL_* / NODE_ENV. 시크릿(SERVICE_ROLE_KEY/CLIENT_SECRET)은 boolean만 노출, 일반 값은 head+tail preview
- **DB 스냅샷** (`_db.ts` server-only + `_db-shared.ts` client-safe): 14 핵심 테이블 head count 병렬 fetch
- **server-only 분리**: client component(`SettingsClient`)가 import하는 type/format은 `_db-shared.ts`에 분리 (Next "use client" 빌드 가드 회피)

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
