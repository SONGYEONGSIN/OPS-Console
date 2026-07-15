# 개발·테스트 2탭 + 원서제어 분석 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard/dev-test`를 개발/테스트 2탭으로 분리하고, 개발 탭에서 서비스별 원서제어 JS(A/AU)의 AI 요약 + 확인 필요 항목(체크/메모)을 제공한다.

**Architecture:** PC cron 스크립트가 원서GEN에 HTTP 로그인해 JS를 수집하고 변경분만 `claude -p`로 분석해 `dev_control_analyses`에 적재한다. 웹은 URL 탭(`?tab=dev|test`)으로 분기하고, 개발 탭은 ListPattern + 신규 `dev-control` variant 인스펙터로 조회·체크·메모한다.

**Tech Stack:** Next.js App Router + Supabase(+RLS) + zod + Vitest / Node .mjs 스크립트(fetch + claude CLI)

**Spec:** `docs/superpowers/specs/2026-07-14-dev-tab-control-analysis-design.md`

## Global Constraints

- 색상 하드코딩 금지 — Tailwind 토큰 클래스만 (`.claude/rules/design.md`)
- 카드/빈 상태 `border-line-soft bg-situation-bg`, 검색창 `bg-search-field-bg`, 목록행 호버 `hover:bg-line-soft`
- Server Action: zod 검증 + `revalidatePath`, 에러는 `parsed.error.issues[0].message`
- 커밋: conventional + 한국어, 파일당 800줄 상한
- DB 마이그레이션은 **머지 전 Supabase 선적용 + service_role 검증** (프로젝트 메모리 규칙)
- `.env.local`의 `MOA_USERNAME`/`MOA_PASSWORD`/`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_SUPABASE_URL` 사용, 값 커밋 금지

---

### Task 1: DB 마이그레이션 — dev_control_analyses

**Files:**
- Create: `supabase/migrations/20260714_dev_control_analyses.sql`

**Interfaces:**
- Produces: 테이블 `dev_control_analyses(service_id bigint, gen_flag text, kind 'A'|'AU', code_hash, raw_code, summary_md, flags jsonb, analyzed_at)` — unique(service_id, gen_flag, kind)

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- 원서제어 JS 수집·AI 분석 결과 (PC cron scripts/dev-control-analyze.mjs 적재)
create table if not exists public.dev_control_analyses (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,
  gen_flag text not null default 'WA',
  kind text not null check (kind in ('A', 'AU')),
  code_hash text not null,
  raw_code text not null,
  summary_md text,
  flags jsonb not null default '[]'::jsonb,
  analyzed_at timestamptz not null default now(),
  unique (service_id, gen_flag, kind)
);

alter table public.dev_control_analyses enable row level security;

-- 운영부 공개 read
create policy "dev_control_analyses_select" on public.dev_control_analyses
  for select to authenticated using (true);

-- 적재는 service_role만 (스크립트). flags 체크/메모 갱신도 server action이
-- service_role(admin client)로 수행 — authenticated write 정책 없음.

grant select on public.dev_control_analyses to authenticated;
grant all on public.dev_control_analyses to service_role;
```

- [ ] **Step 2: Supabase에 선적용** (프로젝트 규칙 — 머지 전 적용)

Supabase 대시보드 SQL Editor 또는 `psql "$DATABASE_URL" -f supabase/migrations/20260714_dev_control_analyses.sql`

- [ ] **Step 3: service_role로 스모크 검증**

```bash
node - <<'EOF'
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(l=>l.includes("=")).map(l=>[l.slice(0,l.indexOf("=")),l.slice(l.indexOf("=")+1)]));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await sb.from("dev_control_analyses").upsert({ service_id: 1, gen_flag: "WA", kind: "A", code_hash: "smoke", raw_code: "//", flags: [] }, { onConflict: "service_id,gen_flag,kind" });
console.log("upsert:", error ?? "ok");
await sb.from("dev_control_analyses").delete().eq("code_hash", "smoke");
EOF
```
Expected: `upsert: ok`

- [ ] **Step 4: Commit** — `git add supabase/migrations/... && git commit -m "feat(dev-control): dev_control_analyses 테이블 + RLS"`

---

### Task 2: features/dev-controls — 스키마·플래그 병합·쿼리·액션

**Files:**
- Create: `src/features/dev-controls/schemas.ts`
- Create: `src/features/dev-controls/flag-merge.ts`
- Create: `src/features/dev-controls/queries.ts`
- Create: `src/features/dev-controls/actions.ts`
- Test: `src/features/dev-controls/__tests__/flag-merge.test.ts`
- Test: `src/features/dev-controls/__tests__/schemas.test.ts`

**Interfaces:**
- Produces:
  - `type DevControlFlag = { key: string; label: string; snippet: string; severity: "warn" | "info"; checked: boolean; note: string }`
  - `type DevControlAnalysis = { id: string; service_id: number; gen_flag: string; kind: "A" | "AU"; code_hash: string; raw_code: string; summary_md: string | null; flags: DevControlFlag[]; analyzed_at: string }`
  - `mergeFlags(prev: DevControlFlag[], next: DevControlFlag[]): DevControlFlag[]` — key 매칭으로 checked/note 보존
  - `listDevControlAnalyses(): Promise<DevControlAnalysis[]>` (server, anon RLS read)
  - `updateDevControlFlag(input: { analysisId: string; flagKey: string; checked: boolean; note: string }): Promise<{ ok: boolean; error?: string }>` (server action, admin client)

- [ ] **Step 1: 실패 테스트 작성 — flag-merge**

```ts
// src/features/dev-controls/__tests__/flag-merge.test.ts
import { describe, it, expect } from "vitest";
import { mergeFlags } from "../flag-merge";
import type { DevControlFlag } from "../schemas";

const f = (key: string, over: Partial<DevControlFlag> = {}): DevControlFlag => ({
  key, label: "지난 연도 날짜", snippet: "2025. 9. 9.", severity: "warn",
  checked: false, note: "", ...over,
});

describe("mergeFlags", () => {
  it("동일 key는 checked/note 보존, 신규 항목은 초기값", () => {
    const prev = [f("k1", { checked: true, note: "확인함" })];
    const next = [f("k1", { snippet: "갱신됨" }), f("k2")];
    const out = mergeFlags(prev, next);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: "k1", checked: true, note: "확인함", snippet: "갱신됨" });
    expect(out[1]).toMatchObject({ key: "k2", checked: false, note: "" });
  });
  it("사라진 key는 제거된다", () => {
    const out = mergeFlags([f("gone", { checked: true })], [f("k2")]);
    expect(out.map((x) => x.key)).toEqual(["k2"]);
  });
});
```

- [ ] **Step 2: 실행 → FAIL 확인** — `npx vitest run src/features/dev-controls` → "Cannot find module '../flag-merge'"

- [ ] **Step 3: 구현**

```ts
// src/features/dev-controls/schemas.ts
import { z } from "zod";

export const devControlFlagSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  snippet: z.string(),
  severity: z.enum(["warn", "info"]),
  checked: z.boolean(),
  note: z.string().max(2000),
});
export type DevControlFlag = z.infer<typeof devControlFlagSchema>;

export const updateDevControlFlagSchema = z.object({
  analysisId: z.string().uuid(),
  flagKey: z.string().min(1),
  checked: z.boolean(),
  note: z.string().max(2000),
});

export type DevControlAnalysis = {
  id: string;
  service_id: number;
  gen_flag: string;
  kind: "A" | "AU";
  code_hash: string;
  raw_code: string;
  summary_md: string | null;
  flags: DevControlFlag[];
  analyzed_at: string;
};
```

```ts
// src/features/dev-controls/flag-merge.ts
import type { DevControlFlag } from "./schemas";

/** 재분석 결과(next)에 기존(prev)의 checked/note를 key 매칭으로 이식. */
export function mergeFlags(
  prev: DevControlFlag[],
  next: DevControlFlag[],
): DevControlFlag[] {
  const prevByKey = new Map(prev.map((p) => [p.key, p]));
  return next.map((n) => {
    const old = prevByKey.get(n.key);
    return old ? { ...n, checked: old.checked, note: old.note } : n;
  });
}
```

```ts
// src/features/dev-controls/queries.ts
import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import type { DevControlAnalysis } from "./schemas";

export async function listDevControlAnalyses(): Promise<DevControlAnalysis[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("dev_control_analyses")
    .select("id, service_id, gen_flag, kind, code_hash, raw_code, summary_md, flags, analyzed_at")
    .order("analyzed_at", { ascending: false });
  if (error) throw new Error(`dev_control_analyses 조회 실패: ${error.message}`);
  return (data ?? []) as DevControlAnalysis[];
}
```

```ts
// src/features/dev-controls/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { updateDevControlFlagSchema, devControlFlagSchema } from "./schemas";
import { z } from "zod";

export async function updateDevControlFlag(
  input: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = updateDevControlFlagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("dev_control_analyses")
    .select("flags")
    .eq("id", parsed.data.analysisId)
    .single();
  if (error) return { ok: false, error: error.message };

  const flags = z.array(devControlFlagSchema).parse(data.flags);
  const next = flags.map((f) =>
    f.key === parsed.data.flagKey
      ? { ...f, checked: parsed.data.checked, note: parsed.data.note }
      : f,
  );
  const { error: upErr } = await admin
    .from("dev_control_analyses")
    .update({ flags: next })
    .eq("id", parsed.data.analysisId);
  if (upErr) return { ok: false, error: upErr.message };
  revalidatePath("/dashboard/dev-test");
  return { ok: true };
}
```

주의: `createServerSupabase`/`createAdminSupabase` 실제 export 이름은 `src/lib/supabase/server.ts`·`admin.ts`에서 확인 후 맞출 것 (기존 features/*/queries.ts 임포트 관례 복사).

- [ ] **Step 4: 실행 → PASS 확인** — `npx vitest run src/features/dev-controls` (flag-merge 2 + schemas 스모크)

- [ ] **Step 5: Commit** — `feat(dev-control): 스키마·플래그 병합·쿼리·체크 액션`

---

### Task 3: 수집·분석 스크립트 (PC cron)

**Files:**
- Create: `scripts/dev-control-analyze.mjs`
- Create: `scripts/lib/dev-control-lib.mjs` (순수 로직 — 테스트 대상)
- Test: `src/features/dev-controls/__tests__/dev-control-lib.test.ts` (vitest가 .mjs import)

**Interfaces:**
- Consumes: Task 1 테이블, `.env.local` MOA_*/SUPABASE_*
- Produces (lib): `parseDevInfo(resText: string): { fileName: string; kind: "A" | "AU"; content: string }[]` / `buildClaudePrompt(kind, code): string` / `parseClaudeJson(stdout: string): { summary_md: string; flags: {key,label,snippet,severity}[] }` / `sha256(text): string`

- [ ] **Step 1: 실패 테스트 작성 — parseDevInfo·parseClaudeJson**

```ts
// src/features/dev-controls/__tests__/dev-control-lib.test.ts
import { describe, it, expect } from "vitest";
// @ts-expect-error 없이 동작 — vitest는 .mjs 상대 import 지원
import { parseDevInfo, parseClaudeJson, sha256 } from "../../../../scripts/lib/dev-control-lib.mjs";

describe("parseDevInfo", () => {
  it("d(JSON string)에서 js 파일만 kind 판별해 추출", () => {
    const d = JSON.stringify([
      { FileName: "Apply1_A.aspx", Extension: ".aspx", FileContents: "" },
      { FileName: "Apply1_A.js", Extension: "js", FileContents: "var a=1;" },
      { FileName: "Apply1_AU.js", Extension: "js", FileContents: "var u=1;" },
    ]);
    const out = parseDevInfo(JSON.stringify({ d }));
    expect(out).toEqual([
      { fileName: "Apply1_A.js", kind: "A", content: "var a=1;" },
      { fileName: "Apply1_AU.js", kind: "AU", content: "var u=1;" },
    ]);
  });
});

describe("parseClaudeJson", () => {
  it("```json 펜스/전후 텍스트가 섞여도 JSON을 추출한다", () => {
    const stdout = '설명\n```json\n{"summary_md":"요약","flags":[{"key":"k","label":"L","snippet":"s","severity":"warn"}]}\n```';
    expect(parseClaudeJson(stdout).flags[0].key).toBe("k");
  });
  it("JSON 없으면 throw", () => {
    expect(() => parseClaudeJson("no json here")).toThrow();
  });
});

describe("sha256", () => {
  it("같은 입력 같은 해시", () => {
    expect(sha256("a")).toBe(sha256("a"));
    expect(sha256("a")).not.toBe(sha256("b"));
  });
});
```

- [ ] **Step 2: 실행 → FAIL 확인**

- [ ] **Step 3: lib 구현**

```js
// scripts/lib/dev-control-lib.mjs
import crypto from "node:crypto";

export const sha256 = (text) =>
  crypto.createHash("sha256").update(text, "utf8").digest("hex");

/** GetDevInfoByUnivServiceId 응답 → js 파일(A/AU)만 추출. */
export function parseDevInfo(resText) {
  const files = JSON.parse(JSON.parse(resText).d);
  return files
    .filter((f) => f.Extension === "js" && f.FileContents)
    .map((f) => ({
      fileName: f.FileName,
      kind: /U\.js$/i.test(f.FileName) ? "AU" : "A",
      content: f.FileContents,
    }));
}

export function buildClaudePrompt(kind, code) {
  const role =
    kind === "A"
      ? "운영자가 직접 관리하는 원서제어(A.js)"
      : "개발자만 관리하는 원서제어(AU.js)";
  return [
    `다음은 대입 원서접수 시스템의 ${role} 코드다.`,
    "운영자(비개발자)가 이해할 수 있게 정리하라. 반드시 아래 JSON만 출력:",
    '{"summary_md":"## 제어 요약\\n- ...(markdown, 무엇을 언제 어떻게 제어하는지 항목별로)","flags":[{"key":"<규칙>:<식별자>","label":"확인 필요 사유 한줄","snippet":"해당 코드 조각(1~3줄)","severity":"warn|info"}]}',
    "flags 추출 기준: ① 지난 연도/학년도(올해 2026 기준 과거) 날짜·문구 ② 마감일·기간 안내 alert/문구 ③ 하드코딩 학년도·전형코드 ④ 주석 처리된 의심 코드. 확인 불필요하면 빈 배열.",
    "key는 재분석 시에도 동일 항목이면 같아야 한다 — 규칙명:코드조각 앞 20자 형태로.",
    "```js",
    code,
    "```",
  ].join("\n");
}

/** claude -p stdout에서 JSON 추출 (펜스/전후 텍스트 허용). */
export function parseClaudeJson(stdout) {
  const fence = stdout.match(/```json\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : stdout.slice(stdout.indexOf("{"), stdout.lastIndexOf("}") + 1);
  const obj = JSON.parse(raw);
  if (typeof obj.summary_md !== "string" || !Array.isArray(obj.flags))
    throw new Error("claude 응답 형식 불일치");
  return obj;
}
```

- [ ] **Step 4: 실행 → PASS 확인** — `npx vitest run src/features/dev-controls`

- [ ] **Step 5: 메인 스크립트 구현** (검증된 프로브 로직 이식)

```js
// scripts/dev-control-analyze.mjs
// 원서GEN 로그인 → A/AU.js 수집 → 변경분만 claude -p 분석 → Supabase 적재
// 실행: node scripts/dev-control-analyze.mjs [serviceId ...]  (미지정 시 전체 testable)
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { sha256, parseDevInfo, buildClaudePrompt, parseClaudeJson } from "./lib/dev-control-lib.mjs";

const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/).filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const BASE = "https://generator.jinhakapply.com";
const GEN_FLAGS = ["WA", "WB", "WC", "WD"];

const jar = {};
const save = (r) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const [k, v] = p.split("="); jar[k.trim()] = v; } };
const ck = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
const hidden = (h, n) => (h.match(new RegExp(`name="${n}"[^>]*value="([^"]*)"`)) ?? [])[1] ?? "";

async function login() {
  let r = await fetch(`${BASE}/Login.aspx`); save(r);
  const h = await r.text();
  r = await fetch(`${BASE}/Login.aspx`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: ck() },
    body: new URLSearchParams({
      __VIEWSTATE: hidden(h, "__VIEWSTATE"),
      __VIEWSTATEGENERATOR: hidden(h, "__VIEWSTATEGENERATOR"),
      __EVENTVALIDATION: hidden(h, "__EVENTVALIDATION"),
      AdminId: env.MOA_USERNAME, AdminPassWord: env.MOA_PASSWORD, LoginBtn: "",
    }).toString(),
  }); save(r);
  if (r.status !== 302 || !jar.Generator) { console.error("[dev-control] 로그인 실패 — 중단(계정 잠금 방지)"); process.exit(1); }
}

async function fetchDevInfo(serviceId, genFlag) {
  const r = await fetch(`${BASE}/_AU/Default.aspx/GetDevInfoByUnivServiceId`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", Cookie: ck() },
    body: JSON.stringify({ UnivServiceID: String(serviceId), GenFlag: genFlag }),
  });
  if (r.status !== 200) return null; // 존재하지 않는 GenFlag — 정상 skip
  return parseDevInfo(await r.text());
}

function analyze(kind, code) {
  const out = execFileSync("claude", ["-p", buildClaudePrompt(kind, code)], {
    encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 300_000,
  });
  return parseClaudeJson(out);
}

const mergeFlags = (prev, next) => {
  const byKey = new Map((prev ?? []).map((p) => [p.key, p]));
  return next.map((n) => {
    const old = byKey.get(n.key);
    return { ...n, checked: old?.checked ?? false, note: old?.note ?? "" };
  });
};

const argIds = process.argv.slice(2).map(Number).filter(Boolean);
const { data: services, error } = await sb.from("services")
  .select("service_id").not("service_id", "is", null);
if (error) { console.error(error.message); process.exit(1); }
const ids = argIds.length ? argIds : [...new Set(services.map((s) => s.service_id))];

await login();
let analyzed = 0, skipped = 0, failed = 0;
for (const id of ids) {
  for (const genFlag of GEN_FLAGS) {
    const files = await fetchDevInfo(id, genFlag);
    if (!files) continue;
    for (const f of files) {
      const hash = sha256(f.content);
      const { data: prev } = await sb.from("dev_control_analyses")
        .select("id, code_hash, flags").eq("service_id", id)
        .eq("gen_flag", genFlag).eq("kind", f.kind).maybeSingle();
      if (prev?.code_hash === hash) { skipped++; continue; }
      let summary_md = null, flags = [];
      try {
        const res = analyze(f.kind, f.content);
        summary_md = res.summary_md;
        flags = mergeFlags(prev?.flags, res.flags);
      } catch (e) {
        failed++;
        console.error(`[dev-control] 분석 실패 ${id}/${genFlag}/${f.kind}: ${e.message} — raw만 저장`);
      }
      const { error: upErr } = await sb.from("dev_control_analyses").upsert({
        service_id: id, gen_flag: genFlag, kind: f.kind, code_hash: hash,
        raw_code: f.content, summary_md, flags, analyzed_at: new Date().toISOString(),
      }, { onConflict: "service_id,gen_flag,kind" });
      if (upErr) { failed++; console.error(`[dev-control] upsert 실패: ${upErr.message}`); }
      else analyzed++;
    }
  }
}
console.log(`[dev-control] 완료 — 분석 ${analyzed} / 스킵 ${skipped} / 실패 ${failed}`);
```

- [ ] **Step 6: 실 서비스 1건 수동 검증** — `node scripts/dev-control-analyze.mjs 9998793`
Expected: `완료 — 분석 2 / 스킵 0 / 실패 0` + Supabase에 A/AU 2행. 재실행 시 `스킵 2`.

- [ ] **Step 7: Commit** — `feat(dev-control): 원서GEN 수집·claude -p 분석 스크립트`

---

### Task 4: dev-test 페이지 탭 분리

**Files:**
- Create: `src/app/dashboard/dev-test/DevTestTabs.tsx`
- Modify: `src/app/dashboard/dev-test/page.tsx` (searchParams에 `tab` 추가, 분기 렌더)
- Test: `src/app/dashboard/dev-test/__tests__/DevTestTabs.test.tsx`

**Interfaces:**
- Consumes: `HandoverTabs`(`src/app/dashboard/handover/HandoverTabs.tsx`) 패턴 — `useSearchParams().get("tab")`
- Produces: `<DevTestTabs />` — `test`(기본)/`dev` 2탭, `?tab=` 링크. page는 `sp.tab === "dev"` 분기

- [ ] **Step 1: 실패 테스트 작성** — HandoverTabs 테스트(`src/app/dashboard/handover/__tests__/HandoverTabs.test.tsx`)를 복사해 라벨만 교체: 기본(미지정)=테스트 활성, `?tab=dev`=개발 활성, 링크 href 검증
- [ ] **Step 2: 실행 → FAIL**
- [ ] **Step 3: `DevTestTabs.tsx` 구현** — `HandoverTabs.tsx`를 복사해 `TABS = [{key:"test",label:"테스트"},{key:"dev",label:"개발"}]`, 기본 key `test`, href `/dashboard/dev-test?tab=${key}`(test는 파라미터 생략). 스타일 클래스는 HandoverTabs 그대로 유지
- [ ] **Step 4: page.tsx 분기** — `sp.tab === "dev"`면 Task 6의 `<DevControlSection …/>` 렌더, 아니면 기존 JSX 그대로. 헤더 아래 `<DevTestTabs />` 삽입. 기존 테스트 탭 코드는 이동 없이 조건부 렌더만
- [ ] **Step 5: 실행 → PASS + 기존 dev-test 테스트 회귀 확인** — `npx vitest run src/app/dashboard/dev-test`
- [ ] **Step 6: Commit** — `feat(dev-test): 개발/테스트 URL 탭 분리 (기본=테스트)`

---

### Task 5: dev-control list-variant (인스펙터)

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/dev-control/View.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/dev-control/Table.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/types.ts` (Variant union + ListRow 필드)
- Modify: `src/app/dashboard/_components/inspector/list-variants/registry.ts` (1줄)
- Test: `src/app/dashboard/_components/inspector/list-variants/dev-control/__tests__/View.test.tsx`

**Interfaces:**
- Consumes: `DevControlAnalysis`/`DevControlFlag`(Task 2), `updateDevControlFlag` action
- Produces: variant `"dev-control"`. ListRow 확장 필드 `devControlAnalyses?: DevControlAnalysis[]` (서비스당 A/AU × genFlag 배열)

- [ ] **Step 1: 실패 테스트 작성 — View**

```tsx
// __tests__/View.test.tsx 핵심 케이스 (data-request View.test 관례 복사)
// 1) 요약 markdown 렌더 + A/AU 섹션 구분 표시
// 2) 미확인 flag: 체크박스 + 메모 input 렌더, 체크 시 updateDevControlFlag 호출(mock)
// 3) 원본 코드 <details> 접힘 상태로 존재
// 4) 분석 없음(row.devControlAnalyses 빈 배열) → "수집된 원서제어 없음" 빈 상태
```
mock: `vi.mock("@/features/dev-controls/actions", () => ({ updateDevControlFlag: vi.fn(async () => ({ ok: true })) }))`

- [ ] **Step 2: 실행 → FAIL**
- [ ] **Step 3: View/Table 구현**
  - `View.tsx`: analyses를 `kind` 순(A → AU)으로 섹션 렌더. 각 섹션: 제목 배지(`A=운영자 제어`/`AU=개발자 제어`), summary_md(`whitespace-pre-wrap text-xs`), flags 리스트(체크박스 + note input — `useTransition`으로 action 호출, 입력 스타일 `border-line-soft bg-field-bg … focus:border-ink focus:bg-white`), `<details><summary>원본 코드</summary><pre className="max-h-80 overflow-auto text-2xs">…</pre></details>`
  - `Table.tsx`: 컬럼 대학명·서비스명·제어파일(A/AU 배지)·확인 필요 N건(`flags.filter(f=>!f.checked).length` 합, >0이면 `bg-vermilion text-cream` 배지)·최근 분석일. 행 호버 `hover:bg-line-soft`, 선택 `bg-vermilion/10`
  - `types.ts`: Variant union에 `"dev-control"`, ListRow에 `devControlAnalyses?: DevControlAnalysis[]`
  - `registry.ts`: `"dev-control": { View: DevControlView, Table: DevControlTable }` static import 1줄
- [ ] **Step 4: 실행 → PASS** — `npx vitest run "src/app/dashboard/_components/inspector/list-variants/dev-control"`
- [ ] **Step 5: Commit** — `feat(dev-control): dev-control 인스펙터 variant (요약/플래그 체크/원본)`

---

### Task 6: 개발 탭 목록 조립 (page 데이터 연결)

**Files:**
- Create: `src/app/dashboard/dev-test/DevControlSection.tsx` (server component — 데이터 조립 + ListPattern)
- Modify: `src/app/dashboard/dev-test/page.tsx` (Task 4 분기에서 호출)
- Test: `src/app/dashboard/dev-test/__tests__/dev-control-rows.test.ts` (행 조립 순수함수)

**Interfaces:**
- Consumes: `listDevControlAnalyses()`(Task 2), `listTestableServices()`(기존), variant `"dev-control"`(Task 5)
- Produces: `buildDevControlRows(services, analyses): ListRow[]` — 서비스 기준 그룹, `devControlAnalyses` 첨부, 분석 없는 서비스도 포함(미수집 표시)

- [ ] **Step 1: 실패 테스트 — buildDevControlRows** (분석 있는 서비스 그룹핑 / 없는 서비스 빈 배열 / 미확인 건수 계산)
- [ ] **Step 2: 실행 → FAIL**
- [ ] **Step 3: 구현** — `buildDevControlRows`를 `DevControlSection.tsx`에서 분리 export(또는 `dev-control-rows.ts`). ListPattern `variant="dev-control"` + 검색(대학명·서비스명, ListSearch) + ListPagination(30)
- [ ] **Step 4: 실행 → PASS + dev-test 전체 회귀** — `npx vitest run src/app/dashboard/dev-test`
- [ ] **Step 5: 라이브 검증** — dev 서버에서 `?tab=dev` 렌더 + 인스펙터 체크/메모 동작 확인 (Task 3에서 적재한 9998793 실데이터)
- [ ] **Step 6: Commit** — `feat(dev-test): 개발 탭 목록 + 인스펙터 연결`

---

### Task 7: 마무리 검증 + PR

- [ ] `npm run lint` → 0 에러 / `npx tsc --noEmit` → 0 에러
- [ ] `npx vitest run src/features/dev-controls src/app/dashboard/dev-test "src/app/dashboard/_components/inspector"` 전부 통과
- [ ] 설계/계획 문서(`docs/superpowers/…`) 함께 스테이징
- [ ] PR: `feat(dev-test): 개발 탭 — 원서제어 수집·AI 분석·확인 피드백` (Summary + Test plan, squash)
- [ ] CLAUDE.md list-variants variant 수 갱신(16→17) 1줄

## Self-Review 결과

- 스펙 커버리지: 탭(4)·수집(3)·분석 적재(1,3)·체크/메모(2,5)·목록(6)·에러 처리(3 스크립트 exit/skip) — 커버됨
- 플레이스홀더: Task 5 Step 1은 케이스 목록이지만 mock·관례 파일 명시로 실행 가능 수준 — 유지
- 타입 일관성: `DevControlAnalysis`/`DevControlFlag`/`mergeFlags` Task 2 정의를 3·5·6이 동일 사용. 스크립트 mergeFlags는 .mjs 중복 구현(웹 코드와 런타임 분리) — 의도적, flag-merge.ts와 동작 동일함을 테스트가 보장
