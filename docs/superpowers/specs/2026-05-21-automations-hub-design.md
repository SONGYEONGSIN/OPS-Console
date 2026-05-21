# 운영 자동화 허브 (automations) — 설계

작성일: 2026-05-21
브랜치: feat/automations-hub

> **v2 개정 (2026-05-21, 같은 날 후속)**: 아래 "## v2 개정" 섹션이 최신 결정이다.
> 카드 UI → 표준 테이블, "자동 실행" 토글(cron 제어) + automation_settings 테이블 추가,
> 메뉴 라벨 "자동화" → "자동화 실행", 사이드바 admin-only 명시화.
> v1 본문은 도메인 코어(types/registry/queries/action/job)의 기반 설명으로 유효하다.

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

---

## v2 개정 (2026-05-21) — 자동 실행 토글 + 표준 테이블

v1(카드 + 수동 버튼)을 사용자 피드백으로 개정한다. **최신 결정.**

### 변경 요약

1. **메뉴/제목 라벨**: "자동화" → "자동화 실행" (사이드바 `_data.ts` + `page-meta-config.ts` title).
2. **UI**: 카드 → **프로젝트 표준 목록 테이블** (`<table className="w-full text-sm">` + `thead`/`tbody`, `border-line`/`text-muted` 토큰, services Table.tsx 스타일). 컬럼: 자동화 / 스케줄 / 마지막 실행 / 자동 실행(토글) / 수동 실행(버튼).
3. **"자동 실행" 토글** (per job, admin): ON이면 cron 자동 실행 + **수동 버튼 비활성**. OFF이면 cron skip + **수동 버튼 활성**(admin만).
4. **토글이 cron을 실제 제어**: `scripts/insights-fetch.mjs`가 실행 전 `automation_settings`에서 해당 job의 enabled를 읽어 **OFF/없음이면 skip**(exit 0).
5. **메뉴 admin-only 명시화**: `SbItem`에 `adminOnly?: boolean` 추가, `automations` 항목에 설정. `filterSidebarSections`가 비-admin에게서 숨김 (allowed_menus 무관).

### 저장: automation_settings 테이블 (마이그레이션 신규)

```sql
-- supabase/migrations/2026MMDD_automation_settings_table.sql
begin;
create table if not exists public.automation_settings (
  job_id text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.automation_settings enable row level security;

drop policy if exists "automation_settings_select_admin" on public.automation_settings;
create policy "automation_settings_select_admin"
  on public.automation_settings for select to authenticated
  using (public.is_admin());

drop policy if exists "automation_settings_write_admin" on public.automation_settings;
create policy "automation_settings_write_admin"
  on public.automation_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.automation_settings to authenticated;
grant all on public.automation_settings to service_role;
commit;
notify pgrst, 'reload schema';
```

- **기본값 OFF**: row 없으면 enabled=false. 즉 **배포 직후 cron 자동 실행 멈춤** — admin이 토글 ON 해야 재개. (의도된 동작: 수동 우선)
- 토글 write는 server action이 `createAdminClient()`(service_role)로 upsert. RLS write 정책은 방어용(admin).

### 도메인 변경

- `types.ts`: `AutomationStatus`에 `enabled: boolean` 추가.
- `schemas.ts`: `setAutomationEnabledInputSchema = { jobId: string.min(1), enabled: boolean }` 추가.
- `queries.ts`: `getAutomationSettings()` (job_id→enabled Map, 기본 false) 추가. `getAutomationStatuses`가 각 status에 `enabled` 포함.
- `actions.ts`:
  - `setAutomationEnabledAction(prev, formData)` — requireAdmin → upsert automation_settings(via admin client) → revalidatePath. 신규.
  - `runAutomationAction` — **enabled 가드 추가**: 해당 job이 enabled(자동 ON)면 수동 실행 거부 `{ ok:false, message:"자동 실행 중에는 수동 실행할 수 없습니다." }` (쿨다운 검사 이전). OFF일 때만 기존 쿨다운/force 흐름.

### .mjs cron 게이트

`scripts/insights-fetch.mjs`: supabase client 생성 직후
```js
const { data: setting } = await supabase
  .from("automation_settings").select("enabled").eq("job_id", "insights-collect").maybeSingle();
if (!setting?.enabled) { console.log("insights-collect 자동 실행 비활성 — skip"); process.exit(0); }
```

### UI 상세 (AutomationHub → 테이블)

- `AutomationTable`(client) — `<table>` + 행마다 `AutomationRow`.
- 토글 셀: `setAutomationEnabledAction` 폼(useActionState). switch 형태(토큰 색), ON=vermilion, OFF=muted. 클릭 시 반대값 제출.
- 수동 실행 셀:
  - `enabled === true` → 버튼 disabled, 라벨 "자동 실행 중".
  - `enabled === false` & 쿨다운 0 → "지금 실행" (force=0).
  - `enabled === false` & 쿨다운>0 → 2단계 확인(기존 derived-state 유지, "쿨다운 N분 — 강제 실행" → "quota 소모 — 확인" force=1).
- 빈 행/결과 메시지 표시는 services Table 스타일 따름.

### 사이드바 admin-only

- `SbItem`에 `adminOnly?: boolean` 추가.
- `permission.ts` `filterSidebarSections`: `item.adminOnly && operator?.permission !== "admin"` 이면 제외. admin은 통과.
- `automations` 항목에 `adminOnly: true`.

### v2 테스트 추가/수정

- `schemas.test.ts` — setAutomationEnabledInputSchema 검증 추가.
- `queries.test.ts` — getAutomationStatuses enabled 매핑(기본 false) — 단, DB 의존이라 순수 부분만. computeCooldownRemaining 기존 유지.
- `actions.test.ts` — runAutomationAction enabled 가드(자동 ON이면 거부, run 미호출) + setAutomationEnabledAction(검증/admin/ upsert 호출/revalidate) 추가.
- `AutomationHub.test.tsx` — 테이블 렌더 + enabled ON이면 실행 버튼 disabled + OFF면 활성 + 토글 존재.
- `permission.test.ts` — filterSidebarSections adminOnly 항목 비-admin 숨김 / admin 노출.

### v2 검증

- lint / typecheck / test 통과.
- **마이그레이션 수동 적용 필요**: `automation_settings` 테이블 (Supabase SQL editor). 적용 전엔 cron이 항상 skip + 토글/상태 read 실패 가능 → 적용이 롤아웃 전제.
- dev: admin → /dashboard/automations 테이블 확인 → 토글 ON/OFF → 버튼 활성/비활성 전환 → OFF에서 "지금 실행" → 적재 확인.
