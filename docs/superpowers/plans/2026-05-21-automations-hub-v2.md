# 자동화 실행 v2 (토글 + 표준 테이블) Implementation Plan

> **For agentic workers:** subagent-driven-development, task-by-task, TDD, checkbox steps.

**Goal:** automations 허브를 카드→표준 테이블로 바꾸고, job별 "자동 실행" 토글(cron 제어 + 수동 버튼 활성/비활성)을 추가한다. 라벨 "자동화"→"자동화 실행", 메뉴 admin-only 명시화.

**기반:** v1(도메인 코어 + 카드 UI)이 feat/automations-hub에 머지 대기 중. 마이그레이션 `automation_settings`(job_id, enabled default false)는 이미 Supabase에 적용됨.

**참조:** spec `docs/superpowers/specs/2026-05-21-automations-hub-design.md` "v2 개정" 섹션.

---

### Task A: 도메인 — enabled 필드 + settings 쿼리 + 토글 스키마

**Files:** modify `types.ts`, `schemas.ts`, `queries.ts`; modify test `__tests__/schemas.test.ts`

- [ ] **A1 (RED): schemas.test.ts에 추가** — `setAutomationEnabledInputSchema` 테스트:
```ts
import { runAutomationInputSchema, setAutomationEnabledInputSchema } from "../schemas";
// ...기존 describe 유지, 아래 describe 추가
describe("setAutomationEnabledInputSchema", () => {
  it("정상 입력 파싱 성공", () => {
    expect(setAutomationEnabledInputSchema.safeParse({ jobId: "x", enabled: true }).success).toBe(true);
  });
  it("enabled 누락 거부", () => {
    expect(setAutomationEnabledInputSchema.safeParse({ jobId: "x" }).success).toBe(false);
  });
  it("jobId 빈 문자열 거부", () => {
    expect(setAutomationEnabledInputSchema.safeParse({ jobId: "", enabled: false }).success).toBe(false);
  });
});
```
Run `npm test -- src/features/automations/__tests__/schemas.test.ts` → FAIL (no export).

- [ ] **A2 (GREEN): schemas.ts에 추가:**
```ts
export const setAutomationEnabledInputSchema = z.object({
  jobId: z.string().min(1),
  enabled: z.boolean(),
});

export type SetAutomationEnabledInput = z.infer<typeof setAutomationEnabledInputSchema>;
```
Run test → PASS.

- [ ] **A3: types.ts — `AutomationStatus`에 `enabled: boolean` 추가** (cooldownRemainingMinutes 다음 줄):
```ts
  cooldownRemainingMinutes: number;
  enabled: boolean;
```

- [ ] **A4: queries.ts — settings 읽기 + getAutomationStatuses에 enabled 포함.**
import 아래(`AUTOMATION_JOBS` import 유지), `getInsightsLastRunAt` 위에 추가:
```ts
async function getAutomationSettings(): Promise<Map<string, boolean>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("automation_settings")
    .select("job_id, enabled");
  const map = new Map<string, boolean>();
  for (const row of data ?? []) {
    if (typeof row.job_id === "string") map.set(row.job_id, row.enabled === true);
  }
  return map;
}
```
`getAutomationStatuses` 본문 수정 — 루프 전에 settings fetch, 각 status에 enabled:
```ts
export async function getAutomationStatuses(): Promise<AutomationStatus[]> {
  const now = new Date();
  const settings = await getAutomationSettings();
  const out: AutomationStatus[] = [];
  for (const job of AUTOMATION_JOBS) {
    const lastRunAt = await getJobLastRunAt(job.id);
    out.push({
      id: job.id,
      label: job.label,
      description: job.description,
      scheduleInfo: job.scheduleInfo,
      cooldownMinutes: job.cooldownMinutes,
      lastRunAt,
      cooldownRemainingMinutes: computeCooldownRemaining(lastRunAt, job.cooldownMinutes, now),
      enabled: settings.get(job.id) ?? false,
    });
  }
  return out;
}
```
또한 액션이 단일 job enabled를 읽을 수 있게 export 추가:
```ts
export async function getJobEnabled(jobId: string): Promise<boolean> {
  const settings = await getAutomationSettings();
  return settings.get(jobId) ?? false;
}
```

- [ ] **A5: 검증** `npm run typecheck` (AutomationStatus를 만드는 다른 곳이 enabled 누락으로 깨지면 그곳도 수정 — 단 page.tsx는 getAutomationStatuses 결과를 그대로 넘기므로 영향 없음. 테스트 헬퍼 `base`는 Task E에서 갱신). `npm test -- schemas`.

- [ ] **A6: Commit** `git add src/features/automations/{types,schemas,queries}.ts src/features/automations/__tests__/schemas.test.ts && git commit -m "feat: 자동화 enabled 필드 + automation_settings 읽기 + 토글 스키마"`

---

### Task B: actions — setAutomationEnabledAction + run enabled 가드

**Files:** modify `actions.ts`; modify test `__tests__/actions.test.ts`

- [ ] **B1 (RED): actions.test.ts 보강.** 기존 mock에 추가 — `../queries` mock에 `getJobEnabled` 추가, `@/lib/supabase/admin` mock 추가. 기존 `vi.mock("../queries", ...)`를 다음으로 교체:
```ts
vi.mock("../queries", () => ({
  getJobLastRunAt: vi.fn(async () => null),
  computeCooldownRemaining: vi.fn(() => 0),
  getJobEnabled: vi.fn(async () => false),
}));
```
파일 상단 mock 블록에 추가:
```ts
const upsertMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: () => ({ upsert: upsertMock }),
  })),
}));
```
import에 추가: `import { runAutomationAction, setAutomationEnabledAction } from "../actions";` 및 `import { getJobEnabled } from "../queries";`
그리고 `const mockEnabled = getJobEnabled as unknown as ReturnType<typeof vi.fn>;`

기존 `runAutomationAction` describe에 추가:
```ts
  it("자동 실행(enabled) 상태면 수동 실행 거부 + run 미호출", async () => {
    const run = vi.fn();
    mockGetJob.mockReturnValue(fakeJob(run));
    mockEnabled.mockResolvedValue(true);
    const r = await runAutomationAction(undefined, fd("insights-collect"));
    expect(r?.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
```
새 describe:
```ts
describe("setAutomationEnabledAction", () => {
  beforeEach(() => vi.clearAllMocks());
  it("enabled 누락이면 ok:false", async () => {
    const f = new FormData();
    f.set("jobId", "insights-collect");
    const r = await setAutomationEnabledAction(undefined, f);
    expect(r?.ok).toBe(false);
  });
  it("정상 토글이면 upsert 호출 + revalidate + ok:true", async () => {
    const f = new FormData();
    f.set("jobId", "insights-collect");
    f.set("enabled", "1");
    const r = await setAutomationEnabledAction(undefined, f);
    expect(upsertMock).toHaveBeenCalled();
    expect(r?.ok).toBe(true);
  });
});
```
Run `npm test -- src/features/automations/__tests__/actions.test.ts` → FAIL (no setAutomationEnabledAction; enabled 가드 없음).

- [ ] **B2 (GREEN): actions.ts 수정.**
import 추가:
```ts
import { createAdminClient } from "@/lib/supabase/admin";
import {
  runAutomationInputSchema,
  setAutomationEnabledInputSchema,
} from "./schemas";
import {
  computeCooldownRemaining,
  getJobLastRunAt,
  getJobEnabled,
} from "./queries";
```
`runAutomationAction`에서 job null 체크 직후, `if (!force)` 앞에 enabled 가드 추가:
```ts
  if (await getJobEnabled(jobId)) {
    return {
      ok: false,
      message: "자동 실행 중에는 수동 실행할 수 없습니다. 자동 실행을 끄고 다시 시도하세요.",
    };
  }
```
파일 끝에 토글 액션 추가:
```ts
export async function setAutomationEnabledAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const parsed = setAutomationEnabledInputSchema.safeParse({
    jobId: formData.get("jobId"),
    enabled: formData.get("enabled") === "1",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { jobId, enabled } = parsed.data;
  if (!getJob(jobId)) {
    return { ok: false, message: `알 수 없는 자동화: ${jobId}` };
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("automation_settings")
    .upsert(
      { job_id: jobId, enabled, updated_at: new Date().toISOString() },
      { onConflict: "job_id" },
    );
  if (error) {
    return { ok: false, message: `설정 저장 실패: ${error.message}` };
  }

  revalidatePath("/dashboard/automations");
  return { ok: true, message: enabled ? "자동 실행 켜짐" : "자동 실행 꺼짐" };
}
```
Run test → 기존 5 + 신규 3 = 8 PASS.

- [ ] **B3: typecheck + lint.**

- [ ] **B4: Commit** `git add src/features/automations/actions.ts src/features/automations/__tests__/actions.test.ts && git commit -m "feat: 자동 실행 토글 액션 + 수동 실행 enabled 가드"`

---

### Task C: .mjs cron 게이트

**Files:** modify `scripts/insights-fetch.mjs`

- [ ] **C1:** supabase client 생성 직후(첫 fetch 전), enabled 확인 후 OFF면 skip. `createClient(...)`로 supabase를 만드는 위치를 찾아, 그 직후에 추가:
```js
// 자동 실행 토글 확인 — OFF/없음이면 skip (automation_settings, 기본 false)
{
  const { data: setting } = await supabase
    .from("automation_settings")
    .select("enabled")
    .eq("job_id", "insights-collect")
    .maybeSingle();
  if (!setting?.enabled) {
    console.log("insights-collect 자동 실행 비활성(automation_settings) — skip");
    process.exit(0);
  }
}
```
주의: `.mjs`는 스크립트 후반부에서 supabase client를 만든다(현재 upsert 직전). enabled 체크는 **YouTube fetch 이전**에 와야 quota를 아낀다. 따라서 supabase client 생성을 스크립트 상단(env 검증 직후)으로 옮기고, 거기서 enabled 체크 → skip. 기존 후반 `createClient` 호출은 제거하고 상단에서 만든 client 재사용.
- [ ] **C2:** 로컬 검증 — `node scripts/insights-fetch.mjs` 실행 시(테이블에 insights-collect=true면 동작, false/없음이면 "skip" 로그 후 exit 0). DB write 부작용 주의: enabled=true로 켜둔 상태라면 실제 적재되므로, 검증은 enabled=false 상태에서 "skip" 로그만 확인 권장.
- [ ] **C3: Commit** `git add scripts/insights-fetch.mjs && git commit -m "feat: insights-fetch cron이 automation_settings enabled 확인 후 실행"`

---

### Task D: 사이드바 adminOnly + 라벨 변경 + permission 필터

**Files:** modify `_data.ts`, `_data/page-meta-config.ts`, `features/auth/permission.ts`; modify test `features/auth/__tests__/permission.test.ts` (경로 확인 후)

- [ ] **D1 (RED): permission 테스트에 adminOnly 케이스 추가.** 기존 filterSidebarSections 테스트 파일을 찾아(`grep -rl filterSidebarSections src/features/auth`), adminOnly 항목이 비-admin에게 숨겨지고 admin에게 보이는 테스트 추가. 예:
```ts
it("adminOnly 항목은 비-admin에게 숨겨진다", () => {
  const sections = [{ title: "T", entries: [
    { kind: "group", label: "G", items: [
      { ico: "·", label: "관리자전용", slug: "x", adminOnly: true },
      { ico: "·", label: "일반", slug: "y" },
    ] },
  ] }];
  const member = { permission: "member", allowedMenus: ["x", "y"] } as never;
  const result = filterSidebarSections(sections as never, member);
  const labels = result[0].entries.flatMap((e) => "items" in e ? e.items.map((i) => i.label) : []);
  expect(labels).toContain("일반");
  expect(labels).not.toContain("관리자전용");
});
it("adminOnly 항목도 admin에게는 보인다", () => {
  const sections = [{ title: "T", entries: [
    { kind: "group", label: "G", items: [{ ico: "·", label: "관리자전용", slug: "x", adminOnly: true }] },
  ] }];
  const admin = { permission: "admin", allowedMenus: [] } as never;
  const result = filterSidebarSections(sections as never, admin);
  const labels = result[0].entries.flatMap((e) => "items" in e ? e.items.map((i) => i.label) : []);
  expect(labels).toContain("관리자전용");
});
```
(기존 테스트 파일의 import/스타일에 맞춰 조정.) Run → FAIL.

- [ ] **D2 (GREEN): `_data.ts` SbItem에 `adminOnly?: boolean` 추가:**
```ts
export type SbItem = {
  ico: string;
  label: string;
  count?: string;
  slug?: string;
  pattern?: SbPattern;
  adminOnly?: boolean;
};
```

- [ ] **D3: permission.ts `filterSidebarSections` — adminOnly 필터.** item 분기와 group inner filter 양쪽에 adminOnly 체크 추가. `canViewMenu` 통과 조건에 더해, `adminOnly`면 admin만:
```ts
function canSeeItem(item: SbItem, operator: CurrentOperator | null): boolean {
  if (item.adminOnly && operator?.permission !== "admin") return false;
  if (!item.slug) return true;
  return canViewMenu(item.slug, operator);
}
```
그리고 item/group 양쪽에서 `canSeeItem` 사용하도록 교체 (기존 `!entry.slug` / `canViewMenu` 직접 호출 부분). `SbItem` import 필요 시 추가.
Run permission test → PASS.

- [ ] **D4: `_data.ts` automations 항목 — 라벨 + adminOnly.** "AI & 자동화" 그룹의 automations 항목을:
```ts
          {
            ico: "·",
            label: "자동화 실행",
            slug: "automations",
            pattern: "list",
            adminOnly: true,
          },
```

- [ ] **D5: `page-meta-config.ts` automations title 변경:** `title: "자동화"` → `title: "자동화 실행"`.

- [ ] **D6: 검증** `npm test -- (permission 테스트) src/app/dashboard/__tests__/_data.test.ts src/app/dashboard/_data/__tests__/page-meta-config.test.ts` + typecheck.

- [ ] **D7: Commit** `git add src/app/dashboard/_data.ts src/app/dashboard/_data/page-meta-config.ts src/features/auth/permission.ts (+permission test) && git commit -m "feat: 자동화 실행 메뉴 admin-only(adminOnly 플래그) + 라벨 변경"`

---

### Task E: UI — 표준 테이블 + 토글 + enabled 인지 실행 버튼

**Files:** rewrite `automations/_components/AutomationHub.tsx`; update test `__tests__/AutomationHub.test.tsx`

- [ ] **E1 (RED): AutomationHub.test.tsx 갱신.** `base`에 `enabled: false` 추가. 테스트를 테이블 기준으로 갱신:
```tsx
const base: AutomationStatus = {
  id: "insights-collect", label: "인사이트 영상 수집", description: "설명",
  scheduleInfo: "매일 08:00", cooldownMinutes: 60, lastRunAt: null,
  cooldownRemainingMinutes: 0, enabled: false,
};

describe("AutomationHub", () => {
  it("잡 label과 스케줄을 렌더한다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByText("인사이트 영상 수집")).toBeInTheDocument();
    expect(screen.getByText(/매일 08:00/)).toBeInTheDocument();
  });
  it("enabled=false면 '지금 실행' 버튼 활성", () => {
    render(<AutomationHub statuses={[base]} />);
    const btn = screen.getByRole("button", { name: /지금 실행/ });
    expect(btn).toBeEnabled();
  });
  it("enabled=true면 실행 버튼 비활성 + '자동 실행 중' 표시", () => {
    render(<AutomationHub statuses={[{ ...base, enabled: true }]} />);
    expect(screen.getByText(/자동 실행 중/)).toBeInTheDocument();
  });
  it("자동 실행 토글 컨트롤이 있다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: /자동 실행/ })).toBeInTheDocument();
  });
  it("쿨다운 중(enabled=false)이면 잔여 분을 표시한다", () => {
    render(<AutomationHub statuses={[{ ...base, cooldownRemainingMinutes: 31 }]} />);
    expect(screen.getByText(/31분/)).toBeInTheDocument();
  });
});
```
Run → FAIL (현재 컴포넌트는 enabled 미지원/카드).

- [ ] **E2 (GREEN): AutomationHub.tsx 재작성 (표준 테이블).** services Table.tsx 스타일(`<table className="w-full text-sm">`, `thead` `border-b border-line text-xs ... text-muted`). 컬럼: 자동화(label+설명) / 스케줄·마지막 실행 / 자동 실행(토글) / 수동 실행(버튼+결과). 토큰 색만.
```tsx
"use client";

import { useActionState, useState } from "react";
import {
  runAutomationAction,
  setAutomationEnabledAction,
  type RunActionState,
} from "@/features/automations/actions";
import type { AutomationStatus } from "@/features/automations/types";

export function AutomationHub({ statuses }: { statuses: AutomationStatus[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">자동화</th>
          <th className="px-3 py-2">스케줄 · 마지막 실행</th>
          <th className="px-3 py-2">자동 실행</th>
          <th className="px-3 py-2">수동 실행</th>
        </tr>
      </thead>
      <tbody>
        {statuses.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
              등록된 자동화가 없습니다.
            </td>
          </tr>
        ) : (
          statuses.map((s) => <AutomationRow key={s.id} status={s} />)
        )}
      </tbody>
    </table>
  );
}

function AutomationRow({ status }: { status: AutomationStatus }) {
  return (
    <tr className="border-b border-line align-top">
      <td className="px-3 py-3">
        <div className="font-semibold text-ink">{status.label}</div>
        <div className="mt-0.5 text-xs leading-[1.5] text-muted">{status.description}</div>
      </td>
      <td className="px-3 py-3 text-xs text-muted">
        <div>{status.scheduleInfo}</div>
        <div className="mt-0.5">
          {status.lastRunAt
            ? `마지막 실행 ${new Date(status.lastRunAt).toLocaleString("ko-KR")}`
            : "실행 기록 없음"}
        </div>
      </td>
      <td className="px-3 py-3">
        <EnabledToggle status={status} />
      </td>
      <td className="px-3 py-3">
        <RunControl status={status} />
      </td>
    </tr>
  );
}

function EnabledToggle({ status }: { status: AutomationStatus }) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    setAutomationEnabledAction,
    undefined,
  );
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="jobId" value={status.id} />
      <input type="hidden" name="enabled" value={status.enabled ? "0" : "1"} />
      <button
        type="submit"
        disabled={pending}
        aria-pressed={status.enabled}
        className={`rounded-full px-3 py-1 text-xs font-medium disabled:opacity-50 ${
          status.enabled
            ? "bg-vermilion text-cream"
            : "border border-line text-muted"
        }`}
      >
        자동 실행 {status.enabled ? "켜짐" : "꺼짐"}
      </button>
      {state && !state.ok ? (
        <span className="text-xs text-vermilion">{state.message}</span>
      ) : null}
    </form>
  );
}

function RunControl({ status }: { status: AutomationStatus }) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    runAutomationAction,
    undefined,
  );
  const [armedAgainst, setArmedAgainst] = useState<{ state: RunActionState } | null>(null);
  const confirming = armedAgainst !== null && armedAgainst.state === state;
  const inCooldown = status.cooldownRemainingMinutes > 0;

  if (status.enabled) {
    return <span className="text-xs text-muted">자동 실행 중 (수동 비활성)</span>;
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <input type="hidden" name="jobId" value={status.id} />
        {!inCooldown ? (
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-ink px-3 py-1.5 text-xs font-medium text-cream disabled:opacity-50"
          >
            {pending ? "실행 중…" : "지금 실행"}
          </button>
        ) : !confirming ? (
          <button
            type="button"
            onClick={() => setArmedAgainst({ state })}
            className="rounded-md border border-vermilion px-3 py-1.5 text-xs font-medium text-vermilion"
          >
            쿨다운 {status.cooldownRemainingMinutes}분 — 강제 실행
          </button>
        ) : (
          <button
            type="submit"
            name="force"
            value="1"
            disabled={pending}
            className="rounded-md bg-vermilion px-3 py-1.5 text-xs font-medium text-cream disabled:opacity-50"
          >
            {pending ? "실행 중…" : "quota 소모 — 확인"}
          </button>
        )}
      </form>
      {state ? (
        <span className={`text-xs ${state.ok ? "text-ink" : "text-vermilion"}`}>
          {state.message}
        </span>
      ) : null}
    </div>
  );
}
```
Run `npm test -- src/app/dashboard/automations/_components/__tests__/AutomationHub.test.tsx` → 5 PASS.

- [ ] **E3: typecheck + lint** (react-compiler: derived-state 패턴 유지 — useEffect 금지).

- [ ] **E4: Commit** `git add src/app/dashboard/automations/_components/ && git commit -m "feat: 자동화 실행 표준 테이블 UI + 자동 실행 토글 + enabled 인지 실행 버튼"`

---

### Task F: 전체 검증

- [ ] **F1:** `npm run lint` / `npm run typecheck` (stale .next/types면 `rm -rf .next` 후 재시도) / `npm test` — 전부 PASS.
- [ ] **F2: dev 수동(사용자)** — admin 로그인 → "분석·AI > AI & 자동화 > 자동화 실행" → 테이블 확인 → 토글 ON/OFF → 버튼 활성/비활성 전환 → OFF에서 "지금 실행" → insight_videos 적재 확인. 비-admin은 메뉴 안 보임 확인.

## Self-Review
- spec v2 전 항목 매핑: 라벨(D4/D5) / 테이블(E) / 토글+가드(B) / cron 게이트(C) / settings 읽기·enabled(A) / adminOnly(D) / 마이그(이미 적용). ✅
- 타입 일관성: `enabled` (A: types) → queries(A) → status(E props) → 토글 액션(B). `getJobEnabled`(A)→action(B). `setAutomationEnabledInputSchema`(A)→action(B). `RunActionState` 재사용(B/E). ✅
- 리스크: (1) AutomationStatus enabled 추가로 테스트 헬퍼 `base` 갱신 필요(E1에서 처리). (2) permission 테스트 파일 경로/스타일은 실제 확인 후 맞춤. (3) .mjs client 위치 이동 시 기존 upsert가 같은 client 재사용하는지 확인.
