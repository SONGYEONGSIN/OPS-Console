# 실시간 현황 재구성 — KPI 타일 + 우선순위 통합 피드

**Date:** 2026-05-23
**Status:** Approved (pending user review of this spec)
**Scope:** `/dashboard` 루트 (실시간 현황) UI 재구성

## 1. Goal

대시보드 루트의 "실시간 현황"을 9개 미니테이블(3그룹 × 3카드)에서 **KPI 타일(9) + 우선순위 통합 피드** 하이브리드로 재구성한다. 한눈에 카운트 파악 + 시간 기반 항목 단일 피드.

## 2. Motivation

현재 `/dashboard/page.tsx`는 9개 미니테이블을 한 화면에 쌓아서 보여줘 "한눈에 안 들어온다." 카드별 테이블이 너무 많아 시선 이동 비용 큼.

해결 방향:
- **카운트 한눈에** — 9개 도메인 KPI를 작은 타일 한 줄(반응형)로
- **단일 포커스 리스트** — 도메인 무관 우선순위·시간순 단일 피드(테이블 1개)
- **에디토리얼 톤** — 표준 디자인 토큰, emoji 없음

## 3. Layout

```
실시간 현황                                       [내 담당 ▾]
┌ KPI 타일 (반응형 grid, 9 도메인) ─────────────────────────────┐
│ [서비스 5][계약 12][미수채권 3][사고 0][백업 2]               │
│ [연락처 48][내 할일 7][일정 4][활동로그 12]                   │
└────────────────────────────────────────────────────────────────┘
[전체 18][서비스 5][사고 0][내 할일 7][일정 4][백업 2]   ← 피드 칩(건수)
┌ 우선순위 통합 피드 (단일 리스트) ──────────────────────────────┐
│ [사고]   미해결  결제 오류                  ← 긴급 티어(최상단) │
│ [할일]   지남    인수인계 PDF 검토 (overdue)                   │
│ [서비스] 5.14    A대학교 · 원서접수 오픈    ← 예정(시간순)     │
│ [일정]   5.15    운영2팀 정기회의                              │
│ [백업]   5.16    김지나 휴가 백업                              │
└────────────────────────────────────────────────────────────────┘
```

- container `max-w-[1400px] mx-auto px-6`
- 상단 `LivePageHeader` 유지 (`mine` 토글 포함, 라벨만 "실시간 현황")
- 인스펙터 슬라이드 패널 유지

## 4. KPI 타일 (9개)

### 4.1 도메인 매핑
| 라벨 | variant | href | count source |
|---|---|---|---|
| 서비스 | services | /dashboard/services | 오픈 예정(작성시작 ≥ today) |
| 계약 | contracts | /dashboard/contracts | listContracts 본인 필터 |
| 미수채권 | receivables | /dashboard/receivables | pending 우선, 시트 fetch |
| 사고 | incidents | /dashboard/incidents | listIncidents total |
| 백업 | backup | /dashboard/backup | listBackupRequests 본인 필터 |
| 대학연락처 | contacts | /dashboard/contacts | listContacts total |
| 내 할 일 | weekly-todo | /dashboard/my-todo | undone todos count |
| 운영부 일정 | schedule | /dashboard/schedule | 예정(start ≥ today) |
| 업무 활동 로그 | worklog | /dashboard/worklog | 최근 5건 length (지표성) |

카운트 산출은 **기존 `page.tsx` 로직을 그대로 재사용**(데이터 fetch·필터 변경 없음). 산출 결과만 새 출력 형태로 변환.

### 4.2 타이포 (요청 사항)
- **라벨**: 작은 톤 (작은 mono/uppercase 또는 디자인 토큰 small label). 기존 그룹 헤더 스타일과 일관.
- **숫자**: **라벨 폰트 사이즈에 비례한 큰 사이즈** (예: `~4em` em-기반). fixed `text-4xl` 사용 금지 — 라벨 크기가 변하면 숫자도 같이 변하도록 묶어야 함.
- **countSub**: 라벨과 동일 톤(보조).

### 4.3 카운트업 인터랙션
- 마운트 시 `0 → 실제값` 카운트업, ease-out, ~700ms (`requestAnimationFrame`)
- **접근성 가드**: `prefers-reduced-motion: reduce` 시 즉시 실제값
- **SSR-safe**: 서버 렌더는 실제 숫자(no-JS·접근성 보장). 클라이언트 마운트 후 effect로 0부터 카운트업
- 적용 범위: **KPI 타일 큰 숫자만**. 피드 칩 건수는 정적

### 4.4 클릭 동작
- 타일 클릭 → `router.push(href)` (해당 메뉴 풀페이지)
- 카운트 `null`(데이터 fetch 실패 등) → `—` 표시, 클릭은 활성

### 4.5 반응형 grid
- 모바일 `grid-cols-2`, 태블릿 `sm:grid-cols-3`, 데스크탑 `lg:grid-cols-5`, 와이드 `xl:grid-cols-9` (또는 `auto-fit minmax(~110px,1fr)`)

## 5. 우선순위 통합 피드 (시간기반 5도메인)

### 5.1 포함 도메인 & 매핑
| 도메인 | 라벨 칩 | 일자 소스 | 인스펙터 variant |
|---|---|---|---|
| incidents | 사고 | occurred_date or created_at | incidents |
| todos (undone) | 내 할일 | due_at | weekly-todo |
| services (upcoming) | 서비스 | write_start_at | services |
| schedule (upcoming) | 일정 | start_at | schedule |
| backup (recent) | 백업 | leave_start_date or created_at | backup |

비포함: 계약·미수채권·대학연락처·활동로그 (KPI 타일로만 노출)

### 5.2 FeedItem 형태
```ts
type FeedDomain = "incidents" | "todos" | "services" | "schedule" | "backup";
type FeedTier = "urgent" | "scheduled" | "undated";

type FeedItem = {
  id: string;                  // 원본 row id
  domain: FeedDomain;
  domainLabel: string;         // "사고" | "내 할일" | "서비스" | "일정" | "백업"
  variant: Variant;            // 인스펙터 dispatch용
  date: string | null;         // ISO or YYYY-MM-DD
  dateDisplay: string;         // "미해결" | "지남" | "오늘" | "5.14" | "—"
  title: string;
  tier: FeedTier;
  listRow: ListRow;            // 인스펙터용 풀 row
};
```

### 5.3 긴급도 티어 판정
- **urgent**:
  - 사고: `status !== 'resolved'` (해결되지 않은 건). 실제 상태 enum은 incidents 스키마 확인 후 plan에서 확정.
  - 할일: `due_at && due_at < todayKST` (overdue)
- **scheduled**: 일자 존재 + 미래 또는 오늘
- **undated**: 일자 없음 (예: due 없는 할일)

### 5.4 정렬 (sortFeedItems)
1. tier `urgent` 그룹 (일자 asc)
2. tier `scheduled` 그룹 (일자 asc)
3. tier `undated` 그룹 (원본 순)

상한: 피드 표시 ~20건 (전체). 필터 적용 시 해당 도메인만.

### 5.5 일자 라벨 (formatFeedDate)
- urgent + incidents → `"미해결"`
- urgent + todos → `"지남"`
- scheduled + 오늘 → `"오늘"`
- scheduled + 그 외 → `"M.D"` (KST, 연도 생략)
- undated → `"—"`

### 5.6 행 클릭
- 인스펙터 패널 슬라이드 — `LiveDashboard`의 기존 동작과 동일 (variant + listRow 전달)

### 5.7 피드 칩 필터
- 칩: `전체(N) / 사고(N) / 내 할일(N) / 서비스(N) / 일정(N) / 백업(N)`
- 활성 칩 vermilion 강조 (기존 ScopeChips 토큰과 일관)
- 칩 자체 카운트업 없음

### 5.8 빈 상태
- 피드 0건: `"예정된 항목이 없습니다"` empty 메시지 (디자인 톤 일관)

## 6. 아키텍처

### 6.1 새 파일
- `_components/live/feed.ts` — 순수 모듈
  - `buildFeedItems(sources): FeedItem[]`
  - `sortFeedItems(items, now): FeedItem[]`
  - `formatFeedDate(item, now): string`
- `_components/live/LiveOverview.tsx` (client) — 상단 타일 + 칩 + 피드 + 인스펙터 슬라이드
- `_components/live/KpiTile.tsx` (client)
- `_components/live/CountUp.tsx` (client)
- `_components/live/FeedRow.tsx` (client)
- `_components/live/FeedChips.tsx` (client)

### 6.2 변경
- `/dashboard/page.tsx` — 기존 fetch 유지, 출력만 `tiles: KpiTile[]` + `feedSources: ...` 로 재구성. `<LiveOverview tiles feedSources mine />` 렌더.

### 6.3 제거 (surgical)
교체 후 `LiveDashboard` 사용처가 page.tsx 외에 없음을 typecheck로 확인 → 제거:
- `_components/live/LiveDashboard.tsx`
- `_components/live/LiveCard.tsx`
- `_components/live/SimpleTable.tsx`
- (LivePageHeader는 LiveOverview에서 재사용)

## 7. 테스트 전략

### 순수 모듈 (TDD RED→GREEN)
- `feed.test.ts`:
  - buildFeedItems: 도메인별 입력 → FeedItem[] 매핑
  - sortFeedItems: urgent → scheduled → undated, 각 그룹 내 일자 asc
  - formatFeedDate: 4 케이스 (미해결/지남/오늘/M.D/—)

### 컴포넌트 (RTL)
- `CountUp.test.tsx`: value 렌더, reduced-motion 즉시 표시
- `KpiTile.test.tsx`: 라벨/숫자/countSub, 클릭 href
- `FeedRow.test.tsx`: 칩/일자/내용 렌더, 클릭 콜백
- `LiveOverview.test.tsx`: 칩 필터 변경 시 피드 표시 변화

### 회귀
- 기존 `LiveDashboard`/`LiveCard`/`SimpleTable` 테스트는 컴포넌트 제거와 함께 삭제(orphan)
- e2e 별도 추가 없음

## 8. 에러/빈 상태

- KPI 타일 카운트 fetch 실패 → `count: null` → `—` 표시, 카운트업 없음
- 피드 빈 → empty 메시지
- 인스펙터 View 없는 variant는 피드에 미포함 → 클릭 무시 경로 없음

## 9. 리스크 / 메모

- **CountUp 하이드레이션**: SSR=실제값, 클라이언트 마운트 후 0부터 재시작. 초기 state=value로 mismatch 회피. (`[[hydration-mismatch-lint-block]]` 참고 — react-compiler 위반 시 useSyncExternalStore 대안 검토)
- **사고 "미해결" 상태**: `incidents` 스키마의 status 컬럼 enum 확인 필요 — plan 단계에서 grep 검증 후 결정. resolved 외 모두 urgent.
- **반응형**: 9 타일이 모바일에서 grid-cols-2까지 축소되면 세로가 길어짐 — 허용

## 10. 비범위

- 사이드바·메뉴 변경 없음
- 도메인 페이지 자체 변경 없음
- 데이터 모델·마이그레이션 없음 (기존 컬럼만 사용)
- 다크모드·다국어 별도 작업 아님

## 11. Self-Review

- [x] 9 도메인 모두 화면에 반영 (KPI 9 + 피드 5는 그 중 시간기반 부분집합)
- [x] 카운트업 SSR-safe + reduced-motion 가드
- [x] emoji 없음 / 디자인 토큰 사용 / 표준 max-w
- [x] 인스펙터·mine 토글 유지 (회귀 위험 최소)
- [x] 사용자 명시 요구 반영: 큰 숫자 라벨 비례, 카운트업, KPI+피드 결합
