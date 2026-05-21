# 운영 자동화 허브 (automations) — 설계

작성일: 2026-05-21
브랜치: feat/assignments (또는 신규 feat/automations-hub)

## 배경 / 문제

인사이트 영상 수집(`scripts/insights-fetch.mjs`)은 GitHub Actions cron(매일 08:00 KST)으로
자동 적재된다. 그러나 private 저장소 Actions 무료분이 소진되면 **모든 workflow가 차단**되어
자동 수집이 멈춘다 (2026-05-20 실제 발생). 이때 운영자가 수동으로 수집을 트리거할 방법이 없다.

추가로, 앞으로 자동화 작업이 여러 종류로 늘어날 예정이다:
외부 데이터 수집 / AI 요약·가공 / 알림·리포트 발송 / 데이터 정리·동기화.

## 목표

1. admin이 버튼 클릭으로 인사이트 수집을 **즉시 수동 실행**할 수 있다 (Actions 의존 제거).
2. 자동화 작업을 **registry 패턴**으로 등록 — 신규 자동화 추가 비용 = `registry 1줄 + action 1개`.
3. cron + `.mjs`는 **그대로 유지** (무료분 있을 때 자동 백업).

## 비목표 (YAGNI — 2번째 자동화가 올 때까지 보류)

- `automation_runs` 로그 테이블 (마이그레이션). 첫 증분은 `insight_videos.max(collected_at)`로
  마지막 실행을 도출 → 마이그레이션 0건.
- 스케줄 on/off 토글 (cron이 DB 플래그를 읽게 하는 별개의 복잡 기능).
- 자동화 실행 이력 UI.

## 권한

- 허브 페이지·실행 액션 모두 **admin 전용** (`requireAdmin()`).
- 사이드바 항목은 `allowed_menus`에 `automations`를 **누구에게도 부여하지 않음** →
  member/viewer는 안 보이고, admin은 `canViewMenu` bypass로 노출.

## 쿨다운 (quota 보호)

- 인사이트 수집 1회 = ~700 quota unit, 일 한도 10,000.
- 기본 쿨다운 **60분**. 마지막 실행(`max(collected_at)`) 기준.
- 쿨다운 내 클릭 시: 버튼에 "마지막 수집 N분 전" 표시 + confirm
  ("quota를 소모합니다. 그래도 실행할까요?") → admin 확정 시 `force=true`로 강제 실행(bypass).

## 아키텍처

### 신규 `src/features/automations/`

- **`types.ts`**
  - `AutomationJob` = `{ id, label, description, scheduleInfo, cooldownMinutes, run: () => Promise<AutomationRunResult> }`
  - `AutomationRunResult` = `{ ok: boolean; message: string; details?: Record<string, number> }`
  - `AutomationStatus` = `{ id; label; description; scheduleInfo; cooldownMinutes; lastRunAt: string | null; cooldownRemainingMinutes: number }`
- **`schemas.ts`** — zod `runAutomationInputSchema` = `{ jobId: string; force: boolean }`
- **`jobs/insights-collect.ts`** — `.mjs` 로직 TS 포팅
  - 키워드 10개 search.list (각 100 unit) → dedupe
  - **videos.list는 ID 50개씩 batch** (PR #200 버그 선반영 — 50 초과 시 HTTP 400)
  - 조회수 `MIN_VIEW_COUNT=10_000` 필터 (null은 통과)
  - `MAX_UPSERT_PER_RUN=10` top-N (view_count desc)
  - `createAdminClient()`로 `insight_videos` upsert(onConflict video_id) + 60일 cleanup
  - 순수 헬퍼 export(테스트 대상): `dedupeByVideoId`, `filterPopular`, `rankTopN`, `batchIds`
- **`registry.ts`** — `AUTOMATION_JOBS: AutomationJob[]` (seed: `insights-collect` 1개), `getJob(id)`
- **`queries.ts`** — `getAutomationStatuses(): Promise<AutomationStatus[]>`
  - 각 job의 마지막 실행 도출 (insights-collect = `max(collected_at)` from `insight_videos`)
  - `cooldownRemainingMinutes` 계산 (순수 헬퍼 `computeCooldownRemaining(lastRunAt, cooldownMin, now)`)
- **`actions.ts`** — `"use server"` `runAutomationAction(prev, formData)`
  - `requireAdmin()`
  - input zod 검증 (jobId, force)
  - `getJob(jobId)` 없으면 `{ ok:false, message }`
  - 쿨다운 검사: `force=false` & 잔여>0 → `{ ok:false, message:"쿨다운" }`
  - `await job.run()`
  - `revalidatePath("/dashboard/automations")` + `revalidatePath("/dashboard/ai-insight")`
  - 결과 반환

### 페이지 — 프로젝트 표준 형식

- **`app/dashboard/automations/page.tsx`**
  - `requireMenu("automations")` + `me.permission !== "admin"` → `redirect("/dashboard")` (settings 페이지와 동일 패턴)
  - `PageHeader`(다른 페이지와 동일) + `getAutomationStatuses()` 결과를 `AutomationHub`에 전달
- **`_components/AutomationHub.tsx`** (client)
  - 잡 목록 = 표준 카드/테이블 스타일, **design-tokens 색만** (washi/ink/cream/vermilion, 하드코딩 색 금지)
  - 각 행: label / description / scheduleInfo / 마지막 실행 / 쿨다운 잔여 / "지금 실행" 버튼
  - `useActionState`(runAutomationAction) — 로딩 상태 + 결과 메시지
  - 쿨다운 내 클릭 → **인라인 2단계 확인**(native confirm 미사용): 버튼이 "quota 소모 — 확인"으로 전환되고 재클릭 시 hidden `force=1` 제출. 표준 디자인 톤 유지

### IA / 메타

- **`_data.ts`** — `분석 · AI` 섹션 > `AI & 자동화` 그룹에 항목 추가:
  `{ ico: "·", label: "자동화", slug: "automations", pattern: "list" }`
- **`page-meta-config.ts`** — `automations: { headline: { accent: "AI & 자동화", title: "자동화" }, description: "운영 자동화 작업을 수동으로 실행합니다. admin 전용 — quota를 소모하므로 신중히 사용합니다." }`

### 유지

- `scripts/insights-fetch.mjs` + `.github/workflows/insights-fetch.yml` cron 무변경.

## 테스트 (TDD)

- `__tests__/insights-collect.test.ts` — 순수 헬퍼 (dedupe / filterPopular / rankTopN / batchIds 50분할)
- `__tests__/schemas.test.ts` — runAutomationInputSchema 검증
- `__tests__/queries.test.ts` — computeCooldownRemaining (경계: 정확히 60분, 0분, 초과)
- `__tests__/registry.test.ts` — insights-collect 존재 + 필드 shape
- `_components/__tests__/AutomationHub.test.tsx` — 렌더 + 쿨다운 표시 + 버튼

## 검증

- `npm run lint` / `npm run typecheck` / `npm test` 통과
- dev 서버에서 admin 로그인 → /dashboard/automations 진입 → 버튼 클릭 → insight_videos 적재 확인

## 롤아웃

- 코드만으로 동작 (마이그레이션 없음). admin은 즉시 사용 가능.
- 환경변수 `YOUTUBE_API_KEY` 가 서버(Vercel)에 존재해야 함 — cron secret과 동일 키 재사용.
