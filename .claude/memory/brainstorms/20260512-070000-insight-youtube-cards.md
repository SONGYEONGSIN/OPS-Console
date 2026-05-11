# Brainstorm: 인사이트 메뉴 — YouTube Data API 바이브코딩 영상 자동 수집 + 카드 뉴스

세션: 2026-05-12 새벽
사이드바: 'AI & 자동화' > '인사이트' (slug `ai-insight`, 현재 pattern 'dash' / count "12" 하드코드)
선행 epic: my-ai-work(#45/#46/#47/#48)

## 의도

- **산출물**: `/dashboard/ai-insight` — 매일 자동 수집된 YouTube 바이브코딩 관련 영상 5~10건을 3열 그리드 카드 뉴스로 노출. 카드 클릭 시 YouTube 새창
- **사용자**:
  - 운영자 — 출근길/점심에 바이브코딩 트렌드를 빠르게 훑어 새 도구·기법 발견. 마음에 드는 영상은 바로 YouTube로 이동해 시청
  - 시점 — 일/주 단위 짬, 또는 my-ai-work 등록 전 영감 탐색
  - 대체 행동(없으면) — 각자 YouTube 검색, 시간 낭비
- **트리거**: 운영자별 AI 활용이 늘면서 외부 트렌드(Cursor / Claude Code / Lovable / v0 등) 캐치업 필요. 지금 안 하면 각자 트위터/유튜브에서 흩어져 발견 (집단 자원화 실패)
- **성공 기준**:
  - 매일 cron에서 5건 이상 신규 영상 적재 (실패율 < 10%)
  - 첫 2주 내 운영자 3명 이상이 카드 클릭 (사용 흔적)
  - YouTube API 일일 quota < 1000 unit (안전 마진 9000)

## 제약

### 기술
- Next.js App Router + Supabase + GitHub Actions (사용자 결정)
- YouTube Data API v3 — search.list 각 100 unit, 키워드 5~6개 × 일 1회 = ~500 unit
- 영상 중복 dedupe: `video_id` UNIQUE 제약 + upsert
- 카드 클릭 → YouTube 새창 (`target=_blank rel="noopener noreferrer"`) — 임베드 X (라이선스 / 광고 충돌 회피)
- DESIGN.md: 디자인 토큰 vermilion / sage / washi-raised 사용. 한자 0

### 비즈니스
- YouTube API key 발급은 사용자 책임 (Google Cloud Console 무료)
- GitHub Secret 등록 필요: `YOUTUBE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- 한국어 키워드 우선 (운영부 접근성)

### 코드베이스
- 정적 라우트 패턴 (my-todo / my-ai-work / receivables 일관) — `src/app/dashboard/ai-insight/page.tsx`
- features 패턴: `src/features/insight-videos/{schemas,queries}.ts`
- 스크립트: `scripts/insights-fetch.ts` (이미 scripts 디렉터리 존재)
- 사이드바 slug `ai-insight` 이미 등록 (pattern 'dash' → 'list'로 변경 필요? 정적 라우트면 무관)

## 대안 비교

| 항목 | 대안 A (채택) | 대안 B | 대안 Z |
|------|-------------|--------|--------|
| 핵심 | GitHub Actions cron + Supabase 적재 + 3열 그리드 카드, 새창 이동만 | Supabase Edge Function (pg_cron) + 임베드 플레이어 + 북마크 | 메뉴 비활성, Notion DB 수동 큐레이션 |
| 비용 | 1.5~2일 (마이그레이션 2 / features 3 / page+grid 2 / script 1 / workflow 1 / tests 3) | 3~4일 (Edge Function + 임베드 + bookmark 테이블) | 0일 (단 운영부 시간 일주일 N시간 손실) |
| 위험 | YouTube API quota 변동 / 키워드 품질 / 빈 결과 | Edge Function 학습 / 임베드 광고 / 북마크 RLS | 휘발성, 자료 축적 안 됨 |
| 가역성 | 높음 — 테이블 drop + workflow 비활성 | 낮음 — Edge Function/북마크 마이그레이션 부담 | n/a |
| 학습 효과 | "운영부가 자동 큐레이션 영상을 실제 본다"는 가설 검증 | 인터랙션 풍부한 UI 자산 | 검증 없음 |

## 추천 + 근거

**대안 A 채택**.

- **선택 근거**:
  1. 사용자 명시 결정(GitHub Actions cron / MVP 인터랙션) 그대로 따름
  2. "운영부가 자동 큐레이션 영상을 클릭한다"는 핵심 가설을 가장 빠르게 검증. 인터랙션 풍부도는 그 다음 결정
  3. 임베드보다 새창이 광고/연관영상 노출이 적어 집중도 높음
- **B 기각**: Edge Function/북마크는 가설 검증 전 over-engineering. 사용 데이터 본 후 follow-up 가치
- **Z 기각**: 자동화의 장점 미실현, 큐레이션 부담은 누군가 짊어져야

## 데이터 모델 (확정)

테이블 `insight_videos` (8 필드):

| # | 필드 | 형식 | 비고 |
|---|------|------|------|
| 1 | id | uuid pk | |
| 2 | video_id | text UNIQUE | YouTube 영상 ID (dedupe 키) |
| 3 | title | text | YouTube 제목 |
| 4 | channel_title | text | 채널명 |
| 5 | thumbnail_url | text | medium (320x180) |
| 6 | published_at | timestamptz | YouTube 게시일 |
| 7 | view_count | int8 | 수집 시점 조회수 (선택) |
| 8 | keyword | text | 매칭된 키워드 (예: '바이브코딩', 'cursor') |
| 9 | description | text | 처음 200자 (선택) |
| 10 | collected_at | timestamptz default now | |

인덱스: `video_id` UNIQUE, `published_at desc`, `keyword`.

## RLS 정책

- **SELECT**: 전원 read (`using (true)`)
- **INSERT/UPDATE/DELETE**: service_role only (cron 스크립트가 쓰기 — operators UI는 read-only)

```sql
create policy "insight_videos_select_all" on insight_videos
  for select to authenticated using (true);
-- INSERT/UPDATE/DELETE 정책 없음 → authenticated는 RLS로 차단
-- service_role은 RLS bypass라 cron 스크립트 OK
grant select on insight_videos to authenticated;
grant all on insight_videos to service_role;
```

## 키워드 (확정)

```ts
const SEARCH_QUERIES = [
  "바이브코딩",
  "AI 코딩",
  "Cursor 사용법",
  "Claude Code",
  "Lovable v0",
  "AI 디자인 도구",
  "AI 개발 환경",
];
```

각 키워드별 search.list (`maxResults=3`, `order=relevance`, `publishedAfter=7일전`) → 합쳐서 dedupe → 일 5~10건 적재.

## 카드 뉴스 UI (3열 그리드)

- 카드: 섬네일 16:9 + 제목 2줄 truncate + 채널명·날짜·키워드 chip
- 호버: vermilion border 강조
- 클릭 → `https://youtube.com/watch?v={video_id}` 새창
- 빈 상태: "오늘은 신규 수집이 없습니다" 안내
- 모바일: 1열, 태블릿 2열, 데스크톱 3열 (Tailwind grid-cols-1 md:grid-cols-2 lg:grid-cols-3)

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260512-070000-insight-youtube-cards.md`
- 예상 변경 파일 수: ~13 (마이그레이션 2 + features 3 + page+grid 2~3 + script 1 + workflow 1 + tests 3) → **HARD-GATE 간략 (Planner 권장)**
- 권장 후속: `/plan from-brainstorm 20260512-070000-insight-youtube-cards.md`
- PR 분할: PR-1 backend+cron / PR-2 UI

## Out of Scope (이 epic 제외)

- 좋아요·북마크·봤음 표시 (인터랙션 풍부도) — 사용 데이터 후 결정
- 영상 임베드 플레이어 — 새창 이동만
- 검색/필터 UI — 일 10건 규모면 grid만으로 충분
- 사이드바 count "12" 동적화 — 사이드바 구조 follow-up
- 키워드 운영자별 설정 — 단일 글로벌 set
- 알림 (Slack/Mail "오늘의 5건") — follow-up
