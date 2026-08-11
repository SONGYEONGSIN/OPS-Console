# 상태 배지 색 공통 규칙 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 전 메뉴의 상태 배지 색을 라벨 의미 기준 4버킷(주의/진행/완료/대기)으로 통일한다.

**Architecture:** 클래스 문자열의 출처를 `badge-tone.ts` 한 파일로 모은다. 라벨이 런타임에 정해지는 곳은 `statusBadgeTone(label)`을 부르고, enum 키 색맵은 값만 `BADGE_TONE.*`로 갈아끼운다. 색을 조정할 일이 생기면 이 파일 한 곳만 고친다.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind(토큰 클래스), Vitest

설계 문서: `docs/superpowers/specs/2026-08-11-status-badge-tone-design.md`

## Global Constraints

- 커밋 메시지는 Conventional Commits + 한국어 (`feat:`, `refactor:`, `test:`). 접두사만 영어
- 작업 브랜치는 `feat/status-badge-tone` (이미 생성됨, 설계 커밋 `24dd9ce`)
- 테스트 실행은 `npx vitest run <경로>` (전체는 `npm test`)
- **하드코딩 색상 금지** — `#xxx`, `rgb()`, `hsl()`, Tailwind arbitrary value(`bg-[#...]`) 전부 금지. 아래 4개 토큰 클래스 문자열만 쓴다
- 4개 톤 클래스는 **정확히** 이 문자열이다. 오타 하나가 조용히 색을 죽인다:
  - 주의 `bg-vermilion-deep text-cream`
  - 진행 `bg-vermilion text-cream`
  - 완료 `bg-ink text-cream`
  - 대기 `bg-line-soft text-muted`
- `any`, `@ts-ignore`, `eslint-disable`, `console.log` 금지
- Surgical — 색맵의 **값만** 바꾼다. 키 순서·라벨·컴포넌트 구조·배지 크기 클래스(`px-2 py-0.5 text-xs`)는 건드리지 않는다
- 주석은 한국어 (레포 관례)
- **범위 밖 — 절대 건드리지 말 것**: `STATUS_RING`(도트 색), `PRIORITY_COLOR`, `LEVEL_COLOR`, `SCHEDULE_TYPE_COLOR`, `PERMISSION_COLOR`, `DOMAIN_TONE`, `AI_TOOL_TONE`, `CATEGORY_TONE`, `LED_COLOR`, `DOT_COLOR`

---

### Task 1: badge-tone 모듈

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/badge-tone.ts`
- Test: `src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `BADGE_TONE: { attention: string; progress: string; done: string; idle: string }`
  - `statusBadgeTone(label: string): string`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from "vitest";
import { BADGE_TONE, statusBadgeTone } from "../badge-tone";

describe("BADGE_TONE", () => {
  it("4개 톤이 지정된 토큰 클래스다", () => {
    expect(BADGE_TONE).toEqual({
      attention: "bg-vermilion-deep text-cream",
      progress: "bg-vermilion text-cream",
      done: "bg-ink text-cream",
      idle: "bg-line-soft text-muted",
    });
  });
});

describe("statusBadgeTone — 주의", () => {
  for (const label of ["긴급", "발송 실패", "반려", "중단", "정지"]) {
    it(`${label} → attention`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.attention);
    });
  }
});

describe("statusBadgeTone — 진행", () => {
  for (const label of [
    "진행중", "진행 중", "진행", "처리중", "점검중", "작성중",
    "작성 중", "실행 중", "발송 중", "분석 중", "확인",
  ]) {
    it(`${label} → progress`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.progress);
    });
  }
});

describe("statusBadgeTone — 완료", () => {
  for (const label of [
    "처리완료", "완료", "종료", "작성완료", "인계완료",
    "승인완료", "발송완료", "수주",
  ]) {
    it(`${label} → done`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.done);
    });
  }
});

describe("statusBadgeTone — 대기", () => {
  for (const label of [
    "요청", "활성", "정상", "보류", "예약", "삭제", "미작성", "미처리",
    "취소", "계획", "대기", "검토", "승인대기", "발송", "실주", "테스트",
  ]) {
    it(`${label} → idle`, () => {
      expect(statusBadgeTone(label)).toBe(BADGE_TONE.idle);
    });
  }
});

describe("statusBadgeTone — 규칙의 함정", () => {
  it("예약완료는 완료가 아니라 대기다 (아직 발송 전)", () => {
    expect(statusBadgeTone("예약완료")).toBe(BADGE_TONE.idle);
  });

  it("중단은 '중'으로 끝나지 않으므로 진행으로 새지 않는다", () => {
    expect(statusBadgeTone("중단")).toBe(BADGE_TONE.attention);
  });

  it("발송 실패가 진행·완료보다 먼저 잡힌다", () => {
    expect(statusBadgeTone("발송 실패")).toBe(BADGE_TONE.attention);
  });

  it("앞뒤 공백을 무시한다", () => {
    expect(statusBadgeTone("  처리중  ")).toBe(BADGE_TONE.progress);
  });

  it("모르는 라벨은 대기로 떨어진다", () => {
    expect(statusBadgeTone("듣도보도못한상태")).toBe(BADGE_TONE.idle);
  });

  it("빈 문자열도 대기다", () => {
    expect(statusBadgeTone("")).toBe(BADGE_TONE.idle);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: FAIL — `Failed to resolve import "../badge-tone"`

- [ ] **Step 3: 구현**

```ts
/**
 * 상태 배지 색 공통 규칙 — 색을 상태 enum이 아니라 **라벨의 의미**에 묶는다.
 *
 * 같은 enum이 화면마다 다른 뜻이라(피드백의 approved="처리완료" vs 서비스의 approved="정상")
 * enum 기준으로는 공통 규칙을 만들 수 없다. 설계: docs/superpowers/specs/2026-08-11-status-badge-tone-design.md
 */
export const BADGE_TONE = {
  /** 봐야 할 것 — 긴급 + 이상 종료(실패·반려·중단·정지) */
  attention: "bg-vermilion-deep text-cream",
  /** 진행 중인 작업 */
  progress: "bg-vermilion text-cream",
  /** 정상 종료 */
  done: "bg-ink text-cream",
  /** 대기·구분 — 그 외 전부 */
  idle: "bg-line-soft text-muted",
} as const;

/** '중'으로 끝나지 않지만 진행 단계인 라벨. */
const PROGRESS_EXTRA = new Set(["확인", "진행"]);

/** '완료'가 들어가지만 종료가 아닌 라벨 — 예약완료는 아직 발송 전이다. */
const DONE_EXCLUDED = new Set(["예약완료"]);

/** '완료/종료' 문구가 없지만 정상 종료인 라벨. */
const DONE_EXTRA = new Set(["수주"]);

const ATTENTION = new Set(["긴급", "반려", "중단", "정지"]);

/**
 * 상태 라벨 → 배지 톤 클래스. 위에서부터 먼저 맞는 규칙을 적용한다.
 * 모르는 라벨은 대기(그레이)로 떨어진다 — 새 상태가 생겨도 화면이 깨지지 않는다.
 */
export function statusBadgeTone(label: string): string {
  const s = label.trim();

  if (ATTENTION.has(s) || s.includes("실패")) return BADGE_TONE.attention;
  if (s.endsWith("중") || PROGRESS_EXTRA.has(s)) return BADGE_TONE.progress;
  if (DONE_EXCLUDED.has(s)) return BADGE_TONE.idle;
  if (s.includes("완료") || s.includes("종료") || DONE_EXTRA.has(s))
    return BADGE_TONE.done;
  return BADGE_TONE.idle;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: PASS (전 케이스)

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/badge-tone.ts src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts
git commit -m "feat: 상태 배지 톤 공통 규칙 추가"
```

---

### Task 2: 공용 status.ts + 게시글 목록

이 태스크가 설계의 핵심이다. 공용 맵은 enum 기준으로 두되, **같은 enum을 다른 라벨로 갈아끼우는 게시글 목록만** 라벨 기준 경로로 옮긴다.

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/status.ts:18-26` (`STATUS_COLOR` 값)
- Modify: `src/app/dashboard/_components/inspector/list-variants/post/Table.tsx:4,17,110`
- Test: `src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: `BADGE_TONE`, `statusBadgeTone` (Task 1)
- Produces: 없음

기본 라벨은 `STATUS_LABEL`(같은 파일 8-16행)에 있다 — urgent 긴급 / approved 정상 / review 점검중 / active 활성 / inactive 점검중 / suspended 정지 / deleted 삭제.

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/badge-tone.test.ts` 끝에 추가한다.

```ts
import { STATUS_COLOR, STATUS_LABEL } from "../status";

describe("공용 STATUS_COLOR", () => {
  it("모든 값이 BADGE_TONE 중 하나다", () => {
    const tones: string[] = Object.values(BADGE_TONE);
    for (const [key, cls] of Object.entries(STATUS_COLOR)) {
      expect(tones, `${key}가 규칙 밖 색을 쓴다`).toContain(cls);
    }
  });

  it("기본 라벨의 의미와 색이 일치한다", () => {
    for (const key of Object.keys(STATUS_COLOR) as (keyof typeof STATUS_COLOR)[]) {
      expect(STATUS_COLOR[key], `${key}(${STATUS_LABEL[key]})`).toBe(
        statusBadgeTone(STATUS_LABEL[key]),
      );
    }
  });
});
```

두 번째 테스트가 이 태스크의 핵심 안전망이다. 공용 맵이 자기 기본 라벨과 어긋나면 실패한다.

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: FAIL — 현재 값이 `bg-gold/20 text-gold` 등이라 두 테스트 모두 실패

- [ ] **Step 3: 공용 STATUS_COLOR 교체**

`status.ts` 상단에 import를 추가한다.

```ts
import { BADGE_TONE } from "./badge-tone";
```

`STATUS_COLOR`(18-26행)를 통째로 바꾼다. 키 순서와 주석은 유지한다.

```ts
export const STATUS_COLOR: Record<ListRow["status"], string> = {
  urgent: BADGE_TONE.attention,
  approved: BADGE_TONE.idle,
  review: BADGE_TONE.progress,
  active: BADGE_TONE.idle,
  inactive: BADGE_TONE.progress,
  suspended: BADGE_TONE.attention,
  deleted: BADGE_TONE.idle,
};
```

`STATUS_LABEL`과 `STATUS_RING`은 **건드리지 않는다**.

- [ ] **Step 4: 게시글 목록을 라벨 기준으로 전환**

`post/Table.tsx` 4행 import를 바꾼다.

```ts
import { statusBadgeTone } from "../badge-tone";
```

15-18행 주석 블록에서 낡은 문장을 교체한다. 기존:

```
 * STATUS_COLOR는 의미 일관(urgent=red 강조 / approved=muted 종료)이라 그대로 사용.
```

새 문장:

```
 * 색은 라벨 기준(statusBadgeTone) — 같은 enum을 피드백/공지가 다른 라벨로 쓰기 때문이다.
```

110행 배지 클래스를 바꾼다. 색의 입력은 **배지에 이미 그리고 있는 그 라벨**이어야 한다 —
113행이 쓰는 `postStatusLabel(variant, row.status)`(같은 파일 64-69행에 export되어 있다)를 그대로 재사용한다.
새 라벨 계산을 만들지 마라.

```tsx
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${statusBadgeTone(postStatusLabel(variant, row.status))}`}
                >
                  {postStatusLabel(variant, row.status)}
                </span>
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/status.ts src/app/dashboard/_components/inspector/list-variants/post/Table.tsx src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts
git commit -m "refactor: 공용 상태 색과 게시글 배지를 공통 규칙으로"
```

---

### Task 3: 사고·경위서·회의록

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/incidents/Table.tsx:13-18`
- Modify: `src/app/dashboard/_components/inspector/list-variants/incidents/View.tsx:19` 부근 `STATUS_TONE`
- Modify: `src/app/dashboard/_components/inspector/list-variants/incident-reports/status.ts:4-10`
- Modify: `src/app/dashboard/_components/inspector/list-variants/meetings/status.ts:2-5`
- Test: `src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: `BADGE_TONE` (Task 1)
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트 작성**

`__tests__/badge-tone.test.ts` 끝에 추가한다. export된 맵만 테스트할 수 있다 — 나머지는 Step 3에서 눈으로 맞춘다.

```ts
import { STATUS_TONE as REPORT_STATUS_TONE } from "../incident-reports/status";
import { MEETING_STATUS_TONE } from "../meetings/status";

describe("경위서·회의록 상태 톤", () => {
  const tones: string[] = Object.values(BADGE_TONE);

  it("경위서: 모든 값이 BADGE_TONE 중 하나다", () => {
    for (const [key, cls] of Object.entries(REPORT_STATUS_TONE)) {
      expect(tones, `${key}가 규칙 밖 색을 쓴다`).toContain(cls);
    }
  });

  it("경위서: 반려는 주의, 승인완료·발송완료는 완료다", () => {
    expect(REPORT_STATUS_TONE.rejected).toBe(BADGE_TONE.attention);
    expect(REPORT_STATUS_TONE.approved).toBe(BADGE_TONE.done);
    expect(REPORT_STATUS_TONE.sent).toBe(BADGE_TONE.done);
    expect(REPORT_STATUS_TONE.draft).toBe(BADGE_TONE.progress);
    expect(REPORT_STATUS_TONE.pending_approval).toBe(BADGE_TONE.idle);
  });

  it("회의록: 작성 중은 진행, 발송은 완료다", () => {
    expect(MEETING_STATUS_TONE.draft).toBe(BADGE_TONE.progress);
    expect(MEETING_STATUS_TONE.sent).toBe(BADGE_TONE.done);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: FAIL — 현재 값이 `bg-gold/15 text-gold`, `bg-sage text-cream` 등

- [ ] **Step 3: 네 개 맵 교체**

`incidents/Table.tsx` — 한글 라벨이 키다. `import { BADGE_TONE } from "../badge-tone";` 추가 후:

```ts
const STATUS_TONE = {
  미처리: BADGE_TONE.idle,
  처리중: BADGE_TONE.progress,
  처리완료: BADGE_TONE.done,
  보류: BADGE_TONE.idle,
} as const;
```

`incidents/View.tsx` — 같은 키의 맵이다. 위와 **똑같은 값**으로 바꾼다(같은 상태가 목록과 상세에서 다른 색이면 안 된다).

```ts
const STATUS_TONE = {
  미처리: BADGE_TONE.idle,
  처리중: BADGE_TONE.progress,
  처리완료: BADGE_TONE.done,
  보류: BADGE_TONE.idle,
} as const;
```

`incident-reports/status.ts` — 라벨은 `REPORT_STATUS_LABEL`(`@/features/incident-reports/schemas`)에 있다: draft "작성 중" / pending_approval "승인대기" / approved "승인완료" / rejected "반려" / sent "발송완료".

```ts
import { BADGE_TONE } from "../badge-tone";

/** 경위서 결재 상태 → 상태 배지 Tailwind 톤 클래스 */
export const STATUS_TONE: Record<ReportStatus, string> = {
  draft: BADGE_TONE.progress,
  pending_approval: BADGE_TONE.idle,
  approved: BADGE_TONE.done,
  rejected: BADGE_TONE.attention,
  sent: BADGE_TONE.done,
};
```

`meetings/status.ts`:

```ts
import { BADGE_TONE } from "../badge-tone";

/** 회의록 작성 상태 → 상태 배지 Tailwind 톤 클래스 */
export const MEETING_STATUS_TONE: Record<string, string> = {
  draft: BADGE_TONE.progress,
  sent: BADGE_TONE.done,
};
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/incidents/ src/app/dashboard/_components/inspector/list-variants/incident-reports/status.ts src/app/dashboard/_components/inspector/list-variants/meetings/status.ts src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts
git commit -m "refactor: 사고·경위서·회의록 배지를 공통 규칙으로"
```

---

### Task 4: 인수인계·견적·기수·백업·개선안

남은 색맵 6개를 한 번에 정리한다. 전부 값만 바꾸는 기계적 교체다.

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/handover/Table.tsx:21-26`
- Modify: `src/app/dashboard/handover/HandoverHistory.tsx:21-25`
- Modify: `src/app/dashboard/_components/inspector/list-variants/quotes/Table.tsx:14-19`
- Modify: `src/app/dashboard/_components/inspector/list-variants/cohort/Table.tsx:18-22`
- Create: `src/app/dashboard/_components/inspector/list-variants/cohort/__tests__/Table.test.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/backup/View.tsx:15-22`
- Modify: `src/app/dashboard/_components/patterns/ProjectPattern.tsx:17-21`

**Interfaces:**
- Consumes: `BADGE_TONE` (Task 1)
- Produces: 없음

각 파일에 `BADGE_TONE` import를 추가한다. 경로는 파일 위치에 따라 다르다:
- `list-variants/*/Table.tsx` → `from "../badge-tone"`
- `dashboard/handover/HandoverHistory.tsx` → `from "../_components/inspector/list-variants/badge-tone"`
- `_components/patterns/ProjectPattern.tsx` → `from "../inspector/list-variants/badge-tone"`

- [ ] **Step 1: handover 두 곳 교체**

`list-variants/handover/Table.tsx` (라벨: none "미작성" / draft "작성중" / ready "작성완료" / published "인계완료"):

```ts
const STATUS_TONE: Record<StatusKey, string> = {
  none: BADGE_TONE.idle,
  draft: BADGE_TONE.progress,
  ready: BADGE_TONE.done,
  published: BADGE_TONE.done,
};
```

`dashboard/handover/HandoverHistory.tsx` (라벨: in_progress "진행 중" / completed "완료" / cancelled "취소"):

```ts
const STATUS_TONE: Record<ProgressListRow["status"], string> = {
  in_progress: BADGE_TONE.progress,
  completed: BADGE_TONE.done,
  cancelled: BADGE_TONE.idle,
};
```

- [ ] **Step 2: quotes·cohort 교체**

`quotes/Table.tsx` (라벨 `QUOTE_STATUS_LABEL`: draft "작성중" / sent "발송" / won "수주" / lost "실주"):

```ts
const STATUS_TONE: Record<string, string> = {
  draft: BADGE_TONE.progress,
  sent: BADGE_TONE.idle,
  won: BADGE_TONE.done,
  lost: BADGE_TONE.idle,
};
```

`cohort/Table.tsx` (라벨 `COHORT_STATUS_LABEL`: planned "계획" / in_progress "진행중" / completed "완료"):

```ts
const COHORT_STATUS_COLOR: Record<CohortStatus, string> = {
  planned: BADGE_TONE.idle,
  in_progress: BADGE_TONE.progress,
  completed: BADGE_TONE.done,
};
```

**`cohort/Table.tsx`는 짝 테스트가 없어 `tdd-enforce` 훅이 편집을 막는다.** 훅을 우회하지 말고,
먼저 아래 테스트 파일을 만들어 훅을 정상 통과시킨다. 이 파일이 이 태스크의 RED 단계다 —
테스트를 만들고 실행해 실패를 확인한 뒤에 `Table.tsx`를 고친다.

`src/app/dashboard/_components/inspector/list-variants/cohort/__tests__/Table.test.tsx` (신규):

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { BADGE_TONE } from "../../badge-tone";
import { CohortTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "2026년 1기",
  status: "active",
  owner: "송영신",
};

function toneOf(label: string): string {
  const el = screen.getByText(label);
  return el.className;
}

describe("CohortTable — 기수 상태 배지 톤", () => {
  it("진행중은 progress 톤이다", () => {
    render(
      <CohortTable
        rows={[{ ...baseRow, cohortStatus: "in_progress" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(toneOf("진행중")).toContain(BADGE_TONE.progress);
  });

  it("완료는 done 톤이다", () => {
    render(
      <CohortTable
        rows={[{ ...baseRow, cohortStatus: "completed" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(toneOf("완료")).toContain(BADGE_TONE.done);
  });

  it("계획은 idle 톤이다", () => {
    render(
      <CohortTable
        rows={[{ ...baseRow, cohortStatus: "planned" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(toneOf("계획")).toContain(BADGE_TONE.idle);
  });
});
```

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/cohort/__tests__/Table.test.tsx`
Expected(RED): 3건 실패 — 현재 값이 `bg-line-soft text-muted`(계획만 우연히 통과할 수 있다),
`bg-vermilion text-cream`, `bg-washi-raised text-ink`다. 최소 `완료` 케이스는 반드시 실패해야 한다.
실패를 확인한 뒤에 위 색맵을 고친다.

컴포넌트 export 이름(`CohortTable`)과 props가 위와 다르면 실제 시그니처에 맞춰 호출부만 고친다 —
단언 내용(어떤 라벨이 어떤 톤인지)은 그대로 둔다.

- [ ] **Step 3: backup·ProjectPattern 교체**

`backup/View.tsx` (라벨은 바로 위 `MAIL_STATUS_LABEL`에 있다). **`scheduled`("예약완료")가 대기인 점이 이 태스크에서 가장 틀리기 쉬운 자리다** — 아직 발송 전이라 완료가 아니다:

```ts
const MAIL_STATUS_TONE = {
  pending: BADGE_TONE.idle,
  scheduled: BADGE_TONE.idle,
  sending: BADGE_TONE.progress,
  sent: BADGE_TONE.done,
  mail_failed: BADGE_TONE.attention,
  dry_run: BADGE_TONE.idle,
} as const;
```

`ProjectPattern.tsx` (라벨: run "진행" / rev "검토" / wait "대기"):

```ts
const STATUS_COLOR: Record<ProjectMockData["improvements"][number]["status"], string> = {
  run: BADGE_TONE.progress,
  rev: BADGE_TONE.idle,
  wait: BADGE_TONE.idle,
};
```

- [ ] **Step 4: 옛 톤 문자열이 남아 있지 않은지 확인**

Run:
```bash
grep -rn "bg-gold/1\|bg-gold/2\|bg-sage/1\|bg-sage/2\|bg-vermilion/1\|bg-washi-raised text-muted\|bg-washi-raised text-ink-soft\|bg-ink/10\|bg-ink/20" src/app/dashboard/_components/inspector/list-variants/ src/app/dashboard/handover/HandoverHistory.tsx src/app/dashboard/_components/patterns/ProjectPattern.tsx
```
Expected: 이 계획이 건드린 **상태 색맵 안에는** 한 건도 없어야 한다. 다른 용도(우선순위·레벨·분류 배지)의 히트는 정상이므로 남겨둔다 — 각 히트가 상태 맵인지 확인하고, 상태 맵이면 Step 1-3을 빠뜨린 것이다.

- [ ] **Step 5: 타입 확인**

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/handover/Table.tsx src/app/dashboard/handover/HandoverHistory.tsx src/app/dashboard/_components/inspector/list-variants/quotes/Table.tsx src/app/dashboard/_components/inspector/list-variants/cohort/Table.tsx src/app/dashboard/_components/inspector/list-variants/backup/View.tsx src/app/dashboard/_components/patterns/ProjectPattern.tsx
git commit -m "refactor: 인수인계·견적·기수·백업·개선안 배지를 공통 규칙으로"
```

---

### Task 4b: 설계가 놓친 상태 배지 4곳

Task 4 구현 중 발견. 설계 단계 조사가 `_COLOR`/`_TONE` 이름만 훑어 **`STATUS_BADGE` 계열을 통째로 놓쳤다.**
그 결과 지금 브랜치에는 **같은 상태가 목록과 상세에서 다른 색으로 보이는 불일치**가 있다 — 이 계획이
없애려던 바로 그 문제를 새로 만든 셈이라 머지 전에 반드시 닫는다.

**Files:**
- Modify: `src/app/dashboard/_components/inspector/list-variants/badge-tone.ts` (`ATTENTION`에 `장애` 추가)
- Modify: `src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
- Modify: `src/app/dashboard/_components/inspector/list-variants/backup/Table.tsx:66-73`
- Modify: `src/app/dashboard/_components/inspector/list-variants/default/View.tsx:14-22,30`
- Modify: `src/app/dashboard/_components/inspector/list-variants/post/View.tsx:5-13,23`
- Modify: `src/app/dashboard/_components/inspector/list-variants/team/View.tsx:22-30,67`

**Interfaces:**
- Consumes: `BADGE_TONE`, `statusBadgeTone` (Task 1)
- Produces: 없음

**범위 밖으로 남기는 것** — `cohort/Table.tsx`의 `inviteBadgeClass`(수락됨 / 수락 대기 / 미초대).
초대 진행도라는 다른 축이고, 세 라벨 모두 4버킷 규칙으로는 `idle` 하나로 뭉쳐 구분이 사라진다.
상태 배지가 아니므로 건드리지 않는다.

- [ ] **Step 1: `장애` 규칙 테스트 추가 (RED)**

`default/View.tsx`와 `team/View.tsx`는 `urgent`를 **"장애"** 로 부른다. 현재 규칙에 없어 그레이로 떨어진다 —
장애가 대기 상태와 같은 색이면 안 된다. `__tests__/badge-tone.test.ts`의 "주의" describe 블록 배열에
`"장애"`를 추가한다. 기존 배열:

```ts
  for (const label of ["긴급", "발송 실패", "반려", "중단", "정지"]) {
```

바꾼 뒤:

```ts
  for (const label of ["긴급", "장애", "발송 실패", "반려", "중단", "정지"]) {
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: FAIL — `장애 → attention` 1건만 실패(현재 idle을 돌려준다)

- [ ] **Step 3: 규칙에 `장애` 추가**

`badge-tone.ts`의 `ATTENTION` Set 한 줄만 고친다.

```ts
const ATTENTION = new Set(["긴급", "장애", "반려", "중단", "정지"]);
```

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/badge-tone.test.ts`
Expected: PASS

- [ ] **Step 4: 상세 패널 3곳에서 중복 맵 제거**

세 파일 모두 `statusLabel`을 바로 위에서 이미 계산하고 있다. 로컬 `STATUS_BADGE` 맵을 **삭제**하고
색을 라벨에서 뽑는다. 맵을 `BADGE_TONE` 값으로 고쳐 쓰지 마라 — 중복이 남는다.

`default/View.tsx` — 14-22행 `STATUS_BADGE` 선언 삭제, import 추가, 30행 교체:

```ts
import { statusBadgeTone } from "../badge-tone";
```
```ts
  const statusColor = statusBadgeTone(statusLabel);
```

`post/View.tsx` — 5-13행 `STATUS_BADGE` 선언 삭제, import 추가, 23행 교체. `statusLabel`은
22행에서 `postStatusLabel(variant, row.status)`로 이미 계산돼 있다:

```ts
import { statusBadgeTone } from "../badge-tone";
```
```ts
  const statusColor = statusBadgeTone(statusLabel);
```

`team/View.tsx` — 22-30행 `STATUS_BADGE` 선언 삭제, import 추가, 67행 교체. 이 파일의
`STATUS_LABEL`(12-20행, `urgent: "장애"`)은 **그대로 둔다**:

```ts
import { statusBadgeTone } from "../badge-tone";
```
```ts
  const statusColor = statusBadgeTone(statusLabel);
```

- [ ] **Step 5: 백업 목록 배지 톤 교체**

`backup/Table.tsx`의 `MAIL_STATUS_BADGE`는 `{ label, tone }` 구조라 앞의 맵들과 형태가 다르다.
**`tone` 값만** 바꾸고 `label`은 손대지 않는다. `backup/View.tsx`(Task 4에서 이미 고침)와 같은 배정이어야 한다:

```ts
import { BADGE_TONE } from "../badge-tone";
```
```ts
/** 백업 mail_status → 목록 배지. backup/View.tsx 라벨·톤과 일치. */
const MAIL_STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  pending: { label: "대기", tone: BADGE_TONE.idle },
  scheduled: { label: "예약완료", tone: BADGE_TONE.idle },
  sending: { label: "발송 중", tone: BADGE_TONE.progress },
  sent: { label: "발송완료", tone: BADGE_TONE.done },
  mail_failed: { label: "발송 실패", tone: BADGE_TONE.attention },
  dry_run: { label: "테스트", tone: BADGE_TONE.idle },
};
```

- [ ] **Step 6: 누락 없는지 재확인**

Run:
```bash
grep -rn "STATUS_BADGE\|_BADGE:" --include=*.tsx --include=*.ts src/app/dashboard/ | grep -v "__tests__"
```
Expected: `backup/Table.tsx`의 `MAIL_STATUS_BADGE`(이제 `BADGE_TONE` 사용)만 남는다.
`default/View.tsx` / `post/View.tsx` / `team/View.tsx`의 히트는 0이어야 한다 — 선언을 지웠으므로.

Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/` 및 `npm run typecheck`
Expected: 테스트 전부 통과, 타입 에러 0

- [ ] **Step 7: 커밋**

```bash
git add src/app/dashboard/_components/inspector/list-variants/
git commit -m "fix: 목록·상세 배지 색 불일치 해소 (설계 조사 누락분)"
```

---

### Task 5: 전체 검증

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1-4 전체
- Produces: 없음

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 전부 통과, 실패 0

- [ ] **Step 2: 타입·린트**

Run: `npm run typecheck`
Expected: 에러 0

Run: `npm run lint`
Expected: 에러 0 (`src/app/r/checklist/[token]/_components/ReportView.tsx` 등의 `<img>` 경고 3건은 이 브랜치와 무관한 기존 것 — 이것만 남는 건 정상)

- [ ] **Step 3: 빌드**

Run: `npm run build`
Expected: exit 0. `/_global-error` useContext 에러가 나면 셸에 `NODE_ENV=development`가 새어 있는 것이니 `unset NODE_ENV` 후 재실행한다. 환경 문제지 코드 결함이 아니다.

- [ ] **Step 4: 하드코딩 색상 최종 확인**

Run:
```bash
grep -rn "bg-\[#\|text-\[#\|#[0-9a-fA-F]\{6\}" src/app/dashboard/_components/inspector/list-variants/badge-tone.ts
```
Expected: 히트 0 — 톤 정의에 하드코딩 색이 없어야 한다

- [ ] **Step 5: 커밋 (변경 없으면 생략)**

검증만 한 태스크이므로 보통 커밋할 것이 없다. Step 1-4에서 고친 게 있으면:

```bash
git add -A
git commit -m "fix: 상태 배지 규칙 검증 중 발견한 문제 수정"
```

---

## 실화면 확인 (사람이 수행)

자동 검증으로는 색이 실제로 어떻게 보이는지 알 수 없다. 아래는 배포/개발 서버에서 눈으로 본다.

- [ ] 의견·건의 목록 — 처리완료 **검정**, 처리중 **빨강**, 요청 **그레이**
- [ ] 서비스 목록 — 활성이 **그레이**로 바뀐 모습 (초록에서 내려온 것, 이번 변경의 최대 체감 지점)
- [ ] 백업요청 상세 — 발송 실패가 **짙은 빨강**, 예약완료가 **그레이**(검정 아님)
- [ ] 사고 기록 / 경위서 / 견적 / 인수인계 목록의 배지 색
- [ ] **긴급과 진행중이 나란히 있을 때 구분되는지** — 안 갈리면 진행을 `bg-vermilion/15 text-vermilion`으로 톤다운하는 게 대안(설계 '위험' 절)

## 완료 기준

- [ ] Task 1-5 완료, 각 커밋 존재
- [ ] `npm test` / `npm run typecheck` / `npm run lint` / `npm run build` 전부 통과 (실행 결과로 확인)
- [ ] 설계 문서의 '전체 매핑' 표와 코드가 일치
- [ ] `git diff main --stat`으로 범위 밖 파일(`STATUS_RING`, `PRIORITY_COLOR`, `LEVEL_COLOR`, `SCHEDULE_TYPE_COLOR`, `PERMISSION_COLOR`, `DOMAIN_TONE`, `AI_TOOL_TONE`, `CATEGORY_TONE`)이 변경되지 않았음을 확인
