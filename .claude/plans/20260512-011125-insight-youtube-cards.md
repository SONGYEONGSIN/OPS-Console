---
plan_id: 20260512-011125-insight-youtube-cards
status: in_progress
created: 2026-05-12T01:11:25Z
hard_gate: brief
source: .claude/memory/brainstorms/20260512-070000-insight-youtube-cards.md
---

# Plan: 인사이트 메뉴 — YouTube Data API 바이브코딩 영상 자동 수집 + 카드 뉴스

## Goal

`/dashboard/ai-insight` 라우트에 매일 자동 수집된 바이브코딩 관련 YouTube 영상 5~10건을 3열 그리드 카드 뉴스로 노출한다. 카드 클릭 시 YouTube 새창 이동. GitHub Actions cron이 일 1회 YouTube Data API v3 search.list를 호출해 `insight_videos` 테이블에 dedupe upsert. 운영자 UI는 read-only.

핵심 가설: "운영부가 자동 큐레이션된 영상을 실제 클릭해 본다." 첫 2주 내 운영자 3명 이상이 카드 클릭하면 MVP 성공.

## Approach

- 채택: 대안 A — GitHub Actions cron + Supabase 적재 + 3열 그리드 카드 (새창 이동만)
- 데이터 모델: `insight_videos` 단일 테이블 (10 필드, `video_id` UNIQUE로 dedupe)
- 권한: SELECT 전원 read / INSERT·UPDATE·DELETE는 service_role 전용 (RLS bypass)
- 키워드: 7개 한국어 우선 (`바이브코딩`, `AI 코딩`, `Cursor 사용법`, `Claude Code`, `Lovable v0`, `AI 디자인 도구`, `AI 개발 환경`)
- 수집: 키워드별 search.list (maxResults=3, order=relevance, publishedAfter=7일전) → 합쳐서 dedupe → 일 5~10건
- 코드베이스 컨벤션:
  - features 패턴 `src/features/insight-videos/{schemas,queries}.ts` (read-only이므로 actions.ts 없음, 쓰기는 cron script 단독)
  - 정적 라우트 `src/app/dashboard/ai-insight/page.tsx` — Next.js 정적 우선순위로 기존 `[slug]/page.tsx` dynamic을 자동 오버라이드
  - 마이그레이션: `20260518_insight_videos_table.sql` + `20260518b_insight_videos_rls.sql` (ai_work 마이그레이션 패턴 일관, `notify pgrst, 'reload schema'` 포함)
  - 스크립트: `scripts/insights-fetch.mjs` (`.env.local` 파싱 패턴은 `scripts/inspect-user.mjs` 그대로)
  - 워크플로: `.github/workflows/insights-fetch.yml` (cron `0 23 * * *` UTC = 한국 08:00 + `workflow_dispatch`)
- 분할:
  - **PR-1 (backend+cron)**: 마이그레이션 2 + features 2 + script 1 + workflow 1 + tests 2 = 8 파일
  - **PR-2 (UI)**: page 1 + cards 1 + tests 2 = 4 파일
- HARD-GATE 등급: ~12 파일 → **간략 설계** (Planner 권장) 충족

## Out of Scope

- 좋아요 / 북마크 / 봤음 표시
- 영상 임베드 플레이어 (새창 이동만)
- 검색 / 필터 UI
- 사이드바 count "12" 동적화 (`_data.ts`의 하드코드 유지)
- 키워드 운영자별 설정
- Slack / Mail 알림
- 사이드바 pattern `dash` → `list` 변경 (정적 라우트가 우선이므로 무관)

## 영향 파일

| 파일 | 변경 유형 | 설명 |
|------|---------|------|
| `supabase/migrations/20260518_insight_videos_table.sql` | 신규 | `insight_videos` 테이블 10필드 + 인덱스 3개 + PostgREST reload |
| `supabase/migrations/20260518b_insight_videos_rls.sql` | 신규 | RLS enable + select_all 정책 + GRANT (authenticated select / service_role all) |
| `src/features/insight-videos/schemas.ts` | 신규 | `insightVideoRowSchema` (zod) + `SEARCH_QUERIES` 상수 |
| `src/features/insight-videos/queries.ts` | 신규 | `listInsightVideos()` server-only RSC fetch + zod safe-parse skip 패턴 |
| `src/features/insight-videos/__tests__/schemas.test.ts` | 신규 | zod 정상 / 거부 케이스 |
| `src/features/insight-videos/__tests__/queries.test.ts` | 신규 | mock supabase / 정상·error·null·zod-fail-skip 케이스 |
| `scripts/insights-fetch.mjs` | 신규 | YouTube search.list 7회 + dedupe + supabase upsert |
| `.github/workflows/insights-fetch.yml` | 신규 | cron + workflow_dispatch 이중 트리거, secrets 사용 |
| `src/app/dashboard/ai-insight/page.tsx` | 신규 | RSC, `requireMenu("ai-insight")` + `listInsightVideos()` 호출 후 `<VideoGrid>` 렌더 |
| `src/app/dashboard/ai-insight/_components/VideoGrid.tsx` | 신규 | 3열 그리드 + 카드 + vermilion hover border + empty state |
| `src/app/dashboard/ai-insight/_components/__tests__/VideoGrid.test.tsx` | 신규 | 렌더 / 빈 상태 / 새창 속성 검증 |
| `src/app/dashboard/ai-insight/_components/__tests__/page-route.test.ts` | 신규 | 정적 라우트 등록 간이 검증 |

## 단계

### PR-1: backend + cron (T1 ~ T8)

### T1: insight_videos 테이블 마이그레이션
- 상태: pending
- 파일: `supabase/migrations/20260518_insight_videos_table.sql`
- 변경: `insight_videos` 테이블 10필드(id/video_id UNIQUE/title/channel_title/thumbnail_url/published_at/view_count/keyword/description/collected_at) + 인덱스 3개(video_id UNIQUE, published_at desc, keyword) + `notify pgrst, 'reload schema'`
- DoD: `supabase db push` 성공 + `select count(*) from public.insight_videos` 가 `0` 반환 + `\d public.insight_videos`에서 10 컬럼 확인
- 의존: 없음

### T2: insight_videos RLS + GRANT 마이그레이션
- 상태: pending
- 파일: `supabase/migrations/20260518b_insight_videos_rls.sql`
- 변경: `alter table … enable row level security` + `insight_videos_select_all` 정책 (authenticated, using true) + `grant select on … to authenticated; grant all on … to service_role` + `notify pgrst, 'reload schema'`
- DoD: `supabase db push` 성공 + `select policyname from pg_policies where tablename='insight_videos'`에서 1개 정책 확인 + `has_table_privilege('authenticated','public.insight_videos','SELECT')` = `t` / `INSERT` = `f`
- 의존: T1

### T3: insight-videos 스키마 (RED → GREEN)
- 상태: pending
- 파일: `src/features/insight-videos/schemas.ts`, `src/features/insight-videos/__tests__/schemas.test.ts`
- 변경:
  - 테스트: `insightVideoRowSchema` 정상 row 파싱 / `video_id` 누락 거부 / `published_at` ISO 검증 / `SEARCH_QUERIES` 길이 7 검증
  - 구현: zod `insightVideoRowSchema` (10필드, optional은 nullable+optional) + `SEARCH_QUERIES` 상수 (7개 한국어 키워드) export
- DoD: `npm test -- src/features/insight-videos/__tests__/schemas.test.ts` 4 tests passed, 0 failed
- 의존: 없음 (T1, T2와 병렬 가능)

### T4: insight-videos queries (RED → GREEN)
- 상태: pending
- 파일: `src/features/insight-videos/queries.ts`, `src/features/insight-videos/__tests__/queries.test.ts`
- 변경:
  - 테스트: `listInsightVideos()`가 supabase 정상 응답 시 zod-parsed row 반환 / supabase error 시 빈 배열 / `data: null` 시 빈 배열 / zod fail row skip
  - 구현: `server-only` import + `createClient` 후 `from("insight_videos").select("*").order("published_at",{ascending:false}).limit(30)` + zod safeParse loop
- DoD: `npm test -- src/features/insight-videos/__tests__/queries.test.ts` 4 tests passed, 0 failed
- 의존: T3

### T5: YouTube fetch 스크립트
- 상태: pending
- 파일: `scripts/insights-fetch.mjs`
- 변경: `.env.local` 파싱 → `SEARCH_QUERIES`별 fetch (`type=video&maxResults=3&order=relevance&publishedAfter=…&q=…&key=…`) → `video_id` 기준 dedupe (Map) → supabase service_role upsert (`onConflict: 'video_id', ignoreDuplicates: false`) + console summary
- DoD: 로컬에서 `YOUTUBE_API_KEY=… node scripts/insights-fetch.mjs` 실행 시 stdout에 "inserted: N, skipped: M" 출력 + `select count(*) from insight_videos` 가 5 이상
- 의존: T1, T2, T3

### T6: GitHub Actions workflow
- 상태: pending
- 파일: `.github/workflows/insights-fetch.yml`
- 변경: cron `0 23 * * *` UTC + `workflow_dispatch` + Node 22 setup + `YOUTUBE_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `NEXT_PUBLIC_SUPABASE_URL` 환경변수 주입 + `node scripts/insights-fetch.mjs` 실행
- DoD: GitHub Actions에서 `workflow_dispatch` 수동 실행 → 워크플로 success + 최근 10분 내 `insight_videos` row 5+
- 의존: T5

### T7: PR-1 종합 검증 (lint+typecheck+test+build)
- 상태: pending
- 파일: (검증 전용)
- 변경: 없음 — 명령 실행만
- DoD: `npm run lint` 0 errors / `npm run typecheck` 0 errors / `npm test` 전체 pass / `npm run build` exit 0 / 새 테스트 8개 모두 포함
- 의존: T1~T6

### T8: PR-1 생성
- 상태: pending
- 파일: PR description
- 변경: `feat: insight 영상 자동 수집 백엔드 + cron` 제목으로 PR 생성, secret 등록 안내 명시
- DoD: GitHub PR 생성됨 + CI green + 머지 후 main에서 cron 1회 수동 실행 → row 5+ 적재
- 의존: T7

---

### PR-2: UI (T9 ~ T12)

### T9: VideoGrid 컴포넌트 (RED → GREEN)
- 상태: pending
- 파일: `src/app/dashboard/ai-insight/_components/VideoGrid.tsx`, `src/app/dashboard/ai-insight/_components/__tests__/VideoGrid.test.tsx`
- 변경:
  - 테스트: row 3개 → 3카드 / 빈 배열 → 안내 / anchor `target=_blank rel="noopener noreferrer"` / 키워드 chip
  - 구현: `<a>` 카드 (Next/Image thumbnail 16:9, line-clamp-2, 채널·날짜·keyword chip) + `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6` + hover `border-vermilion` (토큰)
- DoD: `npm test -- VideoGrid` 4 tests passed
- 의존: T3

### T10: ai-insight 페이지 RSC + 정적 라우트 검증
- 상태: pending
- 파일: `src/app/dashboard/ai-insight/page.tsx`, `src/app/dashboard/ai-insight/_components/__tests__/page-route.test.ts`
- 변경: RSC `async function AiInsightPage()` — `requireMenu("ai-insight")` + sidebar meta + `<PageHeader>` + `listInsightVideos()` 호출 후 `<VideoGrid>` 렌더
- DoD: `npm test -- page-route` pass / `npm run build` 후 로그에 `○ /dashboard/ai-insight` 정적 표기
- 의존: T4, T9

### T11: 디자인 lint + 토큰 검증
- 상태: pending
- 파일: (검증 전용)
- DoD: `.claude/hooks/design-lint.sh` 또는 `/design-audit` 실행 시 새 파일에서 hex/rgb/oklch 0건
- 의존: T9, T10

### T12: PR-2 종합 검증 + 생성
- 상태: pending
- 파일: PR description
- DoD: `npm run lint` / `npm run typecheck` / `npm test` / `npm run build` 모두 exit 0 + CI green + `npm run dev`에서 `/dashboard/ai-insight` 카드 렌더 + 클릭 시 새창 이동 확인
- 의존: T8 (머지 완료), T11

## 리스크

- **YouTube API quota 변동**: 일 700 unit 예상. quotaExceeded 응답 시 partial success 허용 (다음날 dedupe upsert로 복구). 스크립트가 키워드별 사용량 출력
- **GitHub secret 누락**: 3개 secret 미등록 시 첫 cron 실패. PR-1 description에 안내 체크박스 + 명확한 에러 메시지
- **빈 결과 race**: 첫 운영부 접근 전 1회 수동 dispatch 강제 + empty state 안내
- **dedupe race**: `video_id` UNIQUE + idempotent upsert로 충돌 시 자동 거부
- **RLS 우회 실수**: 스크립트만 service_role 사용, queries.ts는 anon. PR-1 review 시 grep으로 service_role 노출 검사
- **정적 vs dynamic 라우트**: T10 `npm run build` 출력에서 `○ /dashboard/ai-insight` 확인
- **YouTube 영상 삭제**: 카드 클릭 404. follow-up
- **view_count outdated**: UI 노출 안 함, 트렌드 분석 follow-up용 컬럼 보존

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|----------|------|
