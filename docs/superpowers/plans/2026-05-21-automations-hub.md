# 운영 자동화 허브 (automations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** admin이 `/dashboard/automations`에서 버튼으로 인사이트 수집을 즉시 실행할 수 있게 하고, 자동화를 registry 패턴으로 등록한다.

**Architecture:** `features/automations/`에 job descriptor registry + insights-collect 잡(`.mjs` 로직 TS 포팅)을 만들고, admin 전용 server action으로 트리거한다. 마지막 실행은 `insight_videos.max(collected_at)`로 도출(마이그레이션 0). 페이지는 프로젝트 표준 형식(PageHeader + design-tokens).

**Tech Stack:** Next.js App Router, TypeScript, zod, Supabase(@supabase/ssr + service-role admin client), Vitest, Tailwind v4.

**참조 사항:**
- `SEARCH_QUERIES`는 이미 `src/features/insight-videos/schemas.ts`에 있음 → **재정의 금지, import 재사용**.
- `requireAdmin()` = `src/features/auth/permission.ts`, `createAdminClient()` = `src/lib/supabase/admin.ts`.
- `useActionState<State, FormData>(action, undefined)` 패턴 (`src/app/forgot-password/page.tsx` 참고).
- 하드코딩 색 금지 — washi/ink/cream/vermilion/muted/faint 토큰 클래스만.

---

### Task 1: types + 입력 스키마

**Files:**
- Create: `src/features/automations/types.ts`
- Create: `src/features/automations/schemas.ts`
- Test: `src/features/automations/__tests__/schemas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/automations/__tests__/schemas.test.ts
import { describe, it, expect } from "vitest";
import { runAutomationInputSchema } from "../schemas";

describe("runAutomationInputSchema", () => {
  it("정상 입력 파싱 성공", () => {
    const r = runAutomationInputSchema.safeParse({ jobId: "insights-collect", force: false });
    expect(r.success).toBe(true);
  });

  it("jobId 빈 문자열 거부", () => {
    const r = runAutomationInputSchema.safeParse({ jobId: "", force: false });
    expect(r.success).toBe(false);
  });

  it("force 누락 거부", () => {
    const r = runAutomationInputSchema.safeParse({ jobId: "x" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/automations/__tests__/schemas.test.ts`
Expected: FAIL — `Cannot find module '../schemas'`

- [ ] **Step 3: Write types.ts**

```ts
// src/features/automations/types.ts
export type AutomationRunResult = {
  ok: boolean;
  message: string;
  details?: Record<string, number>;
};

export type AutomationJob = {
  id: string;
  label: string;
  description: string;
  scheduleInfo: string;
  cooldownMinutes: number;
  run: () => Promise<AutomationRunResult>;
};

export type AutomationStatus = {
  id: string;
  label: string;
  description: string;
  scheduleInfo: string;
  cooldownMinutes: number;
  lastRunAt: string | null;
  cooldownRemainingMinutes: number;
};
```

- [ ] **Step 4: Write schemas.ts**

```ts
// src/features/automations/schemas.ts
import { z } from "zod";

export const runAutomationInputSchema = z.object({
  jobId: z.string().min(1),
  force: z.boolean(),
});

export type RunAutomationInput = z.infer<typeof runAutomationInputSchema>;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/features/automations/__tests__/schemas.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/features/automations/types.ts src/features/automations/schemas.ts src/features/automations/__tests__/schemas.test.ts
git commit -m "feat: automations 도메인 타입 + 실행 입력 스키마"
```

---

### Task 2: insights-collect 순수 헬퍼

**Files:**
- Create: `src/features/automations/jobs/insights-collect.ts` (헬퍼 + 타입만, run은 Task 3)
- Test: `src/features/automations/__tests__/insights-collect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/automations/__tests__/insights-collect.test.ts
import { describe, it, expect } from "vitest";
import {
  batchIds,
  dedupeByVideoId,
  filterPopular,
  rankTopN,
  type CollectedVideo,
} from "../jobs/insights-collect";

function v(id: string, view?: number): CollectedVideo {
  return {
    video_id: id,
    title: "t",
    channel_title: "c",
    thumbnail_url: "u",
    published_at: "2026-05-10T00:00:00Z",
    description: null,
    keyword: "k",
    view_count: view,
  };
}

describe("batchIds", () => {
  it("50개 초과를 50씩 분할", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `id${i}`);
    const out = batchIds(ids, 50);
    expect(out.map((b) => b.length)).toEqual([50, 50, 20]);
  });
  it("빈 배열은 빈 결과", () => {
    expect(batchIds([], 50)).toEqual([]);
  });
});

describe("dedupeByVideoId", () => {
  it("같은 video_id는 첫 항목만 유지", () => {
    const out = dedupeByVideoId([v("a", 1), v("a", 2), v("b", 3)]);
    expect(out.map((r) => r.video_id)).toEqual(["a", "b"]);
    expect(out[0].view_count).toBe(1);
  });
});

describe("filterPopular", () => {
  it("임계값 미만 제외, null view_count는 통과", () => {
    const out = filterPopular([v("a", 5000), v("b", 20000), v("c", undefined)], 10000);
    expect(out.map((r) => r.video_id)).toEqual(["b", "c"]);
  });
});

describe("rankTopN", () => {
  it("view_count 내림차순 상위 N (null은 후순위)", () => {
    const out = rankTopN([v("a", 100), v("b", 300), v("c", undefined), v("d", 200)], 2);
    expect(out.map((r) => r.video_id)).toEqual(["b", "d"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/automations/__tests__/insights-collect.test.ts`
Expected: FAIL — `Cannot find module '../jobs/insights-collect'`

- [ ] **Step 3: Write helpers (run은 다음 태스크)**

```ts
// src/features/automations/jobs/insights-collect.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEARCH_QUERIES } from "@/features/insight-videos/schemas";
import type { AutomationRunResult } from "../types";

export const MIN_VIEW_COUNT = 10_000;
export const MAX_UPSERT_PER_RUN = 10;
export const PUBLISHED_AFTER_DAYS = 14;
export const VIDEOS_LIST_BATCH = 50;
export const CLEANUP_DAYS = 60;

export type CollectedVideo = {
  video_id: string;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string;
  description: string | null;
  keyword: string;
  view_count?: number;
};

export function batchIds(ids: string[], size: number): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

export function dedupeByVideoId(items: CollectedVideo[]): CollectedVideo[] {
  const map = new Map<string, CollectedVideo>();
  for (const it of items) {
    if (!it.video_id) continue;
    if (!map.has(it.video_id)) map.set(it.video_id, it);
  }
  return Array.from(map.values());
}

export function filterPopular(rows: CollectedVideo[], minViews: number): CollectedVideo[] {
  return rows.filter((r) => r.view_count == null || r.view_count >= minViews);
}

export function rankTopN(rows: CollectedVideo[], n: number): CollectedVideo[] {
  return [...rows]
    .sort((a, b) => (b.view_count ?? -1) - (a.view_count ?? -1))
    .slice(0, n);
}
```

> 주의: 이 단계에서는 `createAdminClient` / `SEARCH_QUERIES` / `AutomationRunResult` import가 미사용이라 lint 경고가 날 수 있다. Task 3에서 `runInsightsCollect`를 추가하며 모두 사용되므로, **Task 2 커밋 전 Task 3 Step 3까지 함께 작성**하거나, 이 import 3줄을 Task 3에서 추가한다. 권장: import 3줄을 Task 3 시작 시 추가.

수정: Task 2에서는 아래 import만 둔다.

```ts
// src/features/automations/jobs/insights-collect.ts (Task 2 버전 상단)
```
(상단 import 없이 헬퍼 4개 + 상수 + `CollectedVideo` 타입만 작성. `server-only`/admin/SEARCH_QUERIES/AutomationRunResult import는 Task 3에서 추가)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/automations/__tests__/insights-collect.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/automations/jobs/insights-collect.ts src/features/automations/__tests__/insights-collect.test.ts
git commit -m "feat: insights-collect 순수 헬퍼 (batch/dedupe/filter/rank)"
```

---

### Task 3: insights-collect run() 오케스트레이션

**Files:**
- Modify: `src/features/automations/jobs/insights-collect.ts` (상단 import 추가 + run 함수 추가)

이 단계는 외부 YouTube API + Supabase 호출이라 단위 테스트 대신 dev 수동 검증(Task 8)으로 확인한다. (network/IO 경계 — 헬퍼는 Task 2에서 이미 테스트됨)

- [ ] **Step 1: 파일 상단에 import 추가**

`insights-collect.ts` 맨 위에 추가:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEARCH_QUERIES } from "@/features/insight-videos/schemas";
import type { AutomationRunResult } from "../types";
```

- [ ] **Step 2: YouTube 응답 타입 + searchVideos 추가**

헬퍼 아래에 추가:

```ts
type YtSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
    publishedAt?: string;
    description?: string;
  };
};
type YtSearchResponse = { items?: YtSearchItem[] };
type YtVideoItem = {
  id?: string;
  snippet?: { description?: string };
  statistics?: { viewCount?: string };
};
type YtVideosResponse = { items?: YtVideoItem[] };

async function searchVideos(
  keyword: string,
  apiKey: string,
  publishedAfter: string,
): Promise<CollectedVideo[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "10",
    order: "viewCount",
    publishedAfter,
    q: keyword,
    key: apiKey,
  });
  const url = `https://www.googleapis.com/youtube/v3/search?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`search.list ${keyword} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as YtSearchResponse;
  return (json.items ?? []).map((it) => ({
    video_id: it.id?.videoId ?? "",
    title: it.snippet?.title ?? "",
    channel_title: it.snippet?.channelTitle ?? "",
    thumbnail_url:
      it.snippet?.thumbnails?.medium?.url ??
      it.snippet?.thumbnails?.default?.url ??
      "",
    published_at: it.snippet?.publishedAt ?? new Date().toISOString(),
    description: (it.snippet?.description ?? "").slice(0, 600) || null,
    keyword,
  }));
}
```

- [ ] **Step 3: runInsightsCollect 추가**

```ts
export async function runInsightsCollect(): Promise<AutomationRunResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return { ok: false, message: "YOUTUBE_API_KEY 환경 변수가 없습니다." };
  }

  const publishedAfter = new Date(
    Date.now() - PUBLISHED_AFTER_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const collected: CollectedVideo[] = [];
  const errors: string[] = [];
  for (const q of SEARCH_QUERIES) {
    try {
      const items = await searchVideos(q, apiKey, publishedAfter);
      for (const it of items) {
        if (!it.video_id || !it.title || !it.channel_title || !it.thumbnail_url) continue;
        collected.push(it);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const rows = dedupeByVideoId(collected);
  if (rows.length === 0) {
    return {
      ok: errors.length === 0,
      message: errors.length ? `수집 실패: ${errors.length}건` : "수집된 영상이 없습니다.",
      details: { collected: 0, errors: errors.length },
    };
  }

  // videos.list 50개씩 batch — full description + view_count 보강
  const idBatches = batchIds(rows.map((r) => r.video_id), VIDEOS_LIST_BATCH);
  const descMap = new Map<string, string>();
  const viewMap = new Map<string, number>();
  for (const batch of idBatches) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${batch.join(",")}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`videos.list HTTP ${res.status}`);
        continue;
      }
      const json = (await res.json()) as YtVideosResponse;
      for (const item of json.items ?? []) {
        if (!item.id) continue;
        const full = (item.snippet?.description ?? "").slice(0, 600);
        if (full) descMap.set(item.id, full);
        const vc = Number(item.statistics?.viewCount);
        if (Number.isFinite(vc) && vc >= 0) viewMap.set(item.id, vc);
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }

  const enriched: CollectedVideo[] = rows.map((r) => ({
    ...r,
    description: descMap.get(r.video_id) ?? r.description,
    view_count: viewMap.get(r.video_id) ?? r.view_count,
  }));

  const topN = rankTopN(filterPopular(enriched, MIN_VIEW_COUNT), MAX_UPSERT_PER_RUN);
  if (topN.length === 0) {
    return {
      ok: true,
      message: "임계값을 넘는 신규 영상이 없습니다.",
      details: { collected: rows.length, upserted: 0, errors: errors.length },
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("insight_videos")
    .upsert(topN, { onConflict: "video_id", ignoreDuplicates: false })
    .select("video_id");
  if (error) {
    return { ok: false, message: `upsert 실패: ${error.message}` };
  }

  const cleanupCutoff = new Date(
    Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: deleted } = await supabase
    .from("insight_videos")
    .delete()
    .lt("collected_at", cleanupCutoff)
    .select("id");

  return {
    ok: true,
    message: `${data?.length ?? 0}건 적재, ${deleted?.length ?? 0}건 정리`,
    details: {
      upserted: data?.length ?? 0,
      cleaned: deleted?.length ?? 0,
      errors: errors.length,
    },
  };
}
```

- [ ] **Step 4: typecheck**

Run: `npm run typecheck`
Expected: 에러 없음 (미사용 import 해소)

- [ ] **Step 5: Commit**

```bash
git add src/features/automations/jobs/insights-collect.ts
git commit -m "feat: runInsightsCollect — YouTube 수집→upsert→cleanup (videos.list 50 batch)"
```

---

### Task 4: registry

**Files:**
- Create: `src/features/automations/registry.ts`
- Test: `src/features/automations/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/automations/__tests__/registry.test.ts
import { describe, it, expect } from "vitest";
import { AUTOMATION_JOBS, getJob } from "../registry";

describe("automation registry", () => {
  it("insights-collect 잡이 등록되어 있다", () => {
    const job = getJob("insights-collect");
    expect(job).toBeDefined();
    expect(job?.label).toBeTruthy();
    expect(job?.cooldownMinutes).toBe(60);
    expect(typeof job?.run).toBe("function");
  });

  it("모든 잡은 고유 id를 가진다", () => {
    const ids = AUTOMATION_JOBS.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("없는 id는 undefined", () => {
    expect(getJob("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/automations/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '../registry'`

- [ ] **Step 3: Write registry.ts**

```ts
// src/features/automations/registry.ts
import "server-only";
import type { AutomationJob } from "./types";
import { runInsightsCollect } from "./jobs/insights-collect";

export const AUTOMATION_JOBS: AutomationJob[] = [
  {
    id: "insights-collect",
    label: "인사이트 영상 수집",
    description:
      "YouTube에서 키워드별 인기 영상을 수집해 인사이트 페이지에 적재합니다.",
    scheduleInfo: "매일 08:00 자동 (GitHub Actions)",
    cooldownMinutes: 60,
    run: runInsightsCollect,
  },
];

export function getJob(id: string): AutomationJob | undefined {
  return AUTOMATION_JOBS.find((j) => j.id === id);
}
```

> 주의: `registry.ts`가 `server-only`인 `insights-collect`를 import하므로 테스트는 서버 환경에서 동작해야 한다. Vitest 설정상 `server-only`가 문제되면 `import "server-only"` 줄을 registry에서 제거하고 jobs 파일에만 남긴다(jobs는 admin client 사용으로 server 전용 유지). 테스트 실패 시 이 줄을 빼고 재실행.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/automations/__tests__/registry.test.ts`
Expected: PASS (3 tests). 만약 `server-only` import 에러면 위 주의대로 registry.ts의 `import "server-only";` 제거 후 재실행.

- [ ] **Step 5: Commit**

```bash
git add src/features/automations/registry.ts src/features/automations/__tests__/registry.test.ts
git commit -m "feat: automation registry (seed: insights-collect)"
```

---

### Task 5: 쿨다운 계산 + 상태 쿼리

**Files:**
- Create: `src/features/automations/queries.ts`
- Test: `src/features/automations/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/automations/__tests__/queries.test.ts
import { describe, it, expect } from "vitest";
import { computeCooldownRemaining } from "../queries";

const now = new Date("2026-05-21T12:00:00Z");

describe("computeCooldownRemaining", () => {
  it("lastRunAt 없으면 0", () => {
    expect(computeCooldownRemaining(null, 60, now)).toBe(0);
  });

  it("쿨다운 경과 시 0", () => {
    const last = new Date("2026-05-21T10:00:00Z").toISOString(); // 120분 전
    expect(computeCooldownRemaining(last, 60, now)).toBe(0);
  });

  it("쿨다운 진행 중이면 올림한 잔여 분", () => {
    const last = new Date("2026-05-21T11:30:30Z").toISOString(); // 29분 30초 전
    // 60 - 29.5 = 30.5분 남음 → ceil = 31
    expect(computeCooldownRemaining(last, 60, now)).toBe(31);
  });

  it("정확히 쿨다운 경계는 0", () => {
    const last = new Date("2026-05-21T11:00:00Z").toISOString(); // 정확히 60분 전
    expect(computeCooldownRemaining(last, 60, now)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/automations/__tests__/queries.test.ts`
Expected: FAIL — `Cannot find module '../queries'`

- [ ] **Step 3: Write queries.ts**

```ts
// src/features/automations/queries.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { AUTOMATION_JOBS } from "./registry";
import type { AutomationStatus } from "./types";

export function computeCooldownRemaining(
  lastRunAt: string | null,
  cooldownMinutes: number,
  now: Date,
): number {
  if (!lastRunAt) return 0;
  const elapsedMs = now.getTime() - new Date(lastRunAt).getTime();
  const remainingMs = cooldownMinutes * 60_000 - elapsedMs;
  if (remainingMs <= 0) return 0;
  return Math.ceil(remainingMs / 60_000);
}

async function getInsightsLastRunAt(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("insight_videos")
    .select("collected_at")
    .order("collected_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.collected_at ?? null;
}

// job별 "마지막 실행 시각" 도출기. 신규 잡 추가 시 여기에 매핑 1줄.
const LAST_RUN_RESOLVERS: Record<string, () => Promise<string | null>> = {
  "insights-collect": getInsightsLastRunAt,
};

export async function getJobLastRunAt(jobId: string): Promise<string | null> {
  const resolver = LAST_RUN_RESOLVERS[jobId];
  return resolver ? resolver() : null;
}

export async function getAutomationStatuses(): Promise<AutomationStatus[]> {
  const now = new Date();
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
      cooldownRemainingMinutes: computeCooldownRemaining(
        lastRunAt,
        job.cooldownMinutes,
        now,
      ),
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/automations/__tests__/queries.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/automations/queries.ts src/features/automations/__tests__/queries.test.ts
git commit -m "feat: 자동화 쿨다운 계산 + 상태 쿼리 (max collected_at 기반)"
```

---

### Task 6: runAutomationAction 서버 액션

**Files:**
- Create: `src/features/automations/actions.ts`

이 액션은 `requireAdmin()`(redirect side-effect) + DB를 호출하므로 단위 테스트 대신 dev 수동 검증(Task 8). 로직은 위 태스크들의 테스트된 함수 조합.

- [ ] **Step 1: Write actions.ts**

```ts
// src/features/automations/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/features/auth/permission";
import { runAutomationInputSchema } from "./schemas";
import { getJob } from "./registry";
import { computeCooldownRemaining, getJobLastRunAt } from "./queries";
import type { AutomationRunResult } from "./types";

export type RunActionState = AutomationRunResult | undefined;

export async function runAutomationAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const parsed = runAutomationInputSchema.safeParse({
    jobId: formData.get("jobId"),
    force: formData.get("force") === "1",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const { jobId, force } = parsed.data;
  const job = getJob(jobId);
  if (!job) {
    return { ok: false, message: `알 수 없는 자동화: ${jobId}` };
  }

  if (!force) {
    const lastRunAt = await getJobLastRunAt(jobId);
    const remaining = computeCooldownRemaining(lastRunAt, job.cooldownMinutes, new Date());
    if (remaining > 0) {
      return {
        ok: false,
        message: `최근 실행 후 ${remaining}분 남았습니다. 강제 실행하려면 다시 확인하세요.`,
        details: { cooldownRemaining: remaining },
      };
    }
  }

  const result = await job.run();
  revalidatePath("/dashboard/automations");
  revalidatePath("/dashboard/ai-insight");
  return result;
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
git add src/features/automations/actions.ts
git commit -m "feat: runAutomationAction (admin 가드 + 쿨다운 + revalidate)"
```

---

### Task 7: 허브 페이지 + AutomationHub 클라이언트

**Files:**
- Create: `src/app/dashboard/automations/page.tsx`
- Create: `src/app/dashboard/automations/_components/AutomationHub.tsx`
- Test: `src/app/dashboard/automations/_components/__tests__/AutomationHub.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
// src/app/dashboard/automations/_components/__tests__/AutomationHub.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutomationHub } from "../AutomationHub";
import type { AutomationStatus } from "@/features/automations/types";

const base: AutomationStatus = {
  id: "insights-collect",
  label: "인사이트 영상 수집",
  description: "설명",
  scheduleInfo: "매일 08:00",
  cooldownMinutes: 60,
  lastRunAt: null,
  cooldownRemainingMinutes: 0,
};

describe("AutomationHub", () => {
  it("잡 label과 스케줄을 렌더한다", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByText("인사이트 영상 수집")).toBeInTheDocument();
    expect(screen.getByText("매일 08:00")).toBeInTheDocument();
  });

  it("쿨다운 0이면 '지금 실행' 버튼", () => {
    render(<AutomationHub statuses={[base]} />);
    expect(screen.getByRole("button", { name: /지금 실행/ })).toBeInTheDocument();
  });

  it("쿨다운 진행 중이면 잔여 분을 표시한다", () => {
    render(<AutomationHub statuses={[{ ...base, cooldownRemainingMinutes: 31 }]} />);
    expect(screen.getByText(/31분/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/dashboard/automations/_components/__tests__/AutomationHub.test.tsx`
Expected: FAIL — `Cannot find module '../AutomationHub'`

- [ ] **Step 3: Write AutomationHub.tsx**

```tsx
// src/app/dashboard/automations/_components/AutomationHub.tsx
"use client";

import { useActionState, useState } from "react";
import {
  runAutomationAction,
  type RunActionState,
} from "@/features/automations/actions";
import type { AutomationStatus } from "@/features/automations/types";

export function AutomationHub({ statuses }: { statuses: AutomationStatus[] }) {
  return (
    <div className="flex flex-col gap-4">
      {statuses.map((s) => (
        <AutomationRow key={s.id} status={s} />
      ))}
    </div>
  );
}

function AutomationRow({ status }: { status: AutomationStatus }) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    runAutomationAction,
    undefined,
  );
  const [confirming, setConfirming] = useState(false);
  const inCooldown = status.cooldownRemainingMinutes > 0;

  return (
    <div className="rounded-lg border border-faint bg-cream p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-ink">{status.label}</h3>
          <p className="text-sm leading-[1.6] text-muted">{status.description}</p>
          <p className="mt-1 text-xs tracking-[0.02em] text-muted">
            {status.scheduleInfo}
            {status.lastRunAt
              ? ` · 마지막 실행 ${new Date(status.lastRunAt).toLocaleString("ko-KR")}`
              : " · 실행 기록 없음"}
          </p>
        </div>

        <form action={formAction} className="shrink-0">
          <input type="hidden" name="jobId" value={status.id} />
          {!inCooldown ? (
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {pending ? "실행 중…" : "지금 실행"}
            </button>
          ) : !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-md border border-vermilion px-4 py-2 text-sm font-medium text-vermilion"
            >
              쿨다운 {status.cooldownRemainingMinutes}분 — 강제 실행
            </button>
          ) : (
            <button
              type="submit"
              name="force"
              value="1"
              disabled={pending}
              className="rounded-md bg-vermilion px-4 py-2 text-sm font-medium text-cream disabled:opacity-50"
            >
              {pending ? "실행 중…" : "quota 소모 — 확인"}
            </button>
          )}
        </form>
      </div>

      {state ? (
        <p
          className={`mt-3 text-sm ${state.ok ? "text-ink" : "text-vermilion"}`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app/dashboard/automations/_components/__tests__/AutomationHub.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Write page.tsx**

```tsx
// src/app/dashboard/automations/page.tsx
import { redirect } from "next/navigation";
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { getAutomationStatuses } from "@/features/automations/queries";
import { AutomationHub } from "./_components/AutomationHub";

export default async function AutomationsPage() {
  const slug = "automations";
  const me = await requireMenu(slug);

  // 자동화 실행은 admin 전용 — admin 외는 /dashboard로 fallback
  if (me.permission !== "admin") {
    redirect("/dashboard");
  }

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const statuses = await getAutomationStatuses();
  const config = resolvePageMeta(slug, meta, statuses.length);

  const header = (
    <PageHeader
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  return (
    <>
      {header}
      <div className="p-5 lg:p-7">
        <AutomationHub statuses={statuses} />
      </div>
    </>
  );
}
```

- [ ] **Step 6: typecheck**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/automations/
git commit -m "feat: 자동화 허브 페이지 + AutomationHub UI (표준 형식)"
```

---

### Task 8: 사이드바 메뉴 + page-meta + 전체 검증

**Files:**
- Modify: `src/app/dashboard/_data.ts` (AI & 자동화 그룹 items에 항목 추가)
- Modify: `src/app/dashboard/_data/page-meta-config.ts` (automations 메타 추가)

- [ ] **Step 1: 사이드바 항목 추가**

`src/app/dashboard/_data.ts`의 `AI & 자동화` 그룹 `items` 배열 맨 끝(TIP 공유 다음)에 추가:

```ts
          {
            ico: "·",
            label: "자동화",
            slug: "automations",
            pattern: "list",
          },
```

- [ ] **Step 2: page-meta 추가**

`src/app/dashboard/_data/page-meta-config.ts`의 객체에 `settings` 항목 앞 또는 `ai-tips` 다음에 추가:

```ts
  automations: {
    headline: { accent: "AI & 자동화", title: "자동화" },
    description:
      "운영 자동화 작업을 수동으로 실행합니다. admin 전용 — quota를 소모하므로 신중히 사용합니다.",
  },
```

- [ ] **Step 3: 사이드바/메타 관련 테스트 실행 (회귀 확인)**

Run: `npm test -- src/app/dashboard/_data/__tests__src/app/dashboard/__tests__`
(실제 경로 정확히: `npm test -- src/app/dashboard/__tests__/_data.test.ts src/app/dashboard/_data/__tests__/page-meta-config.test.ts`)
Expected: PASS. 만약 slug 목록을 enumerate하는 테스트가 깨지면 `automations`를 그 목록에 추가한다.

- [ ] **Step 4: 전체 검증**

Run 순서대로:
```bash
npm run lint
npm run typecheck
npm test
```
Expected: 모두 PASS / 0 에러.

- [ ] **Step 5: dev 수동 검증**

```bash
unset NODE_ENV && npm run dev
```
- admin 계정 로그인 → 사이드바 `분석 · AI > AI & 자동화 > 자동화` 클릭
- `/dashboard/automations` 진입 확인 (비-admin은 /dashboard로 튕기는지 확인)
- "지금 실행" 클릭 → 결과 메시지(`N건 적재…`) 확인
- 인사이트 페이지에서 신규 영상 반영 확인
- 재클릭 시 쿨다운 표시 + "강제 실행 → quota 소모 확인" 2단계 동작 확인

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/_data.ts src/app/dashboard/_data/page-meta-config.ts
git commit -m "feat: 사이드바 '자동화' 메뉴 + page-meta (AI & 자동화 그룹)"
```

---

## Self-Review 결과

- **Spec 커버리지**: 목표 1(수동 실행)=Task 3/6/7, 목표 2(registry)=Task 4, 목표 3(cron 유지)=무변경(명시). 권한=Task 6/7. 쿨다운=Task 5/6/7. IA/메타=Task 8. videos.list 50 batch=Task 2/3. 마이그레이션 0=queries max(collected_at). ✅
- **Placeholder**: 없음 (모든 코드 블록 완성).
- **타입 일관성**: `AutomationRunResult`/`AutomationJob`/`AutomationStatus`(Task1) → registry(Task4)/queries(Task5)/actions(Task6)/UI(Task7) 시그니처 일치. `RunActionState`=actions에서 정의, UI에서 import. `getJobLastRunAt`=queries에서 정의, actions에서 사용. `CollectedVideo`=insights-collect에서 정의, 헬퍼/run 공유. ✅
- **알려진 리스크**: (1) registry `server-only` import가 Vitest에서 막히면 Task4 주의대로 제거. (2) `_data`/page-meta 테스트가 slug enumerate 시 Task8 Step3에서 추가.
