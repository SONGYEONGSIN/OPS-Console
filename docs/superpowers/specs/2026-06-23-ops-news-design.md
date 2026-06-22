# 운영부 뉴스(대학 관련 뉴스 자동 수집) 설계

작성일: 2026-06-23
상태: 설계 승인됨 → 구현 계획(plan) 전 단계

## 1. 개요

사이드바 '개요' 그룹의 **운영부 달력(`schedule`) 아래**에 **운영부 뉴스(`news`)** 메뉴를 추가한다.
대학 관련 뉴스(통폐합·폐교·정원감축 등)를 RSS로 자동 수집해 목록으로 보여준다.
기존 `insights-collect`(YouTube 인기영상 수집) 자동화 패턴을 복제 — 수집 잡 + cron + 이력/권한 인프라 재사용.

### 요구사항
- 대학 통폐합 등 토픽 뉴스 자동 수집 (키워드 기반)
- 운영부 뉴스 메뉴(목록형)에서 제목·출처·날짜 확인, 클릭 시 원문 링크
- 자동 주기 수집 (cron)

## 2. 핵심 결정 (확정)

| 항목 | 결정 |
|------|------|
| 데이터 소스 | **멀티소스 RSS** (구글 뉴스 RSS 키워드 + 교육부 + 전문지). 키 없음 |
| 수집 키워드 | 통폐합 · 폐교 · 정원감축 · 글로컬대학 · 구조조정 (NEWS_SOURCES 설정으로 추가 자유) |
| UI | **목록형**(ListPattern + 인스펙터) |
| 패턴 | `insights-collect` 자동화 잡 복제 (registry 1줄 + jobs 모듈) |
| 라이브러리 | `fast-xml-parser` 추가 (RSS XML 파싱) |
| cron | cron-job.org + CRON_SECRET (기존 경로, 코드 무변경) |

## 3. 데이터 소스 (검증)

### 구글 뉴스 RSS (핵심, 검증 완료)
`https://news.google.com/rss/search?q={query}&hl=ko&gl=KR&ceid=KR:ko`
- "대학 통폐합" 약 100건 반환 확인. **한국대학신문·교수신문 등 전문지 기사를 이미 집계**.
- `<item>`: `<title>`(출처 미포함), `<link>`(구글 리다이렉트), `<pubDate>`(RFC 2822 `Tue, 16 Jun 2026 07:00:00 GMT`), `<source url="https://news.unn.net">한국대학신문</source>`(깔끔한 출처), `<description>`(HTML, 제목+출처 반복).
- 키워드별로 1개 source 항목 → 5개 키워드 = 5개 구글 뉴스 RSS 호출.

### 교육부 보도자료 RSS + 전문지 피드 (설정 추가)
- 교육부(moe.go.kr) 보도자료 RSS, 한국대학신문 등 직접 피드를 NEWS_SOURCES에 추가.
- ⚠️ **실제 피드 URL 존재·동작은 구현 시 검증** — 없거나 안 되는 소스는 설정에서 제외(구글 뉴스 RSS가 커버). 구글 뉴스가 전문지를 이미 집계하므로 직접 피드는 보강 성격.

## 4. 수집 잡 — `news-collect` (insights-collect 5단계 복제)

`src/features/automations/jobs/news-collect.ts` `runNewsCollect()`:
1. NEWS_SOURCES 배열 순회 (키워드별 구글 뉴스 RSS URL + 직접 RSS URL).
2. 각 URL `fetch()` → XML → `fast-xml-parser`로 `<item>[]` 추출.
3. 순수 함수로 정규화: `mapRssItemsToNews(items, sourceMeta)` → `{ link, title, source, published_at, summary, keyword }`. pubDate(RFC2822)→ISO, description HTML 제거(요약 스니펫), `<source>`에서 언론사명.
4. `link`로 dedupe(`dedupeByLink`) → 키워드 차단어 제외(선택, blocklist) → `createAdminClient()`로 `news.upsert(rows, { onConflict: "link" })`.
5. 60일(`CLEANUP_DAYS`) 지난 행 delete.
- 소스 1개 실패해도 계속(`errors: string[]` 누적), `AutomationRunResult` 반환.
- 순수 함수(map/dedupe/cleanup/pubDate파싱)는 export → 단위 테스트.

**registry 등록**: `registry.ts`에 import 1줄 + `{ id:"news-collect", label, description, scheduleInfo, cooldownMinutes, run: runNewsCollect }` 1객체. cron route(`/api/automations/run`)·이력(`automation_runs`)·수동실행 UI 자동 적용(무변경).

## 5. 데이터 모델 (신규 마이그레이션)

```sql
-- news: 수집 뉴스
id uuid pk, link text unique,           -- dedupe 키
title text, source text,                -- 언론사명
published_at timestamptz, summary text,
keyword text,                           -- 어떤 검색 키워드로 수집됐는지
collected_at timestamptz default now()
-- index: published_at desc, keyword
```
RLS: `insight_videos_rls.sql` 복사 — SELECT `to authenticated using(true)` 전체 공개, INSERT/UPDATE/DELETE 정책 없음(service_role만 쓰기), `grant select to authenticated` + `grant all to service_role`.
(선택) `news_blocklist` — 삭제 항목 재수집 방지(insight_video_blocklist 패턴).

## 6. UI

- **사이드바**: `_data.ts` '개요' 그룹 entries에서 `schedule`(운영부 달력) 직후에 `{ kind:"item", ico, label:"운영부 뉴스", slug:"news", pattern:"list" }` 1줄.
- **페이지**: `src/app/dashboard/news/page.tsx` — RSC, `requireMenu("news")` → `listNews()` → ListPattern variant `news`.
- **feature**: `src/features/news/{schemas,queries}.ts` — `newsRowSchema` + `listNews()`(authenticated RLS, `order(published_at desc).limit(100)`, zod per-row).
- **variant**: `list-variants/news/` (View: 제목·출처·날짜·요약 + 원문 링크 버튼 / Table: 출처·제목·날짜 / filters: 키워드 칩). registry 1줄 + types union 1줄 + ListRow `news*` 필드.
- 인스펙터는 읽기 전용(발송 없음). worklog/mailbox(View-only) 템플릿 참고.

## 7. 신규 의존성

`fast-xml-parser` (RSS XML 파싱). 그 외 글로벌 `fetch`만 사용.

## 8. 재사용 vs 신규

| 영역 | 재사용 | 신규 |
|------|--------|------|
| 잡 인프라 | cron route, run-recorder(automation_runs), 수동실행 actions, getJob, AutomationJob | registry 1줄, `news-collect.ts` |
| 수집 로직 | 5단계 골격, errors[] 누적, admin upsert, cleanup, AutomationRunResult | RSS fetch+파싱, map/dedupe(link), NEWS_SOURCES, fast-xml-parser |
| DB | RLS 정책(테이블명 치환), blocklist 패턴 | `news` 테이블 마이그 |
| UI | ListPattern/registry/types/Inspector 셸, requireMenu→query→render, PageHeader | `news` variant 3파일, schemas/queries, 페이지, `_data.ts` 1줄 |
| cron | cron-job.org + CRON_SECRET | cron-job.org 잡 1개(운영설정) |

## 9. 운영 선행조건 (코드 외)

- `npm i fast-xml-parser`
- DB 마이그 적용 (`news` 테이블 + RLS)
- cron-job.org에 `POST /api/automations/run?jobId=news-collect` 잡 등록 (5~30분 주기, Authorization: Bearer CRON_SECRET)
- 최초 1회 수동 실행(자동화 UI '지금 실행' 또는 route 호출)로 동작 검증

## 10. 미해결/구현 시 확인

- 교육부·전문지 직접 RSS 피드 URL 실제 존재·동작 검증(없으면 제외). 구글 뉴스 RSS가 핵심이므로 미존재해도 기능 성립.
- 구글 뉴스 RSS의 `<link>`는 구글 리다이렉트 — 클릭 시 원문으로 이동(정상). dedupe는 이 link 기준.
- summary: 구글 뉴스 description은 제목+출처 반복이라 실 요약 빈약 → 1차는 title 위주, 필요 시 후속 보강.
- 수집 주기/키워드는 운영하며 조정(NEWS_SOURCES 설정).
