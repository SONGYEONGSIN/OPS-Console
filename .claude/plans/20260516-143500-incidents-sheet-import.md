---
plan_id: 20260516-143500-incidents-sheet-import
status: completed
created: 2026-05-16T14:35:00Z
hard_gate: inline
source: brainstorm:.claude/memory/brainstorms/20260516-143000-incidents-sheet-import.md
branch: chore/incidents-sheet-import
---

# Plan: incidents 시트 import 스크립트 (PR-7)

## Goal

운영부 incidents 시트(2025학년도, 226 row 중 부서='운영부' 23건)를 `public.incidents` 테이블에 일괄 주입. `scripts/incidents-import.mjs` 단일 스크립트, `DRY_RUN=true` env로 검증 모드. PR #116 도메인 기반.

## Approach

services-import.mjs 패턴 차용. `.env.local` 로드 + `SUPABASE_SERVICE_ROLE_KEY`로 RLS 우회. 시트 캐시 파일(`scripts/incidents-sheet-cache.txt` — git ignore)에서 markdown 표 파싱 → 운영부 row 필터 → operators 매칭 → mapper → batch insert.

## Out of Scope

- description 4섹션 분리 (시트 자체에 없음)
- UPSERT — 재실행 시 중복 위험 명시
- 영업기획/대학영업 row import
- 자동 동기화

## 영향 파일

| 파일 | 변경 |
|------|------|
| `scripts/incidents-import.mjs` | 신규 |
| `scripts/incidents-sheet-cache.txt` | 시트 원본 dump (git ignore) |
| `.gitignore` | `scripts/incidents-sheet-cache.txt` 추가 |

## 단계

### T1: 시트 캐시 추출 + .gitignore

- **상태**: pending
- **변경**:
  - 직전 MCP Google Drive 응답 캐시(`~/.claude/projects/.../tool-results/mcp-claude_ai_Google_Drive-read_file_content-*.txt`)에서 `.fileContent` 추출 → `scripts/incidents-sheet-cache.txt`
  - `.gitignore`에 `scripts/incidents-sheet-cache.txt` 추가
  - 명령:
    ```bash
    jq -r '.fileContent' /Users/yss/.claude/projects/-Users-yss----build-Folio/e1a288cd-b2f4-40b8-b74c-508786217e27/tool-results/mcp-claude_ai_Google_Drive-read_file_content-1778902741355.txt > scripts/incidents-sheet-cache.txt
    ```
- **DoD**: `wc -l scripts/incidents-sheet-cache.txt` ≥ 200줄. 첫 줄에 "이슈 유형 | 분류 | 요약 |..." 헤더 포함
- **의존**: 없음

### T2: 스크립트 신규 작성 — parser + mapper + dry_run

- **상태**: pending
- **파일**: `scripts/incidents-import.mjs` (신규)
- **변경**:

```javascript
#!/usr/bin/env node
// incidents 시트 import — 2025학년도 운영부 row 주입. PR-7.
// 실행: DRY_RUN=true node scripts/incidents-import.mjs  (검증)
//       node scripts/incidents-import.mjs               (실제 insert)

import "dotenv/config";
import { config as dotenvConfig } from "dotenv";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

dotenvConfig({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.env.DRY_RUN === "true";
const SHEET_CACHE = "scripts/incidents-sheet-cache.txt";
const YEAR = 2025;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("[fatal] NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// PR-6 reporter 매핑과 동일
const REPORTER_BY_DEPARTMENT = {
  "운영부-운영1팀": { email: "alcure23@jinhakapply.com", name: "허승철" },
  "운영부-운영2팀": { email: "ys1114@jinhakapply.com", name: "송영신" },
};

const CATEGORY_CANON = new Set(["결제", "원서작성", "사이트", "경쟁률"]);
function canonicalCategory(raw) {
  const c = (raw ?? "").trim();
  return CATEGORY_CANON.has(c) ? c : "기타";
}

function canonicalStatus(raw) {
  const s = (raw ?? "").trim();
  if (s === "할 일") return "미처리";
  if (s === "처리완료" || s === "완료") return "처리완료";
  if (s === "진행중" || s === "진행 중") return "처리중";
  if (s === "보류") return "보류";
  return "미처리";
}

function parseDate(raw) {
  const s = (raw ?? "").trim();
  if (!s) return null;
  // 시트 형식: "2024-09-19" 또는 "2024.09.19"
  const m = s.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/**
 * markdown table parser — | col1 | col2 | ... |
 * 첫 2줄은 header / separator, 그 이후가 데이터 row.
 * Cell 안 multi-line은 시트 export 시 \n으로 변환됐다 가정 — 한 줄 = 한 row.
 */
function parseSheet(text) {
  const lines = text.split("\n").filter((l) => l.trim().startsWith("|"));
  if (lines.length < 3) throw new Error("sheet table not found");
  const header = lines[0]
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split("|")
      .map((s) => s.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
    if (cells.length !== header.length) continue; // multi-line cell row → skip
    const row = {};
    header.forEach((h, idx) => (row[h] = cells[idx]));
    rows.push(row);
  }
  return rows;
}

async function fetchOperatorsMap() {
  const { data, error } = await supabase
    .from("operators")
    .select("email,name,team")
    .eq("status", "active");
  if (error) throw new Error("operators fetch fail: " + error.message);
  const m = new Map();
  for (const op of data ?? []) {
    if (op.name) m.set(op.name, { email: op.email, team: op.team });
  }
  return m;
}

function mapRow(sheetRow, opsMap) {
  const dept = (sheetRow["부서"] ?? "").trim();
  if (dept !== "운영부") return { skip: "non-운영부" };

  const title = (sheetRow["요약"] ?? "").trim();
  const category = (sheetRow["분류"] ?? "").trim();
  const university_name = (sheetRow["대학교"] ?? "").trim();
  if (!title || !category || !university_name) return { skip: "필수 누락" };

  const assigneeName = (sheetRow["담당자"] ?? "").trim();
  const assignee = opsMap.get(assigneeName);
  if (!assignee) return { skip: `담당자 매칭 실패: ${assigneeName}` };

  const department =
    assignee.team === "운영2팀" ? "운영부-운영2팀" : "운영부-운영1팀";
  const reporter = REPORTER_BY_DEPARTMENT[department];

  return {
    payload: {
      year: YEAR,
      university_name,
      app_type: "공통원서",
      category: canonicalCategory(category),
      occurred_date: parseDate(sheetRow["Start date"]),
      resolved_date: parseDate(sheetRow["기한"]),
      title: title.slice(0, 200),
      cause_summary: (sheetRow["설명"] ?? "").slice(0, 5000) || null,
      root_cause: null,
      resolution: null,
      prevention: null,
      department,
      assignee_email: assignee.email,
      assignee_name: assigneeName,
      reporter_email: reporter.email,
      reporter_name: reporter.name,
      status: canonicalStatus(sheetRow["상태"]),
    },
  };
}

async function main() {
  console.log(`[mode] ${DRY_RUN ? "DRY_RUN" : "REAL"}`);

  const sheetText = readFileSync(SHEET_CACHE, "utf8");
  const sheetRows = parseSheet(sheetText);
  console.log(`[sheet] ${sheetRows.length} rows parsed`);

  const opsMap = await fetchOperatorsMap();
  console.log(`[operators] ${opsMap.size} active`);

  const payloads = [];
  const skipReasons = new Map();
  for (const r of sheetRows) {
    const result = mapRow(r, opsMap);
    if (result.skip) {
      skipReasons.set(result.skip, (skipReasons.get(result.skip) ?? 0) + 1);
      continue;
    }
    payloads.push(result.payload);
  }

  console.log(`\n[mapped] ${payloads.length} payloads ready to insert`);
  console.log(`[skip] ${sheetRows.length - payloads.length} rows`);
  for (const [reason, n] of [...skipReasons.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${reason}: ${n}`);
  }

  if (DRY_RUN) {
    console.log("\n[DRY_RUN] sample payload (first row):");
    console.dir(payloads[0], { depth: null });
    console.log("\n[DRY_RUN] category distribution:");
    const dist = new Map();
    for (const p of payloads) dist.set(p.category, (dist.get(p.category) ?? 0) + 1);
    for (const [k, v] of dist) console.log(`  ${k}: ${v}`);
    console.log("\n[DRY_RUN] department distribution:");
    const ddist = new Map();
    for (const p of payloads)
      ddist.set(p.department, (ddist.get(p.department) ?? 0) + 1);
    for (const [k, v] of ddist) console.log(`  ${k}: ${v}`);
    return;
  }

  // 실제 insert — chunk 50
  const CHUNK = 50;
  let ok = 0;
  for (let i = 0; i < payloads.length; i += CHUNK) {
    const slice = payloads.slice(i, i + CHUNK);
    const { error } = await supabase.from("incidents").insert(slice);
    if (error) {
      console.error(`[fatal] chunk ${i}~${i + slice.length - 1} insert fail:`, error.message);
      process.exit(1);
    }
    ok += slice.length;
  }
  console.log(`\n[OK] ${ok} rows inserted into public.incidents`);
}

main().catch((e) => {
  console.error("[fatal]", e);
  process.exit(1);
});
```

- **DoD**: `DRY_RUN=true node scripts/incidents-import.mjs` 실행 → "[mapped] N payloads" + category/department 분포 출력. throw 없음
- **의존**: T1

### T3: dry_run 실행 + 검증 + 실제 insert

- **상태**: pending
- **변경**:
  ```bash
  DRY_RUN=true node scripts/incidents-import.mjs
  # 출력 검토 — mapped count, skip reason 분포, category/department 분포
  # 검증 통과 시:
  node scripts/incidents-import.mjs
  ```
- **DoD**:
  - dry_run 결과 mapped 0건 아님
  - 매칭 실패(skip)가 합리적 분포
  - 실제 실행 후 `select count(*) from incidents` → 매핑된 row 수
- **의존**: T2

## 리스크

| 리스크 | 완화책 |
|--------|--------|
| markdown cell의 multi-line으로 row 정렬 어긋남 | parser에서 `cells.length !== header.length` row skip. dry_run에서 누락 발견 시 시트 export 재진행 또는 정제 |
| 담당자 이름이 operators.name과 정확히 일치 안 함 | dry_run에서 "담당자 매칭 실패" 분포 확인. 운영부 23 row 모두 일치하는지 |
| 재실행 시 row 중복 | UPSERT 없음 — 일회성 보장. 재실행 필요 시 `delete from incidents where year=2025`로 정리 후 |
| RLS 우회 service_role 노출 | scripts/는 사용자 로컬 실행만. .env.local은 git ignore |
| sheet cache 외부 노출 | .gitignore 등록. 시트 원본은 사내 자료 |

## 진행 추적

| 시각 | 단계 | 상태 변경 | 비고 |
|------|------|-----------|------|
| 2026-05-16T14:35:00Z | — | plan 생성 | brainstorm 20260516-143000 입력. branch `chore/incidents-sheet-import` |
