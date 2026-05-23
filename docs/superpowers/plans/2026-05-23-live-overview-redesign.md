# 실시간 현황 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard` (실시간 현황)을 9개 미니테이블에서 **KPI 타일(9) + 우선순위 통합 피드** 하이브리드로 재구성.

**Architecture:** 기존 page.tsx의 9 도메인 fetch를 그대로 유지하고 출력만 KpiTile[] + FeedItem[]로 변환. 신규 컴포넌트는 `_components/live/` 하위에 추가. LiveDashboard/LiveCard/SimpleTable은 dead 확인 후 제거.

**Tech Stack:** Next.js 16 App Router · React Server Components · Tailwind v4 · Vitest + RTL · Folio design tokens.

**Spec:** `docs/superpowers/specs/2026-05-23-live-overview-redesign-design.md`

---

## File Structure

**Create:**
- `src/app/dashboard/_components/live/feed.ts` — 순수 모듈 (build/sort/format)
- `src/app/dashboard/_components/live/__tests__/feed.test.ts`
- `src/app/dashboard/_components/live/CountUp.tsx` — 카운트업 (client)
- `src/app/dashboard/_components/live/__tests__/CountUp.test.tsx`
- `src/app/dashboard/_components/live/KpiTile.tsx` — 타일 (client)
- `src/app/dashboard/_components/live/__tests__/KpiTile.test.tsx`
- `src/app/dashboard/_components/live/FeedChips.tsx` — 칩 필터 (client)
- `src/app/dashboard/_components/live/__tests__/FeedChips.test.tsx`
- `src/app/dashboard/_components/live/FeedRow.tsx` — 피드 행 (client)
- `src/app/dashboard/_components/live/__tests__/FeedRow.test.tsx`
- `src/app/dashboard/_components/live/LiveOverview.tsx` — 합성 (client)
- `src/app/dashboard/_components/live/__tests__/LiveOverview.test.tsx`

**Modify:**
- `src/app/dashboard/page.tsx` — fetch 유지, 출력 형태 변환 + LiveOverview 렌더

**Delete (Task 7, dead 확인 후):**
- `src/app/dashboard/_components/live/LiveDashboard.tsx` + 테스트
- `src/app/dashboard/_components/live/LiveCard.tsx` + 테스트
- `src/app/dashboard/_components/live/SimpleTable.tsx` + 테스트

**Reuse (변경 없음):** `LivePageHeader.tsx`, `InspectorPanel/Chrome/ListBody`, design tokens.

---

## Task 1: feed.ts 순수 모듈 (TDD)

도메인별 데이터 → FeedItem[] 변환 + 정렬 + 일자 포맷.

**Files:**
- Create: `src/app/dashboard/_components/live/feed.ts`
- Test: `src/app/dashboard/_components/live/__tests__/feed.test.ts`

### Step 1: 테스트 작성 (RED)

```ts
// __tests__/feed.test.ts
import { describe, it, expect } from "vitest";
import { buildFeedItems, sortFeedItems, formatFeedDate, type FeedItem } from "../feed";

const todayKst = "2026-05-23"; // 테스트 기준일
const now = new Date("2026-05-23T03:00:00Z"); // KST 12:00

describe("buildFeedItems", () => {
  it("incidents/todos/services/schedule/backup 소스를 FeedItem[]로 매핑", () => {
    const items = buildFeedItems({
      incidents: [
        { id: "i1", title: "결제 오류", occurred_date: "2026-05-22", status: "미처리", listRow: { id: "i1" } as never },
        { id: "i2", title: "로그 누락", occurred_date: "2026-05-20", status: "처리완료", listRow: { id: "i2" } as never },
      ],
      todos: [
        { id: "t1", title: "PDF 검토", due_at: "2026-05-22", listRow: { id: "t1" } as never },
        { id: "t2", title: "리뷰", due_at: null, listRow: { id: "t2" } as never },
      ],
      services: [
        { id: "s1", title: "A대 원서접수", write_start_at: "2026-05-25", listRow: { id: "s1" } as never },
      ],
      schedule: [
        { id: "e1", title: "정기회의", start_at: "2026-05-24T05:00:00Z", listRow: { id: "e1" } as never },
      ],
      backup: [
        { id: "b1", title: "휴가 백업", leave_start_date: "2026-05-26", listRow: { id: "b1" } as never },
      ],
    });
    expect(items.length).toBe(7);
    expect(items.find((x) => x.id === "i1")?.domain).toBe("incidents");
    expect(items.find((x) => x.id === "i1")?.domainLabel).toBe("사고");
    expect(items.find((x) => x.id === "t1")?.domain).toBe("todos");
    expect(items.find((x) => x.id === "t1")?.domainLabel).toBe("내 할일");
  });
});

describe("sortFeedItems", () => {
  it("urgent → scheduled → undated, 각 그룹 내 일자 asc", () => {
    const items: FeedItem[] = [
      { id: "a", domain: "services", domainLabel: "서비스", variant: "services" as never, date: "2026-05-25", dateDisplay: "5.25", title: "A", tier: "scheduled", listRow: {} as never },
      { id: "b", domain: "incidents", domainLabel: "사고", variant: "incidents" as never, date: "2026-05-22", dateDisplay: "미해결", title: "B", tier: "urgent", listRow: {} as never },
      { id: "c", domain: "todos", domainLabel: "내 할일", variant: "weekly-todo" as never, date: null, dateDisplay: "—", title: "C", tier: "undated", listRow: {} as never },
      { id: "d", domain: "todos", domainLabel: "내 할일", variant: "weekly-todo" as never, date: "2026-05-20", dateDisplay: "지남", title: "D", tier: "urgent", listRow: {} as never },
      { id: "e", domain: "schedule", domainLabel: "일정", variant: "schedule" as never, date: "2026-05-24", dateDisplay: "5.24", title: "E", tier: "scheduled", listRow: {} as never },
    ];
    expect(sortFeedItems(items).map((x) => x.id)).toEqual(["d", "b", "e", "a", "c"]);
  });
});

describe("formatFeedDate", () => {
  it("urgent + incidents → 미해결", () => {
    expect(formatFeedDate({ tier: "urgent", domain: "incidents", date: "2026-05-22" }, now)).toBe("미해결");
  });
  it("urgent + todos → 지남", () => {
    expect(formatFeedDate({ tier: "urgent", domain: "todos", date: "2026-05-22" }, now)).toBe("지남");
  });
  it("scheduled + 오늘 → 오늘", () => {
    expect(formatFeedDate({ tier: "scheduled", domain: "services", date: "2026-05-23" }, now)).toBe("오늘");
  });
  it("scheduled + 미래 → M.D", () => {
    expect(formatFeedDate({ tier: "scheduled", domain: "services", date: "2026-05-25" }, now)).toBe("5.25");
  });
  it("undated → —", () => {
    expect(formatFeedDate({ tier: "undated", domain: "todos", date: null }, now)).toBe("—");
  });
});

describe("buildFeedItems + tier 판정", () => {
  it("사고 status='처리완료'는 scheduled, 그 외 urgent", () => {
    const items = buildFeedItems({
      incidents: [
        { id: "i1", title: "X", occurred_date: "2026-05-22", status: "미처리", listRow: {} as never },
        { id: "i2", title: "Y", occurred_date: "2026-05-22", status: "처리중", listRow: {} as never },
        { id: "i3", title: "Z", occurred_date: "2026-05-22", status: "처리완료", listRow: {} as never },
      ],
      todos: [],
      services: [],
      schedule: [],
      backup: [],
    }, now);
    expect(items.find((x) => x.id === "i1")?.tier).toBe("urgent");
    expect(items.find((x) => x.id === "i2")?.tier).toBe("urgent");
    expect(items.find((x) => x.id === "i3")?.tier).toBe("scheduled");
  });
  it("todos: due_at < today → urgent(지남), >= today → scheduled, null → undated", () => {
    const items = buildFeedItems({
      incidents: [], services: [], schedule: [], backup: [],
      todos: [
        { id: "t1", title: "A", due_at: "2026-05-22", listRow: {} as never },
        { id: "t2", title: "B", due_at: "2026-05-23", listRow: {} as never },
        { id: "t3", title: "C", due_at: "2026-05-25", listRow: {} as never },
        { id: "t4", title: "D", due_at: null, listRow: {} as never },
      ],
    }, now);
    expect(items.find((x) => x.id === "t1")?.tier).toBe("urgent");
    expect(items.find((x) => x.id === "t2")?.tier).toBe("scheduled");
    expect(items.find((x) => x.id === "t3")?.tier).toBe("scheduled");
    expect(items.find((x) => x.id === "t4")?.tier).toBe("undated");
  });
});
```

Run: `npx vitest run src/app/dashboard/_components/live/__tests__/feed.test.ts` — expect ALL fail (module 없음).

### Step 2: feed.ts 구현 (GREEN)

```ts
// feed.ts
import type { ListRow } from "../patterns/ListPattern";
import type { Variant } from "../inspector/list-variants/types";

export type FeedDomain = "incidents" | "todos" | "services" | "schedule" | "backup";
export type FeedTier = "urgent" | "scheduled" | "undated";

export type FeedItem = {
  id: string;
  domain: FeedDomain;
  domainLabel: string;
  variant: Variant;
  date: string | null;
  dateDisplay: string;
  title: string;
  tier: FeedTier;
  listRow: ListRow;
};

export type FeedSources = {
  incidents: { id: string; title: string; occurred_date: string | null; status: string; listRow: ListRow }[];
  todos: { id: string; title: string; due_at: string | null; listRow: ListRow }[];
  services: { id: string; title: string; write_start_at: string | null; listRow: ListRow }[];
  schedule: { id: string; title: string; start_at: string; listRow: ListRow }[];
  backup: { id: string; title: string; leave_start_date: string | null; listRow: ListRow }[];
};

const DOMAIN_LABEL: Record<FeedDomain, string> = {
  incidents: "사고",
  todos: "내 할일",
  services: "서비스",
  schedule: "일정",
  backup: "백업",
};

const DOMAIN_VARIANT: Record<FeedDomain, Variant> = {
  incidents: "incidents",
  todos: "weekly-todo",
  services: "services",
  schedule: "schedule",
  backup: "backup",
};

/** YYYY-MM-DD (KST) 추출. ISO도 처리. */
function ymdKst(input: string | null, now: Date): string | null {
  if (!input) return null;
  // 이미 YYYY-MM-DD면 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(input));
}

function todayKst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

export function buildFeedItems(sources: FeedSources, now: Date = new Date()): FeedItem[] {
  const today = todayKst(now);
  const out: FeedItem[] = [];

  for (const i of sources.incidents) {
    const date = ymdKst(i.occurred_date, now);
    const urgent = i.status !== "처리완료";
    const tier: FeedTier = urgent ? "urgent" : date ? "scheduled" : "undated";
    out.push(make("incidents", i.id, i.title, date, tier, i.listRow, now));
  }
  for (const t of sources.todos) {
    const date = ymdKst(t.due_at, now);
    let tier: FeedTier;
    if (!date) tier = "undated";
    else if (date < today) tier = "urgent";
    else tier = "scheduled";
    out.push(make("todos", t.id, t.title, date, tier, t.listRow, now));
  }
  for (const s of sources.services) {
    const date = ymdKst(s.write_start_at, now);
    const tier: FeedTier = date ? "scheduled" : "undated";
    out.push(make("services", s.id, s.title, date, tier, s.listRow, now));
  }
  for (const e of sources.schedule) {
    const date = ymdKst(e.start_at, now);
    out.push(make("schedule", e.id, e.title, date, "scheduled", e.listRow, now));
  }
  for (const b of sources.backup) {
    const date = ymdKst(b.leave_start_date, now);
    const tier: FeedTier = date ? "scheduled" : "undated";
    out.push(make("backup", b.id, b.title, date, tier, b.listRow, now));
  }
  return out;
}

function make(
  domain: FeedDomain,
  id: string,
  title: string,
  date: string | null,
  tier: FeedTier,
  listRow: ListRow,
  now: Date,
): FeedItem {
  return {
    id,
    domain,
    domainLabel: DOMAIN_LABEL[domain],
    variant: DOMAIN_VARIANT[domain],
    date,
    dateDisplay: formatFeedDate({ tier, domain, date }, now),
    title,
    tier,
    listRow,
  };
}

const TIER_ORDER: Record<FeedTier, number> = { urgent: 0, scheduled: 1, undated: 2 };

export function sortFeedItems(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => {
    const t = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
    if (t !== 0) return t;
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date && !b.date) return -1;
    if (!a.date && b.date) return 1;
    return 0;
  });
}

export function formatFeedDate(
  item: { tier: FeedTier; domain: FeedDomain; date: string | null },
  now: Date,
): string {
  if (item.tier === "undated" || !item.date) return "—";
  if (item.tier === "urgent") {
    return item.domain === "incidents" ? "미해결" : "지남";
  }
  const today = todayKst(now);
  if (item.date === today) return "오늘";
  // M.D (연도 생략)
  const [, m, d] = /^\d{4}-(\d{2})-(\d{2})$/.exec(item.date) ?? [];
  if (!m || !d) return "—";
  return `${Number(m)}.${Number(d)}`;
}
```

Run: `npx vitest run src/app/dashboard/_components/live/__tests__/feed.test.ts` — expect ALL pass.

### Step 3: 커밋

```bash
git add src/app/dashboard/_components/live/feed.ts src/app/dashboard/_components/live/__tests__/feed.test.ts
git commit -m "feat: 실시간 현황 피드 순수 모듈 추가 (build/sort/format)"
```

---

## Task 2: CountUp 컴포넌트 (TDD)

마운트 시 0→value 카운트업, prefers-reduced-motion 가드, SSR-safe.

**Files:**
- Create: `src/app/dashboard/_components/live/CountUp.tsx`
- Test: `src/app/dashboard/_components/live/__tests__/CountUp.test.tsx`

### Step 1: 테스트 작성 (RED)

```tsx
// __tests__/CountUp.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountUp } from "../CountUp";

function mockReducedMotion(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: q.includes("reduce") && reduce,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      media: q,
      dispatchEvent: () => false,
    }),
  });
}

describe("CountUp", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  it("초기 렌더는 value (SSR-safe)", () => {
    mockReducedMotion(false);
    const { container } = render(<CountUp value={42} />);
    expect(container.textContent).toContain("42");
  });
  it("prefers-reduced-motion → 즉시 value 표시", () => {
    mockReducedMotion(true);
    render(<CountUp value={7} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });
  it("value=0이면 0 표시", () => {
    mockReducedMotion(false);
    render(<CountUp value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

Run → fail (모듈 없음).

### Step 2: CountUp.tsx 구현 (GREEN)

```tsx
// CountUp.tsx
"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  durationMs?: number;
};

/** 마운트 시 0 → value 카운트업. reduced-motion이면 즉시 value.
 *  초기 state=value로 SSR↔클라이언트 hydration mismatch 회피. */
export function CountUp({ value, durationMs = 700 }: Props) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(value);
      return;
    }
    let rafId = 0;
    const start = performance.now();
    setDisplay(0);
    const tick = (t: number) => {
      const elapsed = t - start;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (p < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  return <>{display}</>;
}
```

Run → pass.

### Step 3: 커밋

```bash
git add src/app/dashboard/_components/live/CountUp.tsx src/app/dashboard/_components/live/__tests__/CountUp.test.tsx
git commit -m "feat: KPI 타일 카운트업 컴포넌트 추가 (reduced-motion 가드)"
```

---

## Task 3: KpiTile 컴포넌트 (TDD)

라벨↑ + 큰 숫자(라벨에 비례)↓ + countSub. 클릭→해당 메뉴 navigate.

**Files:**
- Create: `src/app/dashboard/_components/live/KpiTile.tsx`
- Test: `src/app/dashboard/_components/live/__tests__/KpiTile.test.tsx`

### Step 1: 테스트 (RED)

```tsx
// __tests__/KpiTile.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiTile } from "../KpiTile";

describe("KpiTile", () => {
  it("라벨/숫자/countSub 렌더", () => {
    render(<KpiTile label="서비스" count={5} countSub="내 담당 · 오픈 예정" href="/dashboard/services" />);
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText(/내 담당 · 오픈 예정/)).toBeInTheDocument();
  });
  it("count=null이면 — 표시", () => {
    render(<KpiTile label="미수채권" count={null} countSub="—" href="/dashboard/receivables" />);
    expect(screen.getByText("—", { selector: "[data-kpi-number]" })).toBeInTheDocument();
  });
  it("href가 있는 링크로 감싸짐", () => {
    render(<KpiTile label="서비스" count={5} countSub="x" href="/dashboard/services" />);
    const link = screen.getByRole("link", { name: /서비스/ });
    expect(link).toHaveAttribute("href", "/dashboard/services");
  });
});
```

Run → fail.

### Step 2: KpiTile.tsx 구현 (GREEN)

```tsx
// KpiTile.tsx
"use client";

import Link from "next/link";
import { CountUp } from "./CountUp";

type Props = {
  label: string;
  count: number | null;
  countSub: string;
  href: string;
};

/** 라벨↑ + 큰 숫자(라벨 폰트에 비례, em-기반)↓ + countSub.
 *  카운트=null이면 — 표시(카운트업 없음). 클릭→href. */
export function KpiTile({ label, count, countSub, href }: Props) {
  return (
    <Link
      href={href}
      className="group block border border-line bg-cream px-4 py-3 transition-colors hover:bg-washi-raised"
    >
      <div className="font-mono text-2xs uppercase tracking-[0.18em] text-muted">
        {label}
      </div>
      <div
        data-kpi-number
        className="mt-1 text-ink"
        style={{ fontSize: "3.2em", lineHeight: 1, fontWeight: 300 }}
      >
        {count === null ? "—" : <CountUp value={count} />}
      </div>
      <div className="mt-1 text-2xs text-muted">{countSub}</div>
    </Link>
  );
}
```

> 숫자 폰트 크기는 라벨(text-2xs 컨테이너)에 대한 em 기반(`3.2em`)으로 라벨 크기 변경 시 함께 변함. 색상은 토큰(`text-ink`, `bg-cream`, `border-line`).

Run → pass.

### Step 3: 커밋

```bash
git add src/app/dashboard/_components/live/KpiTile.tsx src/app/dashboard/_components/live/__tests__/KpiTile.test.tsx
git commit -m "feat: KPI 타일 컴포넌트 추가 (라벨 비례 큰 숫자 + 카운트업)"
```

---

## Task 4: FeedRow + FeedChips (TDD)

피드 행(도메인 칩+일자+내용) + 칩 필터 바.

**Files:**
- Create: `FeedRow.tsx`, `FeedChips.tsx` + 각 테스트

### Step 1: FeedRow 테스트 (RED)

```tsx
// __tests__/FeedRow.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedRow } from "../FeedRow";
import type { FeedItem } from "../feed";

const item: FeedItem = {
  id: "x1", domain: "incidents", domainLabel: "사고",
  variant: "incidents" as never, date: "2026-05-22",
  dateDisplay: "미해결", title: "결제 오류",
  tier: "urgent", listRow: {} as never,
};

describe("FeedRow", () => {
  it("도메인 칩/일자/내용 렌더", () => {
    render(<FeedRow item={item} onSelect={() => {}} />);
    expect(screen.getByText("사고")).toBeInTheDocument();
    expect(screen.getByText("미해결")).toBeInTheDocument();
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
  });
  it("클릭 시 onSelect 호출", () => {
    const fn = vi.fn();
    render(<FeedRow item={item} onSelect={fn} />);
    fireEvent.click(screen.getByText("결제 오류"));
    expect(fn).toHaveBeenCalledWith(item);
  });
});
```

### Step 2: FeedRow.tsx 구현 (GREEN)

```tsx
// FeedRow.tsx
"use client";

import type { FeedItem } from "./feed";

type Props = {
  item: FeedItem;
  onSelect: (item: FeedItem) => void;
};

/** 피드 행 — [도메인 칩] · 일자 · 내용. 클릭→onSelect. */
export function FeedRow({ item, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className="flex w-full items-center gap-3 border-b border-line-soft px-3 py-2 text-left text-sm text-ink hover:bg-washi-raised"
    >
      <span className="inline-flex w-16 justify-center border border-vermilion/40 px-1.5 py-0.5 text-2xs uppercase tracking-[0.06em] text-vermilion">
        {item.domainLabel}
      </span>
      <span className="w-16 text-xs text-ink-soft">{item.dateDisplay}</span>
      <span className="flex-1 truncate">{item.title}</span>
    </button>
  );
}
```

### Step 3: FeedChips 테스트 (RED)

```tsx
// __tests__/FeedChips.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedChips } from "../FeedChips";

describe("FeedChips", () => {
  const counts = { all: 7, incidents: 1, todos: 2, services: 2, schedule: 1, backup: 1 };
  it("전체+5개 칩 렌더 + 건수", () => {
    render(<FeedChips active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /전체.*7/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사고.*1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내 할일.*2/ })).toBeInTheDocument();
  });
  it("클릭 시 onChange 호출", () => {
    const fn = vi.fn();
    render(<FeedChips active="all" counts={counts} onChange={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /사고/ }));
    expect(fn).toHaveBeenCalledWith("incidents");
  });
  it("활성 칩에 aria-pressed=true", () => {
    render(<FeedChips active="services" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /서비스/ })).toHaveAttribute("aria-pressed", "true");
  });
});
```

### Step 4: FeedChips.tsx 구현 (GREEN)

```tsx
// FeedChips.tsx
"use client";

import type { FeedDomain } from "./feed";

export type FeedFilter = FeedDomain | "all";

type Counts = Record<"all" | FeedDomain, number>;

const ORDER: { key: FeedFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "incidents", label: "사고" },
  { key: "todos", label: "내 할일" },
  { key: "services", label: "서비스" },
  { key: "schedule", label: "일정" },
  { key: "backup", label: "백업" },
];

type Props = {
  active: FeedFilter;
  counts: Counts;
  onChange: (next: FeedFilter) => void;
};

export function FeedChips({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((c) => {
        const isActive = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(c.key)}
            className={
              isActive
                ? "border border-vermilion bg-vermilion px-2.5 py-1 text-xs text-cream"
                : "border border-line bg-cream px-2.5 py-1 text-xs text-ink hover:bg-washi-raised"
            }
          >
            {c.label} {counts[c.key]}
          </button>
        );
      })}
    </div>
  );
}
```

### Step 5: 커밋

```bash
git add src/app/dashboard/_components/live/FeedRow.tsx src/app/dashboard/_components/live/FeedChips.tsx src/app/dashboard/_components/live/__tests__/FeedRow.test.tsx src/app/dashboard/_components/live/__tests__/FeedChips.test.tsx
git commit -m "feat: 통합 피드 행/칩 컴포넌트 추가"
```

---

## Task 5: LiveOverview 합성 (TDD)

상단 LivePageHeader + KPI 타일 grid + 피드 칩 + 피드 + 인스펙터 슬라이드.

**Files:**
- Create: `LiveOverview.tsx` + 테스트

### Step 1: 테스트 (RED)

```tsx
// __tests__/LiveOverview.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveOverview } from "../LiveOverview";
import type { FeedItem } from "../feed";

const tiles = [
  { variant: "services" as never, label: "서비스", count: 5, countSub: "오픈 예정", href: "/dashboard/services" },
  { variant: "incidents" as never, label: "사고", count: 0, countSub: "registered", href: "/dashboard/incidents" },
];

const items: FeedItem[] = [
  { id: "i1", domain: "incidents", domainLabel: "사고", variant: "incidents" as never, date: "2026-05-22", dateDisplay: "미해결", title: "결제 오류", tier: "urgent", listRow: { id: "i1" } as never },
  { id: "s1", domain: "services", domainLabel: "서비스", variant: "services" as never, date: "2026-05-25", dateDisplay: "5.25", title: "A대 원서접수", tier: "scheduled", listRow: { id: "s1" } as never },
];

describe("LiveOverview", () => {
  it("타일과 피드 행 모두 렌더", () => {
    render(<LiveOverview mine={true} tiles={tiles} feedItems={items} />);
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
    expect(screen.getByText("A대 원서접수")).toBeInTheDocument();
  });
  it("칩으로 도메인 필터 시 다른 도메인 행 제거", () => {
    render(<LiveOverview mine={true} tiles={tiles} feedItems={items} />);
    fireEvent.click(screen.getByRole("button", { name: /^사고/ }));
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
    expect(screen.queryByText("A대 원서접수")).toBeNull();
  });
  it("피드 빈 → empty 메시지", () => {
    render(<LiveOverview mine={true} tiles={tiles} feedItems={[]} />);
    expect(screen.getByText(/예정된 항목이 없습니다/)).toBeInTheDocument();
  });
});
```

### Step 2: LiveOverview.tsx 구현 (GREEN)

```tsx
// LiveOverview.tsx
"use client";

import { useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { LivePageHeader } from "./LivePageHeader";
import { KpiTile } from "./KpiTile";
import { FeedChips, type FeedFilter } from "./FeedChips";
import { FeedRow } from "./FeedRow";
import type { FeedItem, FeedDomain } from "./feed";

export type KpiTileConfig = {
  variant: Variant;
  label: string;
  count: number | null;
  countSub: string;
  href: string;
};

type Props = {
  mine: boolean;
  tiles: KpiTileConfig[];
  feedItems: FeedItem[];
};

export function LiveOverview({ mine, tiles, feedItems }: Props) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [selected, setSelected] = useState<{ variant: Variant; row: ListRow } | null>(null);

  const counts = useMemo(() => {
    const c: Record<"all" | FeedDomain, number> = {
      all: feedItems.length,
      incidents: 0, todos: 0, services: 0, schedule: 0, backup: 0,
    };
    for (const it of feedItems) c[it.domain] += 1;
    return c;
  }, [feedItems]);

  const visible = useMemo(
    () => (filter === "all" ? feedItems : feedItems.filter((x) => x.domain === filter)),
    [filter, feedItems],
  );

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title="실시간 현황" />
      <div
        className={`flex-1 overflow-y-auto bg-cream px-6 py-6 transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          selected ? "md:pr-[400px]" : ""
        }`}
      >
        <div className="mx-auto max-w-[1400px] space-y-6">
          <section
            aria-label="KPI 타일"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
          >
            {tiles.map((t) => (
              <KpiTile
                key={t.variant + t.label}
                label={t.label}
                count={t.count}
                countSub={t.countSub}
                href={t.href}
              />
            ))}
          </section>
          <FeedChips active={filter} counts={counts} onChange={setFilter} />
          <section aria-label="우선순위 피드" className="border-t border-line">
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                예정된 항목이 없습니다.
              </p>
            ) : (
              visible.map((it) => (
                <FeedRow
                  key={it.id}
                  item={it}
                  onSelect={(item) => setSelected({ variant: item.variant, row: item.listRow })}
                />
              ))
            )}
          </section>
        </div>
      </div>

      <InspectorPanel open={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <InspectorChrome row={selected.row} editing={false} onToggleEdit={() => {}} editable={false}>
            <InspectorListBody
              row={selected.row}
              editing={false}
              onSave={() => {}}
              onCancel={() => {}}
              variant={selected.variant}
            />
          </InspectorChrome>
        ) : null}
      </InspectorPanel>
    </div>
  );
}
```

### Step 3: 커밋

```bash
git add src/app/dashboard/_components/live/LiveOverview.tsx src/app/dashboard/_components/live/__tests__/LiveOverview.test.tsx
git commit -m "feat: LiveOverview 합성 컴포넌트 (타일+칩+피드+인스펙터)"
```

---

## Task 6: page.tsx wiring

기존 9 도메인 fetch 유지. 출력만 `tiles[]` + `feedItems[]`로 변환 후 `<LiveOverview/>` 렌더.

**Files:**
- Modify: `src/app/dashboard/page.tsx`

### Step 1: page.tsx 재작성

기존 import 유지(LiveDashboard 제거, LiveOverview import 추가, feed/buildFeedItems/sortFeedItems import). 타일 9개 빌드 + 피드 소스 5개 빌드:

```ts
import { LiveOverview, type KpiTileConfig } from "./_components/live/LiveOverview";
import { buildFeedItems, sortFeedItems, type FeedSources } from "./_components/live/feed";
```

타일 배열:
```ts
const tiles: KpiTileConfig[] = [
  { variant: "services",     label: "서비스",      count: servicesUpcomingCount, countSub: mine ? "내 담당 · 오픈 예정" : "오픈 예정",      href: "/dashboard/services" },
  { variant: "contracts",    label: "계약",        count: contractsCount,        countSub: mine ? "내 계약" : "registered",                  href: "/dashboard/contracts" },
  { variant: "receivables",  label: "미수채권",    count: receivablesCount,      countSub: mine ? "내 발송" : "pending",                     href: "/dashboard/receivables" },
  { variant: "incidents",    label: "사고",        count: incidentsTotal,        countSub: mine ? "내가 등록/담당" : "registered",            href: "/dashboard/incidents" },
  { variant: "backup",       label: "백업",        count: backupCount,           countSub: mine ? "내가 요청/백업자" : "registered",          href: "/dashboard/backup" },
  { variant: "contacts",     label: "대학연락처",  count: contactsTotal,         countSub: mine ? "내 대학 연락처" : "registered",            href: "/dashboard/contacts" },
  { variant: "weekly-todo",  label: "내 할일",     count: todosCount,            countSub: "미완",                                            href: "/dashboard/my-todo" },
  { variant: "schedule",     label: "일정",        count: scheduleCount,         countSub: mine ? "내 일정 · 예정" : "예정",                  href: "/dashboard/schedule" },
  { variant: "worklog",      label: "활동로그",    count: worklog.length,        countSub: mine ? "내 활동" : "최근",                         href: "/dashboard/worklog" },
];
```

피드 소스(기존 변수 재사용, FeedSources 형태로 변환):
```ts
const feedSources: FeedSources = {
  incidents: incidents.map((i) => ({
    id: i.id,
    title: i.title,
    occurred_date: i.occurred_date ?? i.created_at,
    status: i.status ?? "미처리",
    listRow: incidentsListRows.find((r) => r.id === i.id)!,
  })),
  todos: undoneTodos.map((t) => ({
    id: t.id,
    title: t.title,
    due_at: t.due_at ?? null,
    listRow: todosListRows.find((r) => r.id === t.id) ?? todoToListRow(t),
  })),
  services: servicesUpcoming.map((s) => ({
    id: s.id,
    title: `${s.university_name} · ${s.service_name}`,
    write_start_at: s.write_start_at,
    listRow: servicesListRows.find((r) => r.id === s.id) ?? servicesRowToListRow(s),
  })),
  schedule: upcomingEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start_at: e.start_at,
    listRow: scheduleListRows.find((r) => r.id === e.id) ?? eventToListRow(e),
  })),
  backup: backupsFiltered.slice(0, 10).map((b) => ({
    id: b.id,
    title: b.summary_md.slice(0, 30),
    leave_start_date: b.leave_start_date ?? null,
    listRow: backupListRows.find((r) => r.id === b.id)!,
  })),
};

const feedItems = sortFeedItems(buildFeedItems(feedSources)).slice(0, 20);
```

렌더:
```tsx
return <LiveOverview mine={mine} tiles={tiles} feedItems={feedItems} />;
```

기존 LiveDashboard/그룹 구성 코드 제거. todos는 `undoneTodos` 전체에서 5개 슬라이스 했지만 피드용은 5개 한정 → 전체 `undoneTodos`를 피드 소스로 사용해 정렬 후 cap에서 자르도록 변경 (overdue 누락 방지).

### Step 2: 검증

```bash
npm run typecheck && npm run lint && npm test && unset NODE_ENV && npm run build
```

전부 통과 확인.

### Step 3: 커밋

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: /dashboard 실시간 현황을 KPI 타일 + 통합 피드로 재구성"
```

---

## Task 7: dead 컴포넌트 제거 (surgical)

LiveDashboard/LiveCard/SimpleTable + 각 테스트 삭제. 다른 사용처가 없음을 grep + typecheck로 확인.

**Steps:**

### Step 1: 사용처 grep

```bash
grep -rln "LiveDashboard\|LiveCard\|SimpleTable" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

기대: `_components/live/` 안 + (Task 6 이후 page.tsx에서 제거됨) 외에는 결과 없음. 있으면 BLOCKED 보고.

### Step 2: 삭제

```bash
git rm \
  src/app/dashboard/_components/live/LiveDashboard.tsx \
  src/app/dashboard/_components/live/LiveCard.tsx \
  src/app/dashboard/_components/live/SimpleTable.tsx \
  src/app/dashboard/_components/live/__tests__/LiveDashboard.test.tsx \
  src/app/dashboard/_components/live/__tests__/LiveCard.test.tsx \
  src/app/dashboard/_components/live/__tests__/SimpleTable.test.tsx
```
(존재하는 파일만 — 사전에 `ls`로 확인)

### Step 3: 검증

```bash
npm run typecheck && npm run lint && npm test && unset NODE_ENV && npm run build
```

### Step 4: 커밋

```bash
git commit -m "refactor: 미사용 LiveDashboard/LiveCard/SimpleTable 제거"
```

---

## Self-Review

- **Spec 커버리지**:
  - 9 KPI 타일 ✅ Task 3 + Task 6
  - 라벨↑+큰 숫자(em-기반)↓ ✅ Task 3 (3.2em)
  - 카운트업·reduced-motion ✅ Task 2
  - 통합 피드 5도메인 + 정렬·티어 ✅ Task 1
  - 칩 필터 + 건수 ✅ Task 4
  - 인스펙터 슬라이드 유지 ✅ Task 5
  - LivePageHeader · mine 토글 유지 ✅ Task 5/6
  - dead 정리 ✅ Task 7

- **Placeholder**: 없음. 모든 코드 스니펫이 실제 값/시그니처 포함.

- **타입 일관성**: `FeedItem` Task 1↔4↔5 / `KpiTileConfig` Task 5↔6 / `FeedFilter` Task 4↔5 / `Variant` 기존 union 재사용.

- **리스크**:
  1. 카운트업 컴포넌트의 react-compiler 룰 — useState+useEffect+rAF가 위반 시 implementer가 `useSyncExternalStore` 또는 ref-기반 텍스트 업데이트로 전환 (memory: hydration-mismatch-lint-block 참고)
  2. page.tsx의 row-mapper find()는 O(N×M) — 5도메인 합쳐도 N≤50 수준이라 무시. 더 커지면 idMap으로 전환.
  3. backup 데이터의 leave_start_date null이면 undated → 피드 하단. 운영상 자연스러움 확인 필요.
