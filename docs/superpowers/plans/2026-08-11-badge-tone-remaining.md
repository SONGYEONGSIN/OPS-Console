# 규칙 밖 상태 배지 3화면 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR #953이 놓친 세 화면(경위서 편집 · 개발 테스트 · 미수채권)의 상태 배지를 공통 규칙으로 전환한다.

**Architecture:** 세 화면 모두 배지 라벨을 바로 옆에서 렌더하고 있으므로, 인라인 삼항식과 `statusTone()` 함수를 **삭제**하고 이미 있는 라벨 표현을 `statusBadgeTone(label)`에 넘긴다. 그 전에 규칙 집합에 빠진 라벨 3개(`오류`·`미수`·`수금`)를 넣는다.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind(토큰 클래스), Vitest + @testing-library/react

설계 문서: `docs/superpowers/specs/2026-08-11-badge-tone-remaining-design.md`

## Global Constraints

- 커밋 메시지는 Conventional Commits + 한국어. 접두사만 영어
- 작업 브랜치는 `feat/badge-tone-remaining` (이미 생성됨, 설계 커밋 `bd1e04b`)
- 테스트 실행은 `npx vitest run <경로>`
- **하드코딩 색상 금지** — `#xxx`, `rgb()`, `hsl()`, Tailwind arbitrary value 전부 금지
- 톤 클래스는 `BADGE_TONE` / `statusBadgeTone`에서만 나온다. 4개 값은 정확히:
  주의 `bg-vermilion-deep text-cream` / 진행 `bg-vermilion text-cream` / 완료 `bg-ink text-cream` / 대기 `bg-line-soft text-muted`
- `any`, `@ts-ignore`, `eslint-disable`, `console.log` 금지
- Surgical — 배지 색 결정 로직만 바꾼다. 라벨 문구, 배지 크기 클래스, 주변 마크업, 컬럼 구조는 그대로
- 주석은 한국어
- **색의 입력은 배지에 실제로 렌더되는 그 라벨 표현이어야 한다.** 새 라벨 계산을 만들지 마라
- **훅 정책**: `tdd-enforce` 훅이 Write/Edit에서 소스와 같은 이름의 테스트를 요구한다. 막히면 **STOP 하고 BLOCKED 보고**. Bash/Python/쉘 리다이렉션으로 우회 금지, `.claude/settings*.json`·훅 파일 수정 금지
- **범위 밖 — 건드리지 말 것**: `cohort/Table.tsx`의 `inviteBadgeClass`, `STATUS_RING`, `PRIORITY_COLOR`, `LEVEL_COLOR`, `SCHEDULE_TYPE_COLOR`, `PERMISSION_COLOR`, `DOMAIN_TONE`, `AI_TOOL_TONE`, `CATEGORY_TONE`, `LED_COLOR`, `DOT_COLOR`

---

### Task 1: 규칙에 빠진 라벨 3개 추가

이걸 먼저 하지 않으면 Task 3에서 `오류`가 회색으로 떨어져 바로 옆 `실패`(짙은 빨강)와 갈라진다 — 지금보다 나빠진다.

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/badge-tone.ts` (`ATTENTION`, `DONE_EXTRA` 각 1줄)
- Test: `src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `statusBadgeTone("오류") === BADGE_TONE.attention`, `statusBadgeTone("미수") === BADGE_TONE.attention`, `statusBadgeTone("수금") === BADGE_TONE.done`

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/badge-tone.test.ts`의 "주의" describe 블록에 있는 배열에 `"오류"`와 `"미수"`를 추가한다. 현재:

```ts
  for (const label of ["긴급", "장애", "발송 실패", "반려", "중단", "정지"]) {
```

바꾼 뒤:

```ts
  for (const label of ["긴급", "장애", "오류", "미수", "발송 실패", "반려", "중단", "정지"]) {
```

같은 파일 "완료" describe 블록의 배열에 `"수금"`을 추가한다. 현재:

```ts
  for (const label of [
    "처리완료", "완료", "종료", "작성완료", "인계완료",
    "승인완료", "발송완료", "수주",
  ]) {
```

바꾼 뒤 — 마지막에 `"수금"`을 더한다:

```ts
  for (const label of [
    "처리완료", "완료", "종료", "작성완료", "인계완료",
    "승인완료", "발송완료", "수주", "수금",
  ]) {
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: FAIL — 정확히 3건(`오류`, `미수`, `수금`)이 실패한다. 셋 다 현재 `bg-line-soft text-muted`(idle)를 돌려준다. 다른 케이스는 전부 통과해야 한다 — 추가 실패가 있으면 배열을 잘못 건드린 것이다.

- [ ] **Step 3: 규칙 집합 2줄 수정**

`badge-tone.ts`에서 두 Set에 라벨을 더한다. 정확일치(`Set.has`)라 다른 라벨에 영향이 없다.

```ts
const ATTENTION = new Set(["긴급", "장애", "반려", "중단", "정지", "오류", "미수"]);
```

```ts
const DONE_EXTRA = new Set(["수주", "수금"]);
```

규칙 순서(`if` 문 순서)는 **건드리지 마라** — 순서가 동작을 결정한다.

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: PASS (전 케이스)

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/badge-tone.ts src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts
git commit -m "feat: 배지 규칙에 오류·미수·수금 라벨 추가"
```

---

### Task 2: 경위서 편집 화면

우선순위 1 — 셋 중 유일하게 지금 손해가 나고 있다. 반려된 경위서가 목록에서는 `bg-vermilion-deep`("봐야 할 것")인데 편집 화면에서는 회색이라, 결재 반려 신호가 사라진다.

**Files:**
- Modify: `src/app/dashboard/incident-reports/[id]/_components/ReportEditorWorkspace.tsx:251-259`
- Test: `src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: `statusBadgeTone` (Task 1에서 규칙 보강됨)
- Produces: 없음

라벨은 이미 `REPORT_STATUS_LABEL[report.status]`로 렌더 중이다(`@/features/incident-reports/schemas`):
draft "작성 중" / pending_approval "승인대기" / approved "승인완료" / rejected "반려" / sent "발송완료".

- [ ] **Step 1: 실패하는 테스트 작성**

기존 `__tests__/ReportEditorWorkspace.test.tsx`의 `report` 픽스처(28-56행, `status: "draft"`)를 그대로 재사용한다. 새 `describe` 블록을 파일 끝에 덧붙인다. 기존 테스트는 한 줄도 지우거나 고치지 마라.

파일 상단 import 구역에 한 줄 추가:

```tsx
import { BADGE_TONE } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
```

파일 끝에 추가:

```tsx
describe("ReportEditorWorkspace — 상태 배지 톤", () => {
  it("반려는 주의 톤이다 — 목록과 같은 색이어야 한다", () => {
    render(<ReportEditorWorkspace report={{ ...report, status: "rejected" }} />);
    expect(screen.getByText("반려").className).toContain(BADGE_TONE.attention);
  });

  it("승인완료는 완료 톤이다", () => {
    render(<ReportEditorWorkspace report={{ ...report, status: "approved" }} />);
    expect(screen.getByText("승인완료").className).toContain(BADGE_TONE.done);
  });

  it("작성 중은 진행 톤이다", () => {
    render(<ReportEditorWorkspace report={report} />);
    expect(screen.getByText("작성 중").className).toContain(BADGE_TONE.progress);
  });
});
```

`getByText`가 복수 매치로 실패하면(같은 문구가 본문에도 있으면) `screen.getAllByText(...)`로 받아 `span` 태그인 것만 골라라 — 단언 내용(반려→attention, 승인완료→done, 작성 중→progress)은 바꾸지 마라.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run "src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx"`
Expected: FAIL — 두 케이스 모두 실패. 현재 `draft` 외 전부 `bg-line-soft text-ink-soft`(회색)라 attention·done 어느 쪽도 안 나온다. 기존 케이스는 전부 통과해야 한다.

- [ ] **Step 3: 삼항식 제거**

파일 상단에 import를 추가한다.

```ts
import { statusBadgeTone } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
```

251-259행의 `<span>`을 바꾼다. 삼항식을 지우고 이미 렌더 중인 라벨을 그대로 넘긴다. 크기 클래스(`px-2 py-0.5 text-2xs`)와 라벨 표현은 그대로 둔다.

```tsx
          <span
            className={`inline-block px-2 py-0.5 text-2xs ${statusBadgeTone(REPORT_STATUS_LABEL[report.status])}`}
          >
            {REPORT_STATUS_LABEL[report.status]}
          </span>
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run "src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx"`
Expected: PASS (신규 2건 + 기존 전부)

- [ ] **Step 5: 커밋**

```bash
git add "src/app/dashboard/incident-reports/[id]/_components/ReportEditorWorkspace.tsx" "src/app/dashboard/incident-reports/[id]/_components/__tests__/ReportEditorWorkspace.test.tsx"
git commit -m "fix: 경위서 편집 화면 배지를 목록과 같은 규칙으로"
```

---

### Task 3: 개발 테스트(dev-test)

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/dev-test/Table.tsx:29-33` (`statusTone` 함수)
- Modify: `src/app/dashboard/_components/inspector/list-variants/dev-test/View.tsx:35-40` (`StatusBadge` 안 삼항식)
- Test: `src/app/dashboard/_components/inspector/list-variants/dev-test/__tests__/Table.test.tsx`, `.../__tests__/View.test.tsx` (둘 다 기존 파일, 케이스 추가)

**Interfaces:**
- Consumes: `statusBadgeTone` (Task 1)
- Produces: 없음

두 파일 모두 같은 `STATUS_LABEL`을 갖는다: pending "대기" / running "실행 중" / done "완료" / failed "실패" / error "오류".
결과 배정: 대기 대기 / 실행 중 진행 / 완료 완료 / 실패 주의 / 오류 주의.

`실행 중`은 설계의 진행 버킷 표에 있으면서 이 화면에만 존재하는 라벨이다.

- [ ] **Step 1: 실패하는 테스트 작성**

기존 두 테스트 파일의 헬퍼를 재사용한다. `Table.test.tsx`에는 이미 `row(partial)` 헬퍼와 `entertestRuns` 픽스처 패턴이 있다(5-16행, 20-35행). 기존 케이스는 손대지 마라.

`dev-test/__tests__/Table.test.tsx` — 상단 import에 추가:

```tsx
import { BADGE_TONE } from "../../badge-tone";
```

파일 끝에 추가. `entertestRuns` 항목의 타입 단언은 기존 테스트가 쓰는 형태를 그대로 따른다:

```tsx
type Run = ListRow["entertestRuns"] extends (infer R)[] ? R : never;

function runWith(status: string): Run {
  return {
    id: "r1",
    service_id: 1,
    status,
    requested_by: "kim",
    requested_at: "2026-06-18T09:00:00Z",
    result: null,
    error_message: null,
  } as Run;
}

describe("DevTestTable — 상태 배지 톤", () => {
  it("완료는 완료 톤(검정)이다", () => {
    render(
      <DevTestTable
        rows={[row({ id: "a", entertestRuns: [runWith("done")] })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("완료").className).toContain(BADGE_TONE.done);
  });

  it("오류는 주의 톤이다 — 실패와 같은 색이어야 한다", () => {
    render(
      <DevTestTable
        rows={[row({ id: "a", entertestRuns: [runWith("error")] })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("오류").className).toContain(BADGE_TONE.attention);
  });

  it("실행 중은 진행 톤이다", () => {
    render(
      <DevTestTable
        rows={[row({ id: "a", entertestRuns: [runWith("running")] })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("실행 중").className).toContain(BADGE_TONE.progress);
  });
});
```

`dev-test/__tests__/View.test.tsx` 끝에 같은 3케이스를 `DevTestView` 기준으로 추가한다 — **두 화면이 어긋나지 않게 하는 것이 이 테스트의 목적이다.** 그 파일을 읽고 자체 픽스처·props 모양에 맞춰 호출부만 바꿔라. 단언(완료→done, 오류→attention, 실행 중→progress)은 동일하게 유지한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/dev-test/`
Expected: FAIL — 신규 6건 중 최소 완료·오류 케이스가 실패한다(현재 완료는 `bg-line-soft text-ink`, 오류는 `bg-vermilion text-paper`). 기존 케이스는 전부 통과해야 한다.

- [ ] **Step 3: `statusTone` 함수 삭제**

`dev-test/Table.tsx`에서 import를 추가한다.

```ts
import { statusBadgeTone } from "../badge-tone";
```

29-33행의 `statusTone` 함수를 **통째로 삭제**하고, 그 호출부를 `statusBadgeTone(STATUS_LABEL[status])`로 바꾼다. 값만 갈아끼우면 분기 로직이 남는다 — 함수 자체를 없애라. 호출부의 배지 크기 클래스는 그대로 둔다.

- [ ] **Step 4: `StatusBadge` 삼항식 삭제**

`dev-test/View.tsx`에서 import를 추가한다.

```ts
import { statusBadgeTone } from "../badge-tone";
```

35-40행 `StatusBadge`의 `tone` 삼항식을 지우고 한 줄로 바꾼다. `inline-flex`와 크기 클래스는 그대로 둔다.

```tsx
function StatusBadge({ status }: { status: EntertestRunStatus }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 text-2xs ${statusBadgeTone(STATUS_LABEL[status])}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/dev-test/`
Expected: PASS (신규 6건 + 기존 전부)

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/dev-test/
git commit -m "refactor: 개발 테스트 배지를 공통 규칙으로"
```

---

### Task 4: 미수채권

`receivables/Table.tsx`와 `View.tsx`에는 **짝 테스트가 없어 `tdd-enforce` 훅이 편집을 막는다.** Step 1이 그 해법이자 이 태스크의 RED 단계다. 훅을 우회하지 마라.

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/receivables/__tests__/Table.test.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/receivables/Table.tsx:67-77`
- Modify: `src/app/dashboard/_components/inspector/list-variants/receivables/View.tsx:50-62`

**Interfaces:**
- Consumes: `statusBadgeTone` (Task 1)
- Produces: 없음

라벨은 `row.status === "approved" ? "수금" : "미수"`. 컴포넌트는 `ReceivablesTable({ rows, selectedId, onSelect })`.

**작업 전에 두 파일이 이미 있는지 확인하라.** 설계 조사 시점에는 없었지만, Write 전에 반드시 존재 여부를 보고 있으면 읽어서 덧붙여라 — 기존 테스트를 덮어쓰면 안 된다.

- [ ] **Step 1: 실패하는 테스트 작성**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { BADGE_TONE } from "../../badge-tone";
import { ReceivablesTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "2026학년도 수시 원서접수",
  status: "active",
  owner: "송영신",
};

describe("ReceivablesTable — 입금여부 배지 톤", () => {
  it("미수는 주의 톤이다", () => {
    render(
      <ReceivablesTable
        rows={[{ ...baseRow, status: "active" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("미수").className).toContain(BADGE_TONE.attention);
  });

  it("수금은 완료 톤이다", () => {
    render(
      <ReceivablesTable
        rows={[{ ...baseRow, status: "approved" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("수금").className).toContain(BADGE_TONE.done);
  });
});
```

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/receivables/__tests__/Table.test.tsx`
Expected(RED): 2건 모두 실패 — 현재 미수는 `bg-vermilion/20 text-vermilion-deep`, 수금은 `bg-washi-raised text-ink`다.

렌더가 다른 필드를 요구하면 픽스처에 채워라. 단언(미수→attention, 수금→done)은 약화하지 마라.

- [ ] **Step 2: Table 삼항식 제거**

`receivables/Table.tsx`에 import를 추가한다.

```ts
import { statusBadgeTone } from "../badge-tone";
```

67-77행의 `<td>` 안을 바꾼다. 라벨 계산을 상수로 빼서 **색과 텍스트가 같은 값**을 쓰게 한다. `rows.map((row) => (` 블록 안, `<tr>` 반환 전에 상수를 두려면 화살표 함수 본문을 블록으로 바꿔야 한다 — 그게 번거로우면 아래처럼 인라인 IIFE 없이 셀 안에서 두 번 쓰지 말고, `map` 콜백을 블록 본문으로 바꾸고 상수를 선언하라.

```tsx
              <td className="whitespace-nowrap px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${statusBadgeTone(paidLabel)}`}
                >
                  {paidLabel}
                </span>
              </td>
```

여기서 `paidLabel`은 같은 `map` 콜백 안에서 이렇게 선언한다:

```tsx
            const paidLabel = row.status === "approved" ? "수금" : "미수";
```

- [ ] **Step 3: View 삼항식 제거**

`receivables/View.tsx`에 같은 import를 추가하고, 50-62행 '입금여부' 항목을 바꾼다. 컴포넌트 본문 상단에 상수를 선언한다.

```tsx
  const paidLabel = row.status === "approved" ? "수금" : "미수";
```

```tsx
            {
              term: "입금여부",
              desc: (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${statusBadgeTone(paidLabel)}`}
                >
                  {paidLabel}
                </span>
              ),
            },
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/receivables/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/receivables/
git commit -m "refactor: 미수채권 입금여부 배지를 공통 규칙으로"
```

---

### Task 5: 전체 검증

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1-4 전체
- Produces: 없음

- [ ] **Step 1: 옛 톤 문자열 잔존 확인**

Run:
```bash
grep -rn "bg-vermilion text-paper\|bg-cream text-ink-soft\|text-paper bg-vermilion\|text-ink-soft bg-cream\|bg-vermilion/20 text-vermilion-deep\|bg-washi-raised text-ink\b" src/app/dashboard/_components/inspector/list-variants/dev-test/ src/app/dashboard/_components/inspector/list-variants/receivables/ "src/app/dashboard/incident-reports/[id]/_components/ReportEditorWorkspace.tsx"
```
Expected: 히트 0

- [ ] **Step 2: 타입·린트**

Run: `npm run typecheck`
Expected: 에러 0

Run: `npm run lint`
Expected: 에러 0 (`src/app/r/checklist/[token]/_components/ReportView.tsx` 등의 `<img>` 경고 3건은 이 브랜치와 무관한 기존 것)

- [ ] **Step 3: 관련 테스트 전체**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/ "src/app/dashboard/incident-reports/[id]/_components/__tests__/"`
Expected: 전부 통과

전체 스위트(`npm test`)와 빌드는 이 PC에서 리소스 경합으로 자주 중단되므로 **CI에서 확정한다**. 로컬에서 무리하게 돌리지 마라.

- [ ] **Step 4: 커밋 (변경 없으면 생략)**

검증만 한 태스크라 보통 커밋할 것이 없다.

---

## 실화면 확인 (사람이 수행)

- [ ] 경위서 목록에서 **반려** 건을 찾아 열고, 편집 화면 우측 상단 배지가 목록과 같은 짙은 빨강인지
- [ ] 개발 테스트 목록에서 `오류`와 `실패`가 같은 색인지, `완료`가 검정인지
- [ ] **미수채권 목록에서 미수 열이 통째로 빨개지지 않는지** — 다 빨가면 신호가 묻힌다. 그렇다면 경과일수(독려 기준 10일) 기반으로 바꾸는 것을 재검토
- [ ] 긴급/장애와 진행중이 한 화면에 있을 때 구분되는지 (대비비 1.46:1로 계산됨 — 안 갈리면 진행을 `bg-vermilion/15 text-vermilion`으로 톤다운)

## 완료 기준

- [ ] Task 1-5 완료, 각 커밋 존재
- [ ] `npm run typecheck` / `npm run lint` 통과 (실행 결과로 확인)
- [ ] CI(리눅스) `lint + typecheck + test + build` 통과
- [ ] `git diff main --stat`으로 범위 밖 파일이 변경되지 않았음을 확인
