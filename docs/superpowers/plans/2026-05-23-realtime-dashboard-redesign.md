# 실시간 현황 재설계 Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 레퍼런스(`design-ref/realtime_dashboard.html`)를 따라 `/dashboard` 좌측 main panel(헤더 / 대형 KPI 3 / 중소 그룹 / 정식 테이블)을 재구성. 우측 sidebar는 Phase 2.

**Architecture:** 새 atom 컴포넌트 6개(Sparkline/KpiProgressBar/DomainBadge/LiveIndicator/MetricSubcard/SegmentToggle) → 조합 5개(KpiCardLarge/MetricGroupBox/FilterTabs/LiveTable + buildLiveTableItems) → 합성 2개(LivePageHeader 재설계, LiveOverview 재작성) → page.tsx wiring → 기존 dead 제거.

**Tech:** Next.js 16 / React 19 / Tailwind v4 / Vitest + RTL / Folio design tokens.

**Spec:** `docs/superpowers/specs/2026-05-23-realtime-dashboard-redesign-design.md`

---

## File Structure

**Create (atoms · 6):**
- `_components/live/Sparkline.tsx` + `__tests__`
- `_components/live/KpiProgressBar.tsx` + `__tests__`
- `_components/live/DomainBadge.tsx` + `__tests__`
- `_components/live/LiveIndicator.tsx` + `__tests__`
- `_components/live/SegmentToggle.tsx` + `__tests__`
- `_components/live/MetricSubcard.tsx` + `__tests__`

**Create (조합 · 4):**
- `_components/live/KpiCardLarge.tsx` + `__tests__`
- `_components/live/MetricGroupBox.tsx` + `__tests__`
- `_components/live/FilterTabs.tsx` + `__tests__`
- `_components/live/LiveTable.tsx` + `__tests__`

**Create (util · 1):**
- `_components/live/live-table-builder.ts` + `__tests__` (도메인 → LiveTableItem)
- `src/lib/format-relative-time.ts` + `__tests__`

**Modify:**
- `src/lib/design-tokens.ts` (indigo·amber 추가)
- `tailwind.config.ts` (token expose)
- `src/app/globals.css` (live-pulse keyframes)
- `_components/live/LivePageHeader.tsx` (재설계)
- `_components/live/LiveOverview.tsx` (재작성)
- `src/app/dashboard/page.tsx` (wiring)

**Delete (Phase 1 dead):**
- `_components/live/KpiTile.tsx` + 테스트
- `_components/live/FeedRow.tsx` + 테스트
- `_components/live/FeedChips.tsx` + 테스트
- `_components/live/feed.ts` + 테스트 (live-table-builder로 대체)

---

## Task 1: 디자인 토큰 추가 (indigo · amber)

**Files:** `src/lib/design-tokens.ts`, `tailwind.config.ts` (또는 globals.css의 @theme)

### Step 1: 토큰 추가
`design-tokens.ts`의 컬러 export에 추가 (기존 패턴 유지):
```ts
indigo: '#2a4365',
amber: '#d97706',
```

`tailwind.config.ts`(또는 v4의 `globals.css` `@theme`)에서 expose. Folio 기존 패턴 따르세요.

### Step 2: 검증
- `npm run typecheck` clean
- `npm run lint` clean
- `<div className="bg-indigo text-amber">` 형태로 빌드되는지 빠른 sanity check (test 안 작성 — 설정 변경)

### Step 3: 커밋
```
git add src/lib/design-tokens.ts tailwind.config.ts (or src/app/globals.css)
git commit -m "feat: indigo·amber 디자인 토큰 추가 (실시간 현황 도메인 badge용)"
```

---

## Task 2: format-relative-time 유틸 (TDD)

**Files:**
- Create: `src/lib/format-relative-time.ts`
- Test: `src/lib/__tests__/format-relative-time.test.ts`

### Step 1: 테스트 (RED)
```ts
import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "../format-relative-time";

const now = new Date("2026-05-23T12:00:00+09:00");

describe("formatRelativeTime", () => {
  it("30초 전 → 방금 전", () => {
    expect(formatRelativeTime(new Date("2026-05-23T11:59:30+09:00").toISOString(), now)).toBe("방금 전");
  });
  it("5분 전 → 5분 전", () => {
    expect(formatRelativeTime(new Date("2026-05-23T11:55:00+09:00").toISOString(), now)).toBe("5분 전");
  });
  it("2시간 전 → 2시간 전", () => {
    expect(formatRelativeTime(new Date("2026-05-23T10:00:00+09:00").toISOString(), now)).toBe("2시간 전");
  });
  it("3일 전 → 3일 전", () => {
    expect(formatRelativeTime(new Date("2026-05-20T12:00:00+09:00").toISOString(), now)).toBe("3일 전");
  });
  it("미래 시각 → 방금 전 (clamp)", () => {
    expect(formatRelativeTime(new Date("2026-05-23T12:05:00+09:00").toISOString(), now)).toBe("방금 전");
  });
  it("null/빈 입력 → —", () => {
    expect(formatRelativeTime(null, now)).toBe("—");
    expect(formatRelativeTime("", now)).toBe("—");
  });
});
```

Run → 6개 모두 RED.

### Step 2: 구현 (GREEN)
```ts
export function formatRelativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = now.getTime() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "방금 전";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}
```

Run → 6/6 pass.

### Step 3: 검증 + 커밋
```
git add src/lib/format-relative-time.ts src/lib/__tests__/format-relative-time.test.ts
git commit -m "feat: formatRelativeTime 유틸 추가 (방금 전/N분/시간/일)"
```

---

## Task 3: Sparkline 컴포넌트 (TDD)

**Files:**
- Create: `_components/live/Sparkline.tsx` + `__tests__/Sparkline.test.tsx`

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Sparkline } from "../Sparkline";

describe("Sparkline", () => {
  it("d prop으로 SVG path 렌더", () => {
    const { container } = render(<Sparkline d="M 0,30 L 100,2" />);
    const path = container.querySelector("svg path");
    expect(path?.getAttribute("d")).toBe("M 0,30 L 100,2");
  });
  it("variant 'neutral'이면 stroke ink, default는 vermilion", () => {
    const { container, rerender } = render(<Sparkline d="M 0,0" />);
    expect(container.querySelector("svg")?.className.baseVal).toMatch(/stroke-vermilion/);
    rerender(<Sparkline d="M 0,0" variant="neutral" />);
    expect(container.querySelector("svg")?.className.baseVal).toMatch(/stroke-ink/);
  });
});
```

Run → RED.

### Step 2: 구현 (GREEN)
```tsx
type Props = { d: string; variant?: "danger" | "neutral" };

/** 미니 스파크라인 — 정적 path (Phase 1 mock).
 *  variant 'danger' (default, vermilion) | 'neutral' (ink). */
export function Sparkline({ d, variant = "danger" }: Props) {
  const stroke = variant === "neutral" ? "stroke-ink" : "stroke-vermilion";
  return (
    <svg viewBox="0 0 100 40" className={`h-10 w-[100px] ${stroke}`} fill="none">
      <path d={d} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
```

Run → pass.

### Step 3: 커밋
```
git add _components/live/Sparkline.tsx __tests__/Sparkline.test.tsx
git commit -m "feat: Sparkline 컴포넌트 (SVG path + danger/neutral 변종)"
```

---

## Task 4: KpiProgressBar (TDD)

**Files:** `_components/live/KpiProgressBar.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { render, screen } from "@testing-library/react";
import { KpiProgressBar } from "../KpiProgressBar";

describe("KpiProgressBar", () => {
  it("done/total 표시 + width % 계산", () => {
    const { container } = render(<KpiProgressBar done={2} total={10} />);
    expect(screen.getByText("2 / 10")).toBeInTheDocument();
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill?.style.width).toBe("20%");
  });
  it("total=0이면 0% (분모 0 방어)", () => {
    const { container } = render(<KpiProgressBar done={0} total={0} />);
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill?.style.width).toBe("0%");
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
type Props = { done: number; total: number };

/** 가로 progress bar — done/total 분수 + width % 채움. */
export function KpiProgressBar({ done, total }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex w-[100px] flex-col gap-1">
      <div className="text-right text-[10px] font-bold tabular-nums text-ink">
        {done} / {total}
      </div>
      <div className="h-1.5 w-full border border-ink bg-line-soft overflow-hidden">
        <div
          data-progress-fill
          className="h-full bg-ink transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

(인라인 style은 동적 width에 한정 — 토큰화 불가능한 동적 값이므로 허용. 주석 추가.)

Step 3: 커밋
```
git add _components/live/KpiProgressBar.tsx __tests__/KpiProgressBar.test.tsx
git commit -m "feat: KpiProgressBar 컴포넌트 (done/total + width% 채움)"
```

---

## Task 5: DomainBadge (TDD)

**Files:** `_components/live/DomainBadge.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { render } from "@testing-library/react";
import { DomainBadge } from "../DomainBadge";

describe("DomainBadge", () => {
  it("5 도메인별 색상 클래스", () => {
    const cases = [
      { domain: "사고",   color: /text-vermilion/ },
      { domain: "할일",   color: /text-ink(?!-)/ },
      { domain: "서비스", color: /text-ink-muted/ },
      { domain: "백업",   color: /text-indigo/ },
      { domain: "일정",   color: /text-amber/ },
    ] as const;
    for (const c of cases) {
      const { container } = render(<DomainBadge domain={c.domain} />);
      expect(container.firstChild).toHaveClass(...) // → use className regex 검증
    }
  });
});
```
(실제로는 단순화: `getByText(domain)`이 해당 클래스 매칭하는지 className에 regex match. 위 코드는 가이드 — implementer가 깔끔하게 작성)

### Step 2: 구현 (GREEN)
```tsx
type Props = { domain: "사고" | "할일" | "서비스" | "백업" | "일정" };

const COLOR: Record<Props["domain"], string> = {
  사고: "border-vermilion text-vermilion",
  할일: "border-ink text-ink",
  서비스: "border-ink-muted text-ink-muted",
  백업: "border-indigo text-indigo",
  일정: "border-amber text-amber",
};

/** 도메인별 색상 정체성 badge. 5종. */
export function DomainBadge({ domain }: Props) {
  return (
    <span className={`inline-block min-w-[54px] border px-1.5 py-0.5 text-center text-[11px] font-bold ${COLOR[domain]}`}>
      {domain}
    </span>
  );
}
```

Step 3: 커밋
```
git commit -m "feat: DomainBadge 컴포넌트 (5 도메인 색상 변종)"
```

---

## Task 6: LiveIndicator (TDD)

`● LIVE MONITOR` 박스 + dot pulse 애니메이션.

Pulse 애니메이션은 `globals.css`에 `@keyframes live-pulse` 추가하고 컴포넌트에서 `animate-[live-pulse_1.8s_ease-in-out_infinite]` arbitrary value로 사용 + 인접 주석으로 일회성 의도 명시.

**Files:** `_components/live/LiveIndicator.tsx` + 테스트 + `globals.css` 추가

### Step 1: globals.css
기존 file 끝에 추가:
```css
@keyframes live-pulse {
  0%, 100% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.2); opacity: 1; }
}
```

### Step 2: 테스트 (RED)
```tsx
import { render, screen } from "@testing-library/react";
import { LiveIndicator } from "../LiveIndicator";

describe("LiveIndicator", () => {
  it("LIVE MONITOR 텍스트 + pulse 클래스", () => {
    const { container } = render(<LiveIndicator />);
    expect(screen.getByText(/LIVE MONITOR/)).toBeInTheDocument();
    const dot = container.querySelector("[data-live-dot]");
    expect(dot?.className).toMatch(/animate-\[live-pulse_/);
  });
});
```

### Step 3: 구현 (GREEN)
```tsx
/** LIVE 인디케이터 — 박스형 + LED pulse dot. */
export function LiveIndicator() {
  return (
    <span className="inline-flex items-center gap-1.5 border border-vermilion bg-vermilion/5 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-vermilion">
      {/* 일회성 애니메이션: 운영 모니터 LED pulse (globals.css @keyframes live-pulse) */}
      <span data-live-dot className="h-1.5 w-1.5 rounded-full bg-vermilion animate-[live-pulse_1.8s_ease-in-out_infinite]" />
      LIVE MONITOR
    </span>
  );
}
```

### Step 4: 커밋
```
git add src/app/globals.css _components/live/LiveIndicator.tsx __tests__/LiveIndicator.test.tsx
git commit -m "feat: LiveIndicator 박스형 인디케이터 + pulse 애니메이션"
```

---

## Task 7: SegmentToggle (TDD)

**Files:** `_components/live/SegmentToggle.tsx` + 테스트

기존 `ScopeToggle.tsx`는 다른 페이지에서 쓰일 수 있어 건드리지 않고, 실시간 현황 전용 `SegmentToggle`을 신규로.

### Step 1: 테스트 (RED)
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";

// next/navigation mock (ScopeToggle 패턴 참고)
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { SegmentToggle } from "../SegmentToggle";

describe("SegmentToggle", () => {
  it("'전체 관점'과 '내 업무만' 버튼 렌더", () => {
    render(<SegmentToggle mine={false} />);
    expect(screen.getByRole("button", { name: "전체 관점" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "내 업무만" })).toBeInTheDocument();
  });
  it("mine=true일 때 '내 업무만'에 active 스타일", () => {
    render(<SegmentToggle mine={true} />);
    expect(screen.getByRole("button", { name: "내 업무만" })).toHaveClass("bg-ink");
  });
  it("클릭 시 push 호출 (URL ?mine= 토글)", () => {
    push.mockClear();
    render(<SegmentToggle mine={false} />);
    fireEvent.click(screen.getByRole("button", { name: "내 업무만" }));
    expect(push).toHaveBeenCalled();
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Props = { mine: boolean };

export function SegmentToggle({ mine }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function go(next: boolean) {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set("mine", "true");
    else sp.delete("mine");
    router.push(`${pathname}?${sp.toString()}`);
  }

  const baseBtn = "font-sans text-[13px] font-semibold px-4 py-1.5 transition-colors";
  const active = "bg-ink text-cream";
  const inactive = "bg-transparent text-ink hover:bg-washi-raised";

  return (
    <div className="inline-flex border border-ink p-0.5">
      <button type="button" onClick={() => go(false)} className={`${baseBtn} ${!mine ? active : inactive}`}>
        전체 관점
      </button>
      <button type="button" onClick={() => go(true)} className={`${baseBtn} ${mine ? active : inactive}`}>
        내 업무만
      </button>
    </div>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: SegmentToggle (실시간 현황 전용 세그먼트 토글)"
```

---

## Task 8: MetricSubcard (TDD)

**Files:** `_components/live/MetricSubcard.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { render, screen } from "@testing-library/react";
import { MetricSubcard } from "../MetricSubcard";

describe("MetricSubcard", () => {
  it("label / value / desc 렌더", () => {
    render(<MetricSubcard label="체결 계약" value="12" desc="체결 진행중" />);
    expect(screen.getByText("체결 계약")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("체결 진행중")).toBeInTheDocument();
  });
  it("active=true일 때 value vermilion", () => {
    const { container } = render(<MetricSubcard label="미수 채권" value="3" desc="x" active />);
    expect(container.querySelector("[data-subcard-value]")?.className).toMatch(/text-vermilion/);
  });
  it("active=false일 때 value ink", () => {
    const { container } = render(<MetricSubcard label="x" value="0" desc="x" />);
    expect(container.querySelector("[data-subcard-value]")?.className).toMatch(/text-ink(?!-)/);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
type Props = { label: string; value: string | number; desc: string; active?: boolean };

/** 중소 그룹 박스 안의 sub 카드. active=true면 value vermilion. */
export function MetricSubcard({ label, value, desc, active = false }: Props) {
  const valueColor = active ? "text-vermilion" : "text-ink";
  return (
    <div className="flex flex-col gap-1 border border-line-soft bg-washi-raised px-3.5 py-3 transition-colors hover:border-ink hover:bg-washi">
      <span className="text-xs font-semibold text-ink-muted">{label}</span>
      <span data-subcard-value className={`text-[26px] font-bold leading-tight tabular-nums ${valueColor}`}>
        {value}
      </span>
      <span className="text-[11px] text-ink-muted">{desc}</span>
    </div>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: MetricSubcard 컴포넌트 (active=vermilion 변종)"
```

---

## Task 9: MetricGroupBox (TDD)

**Files:** `_components/live/MetricGroupBox.tsx` + 테스트

label + section-title vermilion dot + children grid.

### Step 1: 테스트 (RED)
```tsx
import { render, screen } from "@testing-library/react";
import { MetricGroupBox } from "../MetricGroupBox";

describe("MetricGroupBox", () => {
  it("title 렌더 + 자식 grid 안에 표시", () => {
    render(<MetricGroupBox title="재정 및 영업 행정" columns={2}><div>A</div><div>B</div></MetricGroupBox>);
    expect(screen.getByText("재정 및 영업 행정")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("B")).toBeInTheDocument();
  });
  it("columns=3 클래스 적용", () => {
    const { container } = render(<MetricGroupBox title="x" columns={3}><div /></MetricGroupBox>);
    expect(container.querySelector("[data-subgrid]")?.className).toMatch(/grid-cols-3/);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
type Props = { title: string; columns: 2 | 3; children: React.ReactNode };

/** 그룹 박스: 섹션 타이틀(vermilion dot) + sub grid (2 or 3열). */
export function MetricGroupBox({ title, columns, children }: Props) {
  const cols = columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className="border border-ink bg-cream p-4">
      <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
        <span className="inline-block h-1.5 w-1.5 bg-vermilion" />
        {title}
      </h3>
      <div data-subgrid className={`grid gap-2.5 ${cols}`}>
        {children}
      </div>
    </div>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: MetricGroupBox (섹션 타이틀 vermilion dot + sub grid)"
```

---

## Task 10: KpiCardLarge (TDD)

**Files:** `_components/live/KpiCardLarge.tsx` + 테스트

대형 KPI 카드 — label / trend-tag / 큰 숫자 (CountUp) / 우측 시각화 슬롯 (sparkline 또는 progress) / footer.

### Step 1: 테스트 (RED)
```tsx
import { render, screen } from "@testing-library/react";
import { KpiCardLarge } from "../KpiCardLarge";

function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: true, addEventListener:()=>{}, removeEventListener:()=>{}, addListener:()=>{}, removeListener:()=>{}, dispatchEvent:()=>false }) });
}

describe("KpiCardLarge", () => {
  beforeEach(() => mockReducedMotion());

  it("label / trend / number / footer 렌더", () => {
    render(
      <KpiCardLarge
        label="미해결 사고 현황"
        trend="실시간 경보"
        trendDanger
        count={3}
        numberDanger
        footer="전체 관리 대상 중 즉각 조치 필요 건수"
        right={<div data-slot>SPK</div>}
      />,
    );
    expect(screen.getByText("미해결 사고 현황")).toBeInTheDocument();
    expect(screen.getByText("실시간 경보")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/즉각 조치 필요/)).toBeInTheDocument();
  });
  it("numberDanger=true → 숫자 vermilion", () => {
    const { container } = render(<KpiCardLarge label="x" trend="x" count={1} numberDanger footer="x" />);
    expect(container.querySelector("[data-kpi-number]")?.className).toMatch(/text-vermilion/);
  });
  it("trendDanger=true → trend tag vermilion border/text", () => {
    const { container } = render(<KpiCardLarge label="x" trend="경보" trendDanger count={0} footer="x" />);
    const tag = container.querySelector("[data-trend-tag]");
    expect(tag?.className).toMatch(/border-vermilion/);
    expect(tag?.className).toMatch(/text-vermilion/);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { CountUp } from "./CountUp";

type Props = {
  label: string;
  trend: string;
  trendDanger?: boolean;
  count: number;
  numberDanger?: boolean;
  footer: string;
  right?: React.ReactNode;
  delayMs?: number;
};

/** 대형 KPI 카드 — label↑ + trend tag / 큰 숫자 + 우측 슬롯 / 점선 구분 / footer. */
export function KpiCardLarge({ label, trend, trendDanger = false, count, numberDanger = false, footer, right, delayMs = 0 }: Props) {
  const numberColor = numberDanger ? "text-vermilion" : "text-ink";
  const trendColor = trendDanger ? "border-vermilion text-vermilion" : "border-ink text-ink-soft";

  return (
    <div className="flex min-h-[140px] flex-col justify-between border border-ink bg-washi-raised p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="mb-3 flex items-start justify-between">
        <span className="text-[13px] font-bold tracking-[-0.01em] text-ink-soft">{label}</span>
        <span data-trend-tag className={`border bg-cream px-1.5 py-0.5 text-[11px] font-bold ${trendColor}`}>
          {trend}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span data-kpi-number className={`text-[48px] font-extrabold leading-none tabular-nums ${numberColor}`}>
          <CountUp value={count} delayMs={delayMs} />
        </span>
        {right ?? null}
      </div>
      <div className="mt-3 border-t border-dashed border-line-soft pt-2 text-xs text-ink-muted">
        {footer}
      </div>
    </div>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: KpiCardLarge (label/trend/큰 숫자+카운트업/우측 슬롯/footer)"
```

---

## Task 11: FilterTabs (TDD)

**Files:** `_components/live/FilterTabs.tsx` + 테스트

5탭 + pill 건수, active=vermilion.

### Step 1: 테스트 (RED)
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { FilterTabs } from "../FilterTabs";

describe("FilterTabs", () => {
  const counts = { all: 12, incidents: 5, todos: 2, services: 5, backup: 0 };
  it("5탭 + 각 건수 pill 렌더", () => {
    render(<FilterTabs active="all" counts={counts} onChange={() => {}} />);
    expect(screen.getByRole("button", { name: /전체 내역.*12/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /사고 경보.*5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /내 할일.*2/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /오픈 서비스.*5/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /백업.*0/ })).toBeInTheDocument();
  });
  it("active 탭은 vermilion bg+cream text", () => {
    render(<FilterTabs active="incidents" counts={counts} onChange={() => {}} />);
    const tab = screen.getByRole("button", { name: /사고 경보/ });
    expect(tab.className).toMatch(/bg-vermilion/);
    expect(tab.className).toMatch(/text-cream/);
  });
  it("클릭 시 onChange", () => {
    const fn = vi.fn();
    render(<FilterTabs active="all" counts={counts} onChange={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /백업/ }));
    expect(fn).toHaveBeenCalledWith("backup");
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

export type LiveFilter = "all" | "incidents" | "todos" | "services" | "backup";
type Counts = Record<LiveFilter, number>;

const ORDER: { key: LiveFilter; label: string }[] = [
  { key: "all", label: "전체 내역" },
  { key: "incidents", label: "사고 경보" },
  { key: "todos", label: "내 할일" },
  { key: "services", label: "오픈 서비스" },
  { key: "backup", label: "백업/일정" },
];

type Props = { active: LiveFilter; counts: Counts; onChange: (next: LiveFilter) => void };

export function FilterTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDER.map((t) => {
        const isActive = active === t.key;
        const cls = isActive
          ? "border border-vermilion bg-vermilion px-3 py-1 text-xs font-semibold text-cream"
          : "border border-line-soft bg-transparent px-3 py-1 text-xs font-semibold text-ink-soft hover:border-ink hover:bg-washi-raised";
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} className={cls}>
            {t.label} <span className="ml-1 tabular-nums">{counts[t.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: FilterTabs 5탭 + pill 건수 + active vermilion"
```

---

## Task 12: live-table-builder + LiveTable (TDD)

순수 빌더 + 테이블 컴포넌트.

**Files:**
- `_components/live/live-table-builder.ts` + `__tests__`
- `_components/live/LiveTable.tsx` + `__tests__`

### Step 1: 빌더 테스트 (RED)
```ts
import { describe, it, expect } from "vitest";
import { buildLiveTableItems, type LiveTableSources, type LiveTableItem } from "../live-table-builder";

const now = new Date("2026-05-23T12:00:00+09:00");
const tEarlier = (mins: number) => new Date(now.getTime() - mins * 60 * 1000).toISOString();

describe("buildLiveTableItems", () => {
  it("incidents/todos/services/backup/schedule 통합 + 시간 desc 정렬", () => {
    const items = buildLiveTableItems({
      incidents: [{ id: "i1", title: "결제 오류", status: "미처리", createdAt: tEarlier(5), listRow: {} as never }],
      todos: [{ id: "t1", title: "PDF 검토", dueAt: "2026-05-22", createdAt: tEarlier(60), listRow: {} as never }],
      services: [{ id: "s1", title: "A대 원서접수", writeStartAt: "2026-06-24", createdAt: tEarlier(180), listRow: {} as never }],
      backup: [{ id: "b1", title: "휴가 백업", status: "대기", createdAt: tEarlier(30), listRow: {} as never }],
      schedule: [{ id: "e1", title: "정기회의", startAt: "2026-05-24T05:00:00Z", createdAt: tEarlier(10), listRow: {} as never }],
    }, now);
    expect(items.map((i) => i.id)).toEqual(["i1", "e1", "b1", "t1", "s1"]); // 시간 가까운 순
    expect(items.find((i) => i.id === "i1")?.badgeDomain).toBe("사고");
    expect(items.find((i) => i.id === "i1")?.statusText).toBe("미처리");
    expect(items.find((i) => i.id === "s1")?.statusText).toBe("6.24 오픈");
    expect(items.find((i) => i.id === "t1")?.statusText).toBe("지남");
    expect(items.find((i) => i.id === "e1")?.statusText).toMatch(/5\.24/);
  });
});
```

### Step 2: 빌더 구현 (GREEN)
```ts
import type { ListRow } from "../patterns/ListPattern";
import type { Variant } from "../inspector/list-variants/types";
import { formatRelativeTime } from "@/lib/format-relative-time";

export type LiveTableDomain = "incidents" | "todos" | "services" | "backup" | "schedule";
export type LiveBadgeDomain = "사고" | "할일" | "서비스" | "백업" | "일정";

export type LiveTableItem = {
  id: string;
  domain: LiveTableDomain;
  badgeDomain: LiveBadgeDomain;
  variant: Variant;
  statusText: string;
  title: string;
  timeText: string;
  occurredAt: string;
  listRow: ListRow;
};

export type LiveTableSources = {
  incidents: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  todos: { id: string; title: string; dueAt: string | null; createdAt: string; listRow: ListRow }[];
  services: { id: string; title: string; writeStartAt: string | null; createdAt: string; listRow: ListRow }[];
  backup: { id: string; title: string; status: string; createdAt: string; listRow: ListRow }[];
  schedule: { id: string; title: string; startAt: string; createdAt: string; listRow: ListRow }[];
};

const BADGE: Record<LiveTableDomain, LiveBadgeDomain> = {
  incidents: "사고", todos: "할일", services: "서비스", backup: "백업", schedule: "일정",
};
const VARIANT: Record<LiveTableDomain, Variant> = {
  incidents: "incidents", todos: "weekly-todo", services: "services", backup: "backup", schedule: "schedule",
};

function todoStatus(dueAt: string | null, todayKst: string): string {
  if (!dueAt) return "대기";
  if (dueAt < todayKst) return "지남";
  if (dueAt === todayKst) return "오늘";
  const diff = Math.ceil((new Date(dueAt).getTime() - new Date(todayKst).getTime()) / 86400000);
  return `D-${diff}`;
}
function mdFromYmd(ymd: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  return `${Number(m[1])}.${Number(m[2])}`;
}
function todayKst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}
function startAtToMd(iso: string, now: Date): string {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
  return mdFromYmd(ymd);
}

export function buildLiveTableItems(s: LiveTableSources, now: Date = new Date()): LiveTableItem[] {
  const today = todayKst(now);
  const out: LiveTableItem[] = [];
  for (const i of s.incidents) out.push({ id: i.id, domain: "incidents", badgeDomain: BADGE.incidents, variant: VARIANT.incidents, statusText: i.status, title: i.title, timeText: formatRelativeTime(i.createdAt, now), occurredAt: i.createdAt, listRow: i.listRow });
  for (const t of s.todos) out.push({ id: t.id, domain: "todos", badgeDomain: BADGE.todos, variant: VARIANT.todos, statusText: todoStatus(t.dueAt, today), title: t.title, timeText: formatRelativeTime(t.createdAt, now), occurredAt: t.createdAt, listRow: t.listRow });
  for (const sv of s.services) out.push({ id: sv.id, domain: "services", badgeDomain: BADGE.services, variant: VARIANT.services, statusText: sv.writeStartAt ? `${mdFromYmd(sv.writeStartAt.slice(0,10))} 오픈` : "—", title: sv.title, timeText: formatRelativeTime(sv.createdAt, now), occurredAt: sv.createdAt, listRow: sv.listRow });
  for (const b of s.backup) out.push({ id: b.id, domain: "backup", badgeDomain: BADGE.backup, variant: VARIANT.backup, statusText: b.status, title: b.title, timeText: formatRelativeTime(b.createdAt, now), occurredAt: b.createdAt, listRow: b.listRow });
  for (const e of s.schedule) out.push({ id: e.id, domain: "schedule", badgeDomain: BADGE.schedule, variant: VARIANT.schedule, statusText: startAtToMd(e.startAt, now), title: e.title, timeText: formatRelativeTime(e.createdAt, now), occurredAt: e.createdAt, listRow: e.listRow });
  return out.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
```

### Step 3: LiveTable 테스트 (RED)
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { LiveTable } from "../LiveTable";
import type { LiveTableItem } from "../live-table-builder";

const items: LiveTableItem[] = [
  { id: "i1", domain: "incidents", badgeDomain: "사고", variant: "incidents", statusText: "미해결", title: "결제 오류", timeText: "방금 전", occurredAt: "2026-05-23T11:55:00+09:00", listRow: {} as never },
];

describe("LiveTable", () => {
  it("4 컬럼 헤더 + 행 렌더", () => {
    render(<LiveTable items={items} onSelect={() => {}} />);
    expect(screen.getByText("구분")).toBeInTheDocument();
    expect(screen.getByText("상태/구분")).toBeInTheDocument();
    expect(screen.getByText("운영 이벤트 내역 및 타이틀")).toBeInTheDocument();
    expect(screen.getByText("발생 시점")).toBeInTheDocument();
    expect(screen.getByText("사고")).toBeInTheDocument();
    expect(screen.getByText("미해결")).toBeInTheDocument();
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
    expect(screen.getByText("방금 전")).toBeInTheDocument();
  });
  it("빈 → empty 메시지", () => {
    render(<LiveTable items={[]} onSelect={() => {}} />);
    expect(screen.getByText(/운영 내역이 없습니다/)).toBeInTheDocument();
  });
  it("행 클릭 시 onSelect 호출", () => {
    const fn = vi.fn();
    render(<LiveTable items={items} onSelect={fn} />);
    fireEvent.click(screen.getByText("결제 오류"));
    expect(fn).toHaveBeenCalledWith(items[0]);
  });
});
```

### Step 4: LiveTable 구현 (GREEN)
```tsx
"use client";

import { DomainBadge } from "./DomainBadge";
import type { LiveTableItem } from "./live-table-builder";

type Props = { items: LiveTableItem[]; onSelect: (item: LiveTableItem) => void };

/** 정식 운영 테이블 — 구분/상태/타이틀/시점 4컬럼. 행 클릭→onSelect. */
export function LiveTable({ items, onSelect }: Props) {
  return (
    <div className="overflow-hidden border border-ink bg-washi-raised">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="w-20 border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">구분</th>
            <th className="w-24 border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">상태/구분</th>
            <th className="border-b border-ink bg-washi px-3 py-2.5 text-left text-xs font-bold text-ink-soft">운영 이벤트 내역 및 타이틀</th>
            <th className="w-28 border-b border-ink bg-washi px-3 py-2.5 text-right text-xs font-bold text-ink-soft">발생 시점</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-12 text-center text-sm text-ink-muted">
                선택한 필터 및 관점에 해당하는 운영 내역이 없습니다.
              </td>
            </tr>
          ) : (
            items.map((it) => (
              <tr
                key={it.id}
                onClick={() => onSelect(it)}
                className="cursor-pointer border-b border-line-soft bg-washi-raised transition-colors last:border-b-0 hover:bg-washi"
              >
                <td className="px-3 py-3 align-middle"><DomainBadge domain={it.badgeDomain} /></td>
                <td className="px-3 py-3 align-middle text-sm font-semibold text-ink-soft">{it.statusText}</td>
                <td className="px-3 py-3 align-middle text-sm font-medium text-ink">{it.title}</td>
                <td className="px-3 py-3 text-right align-middle text-xs text-ink-muted tabular-nums">{it.timeText}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 5: 커밋
```
git commit -m "feat: LiveTable + live-table-builder (4 컬럼 정식 테이블 + 도메인 통합 row)"
```

---

## Task 13: LivePageHeader 재설계

**Files:** `_components/live/LivePageHeader.tsx` + 테스트 (기존 파일 재작성)

LIVE 텍스트 → `<LiveIndicator />`. ScopeToggle → `<SegmentToggle />`. 타이틀 폰트/굵기 강화.

### Step 1: 테스트 (RED)
기존 테스트 그대로 통과해야 함 + 새 케이스:
```tsx
it("LIVE MONITOR 박스 인디케이터 렌더", () => {
  render(<LivePageHeader mine={false} title="실시간 운영 현황" />);
  expect(screen.getByText(/LIVE MONITOR/)).toBeInTheDocument();
});
it("세그먼트 토글 2버튼 렌더", () => {
  render(<LivePageHeader mine={false} title="x" />);
  expect(screen.getByRole("button", { name: "전체 관점" })).toBeInTheDocument();
});
```
기존 `데이터-page-accent` 테스트는 제거 (디자인 변경).

### Step 2: 구현 (GREEN)
```tsx
import { LiveIndicator } from "./LiveIndicator";
import { SegmentToggle } from "./SegmentToggle";

export function LivePageHeader({ mine, title }: { mine: boolean; title: string }) {
  return (
    <header className="flex items-center justify-between border-b-2 border-ink bg-cream px-6 pb-3 pt-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-extrabold tracking-[-0.03em] text-ink">{title}</h1>
        <LiveIndicator />
      </div>
      <SegmentToggle mine={mine} />
    </header>
  );
}
```

### Step 3: 커밋
```
git commit -m "refactor: LivePageHeader 재설계 (LiveIndicator + SegmentToggle 합성)"
```

---

## Task 14: LiveOverview 재작성

**Files:** `_components/live/LiveOverview.tsx` + 테스트

기존 합성 컴포넌트를 새 구조로 거의 다 재작성. 인스펙터 슬라이드는 유지.

### Step 1: 테스트 (RED) — 핵심 통합 케이스
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, beforeEach } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { LiveOverview, type LiveOverviewProps } from "../LiveOverview";

const baseProps: LiveOverviewProps = {
  mine: false,
  title: "실시간 운영 현황",
  kpi: {
    sago: { count: 3, sparklineD: "M 0,30 L 100,2" },
    todo: { count: 7, done: 2, total: 10 },
    service: { count: 5, sparklineD: "M 0,35 L 100,12" },
  },
  metrics: {
    contract: { value: 1, active: false, desc: "체결 진행중" },
    bond: { value: 2, active: true, desc: "미지급 고지 발송" },
    backup: { value: 0, desc: "요청 처리건" },
    contacts: { value: 5, desc: "등록된 파트너" },
    scheduleActivity: { value: "0 / 5", desc: "금주 잔여 건" },
  },
  tableItems: [],
};

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", { writable: true, value: () => ({ matches: true, addEventListener:()=>{}, removeEventListener:()=>{}, addListener:()=>{}, removeListener:()=>{}, dispatchEvent:()=>false }) });
});

describe("LiveOverview", () => {
  it("3 KPI 카드 + 2 그룹 박스 + 필터 + 테이블 렌더", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText(/미해결 사고 현황/)).toBeInTheDocument();
    expect(screen.getByText(/내 미완료 할 일/)).toBeInTheDocument();
    expect(screen.getByText(/오픈 예정 서비스/)).toBeInTheDocument();
    expect(screen.getByText(/재정 및 영업 행정/)).toBeInTheDocument();
    expect(screen.getByText(/시스템 리소스/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /전체 내역/ })).toBeInTheDocument();
    expect(screen.getByText(/운영 내역이 없습니다/)).toBeInTheDocument();
  });
  it("필터 클릭 시 칩 active 전환", () => {
    render(<LiveOverview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /사고 경보/ }));
    expect(screen.getByRole("button", { name: /사고 경보/ }).className).toMatch(/bg-vermilion/);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { LivePageHeader } from "./LivePageHeader";
import { KpiCardLarge } from "./KpiCardLarge";
import { Sparkline } from "./Sparkline";
import { KpiProgressBar } from "./KpiProgressBar";
import { MetricGroupBox } from "./MetricGroupBox";
import { MetricSubcard } from "./MetricSubcard";
import { FilterTabs, type LiveFilter } from "./FilterTabs";
import { LiveTable } from "./LiveTable";
import type { LiveTableItem } from "./live-table-builder";

export type LiveOverviewProps = {
  mine: boolean;
  title: string;
  kpi: {
    sago: { count: number; sparklineD: string };
    todo: { count: number; done: number; total: number };
    service: { count: number; sparklineD: string };
  };
  metrics: {
    contract: { value: number | string; active?: boolean; desc: string };
    bond: { value: number | string; active?: boolean; desc: string };
    backup: { value: number | string; desc: string };
    contacts: { value: number | string; desc: string };
    scheduleActivity: { value: string; desc: string };
  };
  tableItems: LiveTableItem[];
};

export function LiveOverview({ mine, title, kpi, metrics, tableItems }: LiveOverviewProps) {
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [selected, setSelected] = useState<{ variant: Variant; row: ListRow } | null>(null);

  const counts = useMemo(() => {
    const c = { all: tableItems.length, incidents: 0, todos: 0, services: 0, backup: 0 };
    for (const it of tableItems) {
      if (it.domain === "incidents") c.incidents += 1;
      else if (it.domain === "todos") c.todos += 1;
      else if (it.domain === "services") c.services += 1;
      else if (it.domain === "backup" || it.domain === "schedule") c.backup += 1;
    }
    return c;
  }, [tableItems]);

  const visible = useMemo(() => {
    if (filter === "all") return tableItems;
    if (filter === "backup") return tableItems.filter((x) => x.domain === "backup" || x.domain === "schedule");
    return tableItems.filter((x) => x.domain === filter);
  }, [filter, tableItems]);

  const todoPct = kpi.todo.total > 0 ? Math.round((kpi.todo.done / kpi.todo.total) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title={title} />
      <div
        className={`flex-1 overflow-y-auto bg-cream px-6 py-6 transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          selected ? "md:pr-[400px]" : ""
        }`}
      >
        <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
          {/* 3 KPI 대형 카드 */}
          <section aria-label="KPI 대형" className="grid gap-4 md:grid-cols-3">
            <KpiCardLarge
              label="미해결 사고 현황"
              trend="실시간 경보"
              trendDanger
              count={kpi.sago.count}
              numberDanger
              footer="전체 관리 대상 중 즉각 조치 필요 건수"
              right={<Sparkline d={kpi.sago.sparklineD} variant="danger" />}
              delayMs={0}
            />
            <KpiCardLarge
              label="내 미완료 할 일"
              trend={`진행률 ${todoPct}%`}
              count={kpi.todo.count}
              footer="본인에게 배정된 미완료 티켓 수"
              right={<KpiProgressBar done={kpi.todo.done} total={kpi.todo.total} />}
              delayMs={50}
            />
            <KpiCardLarge
              label="오픈 예정 서비스"
              trend="안정적 빌드"
              count={kpi.service.count}
              footer="배포 및 모니터링 준비 단계 서비스"
              right={<Sparkline d={kpi.service.sparklineD} variant="neutral" />}
              delayMs={100}
            />
          </section>

          {/* 2 그룹 박스 */}
          <section className="grid gap-4 md:grid-cols-[1fr_1.5fr]">
            <MetricGroupBox title="재정 및 영업 행정" columns={2}>
              <MetricSubcard label="체결 계약" value={metrics.contract.value} desc={metrics.contract.desc} active={metrics.contract.active} />
              <MetricSubcard label="미수 채권" value={metrics.bond.value} desc={metrics.bond.desc} active={metrics.bond.active} />
            </MetricGroupBox>
            <MetricGroupBox title="시스템 리소스 및 모니터링" columns={3}>
              <MetricSubcard label="백업 대기" value={metrics.backup.value} desc={metrics.backup.desc} />
              <MetricSubcard label="기관 연락처" value={metrics.contacts.value} desc={metrics.contacts.desc} />
              <MetricSubcard label="일정 / 활동" value={metrics.scheduleActivity.value} desc={metrics.scheduleActivity.desc} />
            </MetricGroupBox>
          </section>

          {/* 필터 + 테이블 */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterTabs active={filter} counts={counts} onChange={setFilter} />
              <span className="text-xs text-ink-muted">필터링된 결과: {visible.length}건 표시 중</span>
            </div>
            <LiveTable items={visible} onSelect={(it) => setSelected({ variant: it.variant, row: it.listRow })} />
          </section>
        </div>
      </div>

      <InspectorPanel open={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <InspectorChrome row={selected.row} editing={false} onToggleEdit={() => {}} editable={false}>
            <InspectorListBody row={selected.row} editing={false} onSave={() => {}} onCancel={() => {}} variant={selected.variant} />
          </InspectorChrome>
        ) : null}
      </InspectorPanel>
    </div>
  );
}
```

### Step 3: 검증 + 커밋
```
git commit -m "feat: LiveOverview 재작성 (KPI 3 + 그룹 2 + 필터 + 정식 테이블)"
```

---

## Task 15: page.tsx wiring

기존 9 도메인 fetch 유지 + 새 데이터 형태로 출력 + LiveOverview 렌더.

**Files:** `src/app/dashboard/page.tsx`

### 변경 핵심

- `incidentsUnresolvedCount`: incidents에서 `status !== "처리완료"` 개수 (client filter 또는 별도 쿼리)
- `todosTotal`, `todosDone`: 진행률용
- 5 도메인 → `LiveTableSources`로 변환 → `buildLiveTableItems` → tableItems
- `tiles` 배열 제거, `metrics`/`kpi` 객체로 구성

### Step 1: 변경 적용

import:
```ts
import { LiveOverview } from "./_components/live/LiveOverview";
import { buildLiveTableItems, type LiveTableSources } from "./_components/live/live-table-builder";
```

기존 todos fetch는 undone만 — 진행률을 위해 전체 fetch도 필요:
```ts
const allTodos = await listMyTodos(); // 전체
const undoneTodos = allTodos.filter((t) => !t.done);
const todosTotal = allTodos.length;
const todosDone = allTodos.length - undoneTodos.length;
```

incidents unresolved:
```ts
const incidentsUnresolvedCount = (await listIncidents({ pageSize: 1000, mine: mine && !!myEmail, meEmail: myEmail ?? undefined }))
  .rows.filter((i) => i.status !== "처리완료").length;
```
(주의: 페이지 사이즈 너무 크면 비용. 새 쿼리 옵션을 추가해도 됨. 현재는 client filter로 충분 — incidents 개수 적음 가정.)

table sources 빌드:
```ts
const tableSources: LiveTableSources = {
  incidents: incidents.map((i) => ({
    id: i.id, title: i.title, status: i.status ?? "미처리", createdAt: i.created_at,
    listRow: incidentsListRows.find((r) => r.id === i.id)!,
  })),
  todos: undoneTodos.map((t) => ({
    id: t.id, title: t.title, dueAt: t.due_at ?? null, createdAt: t.created_at,
    listRow: todosListRows.find((r) => r.id === t.id) ?? todoToListRow(t),
  })),
  services: servicesUpcoming.map((s) => ({
    id: s.id, title: `${s.university_name} · ${s.service_name}`, writeStartAt: s.write_start_at, createdAt: s.created_at ?? new Date().toISOString(),
    listRow: servicesListRows.find((r) => r.id === s.id) ?? servicesRowToListRow(s),
  })),
  backup: backupsFiltered.slice(0, 10).map((b) => ({
    id: b.id, title: b.summary_md.slice(0, 30), status: b.mail_status ?? "대기", createdAt: b.created_at,
    listRow: backupListRows.find((r) => r.id === b.id)!,
  })),
  schedule: upcomingEvents.map((e) => ({
    id: e.id, title: e.title, startAt: e.start_at, createdAt: e.created_at ?? new Date().toISOString(),
    listRow: scheduleListRows.find((r) => r.id === e.id) ?? eventToListRow(e),
  })),
};

const tableItems = buildLiveTableItems(tableSources).slice(0, 50);
```

sparkline mock path:
```ts
const SPARKLINE_SAGO = "M 0,30 L 15,28 L 30,35 L 45,15 L 60,25 L 75,5 L 90,12 L 100,2";
const SPARKLINE_SERVICE = "M 0,35 L 20,32 L 40,25 L 60,20 L 80,18 L 100,12";
```

return:
```tsx
return (
  <LiveOverview
    mine={mine}
    title="실시간 운영 현황"
    kpi={{
      sago: { count: incidentsUnresolvedCount, sparklineD: SPARKLINE_SAGO },
      todo: { count: undoneTodos.length, done: todosDone, total: todosTotal },
      service: { count: servicesUpcomingCount, sparklineD: SPARKLINE_SERVICE },
    }}
    metrics={{
      contract: { value: contractsCount ?? 0, desc: "체결 진행중" },
      bond: { value: receivablesCount ?? 0, active: (receivablesCount ?? 0) > 0, desc: "미지급 고지 발송" },
      backup: { value: backupCount, desc: "요청 처리건" },
      contacts: { value: contactsTotal, desc: "등록된 파트너" },
      scheduleActivity: { value: `${scheduleCount} / ${worklog.length}`, desc: "금주 잔여 건" },
    }}
    tableItems={tableItems}
  />
);
```

### Step 2: 미사용 정리
- 이전의 `tiles` / `feedSources` / `feedItems` 모두 제거
- formatDateShort/formatDateYear/formatHm 등 — 더 안 쓰면 제거
- shiftYmdYear는 services year shift 계속 필요

### Step 3: 검증
```
npm run typecheck && npm run lint && npm test && unset NODE_ENV && npm run build
```
모두 통과.

### Step 4: 커밋
```
git add src/app/dashboard/page.tsx
git commit -m "feat: /dashboard 실시간 현황 데이터를 새 LiveOverview 형태로 wiring"
```

---

## Task 16: 기존 dead 컴포넌트 제거

**Files:** delete

KpiTile / FeedRow / FeedChips / feed.ts (live-table-builder로 대체) + 각 테스트.

### Step 1: 사용처 grep
```bash
grep -rn "KpiTile\|FeedRow\|FeedChips\|from.*\\./feed['\"]" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```
기대: 결과 없음 (이미 LiveOverview/page.tsx에서 제거됨). 결과 있으면 BLOCKED 보고.

### Step 2: 삭제
```bash
git rm src/app/dashboard/_components/live/KpiTile.tsx \
       src/app/dashboard/_components/live/FeedRow.tsx \
       src/app/dashboard/_components/live/FeedChips.tsx \
       src/app/dashboard/_components/live/feed.ts \
       src/app/dashboard/_components/live/__tests__/KpiTile.test.tsx \
       src/app/dashboard/_components/live/__tests__/FeedRow.test.tsx \
       src/app/dashboard/_components/live/__tests__/FeedChips.test.tsx \
       src/app/dashboard/_components/live/__tests__/feed.test.ts
```

### Step 3: 검증
```
npm run typecheck && npm run lint && npm test && unset NODE_ENV && npm run build
```

### Step 4: 커밋
```
git commit -m "refactor: 이전 KPI 타일/Feed 컴포넌트 제거 (LiveOverview 재구성으로 dead)"
```

---

## Self-Review

- **Spec 커버리지**: 헤더(Task 13) / 대형 KPI 3(Task 10) / 중소 그룹(Task 8·9) / 필터(Task 11) / 테이블(Task 12) / 합성(Task 14) / wiring(Task 15) / 정리(Task 16). atom 6 + 조합 4 + 합성 2 + 정리 1 ✅
- **Placeholder**: 모든 스텝 코드 포함. mock SVG path 명시. 토큰 추가(Task 1)도 명시.
- **타입 일관성**: `LiveTableItem` Task12↔14↔15 / `LiveFilter` Task11↔14 / `LiveOverviewProps` Task14↔15 / `Variant` 기존 union 재사용.
- **리스크**:
  1. `incidents` unresolved count = client filter on pageSize 1000 — 사고 수가 적다고 가정. 1000 넘으면 서버 카운트 옵션 추가 필요
  2. `listMyTodos()`가 done 포함 전체 반환하는지 확인 필요 — 만약 undone만 반환하면 Task 15에서 todosTotal/Done 계산 못 함. 함수 시그니처 확인 후 필요시 별도 쿼리
  3. `b.created_at` / `e.created_at` 등 row에 created_at 있는지 — 없으면 fallback `new Date().toISOString()` 사용 (현재 plan에 적용)
  4. pulse 애니메이션 keyframes — globals.css에 추가 후 tailwind v4가 arbitrary `animate-[name_dur_easing_iter]` 인식하는지 확인. 안 되면 utility class로 등록
