# AI TIP GitHub 자동 수집 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회사 PC가 주 1회 GitHub 급상승 리포를 수집해 claude로 TIP 초안까지 만들어 후보로 쌓고, TIP 페이지에서 한 번 눌러 등록할 수 있게 한다.

**Architecture:** 순수 로직(검색 쿼리 조립·중복 제외·claude 응답 파싱)을 `collect-lib.mjs`로 뽑아 단위 테스트하고, 로컬 스크립트는 그 조각을 엮어 GitHub·claude·서버 API를 호출하는 얇은 껍데기로 둔다. 서버는 적재 API + 후보 조회/승인 액션 + TIP 페이지 패널만 담당한다.

**Tech Stack:** Next.js App Router(Route Handler + Server Action), TypeScript, zod, Supabase, Node 스크립트(.mjs), Vitest

설계 문서: `docs/superpowers/specs/2026-08-11-ai-tips-github-collect-design.md`

## Global Constraints

- 커밋 메시지는 Conventional Commits + 한국어. 접두사만 영어
- 작업 브랜치는 `feat/ai-tips-github-collect` (이미 생성됨, 설계 커밋 `c89dd7c`)
- 테스트 실행은 `npx vitest run <경로>`
- `any`, `@ts-ignore`, `eslint-disable`, `console.log` 금지 — **단 `scripts/**/*.mjs`는 예외**로,
  CLI 출력이 목적이므로 `console.log`/`console.error`를 쓴다(기존 스크립트와 동일)
- 컴포넌트에 하드코딩 색상 금지. Tailwind 토큰 클래스만
- 입력창 표준 클래스: `border-line-soft bg-field-bg` + `focus:border-ink focus:bg-white`
- 주석은 한국어
- **claude 실패는 정상 경로다** — 초안 없이 리포 정보만 저장한다. `draft_*`는 전부 nullable
- **`숨김`·`등록`된 리포도 재수집 대상에서 제외**한다. 거른 게 다시 올라오면 거르는 의미가 없다
- **훅 정책**: `tdd-enforce` 훅이 Write/Edit에서 소스와 같은 이름의 테스트를 요구한다. 막히면
  **STOP 하고 BLOCKED 보고**. Bash/Python/쉘 리다이렉션으로 우회 금지, `.claude/settings*.json`·훅 파일 수정 금지
- **범위 밖 — 건드리지 말 것**: `ai_tips` 테이블·스키마·RLS, 사이드바, list-variants 레지스트리,
  `ListPattern.tsx`

---

### Task 1: 후보 테이블 + zod 스키마

**Files:**
- Create: `supabase/migrations/20260811_ai_tip_candidates.sql`
- Create: `src/features/ai-tip-candidates/schemas.ts`
- Test: `src/features/ai-tip-candidates/__tests__/schemas.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `aiTipCandidateRowSchema` / `AiTipCandidateRow` — DB 행
  - `aiTipCandidateInsertSchema` / `AiTipCandidateInsert` — 수집 API 본문 1건
  - `aiTipCandidateBatchSchema` — `{ candidates: AiTipCandidateInsert[] }`
  - `CANDIDATE_STATUSES = ["pending", "promoted", "hidden"]`

- [ ] **Step 1: 마이그레이션 작성**

```sql
-- ai_tip_candidates — GitHub 급상승 리포 수집 후보.
-- 회사 PC 수집기가 적재하고, 사람이 TIP 페이지에서 등록(promoted)하거나 숨긴다(hidden).
-- draft_*가 전부 nullable인 것은 의도 — claude 초안 생성이 실패해도 리포 정보만으로 후보를 남긴다.
-- 수집을 통째로 버리면 그 주 리포를 영영 놓친다.

begin;

create table if not exists public.ai_tip_candidates (
  id                  uuid primary key default gen_random_uuid(),
  repo_full_name      text not null unique,
  repo_url            text not null,
  stars               integer not null default 0,
  repo_description    text,
  draft_title         text,
  draft_summary_md    text,
  draft_reuse_prompt  text,
  draft_tags          text[] not null default '{}',
  draft_ai_tool       text,
  draft_category      text,
  status              text not null default 'pending'
                      check (status in ('pending', 'promoted', 'hidden')),
  collected_at        timestamptz not null default now()
);

-- 후보 패널은 pending만 최신순으로 읽는다.
create index if not exists ai_tip_candidates_status_collected_idx
  on public.ai_tip_candidates (status, collected_at desc);

alter table public.ai_tip_candidates enable row level security;

-- read: 인증 전원 (TIP 페이지에서 본다)
drop policy if exists ai_tip_candidates_read on public.ai_tip_candidates;
create policy ai_tip_candidates_read on public.ai_tip_candidates
  for select to authenticated using (true);

-- update: 인증 전원 (승인·숨김은 사람이 웹에서 누른다)
drop policy if exists ai_tip_candidates_update on public.ai_tip_candidates;
create policy ai_tip_candidates_update on public.ai_tip_candidates
  for update to authenticated using (true) with check (true);

grant select, update on public.ai_tip_candidates to authenticated;
grant all on public.ai_tip_candidates to service_role;

commit;

notify pgrst, 'reload schema';
```

insert 정책이 없는 것은 의도다 — 적재는 service_role(수집 API)만 한다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/features/ai-tip-candidates/__tests__/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  aiTipCandidateRowSchema,
  aiTipCandidateInsertSchema,
  aiTipCandidateBatchSchema,
} from "../schemas";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  repo_full_name: "acme/agent-kit",
  repo_url: "https://github.com/acme/agent-kit",
  stars: 350,
  repo_description: "에이전트 워크플로 도구",
  draft_title: "에이전트 워크플로 자동화",
  draft_summary_md: "요약",
  draft_reuse_prompt: "프롬프트",
  draft_tags: ["자동화"],
  draft_ai_tool: "claude",
  draft_category: "automation",
  status: "pending",
  collected_at: "2026-08-11T00:00:00Z",
};

describe("aiTipCandidateRowSchema", () => {
  it("정상 행을 통과시킨다", () => {
    expect(aiTipCandidateRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("초안이 전부 없어도 통과한다 — claude 실패는 정상 경로다", () => {
    const parsed = aiTipCandidateRowSchema.safeParse({
      ...validRow,
      draft_title: null,
      draft_summary_md: null,
      draft_reuse_prompt: null,
      draft_ai_tool: null,
      draft_category: null,
      draft_tags: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("정의되지 않은 status는 거부한다", () => {
    expect(
      aiTipCandidateRowSchema.safeParse({ ...validRow, status: "archived" })
        .success,
    ).toBe(false);
  });
});

describe("aiTipCandidateInsertSchema", () => {
  it("리포 정보만으로도 통과한다", () => {
    const parsed = aiTipCandidateInsertSchema.safeParse({
      repo_full_name: "acme/agent-kit",
      repo_url: "https://github.com/acme/agent-kit",
      stars: 350,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.draft_tags).toEqual([]);
  });

  it("repo_full_name이 없으면 거부한다", () => {
    expect(
      aiTipCandidateInsertSchema.safeParse({
        repo_url: "https://github.com/acme/agent-kit",
      }).success,
    ).toBe(false);
  });
});

describe("aiTipCandidateBatchSchema", () => {
  it("빈 배열도 통과한다 — 수집 0건은 실패가 아니다", () => {
    expect(aiTipCandidateBatchSchema.safeParse({ candidates: [] }).success).toBe(
      true,
    );
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ai-tip-candidates/__tests__/schemas.test.ts`
Expected: FAIL — `Failed to resolve import "../schemas"`

- [ ] **Step 4: 스키마 구현**

`src/features/ai-tip-candidates/schemas.ts`:

```ts
import { z } from "zod";

export const CANDIDATE_STATUSES = ["pending", "promoted", "hidden"] as const;

export const candidateStatusSchema = z.enum(CANDIDATE_STATUSES);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;

/**
 * 수집기가 보내는 후보 1건.
 * draft_*는 전부 optional — claude 초안 생성이 실패해도 리포 정보만으로 후보를 남긴다.
 */
export const aiTipCandidateInsertSchema = z.object({
  repo_full_name: z.string().min(1),
  repo_url: z.string().url(),
  stars: z.number().int().nonnegative().default(0),
  repo_description: z.string().nullable().optional(),
  draft_title: z.string().nullable().optional(),
  draft_summary_md: z.string().nullable().optional(),
  draft_reuse_prompt: z.string().nullable().optional(),
  draft_tags: z.array(z.string()).default([]),
  draft_ai_tool: z.string().nullable().optional(),
  draft_category: z.string().nullable().optional(),
});

export type AiTipCandidateInsert = z.infer<typeof aiTipCandidateInsertSchema>;

export const aiTipCandidateBatchSchema = z.object({
  candidates: z.array(aiTipCandidateInsertSchema),
});

export const aiTipCandidateRowSchema = aiTipCandidateInsertSchema.extend({
  id: z.string().uuid(),
  status: candidateStatusSchema,
  collected_at: z.string(),
});

export type AiTipCandidateRow = z.infer<typeof aiTipCandidateRowSchema>;
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ai-tip-candidates/__tests__/schemas.test.ts`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/20260811_ai_tip_candidates.sql src/features/ai-tip-candidates/
git commit -m "feat: AI TIP 후보 테이블과 스키마 추가"
```

**Supabase 선적용은 사람이 한다** — 컨트롤러가 사용자에게 SQL을 전달하고 `service_role`로 확인한다.
구현자는 여기까지만 하고 적용을 시도하지 마라.

---

### Task 2: 수집 순수 로직 (collect-lib)

GitHub·claude·서버를 부르지 않는 순수 함수만 모은다. 스크립트는 다음 태스크에서 이 조각을 엮는다.

**Files:**
- Create: `scripts/ai-tips/collect-lib.mjs`
- Test: `scripts/__tests__/ai-tips-collect-lib.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `TOPICS: string[]`, `MIN_STARS: number`, `CREATED_WITHIN_DAYS: number`, `MAX_PER_RUN: number`
  - `buildSearchQuery(topic, { minStars, createdAfter }): string`
  - `createdAfterDate(now, days): string` — 'YYYY-MM-DD'
  - `pickNewRepos(items, seenNames, limit): Array<{repo_full_name, repo_url, stars, repo_description}>`
  - `buildTipPrompt(repo, readme): string`
  - `parseTipDraft(text): { draft_title, draft_summary_md, draft_reuse_prompt, draft_tags, draft_ai_tool, draft_category } | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/__tests__/ai-tips-collect-lib.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import {
  TOPICS,
  MAX_PER_RUN,
  buildSearchQuery,
  createdAfterDate,
  pickNewRepos,
  buildTipPrompt,
  parseTipDraft,
} from "../ai-tips/collect-lib.mjs";

describe("createdAfterDate", () => {
  it("기준일에서 N일 전을 YYYY-MM-DD로 준다", () => {
    expect(createdAfterDate(new Date("2026-08-11T00:00:00Z"), 90)).toBe(
      "2026-05-13",
    );
  });
});

describe("buildSearchQuery", () => {
  it("토픽·스타·생성일 조건을 한 줄로 조립한다", () => {
    expect(
      buildSearchQuery("automation", {
        minStars: 200,
        createdAfter: "2026-05-13",
      }),
    ).toBe("topic:automation stars:>=200 created:>2026-05-13");
  });
});

describe("pickNewRepos", () => {
  const items = [
    { full_name: "a/one", html_url: "u1", stargazers_count: 300, description: "d1" },
    { full_name: "b/two", html_url: "u2", stargazers_count: 250, description: null },
    { full_name: "c/three", html_url: "u3", stargazers_count: 210, description: "d3" },
  ];

  it("이미 본 리포를 제외한다", () => {
    const out = pickNewRepos(items, new Set(["b/two"]), 10);
    expect(out.map((r) => r.repo_full_name)).toEqual(["a/one", "c/three"]);
  });

  it("limit까지만 준다 — claude 호출 수가 여기서 정해진다", () => {
    expect(pickNewRepos(items, new Set(), 2)).toHaveLength(2);
  });

  it("같은 리포가 여러 토픽에서 중복으로 와도 한 번만 담는다", () => {
    const dup = [...items, items[0]];
    expect(pickNewRepos(dup, new Set(), 10)).toHaveLength(3);
  });

  it("필요한 필드만 남긴다", () => {
    expect(pickNewRepos([items[0]], new Set(), 1)[0]).toEqual({
      repo_full_name: "a/one",
      repo_url: "u1",
      stars: 300,
      repo_description: "d1",
    });
  });
});

describe("buildTipPrompt", () => {
  it("리포 정보와 README를 프롬프트에 담는다", () => {
    const p = buildTipPrompt(
      { repo_full_name: "a/one", repo_description: "설명" },
      "# README 본문",
    );
    expect(p).toContain("a/one");
    expect(p).toContain("설명");
    expect(p).toContain("# README 본문");
  });

  it("README가 없어도 프롬프트를 만든다", () => {
    expect(buildTipPrompt({ repo_full_name: "a/one" }, "")).toContain("a/one");
  });
});

describe("parseTipDraft", () => {
  const good = JSON.stringify({
    title: "에이전트 워크플로",
    summary_md: "요약",
    reuse_prompt: "프롬프트",
    tags: ["자동화", "에이전트"],
    ai_tool: "claude",
    category: "automation",
  });

  it("JSON을 초안 필드로 바꾼다", () => {
    expect(parseTipDraft(good)).toEqual({
      draft_title: "에이전트 워크플로",
      draft_summary_md: "요약",
      draft_reuse_prompt: "프롬프트",
      draft_tags: ["자동화", "에이전트"],
      draft_ai_tool: "claude",
      draft_category: "automation",
    });
  });

  it("코드펜스로 감싸 와도 읽는다", () => {
    expect(parseTipDraft("```json\n" + good + "\n```")?.draft_title).toBe(
      "에이전트 워크플로",
    );
  });

  it("허용 밖 enum은 안전한 기본값으로 바꾼다", () => {
    const out = parseTipDraft(
      JSON.stringify({
        title: "t",
        summary_md: "s",
        reuse_prompt: "p",
        tags: [],
        ai_tool: "무언가",
        category: "무언가",
      }),
    );
    expect(out?.draft_ai_tool).toBe("etc");
    expect(out?.draft_category).toBe("automation");
  });

  it("JSON이 아니면 null — 초안 없이 저장하라는 신호다", () => {
    expect(parseTipDraft("죄송합니다 만들 수 없습니다")).toBeNull();
  });

  it("필수 필드가 비면 null", () => {
    expect(parseTipDraft(JSON.stringify({ title: "t" }))).toBeNull();
  });
});

describe("상수", () => {
  it("토픽이 비어 있지 않다", () => {
    expect(TOPICS.length).toBeGreaterThan(0);
  });

  it("회차당 처리 건수가 claude 호출 비용을 묶는다", () => {
    expect(MAX_PER_RUN).toBe(5);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run scripts/__tests__/ai-tips-collect-lib.test.mjs`
Expected: FAIL — `Failed to resolve import "../ai-tips/collect-lib.mjs"`

- [ ] **Step 3: 구현**

`scripts/ai-tips/collect-lib.mjs`:

```js
// AI TIP 수집 순수 로직 — GitHub/claude/서버를 부르지 않는다.
// 호출부(collect-local.mjs)와 분리해 단위 테스트가 가능하게 둔다.

/** 검색할 GitHub 토픽. 몇 회차 돌려보고 조정한다. */
export const TOPICS = [
  "automation",
  "ai-agent",
  "llm",
  "workflow-automation",
  "mcp",
  "rpa",
];

export const MIN_STARS = 200;
export const CREATED_WITHIN_DAYS = 90;
/** 회차당 처리 건수 — claude 호출이 리포당 1회라 시간·비용이 여기서 정해진다. */
export const MAX_PER_RUN = 5;

const AI_TOOLS = [
  "claude",
  "chatgpt",
  "gemini",
  "cursor",
  "copilot",
  "notion_ai",
  "etc",
];
const CATEGORIES = [
  "code",
  "doc",
  "analysis",
  "design",
  "translation",
  "meeting",
  "automation",
  "productivity",
  "devtool",
  "etc",
];

/** 기준 시각에서 days일 전 날짜를 'YYYY-MM-DD'로. */
export function createdAfterDate(now, days) {
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function buildSearchQuery(topic, { minStars, createdAfter }) {
  return `topic:${topic} stars:>=${minStars} created:>${createdAfter}`;
}

/**
 * 검색 결과에서 새 리포만 limit개 고른다.
 * seenNames에는 pending뿐 아니라 promoted·hidden도 들어온다 —
 * 한 번 거른 리포가 다시 올라오면 거르는 의미가 없다.
 */
export function pickNewRepos(items, seenNames, limit) {
  const out = [];
  const taken = new Set();
  for (const it of items) {
    const name = it.full_name;
    if (!name || seenNames.has(name) || taken.has(name)) continue;
    taken.add(name);
    out.push({
      repo_full_name: name,
      repo_url: it.html_url,
      stars: it.stargazers_count ?? 0,
      repo_description: it.description ?? null,
    });
    if (out.length >= limit) break;
  }
  return out;
}

export function buildTipPrompt(repo, readme) {
  return [
    "다음 GitHub 리포지토리를 사내 운영팀에 공유할 'AI 활용 TIP'으로 정리해라.",
    "",
    `리포: ${repo.repo_full_name}`,
    `설명: ${repo.repo_description ?? "(없음)"}`,
    "",
    "README 발췌:",
    readme || "(README 없음)",
    "",
    "아래 JSON만 출력해라. 다른 말은 붙이지 마라.",
    "{",
    '  "title": "80자 이내 한국어 제목",',
    '  "summary_md": "500자 이내 한국어 요약 — 무엇을 하는 도구이고 우리 업무에 어떻게 쓸 수 있는지",',
    '  "reuse_prompt": "동료가 복사해서 바로 쓸 수 있는 한국어 프롬프트",',
    '  "tags": ["태그", "2~4개"],',
    `  "ai_tool": "${AI_TOOLS.join(" | ")}",`,
    `  "category": "${CATEGORIES.join(" | ")}"`,
    "}",
  ].join("\n");
}

function pick(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

/**
 * claude 출력 → 초안 필드. 파싱 실패나 필수 필드 누락이면 null을 준다.
 * null은 '초안 없이 리포 정보만 저장하라'는 신호다 — 수집 자체를 버리지 않는다.
 */
export function parseTipDraft(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let obj;
  try {
    obj = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!obj?.title || !obj?.summary_md || !obj?.reuse_prompt) return null;
  return {
    draft_title: String(obj.title).slice(0, 80),
    draft_summary_md: String(obj.summary_md).slice(0, 500),
    draft_reuse_prompt: String(obj.reuse_prompt),
    draft_tags: Array.isArray(obj.tags) ? obj.tags.map(String) : [],
    draft_ai_tool: pick(obj.ai_tool, AI_TOOLS, "etc"),
    draft_category: pick(obj.category, CATEGORIES, "automation"),
  };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run scripts/__tests__/ai-tips-collect-lib.test.mjs`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add scripts/ai-tips/collect-lib.mjs scripts/__tests__/ai-tips-collect-lib.test.mjs
git commit -m "feat: AI TIP 수집 순수 로직 추가"
```

---

### Task 3: 수집 API + 후보 조회

**Files:**
- Create: `src/app/api/ai-tips/candidates/route.ts`
- Create: `src/features/ai-tip-candidates/queries.ts`
- Modify: `src/proxy.ts` (`PUBLIC_PATHS`에 1줄)
- Test: `src/app/api/ai-tips/candidates/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `aiTipCandidateBatchSchema` (Task 1)
- Produces:
  - `GET /api/ai-tips/candidates` → `{ ok: true, seen: string[] }` (status 무관 전체 `repo_full_name`)
  - `POST /api/ai-tips/candidates` → `{ ok: true, inserted: number, skipped: number }`
  - `listPendingCandidates(): Promise<AiTipCandidateRow[]>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/ai-tips/candidates/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect, mockInsert, mockRecordRun } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockRecordRun: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: mockSelect,
      insert: mockInsert,
    }),
  }),
}));

vi.mock("@/features/automations/run-recorder", () => ({
  recordAutomationRun: mockRecordRun,
}));

import { GET, POST } from "../route";

const SECRET = "test-secret";

function req(body: unknown, auth = `Bearer ${SECRET}`) {
  return new Request("http://localhost/api/ai-tips/candidates", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = SECRET;
  mockSelect.mockResolvedValue({ data: [], error: null });
  mockInsert.mockResolvedValue({ data: [], error: null });
});

describe("POST /api/ai-tips/candidates — 인증", () => {
  it("secret이 틀리면 401", async () => {
    const res = await POST(req({ candidates: [] }, "Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("본문이 스키마에 안 맞으면 400", async () => {
    const res = await POST(req({ candidates: [{ repo_url: "u" }] }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/ai-tips/candidates — 적재", () => {
  it("후보를 insert하고 건수를 돌려준다", async () => {
    const res = await POST(
      req({
        candidates: [
          {
            repo_full_name: "a/one",
            repo_url: "https://github.com/a/one",
            stars: 300,
          },
        ],
      }),
    );
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalled();
    await expect(res.json()).resolves.toMatchObject({ ok: true, inserted: 1 });
  });

  it("수집 0건도 성공이다 — 그 주에 새 리포가 없을 수 있다", async () => {
    const res = await POST(req({ candidates: [] }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, inserted: 0 });
  });

  it("실행 이력을 남긴다 — 일일 보고가 미실행을 잡으려면 필요하다", async () => {
    await POST(req({ candidates: [] }));
    expect(mockRecordRun).toHaveBeenCalledWith(
      "ai-tips-collect",
      expect.objectContaining({ ok: true }),
    );
  });
});

describe("GET /api/ai-tips/candidates", () => {
  it("이미 본 repo 이름을 돌려준다 — status와 무관하다", async () => {
    mockSelect.mockResolvedValue({
      data: [{ repo_full_name: "a/one" }, { repo_full_name: "b/two" }],
      error: null,
    });
    const res = await GET(
      new Request("http://localhost/api/ai-tips/candidates", {
        headers: { authorization: `Bearer ${SECRET}` },
      }),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      ok: true,
      seen: ["a/one", "b/two"],
    });
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/api/ai-tips/candidates/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`

- [ ] **Step 3: 라우트 구현**

`src/app/api/ai-tips/candidates/route.ts` — 인증·에러 형식은 `src/app/api/closing/run-log/route.ts`를
그대로 따른다(같은 CRON_SECRET 계열 엔드포인트).

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { aiTipCandidateBatchSchema } from "@/features/ai-tip-candidates/schemas";

/**
 * AI TIP 후보 적재/조회 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * GET  — 이미 수집한 repo_full_name 전체. status 무관(promoted·hidden 포함)이라
 *        한 번 거른 리포가 다음 회차에 다시 올라오지 않는다.
 * POST — 후보 적재. repo_full_name unique 충돌은 무시하고 건수만 센다.
 */
function unauthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`)
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  return null;
}

export async function GET(request: Request) {
  const bad = unauthorized(request);
  if (bad) return bad;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_tip_candidates")
    .select("repo_full_name");
  if (error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    seen: (data ?? []).map((r) => r.repo_full_name as string),
  });
}

export async function POST(request: Request) {
  const bad = unauthorized(request);
  if (bad) return bad;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = aiTipCandidateBatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );

  const rows = parsed.data.candidates;
  let inserted = 0;
  if (rows.length > 0) {
    const supabase = createAdminClient();
    // unique(repo_full_name) 충돌은 무시 — 같은 리포가 다시 와도 기존 후보를 덮지 않는다.
    const { error } = await supabase
      .from("ai_tip_candidates")
      .insert(rows, { count: "exact" });
    if (error && !/duplicate key/i.test(error.message)) {
      await recordAutomationRun("ai-tips-collect", {
        ok: false,
        message: error.message,
      });
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    inserted = error ? 0 : rows.length;
  }

  await recordAutomationRun("ai-tips-collect", {
    ok: true,
    message: `후보 ${inserted}건 수집`,
  });

  return NextResponse.json({
    ok: true,
    inserted,
    skipped: rows.length - inserted,
  });
}
```

- [ ] **Step 4: 후보 조회 함수**

`src/features/ai-tip-candidates/queries.ts`:

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  aiTipCandidateRowSchema,
  type AiTipCandidateRow,
} from "./schemas";

/** 검토 대기 후보 — 최신 수집순. 파싱 실패 행은 건너뛰고 로그만 남긴다. */
export async function listPendingCandidates(): Promise<AiTipCandidateRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_tip_candidates")
    .select("*")
    .eq("status", "pending")
    .order("collected_at", { ascending: false });
  if (error) {
    console.error("[listPendingCandidates] supabase error:", error);
    return [];
  }
  const out: AiTipCandidateRow[] = [];
  for (const row of data ?? []) {
    const parsed = aiTipCandidateRowSchema.safeParse(row);
    if (parsed.success) out.push(parsed.data);
    else console.error("[listPendingCandidates] zod parse fail:", parsed.error);
  }
  return out;
}
```

- [ ] **Step 5: proxy 등록**

`src/proxy.ts`의 `PUBLIC_PATHS` 배열에서 `"/api/closing/scrape-request",` 아래에 한 줄 넣는다.

```ts
  "/api/ai-tips/candidates",
```

**빠뜨리면 스크립트가 200 대신 로그인 페이지 HTML을 받아 조용히 실패한다.**

- [ ] **Step 6: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/api/ai-tips/candidates/__tests__/route.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/ai-tips/ src/features/ai-tip-candidates/queries.ts src/proxy.ts
git commit -m "feat: AI TIP 후보 적재 API와 조회 추가"
```

---

### Task 4: 후보 패널 + 승인·숨김

**Files:**
- Create: `src/features/ai-tip-candidates/actions.ts`
- Create: `src/app/dashboard/ai-tips/_components/TipCandidatePanel.tsx`
- Modify: `src/app/dashboard/ai-tips/page.tsx`
- Test: `src/features/ai-tip-candidates/__tests__/actions.test.ts`
- Test: `src/app/dashboard/ai-tips/_components/__tests__/TipCandidatePanel.test.tsx`

**Interfaces:**
- Consumes: `listPendingCandidates` (Task 3), `AiTipCandidateRow` (Task 1)
- Produces:
  - `promoteCandidate(id: string): Promise<{ ok: boolean; error?: string }>`
  - `hideCandidate(id: string): Promise<{ ok: boolean; error?: string }>`

`promoteCandidate`는 후보의 초안으로 `ai_tips` 행을 만들고(작성자 = 현재 운영자) 후보를 `promoted`로
바꾼다. 초안이 비어 있으면 리포명·URL로 최소값을 채운다 — TIP 스키마상 `summary_md`와
`reuse_prompt`가 필수라 빈 값으로는 저장이 안 된다.

- [ ] **Step 1: 실패하는 액션 테스트 작성**

`src/features/ai-tip-candidates/__tests__/actions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetCurrentOperator, mockCreateAiTip, mockCandidateSelect, mockUpdate } =
  vi.hoisted(() => ({
    mockGetCurrentOperator: vi.fn(),
    mockCreateAiTip: vi.fn(),
    mockCandidateSelect: vi.fn(),
    mockUpdate: vi.fn(),
  }));

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: mockGetCurrentOperator,
}));
vi.mock("@/features/ai-tips/actions", () => ({ createAiTip: mockCreateAiTip }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mockCandidateSelect }) }),
      update: () => ({ eq: mockUpdate }),
    }),
  })),
}));

import { promoteCandidate, hideCandidate } from "../actions";

const candidate = {
  id: "11111111-1111-4111-8111-111111111111",
  repo_full_name: "a/one",
  repo_url: "https://github.com/a/one",
  stars: 300,
  repo_description: "설명",
  draft_title: "제목",
  draft_summary_md: "요약",
  draft_reuse_prompt: "프롬프트",
  draft_tags: ["자동화"],
  draft_ai_tool: "claude",
  draft_category: "automation",
  status: "pending",
  collected_at: "2026-08-11T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentOperator.mockResolvedValue({
    email: "me@x.com",
    permission: "member",
  });
  mockCandidateSelect.mockResolvedValue({ data: candidate, error: null });
  mockCreateAiTip.mockResolvedValue({ ok: true, row: { id: "tip-1" } });
  mockUpdate.mockResolvedValue({ error: null });
});

describe("promoteCandidate", () => {
  it("초안으로 TIP을 만든다", async () => {
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(true);
    expect(mockCreateAiTip).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "제목",
        summary_md: "요약",
        reuse_prompt: "프롬프트",
      }),
    );
  });

  it("초안이 없으면 리포 정보로 최소값을 채운다 — TIP은 요약·프롬프트가 필수다", async () => {
    mockCandidateSelect.mockResolvedValue({
      data: {
        ...candidate,
        draft_title: null,
        draft_summary_md: null,
        draft_reuse_prompt: null,
        draft_ai_tool: null,
        draft_category: null,
      },
      error: null,
    });
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(true);
    const arg = mockCreateAiTip.mock.calls[0][0];
    expect(arg.title).toContain("a/one");
    expect(arg.summary_md.length).toBeGreaterThan(0);
    expect(arg.reuse_prompt.length).toBeGreaterThan(0);
  });

  it("TIP 생성이 실패하면 후보 상태를 바꾸지 않는다", async () => {
    mockCreateAiTip.mockResolvedValue({ ok: false, error: "권한 없음" });
    const res = await promoteCandidate(candidate.id);
    expect(res.ok).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("없는 후보면 실패한다", async () => {
    mockCandidateSelect.mockResolvedValue({ data: null, error: null });
    expect((await promoteCandidate(candidate.id)).ok).toBe(false);
  });

  it("viewer는 등록할 수 없다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@x.com",
      permission: "viewer",
    });
    expect((await promoteCandidate(candidate.id)).ok).toBe(false);
    expect(mockCreateAiTip).not.toHaveBeenCalled();
  });
});

describe("hideCandidate", () => {
  it("상태를 hidden으로 바꾼다", async () => {
    expect((await hideCandidate(candidate.id)).ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("viewer는 숨길 수 없다", async () => {
    mockGetCurrentOperator.mockResolvedValue({
      email: "v@x.com",
      permission: "viewer",
    });
    expect((await hideCandidate(candidate.id)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ai-tip-candidates/__tests__/actions.test.ts`
Expected: FAIL — `Failed to resolve import "../actions"`

- [ ] **Step 3: 액션 구현**

`src/features/ai-tip-candidates/actions.ts`. 권한 판정은 `src/features/ai-tips/actions.ts`의
`canCreate`(viewer·권한 없음 차단)와 같은 기준을 쓴다.

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAiTip } from "@/features/ai-tips/actions";

const AI_TIPS_PATH = "/dashboard/ai-tips";
const PERMISSION_ERROR = "권한 없음 — TIP 등록 권한이 없습니다.";
const NOT_FOUND_ERROR = "후보를 찾을 수 없습니다.";

export type CandidateActionResult = { ok: boolean; error?: string };

async function canEdit(): Promise<boolean> {
  const me = await getCurrentOperator();
  if (!me) return false;
  return me.permission !== "viewer" && me.permission !== null;
}

/**
 * 후보를 TIP으로 등록한다. 초안이 없으면 리포 정보로 최소값을 채운다 —
 * ai_tips는 summary_md·reuse_prompt가 필수라 빈 값으로는 저장되지 않는다.
 * TIP 생성이 실패하면 후보 상태를 바꾸지 않는다(다시 시도할 수 있어야 한다).
 */
export async function promoteCandidate(
  id: string,
): Promise<CandidateActionResult> {
  if (!(await canEdit())) return { ok: false, error: PERMISSION_ERROR };

  const supabase = await createClient();
  const { data: c } = await supabase
    .from("ai_tip_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!c) return { ok: false, error: NOT_FOUND_ERROR };

  const created = await createAiTip({
    title: c.draft_title ?? `GitHub: ${c.repo_full_name}`,
    ai_tool: c.draft_ai_tool ?? "etc",
    category: c.draft_category ?? "automation",
    summary_md:
      c.draft_summary_md ?? `${c.repo_description ?? c.repo_full_name}\n\n${c.repo_url}`,
    reuse_prompt:
      c.draft_reuse_prompt ??
      `${c.repo_url} 를 참고해 우리 업무에 적용할 방법을 정리해줘.`,
    tags: c.draft_tags ?? [],
  });
  if (!created.ok) return { ok: false, error: created.error };

  const { error } = await supabase
    .from("ai_tip_candidates")
    .update({ status: "promoted" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(AI_TIPS_PATH);
  return { ok: true };
}

/** 공유할 만하지 않은 후보를 숨긴다. 숨긴 리포는 다음 회차 수집에서도 제외된다. */
export async function hideCandidate(
  id: string,
): Promise<CandidateActionResult> {
  if (!(await canEdit())) return { ok: false, error: PERMISSION_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_tip_candidates")
    .update({ status: "hidden" })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(AI_TIPS_PATH);
  return { ok: true };
}
```

- [ ] **Step 4: 패널 테스트 작성**

`src/app/dashboard/ai-tips/_components/__tests__/TipCandidatePanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TipCandidatePanel } from "../TipCandidatePanel";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

function candidate(over: Partial<AiTipCandidateRow> = {}): AiTipCandidateRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    repo_full_name: "acme/agent-kit",
    repo_url: "https://github.com/acme/agent-kit",
    stars: 350,
    repo_description: "에이전트 워크플로 도구",
    draft_title: "에이전트 워크플로 자동화",
    draft_summary_md: "요약",
    draft_reuse_prompt: "프롬프트",
    draft_tags: ["자동화"],
    draft_ai_tool: "claude",
    draft_category: "automation",
    status: "pending",
    collected_at: "2026-08-11T00:00:00Z",
    ...over,
  };
}

describe("TipCandidatePanel", () => {
  it("후보가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <TipCandidatePanel candidates={[]} onPromote={vi.fn()} onHide={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("후보 건수와 리포 정보를 보여준다", () => {
    render(
      <TipCandidatePanel
        candidates={[candidate()]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(screen.getByText(/수집된 후보/)).toBeInTheDocument();
    expect(screen.getByText("acme/agent-kit")).toBeInTheDocument();
    expect(screen.getByText(/350/)).toBeInTheDocument();
    expect(screen.getByText("에이전트 워크플로 자동화")).toBeInTheDocument();
  });

  it("초안이 없는 후보는 '초안 없음'으로 표시한다", () => {
    render(
      <TipCandidatePanel
        candidates={[candidate({ draft_title: null, draft_summary_md: null })]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(screen.getByText(/초안 없음/)).toBeInTheDocument();
  });

  it("등록·숨김 버튼이 있다", () => {
    render(
      <TipCandidatePanel
        candidates={[candidate()]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "TIP으로 등록" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "숨김" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: 패널 구현**

`src/app/dashboard/ai-tips/_components/TipCandidatePanel.tsx` — 클라이언트 컴포넌트.
색은 토큰 클래스만 쓴다(`bg-situation-bg`, `border-line-soft`, `text-ink`, `text-muted`,
`bg-ink text-cream` 버튼).

```tsx
"use client";

import { useState } from "react";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

type Props = {
  candidates: AiTipCandidateRow[];
  onPromote: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onHide: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

/** 수집된 후보 검토 패널. 후보가 없으면 렌더하지 않는다. */
export function TipCandidatePanel({ candidates, onPromote, onHide }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (candidates.length === 0) return null;

  const run = async (
    id: string,
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setBusyId(id);
    const res = await fn(id);
    setBusyId(null);
    if (!res.ok) window.alert(res.error ?? "처리에 실패했습니다.");
  };

  return (
    <section className="mb-4 border border-line-soft bg-situation-bg p-3">
      <h2 className="mb-2 text-sm font-medium text-ink">
        수집된 후보 {candidates.length}건
      </h2>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="border border-line-soft bg-paper p-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={c.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-vermilion hover:underline"
              >
                {c.repo_full_name}
              </a>
              <span className="text-muted">★ {c.stars}</span>
            </div>
            {c.repo_description && (
              <p className="mt-1 text-muted">{c.repo_description}</p>
            )}
            {c.draft_title ? (
              <div className="mt-2">
                <p className="font-medium text-ink">{c.draft_title}</p>
                {c.draft_summary_md && (
                  <p className="mt-1 whitespace-pre-wrap text-ink-soft">
                    {c.draft_summary_md}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-muted">
                초안 없음 — 등록 후 직접 작성하세요
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => run(c.id, onPromote)}
                className="border border-line bg-ink px-2 py-1 text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                TIP으로 등록
              </button>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => run(c.id, onHide)}
                className="border border-line bg-transparent px-2 py-1 text-ink hover:bg-line-soft disabled:opacity-50"
              >
                숨김
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 6: 페이지 배선**

`src/app/dashboard/ai-tips/page.tsx`에 import를 추가한다.

```ts
import { listPendingCandidates } from "@/features/ai-tip-candidates/queries";
import {
  promoteCandidate,
  hideCandidate,
} from "@/features/ai-tip-candidates/actions";
import { TipCandidatePanel } from "./_components/TipCandidatePanel";
```

`const allTips = await listAiTips();` 아래에 후보를 읽는다.

```ts
  const candidates = await listPendingCandidates();
```

`header`로 넘기는 `PageHeader`를 프래그먼트로 감싸 패널을 얹는다. **`ListPattern`에 새 prop을
만들지 않는다** — 31개 도메인이 함께 쓰는 파일이다.

```tsx
  const header = (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
        autoRefresh
      />
      <TipCandidatePanel
        candidates={candidates}
        onPromote={promoteCandidate}
        onHide={hideCandidate}
      />
    </>
  );
```

기존 `header` 정의가 위와 다르면 그 파일의 실제 props를 그대로 두고 프래그먼트만 씌워라.

- [ ] **Step 7: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ai-tip-candidates/ src/app/dashboard/ai-tips/`
Expected: PASS

Run: `npm run typecheck`
Expected: 에러 0

- [ ] **Step 8: 커밋**

```bash
git add src/features/ai-tip-candidates/actions.ts src/features/ai-tip-candidates/__tests__/actions.test.ts src/app/dashboard/ai-tips/
git commit -m "feat: AI TIP 후보 검토 패널과 등록·숨김 추가"
```

---

### Task 5: 로컬 수집 스크립트 + 자동화 등록

**Files:**
- Create: `scripts/ai-tips/collect-local.mjs`
- Create: `scripts/ai-tips/ai-tips-collect.cmd`
- Create: `scripts/register-ai-tips-collect-task.ps1`
- Modify: `src/features/automations/registry.ts`

**Interfaces:**
- Consumes: `collect-lib.mjs` 전체 (Task 2), `GET/POST /api/ai-tips/candidates` (Task 3)
- Produces: 없음

- [ ] **Step 1: 수집 스크립트 작성**

`scripts/ai-tips/collect-local.mjs`. 자격 로딩·claude 호출 방식은
`scripts/team-briefing/publish-local.mjs`를 그대로 따른다(같은 회사 PC 러너 계열).

```js
// AI TIP 후보 수집기 — 회사 PC Windows 작업 스케줄러가 주 1회 실행.
//
// 흐름: GET /api/ai-tips/candidates(이미 본 리포) → GitHub Search → 새 리포 MAX_PER_RUN건
//   → README 발췌 → claude -p로 TIP 초안 → POST /api/ai-tips/candidates.
// claude 실패는 정상 경로 — 초안 없이 리포 정보만 보낸다.
//
// 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL / GITHUB_TOKEN(선택).
// 실행: node scripts/ai-tips/collect-local.mjs [--dry]
import fs from "node:fs";
import os from "node:os";
import { execFileSync } from "node:child_process";
import {
  TOPICS,
  MIN_STARS,
  CREATED_WITHIN_DAYS,
  MAX_PER_RUN,
  buildSearchQuery,
  createdAfterDate,
  pickNewRepos,
  buildTipPrompt,
  parseTipDraft,
} from "./collect-lib.mjs";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const BASE = (process.env.OPS_CONSOLE_BASE_URL ?? env.OPS_CONSOLE_BASE_URL ?? "")
  .trim()
  .replace(/\/+$/, "");
const SECRET = (process.env.CRON_SECRET ?? env.CRON_SECRET ?? "").trim();
const GH_TOKEN = (process.env.GITHUB_TOKEN ?? env.GITHUB_TOKEN ?? "").trim();
if (!BASE || !SECRET) {
  console.error("[ai-tips] OPS_CONSOLE_BASE_URL / CRON_SECRET 미설정 — 종료");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const authHeaders = { authorization: `Bearer ${SECRET}` };

const CLAUDE_BIN =
  env.CLAUDE_BIN || (process.platform === "win32" ? "claude.cmd" : "claude");

function ghHeaders() {
  const h = { accept: "application/vnd.github+json" };
  if (GH_TOKEN) h.authorization = `Bearer ${GH_TOKEN}`;
  return h;
}

async function fetchSeen() {
  const res = await fetch(`${BASE}/api/ai-tips/candidates`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`seen 조회 실패: ${res.status}`);
  const json = await res.json();
  return new Set(json.seen ?? []);
}

async function searchRepos(createdAfter) {
  const all = [];
  for (const topic of TOPICS) {
    const q = buildSearchQuery(topic, { minStars: MIN_STARS, createdAfter });
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=10`;
    const res = await fetch(url, { headers: ghHeaders() });
    if (!res.ok) {
      console.error(`[ai-tips] 검색 실패(${topic}): ${res.status}`);
      continue;
    }
    const json = await res.json();
    all.push(...(json.items ?? []));
  }
  return all;
}

async function fetchReadme(fullName) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/readme`,
      { headers: { ...ghHeaders(), accept: "application/vnd.github.raw" } },
    );
    if (!res.ok) return "";
    return (await res.text()).slice(0, 8000);
  } catch {
    return "";
  }
}

function generateDraft(repo, readme) {
  try {
    const out = execFileSync(
      CLAUDE_BIN,
      ["-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
      {
        input: buildTipPrompt(repo, readme),
        encoding: "utf8",
        // 레포 밖 cwd — 프로젝트 .claude 설정 상속을 막는 기존 안전장치(team-briefing과 동일).
        cwd: os.tmpdir(),
        timeout: 180_000,
      },
    );
    return parseTipDraft(out);
  } catch (e) {
    console.error(`[ai-tips] claude 실패(${repo.repo_full_name}):`, e.message);
    return null;
  }
}

const seen = await fetchSeen();
const createdAfter = createdAfterDate(new Date(), CREATED_WITHIN_DAYS);
const items = await searchRepos(createdAfter);
const repos = pickNewRepos(items, seen, MAX_PER_RUN);
console.log(`[ai-tips] 검색 ${items.length}건 → 신규 ${repos.length}건`);

const candidates = [];
for (const repo of repos) {
  const readme = await fetchReadme(repo.repo_full_name);
  const draft = generateDraft(repo, readme);
  candidates.push({ ...repo, ...(draft ?? {}) });
  console.log(
    `[ai-tips] ${repo.repo_full_name} — 초안 ${draft ? "생성" : "실패(리포 정보만 저장)"}`,
  );
}

if (dry) {
  console.log(JSON.stringify(candidates, null, 2));
  process.exit(0);
}

const res = await fetch(`${BASE}/api/ai-tips/candidates`, {
  method: "POST",
  headers: { ...authHeaders, "content-type": "application/json" },
  body: JSON.stringify({ candidates }),
});
const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("[ai-tips] 적재 실패:", res.status, json);
  process.exit(1);
}
console.log(`[ai-tips] 적재 완료 — ${json.inserted}건`);
```

- [ ] **Step 2: `--dry`로 실경로 1회 확인**

Run: `node scripts/ai-tips/collect-local.mjs --dry`
Expected: 검색 건수와 리포별 초안 생성 로그가 찍히고, 마지막에 후보 JSON이 출력된다.
GitHub 조회와 claude 생성이 실제로 되는지는 **여기서만 드러난다** — 단위 테스트는 둘 다 목이다.
실패하면 그 출력을 그대로 보고하고 멈춰라.

- [ ] **Step 3: 래퍼와 등록 스크립트**

`scripts/ai-tips/ai-tips-collect.cmd`:

```bat
@echo off
REM AI TIP 후보 수집 — 작업 스케줄러 진입점 (매주 월 09:00).
REM InteractiveToken(로그인 사용자 세션)으로 실행해야 claude -p OAuth 구독으로 초안을 생성한다.
REM GitHub 검색 -> README -> claude -p 초안 -> 서버 적재. claude 실패 시 리포 정보만 적재.
REM 로그는 scripts\logs 일자별 적재. 등록: register-ai-tips-collect-task.ps1.
setlocal
set REPO=C:\Users\ys1114\ClaudeCode\Build\OPS-Console
cd /d "%REPO%"
if not exist "%REPO%\scripts\logs" mkdir "%REPO%\scripts\logs"
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a%%b%%c
"C:\Program Files\nodejs\node.exe" "%REPO%\scripts\ai-tips\collect-local.mjs" >> "%REPO%\scripts\logs\ai-tips-collect-%TODAY%.log" 2>&1
endlocal
```

`scripts/register-ai-tips-collect-task.ps1` — `scripts/register-team-briefing-task.ps1`을 읽고
아래만 바꾼다: 작업 이름 `OPS-Console-AiTips-Collect`, 트리거 `-Weekly -DaysOfWeek Monday -At 9:00am`,
대상 `.cmd` 경로, 설명. `-StartWhenAvailable`·`InteractiveToken` 등 나머지 설정은 그대로 둔다
(claude 인증이 로그인 세션에서만 유효하다).

**등록 실행은 사람이 한다.** 구현자는 파일만 만들고 `Register-ScheduledTask`를 실행하지 마라.

- [ ] **Step 4: 자동화 레지스트리 등록**

`src/features/automations/registry.ts`의 `AUTOMATION_JOBS` 배열에 항목을 추가한다.
`mailbox-ingest`(`localOnly: true`) 항목을 참고해 같은 형태로 쓴다.

```ts
  {
    id: "ai-tips-collect",
    label: "AI TIP 후보 수집",
    description:
      "GitHub에서 최근 뜨는 자동화·AI 리포를 수집해 claude로 TIP 초안까지 만들어 후보로 쌓습니다.\nTIP 페이지의 후보 패널에서 확인하고 등록합니다.",
    scheduleInfo: "매주 월 09:00 — 회사 PC Windows 작업 스케줄러 (claude CLI)",
    cadence: "weekly",
    cooldownMinutes: 60,
    localOnly: true,
    run: async () => ({
      ok: false,
      message: "로컬 전용 — 회사 PC 작업 스케줄러가 실행합니다.",
    }),
  },
```

`localOnly: true`라 cron route가 거부하고 자동화 페이지에는 '로컬 전용'으로 표시된다.
등록해두는 이유는 **마지막 실행이 보이고, PC가 꺼져 며칠 안 돌면 일일 보고가 '미실행'으로 잡기 때문**이다.

- [ ] **Step 5: 검증**

Run: `npm run typecheck`
Expected: 에러 0

Run: `npx vitest run src/features/automations/`
Expected: 통과 — 레지스트리 항목 추가가 기존 자동화 테스트를 깨지 않아야 한다

- [ ] **Step 6: 커밋**

```bash
git add scripts/ai-tips/ scripts/register-ai-tips-collect-task.ps1 src/features/automations/registry.ts
git commit -m "feat: AI TIP 수집 스크립트와 자동화 등록"
```

---

### Task 6: 전체 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 관련 테스트**

Run: `npx vitest run src/features/ai-tip-candidates/ src/app/dashboard/ai-tips/ src/app/api/ai-tips/ scripts/__tests__/ai-tips-collect-lib.test.mjs`
Expected: 전부 통과

- [ ] **Step 2: 타입·린트**

Run: `npm run typecheck`
Expected: 에러 0

Run: `npm run lint`
Expected: 에러 0 (`src/app/r/checklist/[token]/_components/ReportView.tsx` 등의 `<img>` 경고 3건은
이 브랜치와 무관한 기존 것)

- [ ] **Step 3: proxy 등록 확인**

Run: `grep -n "ai-tips/candidates" src/proxy.ts`
Expected: 1줄 히트. **없으면 스크립트가 로그인 페이지 HTML을 받아 조용히 실패한다.**

- [ ] **Step 4: 커밋 (변경 없으면 생략)**

전체 스위트(`npm test`)와 빌드는 이 PC에서 리소스 경합으로 자주 중단되므로 **CI에서 확정한다.**

---

## 사람이 하는 일 (컨트롤러가 사용자와 처리)

- [ ] Supabase에 `20260811_ai_tip_candidates.sql` 적용 + `service_role`로 조회 확인
- [ ] `.env.local`에 `GITHUB_TOKEN`(읽기 전용) 추가 — 없으면 미인증으로 동작하되 한도가 낮다
- [ ] `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-ai-tips-collect-task.ps1`로
      회사 PC 작업 등록
- [ ] 첫 회차 후 후보 품질 확인 — 노이즈가 많으면 `MIN_STARS`를, 건질 게 없으면 `TOPICS`를 조정

## 완료 기준

- [ ] Task 1-6 완료, 각 커밋 존재
- [ ] `npm run typecheck` / `npm run lint` 통과 (실행 결과로 확인)
- [ ] `--dry` 실행으로 GitHub 조회 + claude 초안 생성이 실제로 되는 것 확인
- [ ] CI(리눅스) `lint + typecheck + test + build` 통과
- [ ] `git diff main --stat`으로 범위 밖 파일(`ai_tips` 스키마, 사이드바, `ListPattern.tsx`,
      list-variants 레지스트리)이 변경되지 않았음을 확인
