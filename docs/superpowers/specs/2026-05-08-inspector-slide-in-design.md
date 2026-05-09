# Design — Inspector Slide-in (Epic 3)

- **Date**: 2026-05-08
- **Owner**: 송영석
- **Topic**: 콘텐츠 패턴(List/Dash/Project)에서 항목 클릭 시 우측 인스펙터 슬라이드인 + 인플레이스 편집
- **Source**: 사용자 직접 피드백 (이미지 8번 참조)
- **Status**: Awaiting user review
- **Predecessors**: PIVOT chrome / OPS Console rebrand / Page Header Pattern (Epic 1·2 완료)

## 1. Goal

콘텐츠 페이지에서 List 행 / Dash 위젯 / Project 카드를 클릭하면 우측에서 슬라이드인하는 Inspector로 상세 정보 노출 + 인플레이스 편집(읽기 ↔ 편집 토글) → 저장 시 페이지 local state 갱신. 페이지 이동 없이 상세 확인/수정 완결. 기존 ListPattern의 영구 aside 패널 → 슬라이드인 패턴으로 통일.

## 2. Out of Scope

- LogPattern, SettingsPattern — 인스펙터 부적합 (Log 스트림은 인스펙터 컨텍스트 X, Settings는 자체 폼이 본체)
- Server Action 실 저장 — 클라이언트 측 mock 갱신만. Supabase 데이터 boundary는 별도 epic
- `dashboard/page.tsx` 1면 신문 — 별도 Inspector 없음 (영향 X)
- Deep link (`?inspect=svc-1`) — 페이지 local state로 시작, 추후 URL params 마이그레이션
- 모바일 풀스크린 인스펙터 디테일 — 데스크탑(≥md) 380px 슬라이드인 우선, 모바일은 풀스크린 슬라이드 minimal

## 3. Architecture

### 3.1 컴포넌트 트리

```
ListPattern / DashPattern / ProjectPattern  (페이지)
  ├── 본체 (행/위젯/카드 list)
  └── <InspectorPanel open onClose>
        ├── <InspectorHeader title kicker editing onToggleEdit onClose />
        └── <Inspector{List|Dash|Project}Body data editing onSave onCancel />
```

InspectorPanel = 공통 슬라이드인 셸 (shell). 패턴별 Body 컴포넌트가 콘텐츠/폼 담당.

### 3.2 InspectorPanel (공통 셸)

```tsx
type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

// fixed right-0 top-0 bottom-0 with translate transitions
// open=true: translate-x-0
// open=false: translate-x-full
// 380px width @ md+, full screen @ <md
// ESC + outside click → onClose
```

### 3.3 useInspectorState hook

```typescript
type InspectorState<T> = {
  selected: T | null;
  editing: boolean;
  open: (item: T) => void;
  close: () => void;
  toggleEdit: () => void;
};

export function useInspectorState<T>(): InspectorState<T> {
  // selected + editing 묶음 상태
  // open(item) → selected=item, editing=false
  // close() → selected=null, editing=false
  // toggleEdit() → editing 반전
}
```

페이지 컴포넌트가 사용. 패턴별 generic T로 타입 안전.

### 3.4 패턴별 Body

#### InspectorListBody
- props: `{ row: ListRow, editing: boolean, onSave: (next: ListRow) => void, onCancel: () => void }`
- read 모드: ID/이름/상태/담당 read-only 표시
- edit 모드: 같은 필드를 input/select로 — 저장/취소 버튼

#### InspectorDashBody
- props: `{ widget: DashWidget, editing, onSave, onCancel }`
- DashWidget 필드 (label, value, time, tone) 편집

#### InspectorProjectBody
- props: `{ project: ProjectCard, editing, onSave, onCancel }`
- 프로젝트 이름/상태/담당 편집

### 3.5 클릭 핸들러 통합

각 Pattern 컴포넌트:

```tsx
const inspector = useInspectorState<ListRow>();

return (
  <>
    <table>
      {rows.map(row => (
        <tr onClick={() => inspector.open(row)} ...>...</tr>
      ))}
    </table>
    <InspectorPanel open={!!inspector.selected} onClose={inspector.close}>
      {inspector.selected && (
        <InspectorListBody
          row={inspector.selected}
          editing={inspector.editing}
          onSave={(next) => {
            // mock data 갱신 (페이지 local state)
            setRows(prev => prev.map(r => r.id === next.id ? next : r));
            inspector.close();
          }}
          onCancel={() => inspector.toggleEdit()}
        />
      )}
    </InspectorPanel>
  </>
);
```

### 3.6 시각 (mockup 7번 우측 패널 정신 계승)

- 너비: 380px (lg+) / 100vw (md-)
- 배경: `bg-washi-raised` (mockup .inspector 색상 유지)
- 보더: 좌측 `border-l border-line`
- shadow: `[box-shadow:var(--shadow-drawer-right)]` (기존 토큰)
- 트랜지션: `transition-transform duration-[var(--drawer-ms)] ease-[var(--drawer-ease)]`
- z-index: 40 (sidebar drawer와 동일)
- Scrim 없음 (인스펙터는 작아서 본문 일부 가림 OK, 외부 클릭으로 닫힘)

### 3.7 Header

```
인스펙터 · 서비스 상세           [편집] [×]
─────────────────────────────────
SVC-PAY-001
결제 게이트웨이                    [장애]
v2.14.3 · PROD
```

- kicker: `인스펙터 · ${type}` (uppercase tracked)
- 닫기 X 버튼 (우상)
- 편집 토글 (상단 또는 footer)

## 4. 데이터 흐름

```
Page Pattern Component (LocalState rows + selected/editing via useInspectorState)
        │
        │ onClick(row) → inspector.open(row)
        ▼
   InspectorPanel slide-in
        │
        │ 편집 토글 → InspectorListBody form mode
        │ 저장 → onSave(next)
        ▼
   페이지 LocalState rows 갱신 (mock 즉시 반영)
        + inspector.close()
```

새로고침 시 mock data 원본으로 reset (예상 동작).

## 5. 에러 처리

- 패널 열림 상태에서 page navigation → 패널 자동 unmount (next/navigation)
- 저장 시 클라이언트 검증 (zod) — 필드 누락/형식 오류 시 인라인 에러 표시
- 외부 클릭 감지 — 패널 자체 영역 + 트리거 요소(클릭한 원본 행)는 외부 클릭 대상 X

## 6. 테스트 전략 (TDD)

### 단위 (vitest)

- `useInspectorState.test.ts` — open/close/toggleEdit/selected 정확
- `InspectorPanel.test.tsx`:
  - open=true → translate-x-0 (visible)
  - open=false → translate-x-full (hidden)
  - ESC → onClose 호출
  - 외부 클릭 → onClose
  - 닫기 버튼 → onClose
- `InspectorListBody.test.tsx`:
  - read 모드: 데이터 read-only 표시
  - edit 모드: input 노출
  - 저장 → onSave(next) 호출, next 객체에 변경 반영
  - 취소 → onCancel 호출, onSave 호출 X
- `InspectorDashBody.test.tsx`, `InspectorProjectBody.test.tsx` — 동일 패턴

### e2e (playwright)

- `/dashboard/alerts` (Dash 패턴) — 첫 알림 위젯 클릭 → 패널 열림 → 편집 → 저장 → 패널 닫힘
- `/dashboard/services` (List 패턴) — 첫 행 클릭 → 패널 열림 → ESC로 닫힘 → 외부 클릭으로 닫힘 검증

## 7. 영향 파일 (예상 12-15개)

### 신규
- `src/app/dashboard/_components/inspector/InspectorPanel.tsx`
- `src/app/dashboard/_components/inspector/InspectorHeader.tsx`
- `src/app/dashboard/_components/inspector/InspectorListBody.tsx`
- `src/app/dashboard/_components/inspector/InspectorDashBody.tsx`
- `src/app/dashboard/_components/inspector/InspectorProjectBody.tsx`
- `src/app/dashboard/_components/inspector/useInspectorState.ts`
- 각 단위 테스트 5개

### 변경
- `src/app/dashboard/_components/patterns/ListPattern.tsx` — 영구 aside 제거, InspectorPanel + Body 통합, mock data state 추가
- `src/app/dashboard/_components/patterns/DashPattern.tsx` — 위젯 onClick + InspectorPanel
- `src/app/dashboard/_components/patterns/ProjectPattern.tsx` — 카드 onClick + InspectorPanel
- `e2e/dashboard.spec.ts` — Inspector e2e 추가

### 영향 없음
- `Inspector.tsx` (기존) — `/dashboard` 1면 신문용. 본 epic 미적용. 추후 정리 또는 그대로.

**HARD-GATE 등급**: 간략 설계 (12-15 파일).

## 8. 리스크

- **기존 ListPattern aside 제거 → 회귀**: 기존 ListPattern.test.tsx의 selected row 어설션 영향 가능. test 갱신 필수.
- **mockup `.inspector` 색상 + 슬라이드인 의도 충돌**: mockup은 영구 패널이라 본문과 borderless 융합. 슬라이드인은 그림자 + border가 명확히 분리. 시각 검증 필요.
- **모바일 풀스크린 슬라이드인 UX**: <md에서 패널이 100vw → 본문 완전 가림. 모바일 사용자가 닫는 방법 명확해야 (큰 닫기 버튼 + 스와이프 닫기는 out of scope).
- **mock data 영속성 부재**: 새로고침 시 reset이 의도된 동작이지만 사용자가 헷갈릴 수 있음 — 첫 사용 시 toast 또는 안내 (out of scope, 후속).
- **다중 클릭 빠른 전환**: 한 행 클릭 → 다른 행 클릭 → 트랜지션 중첩. selected만 교체 + 트랜지션 매끄러운지 검증.

## 9. 검증 (DoD)

1. `npm run lint` 0 errors
2. `npx tsc --noEmit` 0 errors
3. `npm test` — 263 + 신규 (≈ 280+) 모두 통과
4. `npm run e2e` — Inspector e2e 통과
5. dev 서버:
   - `/dashboard/services` 행 클릭 → 패널 열림 → ESC 닫힘 / 외부 클릭 닫힘 / 닫기 버튼 닫힘
   - 편집 모드 토글 → 폼 노출 → 필드 변경 → 저장 → 행 데이터 갱신 + 패널 닫힘
   - `/dashboard/alerts` 위젯 클릭 → DashBody 노출 → 동일 흐름
   - `/dashboard/projects` (project 패턴) 카드 클릭 → ProjectBody 노출
6. design-audit hook 0 위반
