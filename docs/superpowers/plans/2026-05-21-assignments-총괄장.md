# 총괄장 (담당자 배정 조회) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SharePoint 배정 엑셀(`SHAREPOINT_ASSIGNMENTS_ITEM_ID`)을 읽어 `/dashboard/assignments`에서 대학별 운영/개발 배정·업무분장·가격정책을 조회하는 읽기전용 3탭 메뉴를 추가한다.

**Architecture:** receivables 패턴(실시간 Graph fetch + React cache)을 재사용한다. 대학배정 탭은 5개 시트를 파싱·대학명 기준 조인하여 ListPattern variant `assignments`로 렌더(대학 행 × 5서비스 운영/개발), 행 클릭 시 인스펙터에 sub-type/연도 상세. 업무분장·가격정책 탭은 시트 usedRange를 raw 그리드로 렌더. 탭은 `?tab=` 서버 쿼리로 활성 탭 시트만 fetch.

**Tech Stack:** Next.js App Router(RSC) · TypeScript · Microsoft Graph workbook API · Vitest · Tailwind v4

설계 출처: `docs/superpowers/specs/2026-05-20-총괄장-assignments-design.md`

---

## File Structure

- Create `src/features/assignments/schemas.ts` — 타입 (ServiceKind, AssignmentRecord, UnivAssignmentRow, AssignmentDetail, AssignmentSheet)
- Create `src/features/assignments/queries.ts` — `fetchAssignmentSheet(name)` Graph fetch + React cache
- Create `src/features/assignments/parse.ts` — 시트별 파서 + 조인 + 검색 매칭 (순수 함수)
- Create `src/features/assignments/__tests__/parse.test.ts` — 파서/조인/검색 단위 테스트
- Modify `src/app/dashboard/_components/patterns/ListPattern.tsx` — ListRow에 `assignment` 필드 추가
- Modify `src/app/dashboard/_components/inspector/list-variants/types.ts` — Variant union에 `"assignments"` 추가
- Create `src/app/dashboard/_components/inspector/list-variants/assignments/Table.tsx`
- Create `src/app/dashboard/_components/inspector/list-variants/assignments/View.tsx`
- Create `src/app/dashboard/_components/inspector/list-variants/assignments/filters.ts`
- Modify `src/app/dashboard/_components/inspector/list-variants/registry.ts` — assignments 엔트리
- Create `src/app/dashboard/assignments/_row-mapper.ts` — `univRowToListRow`, `matchesAssignmentQuery`
- Create `src/app/dashboard/assignments/_row-mapper.test.ts`
- Create `src/app/dashboard/assignments/_components/AssignmentTabs.tsx` — 탭 바
- Create `src/app/dashboard/assignments/_components/SheetGrid.tsx` — raw 그리드 (duties/pricing)
- Create `src/app/dashboard/assignments/page.tsx` — 탭 분기 + 권한 가드 + fetch
- Modify `src/app/dashboard/_data.ts` — 사이드바 "서비스" 위 `총괄장` 항목
- Modify `src/app/dashboard/_data/page-meta-config.ts` — `assignments` 메타

---

## Task 1: schemas — 배정 도메인 타입

**Files:**
- Create: `src/features/assignments/schemas.ts`

- [ ] **Step 1: Create the types file**

```typescript
/** 대학배정 탭이 다루는 5개 서비스 종류 */
export type ServiceKind =
  | "원서접수"
  | "대학원"
  | "PIMS"
  | "성적산출"
  | "상담앱";

export const SERVICE_KINDS: ServiceKind[] = [
  "원서접수",
  "대학원",
  "PIMS",
  "성적산출",
  "상담앱",
];

/** 한 시트의 한 행에서 추출한 단일 서비스 배정 (그리드 대표값) */
export type AssignmentRecord = {
  university: string;
  service: ServiceKind;
  /** 그리드 대표 운영자 (원서접수=수시 기준) */
  operator: string;
  /** 그리드 대표 개발자. PIMS 등 개발자 없으면 "" */
  developer: string;
  /** 인스펙터용 상세 항목 (sub-type/연도/보조 컬럼) */
  detail: AssignmentDetail[];
};

/** 인스펙터에 한 줄로 표시할 상세 (예: "2027 수시 운영", "기자의") */
export type AssignmentDetail = { label: string; value: string };

/** 대학 1행 = 5서비스 배정 묶음 (조인 결과) */
export type UnivAssignmentRow = {
  university: string;
  /** service → 해당 서비스 배정 (없으면 키 없음) */
  byService: Partial<Record<ServiceKind, AssignmentRecord>>;
};

/** Graph usedRange 파싱 결과 (raw 그리드 + 헤더) */
export type AssignmentSheet = {
  worksheetName: string;
  /** display text 2차원 배열 (헤더 포함 전체 행) */
  rowsText: string[][];
  rowCount: number;
  columnCount: number;
};
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (타입 정의만)

- [ ] **Step 3: Commit**

```bash
git add src/features/assignments/schemas.ts
git commit -m "feat: 배정 도메인 타입 정의 (assignments schemas)"
```

---

## Task 2: queries — fetchAssignmentSheet (Graph + cache)

**Files:**
- Create: `src/features/assignments/queries.ts`

receivables의 `fetchReceivablesSheet`와 동일 흐름이되, 드라이브=`SHAREPOINT_DRIVE_ID`, 아이템=`SHAREPOINT_ASSIGNMENTS_ITEM_ID`, 워크시트 이름을 인자로 받는다. usedRange의 `text`만 사용(display 형식 보존).

- [ ] **Step 1: Create the queries file**

```typescript
import "server-only";
import { cache } from "react";
import { getGraphToken } from "@/lib/microsoft/auth";
import type { AssignmentSheet } from "./schemas";

/**
 * 배정 엑셀(SHAREPOINT_ASSIGNMENTS_ITEM_ID, 메인 드라이브)의 특정 워크시트
 * usedRange를 display text로 가져온다. 실패/없음 → null.
 * React cache로 래핑 — 같은 요청 내 동일 워크시트 중복 호출 dedupe.
 */
export const fetchAssignmentSheet = cache(
  async function fetchAssignmentSheet(
    worksheetName: string,
  ): Promise<AssignmentSheet | null> {
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    const itemId = process.env.SHAREPOINT_ASSIGNMENTS_ITEM_ID;
    if (!driveId || !itemId) {
      console.warn(
        "[assignments] SHAREPOINT_DRIVE_ID / SHAREPOINT_ASSIGNMENTS_ITEM_ID 환경 변수 누락",
      );
      return null;
    }

    let token: string;
    try {
      token = await getGraphToken();
    } catch (e) {
      console.error("[assignments] graph token error:", e);
      return null;
    }

    const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
    const enc = encodeURIComponent(worksheetName);
    const res = await fetch(
      `${base}/worksheets('${enc}')/usedRange(valuesOnly=true)?$select=text,rowCount,columnCount`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    if (!res.ok) {
      console.error(
        `[assignments] usedRange fail (${worksheetName}):`,
        res.status,
        (await res.text()).slice(0, 200),
      );
      return null;
    }
    const data = (await res.json()) as {
      text?: string[][];
      rowCount?: number;
      columnCount?: number;
    };
    const rowsText = (data.text ?? []).map((row) =>
      row.map((c) => String(c ?? "")),
    );
    return {
      worksheetName,
      rowsText,
      rowCount: data.rowCount ?? rowsText.length,
      columnCount: data.columnCount ?? (rowsText[0]?.length ?? 0),
    };
  },
);

/** 워크시트 이름 상수 (시트 탭 명과 정확히 일치) */
export const SHEET_NAMES = {
  배정리스트: "02. 배정리스트",
  대학원: "03. 대학원",
  PIMS: "04. PIMS",
  성적산출: "06. 성적산출",
  상담앱: "07. 상담앱",
  업무분장: "(참고) 업무분장",
  가격정책: "(참고) 가격정책",
} as const;
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/assignments/queries.ts
git commit -m "feat: 배정 엑셀 워크시트 fetch (Graph + React cache)"
```

---

## Task 3: parser — 02.배정리스트 (원서접수, 2줄 헤더/연도 블록)

**Files:**
- Create: `src/features/assignments/parse.ts`
- Test: `src/features/assignments/__tests__/parse.test.ts`

02.배정리스트는 헤더가 2줄(index 0: 블록 라벨, index 1: sub-type)이고 데이터는 index 2부터다.
연도 블록(2027/2026 운영자/개발자)은 r0에서 라벨로 시작 컬럼을 찾고, sub-type은 블록 시작 +offset(재외0/수시1/정시2/편입3/외국인4/백업5)으로 계산한다. 그리드 대표값=수시(offset 1).

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { parseBaejungList } from "../parse";
import type { AssignmentSheet } from "../schemas";

// r0=블록 라벨, r1=sub-type, r2~=데이터. 컬럼: A NO, B 대분류, C 지역, D 대학명,
// E UnivID ... M~R 2027운영(재외/수시/정시/편입/외국인/백업), S~X 2027개발, Y~^ 2026운영, _~d 2026개발
function cell(idx: number, val: string, width = 36): string[] {
  const r = Array(width).fill("");
  r[idx] = val;
  return r;
}
function mergeRows(...rows: string[][]): string[] {
  const out = Array(36).fill("");
  for (const r of rows) r.forEach((v, i) => { if (v) out[i] = v; });
  return out;
}

const sheet: AssignmentSheet = {
  worksheetName: "02. 배정리스트",
  rowsText: [
    // r0 블록 라벨: M(12)=2027학년도 운영자, S(18)=2027학년도 개발자, Y(24)=2026학년도 운영자, _(30)=2026학년도 개발자, D(3)=대학명
    mergeRows(cell(3, "대학명"), cell(12, "2027학년도 운영자"), cell(18, "2027학년도 개발자"), cell(24, "2026학년도 운영자"), cell(30, "2026학년도 개발자")),
    // r1 sub-type (각 블록 재외/수시/정시/편입/외국인/백업)
    mergeRows(
      cell(12, "재외"), cell(13, "수시"), cell(14, "정시"), cell(15, "편입"), cell(16, "외국인"), cell(17, "백업"),
      cell(18, "재외"), cell(19, "수시"), cell(20, "정시"), cell(21, "편입"), cell(22, "외국인"), cell(23, "백업"),
      cell(24, "재외"), cell(25, "수시"), cell(26, "정시"), cell(27, "편입"), cell(28, "외국인"), cell(29, "백업"),
      cell(30, "재외"), cell(31, "수시"), cell(32, "정시"), cell(33, "편입"), cell(34, "외국인"), cell(35, "백업"),
    ),
    // r2 데이터: 신성대학교, 2027 수시운영=N(13)=기자의, 2027 수시개발=T(19)=권용철, 2027 정시운영=O(14)=김슬기
    mergeRows(cell(3, "신성대학교"), cell(13, "기자의"), cell(14, "김슬기"), cell(19, "권용철"), cell(25, "기존운영")),
  ],
  rowCount: 3,
  columnCount: 36,
};

describe("parseBaejungList", () => {
  it("수시 기준 운영/개발을 그리드 대표값으로 추출", () => {
    const recs = parseBaejungList(sheet);
    expect(recs).toHaveLength(1);
    expect(recs[0]).toMatchObject({
      university: "신성대학교",
      service: "원서접수",
      operator: "기자의", // 2027 수시 운영 (N)
      developer: "권용철", // 2027 수시 개발 (T)
    });
  });

  it("인스펙터 detail에 sub-type/연도 항목 포함", () => {
    const recs = parseBaejungList(sheet);
    const labels = recs[0].detail.map((d) => d.label);
    expect(labels).toContain("2027 정시 운영");
    expect(recs[0].detail.find((d) => d.label === "2027 정시 운영")?.value).toBe("김슬기");
    expect(labels).toContain("2026 수시 운영");
  });

  it("대학명 빈 행은 제외", () => {
    const empty: AssignmentSheet = { ...sheet, rowsText: [...sheet.rowsText, Array(36).fill("")] };
    expect(parseBaejungList(empty)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/assignments/__tests__/parse.test.ts -t parseBaejungList`
Expected: FAIL — "parseBaejungList is not a function"

- [ ] **Step 3: Write minimal implementation**

```typescript
import type {
  AssignmentSheet,
  AssignmentRecord,
  AssignmentDetail,
} from "./schemas";

/** 행 배열에서 정확히 일치하는 헤더 셀의 컬럼 인덱스 (없으면 -1) */
function colExact(headerRow: string[], label: string): number {
  return headerRow.findIndex((c) => c.trim() === label);
}
/** 정규식 매칭 헤더 컬럼 인덱스 (없으면 -1) */
function colMatch(headerRow: string[], re: RegExp): number {
  return headerRow.findIndex((c) => re.test(c.trim()));
}

const SUBTYPE_ORDER = ["재외", "수시", "정시", "편입", "외국인", "백업"] as const;
const SUSI_OFFSET = 1; // 수시 = 블록 시작 + 1

/** 02. 배정리스트 → 원서접수 AssignmentRecord[] (수시 기준 그리드 대표) */
export function parseBaejungList(sheet: AssignmentSheet): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 3) return [];
  const r0 = rows[0];
  const uniCol = colExact(r0, "대학명");
  const op2027 = colMatch(r0, /2027.*운영자/);
  const dev2027 = colMatch(r0, /2027.*개발자/);
  const op2026 = colMatch(r0, /2026.*운영자/);
  const dev2026 = colMatch(r0, /2026.*개발자/);
  if (uniCol < 0 || op2027 < 0) return [];

  const blocks: { year: string; role: string; start: number }[] = [
    { year: "2027", role: "운영", start: op2027 },
    { year: "2027", role: "개발", start: dev2027 },
    { year: "2026", role: "운영", start: op2026 },
    { year: "2026", role: "개발", start: dev2026 },
  ].filter((b) => b.start >= 0);

  const out: AssignmentRecord[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;

    const detail: AssignmentDetail[] = [];
    for (const b of blocks) {
      SUBTYPE_ORDER.forEach((st, off) => {
        const v = (row[b.start + off] ?? "").trim();
        if (v) detail.push({ label: `${b.year} ${st} ${b.role}`, value: v });
      });
    }
    const operator = (row[op2027 + SUSI_OFFSET] ?? "").trim();
    const developer = dev2027 >= 0 ? (row[dev2027 + SUSI_OFFSET] ?? "").trim() : "";
    out.push({ university, service: "원서접수", operator, developer, detail });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/assignments/__tests__/parse.test.ts -t parseBaejungList`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/features/assignments/parse.ts src/features/assignments/__tests__/parse.test.ts
git commit -m "feat: 02.배정리스트 파서 (원서접수 수시 기준 + 연도/sub-type detail)"
```

---

## Task 4: parser — 03/04/06/07 단순 시트

**Files:**
- Modify: `src/features/assignments/parse.ts`
- Test: `src/features/assignments/__tests__/parse.test.ts`

단일 헤더(index 0), 데이터 index 1~. 헤더 텍스트로 컬럼 검출. PIMS는 개발자 없음(운영자 FULL=G, 보조 I=환/충).

- [ ] **Step 1: Write the failing test**

```typescript
import {
  parseSimpleSheet,
  parsePims,
} from "../parse";

function simpleSheet(headers: string[], dataRows: string[][]): AssignmentSheet {
  return {
    worksheetName: "t",
    rowsText: [headers, ...dataRows],
    rowCount: dataRows.length + 1,
    columnCount: headers.length,
  };
}

describe("parseSimpleSheet", () => {
  it("03.대학원 운영(H)/개발(I) 추출", () => {
    const s = simpleSheet(
      ["No", "대학명", "UnivId", "서비스 구분", "서비스여부", "서비스 개수", "담당자 변경", "운영자", "개발자"],
      [["1", "한국체육대학교", "1153", "대학원", "Y", "3", "변경 X", "기자의", "권용철"]],
    );
    const recs = parseSimpleSheet(s, "대학원", { op: /^운영자$/, dev: /^개발자$/, uni: /대학명/ });
    expect(recs[0]).toMatchObject({
      university: "한국체육대학교", service: "대학원", operator: "기자의", developer: "권용철",
    });
  });

  it("07.상담앱 학교명/운영(F)/개발(G)", () => {
    const s = simpleSheet(
      ["UnivID", "학교명", "ServiceID", "접수운영", "영업자", "운영자", "개발자"],
      [["1187", "신한대학교", "x", "김지현", "김은호", "기자의", "박형진"]],
    );
    const recs = parseSimpleSheet(s, "상담앱", { op: /^운영자$/, dev: /^개발자$/, uni: /학교명|대학명/ });
    expect(recs[0]).toMatchObject({ university: "신한대학교", operator: "기자의", developer: "박형진" });
  });
});

describe("parsePims", () => {
  it("운영자 FULL(G) 대표 + 개발자 없음 + 환/충 detail", () => {
    const s = simpleSheet(
      ["No", "대분류", "지역", "대학명", "서비스구분", "담당자 변경", "운영자 FULL", "접수운영자", "운영자 환/충"],
      [["1", "4년제", "서울", "서경대학교", "Full", "변경 X", "기자의", "임종우", "기존충원"]],
    );
    const recs = parsePims(s);
    expect(recs[0]).toMatchObject({
      university: "서경대학교", service: "PIMS", operator: "기자의", developer: "",
    });
    expect(recs[0].detail.find((d) => d.label === "운영자 환/충")?.value).toBe("기존충원");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/assignments/__tests__/parse.test.ts -t parseSimpleSheet`
Expected: FAIL — "parseSimpleSheet is not a function"

- [ ] **Step 3: Add implementations to parse.ts**

```typescript
import type { ServiceKind } from "./schemas";

/** 단일 헤더 시트 (03/06/07) → AssignmentRecord[]. 헤더 정규식으로 컬럼 검출. */
export function parseSimpleSheet(
  sheet: AssignmentSheet,
  service: ServiceKind,
  patterns: { uni: RegExp; op: RegExp; dev?: RegExp },
): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 2) return [];
  const h = rows[0];
  const uniCol = colMatch(h, patterns.uni);
  const opCol = colMatch(h, patterns.op);
  const devCol = patterns.dev ? colMatch(h, patterns.dev) : -1;
  if (uniCol < 0 || opCol < 0) return [];

  const out: AssignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;
    const operator = (row[opCol] ?? "").trim();
    const developer = devCol >= 0 ? (row[devCol] ?? "").trim() : "";
    out.push({ university, service, operator, developer, detail: [] });
  }
  return out;
}

/** 04. PIMS — 운영자 FULL(대표) + 운영자 환/충(detail). 개발자 없음. */
export function parsePims(sheet: AssignmentSheet): AssignmentRecord[] {
  const rows = sheet.rowsText;
  if (rows.length < 2) return [];
  const h = rows[0];
  const uniCol = colMatch(h, /대학명/);
  const fullCol = colMatch(h, /운영자\s*FULL/);
  const hwanCol = colMatch(h, /운영자\s*환|환\/?충/);
  if (uniCol < 0 || fullCol < 0) return [];

  const out: AssignmentRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const university = (row[uniCol] ?? "").trim();
    if (university === "") continue;
    const operator = (row[fullCol] ?? "").trim();
    const detail = [];
    if (hwanCol >= 0 && (row[hwanCol] ?? "").trim()) {
      detail.push({ label: "운영자 환/충", value: (row[hwanCol] ?? "").trim() });
    }
    out.push({ university, service: "PIMS", operator, developer: "", detail });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/assignments/__tests__/parse.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/features/assignments/parse.ts src/features/assignments/__tests__/parse.test.ts
git commit -m "feat: 단순 배정 시트 파서 (대학원/성적산출/상담앱 + PIMS)"
```

---

## Task 5: 대학명 조인

**Files:**
- Modify: `src/features/assignments/parse.ts`
- Test: `src/features/assignments/__tests__/parse.test.ts`

> 검색 매칭은 ListRow 기준으로 `matchesAssignmentQuery`(Task 6)에 둔다 — 클라이언트 래퍼(Task 9)가
> in-memory 필터에 사용. 여기서는 조인만.

- [ ] **Step 1: Write the failing test**

```typescript
import { joinByUniversity } from "../parse";
import type { AssignmentRecord } from "../schemas";

const recs: AssignmentRecord[] = [
  { university: "고려대학교", service: "원서접수", operator: "김슬기", developer: "박형진", detail: [] },
  { university: "고려대학교", service: "대학원", operator: "기자의", developer: "권용철", detail: [] },
  { university: "연세대학교", service: "PIMS", operator: "한효진", developer: "", detail: [] },
];

describe("joinByUniversity", () => {
  it("대학명 기준으로 서비스 묶음 생성", () => {
    const rows = joinByUniversity(recs);
    const korea = rows.find((r) => r.university === "고려대학교");
    expect(korea?.byService["원서접수"]?.operator).toBe("김슬기");
    expect(korea?.byService["대학원"]?.operator).toBe("기자의");
    expect(korea?.byService["PIMS"]).toBeUndefined();
    expect(rows).toHaveLength(2);
  });

  it("대학명 가나다 정렬", () => {
    const rows = joinByUniversity(recs);
    expect(rows[0].university).toBe("고려대학교");
    expect(rows[1].university).toBe("연세대학교");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/assignments/__tests__/parse.test.ts -t joinByUniversity`
Expected: FAIL — "joinByUniversity is not a function"

- [ ] **Step 3: Add implementation to parse.ts**

```typescript
import type { UnivAssignmentRow } from "./schemas";

/** AssignmentRecord[] → 대학명 기준 union 행 (가나다 정렬) */
export function joinByUniversity(recs: AssignmentRecord[]): UnivAssignmentRow[] {
  const map = new Map<string, UnivAssignmentRow>();
  for (const r of recs) {
    let row = map.get(r.university);
    if (!row) {
      row = { university: r.university, byService: {} };
      map.set(r.university, row);
    }
    row.byService[r.service] = r;
  }
  return [...map.values()].sort((a, b) =>
    a.university.localeCompare(b.university, "ko"),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/assignments/__tests__/parse.test.ts`
Expected: PASS (전체)

- [ ] **Step 5: Commit**

```bash
git add src/features/assignments/parse.ts src/features/assignments/__tests__/parse.test.ts
git commit -m "feat: 배정 대학명 조인"
```

---

## Task 6: ListRow `assignment` 필드 + row-mapper

**Files:**
- Modify: `src/app/dashboard/_components/patterns/ListPattern.tsx` (ListRow 타입 끝부분에 필드 추가)
- Create: `src/app/dashboard/assignments/_row-mapper.ts`
- Create: `src/app/dashboard/assignments/_row-mapper.test.ts`

- [ ] **Step 1: Add `assignment` field to ListRow**

`ListPattern.tsx`의 `export type ListRow = { ... }` 안, 마지막 필드 뒤에 추가:

```typescript
  /** assignments 도메인 — 대학배정 행 (서비스별 운영/개발 + 인스펙터 detail) */
  assignment?: {
    byService: Record<
      string,
      { operator: string; developer: string; detail: { label: string; value: string }[] }
    >;
  };
```

- [ ] **Step 2: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { univRowToListRow, matchesAssignmentQuery } from "./_row-mapper";
import type { UnivAssignmentRow } from "@/features/assignments/schemas";

const univ: UnivAssignmentRow = {
  university: "고려대학교",
  byService: {
    "원서접수": { university: "고려대학교", service: "원서접수", operator: "김슬기", developer: "박형진", detail: [] },
    "PIMS": { university: "고려대학교", service: "PIMS", operator: "한효진", developer: "", detail: [] },
  },
};

describe("univRowToListRow", () => {
  it("대학명=name, byService 매핑", () => {
    const r = univRowToListRow(univ);
    expect(r.name).toBe("고려대학교");
    expect(r.assignment?.byService["원서접수"].operator).toBe("김슬기");
    expect(r.assignment?.byService["PIMS"].developer).toBe("");
    expect(r.status).toBe("active");
  });
});

describe("matchesAssignmentQuery", () => {
  it("대학명/담당자 양방향, 빈 term true", () => {
    const r = univRowToListRow(univ);
    expect(matchesAssignmentQuery(r, "")).toBe(true);
    expect(matchesAssignmentQuery(r, "고려")).toBe(true);
    expect(matchesAssignmentQuery(r, "박형진")).toBe(true);
    expect(matchesAssignmentQuery(r, "없는사람")).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/app/dashboard/assignments/_row-mapper.test.ts`
Expected: FAIL — "Cannot find module './_row-mapper'"

- [ ] **Step 4: Create _row-mapper.ts**

```typescript
import type { ListRow } from "../_components/patterns/ListPattern";
import type { UnivAssignmentRow } from "@/features/assignments/schemas";

export function univRowToListRow(u: UnivAssignmentRow): ListRow {
  const byService: NonNullable<ListRow["assignment"]>["byService"] = {};
  for (const [svc, rec] of Object.entries(u.byService)) {
    if (!rec) continue;
    byService[svc] = {
      operator: rec.operator,
      developer: rec.developer,
      detail: rec.detail,
    };
  }
  return {
    id: u.university,
    name: u.university,
    status: "active",
    owner: "",
    assignment: { byService },
  };
}

/** 대학명 + 모든 서비스 운영/개발 이름 양방향 매칭 (빈 term → true) */
export function matchesAssignmentQuery(row: ListRow, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (t === "") return true;
  if (row.name.toLowerCase().includes(t)) return true;
  const bs = row.assignment?.byService ?? {};
  for (const rec of Object.values(bs)) {
    if (
      rec.operator.toLowerCase().includes(t) ||
      rec.developer.toLowerCase().includes(t)
    ) {
      return true;
    }
  }
  return false;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/dashboard/assignments/_row-mapper.test.ts && npm run typecheck`
Expected: PASS + 타입 통과

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/_components/patterns/ListPattern.tsx src/app/dashboard/assignments/_row-mapper.ts src/app/dashboard/assignments/_row-mapper.test.ts
git commit -m "feat: ListRow assignment 필드 + 대학배정 row-mapper"
```

---

## Task 7: list-variants `assignments` (Table + View + filters + 등록)

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/assignments/filters.ts`
- Create: `src/app/dashboard/_components/inspector/list-variants/assignments/Table.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/assignments/View.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/types.ts` (Variant union)
- Modify: `src/app/dashboard/_components/inspector/list-variants/registry.ts`

- [ ] **Step 1: Add `"assignments"` to Variant union**

`types.ts`의 `export type Variant =` 목록 끝(`| "worklog";` 앞)에 추가:

```typescript
  | "assignments"
```

- [ ] **Step 2: Create filters.ts**

```typescript
// 대학배정은 읽기 전용 외부 데이터 — chip 필터/신규 행 없음 (검색은 ListSearch가 담당).
export const ASSIGNMENTS_FILTERS: { value: string; label: string }[] = [];
```

- [ ] **Step 3: Create Table.tsx**

```tsx
"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

function cellText(row: ListRow, service: string): string {
  const rec = row.assignment?.byService[service];
  if (!rec || (!rec.operator && !rec.developer)) return "—";
  const dev = rec.developer ? ` / 개 ${rec.developer}` : "";
  return `운 ${rec.operator || "—"}${dev}`;
}

export function AssignmentsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-ink text-left text-xs text-muted">
          <th className="py-2 pr-3 font-medium">대학</th>
          {SERVICE_KINDS.map((s) => (
            <th key={s} className="py-2 pr-3 font-medium">{s}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            onClick={() => onSelect(row)}
            className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
              selectedId === row.id ? "bg-washi-raised" : ""
            }`}
          >
            <td className="py-2 pr-3 font-medium text-ink">{row.name}</td>
            {SERVICE_KINDS.map((s) => (
              <td key={s} className="py-2 pr-3 text-ink">{cellText(row, s)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Create View.tsx (인스펙터 상세)**

```tsx
import type { ListRow } from "../../../patterns/ListPattern";
import { SERVICE_KINDS } from "@/features/assignments/schemas";

export function AssignmentsView({ row }: { row: ListRow }) {
  const bs = row.assignment?.byService ?? {};
  return (
    <div className="flex flex-col gap-5 p-5">
      <h2 className="text-lg font-medium text-ink">{row.name}</h2>
      {SERVICE_KINDS.map((s) => {
        const rec = bs[s];
        if (!rec) return null;
        return (
          <section key={s} className="border-b border-line-soft pb-3">
            <h3 className="mb-1 text-sm font-medium text-vermilion">{s}</h3>
            <p className="text-sm text-ink">
              운영 {rec.operator || "—"}
              {rec.developer ? ` · 개발 ${rec.developer}` : ""}
            </p>
            {rec.detail.length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted">
                {rec.detail.map((d, i) => (
                  <div key={i} className="contents">
                    <dt>{d.label}</dt>
                    <dd className="text-ink">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Register in registry.ts**

import 추가(상단 import 블록 끝):

```typescript
import { AssignmentsTable } from "./assignments/Table";
import { AssignmentsView } from "./assignments/View";
import { ASSIGNMENTS_FILTERS } from "./assignments/filters";
```

`variantRegistry` 객체 안 `worklog:` 엔트리 앞에 추가:

```typescript
  assignments: {
    View: AssignmentsView,
    Table: AssignmentsTable,
    Filters: ASSIGNMENTS_FILTERS,
  },
```

- [ ] **Step 6: Typecheck + test**

Run: `npm run typecheck && npx vitest run src/app/dashboard/_components/inspector/list-variants/__tests__/`
Expected: PASS (registry가 Record<Variant> satisfies 충족, 기존 variant 테스트 통과)

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/_components/inspector/list-variants/assignments src/app/dashboard/_components/inspector/list-variants/types.ts src/app/dashboard/_components/inspector/list-variants/registry.ts
git commit -m "feat: assignments list-variant (대학배정 그리드 Table + 인스펙터 View)"
```

---

## Task 8: SheetGrid (업무분장/가격정책 raw 렌더)

**Files:**
- Create: `src/app/dashboard/assignments/_components/SheetGrid.tsx`

- [ ] **Step 1: Create SheetGrid.tsx**

```tsx
import type { AssignmentSheet } from "@/features/assignments/schemas";

/** 시트 usedRange를 원본 행/열 그대로 read-only 그리드로 렌더. */
export function SheetGrid({ sheet }: { sheet: AssignmentSheet }) {
  const cols = sheet.columnCount;
  return (
    <div className="overflow-x-auto p-5">
      <table className="border-collapse text-xs">
        <tbody>
          {sheet.rowsText.map((row, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => {
                const v = row[ci] ?? "";
                return (
                  <td
                    key={ci}
                    className="border border-line-soft px-2 py-1 align-top text-ink whitespace-pre-wrap"
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/assignments/_components/SheetGrid.tsx
git commit -m "feat: SheetGrid — 업무분장/가격정책 시트 raw 그리드 렌더"
```

---

## Task 9: AssignmentTabs (탭 바) + AssignmentUnivTab (대학배정 클라이언트 래퍼)

**Files:**
- Create: `src/app/dashboard/assignments/_components/AssignmentTabs.tsx`
- Create: `src/app/dashboard/assignments/_components/AssignmentUnivTab.tsx`

대학배정 탭은 전 행이 서버에서 메모리에 로드되므로, 검색은 URL 왕복 없이 **클라이언트 in-memory 필터**로 한다. `matchesAssignmentQuery`(Task 6)를 사용. ListPattern은 텍스트 검색 input이 없으므로 ListSearch를 래퍼 상단에 둔다.

- [ ] **Step 1: Create AssignmentTabs.tsx**

```tsx
import Link from "next/link";

const TABS = [
  { key: "univ", label: "대학배정" },
  { key: "duties", label: "업무분장" },
  { key: "pricing", label: "가격정책" },
] as const;

export function AssignmentTabs({ active }: { active: string }) {
  return (
    <nav className="flex gap-1 border-b border-line px-5">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`/dashboard/assignments?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              on
                ? "border-vermilion font-medium text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Create AssignmentUnivTab.tsx (검색 + ListPattern)**

```tsx
"use client";

import { useState } from "react";
import { ListSearch } from "@/components/common/ListSearch";
import { ListPattern } from "../../_components/patterns/ListPattern";
import type { ListRow } from "../../_components/patterns/ListPattern";
import { matchesAssignmentQuery } from "../_row-mapper";

export function AssignmentUnivTab({
  rows,
  title,
}: {
  rows: ListRow[];
  title: string;
}) {
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => matchesAssignmentQuery(r, q));
  return (
    <div className="flex flex-col gap-3 p-5">
      <ListSearch
        value={q}
        onChange={setQ}
        placeholder="대학명 · 담당자명 검색"
        className="max-w-md"
      />
      <ListPattern
        title={title}
        data={{ rows: filtered }}
        variant="assignments"
        readOnly
      />
    </div>
  );
}
```

> 구현 시 `ListPattern`의 실제 props(특히 `header` 필수 여부, padding)를 receivables/page.tsx 기준으로 확인.
> `header`가 필수면 래퍼에 `header` prop을 추가해 page에서 내려준다. ListPattern이 자체 padding을
> 가지면 위 `p-5`를 조정한다.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/assignments/_components/AssignmentTabs.tsx src/app/dashboard/assignments/_components/AssignmentUnivTab.tsx
git commit -m "feat: 총괄장 탭 바 + 대학배정 클라이언트 검색 래퍼"
```

---

## Task 10: page.tsx (탭 분기 + 권한 + fetch)

**Files:**
- Create: `src/app/dashboard/assignments/page.tsx`

대학배정 탭: 5시트 병렬 fetch → 파싱 → 조인 → ListRow. ListPattern variant=assignments, readOnly.
duties/pricing 탭: 단일 시트 → SheetGrid. 시트 null이면 안내.

- [ ] **Step 1: Create page.tsx**

```tsx
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import type { ListRow } from "../_components/patterns/ListPattern";
import { requireMenu } from "@/features/auth/menu-guard";
import { fetchAssignmentSheet, SHEET_NAMES } from "@/features/assignments/queries";
import {
  parseBaejungList,
  parseSimpleSheet,
  parsePims,
  joinByUniversity,
} from "@/features/assignments/parse";
import type { AssignmentRecord } from "@/features/assignments/schemas";
import { univRowToListRow } from "./_row-mapper";
import { AssignmentTabs } from "./_components/AssignmentTabs";
import { AssignmentUnivTab } from "./_components/AssignmentUnivTab";
import { SheetGrid } from "./_components/SheetGrid";

function ErrorBox() {
  return (
    <section className="p-7">
      <div className="border border-dashed border-vermilion-deep bg-washi-raised p-8 text-center">
        <p className="text-sm font-medium text-vermilion-deep">
          SharePoint 데이터를 불러올 수 없습니다
        </p>
        <p className="mt-2 text-xs text-muted">
          환경변수 (AZURE_AD_* / SHAREPOINT_DRIVE_ID / SHAREPOINT_ASSIGNMENTS_ITEM_ID)
          또는 Azure AD 앱 권한을 확인하세요.
        </p>
      </div>
    </section>
  );
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const slug = "assignments";
  await requireMenu(slug);
  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam === "duties" || tabParam === "pricing" ? tabParam : "univ";

  const config = resolvePageMeta(slug, meta, 0);
  const header = (
    <PageHeader
      key="assignments-header"
      pathname={pathname}
      meta={config.meta}
      headline={config.headline}
      description={config.description}
    />
  );

  if (tab === "duties" || tab === "pricing") {
    const sheet = await fetchAssignmentSheet(
      tab === "duties" ? SHEET_NAMES.업무분장 : SHEET_NAMES.가격정책,
    );
    return (
      <>
        {header}
        <AssignmentTabs active={tab} />
        {sheet ? <SheetGrid sheet={sheet} /> : <ErrorBox />}
      </>
    );
  }

  // 대학배정 탭 — 5시트 병렬 fetch
  const [baejung, daehakwon, pims, sungjuk, sangdam] = await Promise.all([
    fetchAssignmentSheet(SHEET_NAMES.배정리스트),
    fetchAssignmentSheet(SHEET_NAMES.대학원),
    fetchAssignmentSheet(SHEET_NAMES.PIMS),
    fetchAssignmentSheet(SHEET_NAMES.성적산출),
    fetchAssignmentSheet(SHEET_NAMES.상담앱),
  ]);

  if (!baejung && !daehakwon && !pims && !sungjuk && !sangdam) {
    return (
      <>
        {header}
        <AssignmentTabs active="univ" />
        <ErrorBox />
      </>
    );
  }

  const recs: AssignmentRecord[] = [
    ...(baejung ? parseBaejungList(baejung) : []),
    ...(daehakwon
      ? parseSimpleSheet(daehakwon, "대학원", { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ })
      : []),
    ...(pims ? parsePims(pims) : []),
    ...(sungjuk
      ? parseSimpleSheet(sungjuk, "성적산출", { uni: /대학명/, op: /^운영자$/, dev: /^개발자$/ })
      : []),
    ...(sangdam
      ? parseSimpleSheet(sangdam, "상담앱", { uni: /학교명|대학명/, op: /^운영자$/, dev: /^개발자$/ })
      : []),
  ];

  const rows: ListRow[] = joinByUniversity(recs).map(univRowToListRow);

  return (
    <>
      {header}
      <AssignmentTabs active="univ" />
      <AssignmentUnivTab rows={rows} title={meta.label} />
    </>
  );
}
```

> 위 `import { ListPattern }`/`import type { ListRow }`는 page에서 ListRow 타입에만 쓰이고
> ListPattern 직접 렌더는 AssignmentUnivTab으로 옮겼다 — ListPattern import는 제거하고 ListRow는
> `import type`만 남긴다 (미사용 import 금지).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS

> 참고: PageHeader는 page에서 탭 위에 직접 렌더(`{header}`). ListPattern의 `header` prop 필수 여부는
> Task 9 래퍼에서 처리/확인 (receivables/page.tsx 패턴 기준).

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/assignments/page.tsx
git commit -m "feat: 총괄장 페이지 — 3탭 분기 + 5시트 조인 + 권한 가드"
```

---

## Task 11: 사이드바 항목 + 페이지 메타

**Files:**
- Modify: `src/app/dashboard/_data.ts` (sidebarSections "서비스사이클" group, "서비스" 항목 위)
- Modify: `src/app/dashboard/_data/page-meta-config.ts`

- [ ] **Step 1: Add 총괄장 sidebar item**

`_data.ts`의 "서비스사이클" group `items` 배열에서, "서비스"(slug `services`) 항목 **바로 앞**에 삽입:

```typescript
          {
            ico: "·",
            label: "총괄장",
            count: "",
            slug: "assignments",
            pattern: "list",
          },
```

- [ ] **Step 2: Add page meta**

`page-meta-config.ts`의 `PAGE_META` 객체에 추가:

```typescript
  assignments: {
    headline: { accent: "서비스사이클", title: "총괄장" },
    description: "대학별 운영/개발 배정·업무분장·가격정책을 조회합니다.",
  },
```

- [ ] **Step 3: Verify build + sidebar test**

Run: `npm run typecheck && npx vitest run src/app/dashboard/_data`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/_data.ts src/app/dashboard/_data/page-meta-config.ts
git commit -m "feat: 사이드바 총괄장 항목(서비스 위) + 페이지 메타"
```

---

## Task 12: 전체 검증

- [ ] **Step 1: Full verify**

Run: `npm run lint && npm run typecheck && npm test`
Expected: 전부 PASS

- [ ] **Step 2: Production build**

Run: `unset NODE_ENV && npm run build`
Expected: 빌드 성공, `/dashboard/assignments` 라우트 포함

- [ ] **Step 3: 수동 확인 (개발 서버, 가능 시)**

`npm run dev` 후 `/dashboard/assignments` 접속:
- [대학배정] 탭: 대학 행 × 5서비스 그리드, 검색에 대학명/담당자명 입력 시 필터, 행 클릭 시 인스펙터 sub-type/연도
- [업무분장]/[가격정책] 탭: 시트 원본 그리드
- 사이드바 "서비스" 위에 "총괄장" 노출

> Graph fetch는 실 SharePoint 의존 — 로컬 env(.env.local) 필요. 환경변수 없으면 ErrorBox 표시가 정상.

---

## Self-Review

**Spec coverage:** 메뉴 위치(Task 11) · 3탭(Task 9/10) · 실시간 fetch+cache(Task 2) · 대학배정 파서 5시트(Task 3/4) · 수시 기준(Task 3) · 양방향 검색(Task 5/6) · 인스펙터 sub-type/연도(Task 3/7) · 업무분장/가격정책 raw 그리드(Task 8/10) · 권한(Task 10 requireMenu + Task 11 sidebar) · 읽기전용(Task 10 readOnly) · TDD(Task 3~6 RED 우선) — 전부 커버.

**Placeholder scan:** Task 10 Step 2의 ListPattern header prop 주의는 placeholder가 아니라 구현 시 확인 지시(실 시그니처 확인). 그 외 실제 코드 포함.

**Type consistency:** `AssignmentRecord`/`UnivAssignmentRow`/`ServiceKind`/`AssignmentSheet`는 Task 1 정의를 Task 3~7에서 일관 사용. `parseSimpleSheet`/`parsePims`/`parseBaejungList`/`joinByUniversity`(parse) + `univRowToListRow`/`matchesAssignmentQuery`(row-mapper) 시그니처 일치. `matchesAssignmentQuery`는 Task 6 정의 → Task 9 `AssignmentUnivTab`에서 사용(dangling 없음). `SHEET_NAMES` Task 2 정의 → Task 10 사용 일치. 검색 매칭은 ListRow 기준 단일 정의(중복 제거).
