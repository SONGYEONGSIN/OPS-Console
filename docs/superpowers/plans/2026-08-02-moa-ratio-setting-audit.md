# 경쟁률 세팅 오설정 점검 자동화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Moa 경쟁률 설정의 안내문구가 스케줄 세팅과 어긋난 서비스를 수시 전수에서 찾아 DB에 적재하고 Teams로 요약 통보한다.

**Architecture:** 맥 로컬에서 `audit.py`가 Moa 로그인 세션을 잡고 `POST /Ratio/GetRatioList`로 목록 전체를 한 번에 받은 뒤, 대상 서비스의 설정 페이지를 순회해 스케줄·문구를 뽑는다. 판정은 로컬 `claude -p`가 배치로 처리하고, 결과 JSON만 `POST /api/ratio-audit/ingest`로 보내면 서버가 `ratio_audit_runs`에 적재하고 Teams 요약을 발송한다. 판정 규칙(`judge.py`)과 요약 조립(`summary.ts`)은 브라우저·네트워크 없이 테스트된다.

**Tech Stack:** Python 3 + Selenium(기존 `scripts/moa-closing/scrape.py` 로그인 재사용) + requests, Next.js App Router Route Handler, zod, Supabase(service_role), Microsoft Graph Teams, Vitest, Python unittest

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md` — 부록 A에 확정 셀렉터·엔드포인트가 있다. 구현 중 의문이 생기면 추측하지 말고 부록 A를 본다.
- 주석·커밋 메시지는 한국어, 커밋 접두사만 영어(`feat:`/`fix:`/`test:`/`chore:`/`docs:`).
- `any` 타입 금지, `@ts-ignore` 금지, `eslint-disable` 금지, `console.log` 잔류 금지.
- zod 에러 접근은 `parsed.error.issues[0].message` (`.errors` 아님).
- 하드코딩 시크릿 금지. 새 환경변수는 `TEAMS_RATIO_AUDIT_CHAT_ID`, `RATIO_AUDIT_DRY_RUN` 둘뿐이다.
- 판정 기준(스펙 §3 확정): **문구의 날짜 연도가 스케줄 라인들의 연도 집합에 없으면 이상**. 실행 시점 연도로 고정하지 않는다.
- 스케줄 라인 중 `테스트용`이 포함된 라인은 판정 전 제외한다.
- **스케줄 실행로그는 claude에 절대 넘기지 않는다** (수백 줄이라 프롬프트를 잠식한다). 스케줄 세팅 컬럼만 쓴다.
- Teams 발송 실패가 DB 적재를 무르지 않는다. 적재 후 발송하고 실패 시 `notified=false`로 남긴다.
- 이번 범위는 **수시(`closing_services.category = '수시'`)** 만. 서브상단(`#txtTopSubText`)·하단(`#txtFooterText`)은 점검 대상이 아니다.
- 자동 수정 금지. 발견만 하고 Moa의 값을 바꾸지 않는다. 저장·배포 버튼을 누르는 코드를 작성하지 않는다.

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20260802_ratio_audit_runs.sql` | 실행 이력 테이블 + RLS |
| `src/features/ratio-audit/schemas.ts` | 인제스트 payload zod 계약 (신뢰 경계) |
| `src/features/ratio-audit/summary.ts` | 이상 건 집계 + Teams HTML 조립 (순수 함수) |
| `src/features/ratio-audit/queries.ts` | 점검 대상(수시) 조회 |
| `src/app/api/ratio-audit/targets/route.ts` | GET — 스크래퍼에 대상 목록 제공 |
| `src/app/api/ratio-audit/ingest/route.ts` | POST — 결과 적재 + Teams 발송 |
| `scripts/moa-ratio/judge.py` | 마크업 정리 · 테스트용 라인 제외 · 프롬프트 · 응답 파싱 (순수 함수) |
| `scripts/moa-ratio/test_judge.py` | judge.py unittest |
| `scripts/moa-ratio/audit.py` | 오케스트레이션 (로그인 → 목록 → 순회 → 판정 → 인제스트) |
| `scripts/moa-ratio/requirements.txt` | Python 의존성 |

판정 규칙은 `judge.py`, 요약 규칙은 `summary.ts`에만 둔다. `audit.py`는 수집·전달만 하고 규칙을 갖지 않는다.

---

### Task 1: 실행 이력 테이블 + RLS

**Files:**
- Create: `supabase/migrations/20260802_ratio_audit_runs.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `public.ratio_audit_runs` 테이블 — 컬럼 `id uuid`, `ran_at timestamptz`, `scanned_count int`, `finding_count int`, `link_error_count int`, `status text`, `notified boolean`, `payload jsonb`

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/20260802_ratio_audit_runs.sql`:

```sql
-- 경쟁률 세팅 점검 실행 이력. 판정 규칙이 파일럿에서 바뀌므로 상세는 payload jsonb로 둔다
-- (receivables_match_runs 와 동일 전략). 조회 화면은 규칙 안정화 후 별도 검토.

begin;

create table if not exists public.ratio_audit_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  scanned_count int not null,
  finding_count int not null,
  link_error_count int not null,
  status text not null,
  notified boolean not null default false,
  payload jsonb not null
);

alter table public.ratio_audit_runs
  drop constraint if exists ratio_audit_runs_status_check;
alter table public.ratio_audit_runs
  add constraint ratio_audit_runs_status_check
  check (status in ('ok', 'partial', 'failed'));

create index if not exists ratio_audit_runs_ran_at_idx
  on public.ratio_audit_runs (ran_at desc);

-- RLS — read: authenticated 전체(운영부 공개) / write: service_role only.
-- worklog 와 동일 정책. 이력은 append-only 로 UI에서 변조 불가.
alter table public.ratio_audit_runs enable row level security;

drop policy if exists "ratio_audit_runs_read_authenticated" on public.ratio_audit_runs;
create policy "ratio_audit_runs_read_authenticated"
  on public.ratio_audit_runs for select to authenticated using (true);

grant select on public.ratio_audit_runs to authenticated;
grant all on public.ratio_audit_runs to service_role;

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 2: 운영 DB에 적용**

Supabase CLI가 없으므로 `pg`를 임시 설치해 인라인으로 적용한다 (`package.json` 미변경).

```bash
npm i pg --no-save
node -e "
const fs=require('fs'), pg=require('pg');
const url=fs.readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.*)\$/m)[1].trim().replace(/^[\"']|[\"']\$/g,'');
const sql=fs.readFileSync('supabase/migrations/20260802_ratio_audit_runs.sql','utf8');
(async()=>{const c=new pg.Client({connectionString:url,ssl:{rejectUnauthorized:false}});
await c.connect(); await c.query(sql); await c.end(); console.log('applied');})();
"
```

Expected: `applied`

- [ ] **Step 3: 적용 검증 — 테이블 존재 + RLS 차단**

```bash
node -e "
const fs=require('fs');
const e=fs.readFileSync('.env.local','utf8');
const g=k=>e.match(new RegExp('^'+k+'=(.*)\$','m'))[1].trim();
const {createClient}=require('@supabase/supabase-js');
(async()=>{
const admin=createClient(g('NEXT_PUBLIC_SUPABASE_URL'),g('SUPABASE_SERVICE_ROLE_KEY'));
const a=await admin.from('ratio_audit_runs').select('id',{count:'exact',head:true});
console.log('service_role select:', a.error?a.error.message:'OK count='+a.count);
const anon=createClient(g('NEXT_PUBLIC_SUPABASE_URL'),g('NEXT_PUBLIC_SUPABASE_ANON_KEY'));
const b=await anon.from('ratio_audit_runs').insert({scanned_count:0,finding_count:0,link_error_count:0,status:'ok',payload:{}});
console.log('anon insert (차단돼야 정상):', b.error?b.error.code+' '+b.error.message:'!!! 허용됨 — RLS 오류');
})();
"
```

Expected: `service_role select: OK count=0` 그리고 anon insert는 에러(권한 거부).

- [ ] **Step 4: 커밋**

```bash
git add supabase/migrations/20260802_ratio_audit_runs.sql
git commit -m "feat(ratio-audit): 실행 이력 테이블 + RLS"
```

---

### Task 2: 인제스트 payload zod 계약

**Files:**
- Create: `src/features/ratio-audit/schemas.ts`
- Test: `src/features/ratio-audit/__tests__/schemas.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `ratioAuditIngestSchema` — `{ scannedCount: number; findings: RatioFinding[]; linkErrors: RatioLinkError[]; skipped: RatioSkipped[] }`
  - 타입 `RatioAuditIngest`, `RatioFinding`, `RatioFindingItem`, `RatioLinkError`, `RatioSkipped`
  - `RatioFindingItem` = `{ type: "year" | "schedule"; field: "pre_open" | "top"; found: string; expect: string; quote: string }`
  - `RatioFinding` = `{ serviceId: number; universityName: string; serviceName: string; operatorName: string; items: RatioFindingItem[] }`
  - `RatioLinkError` = `{ serviceId: number; url: string; status: number; reason: string }`
  - `RatioSkipped` = `{ serviceId: number; reason: string }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/ratio-audit/__tests__/schemas.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ratioAuditIngestSchema } from "../schemas";

const valid = {
  scannedCount: 2,
  findings: [
    {
      serviceId: 1093020,
      universityName: "성신여자대학교",
      serviceName: "수시",
      operatorName: "김지영",
      items: [
        {
          type: "year",
          field: "top",
          found: "2025학년도",
          expect: "2026",
          quote: "2025학년도 경쟁률은",
        },
      ],
    },
  ],
  linkErrors: [
    { serviceId: 1093020, url: "https://addon.jinhakapply.com/a.html", status: 404, reason: "" },
  ],
  skipped: [{ serviceId: 1130056, reason: "설정 페이지 진입 실패" }],
};

describe("ratioAuditIngestSchema", () => {
  it("정상 payload 통과", () => {
    const parsed = ratioAuditIngestSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("이상 0건 payload도 통과 (빈 배열 허용)", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      scannedCount: 10,
      findings: [],
      linkErrors: [],
      skipped: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("quote·reason 누락 시 빈 문자열로 채운다", () => {
    const parsed = ratioAuditIngestSchema.parse({
      scannedCount: 1,
      findings: [
        {
          serviceId: 1,
          universityName: "가대",
          serviceName: "수시",
          operatorName: "홍길동",
          items: [{ type: "schedule", field: "pre_open", found: "9월 7일", expect: "9월 8일" }],
        },
      ],
      linkErrors: [{ serviceId: 1, url: "https://x.test/a.html", status: 0 }],
      skipped: [],
    });
    expect(parsed.findings[0].items[0].quote).toBe("");
    expect(parsed.linkErrors[0].reason).toBe("");
  });

  it("items 빈 배열인 finding은 거부 (이상 없으면 finding 자체를 넣지 않는다)", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      ...valid,
      findings: [{ ...valid.findings[0], items: [] }],
    });
    expect(parsed.success).toBe(false);
  });

  it("알 수 없는 type은 거부", () => {
    const parsed = ratioAuditIngestSchema.safeParse({
      ...valid,
      findings: [
        { ...valid.findings[0], items: [{ ...valid.findings[0].items[0], type: "typo" }] },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("scannedCount 음수는 거부", () => {
    const parsed = ratioAuditIngestSchema.safeParse({ ...valid, scannedCount: -1 });
    expect(parsed.success).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ratio-audit/__tests__/schemas.test.ts`
Expected: FAIL — `Failed to resolve import "../schemas"`

- [ ] **Step 3: 최소 구현**

`src/features/ratio-audit/schemas.ts`:

```ts
import { z } from "zod";

/**
 * ratio-audit(경쟁률 세팅 점검) 인제스트 계약.
 *
 * 스크래퍼(scripts/moa-ratio/audit.py)가 보내는 결과의 신뢰 경계.
 * claude 판정 결과가 그대로 들어오므로 type/field는 열거형으로 좁혀
 * 프롬프트가 헛짚은 값이 DB에 남지 않게 한다.
 */

export const ratioFindingItemSchema = z.object({
  /** year: 문구의 날짜 연도가 스케줄 연도 집합에 없음 / schedule: 날짜·시각 불일치 */
  type: z.enum(["year", "schedule"]),
  /** 어느 문구에서 발견했는지 — 오픈전 내용 / 상단 내용 */
  field: z.enum(["pre_open", "top"]),
  found: z.string().min(1),
  expect: z.string().min(1),
  quote: z.string().default(""),
});

export const ratioFindingSchema = z.object({
  serviceId: z.number().int().positive(),
  universityName: z.string().min(1),
  serviceName: z.string().default(""),
  operatorName: z.string().default(""),
  // 이상이 없으면 finding 자체를 보내지 않는다(빈 items는 계약 위반).
  items: z.array(ratioFindingItemSchema).min(1),
});

export const ratioLinkErrorSchema = z.object({
  serviceId: z.number().int().positive(),
  url: z.string().url(),
  /** HTTP 상태코드. 요청 자체가 실패하면 0 */
  status: z.number().int(),
  reason: z.string().default(""),
});

export const ratioSkippedSchema = z.object({
  serviceId: z.number().int().positive(),
  reason: z.string().min(1),
});

export const ratioAuditIngestSchema = z.object({
  scannedCount: z.number().int().nonnegative(),
  findings: z.array(ratioFindingSchema),
  linkErrors: z.array(ratioLinkErrorSchema),
  skipped: z.array(ratioSkippedSchema),
});

export type RatioFindingItem = z.infer<typeof ratioFindingItemSchema>;
export type RatioFinding = z.infer<typeof ratioFindingSchema>;
export type RatioLinkError = z.infer<typeof ratioLinkErrorSchema>;
export type RatioSkipped = z.infer<typeof ratioSkippedSchema>;
export type RatioAuditIngest = z.infer<typeof ratioAuditIngestSchema>;
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ratio-audit/__tests__/schemas.test.ts`
Expected: PASS (6건)

- [ ] **Step 5: 커밋**

```bash
git add src/features/ratio-audit/schemas.ts src/features/ratio-audit/__tests__/schemas.test.ts
git commit -m "feat(ratio-audit): 인제스트 payload zod 계약"
```

---

### Task 3: 집계 + Teams HTML 조립

**Files:**
- Create: `src/features/ratio-audit/summary.ts`
- Test: `src/features/ratio-audit/__tests__/summary.test.ts`

**Interfaces:**
- Consumes: Task 2의 `RatioAuditIngest`
- Produces:
  - `SUMMARY_TOP_N = 10`
  - `summarizeRatioAudit(input: RatioAuditIngest): { scannedCount: number; findingCount: number; linkErrorCount: number; status: "ok" | "partial" }`
  - `buildRatioAuditHtml(input: RatioAuditIngest): string`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/ratio-audit/__tests__/summary.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { summarizeRatioAudit, buildRatioAuditHtml, SUMMARY_TOP_N } from "../summary";
import type { RatioAuditIngest, RatioFinding } from "../schemas";

function finding(id: number, university: string): RatioFinding {
  return {
    serviceId: id,
    universityName: university,
    serviceName: "수시",
    operatorName: "홍길동",
    items: [
      { type: "year", field: "top", found: "2025학년도", expect: "2026", quote: "2025학년도 경쟁률" },
    ],
  };
}

const base: RatioAuditIngest = {
  scannedCount: 231,
  findings: [],
  linkErrors: [],
  skipped: [],
};

describe("summarizeRatioAudit", () => {
  it("건수를 집계한다", () => {
    const s = summarizeRatioAudit({
      ...base,
      findings: [finding(1, "가대"), finding(2, "나대")],
      linkErrors: [{ serviceId: 3, url: "https://x.test/a.html", status: 404, reason: "" }],
    });
    expect(s).toEqual({
      scannedCount: 231,
      findingCount: 2,
      linkErrorCount: 1,
      status: "ok",
    });
  });

  it("건너뛴 서비스가 있으면 status는 partial", () => {
    const s = summarizeRatioAudit({
      ...base,
      skipped: [{ serviceId: 9, reason: "진입 실패" }],
    });
    expect(s.status).toBe("partial");
  });
});

describe("buildRatioAuditHtml", () => {
  it("이상 0건이면 이상 없음 문구", () => {
    const html = buildRatioAuditHtml(base);
    expect(html).toContain("이상 없음");
    expect(html).not.toContain("<table");
  });

  it("헤더에 순회·이상·링크오류 건수를 담는다", () => {
    const html = buildRatioAuditHtml({
      ...base,
      findings: [finding(1, "가대")],
      linkErrors: [{ serviceId: 3, url: "https://x.test/a.html", status: 404, reason: "" }],
    });
    expect(html).toContain("순회 231");
    expect(html).toContain("이상 1");
    expect(html).toContain("링크오류 1");
  });

  it("이상 건은 대학·서비스·담당자·발견값을 표로 낸다", () => {
    const html = buildRatioAuditHtml({ ...base, findings: [finding(1, "성신여자대학교")] });
    expect(html).toContain("<table");
    expect(html).toContain("성신여자대학교");
    expect(html).toContain("홍길동");
    expect(html).toContain("2025학년도");
  });

  it(`상위 ${SUMMARY_TOP_N}건만 표에 넣고 나머지는 '외 N건'으로 줄인다`, () => {
    const many = Array.from({ length: SUMMARY_TOP_N + 3 }, (_, i) => finding(i + 1, `대학${i + 1}`));
    const html = buildRatioAuditHtml({ ...base, findings: many });
    expect(html).toContain(`대학${SUMMARY_TOP_N}`);
    expect(html).not.toContain(`대학${SUMMARY_TOP_N + 1}`);
    expect(html).toContain("외 3건");
  });

  it("HTML 특수문자를 이스케이프한다", () => {
    const f = finding(1, "가대");
    f.items[0].quote = '<script>alert("x")</script>';
    const html = buildRatioAuditHtml({ ...base, findings: [f] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/features/ratio-audit/__tests__/summary.test.ts`
Expected: FAIL — `Failed to resolve import "../summary"`

- [ ] **Step 3: 최소 구현**

`src/features/ratio-audit/summary.ts`:

```ts
import type { RatioAuditIngest, RatioFinding } from "./schemas";

/**
 * 점검 결과 집계 + Teams 메시지 HTML 조립 (순수 함수).
 *
 * 이상 건이 수십 개일 수 있어 메시지에는 상위 N건만 넣고 나머지는 건수로 줄인다.
 * 전체 상세는 ratio_audit_runs.payload 에 남는다.
 */

export const SUMMARY_TOP_N = 10;

const FIELD_LABEL: Record<string, string> = {
  pre_open: "오픈전",
  top: "상단",
};

const TYPE_LABEL: Record<string, string> = {
  year: "연도",
  schedule: "일정",
};

export function summarizeRatioAudit(input: RatioAuditIngest): {
  scannedCount: number;
  findingCount: number;
  linkErrorCount: number;
  status: "ok" | "partial";
} {
  return {
    scannedCount: input.scannedCount,
    findingCount: input.findings.length,
    linkErrorCount: input.linkErrors.length,
    status: input.skipped.length > 0 ? "partial" : "ok",
  };
}

/** Teams 메시지는 HTML로 전송되므로 문구·인용문을 그대로 넣지 않는다. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function itemsLabel(finding: RatioFinding): string {
  return finding.items
    .map(
      (i) =>
        `${FIELD_LABEL[i.field] ?? i.field}·${TYPE_LABEL[i.type] ?? i.type}: ` +
        `${escapeHtml(i.found)} → ${escapeHtml(i.expect)}`,
    )
    .join("<br>");
}

export function buildRatioAuditHtml(input: RatioAuditIngest): string {
  const s = summarizeRatioAudit(input);
  const header =
    `<p><b>[운영부 상황실]</b> 경쟁률 세팅 점검 — ` +
    `순회 ${s.scannedCount} / 이상 ${s.findingCount} / 링크오류 ${s.linkErrorCount}</p>`;

  if (s.findingCount === 0 && s.linkErrorCount === 0) {
    return `${header}<p>이상 없음.</p>`;
  }

  const shown = input.findings.slice(0, SUMMARY_TOP_N);
  const rest = input.findings.length - shown.length;

  const rows = shown
    .map(
      (f) =>
        `<tr><td>${escapeHtml(f.universityName)}</td>` +
        `<td>${escapeHtml(f.serviceName)}</td>` +
        `<td>${escapeHtml(f.operatorName)}</td>` +
        `<td>${itemsLabel(f)}</td></tr>`,
    )
    .join("");

  const table = shown.length
    ? `<table border="1" cellpadding="4"><tr><th>대학</th><th>서비스</th>` +
      `<th>담당</th><th>내용</th></tr>${rows}</table>`
    : "";

  const more = rest > 0 ? `<p>외 ${rest}건</p>` : "";
  const links = input.linkErrors.length
    ? `<p>링크오류 ${input.linkErrors.length}건 — ` +
      input.linkErrors
        .slice(0, SUMMARY_TOP_N)
        .map((e) => `${e.serviceId}(${e.status})`)
        .join(", ") +
      `</p>`
    : "";
  const skipped = input.skipped.length
    ? `<p>건너뜀 ${input.skipped.length}건</p>`
    : "";

  return `${header}${table}${more}${links}${skipped}`;
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/features/ratio-audit/__tests__/summary.test.ts`
Expected: PASS (7건)

- [ ] **Step 5: 커밋**

```bash
git add src/features/ratio-audit/summary.ts src/features/ratio-audit/__tests__/summary.test.ts
git commit -m "feat(ratio-audit): 이상 건 집계 + Teams HTML 조립"
```

---

### Task 4: 점검 대상 조회 + targets API

**Files:**
- Create: `src/features/ratio-audit/queries.ts`
- Create: `src/app/api/ratio-audit/targets/route.ts`
- Test: `src/app/api/ratio-audit/targets/__tests__/route.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `RatioAuditTarget` = `{ serviceId: number; universityName: string; serviceName: string; operatorName: string }`
  - `listRatioAuditTargets(): Promise<RatioAuditTarget[]>`
  - `GET /api/ratio-audit/targets` → `{ ok: true, targets: RatioAuditTarget[] }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/ratio-audit/targets/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/ratio-audit/queries", () => ({
  listRatioAuditTargets: vi.fn(),
}));

const { listRatioAuditTargets } = await import("@/features/ratio-audit/queries");

function getReq(auth?: string): Request {
  return new Request("http://localhost/api/ratio-audit/targets", {
    method: "GET",
    headers: auth ? { authorization: auth } : {},
  });
}

describe("GET /api/ratio-audit/targets", () => {
  beforeEach(() => {
    vi.mocked(listRatioAuditTargets).mockReset();
    process.env.CRON_SECRET = "s3cret";
  });

  it("인증 헤더 없으면 401", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq());
    expect(res.status).toBe(401);
    expect(listRatioAuditTargets).not.toHaveBeenCalled();
  });

  it("secret 불일치면 401", async () => {
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("인증되면 대상 목록을 반환", async () => {
    vi.mocked(listRatioAuditTargets).mockResolvedValue([
      { serviceId: 1093020, universityName: "성신여자대학교", serviceName: "수시", operatorName: "김지영" },
    ]);
    const { GET } = await import("../route");
    const res = await GET(getReq("Bearer s3cret"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.targets).toHaveLength(1);
    expect(json.targets[0].serviceId).toBe(1093020);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/api/ratio-audit/targets/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`

- [ ] **Step 3: queries.ts 구현**

`src/features/ratio-audit/queries.ts`:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** 점검 대상 1건 — Moa 목록의 UnivServiceID 와 대조할 키가 serviceId. */
export type RatioAuditTarget = {
  serviceId: number;
  universityName: string;
  serviceName: string;
  operatorName: string;
};

/**
 * 점검 대상 = closing_services 의 수시 서비스.
 *
 * Moa 검색의 서버측 모집구분 필터에 의존하지 않고, 여기서 받은 serviceId 집합과
 * Moa 목록을 교집합해 대상을 정한다(스펙 부록 A — 서버 필터 신뢰하지 않음).
 * 스크래퍼가 CRON_SECRET 으로만 호출하므로 admin client(RLS bypass)를 쓴다.
 */
export async function listRatioAuditTargets(): Promise<RatioAuditTarget[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("closing_services")
    .select("service_id, university_name, service_name, operator_name")
    .eq("category", "수시");
  if (error) throw new Error(`[ratio-audit] 대상 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    serviceId: r.service_id as number,
    universityName: (r.university_name as string | null) ?? "",
    serviceName: (r.service_name as string | null) ?? "",
    operatorName: (r.operator_name as string | null) ?? "",
  }));
}
```

- [ ] **Step 4: route 구현**

`src/app/api/ratio-audit/targets/route.ts`:

```ts
import { NextResponse } from "next/server";
import { listRatioAuditTargets } from "@/features/ratio-audit/queries";

/**
 * 경쟁률 세팅 점검 대상 목록 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 로컬 스크래퍼(scripts/moa-ratio/audit.py)가 순회 대상을 받아간다.
 * 읽기 전용이며 대학명·담당자만 나가므로 secret 누설 시 영향은 정보 노출 한정.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const targets = await listRatioAuditTargets();
    return NextResponse.json({ ok: true, targets });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/api/ratio-audit/targets/__tests__/route.test.ts`
Expected: PASS (3건)

- [ ] **Step 6: 커밋**

```bash
git add src/features/ratio-audit/queries.ts src/app/api/ratio-audit/targets
git commit -m "feat(ratio-audit): 점검 대상 조회 API"
```

---

### Task 5: 결과 인제스트 API (적재 + Teams)

**Files:**
- Create: `src/app/api/ratio-audit/ingest/route.ts`
- Test: `src/app/api/ratio-audit/ingest/__tests__/route.test.ts`

**Interfaces:**
- Consumes: Task 2 `ratioAuditIngestSchema`, Task 3 `summarizeRatioAudit`/`buildRatioAuditHtml`, 기존 `sendTeamsChatMessage`
- Produces: `POST /api/ratio-audit/ingest` → `{ ok: true, id: string, findingCount: number, notified: boolean }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/api/ratio-audit/ingest/__tests__/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertResult = { data: { id: "run-1" }, error: null };
const h = vi.hoisted(() => ({
  single: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  sendTeamsChatMessage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: h.from }),
}));
vi.mock("@/lib/microsoft/teams", () => ({
  sendTeamsChatMessage: h.sendTeamsChatMessage,
}));

function payload(overrides: Record<string, unknown> = {}) {
  return {
    scannedCount: 3,
    findings: [
      {
        serviceId: 1093020,
        universityName: "성신여자대학교",
        serviceName: "수시",
        operatorName: "김지영",
        items: [
          { type: "year", field: "top", found: "2025학년도", expect: "2026", quote: "인용" },
        ],
      },
    ],
    linkErrors: [],
    skipped: [],
    ...overrides,
  };
}

function postReq(body: unknown, auth = "Bearer s3cret"): Request {
  return new Request("http://localhost/api/ratio-audit/ingest", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: auth },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ratio-audit/ingest", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const fn of Object.values(h)) fn.mockReset();
    process.env.CRON_SECRET = "s3cret";
    process.env.TEAMS_RATIO_AUDIT_CHAT_ID = "chat-1";
    h.single.mockResolvedValue(insertResult);
    h.select.mockReturnValue({ single: h.single });
    h.insert.mockReturnValue({ select: h.select });
    h.eq.mockResolvedValue({ error: null });
    h.update.mockReturnValue({ eq: h.eq });
    h.from.mockReturnValue({ insert: h.insert, update: h.update });
    h.sendTeamsChatMessage.mockResolvedValue({ id: "msg-1" });
  });

  it("secret 불일치면 401", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload(), "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("계약 위반 payload는 400", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq({ scannedCount: -1 }));
    expect(res.status).toBe(400);
    expect(h.insert).not.toHaveBeenCalled();
  });

  it("적재 시 집계값과 payload를 함께 넣는다", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(200);
    const row = h.insert.mock.calls[0][0];
    expect(row.scanned_count).toBe(3);
    expect(row.finding_count).toBe(1);
    expect(row.link_error_count).toBe(0);
    expect(row.status).toBe("ok");
    expect(row.payload.findings).toHaveLength(1);
  });

  it("건너뛴 건이 있으면 status=partial", async () => {
    const { POST } = await import("../route");
    await POST(postReq(payload({ skipped: [{ serviceId: 9, reason: "진입 실패" }] })));
    expect(h.insert.mock.calls[0][0].status).toBe("partial");
  });

  it("Teams로 요약을 보내고 notified=true 로 갱신", async () => {
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(h.sendTeamsChatMessage).toHaveBeenCalledTimes(1);
    expect(h.sendTeamsChatMessage.mock.calls[0][0].chatId).toBe("chat-1");
    expect(h.update).toHaveBeenCalledWith({ notified: true });
    expect((await res.json()).notified).toBe(true);
  });

  it("Teams 발송이 실패해도 적재는 유지하고 notified=false", async () => {
    h.sendTeamsChatMessage.mockRejectedValue(new Error("graph 500"));
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(res.status).toBe(200);
    expect((await res.json()).notified).toBe(false);
    expect(h.update).not.toHaveBeenCalled();
  });

  it("채팅방 미설정이면 발송을 건너뛴다", async () => {
    process.env.TEAMS_RATIO_AUDIT_CHAT_ID = "";
    const { POST } = await import("../route");
    const res = await POST(postReq(payload()));
    expect(h.sendTeamsChatMessage).not.toHaveBeenCalled();
    expect((await res.json()).notified).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `npx vitest run src/app/api/ratio-audit/ingest/__tests__/route.test.ts`
Expected: FAIL — `Failed to resolve import "../route"`

- [ ] **Step 3: 최소 구현**

`src/app/api/ratio-audit/ingest/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import { ratioAuditIngestSchema } from "@/features/ratio-audit/schemas";
import {
  summarizeRatioAudit,
  buildRatioAuditHtml,
} from "@/features/ratio-audit/summary";

/**
 * 경쟁률 세팅 점검 결과 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 적재 → Teams 발송 순서를 지킨다. 발송이 실패해도 이력은 남기고 notified=false 로
 * 기록한다(주간 브리핑 초안 알림과 동일 원칙 — 알림 실패로 결과를 버리지 않는다).
 * 발송자는 팀 브리핑과 같은 계정을 쓰고, 방은 TEAMS_RATIO_AUDIT_CHAT_ID 로 분리한다.
 */
// 팀 브리핑과 동일 발신 계정 (team-briefing.ts BRIEFING_SENDER_DEFAULT).
const SENDER_DEFAULT = "ys1114@jinhakapply.com";

function sender(): string {
  return (
    process.env.TEAMS_RATIO_AUDIT_SENDER ||
    process.env.TEAMS_BRIEFING_SENDER ||
    SENDER_DEFAULT
  );
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = ratioAuditIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const s = summarizeRatioAudit(input);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ratio_audit_runs")
    .insert({
      scanned_count: s.scannedCount,
      finding_count: s.findingCount,
      link_error_count: s.linkErrorCount,
      status: s.status,
      payload: input,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "적재 실패" },
      { status: 500 },
    );
  }

  const chatId = process.env.TEAMS_RATIO_AUDIT_CHAT_ID || "";
  let notified = false;
  if (chatId) {
    try {
      await sendTeamsChatMessage({
        operatorEmail: sender(),
        chatId,
        html: buildRatioAuditHtml(input),
      });
      await admin.from("ratio_audit_runs").update({ notified: true }).eq("id", data.id);
      notified = true;
    } catch {
      // 발송 실패로 적재를 무르지 않는다. notified=false 로 남겨 재발송 판단에 쓴다.
      notified = false;
    }
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    findingCount: s.findingCount,
    notified,
  });
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `npx vitest run src/app/api/ratio-audit/ingest/__tests__/route.test.ts`
Expected: PASS (7건)

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/ratio-audit/ingest
git commit -m "feat(ratio-audit): 결과 인제스트 API + Teams 요약 발송"
```

---

### Task 6: 판정 순수 로직 (judge.py)

**Files:**
- Create: `scripts/moa-ratio/judge.py`
- Create: `scripts/moa-ratio/requirements.txt`
- Test: `scripts/moa-ratio/test_judge.py`

**Interfaces:**
- Consumes: 없음 (순수 파이썬)
- Produces:
  - `clean_text(raw: str) -> str` — HTML 이스케이프 해제 + `<br>`→개행 + 태그 제거
  - `filter_schedule_lines(lines: list[str]) -> list[str]` — `테스트용` 라인 제외 + 공백 정리
  - `schedule_years(lines: list[str]) -> set[str]` — 스케줄 라인들의 연도 집합
  - `build_prompt(services: list[dict]) -> str` — 배치 프롬프트
  - `parse_response(raw: str) -> dict[int, list[dict]]` — serviceId → items
  - `CLAUDE_BIN`, `run_claude(prompt: str) -> str`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/moa-ratio/test_judge.py`:

```python
#!/usr/bin/env python3
"""judge.py 순수 로직 단위 테스트 (브라우저·claude 불필요).

실행: cd scripts/moa-ratio && python3 test_judge.py
근거: docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md 부록 A
"""
import unittest

from judge import (
    build_prompt,
    clean_text,
    filter_schedule_lines,
    parse_response,
    schedule_years,
)

# 부록 A 정상 샘플 (성신여자대학교 1093020)
SAMPLE_SCHEDULE = [
    "2026-07-21 오전 11:00:00 ~ 2026-09-07 오후 6:03:00 : 10분 반복 (테스트용)",
    "2026-09-08 오전 11:00:00 : 한 번",
    "2026-09-09 오전 10:00:00 ~ 2026-09-11 오전 10:03:00 : 10시 반복",
]


class CleanTextTest(unittest.TestCase):
    def test_unescapes_and_strips_markup(self):
        raw = "&lt;font color=red&gt;※ 원서접수기간&lt;/font&gt;&lt;br&gt; ※ 지원현황"
        self.assertEqual(clean_text(raw), "※ 원서접수기간\n※ 지원현황")

    def test_empty_stays_empty(self):
        self.assertEqual(clean_text(""), "")


class ScheduleLineTest(unittest.TestCase):
    def test_excludes_test_lines(self):
        kept = filter_schedule_lines(SAMPLE_SCHEDULE)
        self.assertEqual(len(kept), 2)
        self.assertTrue(all("테스트용" not in line for line in kept))

    def test_trims_and_drops_blanks(self):
        self.assertEqual(filter_schedule_lines(["  a  ", "", "   "]), ["a"])

    def test_years_are_collected_from_all_dates(self):
        # 연말·연초에 걸치면 두 연도 모두 정상으로 봐야 한다
        lines = ["2026-12-30 오후 6:00:00 ~ 2027-01-02 오후 6:00:00 : 10시 반복"]
        self.assertEqual(schedule_years(lines), {"2026", "2027"})

    def test_years_ignore_test_lines(self):
        self.assertEqual(schedule_years(SAMPLE_SCHEDULE), {"2026"})


class PromptTest(unittest.TestCase):
    def _svc(self):
        return {
            "service_id": 1093020,
            "university_name": "성신여자대학교",
            "service_name": "수시",
            "schedule_lines": SAMPLE_SCHEDULE,
            "pre_open_text": "※ 원서접수기간: 2026.9.8.",
            "top_text": "※ 원서접수기간: 2026.9.8.",
        }

    def test_prompt_contains_service_and_schedule(self):
        p = build_prompt([self._svc()])
        self.assertIn("1093020", p)
        self.assertIn("성신여자대학교", p)
        self.assertIn("2026-09-08 오전 11:00:00 : 한 번", p)

    def test_prompt_excludes_test_schedule_lines(self):
        self.assertNotIn("테스트용", build_prompt([self._svc()]))

    def test_prompt_demands_json_only(self):
        p = build_prompt([self._svc()])
        self.assertIn("JSON", p)


class ParseTest(unittest.TestCase):
    def test_parses_plain_json(self):
        raw = '{"results":[{"serviceId":1,"items":[{"type":"year","field":"top",' \
              '"found":"2025학년도","expect":"2026","quote":"q"}]}]}'
        out = parse_response(raw)
        self.assertEqual(list(out.keys()), [1])
        self.assertEqual(out[1][0]["type"], "year")

    def test_parses_fenced_json(self):
        raw = '```json\n{"results":[{"serviceId":7,"items":[]}]}\n```'
        self.assertEqual(parse_response(raw), {7: []})

    def test_rejects_unknown_type(self):
        raw = '{"results":[{"serviceId":1,"items":[{"type":"typo","field":"top",' \
              '"found":"a","expect":"b","quote":""}]}]}'
        with self.assertRaises(ValueError):
            parse_response(raw)

    def test_rejects_non_json(self):
        with self.assertRaises(ValueError):
            parse_response("판정 결과를 알려드리겠습니다")


if __name__ == "__main__":
    unittest.main(verbosity=2)
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `cd scripts/moa-ratio && python3 test_judge.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'judge'`

- [ ] **Step 3: 최소 구현**

`scripts/moa-ratio/judge.py`:

```python
#!/usr/bin/env python3
"""경쟁률 안내문구 ↔ 스케줄 세팅 판정 — 순수 로직 + claude 호출.

브라우저·DB에 의존하지 않는다. audit.py 가 수집한 텍스트만 입력받아
프롬프트를 만들고 응답을 파싱한다.

판정 기준(스펙 §3): 문구의 날짜 연도가 '스케줄 라인들의 연도 집합'에 없으면 이상.
실행 시점 연도로 고정하지 않는다(달력연도와 학년도는 다른 축).
"""
import html as html_mod
import json
import os
import re
import subprocess
import sys
import tempfile

VALID_TYPES = {"year", "schedule"}
VALID_FIELDS = {"pre_open", "top"}

# Windows 는 확장자 없는 셸 스크립트를 spawn 하지 못한다(dev-control-analyze.mjs 선례).
CLAUDE_BIN = "claude.cmd" if sys.platform == "win32" else "claude"


def clean_text(raw: str) -> str:
    """textarea 값의 HTML 이스케이프 해제 → <br> 개행 → 나머지 태그 제거."""
    if not raw:
        return ""
    text = html_mod.unescape(raw)
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def filter_schedule_lines(lines: list[str]) -> list[str]:
    """'테스트용' 스케줄은 판정에서 제외 — 단기 반복이 정상 문구를 오판하게 만든다."""
    out = []
    for line in lines:
        text = re.sub(r"\s+", " ", (line or "")).strip()
        if not text or "테스트용" in text:
            continue
        out.append(text)
    return out


def schedule_years(lines: list[str]) -> set[str]:
    """스케줄 라인들에 등장하는 연도 집합. 연말·연초에 걸치면 두 연도 모두 정상."""
    years: set[str] = set()
    for line in filter_schedule_lines(lines):
        years.update(re.findall(r"(20\d{2})", line))
    return years


def build_prompt(services: list[dict]) -> str:
    """배치 프롬프트. 실행로그는 절대 넣지 않는다(수백 줄이라 프롬프트를 잠식)."""
    blocks = []
    for svc in services:
        lines = filter_schedule_lines(svc.get("schedule_lines") or [])
        years = ", ".join(sorted(schedule_years(svc.get("schedule_lines") or []))) or "없음"
        blocks.append(
            f"### serviceId: {svc['service_id']}\n"
            f"대학: {svc.get('university_name', '')} / 서비스: {svc.get('service_name', '')}\n"
            f"스케줄 연도 집합: {years}\n"
            f"스케줄 세팅:\n" + "\n".join(f"- {line}" for line in lines) + "\n"
            f"[오픈전 내용]\n{svc.get('pre_open_text', '')}\n"
            f"[상단 내용]\n{svc.get('top_text', '')}\n"
        )

    return (
        "너는 대학 원서접수 경쟁률 서비스의 설정을 점검한다.\n"
        "각 서비스마다 '스케줄 세팅'과 안내문구('오픈전 내용', '상단 내용')를 대조해 "
        "어긋난 부분만 찾아라.\n\n"
        "판정 규칙:\n"
        "1. type=year — 문구에 적힌 날짜의 연도가 '스케줄 연도 집합'에 없으면 이상이다. "
        "'2027학년도' 같은 학년도 표기는 달력연도와 다른 축이므로 이상이 아니다.\n"
        "2. type=schedule — 문구에 적힌 공개 날짜·시각이 스케줄 세팅과 다르면 이상이다. "
        "스케줄이 특정 날짜까지만 반복되어 마감일 문구에서 일부 시각이 빠진 것은 정상이다.\n"
        "3. 확신이 없으면 보고하지 마라. 추측 금지.\n\n"
        "출력은 JSON만. 설명·코드펜스 없이 아래 형태로만 답하라.\n"
        '{"results":[{"serviceId":123,"items":[{"type":"year|schedule",'
        '"field":"pre_open|top","found":"문구에서 발견한 값",'
        '"expect":"스케줄 기준 기대값","quote":"원문 발췌"}]}]}\n'
        "이상이 없는 서비스는 items 를 빈 배열로 둔다. "
        "입력에 있는 모든 serviceId 를 결과에 포함하라.\n\n"
        "=== 입력 ===\n" + "\n".join(blocks)
    )


def parse_response(raw: str) -> dict[int, list[dict]]:
    """claude 응답 → {serviceId: items}. 형식이 어긋나면 ValueError (추측 판정 금지)."""
    text = (raw or "").strip()
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError(f"JSON 없음: {text[:120]!r}")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 파싱 실패: {e}") from e

    results = data.get("results")
    if not isinstance(results, list):
        raise ValueError("results 배열 없음")

    out: dict[int, list[dict]] = {}
    for row in results:
        sid = row.get("serviceId")
        items = row.get("items", [])
        if not isinstance(sid, int) or not isinstance(items, list):
            raise ValueError(f"행 형식 오류: {row!r}")
        for item in items:
            if item.get("type") not in VALID_TYPES:
                raise ValueError(f"type 오류: {item!r}")
            if item.get("field") not in VALID_FIELDS:
                raise ValueError(f"field 오류: {item!r}")
            if not item.get("found") or not item.get("expect"):
                raise ValueError(f"found/expect 누락: {item!r}")
            item.setdefault("quote", "")
        out[sid] = items
    return out


def run_claude(prompt: str) -> str:
    """claude -p 호출 — 프롬프트는 stdin, 도구 차단, cwd 는 리포 밖.

    dev-control-analyze.mjs 와 동일한 안전장치: 이 호출은 텍스트 판정만 필요하므로
    도구 사용을 막고, 리포의 .claude 설정을 상속하지 않도록 cwd 를 옮긴다.
    """
    proc = subprocess.run(
        [CLAUDE_BIN, "-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=300,
        cwd=tempfile.gettempdir(),
        shell=(sys.platform == "win32"),
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude 실패({proc.returncode}): {proc.stderr[:300]}")
    return proc.stdout
```

`scripts/moa-ratio/requirements.txt`:

```
selenium>=4.20
requests>=2.31
python-dotenv>=1.0
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run: `cd scripts/moa-ratio && python3 test_judge.py`
Expected: PASS (13건, `OK`)

- [ ] **Step 5: 커밋**

```bash
git add scripts/moa-ratio/judge.py scripts/moa-ratio/test_judge.py scripts/moa-ratio/requirements.txt
git commit -m "feat(ratio-audit): 안내문구 판정 순수 로직 + claude 호출"
```

---

### Task 7: 오케스트레이션 (audit.py) + 라이브 DRY RUN

**Files:**
- Create: `scripts/moa-ratio/audit.py`

**Interfaces:**
- Consumes: Task 4 `GET /api/ratio-audit/targets`, Task 5 `POST /api/ratio-audit/ingest`, Task 6 `judge.py`
- Produces: 실행 스크립트. `RATIO_AUDIT_DRY_RUN=true`면 인제스트 대신 `OUT_JSON` 경로에 결과 저장

- [ ] **Step 1: 구현**

`scripts/moa-ratio/audit.py`:

```python
#!/usr/bin/env python3
"""경쟁률 세팅 오설정 점검 — Moa 순회 → claude 판정 → OPS-Console 인제스트.

설계: docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md

흐름:
  대상 로딩(GET /api/ratio-audit/targets) → Moa 로그인(scrape.py 재사용)
  → POST /Ratio/GetRatioList(TEST) 전체 목록 → 대상 교집합
  → GET /Ratio/RatioSetting/{id}?Seq&Server=TEST 순회로 스케줄·문구 추출
  → judge.py 배치 판정 → REAL 목록으로 html 링크 404 점검
  → POST /api/ratio-audit/ingest

읽기 전용. 저장·배포 버튼을 누르지 않는다.
RATIO_AUDIT_DRY_RUN=true 면 인제스트 대신 파일로만 저장한다.
"""
import json
import os
import re
import sys
import tempfile
import time

import requests
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_REPO, "scripts", "moa-closing"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import scrape  # noqa: E402  (로그인/드라이버 재사용 — 기존 검증된 구현)
from judge import build_prompt, clean_text, parse_response, run_claude  # noqa: E402

MOA_BASE = "https://moa.jinhakapply.com"
LIST_API = f"{MOA_BASE}/Ratio/GetRatioList"
DETAIL_URL = MOA_BASE + "/Ratio/RatioSetting/{sid}?Seq={seq}&Server={server}"
HTML_BASE = {
    "TEST": "https://vapplytest.jinhakapply.com/RatioV1/",
    "REAL": "https://addon.jinhakapply.com/RatioV1/",
}
BATCH_SIZE = 10


def fetch_targets(base_url: str, secret: str) -> dict[int, dict]:
    res = requests.get(
        f"{base_url}/api/ratio-audit/targets",
        headers={"Authorization": f"Bearer {secret}"},
        timeout=30,
    )
    res.raise_for_status()
    rows = res.json()["targets"]
    print(f"[OK] 점검 대상 {len(rows)}건")
    return {int(r["serviceId"]): r for r in rows}


def fetch_ratio_list(driver, server: str) -> list[dict]:
    """GetRatioList 를 페이지 컨텍스트에서 POST. 전체 목록이 한 번에 온다."""
    script = """
    const done = arguments[1];
    fetch(arguments[0], {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({MACHINE: arguments[2], ServiceName: '', Manager: '',
        Developer: '', CategoryTypeName: '', IsActive: '', strFlag: '', Search: ''}),
    }).then(r => r.json()).then(d => done(JSON.stringify(d))).catch(e => done('ERR:' + e));
    """
    driver.set_script_timeout(120)
    raw = driver.execute_async_script(script, LIST_API, None, server)
    if raw.startswith("ERR:"):
        raise RuntimeError(f"{server} 목록 조회 실패: {raw[:200]}")
    rows = json.loads(raw)
    print(f"[OK] {server} 목록 {len(rows)}건")
    return rows


def extract_detail(driver, wait, sid: int, seq, server: str) -> dict:
    """설정/배포 페이지에서 스케줄 라인 + 오픈전/상단 문구 추출."""
    driver.get(DETAIL_URL.format(sid=sid, seq=seq, server=server))
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "#txtTopText"))
    lines = [
        el.text for el in driver.find_elements(By.CSS_SELECTOR, "td.sc div.scroll_box ul li")
    ]
    return {
        "service_id": sid,
        "schedule_lines": lines,
        "pre_open_text": clean_text(
            driver.find_element(By.CSS_SELECTOR, "#txtOpenText").get_attribute("value") or ""
        ),
        "top_text": clean_text(
            driver.find_element(By.CSS_SELECTOR, "#txtTopText").get_attribute("value") or ""
        ),
    }


def check_link(url: str, attempts: int = 3) -> tuple[int, str]:
    """경쟁률 HTML 링크 상태. 일시 오류를 404로 오인하지 않도록 3회까지 재시도."""
    last = (0, "")
    for i in range(attempts):
        try:
            res = requests.get(url, timeout=15)
            if res.status_code == 200:
                return 200, ""
            last = (res.status_code, "")
        except requests.RequestException as e:
            last = (0, str(e)[:200])
        if i < attempts - 1:
            time.sleep(2)
    return last


def main() -> int:
    dry_run = os.getenv("RATIO_AUDIT_DRY_RUN", "").lower() == "true"
    base_url = os.getenv("OPS_CONSOLE_BASE_URL", "")
    secret = os.getenv("CRON_SECRET", "")
    if not secret or not base_url:
        print("[FAIL] OPS_CONSOLE_BASE_URL / CRON_SECRET 필요")
        return 1

    env = {
        "username": os.getenv("MOA_USERNAME", ""),
        "password": os.getenv("MOA_PASSWORD", ""),
        "sms_url": os.getenv("MAKE_SMS_CODE_URL", ""),
        "sms_timeout": int(os.getenv("MOA_SMS_POLL_TIMEOUT_SEC", "120")),
        "sms_interval": int(os.getenv("MOA_SMS_POLL_INTERVAL_SEC", "3")),
    }
    targets = fetch_targets(base_url, secret)

    driver = scrape.setup_driver(tempfile.mkdtemp(prefix="moa-ratio-"), True)
    wait = WebDriverWait(driver, 40)
    findings, link_errors, skipped, collected = [], [], [], []
    try:
        scrape.login_and_2fa(driver, wait, env)
        driver.get(f"{MOA_BASE}/Ratio/RatioSetting")

        test_rows = [r for r in fetch_ratio_list(driver, "TEST")
                     if int(r["UnivServiceID"]) in targets]
        print(f"[OK] 교집합 {len(test_rows)}건 순회 시작")

        for i, row in enumerate(test_rows, 1):
            sid = int(row["UnivServiceID"])
            try:
                detail = extract_detail(driver, wait, sid, row["Seq"], "TEST")
                detail["university_name"] = targets[sid]["universityName"]
                detail["service_name"] = targets[sid]["serviceName"]
                collected.append(detail)
            except Exception as e:  # noqa: BLE001 — 1건 실패로 전체를 죽이지 않는다
                skipped.append({"serviceId": sid, "reason": f"{type(e).__name__}: {e}"[:200]})
            if i % 20 == 0:
                print(f"[INFO] {i}/{len(test_rows)} 순회")

        for start in range(0, len(collected), BATCH_SIZE):
            batch = collected[start : start + BATCH_SIZE]
            try:
                verdict = parse_response(run_claude(build_prompt(batch)))
            except Exception as e:  # noqa: BLE001 — 1회 재시도 후 배치 skip
                print(f"[WARN] 배치 판정 실패, 재시도: {e}")
                try:
                    verdict = parse_response(run_claude(build_prompt(batch)))
                except Exception as e2:  # noqa: BLE001
                    for svc in batch:
                        skipped.append({"serviceId": svc["service_id"],
                                        "reason": f"판정 실패: {e2}"[:200]})
                    continue
            for svc in batch:
                items = verdict.get(svc["service_id"], [])
                if not items:
                    continue
                findings.append({
                    "serviceId": svc["service_id"],
                    "universityName": svc["university_name"],
                    "serviceName": svc["service_name"],
                    "operatorName": targets[svc["service_id"]]["operatorName"],
                    "items": items,
                })
            print(f"[INFO] 판정 {min(start + BATCH_SIZE, len(collected))}/{len(collected)}")

        for row in fetch_ratio_list(driver, "REAL"):
            sid = int(row["UnivServiceID"])
            if sid not in targets:
                continue
            url = f"{HTML_BASE['REAL']}RatioH/Ratio{sid}{row['Seq']}.html"
            status, reason = check_link(url)
            if status != 200:
                link_errors.append({"serviceId": sid, "url": url,
                                    "status": status, "reason": reason})
    finally:
        driver.quit()

    payload = {
        "scannedCount": len(collected),
        "findings": findings,
        "linkErrors": link_errors,
        "skipped": skipped,
    }
    print(f"[RESULT] 순회 {len(collected)} / 이상 {len(findings)} / "
          f"링크오류 {len(link_errors)} / 건너뜀 {len(skipped)}")

    if dry_run:
        out = os.getenv("OUT_JSON", os.path.join(tempfile.gettempdir(), "ratio-audit.json"))
        with open(out, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
        print(f"[DRY RUN] 인제스트 생략 — {out}")
        return 0

    res = requests.post(
        f"{base_url}/api/ratio-audit/ingest",
        headers={"Authorization": f"Bearer {secret}"},
        json=payload,
        timeout=60,
    )
    print(f"[OK] 인제스트 {res.status_code} {res.text[:200]}")
    return 0 if res.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: 문법·import 검증 (로그인 없이)**

Run: `cd scripts/moa-ratio && python3 -c "import ast,sys; ast.parse(open('audit.py').read()); print('syntax OK')"`
Expected: `syntax OK`

- [ ] **Step 3: 판정 로직 회귀 확인**

Run: `cd scripts/moa-ratio && python3 test_judge.py`
Expected: PASS (13건) — Task 6 대비 회귀 없음

- [ ] **Step 4: 라이브 DRY RUN**

`OPS_CONSOLE_BASE_URL`이 `.env.local`에 비어 있다. DRY RUN은 대상 목록만 서버에서 받으므로 **로컬 개발 서버로 충분하다** — 별도 터미널에서 `npm run dev`(3000)를 띄우고 `http://localhost:3000`을 쓴다.

Make 웹훅이 `Queue is full.` 상태면 `scrape.login_and_2fa`의 SMS 폴링이 타임아웃한다. 복구 전이라면 사용자에게 인증번호를 받아 진행해야 하므로, 디스커버리 때 쓴 수동 코드 주입(코드 파일 폴링)을 `audit.py`에도 임시로 넣어 실행한다.

```bash
cd /Users/yss/개발/build/OPS-Console
RATIO_AUDIT_DRY_RUN=true \
OPS_CONSOLE_BASE_URL=http://localhost:3000 \
OUT_JSON=/tmp/ratio-audit-dry.json \
python3 scripts/moa-ratio/audit.py 2>&1 | tail -40
```

Expected: `[RESULT] 순회 N / 이상 M / 링크오류 K / 건너뜀 S` 출력 후 `[DRY RUN] 인제스트 생략`

- [ ] **Step 5: 결과 표본 검토**

```bash
python3 -c "
import json; d=json.load(open('/tmp/ratio-audit-dry.json'))
print('scanned', d['scannedCount'], 'findings', len(d['findings']))
for f in d['findings'][:5]:
    print(f['universityName'], f['serviceName'], [ (i['type'], i['found'], i['expect']) for i in f['items'] ])
print('skipped', d['skipped'][:3])
"
```

이상 건이 실제로 오설정인지 Moa 화면에서 2~3건 눈으로 확인한다. 오탐이 많으면 `judge.py`의 프롬프트 규칙을 고치고 Task 6 테스트를 먼저 갱신한다(RED → GREEN).

- [ ] **Step 6: 커밋**

```bash
git add scripts/moa-ratio/audit.py
git commit -m "feat(ratio-audit): Moa 순회 오케스트레이션 스크립트"
```

- [ ] **Step 7: 전체 검증**

```bash
npm run lint && npm run typecheck && npm test
```

Expected: lint 0 error / typecheck 통과 / 전체 유닛 통과

- [ ] **Step 8: 환경변수 문서화 + 커밋**

`CLAUDE.md`의 자동화 잡 표 아래에 한 줄 추가:

```markdown
경쟁률 세팅 점검은 자동화 registry가 아니라 로컬 수동 실행이다 — `RATIO_AUDIT_DRY_RUN`/`TEAMS_RATIO_AUDIT_CHAT_ID` 필요. 상세: `docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md`
```

```bash
git add CLAUDE.md
git commit -m "docs: 경쟁률 세팅 점검 실행 방법 명시"
```

---

## 남은 운영 작업 (구현 범위 밖)

- `TEAMS_RATIO_AUDIT_CHAT_ID` 값 확보 — `listMyChats()`로 본인 채팅 ID를 조회해 Vercel 환경변수에 등록. 미설정이면 적재만 되고 발송은 생략된다(Task 5 테스트로 보장).
- Make 웹훅 `Queue is full.` 복구 — 복구 전에는 2FA 자동화가 불가하며, **마감 스크래퍼·원서제어 폴러의 자동 로그인도 동일하게 실패한다**.
- 회사 윈도우 PC 전환 — `closing_scrape_requests` 큐 + `poll-local.ps1` 패턴 복제. 이번 범위 아님.
