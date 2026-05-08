# Design — ListPattern 부수 UI 복원 (Epic 4)

- **Date**: 2026-05-09
- **Owner**: 송영석
- **Topic**: Epic 3 T6에서 부작용으로 제거된 ListPattern의 필터·카운트·안내문 복원
- **Source**: 사용자 직접 피드백 (Epic 3 T6 implementer concerns)
- **Status**: Awaiting user review
- **Predecessor**: Epic 3 (Inspector 슬라이드인) 완료, T6 ListPattern 통합

## 1. Goal

Epic 3 T6에서 spec 코드를 그대로 옮겨 적용하면서 누락된 ListPattern 부수 UI 3가지(상태 필터 버튼, 동적 카운트, "Demo 미연결" 안내문)를 복원. Inspector 슬라이드인 통합은 그대로 유지.

## 2. Out of Scope

- breadcrumb 복원 — PageHeader가 담당, 중복 회피
- meta 필드 (`ListRow.meta`) 표시 — 별도 의사결정 (이번 epic은 필터/카운트/안내문만)
- 다른 패턴 (Dash/Project) 부수 UI — 영향 없음 (Epic 3 T7/T8 정상 보존)
- 필터 상태 영속화 (URL params 등) — 클라 local state로만

## 3. Architecture

### 3.1 ListPattern 구조 (변경 후)

```
<section>
  <header>
    <h2>{title} · {filteredRows.length}건</h2>
    <FilterBar value={filter} onChange={setFilter} />
  </header>
  <table>
    {filteredRows.map(row => <tr onClick={inspector.open(row)}>...)}
  </table>
  <p className="mt-3 text-xs text-muted">Demo · 실제 데이터 미연결</p>
</section>
<InspectorPanel> ... (기존 그대로) ...
```

### 3.2 FilterBar (인라인 — 별도 컴포넌트 추출 안 함)

ListPattern 안에서 inline `<div role="tablist">`. 5개 버튼:
- `전체` (filter === "all")
- `긴급` (status === "urgent")
- `활성` (status === "active")
- `점검중` (status === "review")
- `정상` (status === "approved")

활성 버튼: vermilion underline + bold (PageTabs와 동일 톤)
비활성: muted

### 3.3 State

```typescript
const [filter, setFilter] = useState<ListRow["status"] | "all">("all");

const filteredRows = filter === "all"
  ? rows
  : rows.filter((r) => r.status === filter);
```

`rows`는 기존 useState (Inspector onSave에서 갱신). filteredRows는 derived value.

### 3.4 카운트

`{title} · {filteredRows.length}건` — 필터링 결과 기준. 필터 변경 시 자동 갱신.

### 3.5 안내문

`section` 내부 footer 위치: `<p className="mt-3 px-3 text-xs text-muted">Demo · 실제 데이터 미연결</p>`

## 4. 영향 파일 (1)

### Modify
- `src/app/dashboard/_components/patterns/ListPattern.tsx` — 필터 state + filteredRows derived + heading count + 안내문

### Test
- `src/app/dashboard/_components/patterns/__tests__/ListPattern.test.tsx` — 필터/카운트/안내문 어설션 추가 (기존 8 tests에 4-5 더)

**HARD-GATE 등급**: 인라인 설계 (1 파일).

## 5. 데이터 흐름

```
data.rows (props)
   │
   ▼
rows (useState) ── Inspector onSave 시 .map 갱신
   │
   ▼
filteredRows (derived: filter === "all" ? rows : rows.filter(...))
   │
   ▼
heading count + table 렌더
```

## 6. 에러 처리

- 빈 rows → "데이터 없음" (기존 분기 유지)
- 필터로 결과 0 → 동일 "데이터 없음" 메시지
- filter 잘못된 값 → TS 컴파일 차단 (union 타입)

## 7. 테스트 전략 (TDD)

### 단위 (vitest)

기존 ListPattern.test.tsx에 추가:

1. `초기 카운트 — 전체 rows 표시 (title · {N}건)`
2. `필터 버튼 클릭 — 해당 status만 표시`
3. `필터 활성 시 카운트 갱신`
4. `안내문 "Demo · 실제 데이터 미연결" 노출`
5. `Inspector 저장 후 status 변경 → 필터 결과 자동 갱신` (회귀 가드)

### e2e
e2e 변경 없음 (기존 services 행 클릭/ESC 닫힘 테스트 유지).

## 8. 영향 없음
- Epic 3 InspectorListBody / InspectorPanel / useInspectorState — 변경 없음
- DashPattern / ProjectPattern — 영향 없음
- PageHeader — 영향 없음

## 9. 검증 (DoD)

1. `npm run lint` 0 errors
2. `npx tsc --noEmit` 0 errors
3. `npm test` 298 + 신규 (≈ 303+) 통과
4. dev 서버 `/dashboard/services`:
   - 헤딩 옆 카운트 (`전체 서비스 · 12건`)
   - 필터 버튼 5개 노출, 활성 버튼 vermilion underline
   - 필터 클릭 시 rows 동적 변경 + 카운트 갱신
   - footer "Demo · 실제 데이터 미연결" 노출
   - 행 클릭 → Inspector 슬라이드인 (회귀 X)
   - 편집 → 저장 시 rows 갱신 + 패널 닫힘 (회귀 X)
