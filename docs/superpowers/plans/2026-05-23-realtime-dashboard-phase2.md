# 실시간 현황 Phase 2 — 우측 사이드바 + 토스트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Phase 1 main panel 우측에 시스템 헬스 / 콘솔 / 관리자 컨트롤 3-영역 사이드바 + 우하단 LED 토스트 추가 (Mock 데이터).

**Architecture:** 9 신규 컴포넌트(atoms + 합성) → LiveSidebar로 합성 → LiveOverview에 2-col grid + ToastProvider 합성. sim state는 LiveSidebar 내부 관리.

**Spec:** `docs/superpowers/specs/2026-05-23-realtime-dashboard-phase2-design.md`

---

## File Structure

**Create:**
- `_components/live/SideBox.tsx` + `__tests__`
- `_components/live/HealthLed.tsx` + `__tests__`
- `_components/live/SystemHealthPanel.tsx` + `__tests__`
- `_components/live/ConsoleStream.tsx` + `__tests__`
- `_components/live/AdminControls.tsx` + `__tests__`
- `_components/live/Toast.tsx` + `__tests__`
- `_components/live/ToastContainer.tsx` (Provider + useToast hook 통합) + `__tests__`
- `_components/live/LiveSidebar.tsx` + `__tests__`
- `_components/live/mock-log-pool.ts` (간단 데이터 모듈, 테스트 불요)

**Modify:**
- `src/app/globals.css` (keyframes led-flicker / toast-in / toast-out, console-* 색 변수)
- `src/app/dashboard/_components/live/LiveOverview.tsx` (2-col grid, ToastProvider 합성, LiveSidebar 추가)

---

## Task 1: 디자인 토큰 + keyframes

**Files:** `src/app/globals.css`

### Step 1: keyframes 추가
기존 `@keyframes live-pulse` 옆에 추가:
```css
@keyframes led-flicker {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
}

@keyframes toast-in {
  from { transform: translateY(50px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes toast-out {
  to { transform: translateY(20px); opacity: 0; }
}
```

### Step 2: 콘솔 색 토큰
`:root` 블록에 추가:
```css
--console-bg: #1a160f;
--console-fg: #eae5d9;
--console-info: #8bb3e5;
--console-warn: #e9c46a;
--console-err: #e76f51;
```

`@theme inline` 블록에 expose:
```css
--color-console-bg: var(--console-bg);
--color-console-fg: var(--console-fg);
--color-console-info: var(--console-info);
--color-console-warn: var(--console-warn);
--color-console-err: var(--console-err);
```

### Step 3: 검증
- `npm run typecheck` clean
- `npm run lint` clean
- 빠른 sanity: `<div className="bg-console-bg text-console-info">` 같이 시도해 Tailwind 빌드 통과 확인

### Step 4: 커밋
```
git add src/app/globals.css
git commit -m "feat: 사이드바·토스트용 keyframes + 콘솔 색 토큰 5종 추가"
```

---

## Task 2: mock-log-pool 모듈

**Files:** `src/app/dashboard/_components/live/mock-log-pool.ts`

TDD 필요 없는 데이터 모듈 (설정성).

### 구현
```ts
export type ConsoleLogType = "info" | "warn" | "err";
export type ConsoleLogEntry = { text: string; type: ConsoleLogType };

/** 초기 부팅 3줄 */
export const INITIAL_CONSOLE_LINES: ConsoleLogEntry[] = [
  { text: "[SYS] 모니터링 콘솔 접속 성공.", type: "info" },
  { text: "[SYS] Supabase 실시간 소켓 연결 확인.", type: "info" },
  { text: "[CRON] insights-collect 스케줄러 대기 중.", type: "info" },
];

/** 시뮬레이션 활성화 시 6초마다 무작위로 추가될 로그 풀 */
export const LOG_POOL: ConsoleLogEntry[] = [
  { text: "[CRON] insights-collect 작업 실행 완료 (max: collected_at 확인)", type: "info" },
  { text: "[WARN] youtube-api quota 소모 감지: 1회 누적 (650 unit 소모)", type: "warn" },
  { text: "[DB] user_sessions 인덱스 풀 검사 완료 (정상)", type: "info" },
  { text: "[CRON] automation_settings 읽기 성공. insights-collect 자동 실행 ON 확인", type: "info" },
  { text: "[ERR] auth_gateway Azure AD SSO 검사 오류 - 토큰 만료 재시도 진행 중", type: "err" },
  { text: "[SYS] backup-requests 데몬이 신규 요청 큐 검색 중...", type: "info" },
  { text: "[DB] automation_settings 테이블 RLS select 정책 검증 완료", type: "info" },
];

/** 토스트 메시지 풀 (이모지 없음, vermilion LED dot이 시각 신호) */
export const TOAST_MESSAGE_POOL: string[] = [
  "[사고] Redis 세션 장애 복구 요청 수신",
  "[사고] API 할당량 80% 초과 발생",
  "[할일] 대학 연락망 동기화 건 배정",
  "[서비스] 중앙대 신규 서브 도메인 배포 대기",
  "[백업] 마이그레이션 전 백업 스케줄 등록",
];

export function pickRandom<T>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}
```

### 커밋
```
git add src/app/dashboard/_components/live/mock-log-pool.ts
git commit -m "feat: 사이드바 mock 데이터 풀 (초기 콘솔/로그/토스트)"
```

---

## Task 3: SideBox 공통 박스 (TDD)

**Files:** `SideBox.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SideBox } from "../SideBox";

describe("SideBox", () => {
  it("title + children 렌더", () => {
    render(<SideBox title="시스템 게이트웨이 상태"><div>본문</div></SideBox>);
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
  });
  it("titleRight slot 렌더 (예: 헬스 LED, Auto Scroll 라벨)", () => {
    render(<SideBox title="x" titleRight={<span data-tr>R</span>}><div/></SideBox>);
    const tr = document.querySelector("[data-tr]");
    expect(tr).not.toBeNull();
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
type Props = {
  title: string;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
};

/** 사이드바 공통 박스 — title row(좌측 텍스트 + 우측 슬롯) + border-b + children. */
export function SideBox({ title, titleRight, children }: Props) {
  return (
    <section className="border border-ink bg-washi-raised p-4">
      <header className="mb-3 flex items-center justify-between border-b border-ink pb-2">
        <h3 className="text-[13px] font-bold text-ink">{title}</h3>
        {titleRight ?? null}
      </header>
      {children}
    </section>
  );
}
```

### Step 3: 커밋
```
git add _components/live/SideBox.tsx __tests__/SideBox.test.tsx
git commit -m "feat: SideBox 공통 박스 (title + titleRight slot + body)"
```

---

## Task 4: HealthLed (TDD)

**Files:** `HealthLed.tsx` + 테스트

3 variant + flicker 옵션.

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { HealthLed } from "../HealthLed";

describe("HealthLed", () => {
  it("variant=green → bg-green-light + shadow-led-green", () => {
    const { container } = render(<HealthLed variant="green" />);
    expect(container.firstChild).toHaveProperty("className");
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-green-light/);
  });
  it("variant=vermilion → bg-vermilion", () => {
    const { container } = render(<HealthLed variant="vermilion" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/bg-vermilion/);
  });
  it("flicker=true → animate flicker 클래스", () => {
    const { container } = render(<HealthLed variant="vermilion" flicker />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[led-flicker_/);
  });
  it("flicker 기본 false → animate 클래스 없음", () => {
    const { container } = render(<HealthLed variant="green" />);
    expect((container.firstChild as HTMLElement).className).not.toMatch(/animate-\[led-flicker_/);
  });
});
```

### Step 2: 토큰 확인 + 구현 (GREEN)
`green-light` 토큰이 Folio에 있는지 확인. 없으면 `globals.css`에 추가 필요 (`#48bb78`). amber는 이미 있음.

`HealthLed.tsx`:
```tsx
type Variant = "green" | "vermilion" | "amber";

const CLASS: Record<Variant, string> = {
  green: "bg-green-light",
  vermilion: "bg-vermilion",
  amber: "bg-amber",
};

type Props = { variant: Variant; flicker?: boolean };

/** 헬스 LED 인디케이터 — 8px round + box-shadow glow. flicker=true 시 깜빡임. */
export function HealthLed({ variant, flicker = false }: Props) {
  const anim = flicker ? "animate-[led-flicker_1s_alternate_infinite]" : "";
  return (
    <span
      data-health-led
      className={`inline-block h-2 w-2 rounded-full ${CLASS[variant]} ${anim}`}
      aria-hidden
    />
  );
}
```

**중요**: `green-light` 토큰이 없으면 Task 1과 함께 처리하지 말고 이 task에서 추가:
- `globals.css :root`: `--green-light: #48bb78;`
- `@theme inline`: `--color-green-light: var(--green-light);`

### Step 3: 커밋
```
git add _components/live/HealthLed.tsx __tests__/HealthLed.test.tsx (+ globals.css if green-light 추가)
git commit -m "feat: HealthLed 인디케이터 (green/vermilion/amber + flicker)"
```

---

## Task 5: Toast 단일 UI (TDD)

**Files:** `Toast.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toast } from "../Toast";

describe("Toast", () => {
  it("message 텍스트 + LED dot 렌더", () => {
    const { container } = render(<Toast message="[사고] Redis 세션 장애" />);
    expect(screen.getByText(/Redis 세션/)).toBeInTheDocument();
    expect(container.querySelector("[data-toast-led]")).not.toBeNull();
  });
  it("toast 컨테이너에 toast-in 애니메이션 클래스", () => {
    const { container } = render(<Toast message="x" />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[toast-in_/);
  });
  it("data-state='leaving'이면 toast-out 클래스로 전환", () => {
    const { container } = render(<Toast message="x" leaving />);
    expect((container.firstChild as HTMLElement).className).toMatch(/animate-\[toast-out_/);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
type Props = {
  message: string;
  leaving?: boolean;
};

/** 단일 토스트 박스 — bg-ink + cream text + 좌측 LED dot + 진입/퇴장 애니메이션. */
export function Toast({ message, leaving = false }: Props) {
  const anim = leaving
    ? "animate-[toast-out_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]"
    : "animate-[toast-in_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards]";
  return (
    <div
      className={`flex items-center gap-2 border border-washi bg-ink px-4 py-2.5 text-xs text-cream shadow-md ${anim}`}
    >
      <span data-toast-led className="h-1.5 w-1.5 rounded-full bg-vermilion shadow-[0_0_8px_var(--vermilion),0_0_2px_var(--vermilion)]" />
      <span>{message}</span>
    </div>
  );
}
```

> `shadow-[0_0_8px_var(--vermilion),0_0_2px_var(--vermilion)]` arbitrary value — 인접 주석으로 의도 명시.

### Step 3: 커밋
```
git commit -m "feat: Toast 단일 UI (LED dot + ink bg + 진입/퇴장 애니메이션)"
```

---

## Task 6: ToastContainer + Context + useToast (TDD)

**Files:** `ToastContainer.tsx` (Provider, hook, container UI 통합) + 테스트

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../ToastContainer";

function TriggerButton() {
  const { showToast } = useToast();
  return <button onClick={() => showToast("[사고] 테스트")}>fire</button>;
}

describe("ToastContainer + useToast", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("showToast 호출 시 토스트 표시", () => {
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => {
      screen.getByRole("button").click();
    });
    expect(screen.getByText(/테스트/)).toBeInTheDocument();
  });
  it("3.5초 후 자동 사라짐 (애니메이션 0.3초 포함 ~3.8초 후 DOM 제거)", () => {
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => screen.getByRole("button").click());
    expect(screen.getByText(/테스트/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText(/테스트/)).toBeNull();
  });
  it("여러 토스트 동시 stack", () => {
    render(<ToastProvider><TriggerButton /></ToastProvider>);
    act(() => screen.getByRole("button").click());
    act(() => screen.getByRole("button").click());
    expect(screen.getAllByText(/테스트/).length).toBe(2);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Toast } from "./Toast";

type ToastEntry = { id: number; message: string; leaving: boolean };

type ToastCtx = { showToast: (message: string) => void };
const Ctx = createContext<ToastCtx | null>(null);

/** useToast — 자식 컴포넌트에서 토스트 표시. ToastProvider 안에서만 호출. */
export function useToast(): ToastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast는 ToastProvider 안에서만 사용");
  return v;
}

let _id = 0;

/** ToastProvider — children에 showToast 제공 + 우하단에 토스트 stack 렌더. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showToast = useCallback((message: string) => {
    const id = ++_id;
    setToasts((prev) => [...prev, { id, message, leaving: false }]);
    // 3.5초 후 leaving=true → 0.3초 페이드아웃 → DOM 제거
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 300);
    }, 3500);
  }, []);

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} leaving={t.leaving} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: ToastProvider + useToast (3.5초 자동제거, 다중 stack)"
```

---

## Task 7: SystemHealthPanel (TDD)

**Files:** `SystemHealthPanel.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemHealthPanel } from "../SystemHealthPanel";

describe("SystemHealthPanel", () => {
  it("3 항목 + 값 렌더", () => {
    render(<SystemHealthPanel cronActive={false} />);
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("YouTube API Quota")).toBeInTheDocument();
    expect(screen.getByText("Supabase Connection")).toBeInTheDocument();
    expect(screen.getByText("Cron 자동화 엔진")).toBeInTheDocument();
    expect(screen.getByText(/67\.2% 잔여/)).toBeInTheDocument();
    expect(screen.getByText(/12ms/)).toBeInTheDocument();
    expect(screen.getByText("정상 가동")).toBeInTheDocument();
  });
  it("cronActive=true → Cron LED flicker + 텍스트 변경", () => {
    const { container } = render(<SystemHealthPanel cronActive={true} />);
    expect(screen.getByText("스케줄 수집 작동 중")).toBeInTheDocument();
    // 마지막 LED만 flicker 클래스
    const leds = container.querySelectorAll("[data-health-led]");
    const cronLed = leds[leds.length - 1] as HTMLElement;
    expect(cronLed.className).toMatch(/animate-\[led-flicker_/);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { SideBox } from "./SideBox";
import { HealthLed } from "./HealthLed";

type Props = { cronActive: boolean };

/** 시스템 게이트웨이 상태 — 3 항목 (YouTube quota / Supabase / Cron).
 *  cronActive=true 시 Cron LED vermilion flicker + 텍스트 변경. */
export function SystemHealthPanel({ cronActive }: Props) {
  return (
    <SideBox title="시스템 게이트웨이 상태" titleRight={<HealthLed variant="green" />}>
      <ul className="flex flex-col gap-3">
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="green" />
            YouTube API Quota
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">67.2% 잔여</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant="green" />
            Supabase Connection
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">12ms (Good)</span>
        </li>
        <li className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold text-ink">
            <HealthLed variant={cronActive ? "vermilion" : "green"} flicker={cronActive} />
            Cron 자동화 엔진
          </span>
          <span className="text-xs font-bold tabular-nums text-ink-soft">
            {cronActive ? "스케줄 수집 작동 중" : "정상 가동"}
          </span>
        </li>
      </ul>
    </SideBox>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: SystemHealthPanel (3 헬스 항목 + Cron LED 시뮬레이션 연동)"
```

---

## Task 8: ConsoleStream (TDD)

**Files:** `ConsoleStream.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConsoleStream } from "../ConsoleStream";
import type { ConsoleLogEntry } from "../mock-log-pool";

const lines: ConsoleLogEntry[] = [
  { text: "[SYS] hello", type: "info" },
  { text: "[WARN] quota", type: "warn" },
  { text: "[ERR] failure", type: "err" },
];

describe("ConsoleStream", () => {
  it("title + 'Auto Scroll' 라벨 + lines 렌더", () => {
    render(<ConsoleStream lines={lines} />);
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    expect(screen.getByText("Auto Scroll")).toBeInTheDocument();
    expect(screen.getByText("[SYS] hello")).toBeInTheDocument();
    expect(screen.getByText("[WARN] quota")).toBeInTheDocument();
    expect(screen.getByText("[ERR] failure")).toBeInTheDocument();
  });
  it("줄별 type 색상 클래스 적용", () => {
    const { container } = render(<ConsoleStream lines={lines} />);
    const items = container.querySelectorAll("[data-console-line]");
    expect((items[0] as HTMLElement).className).toMatch(/text-console-info/);
    expect((items[1] as HTMLElement).className).toMatch(/text-console-warn/);
    expect((items[2] as HTMLElement).className).toMatch(/text-console-err/);
  });
  it("빈 lines도 박스는 렌더", () => {
    const { container } = render(<ConsoleStream lines={[]} />);
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-console-line]").length).toBe(0);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { useEffect, useRef } from "react";
import { SideBox } from "./SideBox";
import type { ConsoleLogEntry } from "./mock-log-pool";

type Props = { lines: ConsoleLogEntry[] };

const COLOR: Record<ConsoleLogEntry["type"], string> = {
  info: "text-console-info",
  warn: "text-console-warn",
  err: "text-console-err",
};

/** 검은 배경 mono 콘솔 — 320px height + 자동 스크롤 (새 줄 추가 시 bottom). */
export function ConsoleStream({ lines }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <SideBox
      title="실시간 백그라운드 로그"
      titleRight={
        <span className="text-[10px] font-normal text-ink-muted">Auto Scroll</span>
      }
    >
      <div
        ref={ref}
        className="flex h-[320px] flex-col gap-1.5 overflow-y-auto border border-ink bg-console-bg p-3 font-mono text-xs text-console-fg"
      >
        {lines.map((l, i) => (
          <div key={i} data-console-line className={`leading-[1.5] ${COLOR[l.type]}`}>
            {l.text}
          </div>
        ))}
      </div>
    </SideBox>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: ConsoleStream (검은 mono 콘솔 + 자동 스크롤 + 줄별 색)"
```

---

## Task 9: AdminControls (TDD)

**Files:** `AdminControls.tsx` + 테스트

### Step 1: 테스트 (RED)
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AdminControls } from "../AdminControls";

describe("AdminControls", () => {
  it("sim=false → 활성화 버튼 + 보조 버튼", () => {
    render(<AdminControls sim={false} onToggleSim={() => {}} onTestEvent={() => {}} />);
    expect(screen.getByRole("button", { name: /시뮬레이션 활성화/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /테스트 이벤트 인입/ })).toBeInTheDocument();
  });
  it("sim=true → 정지 버튼 + vermilion bg", () => {
    render(<AdminControls sim={true} onToggleSim={() => {}} onTestEvent={() => {}} />);
    const btn = screen.getByRole("button", { name: /시뮬레이션 정지/ });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toMatch(/bg-vermilion/);
  });
  it("주 버튼 클릭 시 onToggleSim", () => {
    const fn = vi.fn();
    render(<AdminControls sim={false} onToggleSim={fn} onTestEvent={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    expect(fn).toHaveBeenCalled();
  });
  it("보조 버튼 클릭 시 onTestEvent", () => {
    const fn = vi.fn();
    render(<AdminControls sim={false} onToggleSim={() => {}} onTestEvent={fn} />);
    fireEvent.click(screen.getByRole("button", { name: /테스트 이벤트 인입/ }));
    expect(fn).toHaveBeenCalled();
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

type Props = {
  sim: boolean;
  onToggleSim: () => void;
  onTestEvent: () => void;
};

/** 관리자 컨트롤 — 시뮬레이션 토글(주) + 테스트 이벤트 인입(보조). */
export function AdminControls({ sim, onToggleSim, onTestEvent }: Props) {
  const mainClass = sim
    ? "w-full border border-vermilion bg-vermilion px-2 py-2 text-xs font-semibold text-cream transition-colors"
    : "w-full border border-ink bg-ink px-2 py-2 text-xs font-semibold text-cream transition-colors hover:bg-ink-soft";

  return (
    <div className="border border-ink bg-washi p-3">
      <button type="button" onClick={onToggleSim} className={`${mainClass} mb-2 cursor-pointer`}>
        {sim ? "시뮬레이션 정지" : "시뮬레이션 활성화"}
      </button>
      <button
        type="button"
        onClick={onTestEvent}
        className="w-full cursor-pointer border border-ink bg-transparent px-2 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-washi-raised"
      >
        테스트 이벤트 인입 (+1)
      </button>
    </div>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: AdminControls (시뮬레이션 토글 + 테스트 이벤트 인입)"
```

---

## Task 10: LiveSidebar 합성 (TDD)

**Files:** `LiveSidebar.tsx` + 테스트

sim state 관리 + interval + triggerEvent. useToast 사용.

### Step 1: 테스트 (RED) — 핵심 통합 케이스
```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { LiveSidebar } from "../LiveSidebar";
import { ToastProvider } from "../ToastContainer";

function withProvider(ui: React.ReactNode) {
  return <ToastProvider>{ui}</ToastProvider>;
}

describe("LiveSidebar", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("3 영역 모두 렌더", () => {
    render(withProvider(<LiveSidebar />));
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /시뮬레이션 활성화/ })).toBeInTheDocument();
  });
  it("테스트 이벤트 인입 → 콘솔 줄 추가 + 토스트 표시", () => {
    render(withProvider(<LiveSidebar />));
    const before = screen.getAllByText(/^\[/).length; // 콘솔 라인 추정
    fireEvent.click(screen.getByRole("button", { name: /테스트 이벤트 인입/ }));
    const after = screen.getAllByText(/^\[/).length;
    expect(after).toBeGreaterThan(before);
  });
  it("시뮬레이션 활성화 → 6초마다 이벤트 인입", () => {
    render(withProvider(<LiveSidebar />));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    // 토글 즉시 1회 인입
    const after1 = screen.getAllByText(/^\[/).length;
    act(() => { vi.advanceTimersByTime(6100); });
    const after2 = screen.getAllByText(/^\[/).length;
    expect(after2).toBeGreaterThan(after1);
  });
  it("시뮬레이션 정지 → interval clear", () => {
    render(withProvider(<LiveSidebar />));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 활성화/ }));
    fireEvent.click(screen.getByRole("button", { name: /시뮬레이션 정지/ }));
    const before = screen.getAllByText(/^\[/).length;
    act(() => { vi.advanceTimersByTime(12000); });
    const after = screen.getAllByText(/^\[/).length;
    expect(after).toBe(before);
  });
});
```

### Step 2: 구현 (GREEN)
```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { ConsoleStream } from "./ConsoleStream";
import { AdminControls } from "./AdminControls";
import { useToast } from "./ToastContainer";
import {
  INITIAL_CONSOLE_LINES,
  LOG_POOL,
  TOAST_MESSAGE_POOL,
  pickRandom,
  type ConsoleLogEntry,
} from "./mock-log-pool";

const CONSOLE_CAP = 50;
const SIM_INTERVAL_MS = 6000;

/** 우측 사이드바 합성 — 헬스 패널 + 콘솔 + 관리자 컨트롤. sim state + interval 관리. */
export function LiveSidebar() {
  const { showToast } = useToast();
  const [sim, setSim] = useState(false);
  const [lines, setLines] = useState<ConsoleLogEntry[]>(INITIAL_CONSOLE_LINES);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerEvent = useCallback(() => {
    const log = pickRandom(LOG_POOL);
    setLines((prev) => {
      const next = [...prev, log];
      return next.length > CONSOLE_CAP ? next.slice(next.length - CONSOLE_CAP) : next;
    });
    showToast(pickRandom(TOAST_MESSAGE_POOL));
  }, [showToast]);

  useEffect(() => {
    if (!sim) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    // 토글 켜는 즉시 1회 인입
    triggerEvent();
    intervalRef.current = setInterval(triggerEvent, SIM_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sim, triggerEvent]);

  return (
    <aside className="flex flex-col gap-6">
      <SystemHealthPanel cronActive={sim} />
      <ConsoleStream lines={lines} />
      <AdminControls
        sim={sim}
        onToggleSim={() => setSim((v) => !v)}
        onTestEvent={triggerEvent}
      />
    </aside>
  );
}
```

### Step 3: 커밋
```
git commit -m "feat: LiveSidebar 합성 (헬스+콘솔+컨트롤 + sim interval + 토스트 트리거)"
```

---

## Task 11: LiveOverview 통합 (2-col + ToastProvider + LiveSidebar)

**Files:** `LiveOverview.tsx`

### 변경 핵심
- 전체를 `<ToastProvider>`로 감싸기
- 컨텐츠 area의 `mx-auto max-w-[1680px] flex flex-col gap-6`을 grid로 변경:
  - 모바일: 단일 컬럼 stack
  - lg 이상: `lg:grid-cols-[3fr_1fr] lg:gap-6`
- 우측에 `<LiveSidebar />` 추가 (sticky top — Phase 1의 헤더 sticky 위치 고려해 적당히 `lg:sticky lg:top-[var(--live-header-h)]` 또는 동적 측정 어려우면 단순 `lg:sticky lg:top-6`)

### Step 1: 테스트 (RED) — `__tests__/LiveOverview.test.tsx`에 추가
기존 5 테스트 유지 + 새 케이스:
```tsx
it("우측 사이드바 영역 렌더 (시스템 헬스 + 콘솔 + 관리자)", () => {
  render(<LiveOverview {...baseProps} />);
  expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
  expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /시뮬레이션 활성화/ })).toBeInTheDocument();
});
```

(기존 vitest mock — matchMedia, next/navigation — 그대로 사용)

### Step 2: 구현 (GREEN)
파일 head에 import 추가:
```tsx
import { ToastProvider } from "./ToastContainer";
import { LiveSidebar } from "./LiveSidebar";
```

return JSX 변경 (현재 구조):
```tsx
return (
  <ToastProvider>
    <div
      className={`h-full overflow-y-auto bg-cream transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
        selected ? "md:pr-[400px]" : ""
      }`}
    >
      <div className="sticky top-0 z-10">
        <LivePageHeader mine={mine} title={title} />
      </div>
      <div className="px-6 py-6">
        <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
          {/* 좌측 main */}
          <div className="flex flex-col gap-6">
            {/* 기존 3 section: KPI / 그룹 / 필터+테이블 */}
            ... 기존 3 section 그대로 ...
          </div>
          {/* 우측 사이드바 (모바일에선 main 아래로 stack) */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <LiveSidebar />
          </div>
        </div>
      </div>

      <InspectorPanel ...>{...}</InspectorPanel>
    </div>
  </ToastProvider>
);
```

> `lg:self-start` 중요 — sticky가 grid item에서 동작하려면 self-start (또는 align-self: start) 필요.

### Step 3: 검증 (필수)
```
npm run typecheck && npm run lint && npm test && unset NODE_ENV && npm run build
```
전부 통과. 회귀 0.

### Step 4: 커밋
```
git add src/app/dashboard/_components/live/LiveOverview.tsx src/app/dashboard/_components/live/__tests__/LiveOverview.test.tsx
git commit -m "feat: LiveOverview 2-col grid + LiveSidebar + ToastProvider 통합"
```

---

## Self-Review

- **Spec 커버리지**:
  - SideBox + 3 영역 ✅ (Task 3, 7, 8, 9)
  - 헬스 LED + Cron sim 연동 ✅ (Task 4, 7)
  - 검은 콘솔 + 자동 스크롤 + cap 50 ✅ (Task 8)
  - 시뮬레이터 토글 + 6초 interval + 즉시 1회 인입 ✅ (Task 10)
  - 토스트 3.5초 자동 사라짐 + 다중 stack ✅ (Task 6)
  - 2-col grid + sticky 사이드바 ✅ (Task 11)
  - 인스펙터 슬라이드 흐름 유지 ✅ (`md:pr-[400px]` 그대로)
  - 디자인 토큰(console-*) ✅ (Task 1)
- **Placeholder 없음** — 모든 step 코드 포함, 토큰/keyframes 명시
- **타입 일관성**: `ConsoleLogEntry` mock-log-pool↔ConsoleStream↔LiveSidebar / `ToastCtx` Provider↔useToast↔AdminControls 흐름 / Sim state는 LiveSidebar 내부 단방향 (props down)
- **리스크**:
  1. `green-light` 토큰 부재 가능 → Task 4에서 추가 처리
  2. `lg:sticky` + grid item — Tailwind v4에서 `align-self: start` 보장 위해 `self-start` 추가
  3. interval 정리 — useEffect cleanup으로 보장 (Task 10 구현 그대로)
  4. ToastProvider 위치 — LiveOverview 최상위로 감싸야 LiveSidebar의 useToast 작동. Phase 3에서 다른 페이지도 토스트 쓰려면 dashboard layout으로 끌어올리는 것 검토
