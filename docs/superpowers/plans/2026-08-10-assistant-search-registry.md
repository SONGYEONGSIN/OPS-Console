# 어시스턴트 검색 레지스트리 전환 (0단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어시스턴트 검색의 6개 도메인 전용 함수를 공통 러너 + 선언형 레지스트리로 옮긴다. **사용자에게 보이는 동작 변화는 0이어야 한다.**

**Architecture:** 6개 함수(`searchIncidents` 등)는 모두 같은 6단계를 돌고 데이터만 다르다. 3~4단계(점수·필터·정렬·top-3)를 공통 러너로 빼고, 1·2·5·6단계(테이블·컬럼·검색필드·제목·snippet·링크)만 `DomainEntry`로 남긴다. `searchAllDomains`는 레지스트리를 순회하는 얇은 함수가 된다. **RLS 경계 유지를 위해 러너는 현재와 동일하게 cookies 기반 supabase client를 쓴다.**

**Tech Stack:** TypeScript / Vitest / Supabase(`@/lib/supabase/server`의 `createClient`)

## Global Constraints

- **동작 변화 0.** 같은 질문에 전환 전과 동일한 `Source[]`가 나와야 한다. 이 단계에서 **새 도메인을 추가하지 않고, 검색 알고리즘(`tokenize`/`scoreText`/상수)을 바꾸지 않는다.** 리팩터링과 기능 추가를 섞으면 결과가 달라졌을 때 원인을 가릴 수 없다.
- `any` 금지. `@ts-ignore`/`@ts-expect-error` 금지. `console.log` 잔류 금지.
- 주석·문구는 한국어. 커밋 접두사만 영어.
- 기존 상수를 그대로 쓴다: `TOP_PER_DOMAIN = 3`, `FETCH_LIMIT_PER_DOMAIN = 200`, `SNIPPET_MAX_LEN = 200`.
- `searchAllDomains`의 **공개 시그니처를 바꾸지 않는다** — `(input: { question: string }) => Promise<Source[]>`. 호출부(`api/assistant/ask/route.ts`)를 손대지 않기 위해서다.
- `Source` 타입과 `SourceDomain` union의 6개 값을 그대로 유지한다.
- RLS 경계 유지: 러너는 `@/lib/supabase/server`의 `createClient()`(cookies 기반)만 쓴다. **admin client 금지.**
- 이번 단계는 `kind: "table"`만 구현한다. `kind: "custom"`(SharePoint)은 1.5단계 — 타입에는 자리를 만들되 러너 분기는 넣지 않는다.
- **미래를 위한 자리 2개를 만들되, 이번 단계에서는 무동작이어야 한다.** 둘 다 1단계에서 처음 실제로 쓰인다:
  - `derivedSearchText`(옵셔널 필드) — 기존 6도메인은 쓰지 않으므로 haystack이 동일하다.
  - 전역 top-K — `K = DOMAIN_REGISTRY.length * TOP_PER_DOMAIN`으로 두면 아무것도 안 잘린다.
  - **둘 중 하나라도 특성화 테스트 결과를 바꾸면 구현이 틀린 것이다.**

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/features/assistant/__tests__/search.characterization.test.ts` | **현재 동작을 고정하는 그물.** 6도메인 각각의 select 컬럼·제목 포맷·snippet 우선순위·deepLink·top-3·score>0 필터를 단언 | 신설 |
| `src/features/assistant/domains/types.ts` | `DomainEntry` 타입 | 신설 |
| `src/features/assistant/domains/runner.ts` | 공통 러너 — 한 항목을 받아 `Source[]` 반환 | 신설 |
| `src/features/assistant/domains/registry.ts` | 6개 항목 등록부 | 신설 |
| `src/features/assistant/domains/__tests__/runner.test.ts` | 러너 단위 테스트 | 신설 |
| `src/features/assistant/domains/__tests__/registry.test.ts` | 구조 불변식 검사 | 신설 |
| `scripts/check-assistant-rls.mjs` | RLS 정책 존재 확인 (수동, `DATABASE_URL` 필요) | 신설 |
| `src/features/assistant/search.ts` | 6개 도메인 함수 제거, `searchAllDomains`를 레지스트리 순회로 교체. `tokenize`/`scoreText`는 그대로 export 유지 | 수정 |

**작업 순서 근거:** Task 1이 그물이다. **지금 6개 도메인 함수에는 행동 테스트가 하나도 없다** — `search.test.ts`는 `tokenize`/`scoreText`/타입만 보고, `route.test.ts`는 `searchAllDomains`를 목킹한다. 그물 없이 Task 2~3을 하면 컬럼 오타·제목 포맷 변화·snippet 우선순위 뒤바뀜을 아무도 못 잡는다.

---

### Task 1: 특성화 테스트 — 현재 동작을 고정한다

**Files:**
- Create: `src/features/assistant/__tests__/search.characterization.test.ts`

**Interfaces:**
- Consumes: 현재의 `searchAllDomains` (수정 전 원본)
- Produces: 없음 (그물이므로 이후 태스크가 이 파일을 **무수정으로** 통과해야 한다)

> ⚠️ **이 태스크는 RED-GREEN이 아니다.** 특성화 테스트는 *현재 코드에 대해 처음부터 GREEN*이어야 한다. 실패한다면 내가 현재 동작을 잘못 읽은 것이므로, 테스트가 아니라 **읽기를 고친다.**

- [ ] **Step 1: 테스트 작성**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// 도메인마다 다른 row를 돌려주기 위해 table 이름으로 분기하는 목
const { mockCreateClient, tableData } = vi.hoisted(() => {
  const tableData = new Map<string, unknown[]>();
  const mockCreateClient = vi.fn(async () => ({
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.then = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve({ data: tableData.get(table) ?? [], error: null }).then(
          onFulfilled,
        );
      return builder;
    },
  }));
  return { mockCreateClient, tableData };
});

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { searchAllDomains } from "../search";

beforeEach(() => tableData.clear());

describe("특성화 — 전환 전후 동일해야 하는 현재 동작", () => {
  it("incident: 제목은 '대학명 — 제목', snippet은 cause_summary 우선, deepLink 고정", async () => {
    tableData.set("incidents", [
      {
        id: "i1",
        title: "결제 오류",
        university_name: "건국대",
        category: "결제",
        cause_summary: "PG 응답 지연",
        root_cause: null,
        resolution: "재시도",
        prevention: null,
      },
    ]);
    const out = await searchAllDomains({ question: "결제 오류" });
    expect(out).toEqual([
      {
        domain: "incident",
        id: "i1",
        title: "건국대 — 결제 오류",
        snippet: "PG 응답 지연",
        deepLink: "/dashboard/incidents",
      },
    ]);
  });

  it("incident: 대학명·제목이 없으면 '— — (제목 없음)'", async () => {
    tableData.set("incidents", [
      {
        id: "i2",
        title: null,
        university_name: null,
        category: "결제",
        cause_summary: "원인",
        root_cause: null,
        resolution: null,
        prevention: null,
      },
    ]);
    const out = await searchAllDomains({ question: "결제" });
    expect(out[0].title).toBe("— — (제목 없음)");
  });

  it("incident: snippet은 cause_summary → resolution → root_cause 순서", async () => {
    tableData.set("incidents", [
      {
        id: "i3",
        title: "t",
        university_name: "u",
        category: "결제",
        cause_summary: null,
        root_cause: "근본원인",
        resolution: "해결책",
        prevention: null,
      },
    ]);
    const out = await searchAllDomains({ question: "결제" });
    expect(out[0].snippet).toBe("해결책"); // resolution이 root_cause보다 우선
  });

  it("토큰이 하나도 안 걸리면 그 row는 제외 (score>0 필터)", async () => {
    tableData.set("incidents", [
      {
        id: "i4",
        title: "무관",
        university_name: "무관대",
        category: "기타",
        cause_summary: "무관",
        root_cause: null,
        resolution: null,
        prevention: null,
      },
    ]);
    const out = await searchAllDomains({ question: "전혀다른질문" });
    expect(out).toEqual([]);
  });

  it("도메인당 최대 3건 (TOP_PER_DOMAIN)", async () => {
    tableData.set(
      "incidents",
      Array.from({ length: 5 }, (_, i) => ({
        id: `i${i}`,
        title: `결제 오류 ${i}`,
        university_name: "건국대",
        category: "결제",
        cause_summary: "결제",
        root_cause: null,
        resolution: null,
        prevention: null,
      })),
    );
    const out = await searchAllDomains({ question: "결제 오류" });
    expect(out).toHaveLength(3);
  });

  it("질문 토큰이 0개면(모두 1글자) 빈 배열 — 조회 자체를 안 한다", async () => {
    tableData.set("incidents", [{ id: "x" }]);
    expect(await searchAllDomains({ question: "가 나" })).toEqual([]);
  });

  it("도메인 순서는 incident → handover → ai-tip → backup → contact → service", async () => {
    tableData.set("incidents", [
      {
        id: "i",
        title: "공통어",
        university_name: "u",
        category: null,
        cause_summary: null,
        root_cause: null,
        resolution: null,
        prevention: null,
      },
    ]);
    tableData.set("services", [{ id: "s", name: "공통어" }]);
    const out = await searchAllDomains({ question: "공통어" });
    expect(out.map((s) => s.domain)).toEqual(["incident", "service"]);
  });
});
```

> **주의:** `services`·`handover_records`·`ai_tips`·`backup_requests`·`contacts` row의 정확한 컬럼 구성은 `search.ts`의 각 함수를 **직접 읽어 그대로** 채운다. 위 마지막 테스트의 `{ id: "s", name: "공통어" }`는 자리표시이며, 실제 `searchServices`가 읽는 컬럼·제목 포맷으로 교체해야 한다. **추측하지 말고 코드를 읽어라.** 6도메인 각각에 최소 1건씩(제목 포맷 + snippet + deepLink) 단언을 둔다.

- [ ] **Step 2: 현재 코드에서 GREEN을 확인한다**

Run: `npx vitest run src/features/assistant/__tests__/search.characterization.test.ts`
Expected: **PASS (전부)**. 하나라도 실패하면 현재 동작을 잘못 읽은 것이니 테스트를 코드에 맞춘다 — 이 단계에서 `search.ts`를 고치지 않는다.

- [ ] **Step 3: 커밋**

```bash
git add src/features/assistant/__tests__/search.characterization.test.ts
git commit -m "test(assistant): 검색 6도메인 현재 동작 특성화 테스트"
```

---

### Task 2: `DomainEntry` 타입 + 공통 러너

**Files:**
- Create: `src/features/assistant/domains/types.ts`
- Create: `src/features/assistant/domains/runner.ts`
- Test: `src/features/assistant/domains/__tests__/runner.test.ts`

**Interfaces:**
- Consumes: `Source`·`SourceDomain` (`../search`에서 import), `scoreText`·`tokenize` (`../search`)
- Produces:
  - `export type DomainEntry` (아래 정의)
  - `export async function runDomainSearch(supabase: SB, entry: DomainEntry, tokens: string[]): Promise<Source[]>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`runner.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { runDomainSearch } from "../runner";
import type { DomainEntry } from "../types";

const entry: DomainEntry = {
  kind: "table",
  domain: "incident",
  label: "사고 이력",
  table: "incidents",
  columns: ["id", "title", "university_name", "cause_summary", "resolution"],
  orderBy: { column: "created_at", ascending: false },
  searchFields: ["title", "university_name", "cause_summary"],
  snippetFields: ["cause_summary", "resolution"],
  deepLink: "/dashboard/incidents",
  title: (r) => `${r.university_name ?? "—"} — ${r.title ?? "(제목 없음)"}`,
};

function client(rows: unknown[]) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.then = (f: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(f);
  return { from: () => builder } as never;
}

describe("runDomainSearch", () => {
  it("searchFields만으로 점수를 매기고 Source로 변환한다", async () => {
    const out = await runDomainSearch(
      client([
        {
          id: "1",
          title: "결제 오류",
          university_name: "건국대",
          cause_summary: "PG 지연",
          resolution: "재시도",
        },
      ]),
      entry,
      ["결제"],
    );
    expect(out).toEqual([
      {
        domain: "incident",
        id: "1",
        title: "건국대 — 결제 오류",
        snippet: "PG 지연",
        deepLink: "/dashboard/incidents",
      },
    ]);
  });

  it("snippetFields는 앞에서부터 첫 non-null을 쓴다", async () => {
    const out = await runDomainSearch(
      client([
        {
          id: "1",
          title: "결제",
          university_name: "u",
          cause_summary: null,
          resolution: "해결",
        },
      ]),
      entry,
      ["결제"],
    );
    expect(out[0].snippet).toBe("해결");
  });

  it("점수 0인 row는 제외한다", async () => {
    const out = await runDomainSearch(
      client([{ id: "1", title: "무관", university_name: "x", cause_summary: null, resolution: null }]),
      entry,
      ["결제"],
    );
    expect(out).toEqual([]);
  });

  it("점수 높은 순으로 정렬하고 3건까지만", async () => {
    const rows = [
      { id: "a", title: "결제", university_name: "x", cause_summary: null, resolution: null },
      { id: "b", title: "결제 오류", university_name: "x", cause_summary: "결제", resolution: null },
      { id: "c", title: "결제", university_name: "x", cause_summary: "결제", resolution: null },
      { id: "d", title: "결제", university_name: "x", cause_summary: null, resolution: null },
    ];
    const out = await runDomainSearch(client(rows), entry, ["결제", "오류"]);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe("b"); // 결제+오류 둘 다 매칭
  });

  it("data가 null이면 빈 배열", async () => {
    const out = await runDomainSearch(client(null as never), entry, ["결제"]);
    expect(out).toEqual([]);
  });

  it("derivedSearchText가 있으면 haystack에 이어 붙는다", async () => {
    // 코드값(job_id "ratio-audit")이 한국어 질문("경쟁률")에 안 걸리는 문제 대응.
    // 이 필드가 없으면 검색이 에러 없이 0건이 된다 — 가장 나쁜 실패 형태다.
    const withDerived: DomainEntry = {
      ...entry,
      derivedSearchText: (r) => (r.title === "ratio-audit" ? "경쟁률 점검" : ""),
    };
    const rows = [
      { id: "1", title: "ratio-audit", university_name: "x", cause_summary: null, resolution: null },
    ];
    expect(await runDomainSearch(client(rows), entry, ["경쟁률"])).toEqual([]);
    expect(await runDomainSearch(client(rows), withDerived, ["경쟁률"])).toHaveLength(1);
  });

  it("derivedSearchText가 없으면 haystack은 searchFields만으로 만들어진다", async () => {
    // 기존 6도메인은 이 필드를 안 쓴다 — 동작 변화 0의 근거
    const out = await runDomainSearch(
      client([{ id: "1", title: "결제", university_name: "u", cause_summary: null, resolution: null }]),
      entry,
      ["결제"],
    );
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/assistant/domains/__tests__/runner.test.ts`
Expected: FAIL — `Cannot find module '../runner'`

- [ ] **Step 3: 타입 구현**

`types.ts`:

```ts
import type { Source, SourceDomain } from "../search";

type DomainBase = {
  domain: SourceDomain;
  /** LLM 컨텍스트·출처 표기에 쓰는 한국어 이름 */
  label: string;
  deepLink: string;
};

/**
 * 검색 도메인 등록 단위.
 *
 * `kind: "table"`은 Supabase 테이블 — RLS가 권한을 걸어주므로 선언만으로 안전하다.
 * `kind: "custom"`은 SharePoint 시트처럼 RLS 밖의 소스 — 1.5단계에서 러너 분기를
 * 붙인다. 지금은 타입 자리만 만들어 두고 registry에 등록하지 않는다.
 */
export type DomainEntry =
  | (DomainBase & {
      kind: "table";
      table: string;
      columns: string[];
      orderBy: { column: string; ascending: boolean };
      /** haystack 구성 — columns의 부분집합이어야 한다 */
      searchFields: string[];
      /** 앞에서부터 첫 non-null을 snippet으로 쓴다 */
      snippetFields: string[];
      /**
       * 컬럼값이 코드라 한국어 질문에 안 걸릴 때 haystack에 더할 텍스트.
       * 예: automation_runs.job_id는 "ratio-audit"인데 사용자는 "경쟁률"이라 묻는다 —
       * 이 필드가 없으면 에러 없이 검색이 0건이 된다.
       * 기존 6도메인은 전부 한국어 텍스트 컬럼이라 쓰지 않는다.
       */
      derivedSearchText?: (row: Record<string, unknown>) => string;
      title: (row: Record<string, unknown>) => string;
    })
  | (DomainBase & {
      kind: "custom";
      fetch: (tokens: string[]) => Promise<Source[]>;
      /** RLS가 없으므로 권한을 어떻게 거는지 등록자가 적는다 */
      accessNote: string;
      /** 외부 호출이라 개별 상한을 둔다 */
      timeoutMs: number;
    });
```

`runner.ts`:

```ts
import type { Source } from "../search";
import { scoreText } from "../search";
import type { DomainEntry } from "./types";

/** search.ts가 전역 상한(TOTAL_SOURCE_LIMIT) 계산에 쓰므로 export 한다 */
export const TOP_PER_DOMAIN = 3;
const FETCH_LIMIT_PER_DOMAIN = 200;
const SNIPPET_MAX_LEN = 200;

type SB = { from: (table: string) => never };

function snippet(text: unknown): string {
  if (typeof text !== "string" || !text) return "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  return trimmed.length > SNIPPET_MAX_LEN
    ? trimmed.slice(0, SNIPPET_MAX_LEN) + "…"
    : trimmed;
}

/** 도메인 1개를 검색해 상위 N건을 Source로 변환. table 종류만 지원(custom은 1.5단계). */
export async function runDomainSearch(
  supabase: SB,
  entry: DomainEntry,
  tokens: string[],
): Promise<Source[]> {
  if (entry.kind !== "table") return [];

  const { data } = await (supabase.from(entry.table) as never)
    .select(entry.columns.join(", "))
    .order(entry.orderBy.column, { ascending: entry.orderBy.ascending })
    .limit(FETCH_LIMIT_PER_DOMAIN);
  if (!data) return [];

  const rows = data as Record<string, unknown>[];
  return rows
    .map((row) => ({
      row,
      score: scoreText(
        [
          ...entry.searchFields
            .map((f) => row[f])
            .filter((v): v is string => typeof v === "string" && v.length > 0),
          // 코드값 도메인용 파생 텍스트 — 미지정이면 빈 문자열이라 haystack이 그대로다
          entry.derivedSearchText?.(row) ?? "",
        ]
          .filter((v) => v.length > 0)
          .join(" "),
        tokens,
      ),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_PER_DOMAIN)
    .map((x) => ({
      domain: entry.domain,
      id: String(x.row.id),
      title: entry.title(x.row),
      snippet: snippet(entry.snippetFields.map((f) => x.row[f]).find(Boolean)),
      deepLink: entry.deepLink,
    }));
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/assistant/domains/__tests__/runner.test.ts`
Expected: PASS 5건

- [ ] **Step 5: 커밋**

```bash
git add src/features/assistant/domains
git commit -m "feat(assistant): 검색 도메인 공통 러너 + DomainEntry 타입"
```

---

### Task 3: 6도메인 이식 + `searchAllDomains` 교체

**Files:**
- Create: `src/features/assistant/domains/registry.ts`
- Modify: `src/features/assistant/search.ts`

**Interfaces:**
- Consumes: Task 2의 `DomainEntry`·`runDomainSearch`
- Produces: `export const DOMAIN_REGISTRY: DomainEntry[]` (6개), 시그니처 불변인 `searchAllDomains`

- [ ] **Step 1: 레지스트리 작성**

`registry.ts`에 6개 항목을 만든다. **각 항목의 `table`/`columns`/`orderBy`/`searchFields`/`snippetFields`/`deepLink`/`title`은 `search.ts`의 해당 함수를 읽어 1:1로 옮긴다. 추측 금지.**

`incident`는 아래와 같다(나머지 5개도 같은 방식으로):

```ts
import type { DomainEntry } from "./types";

/**
 * 검색 도메인 등록부 — 신규 도메인은 여기 1블록 추가로 끝난다.
 * columns에 없는 이름을 searchFields/snippetFields에 쓰면 haystack이 조용히 비어
 * 검색이 안 걸린다. registry.test.ts가 이를 막는다.
 */
export const DOMAIN_REGISTRY: DomainEntry[] = [
  {
    kind: "table",
    domain: "incident",
    label: "사고 이력",
    table: "incidents",
    columns: [
      "id", "title", "university_name", "category",
      "cause_summary", "root_cause", "resolution", "prevention",
    ],
    orderBy: { column: "created_at", ascending: false },
    searchFields: [
      "title", "university_name", "category",
      "cause_summary", "root_cause", "resolution", "prevention",
    ],
    snippetFields: ["cause_summary", "resolution", "root_cause"],
    deepLink: "/dashboard/incidents",
    title: (r) => `${r.university_name ?? "—"} — ${r.title ?? "(제목 없음)"}`,
  },
  // handover / ai-tip / backup / contact / service — search.ts에서 그대로 옮긴다
];
```

- [ ] **Step 2: `searchAllDomains` 교체**

`search.ts`에서 6개 도메인 함수(`searchIncidents`~`searchServices`)와 지역 `snippet` 헬퍼를 제거하고, `searchAllDomains`를 아래로 바꾼다. **`tokenize`·`scoreText`·`Source`·`SourceDomain` export는 그대로 둔다** — 러너와 테스트가 쓴다.

```ts
/**
 * 전체 결과 상한. 도메인당 상한(TOP_PER_DOMAIN)만 있으면 도메인이 늘수록
 * LLM 컨텍스트가 비례해 늘어난다 — 레지스트리가 등록을 싸게 만들었기 때문에
 * 그 증가가 조용히 일어난다. 0단계는 아무것도 자르지 않는 값으로 시작하고,
 * 도메인이 늘어나는 1단계에서 실제 값으로 조인다.
 */
const TOTAL_SOURCE_LIMIT = DOMAIN_REGISTRY.length * TOP_PER_DOMAIN;

export async function searchAllDomains(
  input: SearchInput,
): Promise<Source[]> {
  const tokens = tokenize(input.question);
  if (tokens.length === 0) return [];

  const supabase = await createClient();
  // 레지스트리 순서가 곧 결과 순서 — 전환 전 Promise.all 배열 순서와 같게 유지한다.
  const perDomain = await Promise.all(
    DOMAIN_REGISTRY.map((entry) => runDomainSearch(supabase, entry, tokens)),
  );
  return perDomain.flat().slice(0, TOTAL_SOURCE_LIMIT);
}
```

> **`slice`이지 재정렬이 아니다.** 여기서 점수로 다시 정렬하면 **도메인 순서가 바뀌어 특성화 테스트가 깨진다**(전환 전 결과는 도메인 순서를 따른다). 0단계에서는 상한 자리만 만들고, 도메인 간 재정렬은 1단계에서 러너가 점수를 함께 반환하도록 바꾼 뒤에 한다.

> **순환 import 주의**: `runner.ts`가 `../search`에서 `scoreText`를, `search.ts`가 `./domains/runner`를 import한다. 순환이 문제되면 `scoreText`·`tokenize`를 `domains/text.ts`로 옮기고 `search.ts`가 재-export한다(공개 API 유지).

- [ ] **Step 3: 특성화 테스트로 검증한다 — 이 태스크의 관문**

Run: `npx vitest run src/features/assistant`
Expected: **Task 1의 특성화 테스트가 무수정으로 전부 PASS.** 하나라도 실패하면 이식이 틀린 것이다 — **테스트를 고치지 말고 레지스트리를 고친다.**

- [ ] **Step 4: 호출부 무변경 확인**

Run: `npx vitest run src/app/api/assistant`
Expected: PASS (라우트 테스트는 `searchAllDomains`를 목킹하므로 시그니처가 유지되면 그대로 통과)

- [ ] **Step 5: 커밋**

```bash
git add src/features/assistant
git commit -m "refactor(assistant): 6도메인 검색을 레지스트리 순회로 전환"
```

---

### Task 4: 구조 불변식 테스트 + RLS 확인 스크립트

**Files:**
- Create: `src/features/assistant/domains/__tests__/registry.test.ts`
- Create: `scripts/check-assistant-rls.mjs`

**Interfaces:**
- Consumes: `DOMAIN_REGISTRY`

> **왜 둘로 나누나:** CI(`build-check.yml`)에 Supabase·`DATABASE_URL` 시크릿이 없다(확인함). RLS를 vitest로 검사하면 CI에서 못 돈다. **CI가 막아준다고 쓰면 거짓 안심이 된다.** DB 없이 가능한 검사만 테스트로, DB가 필요한 검사는 수동 스크립트로 가른다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import { describe, it, expect } from "vitest";
import { DOMAIN_REGISTRY } from "../registry";

describe("DOMAIN_REGISTRY 구조 불변식", () => {
  it("domain이 중복되지 않는다", () => {
    const ds = DOMAIN_REGISTRY.map((e) => e.domain);
    expect(new Set(ds).size).toBe(ds.length);
  });

  it("table 항목의 searchFields·snippetFields는 columns의 부분집합", () => {
    // 오타가 나면 haystack이 조용히 비어 검색이 안 걸린다 — 런타임에 에러도 안 난다
    for (const e of DOMAIN_REGISTRY) {
      if (e.kind !== "table") continue;
      const cols = new Set(e.columns);
      for (const f of [...e.searchFields, ...e.snippetFields]) {
        expect(cols.has(f), `${e.domain}: ${f}가 columns에 없다`).toBe(true);
      }
    }
  });

  it("table 항목은 columns에 id를 포함한다", () => {
    for (const e of DOMAIN_REGISTRY) {
      if (e.kind !== "table") continue;
      expect(e.columns, `${e.domain}`).toContain("id");
    }
  });

  it("custom 항목은 accessNote와 timeoutMs를 갖는다", () => {
    // RLS가 없으므로 권한을 어떻게 거는지 등록자가 적게 강제한다
    for (const e of DOMAIN_REGISTRY) {
      if (e.kind !== "custom") continue;
      expect(e.accessNote.trim().length).toBeGreaterThan(0);
      expect(e.timeoutMs).toBeGreaterThan(0);
    }
  });

  it("deepLink는 /dashboard로 시작한다", () => {
    for (const e of DOMAIN_REGISTRY) {
      expect(e.deepLink.startsWith("/dashboard")).toBe(true);
    }
  });

  it("0단계 시점에는 derivedSearchText를 쓰는 도메인이 없다", () => {
    // 기존 6도메인은 전부 한국어 텍스트 컬럼이라 파생 텍스트가 필요 없다.
    // 이 단언이 깨지면 '동작 변화 0' 약속이 깨진 것이다.
    // 1단계에서 코드값 도메인(automation_runs 등)을 등록할 때 이 테스트를 지운다.
    for (const e of DOMAIN_REGISTRY) {
      if (e.kind !== "table") continue;
      expect(e.derivedSearchText, `${e.domain}`).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/assistant/domains/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '../registry'`가 아니라면(Task 3에서 이미 만들었으므로) **전부 PASS일 수 있다.** 그 경우 일부러 `searchFields`에 오타를 넣어 2번 테스트가 실패하는지 확인하고 되돌린다 — 항상 통과하는 테스트가 아님을 증명한다.

- [ ] **Step 3: RLS 확인 스크립트**

`scripts/check-assistant-rls.mjs`:

```js
// 어시스턴트 검색 레지스트리에 등록된 테이블에 SELECT용 RLS 정책이 있는지 확인.
// CI에는 DB 자격이 없어 vitest로 돌리지 않는다 — 도메인을 등록하는 PR에서 수동 실행하고
// 결과를 PR 본문에 붙인다.
// 실행: DATABASE_URL=... node scripts/check-assistant-rls.mjs
import { Client } from "pg";
import { DOMAIN_REGISTRY } from "../src/features/assistant/domains/registry.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL 미설정 — 종료");
  process.exit(1);
}
const tables = DOMAIN_REGISTRY.filter((e) => e.kind === "table").map((e) => e.table);
const c = new Client({ connectionString: url });
await c.connect();
const { rows } = await c.query(
  "select tablename, cmd from pg_policies where schemaname='public' and tablename = any($1)",
  [tables],
);
await c.end();

let bad = 0;
for (const t of tables) {
  const ok = rows.some((r) => r.tablename === t && (r.cmd === "SELECT" || r.cmd === "ALL"));
  console.log(`${ok ? "OK  " : "MISS"} ${t}`);
  if (!ok) bad++;
}
process.exit(bad === 0 ? 0 : 1);
```

> **주의**: `.ts` 파일을 `.mjs`에서 직접 import할 수 없다. `tsx`로 실행하거나(`npx tsx scripts/check-assistant-rls.mjs`), 테이블 목록을 스크립트에 문자열 배열로 두고 `registry.test.ts`가 "스크립트 목록 == 레지스트리 목록"을 검사하게 한다. **구현자가 둘 중 하나를 고르고 리포트에 이유를 적는다.**

- [ ] **Step 4: 통과 확인**

```bash
npx vitest run src/features/assistant
DATABASE_URL=... node scripts/check-assistant-rls.mjs   # 또는 npx tsx
```
Expected: vitest 전부 PASS. 스크립트는 6테이블 모두 `OK`.

- [ ] **Step 5: 전체 검증 후 커밋**

```bash
npm test
npm run typecheck
npx eslint src/features/assistant scripts
git add src/features/assistant/domains/__tests__/registry.test.ts scripts/check-assistant-rls.mjs
git commit -m "test(assistant): 레지스트리 구조 불변식 + RLS 확인 스크립트"
```

---

## 완료 후

**이 계획의 성공 기준**: 어시스턴트에 같은 질문을 했을 때 전환 전과 **같은 답**이 나오고, 새 도메인 추가가 `registry.ts` 1블록으로 끝난다.

**다음 단계는 별도 계획**:
- 1단계 — 도메인 확장(`automation_runs`·`schedule_events`·`news` 등) + **기능 카탈로그**(`system-map.ts`가 `registry.ts`·사이드바·액션 열거형에서 자동 도출) + 응답 계약(JSON)
  - 카탈로그가 "미수 얼마 남았어?"에 금액만 답하지 않고 "학교담당자 독려 메일 기능이 있습니다"까지 말하게 하는 재료다. **도메인마다 손으로 등록하지 않는다** — 잡의 `description`이 이미 "언제 쓰는 기능인지"를 담고 있고, 신규 잡을 등록하면 어시스턴트는 한 줄도 안 고쳐도 안다.
  - **0단계에 넣지 않는다** — 동작 변화 0 원칙이 깨진다.
  - **0단계가 만들어 둔 자리 2개를 여기서 처음 실제로 쓴다** — `derivedSearchText`(코드값 도메인)와 `TOTAL_SOURCE_LIMIT`(도메인이 늘어 컨텍스트가 비례 증가하는 것을 막는다).
  - **읽기 관측**도 여기서 붙는다 — 4단계 착수 조건("확인할 수 없습니다" 20%)을 잴 로그가 없으면 그 조건은 영원히 판정되지 않는다.
  - 검색 결과를 프롬프트에서 **구획하고 신뢰 등급을 명시**한다(`news`는 외부 RSS 본문이라 인젝션 경로다). `proposedAction`은 `[system]` 출처 없이 나올 수 없다.
- 1.5단계 — SharePoint `kind: "custom"` + `allSettled`·타임아웃·`degraded[]`
- 2~3단계 — 액션 실행 대행

설계 원본: `docs/superpowers/specs/2026-08-10-assistant-system-agent-design.md`
현행 모범사례 대조: `docs/superpowers/specs/2026-08-10-assistant-system-agent-benchmark.md`

## 착수 전 확인 — 완료됨

**실험 A는 끝났다 (2026-08-10, `docs/superpowers/specs/2026-08-10-assistant-registry-experiment-a.md`).** 아직 없는 도메인 3개(`automation_runs`·`schedule_events`·`news`)를 실제 DB 컬럼으로 채워봤고 **3/3 모두 `custom` 예외 없이 선언형으로 채워졌다.** 판정 기준(2개 이상 예외면 접는다)을 통과했으므로 이 계획을 진행한다.

실험이 드러낸 결함 3개의 처리:

| 결함 | 처리 |
|---|---|
| **A. 코드값이 한국어 질문에 안 걸림** (`job_id: "ratio-audit"` vs "경쟁률") | **이 계획에 반영됨** — `derivedSearchText` 옵셔널 필드 (Task 2·4) |
| **B. `Source`에 외부 URL 자리가 없음** (뉴스 기사 원문 링크) | 1단계로 미룸 — `Source`는 6도메인 공개 타입이라 0단계에서 건드리면 동작 변화 0이 깨진다 |
| **C. 날짜 질문을 토큰 매칭으로 못 품** ("다음 주 휴가 누구야?") | 검색 모델 자체의 한계. 4단계 근거로 남김 |

**부수 관찰**도 1단계로 넘긴다: `automation_runs`는 7,721행인데 `FETCH_LIMIT_PER_DOMAIN = 200`이라 최신 200건만 대상이다 — "지난달 실패한 잡"류가 조용히 범위 밖으로 빠진다. 도메인별 상한을 레지스트리 필드로 열지 1단계에서 검토한다.
