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
│   │       │   └── inspector/list-variants/  # 32 variant registry (open/closed)
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
│   │   ├── pdf/                         # incident · incident-report · meeting · quote · report (Pretendard Bold + fixed h/f)
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
- **날짜·시각**: `@/lib/kst-format` 의 `kstFormat(options)` — KST + 24시간제가 딸려 온다. `Intl.DateTimeFormat("ko-KR", …)` 직접 호출 금지(12시간제로 샌다)
- **버튼 호버**: `hover:bg-ink hover:text-cream` (보더 있으면 `hover:border-ink` 함께). 약한 톤(`hover:bg-washi`)은 버튼에 금지 — 카드·행은 별개
- **헤더 액션 버튼**: 목록 제목 오른쪽 액션은 `components/common/HeaderActionButton` — vermilion 배경 하나뿐이고 변형 없음. 클래스만 필요하면 `HEADER_ACTION_CLASS`
- **숫자 표기**: 금액·건수·순번은 **기본 폰트 + `tabular-nums`**(KpiCard가 기준). `font-mono`는 식별자·기계값 전용 — 등기번호·경로·호출 명령어·해시
- **검증**: `hooks/design-lint.sh`가 Write/Edit 시 자동 감지, `/design-audit`로 전체 스캔

## list-variants 아키텍처 (open/closed)

- **위치**: `src/app/dashboard/_components/inspector/list-variants/`
- **레지스트리**: `registry.ts`가 import-time static binding으로 **32 variant** → 컴포넌트 매핑 (전체 목록은 `list-variants/types.ts` Variant union 참조). RSC 직렬화 호환 — inline factory 금지
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

## 운영 메일·첨부 (Microsoft Graph sendMail)

- **브랜드 통일**: 메일 제목/본문/첨부 헤더 모두 `[운영부 상황실]` (OPS-Console 노출 X)
- **발신자**: 로그인한 운영자 본인 메일박스 (Azure AD UPN = operators.email). Azure AD App에 `Mail.Send` Application permission + admin consent 필요
- **안전장치**: `MAIL_DRY_RUN=true` 시 실제 발송 안 함, 이력 테이블에 `status='dry_run'`만 적재
- **첨부 형식**: 인수인계·백업요청은 **HTML 첨부**(`.html`, `text/html`) — 메일 클라이언트에서 바로 열린다. PDF는 사고/경위서·회의록·견적·리포트에서 사용
- **PDF 시인성** (`src/lib/pdf/*-pdf.tsx`): Pretendard Regular + Bold 다중 weight, 모든 페이지 fixed header(서비스명·브랜드) + footer(자동발송·페이지 번호), 카테고리 배지(흰 글씨 + vermilion 배경), `minPresenceAhead`로 헤더 외로움 방지, 배경색 제거(메일 클라이언트 테마)

도메인별 동작:
- **미수채권 독려** (receivables): admin 수동 트리거 → 경과일수 ≥ `MAIL_REMINDER_THRESHOLD_DAYS`(기본 10일) 청구건을 `학교담당자` 컬럼 이메일로 그룹화 일괄 발송. 이력 `receivables_mail_sends`
- **인수인계 요청** (handover): wizard step3에서 발송. 14 카테고리 → **HTML 첨부**(`features/handover/html-document.ts`). 이력 `handover_progress`
- **백업 요청** (backup-requests): 그룹별 발송 — 1명 일괄 모드 (single group) / 서비스별 모드 (per-substitute group). **HTML 첨부도 그룹별 본인 담당 services만 렌더** (메일 본문↔첨부 일관). 이력 `backup_request_mail_sends`

테스트 발송 스크립트 (DB 영향 없음, 단일 Graph 호출):
- `scripts/handover-mail-test.mjs` — `TARGET_EMAIL=` 환경 변수
- `scripts/backup-request-mail-test.mjs` — `MODE=bulk|per-service` + `TARGET_EMAIL` + `TARGET_EMAIL_2`

## 개발·테스트 오픈안내 탭 (대학 오픈 안내 메일 자동 발송)

`/dashboard/dev-test?tab=open-notice` — 원서접수 페이지가 열렸다고 대학 담당자에게 알린다. **담당 운영자가 서비스별로 토글을 켜두면 오픈 시각에 알아서 나간다.**

**발송 시각을 사람이 입력하지 않는다.** 오픈 시각은 `closing_services.write_start_at` 에 이미 있어서, 다시 입력하게 하면 같은 값을 두 벌로 만드는 것이고 둘이 어긋나면 엉뚱한 시각에 나간다. 토글 ON = `open_notice_sends` 에 `status='scheduled'` + `scheduled_at = write_start_at` 행을 만드는 것이고, OFF = 그 대기 행을 지우는 것이다(이미 나간 이력은 남는다). 실제 발송은 dispatch 주기 때문에 오픈 시각 ±5분이다.

자동이라 **수신자와 본문이 미리 확정돼 있어야** 한다 — 행 클릭 → 인스펙터에서 수신자 고르고 초안 확인 → 토글 ON. 내용을 고치려면 껐다 켠다.

목록은 **오픈 예정 + 접수 중**(`phaseOf !== "closed"`)이다. 테스트 탭처럼 오픈 예정만 담으면 **토글을 못 켠 채 오픈된 건이 목록에서 사라져 영영 안내를 못 보낸다.** 오픈 시각이 지난 행은 보이되 비활성(클릭 무반응)이고, 인스펙터에서도 켤 수 없다. 결제까지 끝난 건은 이제 와서 안내할 이유가 없어 뺀다.

초안에서 값을 만들어 넣는 칸은 넷이고 그중 둘이 조립 URL이다.

- **모집구분은 `service_name` 그대로** — 실데이터가 이미 "2027학년도 수시모집" 형태의 완성된 문장이라 가공하지 않는다. `category`(수시/정시…)나 `admission_type`(반응형원서/공통원서/일반접수)은 모집구분이 아니다
- **접수주소**: 공통원서 → `apply.jinhakapply.com`, 그 외 → `enter.jinhakapply.com`. `entertest/target-url.ts`가 테스트 시스템에서 하는 분기와 같은 규칙이지만 **합치지 않는다** — 테스트 호스트가 바뀌어도 대학에 나가는 메일은 그대로여야 한다
- **경쟁률**: **기본으로 안 넣는다** — 목록 295건 중 59건(대학원·외국인·편입 등)이 경쟁률을 공개하지 않아, 기본으로 넣으면 그 대학 담당자에게 404 링크를 보내게 된다. 인스펙터 체크박스로 켠다. 끄면 경쟁률 줄과 함께 접수관리자 설명의 '경쟁률' 표현도 빠진다. URL은 `addon.jinhakapply.com/RatioV1/RatioH/Ratio{서비스ID}1.html`, 차수 1 고정(`closing_services`에 차수 컬럼이 없어 2차수는 운영자가 본문을 고친다)
- **접수기간**: `write_start_at ~ write_end_at`. **종료 연도는 시작과 같은 해일 때만 생략한다** — 실데이터에 종료가 1년 뒤로 적힌 건이 7개 있어(건국대·경상국립대 등), 늘 생략하면 `2026.09.07 ~ 09.11`로 멀쩡해 보이고 1년 틀린 기간이 발송된다

**본문 HTML은 `open-notices/mail-html.ts`가 만든다. `buildReplyHtml`을 쓰면 안 된다** — 그쪽은 `\n`→`<br>`만 하는데 HTML은 연속 공백을 1칸으로 접어서, 콜론을 세로로 맞춘 초안의 정렬이 무너진다. 에디터에서는 완벽하고 받은 편지함에서만 깨진다. 선두 공백과 2칸 이상 런만 `&nbsp;`로 바꾸고(단일 공백은 줄바꿈을 위해 남긴다), URL은 앵커로 감싼다. `white-space: pre-wrap`은 Outlook이 무시해서 쓰지 않는다. **구분선은 16자로 짧게 둔다** — 32자였을 때 모바일 메일에서 화면 폭을 넘어 두 줄로 갈라졌다.

**설정은 본인 담당 건만**(admin은 전체). 탭이라 `requireMenu("dev-test")` 하나가 세 탭을 다 가드해서, 안 막으면 개발·테스트 권한자 전원이 남의 담당 대학에 메일을 걸 수 있다. 판정은 `closing_services.operator_name` vs `operators.name`이고 **서버 action이 폼을 믿지 않고 DB에서 다시 읽는다**(오픈 시각도 마찬가지). 목록은 전건 보이고 설정만 막는다.

**자동이라 실패를 아무도 안 보고 있다** — dispatch 결과는 `automation_runs`에 안 남아 일일 보고에도 안 잡힌다(자료요청도 같은 사각지대). 그래서 실패는 목록 '발송실패' 배지와 인스펙터 문구로 드러낸다.

이력은 `open_notice_sends`(`service_id`는 Moa 서비스ID **정수, FK 없음** — `closing_services`는 스크랩 미러라 FK를 걸면 이력 무결성이 스크래퍼에 묶인다). dispatch는 `/api/open-notices/dispatch` — **cron-job.org 등록이 필요하고, 안 하면 자동 발송이 통째로 죽는다.**

설계 문서: `docs/superpowers/specs/2026-08-22-open-notice-mail-design.md`

## 백업 요청 서비스 검색 (원서접수 + 발표)

백업 요청의 서비스 검색은 두 시스템을 **한 검색창**에서 찾고 `[원서]`/`[발표]` 배지로 구분한다.

- **원서접수**: `closing_services` (Moa 스크래핑, **신규만 누적** — 한 번 적재된 건은 검색에서 빠져도 남는다)
- **발표**: `announcement_services` (합격자통합관리시스템 자료, 붙여넣기 업로드)

발표 서비스를 `closing_services`에 섞으면 스크래핑 인제스트가 관리하는 테이블을 오염시키므로 별도 테이블이다.
업로드는 **서비스목록** 페이지 `+ 발표 서비스 일괄등록`(연락처 일괄등록과 같은 붙여넣기 방식) —
자료가 '발표 회차' 단위라 같은 서비스가 여러 줄로 오므로 `features/announcement-services/paste-parse.ts`가
서비스ID 기준으로 합치고 최근 발표일만 남긴다. 검색 후보 범위는 **올해−2년**(고정 연도 아님).

후보 키는 두 소스 모두 `String(service_id)` — 저장된 요청을 되읽을 때 같은 규칙으로 만들어지므로
(`backup-requests/queries.ts`) 접두사를 붙이면 기존 요청 편집이 깨진다.

## /dashboard/tools — 도구 (admin only)

에이전트가 쓰는 **스킬 53 · 에이전트 24 · 훅 28 · 룰 7** 을 한곳에서 본다. 사이드바 'AI & 자동화 > 에이전트' 바로 아래.

목록은 DB가 아니라 레포 `.claude/` 를 훑어 만든 **커밋된 생성물**(`src/features/dev-tools/catalog.generated.ts`)이다. `npm run tools:scan` 으로 다시 만들고, `.claude/` 와 어긋나면 CI(build-check)가 잡는다. 빌드 시점 생성 + gitignore 로 두지 않는 이유는 fresh clone 에서 typecheck·test 가 깨지기 때문(`next-env.d.ts` 와 같은 문제).

**MCP·플러그인은 없다** — 둘 다 `~/.claude.json`·`~/.claude/settings.json` 에 있어 git 에 안 들어오고 Vercel 은 홈 디렉터리를 못 읽는다. 보려면 스냅샷을 올리는 경로가 따로 필요하다.

**끌 수 있는 건 스킬뿐이다.** 에이전트·훅·룰은 파일 존재가 곧 활성이라 끄려면 파일을 옮겨야 하고 그건 git 변경이다 — 그 종류에는 스위치를 안 보여준다.

토글은 **바로 적용되지 않는다.** 실제 스위치는 각 PC의 `.claude/settings.local.json` 인데 gitignore 라 Vercel 이 만질 수 없다. 웹은 `dev_tool_toggles` 에 결정만 적고, 그 PC에서 `npm run tools:apply` 가 `permissions.deny` 의 `Skill(…)` 항목만 다시 쓴다(나머지 permissions·env·hooks 는 안 건드리고, 덮어쓰기 전 `.bak` 을 남긴다). 반영 시각은 `dev_tool_applies` 에 PC별로 남아 화면이 **'아직 반영 안 된 변경 N건'** 을 띄운다 — 이게 없으면 껐다고 믿은 채로 계속 돈다. 적용 후 Claude Code 재시작 필요.

## 자동화 잡 (automations registry)

`/dashboard/automations` (admin only) + GitHub Actions cron. 등록: `src/features/automations/registry.ts` 1줄 + `jobs/{id}.ts` 1 모듈. cron 진입점은 `/api/automations/run` (Authorization: Bearer CRON_SECRET).

| Job ID | 실행 | 기능 | 이력 테이블 |
|---|---|---|---|
| `insights-collect` | 매일 08:00 (KST) | YouTube 인기 영상 수집 → 인사이트 페이지 | `insight_videos.collected_at` |
| `receivables-mail-operator` | 평일 10:00 (KST) | 운영자별 미수채권 본인 메일 알림 | `receivables_operator_mail_sends` |
| `receivables-deposit-match` | 매시간 | 미수 ↔ 입금내역 자동 매칭 (단건/N:1/N:M) + K/J열 PATCH + mismatch admin 알림 | `receivables_match_runs` (jsonb payload) |
| `team-briefing` | 매주 금 10:00 — **회사 PC Windows 작업 스케줄러** (`scripts/team-briefing/publish-local.mjs`) | 주간 브리핑 **초안 생성까지만**(스티비풍 `/r/briefing/[token]`, claude -p 스토리+근속 기념일) + 본인 Teams 채팅으로 미리보기 알림. **그룹채팅 티저는 자동화 페이지 [발행] 확정 시에만 발송**. 서버 API: `/api/team-briefing/draft·stage` (CRON_SECRET), 발행은 admin server action. registry 잡(수동 실행)도 초안 생성 — **Vercel cron 스케줄은 제거 필수** | `team_briefings`(status draft/published) + `automation_runs` |
| `ratio-audit` | 수동 실행 — 회사 PC 폴러가 수행 (cron 미등록) | **TEST 서버** 경쟁률 세팅(스케줄·안내 문구·접수일정)을 대조해 오설정을 담당 운영자 Teams 개인 채팅으로 알립니다. 자동화 페이지 [실행]은 `ratio_audit_requests`에 pending만 적재하고, 회사 PC 폴러(`scripts/moa-ratio/poll-local.ps1`)가 5분 내 claim해 `audit.py`를 실행 | `ratio_audit_requests` + `ratio_audit_runs` (kind=schedule) |
| `ratio-page-check` | 수동 실행 — 같은 폴러가 수행 (cron 미등록) | **REAL 서버** 경쟁률 HTML 링크 상태(404 등)를 점검해 담당 운영자 개인 채팅으로 알립니다. 대상은 `StartDate ≥ 올해 9월 1일` — 수시 경쟁률이 열리는 9월부터 대상이 생깁니다 | `ratio_audit_requests` + `ratio_audit_runs` (kind=page) |
| `automation-digest` | 매일 11:00 (cron-job.org) | 그날 전체 잡의 실행 결과 + **미실행 감지**를 본인 Teams 노트 채팅으로 보고 | `automation_runs` |

`MAIL_DRY_RUN` / `MAIL_MATCH_DRY_RUN` = `true` 시 외부 호출 없이 이력만 적재. 운영 전환 시 false.

## 자동화 실행 보고 (Teams)

자동화 결과는 **두 경로**로 본인 Teams 노트 채팅(`48:notes`)에 온다. 발신자는 경쟁률 점검·팀 뉴스레터와 같은 계정(`TEAMS_AUTOMATION_SENDER` → `TEAMS_BRIEFING_SENDER` → 기본값).

- **실패 즉시** — `recordAutomationRun`이 기록 직후 판정. **직전 실행도 실패면 다시 보내지 않는다**(`failure-notify.ts`) — 입금 매칭이 매시간이라 이 억제가 없으면 장애 하루에 24통이 온다. 지속 장애는 일일 보고가 매일 상기시킨다
- **일일 보고** — `automation-digest` 잡이 11:00에 전체 잡을 훑는다. 실패 이벤트가 없는 **미실행**(cron 등록 누락·회사 PC 꺼짐)까지 잡는 게 목적

미실행 판정은 `AutomationJob.cadence`(`hourly|weekday|daily|weekly|monthly|manual`)별 임계로만 본다 — `scheduleInfo`는 사람이 읽는 문장이라 기계 판정에 못 쓰고, 예정 시각 대비 판정은 격주 게이트·공휴일 때문에 오탐이 잦다. `weekday` 임계가 96h인 건 금→월 공백(72h)을 넘겨야 해서다.

회사 PC 잡은 서버가 실행 결과를 알 길이 그 잡의 보고 endpoint뿐이라, 거기서도 `recordAutomationRun`을 호출해야 두 경로에 잡힌다(`/api/closing/run-log`가 그렇게 한다).

`AUTOMATION_REPORT_DRY_RUN=true` 시 발송 없이 판정만.

경쟁률 점검은 **두 잡으로 나뉜다** — 세팅 점검(TEST, 스케줄·문구 대조 + claude 판정)과 페이지 점검(REAL, HTML 링크 상태). 같은 큐(`ratio_audit_requests.kind`)를 쓰고 폴러가 `RATIO_AUDIT_KIND`로 `audit.py` 동작을 고른다. 둘 다 Moa 로그인을 타므로 **동시 실행은 막는다**(pending/running 1건 정책, kind 무관). 필요 env: `RATIO_AUDIT_DRY_RUN`/`TEAMS_RATIO_AUDIT_SENDER`. 상세: `docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md`

**예외**(`ratio_audit_exceptions`): '설정은 다르지만 합의된 정상'을 발송에서 뺀다(연세대 서울 수시 1차 — 접수 마감 17시, 마감 후 18시 공개는 내부 수동 진행 합의). `(service_id, seq)` 단위이며 seq null이면 전 차수. 판정 결과(payload)에는 그대로 남기고 **발송에서만** 제외하고, 관리자 메시지에 '예외 N건 제외'로 드러낸다. 등록은 DB 직접(관리 화면 없음).

메시지 하단에는 공통 안내(자동 발송 고지)를 인용 블록으로 붙인다. **Teams 채팅 본문의 이미지는 인라인 배치가 불가능하다** — `hostedContents`로 올리면 렌더는 되지만 width/height를 무시하고 블록으로 떨어진다(96/40/28px × 문장중간·인용블록·문단맨앞 전부 라이브 확인). 이미지가 꼭 필요하면 Teams 사용자 지정 이모지 등록이 별도 경로.

발송(`features/ratio-audit/dispatch.ts`): 이상 건을 담당자별로 묶어 **1:1 채팅**(`ensureOneOnOneChat` — Graph `POST /chats`, 기존 채팅 있으면 그대로 재사용)으로 본인 담당분만 보낸다. 이름→메일은 `operators.name` 대조. 담당 미상·미매칭·발송 실패·링크오류·건너뜀은 관리자 채팅으로 취합 — 기본 `48:notes`(발신자 본인 노트 채팅, self 채팅은 Graph로 생성 불가), `TEAMS_RATIO_AUDIT_ADMIN_CHAT_ID`로 덮어쓸 수 있다.

GAS 미수채권 자동화는 4-PR 시리즈로 OPS-Console로 이전 완료 — 폐기 가이드: `docs/gas-receivables-decommission.md`.

## 어시스턴트 (우하단 채팅 런처)

메뉴가 아니라 **화면에 고정된 채팅 아이콘** → 표준 `InspectorPanel`이 열린다 (`_components/assistant-launcher/`).

**Teams·SharePoint 파일도 지식망에 넣는다** — 지식망 화면의 '파일로 초안 만들기'에 링크를 붙여넣으면 같은 큐로 간다. 새 파이프라인이 아니라 `read_file` 도구 하나를 붙인 것이다: 서버가 Graph 로 **PDF 변환**(`/content?format=pdf`)해 짧게 사는 주소를 주고, 폴러가 내려받아 Read 한다(우편물 판독과 같은 구조). Word·PPT·Excel 이 한 형식으로 모인다. **원본이 이미 PDF 면 변환을 건너뛴다** — 변환 서비스는 PDF 를 입력으로 안 받는데 거절이 302 뒤에 온다(주소는 멀쩡히 주고 열면 406 `InputFormatNotSupported`), 그래서 서버는 성공으로 보이고 폴러에서 '내려받기 406' 으로 죽었다. 결과는 `제안/` 초안이고 본 위치로는 사람이 옮긴다. 링크 해석은 Graph `/shares/{token}` 에 맡긴다 — 채널·채팅·공유 링크가 모양이 제각각이라 직접 파싱하면 새 형태마다 깨진다.

**갈래는 하나다** — **회사 PC**의 구독(Agent SDK)이 볼트 마크다운을 **직접 Read**하고 운영 데이터는 도구로 조회한다. 30~40초 걸린다.

빠른 답변(Gemini)이 있었으나 걷어냈다(2026-08-19). 백업이 아니었기 때문이다 — **볼트는 회사 PC의 파일이라 Vercel에서 못 읽는다.** 모델을 무엇으로 바꿔도 마찬가지고, 그쪽은 Supabase 인덱스 발췌만 봤다. 같은 질문에 다른 답이 나오는 별개 기능이었고 이력을 안 남겨 쓰였는지조차 알 수 없었다.

**사내 Teams 봇도 같은 큐를 쓴다** — `/api/assistant/bot`(CRON_SECRET + 요청자 UPN). 봇에 도구를 따로 붙이지 않는 이유는 볼트가 회사 PC의 파일이라 봇이 어디에 있든 못 읽기 때문이다. 도구만 빌려주면 같은 질문에 웹과 다른 답을 내는 두 번째 뇌가 된다 — 빠른 답변을 걷어낸 이유가 그것이다. 요청자는 `operators.email` 에 있어야 받는다(비밀키 하나로 사칭 불가).

회사 PC가 안 가져가도 **화면은 폴링을 멈추지 않는다.** 15초가 지나면 "에이전트를 계속 부르는 중 — 아직 응답이 없는 것 같아요"로 알리고 3분까지 기다린다. 예전엔 여기서 끊었는데, claim이 27초 걸린 요청의 답이 통째로 사라진 적이 있다.

- **큐**: `assistant_requests` (본인 것만 RLS). 웹 창구 `/api/assistant/claude`(세션) ↔ 폴러 창구 `/api/assistant/claude/claim`(CRON_SECRET)
- **폴러**: `scripts/assistant/serve-local.mjs` — 상주(2초 폴링). 셋업·문제해결은 `docs/assistant-poller-setup.md`
- **판단은 전부 서버에** — 프롬프트 조립·근거 추출이 `features/assistant/claude-prompt.ts`에 있어 프롬프트를 고칠 때 회사 PC를 안 만진다
- **도구**: `/api/assistant/tools/*` (CRON_SECRET). 현재 일정 조회 1개. 볼트에 없는 운영 데이터는 문서가 아니라 도구로 답한다
- **격리 필수**: `strictMcpConfig`+`mcpServers`+`settingSources:[]` 없이는 그 PC의 MCP(메일·Teams·노션)에 에이전트가 닿는다. 볼트는 전원이 쓰는 파일이라 문서 한 줄이 그 경로를 연다

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
