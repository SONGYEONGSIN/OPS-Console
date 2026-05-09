# Dashboard Chrome (PIVOT) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard` 상단 chrome을 기존 Folio/에디토리얼(▣ + 검은 TitleBar) → PIVOT 모더니즘 1층 통합 chrome으로 전면 교체. 사용자 정보 mock("송영석")을 Supabase 인증 + OPERATORS lookup으로 전환.

**Architecture:** `dashboard/layout.tsx` server 변환 → `DashboardShell` client wrapper로 sidebar state 분리. `Chrome` 단일 server 컴포넌트가 좌(▣ PIVOT) / 가운데(검색) / 우측(15:00 세션 + 알림 + 풀네임) 그리드 조립. `SessionTimer`는 client mousemove/keydown 리스너로 idle 측정, 0초 도달 시 `signOut()`. `AlertsBell` v2는 hover=드롭다운 / click=`/dashboard/alerts` 이동.

**Tech Stack:** Next.js App Router (server components 우선), Supabase SSR (`@supabase/ssr`), Tailwind v4 + design-tokens.ts, vitest + @testing-library/react, playwright (clock API), zod.

**Spec:** `docs/superpowers/specs/2026-05-04-dashboard-chrome-redesign-design.md`

**HARD-GATE 등급:** 간략 설계 (12-15 파일 변경)

---

## File Structure

### Create
- `src/features/auth/queries.ts` — `getCurrentOperator()` server-only
- `src/features/auth/queries.test.ts`
- `src/app/dashboard/_components/chrome/Chrome.tsx`
- `src/app/dashboard/_components/chrome/ChromeBrand.tsx`
- `src/app/dashboard/_components/chrome/ChromeRight.tsx`
- `src/app/dashboard/_components/chrome/ChromeUser.tsx`
- `src/app/dashboard/_components/chrome/SessionTimer.tsx`
- `src/app/dashboard/_components/chrome/__tests__/SessionTimer.test.tsx`
- `src/app/dashboard/_components/chrome/__tests__/ChromeUser.test.tsx`
- `src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx`
- `src/app/dashboard/_components/DashboardShell.tsx`

### Modify
- `src/lib/design-tokens.ts` — chromeGraphite/chromeSnow/chromeMuted 토큰
- `src/app/globals.css` — chrome CSS 변수 노출
- `tailwind.config.ts` — tailwind에 chrome 토큰
- `src/app/dashboard/layout.tsx` — server 변환, DashboardShell 호출
- `src/app/dashboard/_components/AlertsBell.tsx` — hover dropdown + click navigate
- `src/app/dashboard/_components/__tests__/AlertsBell.test.tsx` — v2 동작 회귀
- `e2e/dashboard.spec.ts` — chrome 어설션 갱신 (PIVOT, 15:00, 풀네임, alerts navigate)

### Delete
- `src/app/dashboard/_components/MenuBar.tsx` (Chrome 흡수)
- `src/app/dashboard/_components/__tests__/MenuBar.test.tsx`

---

## Task 1: Design Tokens (PIVOT chrome)

**Files:**
- Modify: `src/lib/design-tokens.ts`
- Modify: `src/app/globals.css`
- Modify: `tailwind.config.ts`

**Goal:** chromeGraphite / chromeSnow / chromeMuted 3개 토큰 추가. 컴포넌트는 Tailwind 클래스로만 사용.

- [ ] **Step 1: design-tokens.ts에 토큰 추가**

`src/lib/design-tokens.ts` colors 객체 끝에 추가:

```typescript
  // PIVOT chrome 전용 (별도 레이어 — chrome bar만 적용)
  chromeGraphite: '#18181b',
  chromeSnow: '#f5f5f4',
  chromeMuted: '#71717a',
```

- [ ] **Step 2: globals.css에 CSS 변수 추가**

`src/app/globals.css` `:root` 블록에 추가:

```css
  --chrome-graphite: #18181b;
  --chrome-snow: #f5f5f4;
  --chrome-muted: #71717a;
```

`@theme inline` 블록 (Tailwind v4)에도 추가:

```css
  --color-chrome-graphite: var(--chrome-graphite);
  --color-chrome-snow: var(--chrome-snow);
  --color-chrome-muted: var(--chrome-muted);
```

- [ ] **Step 3: tailwind.config.ts에 토큰 매핑**

`tailwind.config.ts` `theme.extend.colors`에 추가:

```typescript
  'chrome-graphite': 'var(--chrome-graphite)',
  'chrome-snow': 'var(--chrome-snow)',
  'chrome-muted': 'var(--chrome-muted)',
```

- [ ] **Step 4: 빌드 확인**

```bash
npx tsc --noEmit && npm run lint -- src/lib/design-tokens.ts
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/design-tokens.ts src/app/globals.css tailwind.config.ts
git commit -m "feat: PIVOT chrome 토큰(chromeGraphite/Snow/Muted) 추가"
```

---

## Task 2: getCurrentOperator (server query)

**Files:**
- Create: `src/features/auth/queries.ts`
- Create: `src/features/auth/queries.test.ts`

**Goal:** Supabase user.email → OPERATORS lookup → `{ email, operator, displayName, role, team }` 반환. fallback (비-OPERATORS, dev/admin)에서 displayName=email username, role="관리자", team=null.

- [ ] **Step 1: 실패 테스트 작성**

`src/features/auth/queries.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentOperator } from "./queries";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";

const makeClient = (user: { email: string } | null) => ({
  auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
});

beforeEach(() => vi.clearAllMocks());

describe("getCurrentOperator", () => {
  it("매칭되는 OPERATORS 멤버는 풀 데이터 반환", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ys1114@jinhakapply.com" }) as never
    );
    const result = await getCurrentOperator();
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("송영신");
    expect(result!.role).toBe("팀장");
    expect(result!.team).toBe("운영2팀");
    expect(result!.operator).not.toBeNull();
  });

  it("매칭 안 되는 이메일은 fallback (email username + 관리자)", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeClient({ email: "ysong2526@gmail.com" }) as never
    );
    const result = await getCurrentOperator();
    expect(result).not.toBeNull();
    expect(result!.displayName).toBe("ysong2526");
    expect(result!.role).toBe("관리자");
    expect(result!.team).toBeNull();
    expect(result!.operator).toBeNull();
  });

  it("user 없음(null) → null 반환", async () => {
    vi.mocked(createClient).mockResolvedValue(makeClient(null) as never);
    const result = await getCurrentOperator();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/features/auth/queries.test.ts
```

Expected: FAIL — `Cannot find module './queries'`.

- [ ] **Step 3: 최소 구현**

`src/features/auth/queries.ts`:

```typescript
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { OPERATORS, type Operator } from "./operators";

export type CurrentOperator = {
  email: string;
  operator: Operator | null;
  displayName: string;
  role: string;
  team: Operator["team"] | null;
};

export async function getCurrentOperator(): Promise<CurrentOperator | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const operator = OPERATORS.find((op) => op.email === user.email) ?? null;
  return {
    email: user.email,
    operator,
    displayName: operator?.name ?? user.email.split("@")[0],
    role: operator?.role ?? "관리자",
    team: operator?.team ?? null,
  };
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/features/auth/queries.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/queries.ts src/features/auth/queries.test.ts
git commit -m "feat: getCurrentOperator — Supabase user → OPERATORS lookup + fallback"
```

---

## Task 3: SessionTimer (idle countdown)

**Files:**
- Create: `src/app/dashboard/_components/chrome/SessionTimer.tsx`
- Create: `src/app/dashboard/_components/chrome/__tests__/SessionTimer.test.tsx`

**Goal:** 15분(900초) idle 카운트다운 표시. mousemove/keydown/click 시 reset. 0초 도달 시 `signOut()` 호출. 표시 형식 `MM:SS`.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_components/chrome/__tests__/SessionTimer.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { SessionTimer } from "../SessionTimer";

const signOutMock = vi.fn();
vi.mock("@/features/auth/actions", () => ({
  signOut: () => signOutMock(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  signOutMock.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("SessionTimer", () => {
  it("초기 표시 15:00", () => {
    render(<SessionTimer />);
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("1초 경과 → 14:59", () => {
    render(<SessionTimer />);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("14:59")).toBeInTheDocument();
  });

  it("mousemove 활동 시 리셋", () => {
    render(<SessionTimer />);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("14:00")).toBeInTheDocument();
    act(() => fireEvent.mouseMove(document));
    expect(screen.getByText("15:00")).toBeInTheDocument();
  });

  it("15분 idle 시 signOut 호출", () => {
    render(<SessionTimer />);
    act(() => vi.advanceTimersByTime(15 * 60 * 1000));
    expect(signOutMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/SessionTimer.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 최소 구현**

`src/app/dashboard/_components/chrome/SessionTimer.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/features/auth/actions";

const IDLE_SECONDS = 15 * 60;

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function SessionTimer() {
  const [remaining, setRemaining] = useState(IDLE_SECONDS);
  const triggered = useRef(false);

  useEffect(() => {
    const reset = () => setRemaining(IDLE_SECONDS);
    const events: Array<keyof DocumentEventMap> = ["mousemove", "keydown", "click"];
    events.forEach((e) => document.addEventListener(e, reset));

    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0 && !triggered.current) {
          triggered.current = true;
          void signOut();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      events.forEach((e) => document.removeEventListener(e, reset));
      clearInterval(interval);
    };
  }, []);

  const isLow = remaining <= 5 * 60;
  return (
    <span
      className="flex flex-col items-end leading-none"
      aria-label={`세션 ${format(remaining)} 남음`}
    >
      <span
        className={`text-sm font-bold tabular-nums ${
          isLow ? "text-vermilion" : "text-chrome-graphite"
        }`}
      >
        {format(remaining)}
      </span>
      <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.24em] text-chrome-muted">
        세션
      </span>
    </span>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/SessionTimer.test.tsx
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/chrome/SessionTimer.tsx src/app/dashboard/_components/chrome/__tests__/SessionTimer.test.tsx
git commit -m "feat: SessionTimer — 15분 idle 카운트다운 + 활동 시 reset + signOut"
```

---

## Task 4: AlertsBell v2 (hover dropdown + click navigate)

**Files:**
- Modify: `src/app/dashboard/_components/AlertsBell.tsx`
- Create or Modify: `src/app/dashboard/_components/__tests__/AlertsBell.test.tsx`

**Goal:** 종 SVG 20×20 + 빨강 배지. **호버 200ms** 드롭다운 미리보기, **클릭** `/dashboard/alerts` 이동. ESC + 외부 클릭 닫기 유지.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_components/__tests__/AlertsBell.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AlertsBell } from "../AlertsBell";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const fixtures = [
  { id: "a1", title: "긴급 1", tone: "urgent", subtitle: "" },
  { id: "a2", title: "검토 1", tone: "review", subtitle: "" },
];

beforeEach(() => {
  vi.useFakeTimers();
  pushMock.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("AlertsBell v2", () => {
  it("urgent 카운트 배지 표시", () => {
    render(<AlertsBell items={fixtures as never} />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("호버 200ms 후 드롭다운 표시", () => {
    render(<AlertsBell items={fixtures as never} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: /알림/ }));
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByText("긴급 1")).toBeInTheDocument();
  });

  it("종 클릭 시 /dashboard/alerts 이동", () => {
    render(<AlertsBell items={fixtures as never} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/alerts");
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/__tests__/AlertsBell.test.tsx
```

Expected: FAIL — 호버 드롭다운/네비게이트 동작 없음.

- [ ] **Step 3: AlertsBell.tsx v2 구현**

`src/app/dashboard/_components/AlertsBell.tsx` 전체 교체:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DashWidget } from "./patterns/DashPattern";

const MAX_ITEMS = 5;
const HOVER_DELAY = 200;

export function AlertsBell({ items }: { items: DashWidget[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const router = useRouter();

  const urgent = useMemo(() => items.filter((i) => i.tone === "urgent"), [items]);
  const visible = useMemo(
    () => items.filter((i) => i.tone !== "ok").slice(0, MAX_ITEMS),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onMouseEnter = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY);
  };
  const onMouseLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-col items-end leading-none"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        aria-label={`알림 ${urgent.length}건`}
        onClick={(e) => {
          e.stopPropagation();
          router.push("/dashboard/alerts");
        }}
        className="relative inline-flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent p-0"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 stroke-chrome-graphite" fill="none" strokeWidth="1.5">
          <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9z" />
          <path d="M10 21a2 2 0 004 0" />
        </svg>
        {urgent.length > 0 ? (
          <span className="absolute -right-1 -top-1 bg-vermilion px-1 py-px text-2xs font-bold text-cream">
            {urgent.length}
          </span>
        ) : null}
      </button>
      <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.24em] text-chrome-muted">
        알림
      </span>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 w-[320px] border border-chrome-graphite bg-cream py-1 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-line-soft px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-vermilion">
            알림 · {urgent.length}건 긴급
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">새 알림 없음</p>
          ) : (
            <ul role="listbox" className="flex flex-col">
              {visible.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href="/dashboard/alerts"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-1.5 text-sm text-ink transition-colors hover:bg-vermilion hover:text-cream"
                  >
                    {alert.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/__tests__/AlertsBell.test.tsx
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/AlertsBell.tsx src/app/dashboard/_components/__tests__/AlertsBell.test.tsx
git commit -m "feat: AlertsBell v2 — hover 200ms 드롭다운 + 클릭 navigate"
```

---

## Task 5: ChromeUser

**Files:**
- Create: `src/app/dashboard/_components/chrome/ChromeUser.tsx`
- Create: `src/app/dashboard/_components/chrome/__tests__/ChromeUser.test.tsx`

**Goal:** displayName(풀네임) + 부제(team·role 또는 "관리자") 표시. 클릭 시 로그아웃 메뉴 (드롭다운)는 별도 task가 아닌 **AlertsBell처럼 인라인 dropdown**으로 같은 패턴.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_components/chrome/__tests__/ChromeUser.test.tsx`:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChromeUser } from "../ChromeUser";

describe("ChromeUser", () => {
  it("OPERATORS 매칭 사용자 — 풀네임 + 팀·직급", () => {
    render(
      <ChromeUser
        displayName="송영신"
        role="팀장"
        team="운영2팀"
      />
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("운영2팀 · 팀장")).toBeInTheDocument();
  });

  it("fallback(비-OPERATORS) — email username + 관리자", () => {
    render(
      <ChromeUser
        displayName="ysong2526"
        role="관리자"
        team={null}
      />
    );
    expect(screen.getByText("ysong2526")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/ChromeUser.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/chrome/ChromeUser.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/features/auth/actions";

type Props = {
  displayName: string;
  role: string;
  team: "운영1팀" | "운영2팀" | null;
};

export function ChromeUser({ displayName, role, team }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const subtitle = team ? `${team} · ${role}` : role;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex flex-col items-end leading-none border-none bg-transparent p-0 cursor-pointer"
      >
        <span className="text-sm font-bold text-chrome-graphite">{displayName}</span>
        <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.18em] text-chrome-muted">
          {subtitle}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 min-w-[200px] border border-chrome-graphite bg-cream py-1 text-ink [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="grid w-full grid-cols-[1fr_auto] items-center gap-2.5 border-none bg-transparent px-3 py-1.5 text-left text-xs hover:bg-vermilion hover:text-cream cursor-pointer"
          >
            <span>로그아웃</span>
            <span className="text-2xs tracking-[0.04em] text-muted">⇧⌘Q</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/ChromeUser.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/chrome/ChromeUser.tsx src/app/dashboard/_components/chrome/__tests__/ChromeUser.test.tsx
git commit -m "feat: ChromeUser — 풀네임 + 팀·직급 부제 + 로그아웃 드롭다운"
```

---

## Task 6: ChromeBrand

**Files:**
- Create: `src/app/dashboard/_components/chrome/ChromeBrand.tsx`

**Goal:** ▣ (검은 사각 + 안쪽 흰 사각) + `PIVOT` 워드마크 + `OPS DESK` tracked uppercase 부제. server component (상호작용 없음). 단순하므로 별도 단위 테스트 없이 Chrome 통합 테스트(Task 8)에서 검증.

- [ ] **Step 1: 구현**

`src/app/dashboard/_components/chrome/ChromeBrand.tsx`:

```tsx
export function ChromeBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden className="grid h-[18px] w-[18px] place-items-center bg-chrome-graphite">
        <span className="block h-2 w-2 bg-chrome-snow" />
      </span>
      <span className="text-base font-extrabold tracking-tight text-chrome-graphite">PIVOT</span>
      <span className="text-2xs font-bold uppercase tracking-[0.32em] text-chrome-muted">
        OPS DESK
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_components/chrome/ChromeBrand.tsx
git commit -m "feat: ChromeBrand — ▣ PIVOT OPS DESK 좌측 brand"
```

---

## Task 7: ChromeRight (조립)

**Files:**
- Create: `src/app/dashboard/_components/chrome/ChromeRight.tsx`

**Goal:** SessionTimer + AlertsBell + ChromeUser 우측 그리드. divider line으로 분리. mock alerts 데이터를 props로 받음 (layout이 페치).

- [ ] **Step 1: 구현**

`src/app/dashboard/_components/chrome/ChromeRight.tsx`:

```tsx
import { AlertsBell } from "../AlertsBell";
import type { DashWidget } from "../patterns/DashPattern";
import type { CurrentOperator } from "@/features/auth/queries";
import { ChromeUser } from "./ChromeUser";
import { SessionTimer } from "./SessionTimer";

type Props = {
  operator: CurrentOperator;
  alerts: DashWidget[];
};

export function ChromeRight({ operator, alerts }: Props) {
  return (
    <div className="flex items-center justify-end gap-5">
      <SessionTimer />
      <span aria-hidden className="h-5 w-px bg-chrome-muted/40" />
      <AlertsBell items={alerts} />
      <span aria-hidden className="h-5 w-px bg-chrome-muted/40" />
      <ChromeUser
        displayName={operator.displayName}
        role={operator.role}
        team={operator.team}
      />
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_components/chrome/ChromeRight.tsx
git commit -m "feat: ChromeRight — SessionTimer + AlertsBell + ChromeUser 조립"
```

---

## Task 8: Chrome (통합 그리드)

**Files:**
- Create: `src/app/dashboard/_components/chrome/Chrome.tsx`
- Create: `src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx`

**Goal:** 1fr 1fr 1fr 그리드, 높이 52px, 상하 2px chrome-graphite 보더, snow 배경. 좌·중·우 zone 조립. 데스크탑(≥md)만 노출.

- [ ] **Step 1: 실패 테스트 작성**

`src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chrome } from "../Chrome";

vi.mock("../SessionTimer", () => ({ SessionTimer: () => <div>15:00</div> }));
vi.mock("../../AlertsBell", () => ({ AlertsBell: () => <div>알림</div> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const operator = {
  email: "ys1114@jinhakapply.com",
  operator: null,
  displayName: "송영신",
  role: "팀장",
  team: "운영2팀" as const,
};

describe("Chrome", () => {
  it("좌측 PIVOT brand 노출", () => {
    render(<Chrome operator={operator} alerts={[]} />);
    expect(screen.getByText("PIVOT")).toBeInTheDocument();
    expect(screen.getByText("OPS DESK")).toBeInTheDocument();
  });

  it("우측 사용자 풀네임 + 부제 노출", () => {
    render(<Chrome operator={operator} alerts={[]} />);
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("운영2팀 · 팀장")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: RED 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx
```

Expected: FAIL — Cannot find module.

- [ ] **Step 3: 구현**

`src/app/dashboard/_components/chrome/Chrome.tsx`:

```tsx
import type { DashWidget } from "../patterns/DashPattern";
import type { CurrentOperator } from "@/features/auth/queries";
import { SearchBox } from "../SearchBox";
import { ChromeBrand } from "./ChromeBrand";
import { ChromeRight } from "./ChromeRight";

type Props = {
  operator: CurrentOperator;
  alerts: DashWidget[];
};

export function Chrome({ operator, alerts }: Props) {
  return (
    <div
      role="banner"
      className="relative z-[100] hidden h-[52px] grid-cols-[1fr_1fr_1fr] items-center border-y-2 border-chrome-graphite bg-chrome-snow px-[18px] md:grid"
    >
      <div className="justify-self-start">
        <ChromeBrand />
      </div>
      <div className="w-full max-w-[420px] justify-self-center">
        <SearchBox />
      </div>
      <ChromeRight operator={operator} alerts={alerts} />
    </div>
  );
}
```

- [ ] **Step 4: GREEN 확인**

```bash
npm test -- src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx
```

Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/chrome/Chrome.tsx src/app/dashboard/_components/chrome/__tests__/Chrome.test.tsx
git commit -m "feat: Chrome — 1fr/1fr/1fr 그리드 통합 (Brand+Search+Right)"
```

---

## Task 9: DashboardShell (sidebar state client wrapper)

**Files:**
- Create: `src/app/dashboard/_components/DashboardShell.tsx`

**Goal:** 기존 layout.tsx의 client 영역(sidebar drawer state, ESC handler, scroll lock, Scrim)만 추출. children + AppBar는 props로 받음. Chrome, StatusBar는 server이므로 children 자리에서 layout이 직접 렌더.

- [ ] **Step 1: 구현**

`src/app/dashboard/_components/DashboardShell.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { sidebarSections } from "../_data";
import { Sidebar } from "./Sidebar";

export function DashboardShell({
  chrome,
  appBar,
  statusBar,
  children,
}: {
  chrome: React.ReactNode;
  appBar: React.ReactNode;
  statusBar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="dashboard-shell relative z-10 grid h-screen grid-rows-[52px_1fr_26px] max-md:grid-rows-[48px_1fr] max-md:h-auto max-md:min-h-screen">
      {appBar /* 모바일 */}
      {chrome /* 데스크탑 — 52px */}
      <div className="grid grid-cols-[240px_1fr] overflow-hidden max-[1279px]:grid-cols-[200px_1fr] max-md:grid-cols-1">
        <Sidebar sections={sidebarSections} open={sidebarOpen} onClose={closeSidebar} />
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>
      {statusBar}
      <div
        onClick={closeSidebar}
        aria-hidden
        className={`fixed inset-0 z-[35] bg-ink/35 transition-opacity duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          sidebarOpen ? "block opacity-100" : "pointer-events-none hidden opacity-0"
        }`}
      />
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/_components/DashboardShell.tsx
git commit -m "feat: DashboardShell — sidebar drawer state + scroll lock client wrapper"
```

---

## Task 10: layout.tsx server 변환 + 기존 chrome 제거

**Files:**
- Modify: `src/app/dashboard/layout.tsx`
- Delete: `src/app/dashboard/_components/MenuBar.tsx`
- Delete: `src/app/dashboard/_components/__tests__/MenuBar.test.tsx`

**Goal:** layout을 server component로 전환. `getCurrentOperator()` + alerts mock 페치 → DashboardShell + Chrome 호출. AppBar(모바일)/StatusBar는 layout 내부 server function 그대로 유지(또는 추출). TitleBar는 삭제(Chrome으로 통합).

- [ ] **Step 1: layout.tsx 전체 교체**

`src/app/dashboard/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentOperator } from "@/features/auth/queries";
import { Chrome } from "./_components/chrome/Chrome";
import { DashboardShell } from "./_components/DashboardShell";
import { LiveClock } from "./_components/LiveClock";
import { getPatternMockData } from "./_data/patterns";
import type { DashWidget } from "./_components/patterns/DashPattern";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const operator = await getCurrentOperator();
  if (!operator) redirect("/login");

  const alerts = (getPatternMockData("alerts", "dash") as { widgets: DashWidget[] }).widgets;

  return (
    <DashboardShell
      chrome={<Chrome operator={operator} alerts={alerts} />}
      appBar={<AppBar />}
      statusBar={<StatusBar />}
    >
      {children}
    </DashboardShell>
  );
}

function AppBar() {
  return (
    <header
      role="banner"
      className="relative z-30 hidden h-12 items-center gap-2 border-b border-line bg-washi px-3 max-md:flex"
    >
      <div className="flex-1 text-center text-md font-semibold tracking-[0.02em]">
        PIVOT <em className="not-italic mx-0.5 text-vermilion">·</em> OPS DESK
      </div>
      <LiveClock />
    </header>
  );
}

function StatusBar() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-line bg-ink px-4 text-2xs tracking-[0.08em] text-cream max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-[25] max-md:h-6 max-md:px-3 max-md:text-xs">
      <div className="flex items-center gap-[18px] max-md:gap-3">
        <span className="opacity-75">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sage align-middle [box-shadow:var(--shadow-led-sage)]" />
          <span className="text-xs tracking-normal">연결됨</span>
        </span>
        <span className="opacity-75 max-md:hidden">
          <strong className="font-medium opacity-100">브랜치</strong> main
        </span>
        <span className="opacity-75">
          <strong className="font-medium opacity-100"><span className="text-xs tracking-normal">동기화</span></strong>{" "}
          <span className="text-xs tracking-normal">12초 전</span>
        </span>
      </div>
      <div className="flex items-center justify-center gap-[18px] max-md:hidden">
        <span className="opacity-75"><span className="text-xs tracking-normal">MS-2026-042 · 14,280 단어 · 47페이지 · 한/영</span></span>
      </div>
      <div className="flex items-center justify-end gap-[18px] max-md:gap-3">
        <span className="opacity-75 max-md:hidden">v 4.2.1</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MenuBar 및 테스트 삭제**

```bash
rm src/app/dashboard/_components/MenuBar.tsx src/app/dashboard/_components/__tests__/MenuBar.test.tsx
```

- [ ] **Step 3: 빌드 확인**

```bash
npx tsc --noEmit && npm run lint
```

Expected: 0 errors.

- [ ] **Step 4: 단위 테스트 회귀**

```bash
npm test
```

Expected: 모든 vitest 통과.

- [ ] **Step 5: dev 서버 시각 확인**

```bash
npm run dev
```

브라우저에서 `/dashboard` 진입 — PIVOT chrome 표시, sidebar drawer 동작, 사용자 풀네임 표기 확인.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/layout.tsx
git rm src/app/dashboard/_components/MenuBar.tsx src/app/dashboard/_components/__tests__/MenuBar.test.tsx
git commit -m "feat: layout server 변환 + Chrome/DashboardShell 통합, MenuBar/TitleBar 제거"
```

---

## Task 11: e2e 갱신

**Files:**
- Modify: `e2e/dashboard.spec.ts`

**Goal:** 기존 MenuBar `◆` / 검색 어설션을 Chrome PIVOT 어설션으로 교체. SessionTimer 초기 표시 + AlertsBell click navigate + 사용자 풀네임 검증.

- [ ] **Step 1: e2e spec 갱신**

`e2e/dashboard.spec.ts`에서 chrome 관련 어설션을 다음으로 교체:

```typescript
test("desktop chrome — PIVOT brand + 검색 + 우측 zone", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("PIVOT", { exact: true })).toBeVisible();
  await expect(page.getByText("OPS DESK")).toBeVisible();
  await expect(page.locator('input[placeholder*="검색"]')).toBeVisible();
  await expect(page.getByText("15:00")).toBeVisible();
  await expect(page.getByText("세션", { exact: true })).toBeVisible();
});

test("AlertsBell 클릭 시 /dashboard/alerts 이동", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /알림/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/alerts$/);
});
```

- [ ] **Step 2: e2e 실행**

```bash
npm run e2e -- dashboard
```

Expected: PASS (또는 production fixture에서 풀네임 매칭 OPERATORS 한 명).

- [ ] **Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test: e2e Chrome PIVOT 어설션 — brand/search/timer/alerts navigate"
```

---

## Task 12: 통합 검증 (DoD)

**Files:** 없음

**Goal:** 전체 검증 명령 5종 실행 + design-audit hook 0 위반 확인.

- [ ] **Step 1: lint**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 2: typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: 단위 테스트**

```bash
npm test
```

Expected: 모든 테스트 통과.

- [ ] **Step 4: e2e**

```bash
npm run e2e
```

Expected: 모든 spec 통과 (회귀 + 신규).

- [ ] **Step 5: design-audit**

```bash
bash .claude/hooks/design-lint.sh src/app/dashboard/_components/chrome/Chrome.tsx
```

Expected: 0 위반 (chrome 컴포넌트 모두 토큰 사용).

- [ ] **Step 6: dev 서버 최종 시각 확인**

```bash
npm run dev
```

브라우저:
- `/dashboard` — Chrome PIVOT 표시, sidebar drawer 동작
- 알림 호버 200ms → 드롭다운, 클릭 → `/dashboard/alerts`
- 세션 타이머 1초씩 감소, mousemove 시 15:00 reset
- 사용자 풀네임(또는 fallback) + 부제 표시
- 본인 ysong2526@gmail.com 로그인 → "ysong2526" + "관리자" 표시

- [ ] **Step 7: 최종 commit이 깨끗한지 확인**

```bash
git log --oneline main..HEAD
```

각 task별 commit 12개 이상 누적 확인.

---

## Self-Review

**1. Spec 커버리지** — spec 모든 섹션 → task 매핑:

| Spec 섹션 | 구현 task |
|---|---|
| 3.1 Identity | T6 (ChromeBrand) |
| 3.2 Layout 그리드 | T8 (Chrome), T9 (Shell) |
| 3.3 컴포넌트 트리 | T6, T7, T8, T9 |
| 3.4 Server/Client 경계 | T9, T10 |
| 3.5 사용자 정보 fetch | T2 (queries) |
| 3.6 SessionTimer | T3 |
| 3.7 AlertsBell v2 | T4 |
| 4. 디자인 토큰 | T1 |
| 5. 데이터 흐름 | T10 (layout 페치 + props) |
| 6. 에러 처리 | T2 (null user redirect는 T10 layout에서) |
| 7.1 단위 테스트 | T2-T5, T8 |
| 7.2 e2e | T11 |
| 7.3 시간 모킹 | T3 (vi.setSystemTime), T11 (선택적 page.clock) |
| 8. 영향 파일 | 모든 task |
| 9. 리스크 → 검증 | T10 (sidebar 회귀), T2 (fallback) |
| 10. DoD | T12 |

**누락 없음.**

**2. Placeholder scan**: 모든 step 코드/명령 명시됨. "TBD/적절히/추후" 없음.

**3. Type 일관성**:
- `CurrentOperator` (T2) → ChromeRight (T7), Chrome (T8), layout (T10)에서 동일하게 사용
- `DashWidget` (기존 타입) → AlertsBell, ChromeRight, Chrome, layout 일관
- `signOut` → SessionTimer (T3), ChromeUser (T5)에서 동일 import

**완료.**
