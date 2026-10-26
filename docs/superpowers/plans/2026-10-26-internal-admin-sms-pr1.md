# 내부관리자 SMS 발신번호 현황 (PR-1, 읽기 전용) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/dashboard/internal-admin` 에 개요·학교·발신번호·확인 필요 탭을 가진 읽기 전용 페이지를 만들고, admin + 지정 운영자만 보게 한다.

**Architecture:** `src/features/sms-sender/` 가 Graph 로 최신 xlsm 의 숨김 시트 4개 + `05. 제출 서류 기준` + `03. 학교별 제출 서류` 폴더를 읽고(`source.ts`), 순수 함수로 학교·발신번호·확인 항목·PDF 사본을 조립하며(`parse.ts`), 모듈 TTL 10분으로 캐시한다(`queries.ts`). 화면 필터는 URL 파라미터 → 순수 함수(`filters.ts`) → 서버 페이지가 거른 행을 클라이언트 탭 컴포넌트에 넘긴다. 권한은 `ADMIN_ONLY_MENU_SLUGS` 옆의 새 집합 `DESIGNATED_ONLY_MENU_SLUGS` 와 `canViewMenu` 한 곳에서 판정한다.

**Tech Stack:** Next.js App Router(RSC + server action) · TypeScript · Tailwind 4 토큰 · Microsoft Graph(app-only, `getGraphToken`) · Vitest + Testing Library(jsdom)

**Spec:** `docs/superpowers/specs/2026-10-24-internal-admin-sms-design.md` (revision 2)

## Global Constraints

- 작업 위치는 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-internal-admin-sms` 뿐. 메인 체크아웃(`..\OPS-Console`)은 스케줄러가 돌리므로 브랜치를 바꾸지 않는다.
- 워크트리에 `node_modules` 가 없다 — 첫 테스트 전에 한 번: `cmd //c mklink /J node_modules ..\\OPS-Console\\node_modules` (gitignore 대상, 커밋 안 됨).
- 테스트는 파일 단위로만: `npx vitest run <path> --maxWorkers=1`. 전체 스위트·dev 서버 금지(메모리 부족).
- 라우트 `/dashboard/internal-admin?tab=overview|schools|numbers|checks`, 기본·모르는 값 = `schools`. `추가 제출` 탭은 만들지 않는다(2단계).
- 보기: admin 은 항상. 그 외는 `internal-admin` 이 `operator.allowedMenus` 에 있어야. 이 집합 밖 메뉴의 판정은 지금과 같다.
- 현황 파일: `내부관리자/01. SMS 발신번호 사전등록/` 의 이름이 `/_(\d{6})\.xlsm$/` 로 끝나는 파일 중 최신 날짜. 드라이브는 기존 `SHAREPOINT_DRIVE_ID`(새 env 없음).
- 숨김 시트 `_학교` `_서류` `_번호` `_확인`, 1행 헤더. **열은 헤더 이름으로 찾는다**(위치 고정 금지). `고를 값`(U)·P/T 보조열·`PDF 주소`(R)·`담당자` 는 읽지 않는다.
- 단계 = 가장 앞선 폴더 `완료/제출완료/*` > `완료/검토완료` > `진행 중`. 다른 폴더 사본도 상세에 함께.
- PDF 이름 규칙 `(학교명) SMS 발신용 대학 전화번호 등록 서류.pdf`. 별칭 6줄(spec §7 표)만. 대조 안 되는 PDF 는 '이름 미대조'로 드러낸다.
- 필수 열을 못 찾으면 빈 표가 아니라 오류 화면: `‘{시트}’ 시트에서 ‘{열}’ 열을 찾지 못했습니다.`
- 캐시 TTL `10 * 60 * 1000`, 실패는 캐시하지 않는다. Graph fetch 는 `cache: "no-store"`.
- 확인 필요 건수 = `_확인` 데이터 행 수(`00. 요약` 은 안 읽는다).
- 디자인: 날짜·시각 `kstFormat`(`@/lib/kst-format`), 숫자 `tabular-nums`, 행 호버 `hover:bg-line-soft`, 선택 `bg-vermilion/10 text-vermilion`(카드는 `border-vermilion bg-vermilion/10`), 버튼 호버 `hover:border-ink hover:bg-ink hover:text-cream`, 표 머리글 `tr` = `border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted`, `th` = `px-3 py-2 font-normal`, 입력창은 `ListSearch`/`ListSelect`. hex/rgb 하드코딩 금지.
- 문서·픽스처에 실제 전화번호·사람 이름·메일을 넣지 않는다. 가짜 번호는 `02-0000-0001` 꼴, 사람 칸은 `[담당자]`.
- 커밋: 한국어 conventional commit, 메시지 끝에 빈 줄 + 아래 두 줄(모든 커밋 공통 — 각 Task 의 커밋 단계는 제목만 적는다):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```
  `git commit -F - <<'EOF' … EOF` 로 넣는다. push 하지 않는다.

## Review Focus

1. **기준일이 바뀐 헤더** — 사람이 `제출 서류 (10/15 기준)` 을 `(10/30 기준)` 으로 고치거나 `등록 회선\n(03 번호 목록)` 처럼 줄바꿈이 낀 헤더 → 같은 열로 읽혀야 한다(오류 화면이 되면 기준일 갱신 때마다 페이지가 죽는다). Task 2 `normalizeHeader`·`parseSchools` 테스트.
2. **날짜 칸이 엑셀 일련번호로 올 때** — 지금은 `'2025-10-28'` 문자열이지만 사람이 날짜 서식으로 다시 입력하면 `values` 가 `45958` 을 준다 → `2025-10-28` 로 보여야지 `45958` 이 아니다. Task 2 `parseNumbers` 테스트.
3. **경로의 `+`·공백** — `완료/제출완료/접수+PIMS`, `진행 중` 을 path 기반 Graph 주소에 그대로 넣으면 `+` 가 공백으로 읽혀 29개 PDF 가 조용히 빠진다 → 조각마다 `encodeURIComponent`. Task 4 `childrenUrl` 테스트.
4. **같은 이름 학교 두 행**(`_학교` 에 같은 학교명이 구분만 다르게 2행, 실측 1건) → 발신번호는 학교명+구분으로 맞는 행에 붙고, 확인 항목은 이름이 모호하면 아무 행에도 잇지 않는다. Task 3 테스트.
5. **범위 밖·문자 파라미터** — `?page=999`(필터로 행이 줄어든 뒤 공유된 링크), `?school=abc`, `?school=9999` → 마지막 페이지 / 인스펙터 닫힘, 예외 없음. Task 5 테스트.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/app/dashboard/_data/sidebar-helpers.ts` (수정) | `DESIGNATED_ONLY_MENU_SLUGS` 추가, `getDefaultMemberMenus` 가 그 집합도 뺀다 |
| `src/features/auth/permission.ts` (수정) | `canViewMenu` 지정자 판정 |
| `supabase/migrations/20261026_internal_admin_menu_revoke.sql` (신규) | 기존 `allowed_menus` 의 `internal-admin` 일괄 제거 (아래 '스펙과 다른 점' 1) |
| `src/features/sms-sender/types.ts` | 상수(시트·경로·서류 8종)와 모든 도메인 타입 |
| `src/features/sms-sender/parse.ts` | 순수: 헤더 정규화·시트 행 파싱·xlsm 고르기·PDF 단계·조립 |
| `src/features/sms-sender/aliases.ts` | PDF 이름 → xlsm 이름 6줄 |
| `src/features/sms-sender/source.ts` | server-only: Graph 읽기 → `RawSource` |
| `src/features/sms-sender/queries.ts` | `cache()` + 모듈 TTL 10분 → `SmsSenderResult` |
| `src/features/sms-sender/actions.ts` | `"use server"` 새로고침(권한 재판정) |
| `src/features/sms-sender/filters.ts` | 순수: URL 파라미터 해석·학교/번호/확인 필터·카드 집계·페이지 자르기 |
| `src/app/dashboard/internal-admin/page.tsx` | 가드·탭 분기·데이터 조립 |
| `src/app/dashboard/internal-admin/_components/use-set-params.ts` | URL 파라미터 패치 + 검색 디바운스 훅 |
| `…/_components/SourceBar.tsx` | 기준 시각·새로고침·서류 기준 버튼·원천 경고 + `SourceError` |
| `…/_components/CriteriaModal.tsx` | 05 시트 표 모달 |
| `…/_components/SchoolsTab.tsx` · `SchoolInspector.tsx` | 학교 탭(카드·필터·표) · 학교 인스펙터 |
| `…/_components/NumbersTab.tsx` · `ChecksTab.tsx` | 발신번호 탭 · 확인 필요 탭 |
| `src/app/dashboard/_data/page-meta-config.ts` (수정) | `internal-admin` 헤드라인 1항목 |

### 스펙과 다른 점 (구현자가 알아야 할 것)

1. **`allowed_menus` 에 이미 `internal-admin` 이 들어 있다.** `20260511_operators_allowed_menus.sql` 이 TL·매니저 전원에게 `'internal-admin'` 을 심었고, `getDefaultMemberMenus()` 도 신규 member 에게 준다. 스펙 규칙만 넣으면 TL·매니저 전원에게 열린다. 그래서 Task 1 이 (a) 기본 메뉴에서 빼고 (b) 데이터 마이그레이션으로 걷는다 — 스펙 §7 '마이그레이션 없음'과 다르다. 스키마 변경은 없다.
2. 구분 카드는 `KpiCard` 로 못 만든다(값 하나 + 증감 전용, 클릭 없음). 같은 표면 클래스의 로컬 버튼 카드로 만들고, 실데이터에 있는 `기타`(1곳)는 있을 때만 다섯째 카드로 붙인다.
3. `_서류` 에 `PDF 주소`(R) 열이 있다(88행, 사본 하나씩). 스펙대로 폴더 목록에서 링크를 만들고 이 열은 안 읽는다.
4. 개요 탭은 목업이라 Graph 를 읽지 않는다 — `SourceBar` 는 데이터 탭 셋에만.

---

### Task 1: 지정자 전용 메뉴 권한

**Files:**
- Modify: `src/app/dashboard/_data/sidebar-helpers.ts:120-138`
- Modify: `src/features/auth/permission.ts:34-51`
- Create: `supabase/migrations/20261026_internal_admin_menu_revoke.sql`
- Test: `src/features/auth/__tests__/permission.test.ts`, `src/features/auth/__tests__/menu-guard.test.ts`, `src/app/dashboard/_data/__tests__/internal-admin-menu.test.ts` (신규)

**Interfaces:**
- Produces: `export const DESIGNATED_ONLY_MENU_SLUGS: Set<string>` (= `new Set(["internal-admin"])`), `canViewMenu(slug, operator)` 시그니처 불변.

- [ ] **Step 1: 실패하는 테스트 작성** — `permission.test.ts` 의 `describe("canViewMenu")` 뒤에 추가(기존 `ME_ADMIN`·`ME_MEMBER` 재사용):

```ts
describe("canViewMenu — 지정자 전용(internal-admin)", () => {
  const withMenus = (menus: string[]) => ({ ...ME_MEMBER, allowedMenus: menus });
  it("admin 은 allowedMenus 가 비어도 true", () => {
    expect(canViewMenu("internal-admin", ME_ADMIN)).toBe(true);
  });
  it("member 는 slug 가 없으면 false", () => {
    expect(canViewMenu("internal-admin", withMenus([]))).toBe(false);
    expect(canViewMenu("internal-admin", ME_MEMBER)).toBe(false);
  });
  it("member·viewer 는 slug 가 있으면 true", () => {
    expect(canViewMenu("internal-admin", withMenus(["internal-admin"]))).toBe(true);
    expect(canViewMenu("internal-admin", { ...withMenus(["internal-admin"]), permission: "viewer" as const })).toBe(true);
  });
  it("집합 밖 메뉴는 allowedMenus 와 무관", () => {
    expect(canViewMenu("services", withMenus([]))).toBe(true);
    expect(canViewMenu("services", withMenus(["internal-admin"]))).toBe(true);
  });
  it("allowedMenus 가 admin 전용 메뉴를 열지 않는다", () => {
    expect(canViewMenu("settings", withMenus(["settings"]))).toBe(false);
  });
});
```

`describe("filterSidebarSections")` 에 `{ kind: "item", ico: "·", label: "내부관리자", slug: "internal-admin" }` 를 가진 섹션으로 두 케이스: `ME_MEMBER` → 항목 제거, `withMenus(["internal-admin"])` → 유지.

`menu-guard.test.ts` 에: member(`allowedMenus: ["services"]`)가 `requireMenu("internal-admin")` → `REDIRECT_CALLED`, `mockRedirect` 가 `"/dashboard"` 로 호출.

`internal-admin-menu.test.ts` (`tools-menu.test.ts` 모양, 마이그레이션 원문은 `route-move.test.ts` 의 `code()` 처럼 주석을 지우고 대조):

```ts
it("사이드바 프로젝트 그룹에 있다", …)            // group.label === "프로젝트" 의 slugs 에 "internal-admin"
it("지정자 전용이고 admin 전용이 아니다", () => {
  expect(DESIGNATED_ONLY_MENU_SLUGS.has("internal-admin")).toBe(true);
  expect(ADMIN_ONLY_MENU_SLUGS.has("internal-admin")).toBe(false);
});
it("두 집합은 겹치지 않는다", () => {
  expect([...DESIGNATED_ONLY_MENU_SLUGS].filter((s) => ADMIN_ONLY_MENU_SLUGS.has(s))).toEqual([]);
});
it("신규 member 기본 메뉴에 들어가지 않는다", () => {
  expect(getDefaultMemberMenus()).not.toContain("internal-admin");
});
it("기존 부여를 걷는 마이그레이션이 있다", () => {
  const sql = code("supabase/migrations/20261026_internal_admin_menu_revoke.sql");
  expect(sql).toMatch(/array_remove\(\s*allowed_menus\s*,\s*'internal-admin'\s*\)/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/auth/__tests__/permission.test.ts src/features/auth/__tests__/menu-guard.test.ts src/app/dashboard/_data/__tests__/internal-admin-menu.test.ts --maxWorkers=1`
Expected: FAIL — `DESIGNATED_ONLY_MENU_SLUGS` import 실패, member 케이스 `true`.

- [ ] **Step 3: 구현**
  - `sidebar-helpers.ts`: `ADMIN_ONLY_MENU_SLUGS` 바로 아래 `DESIGNATED_ONLY_MENU_SLUGS = new Set(["internal-admin"])` + 주석(admin + `allowed_menus` 에 slug 가 있는 운영자만, 부여는 DB 직접). `getDefaultMemberMenus` 는 두 집합 모두 뺀다.
  - `permission.ts` `canViewMenu`: null → false, admin → true, admin 전용 → false, 지정자 전용 → `operator.allowedMenus.includes(slug)`, 그 외 true. 함수 위 주석의 '현재 미사용' 문장을 이 판정으로 고친다.
  - 마이그레이션: `begin; update public.operators set allowed_menus = array_remove(allowed_menus, 'internal-admin') where 'internal-admin' = any(allowed_menus); commit;` + 머리 주석(왜: 20260511 시드 · 적용 순서: 이 SQL → 지정자 부여).

- [ ] **Step 4: 통과 확인** — Step 2 명령. Expected: PASS. 소비처도: `npx vitest run src/features/operators src/features/assistant src/app/dashboard/_data src/app/dashboard/work-assignment/__tests__/route-move.test.ts --maxWorkers=1` → PASS.

- [ ] **Step 5: 커밋** — `feat(auth): 지정자 전용 메뉴 — internal-admin 은 admin + 지정 운영자만`

---

### Task 2: 타입과 시트 행 파싱

**Files:**
- Create: `src/features/sms-sender/types.ts`, `src/features/sms-sender/parse.ts`
- Create: `src/features/sms-sender/__tests__/fixtures.ts`, `src/features/sms-sender/__tests__/parse.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export const HIDDEN_SHEETS = { schools: "_학교", docs: "_서류", numbers: "_번호", checks: "_확인" } as const;
  export type HiddenSheetKey = keyof typeof HIDDEN_SHEETS;
  export const CRITERIA_SHEET = "05. 제출 서류 기준";
  export const SMS_ROOT_PATH = "내부관리자/01. SMS 발신번호 사전등록";
  export const DOCS_FOLDER = "03. 학교별 제출 서류";
  export const DOC_KINDS = ["신청서","위임장","이용증명원","사업자등록증","법인인감","재직증명서","신분증","위탁계약서"] as const;
  export type DocKind = (typeof DOC_KINDS)[number];
  export type Completeness = "완비" | "미비" | "확인 안 됨";
  export type Stage = "제출완료" | "검토완료" | "진행 중" | "기타";
  export type DriveFile = { id: string; name: string; webUrl: string; size: number; lastModifiedDateTime: string };
  export type RawPdf = DriveFile & { folder: string };           // DOCS_FOLDER 아래 상대 경로, 예 "완료/제출완료/접수+PIMS"
  export type RawSource = { workbook: DriveFile; offRuleFiles: string[]; sheets: Record<HiddenSheetKey, unknown[][]>; criteria: unknown[][] | null; pdfs: RawPdf[]; fetchedAt: string };
  export type SchoolRow = { no: number; name: string; gubun: string; apply: boolean; pims: boolean; lines: number; bulk: number; added: number; deficient: number; lastRegisteredAt: string | null; docSummary: string; needsCheck: boolean; note: string };
  export type DocStatus = { sejongStatus: string; marks: Record<DocKind, string>; submitState: string; completeness: Completeness; missing: string };
  export type PdfCopy = { fileName: string; folder: string; stage: Stage; sub: string | null; webUrl: string; lastModifiedDateTime: string };
  export type School = SchoolRow & { docs: DocStatus | null; pdfs: PdfCopy[] };   // pdfs: 앞선 단계 먼저, [] = PDF 없음
  export type SenderNumber = { no: number; school: string; gubun: string; number: string; digits: string; status: string; registeredAt: string | null; docs: string; note: string; schoolNo: number | null };
  export type CheckItem = { no: number; kind: string; target: string; content: string; basis: string; todo: string; schoolNo: number | null };
  export type SmsSenderData = { workbook: DriveFile; fetchedAt: string; offRuleFiles: string[]; schools: School[]; numbers: SenderNumber[]; checks: CheckItem[]; unmatchedPdfs: string[]; criteria: string[][] | null };
  ```
- Produces (`parse.ts`): `normalizeHeader(h: unknown): string` · `class SheetShapeError extends Error { readonly sheet: string; readonly column: string }` · `excelDate(v: unknown): string | null` · `digitsOf(s: string): string` · `parseSchools(values: unknown[][]): SchoolRow[]` · `parseDocs(values: unknown[][]): Map<number, DocStatus>` · `parseNumbers(values: unknown[][]): Omit<SenderNumber, "schoolNo">[]` · `parseChecks(values: unknown[][]): Omit<CheckItem, "schoolNo">[]`
- Produces (`fixtures.ts`, Task 3·5·7·8 재사용): `SCHOOL_HEADER` `DOCS_HEADER` `NUMBER_HEADER` `CHECK_HEADER` · `schoolRow(no, name, over?)` `docsRow(no, name, over?)` `numberRow(no, school, number, over?)` `checkRow(no, kind, target, over?)` (`over` 는 헤더 원문 → 값) · `pdf(folder, school, over?): RawPdf` · `rawSource(over?: Partial<RawSource>): RawSource`

- [ ] **Step 1: 픽스처 작성** — 헤더는 **실측 1행 그대로**(빈 칸 포함 21열):

```ts
const pad = (head: string[]) => [...head, ...Array(20 - head.length).fill(""), "고를 값"];
export const SCHOOL_HEADER = ["No","학교명","구분","원서접수","PIMS","담당자","등록 회선","일괄 등록","추가 등록","서류 미비","최근 등록일","제출 서류 (10/15 기준)","확인","비고","","","","","","","고를 값"];
export const DOCS_HEADER = ["No","학교명","구분","등록 회선\n(03 번호 목록)","세종 등록 상태","신청서","위임장","이용증명원","사업자등록증","법인인감","재직증명서","신분증","위탁계약서","제출 상태\n(10/15 기준)","미제출 서류","","","PDF 주소","","","고를 값"];
export const NUMBER_HEADER = pad(["No","학교명","구분","발신번호","상태","등록일자","제출 서류 (10/15 기준)","비고"]);
export const CHECK_HEADER = pad(["No","유형","대상","내용","근거","할 일"]);
```

기본값: `schoolRow` = 구분 `4년제`, 원서접수 `O`, PIMS `""`, 담당자 `[담당자]`, 등록 회선 2, 일괄 등록 2, 추가 등록 0, 서류 미비 0, 최근 등록일 `"-"`, 제출 서류 `1종 미제출 (신분증)`, 확인 `""`, 비고 `""`, **U(20) = `전문대학`**(구분과 다른 드롭다운 값 — spec §12). `docsRow` = 세종 등록 상태 `등록 완료`, 8종 `O` 단 신분증 `✕`, 제출 상태 `1종 미제출`, 미제출 서류 `신분증`, **P(15) = no, T(19) = `|미제출 있음|`, R(17) = `https://example.invalid/x.pdf`**. `numberRow` = 구분 `4년제`, 상태 `일괄 등록`, 등록일자 `"-"`, 제출 서류 `보완 필요: 신분증`. `pdf(folder, school)` = `name: "(" + school + ") SMS 발신용 대학 전화번호 등록 서류.pdf"`, `webUrl: "https://example.invalid/" + folder + "/" + school`, `lastModifiedDateTime: "2026-10-19T00:47:30Z"`, `size: 1000`. `rawSource()` = 학교 `가나대학교`(1)·`다라대학교`(2)·`마바전문대학`(3, 전문대학), 번호 각 1줄(`02-0000-0001`…), 확인 1줄, PDF `가나대학교`(`완료/제출완료/접수`), criteria `null`, workbook name `SMS 발신번호 사전등록 현황_261017.xlsm`, fetchedAt `2026-10-26T00:05:00Z`.

- [ ] **Step 2: 실패하는 테스트 작성** — `parse.test.ts`:

```ts
describe("normalizeHeader", () => {
  it("둘째 줄과 끝 괄호를 버린다", () => {
    expect(normalizeHeader("제출 서류 (10/15 기준)")).toBe("제출 서류");
    expect(normalizeHeader("등록 회선\n(03 번호 목록)")).toBe("등록 회선");
    expect(normalizeHeader("제출 상태\n(10/15 기준)")).toBe("제출 상태");
    expect(normalizeHeader("  학교명 ")).toBe("학교명");
  });
});
describe("parseSchools", () => {
  it("헤더 이름으로 읽는다 — 고를 값·담당자는 없다", () => {
    expect(parseSchools([SCHOOL_HEADER, schoolRow(1, "가나대학교")])).toEqual([{
      no: 1, name: "가나대학교", gubun: "4년제", apply: true, pims: false, lines: 2, bulk: 2,
      added: 0, deficient: 0, lastRegisteredAt: null, docSummary: "1종 미제출 (신분증)", needsCheck: false, note: "",
    }]);
  });
  it("열이 끼어도 같은 값", …);                 // 헤더·행 모두 index 3 에 "메모" 삽입 → 위와 같은 결과
  it("기준일이 바뀐 헤더도 찾는다", …);          // "제출 서류 (10/30 기준)" 로 바꿔도 docSummary 읽힘
  it("확인 필요 표시", …);                       // 확인 "확인 필요" → needsCheck true
  it("No 가 빈 줄은 건너뛴다", …);               // ["", "", …] 행 → 결과 1건
  it("필수 열이 없으면 시트·열을 담은 오류", () => {
    const head = SCHOOL_HEADER.map((h) => (h === "학교명" ? "대학명" : h));
    expect(() => parseSchools([head])).toThrow("‘_학교’ 시트에서 ‘학교명’ 열을 찾지 못했습니다.");
    try { parseSchools([head]); } catch (e) { expect(e).toBeInstanceOf(SheetShapeError); expect((e as SheetShapeError).column).toBe("학교명"); }
  });
  it("빈 시트는 오류", () => expect(() => parseSchools([])).toThrow("‘_학교’ 시트가 비어 있습니다."));
  it("같은 열 이름이 둘이면 오류", () => …toThrow("‘_학교’ 시트에 ‘비고’ 열이 두 개 있습니다."));  // index 14 를 "비고" 로
});
describe("parseDocs", () => {
  it("No 로 묶고 8종 표시를 원문 그대로", () => {
    const m = parseDocs([DOCS_HEADER, docsRow(1, "가나대학교", { 법인인감: "대체", 위탁계약서: "" })]);
    expect(m.get(1)).toEqual({ sejongStatus: "등록 완료", marks: { 신청서: "O", 위임장: "O", 이용증명원: "O", 사업자등록증: "O", 법인인감: "대체", 재직증명서: "O", 신분증: "✕", 위탁계약서: "" }, submitState: "1종 미제출", completeness: "미비", missing: "신분증" });
  });
  it("제출 상태 → 완비/미비/확인 안 됨", …);    // "모두 제출"→완비, "3종 미제출"→미비, "서류 확인 안 됨"→확인 안 됨, "새 문구"→확인 안 됨
});
describe("parseNumbers", () => {
  it("원문과 숫자만 둘 다", () => {
    const [n] = parseNumbers([NUMBER_HEADER, numberRow(1, "가나대학교", "02-0000-0001", { 등록일자: "2025-10-28" })]);
    expect(n).toMatchObject({ number: "02-0000-0001", digits: "0200000001", status: "일괄 등록", registeredAt: "2025-10-28" });
  });
  it("등록일자가 엑셀 일련번호여도 날짜로", () => {
    const [n] = parseNumbers([NUMBER_HEADER, numberRow(1, "가나대학교", "02-0000-0001", { 등록일자: 45958 })]);
    expect(n.registeredAt).toBe("2025-10-28");
  });
  it("번호 없음 행도 남긴다", …);                 // number "-" 상태 "번호 없음" → digits "", 결과 1건
});
describe("parseChecks", () => {
  it("6열을 읽는다 — 상태 열은 없다", …);         // toEqual({ no, kind, target: "가나대학교\n02-0000-0001", content, basis, todo })
});
```

- [ ] **Step 3: 실패 확인** — `npx vitest run src/features/sms-sender/__tests__/parse.test.ts --maxWorkers=1` → FAIL(모듈 없음).

- [ ] **Step 4: 구현** — `types.ts` 는 Interfaces 그대로. `parse.ts`:
  - `normalizeHeader`: `String(h ?? "")` 의 첫 줄 → 끝의 `\s*\([^)]*\)$` 제거 → 공백 접기 → trim.
  - 내부 `columnIndex(sheet, header, required)`: 정규화한 헤더에서 각 필수 이름의 index. 없음/둘 → `SheetShapeError`. `values.length === 0` → 빈 시트 오류(`column: ""`). 모든 시트의 필수 목록에 `No` 포함, `No` 가 `""`/`null` 인 행은 건너뛴다.
  - 필수 열: `_학교` = No·학교명·구분·원서접수·PIMS·등록 회선·일괄 등록·추가 등록·서류 미비·최근 등록일·제출 서류·확인·비고 / `_서류` = No·학교명·세종 등록 상태·DOC_KINDS 8종·제출 상태·미제출 서류 / `_번호` = No·학교명·구분·발신번호·상태·등록일자·제출 서류·비고 / `_확인` = No·유형·대상·내용·근거·할 일.
  - `apply`/`pims` = 셀 trim 이 `"O"`. 숫자 칸은 `Number()`, NaN → 0. 문자열 칸은 `String(v ?? "").trim()`(대상은 줄바꿈 보존 — 양끝만 trim).
  - `excelDate`: 숫자 → `1899-12-30` + `Math.floor(v)` 일(UTC 계산, `toISOString().slice(0,10)`), `/^\d{4}-\d{2}-\d{2}$/` 문자열 → 그대로, 그 외(`-`, `""`) → `null`.
  - `digitsOf`: `s.replace(/\D/g, "")`.
  - completeness: `"모두 제출"` → 완비, `/미제출/` → 미비, 나머지 → `"확인 안 됨"`.

- [ ] **Step 5: 통과 확인** — Step 3 명령 → PASS.

- [ ] **Step 6: 커밋** — `feat(sms-sender): 숨김 시트 4개를 헤더 이름으로 읽는다`

---

### Task 3: PDF 사본·현황 파일 고르기·조립

**Files:**
- Create: `src/features/sms-sender/aliases.ts`
- Modify: `src/features/sms-sender/parse.ts`
- Test: `src/features/sms-sender/__tests__/parse.test.ts` (describe 추가)

**Interfaces:**
- Consumes: Task 2 의 타입·`parseSchools`·`parseDocs`·`parseNumbers`·`parseChecks`, `fixtures.ts`.
- Produces: `PDF_NAME_ALIASES: Readonly<Record<string, string>>` · `canonicalSchoolName(pdfName: string): string` (aliases.ts) · `pickLatestWorkbook(files: readonly DriveFile[]): { latest: DriveFile | null; offRuleFiles: string[] }` · `pdfSchoolName(fileName: string): string | null` · `stageOf(folder: string): { stage: Stage; sub: string | null }` · `parseSmsSender(raw: RawSource): SmsSenderData` (parse.ts)

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe("pickLatestWorkbook", () => {
  const f = (name: string, lm = "2026-10-17T02:33:20Z") => ({ id: name, name, webUrl: "", size: 1, lastModifiedDateTime: lm });
  it("_YYMMDD.xlsm 중 최신 날짜", () => {
    const r = pickLatestWorkbook([f("SMS 발신번호 사전등록 현황_261015.xlsm", "2026-10-20T00:00:00Z"), f("SMS 발신번호 사전등록 현황_261017.xlsm"), f("03. 학교별 제출 서류")]);
    expect(r.latest?.name).toBe("SMS 발신번호 사전등록 현황_261017.xlsm");
    expect(r.offRuleFiles).toEqual([]);
  });
  it("규칙 밖 .xlsm 은 고르지 않고 따로 센다", …);   // "…_261017(수정).xlsm" → offRuleFiles 에 들어가고 latest 는 _261017
  it("규칙에 맞는 파일이 없으면 null", …);
});
describe("pdfSchoolName", () => {
  it("괄호 안 학교명 — 이름 속 괄호도", () => {
    expect(pdfSchoolName("(가나대학교) SMS 발신용 대학 전화번호 등록 서류.pdf")).toBe("가나대학교");
    expect(pdfSchoolName("((사)가나협회) SMS 발신용 대학 전화번호 등록 서류.pdf")).toBe("(사)가나협회");
    expect(pdfSchoolName("가나대학교.pdf")).toBeNull();
  });
});
describe("stageOf", () => {
  it("경로로 단계를 판정", () => {
    expect(stageOf("완료/제출완료/접수+PIMS")).toEqual({ stage: "제출완료", sub: "접수+PIMS" });
    expect(stageOf("완료/검토완료")).toEqual({ stage: "검토완료", sub: null });
    expect(stageOf("진행 중")).toEqual({ stage: "진행 중", sub: null });
    expect(stageOf("보류")).toEqual({ stage: "기타", sub: null });
  });
});
describe("parseSmsSender", () => {
  it("두 폴더 사본 — 앞선 폴더가 먼저, 둘 다 남는다", () => {
    const d = parseSmsSender(rawSource({ pdfs: [pdf("완료/검토완료", "가나대학교", { lastModifiedDateTime: "2026-10-20T00:00:00Z" }), pdf("완료/제출완료/접수", "가나대학교")] }));
    expect(d.schools.find((s) => s.no === 1)!.pdfs.map((p) => p.stage)).toEqual(["제출완료", "검토완료"]);
  });
  it("별칭으로 PDF 이름을 맞춘다", …);       // 학교 "건국대학교(서울)" + pdf 이름 "건국대학교 서울캠퍼스" → pdfs 1개, unmatchedPdfs []
  it("맞는 학교가 없는 PDF·규칙 밖 이름은 이름 미대조", …);  // pdf "다른대학교" + name "메모.pdf" → unmatchedPdfs 에 두 파일명; ".docx" 는 무시
  it("PDF 가 없는 학교는 pdfs []", …);
  it("_서류 는 No 로 붙는다 — 같은 이름 두 행", …);  // 학교 52 "을지가나대학교"(4년제)·91 "을지가나대학교"(전문대학), docs 각자 → schools[].docs 가 서로 다름
  it("발신번호는 학교명+구분으로 붙는다", …);       // numberRow(…, "을지가나대학교", …, { 구분: "전문대학" }).schoolNo === 91
  it("확인 대상 첫 줄로 학교를 잇는다", () => {
    // "가나대학교\n02-0000-0001" → 1, "가나대학교 (PIMS)" → 1, "세종 리스트 없음" → null, "을지가나대학교" → null(모호)
  });
  it("확인 건수는 _확인 행 수", …);                 // checkRow 3줄 → checks.length 3
  it("05 시트 — 없으면 null, 있으면 빈 줄 뺀 문자열 표", …);  // [["제목","",""],["","",""],["No","서류",1]] → [["제목"],["No","서류","1"]]
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/__tests__/parse.test.ts --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현**
  - `aliases.ts`: spec §7 표 6줄(`연세대학교`→`연세대학교(서울)`, `한양대학교`→`한양대학교(서울)`, `건국대학교 서울캠퍼스`→`건국대학교(서울)`, `건국대학교 글로컬캠퍼스`→`건국대학교(글로컬)`, `동국대학교`→`동국대학교(서울)`, `동국대학교WISE`→`동국대학교(WISE)`), 줄마다 근거 주석. `canonicalSchoolName` = 별칭 있으면 그것, 없으면 원문.
  - `pickLatestWorkbook`: `/\.xlsm$/i` 인 파일 중 `/_(\d{6})\.xlsm$/` 매칭 → 6자리 문자열 내림차순, 같으면 `lastModifiedDateTime` 내림차순. 매칭 안 되는 `.xlsm` → `offRuleFiles`(이름).
  - `pdfSchoolName`: `/^\((.+)\) SMS 발신용 대학 전화번호 등록 서류\.pdf$/i`.
  - `stageOf`: `/` 로 자른 조각 기준. 정렬 순위 제출완료 3 > 검토완료 2 > 진행 중 1 > 기타 0, 같은 순위는 최신 수정 먼저.
  - `parseSmsSender`: 행 파싱 → `_서류` 를 `No` 로 붙임(없으면 `docs: null`) → `.pdf`(대소문자 무시)만 이름 해석·별칭 → 같은 이름의 모든 학교 행에 사본 부착, 붙을 곳 없거나 이름 규칙 밖이면 `unmatchedPdfs`(파일명) → 번호는 `학교명|구분` 키로 `schoolNo`(없으면 null) → 확인 대상 첫 줄 trim, 정확 일치 아니면 끝 `\s+\([^)]*\)$` 를 떼고 다시, **그 이름의 학교가 정확히 한 행일 때만** 잇는다 → criteria 는 셀을 `String`, 끝 빈 칸 제거, 전부 빈 줄 제거.

- [ ] **Step 4: 통과 확인** — Step 2 명령 → PASS.

- [ ] **Step 5: 커밋** — `feat(sms-sender): PDF 사본 단계·별칭·현황 파일 고르기로 조립한다`

---

### Task 4: Graph 읽기 · 10분 캐시 · 새로고침 action

**Files:**
- Create: `src/features/sms-sender/source.ts`, `src/features/sms-sender/queries.ts`, `src/features/sms-sender/actions.ts`
- Test: `src/features/sms-sender/__tests__/source.test.ts`, `…/queries.test.ts`, `…/actions.test.ts`

**Interfaces:**
- Consumes: `getGraphToken()` (`@/lib/microsoft/auth`), `pickLatestWorkbook`·`parseSmsSender`·`SheetShapeError`, `canViewMenu` (`@/features/auth/permission`), `getCurrentOperator` (`@/features/auth/queries`).
- Produces:
  - `source.ts` (`import "server-only"`): `childrenUrl(driveId: string, path: string): string` · `usedRangeUrl(driveId: string, itemId: string, sheet: string): string` · `class SourceFetchError extends Error` · `fetchSmsSenderSource(): Promise<RawSource>`
  - `queries.ts` (`import "server-only"`): `type SmsSenderResult = { ok: true; data: SmsSenderData } | { ok: false; message: string }` · `getSmsSenderData: () => Promise<SmsSenderResult>` (react `cache`) · `__resetSmsSenderCache(): void`
  - `actions.ts` (`"use server"`): `refreshSmsSenderCache(): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: 실패하는 테스트 작성**

`source.test.ts` (`vi.mock("@/lib/microsoft/auth", …)` 는 `payment-dates/__tests__/queries.test.ts` 와 같은 모양, `fetch` 는 URL 로 분기하는 `vi.fn`):

```ts
it("childrenUrl 은 조각마다 인코딩 — + 와 공백", () => {
  const u = childrenUrl("d1", `${SMS_ROOT_PATH}/${DOCS_FOLDER}/완료/제출완료/접수+PIMS`);
  expect(u.startsWith("https://graph.microsoft.com/v1.0/drives/d1/root:/")).toBe(true);
  expect(u).toContain("%2BPIMS");
  expect(u).not.toContain("+PIMS");
  expect(u).not.toContain(" ");
  expect(u).toContain(":/children?");
});
it("usedRangeUrl 은 시트 이름을 인코딩하고 valuesOnly", () => {
  expect(usedRangeUrl("d1", "i1", "_번호")).toContain(`worksheets('${encodeURIComponent("_번호")}')/usedRange(valuesOnly=true)`);
});
it("폴더를 재귀로 훑고 nextLink 를 따라간다", …);  // 루트(xlsm 2개 + 폴더) → 03 → 완료/진행 중 → 하위. 한 응답에 @odata.nextLink. 결과 pdfs 의 folder 가 "완료/제출완료/접수+PIMS" 등, 개수 일치, workbook 이 _261017
it("05 시트 404 는 criteria null — 실패 아님", …);
it("숨김 시트 실패는 SourceFetchError(상태 코드 포함)", …);  // _번호 500 → rejects.toThrow(/_번호.*500/)
it("SHAREPOINT_DRIVE_ID 없으면 SourceFetchError", …);
it("현황 파일이 없으면 SourceFetchError", …);      // 루트에 규칙 맞는 xlsm 없음 → /현황 파일/
```

`queries.test.ts` (`vi.mock("../source", async (orig) => ({ ...(await orig()), fetchSmsSenderSource: vi.fn() }))`, 테스트마다 `vi.resetModules()` + 동적 import, `vi.useFakeTimers()`):

```ts
it("10분 안에는 원천을 다시 읽지 않는다", …);  // 2회 호출 → fetch 1회, 10*60*1000+1 진행 → 3번째 호출에 2회
it("실패는 캐시하지 않는다", …);               // 1회 reject(new SourceFetchError("x")) → { ok: false, message: "x" }, 2회 resolve → ok, fetch 2회
it("헤더 오류는 시트·열 문구로", …);           // _번호 헤더의 "발신번호"→"전화번호" → { ok: false, message: "‘_번호’ 시트에서 ‘발신번호’ 열을 찾지 못했습니다." }
it("__resetSmsSenderCache 뒤에는 다시 읽는다", …);
```

`actions.test.ts` (`vi.mock("@/features/auth/queries")`, `vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))`, `vi.mock("next/navigation", () => ({ redirect: vi.fn() }))`, `vi.mock("../queries", () => ({ __resetSmsSenderCache: vi.fn() }))`):

```ts
it("지정 안 된 member 는 거절, 캐시 유지", async () => {
  getCurrentOperator.mockResolvedValue({ ...member, allowedMenus: ["services"] });
  expect(await refreshSmsSenderCache()).toEqual({ ok: false, error: "권한 없음 — 내부관리자 메뉴를 볼 수 없습니다." });
  expect(__resetSmsSenderCache).not.toHaveBeenCalled();
});
it("비로그인은 거절", …);
it("지정된 member 는 캐시를 비우고 경로를 다시 그린다", …);  // revalidatePath("/dashboard/internal-admin")
it("admin 은 통과", …);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/__tests__/source.test.ts src/features/sms-sender/__tests__/queries.test.ts src/features/sms-sender/__tests__/actions.test.ts --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현**
  - `childrenUrl`: `https://graph.microsoft.com/v1.0/drives/${driveId}/root:/${path.split("/").map(encodeURIComponent).join("/")}:/children?$top=200&$select=id,name,webUrl,size,lastModifiedDateTime,folder,file`.
  - `usedRangeUrl`: `…/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(sheet)}')/usedRange(valuesOnly=true)?$select=values`.
  - 목록은 `@odata.nextLink` 를 끝까지 따른다. `03` 폴더는 재귀(깊이 4 제한), 파일마다 `folder` = `03` 아래 상대 경로.
  - 순서: 루트 목록 → `pickLatestWorkbook`(null → `SourceFetchError("현황 파일(…_YYMMDD.xlsm)을 찾지 못했습니다.")`) → 숨김 시트 4개·05 시트·PDF 목록을 `Promise.all`. 05 시트 404 만 `null`, 그 외 실패는 `SourceFetchError(\`${sheet} 읽기 실패 (${status})\`)` + `console.error`. 모든 fetch `cache: "no-store"`. `fetchedAt = new Date().toISOString()`.
  - `queries.ts`: `payment-dates/queries.ts` 와 같은 모양(`TTL_MS = 10 * 60 * 1000`, `moduleCache: { data; expiresAt } | null`). 성공만 저장. `SheetShapeError`·`SourceFetchError` → 그 `message`, 그 외 → `"현황 파일을 읽지 못했습니다."` + `console.error`.
  - `actions.ts`: `getCurrentOperator()` → `canViewMenu("internal-admin", me)` 아니면 위 거절 문구 → `__resetSmsSenderCache()` → `revalidatePath("/dashboard/internal-admin")`.

- [ ] **Step 4: 통과 확인** — Step 2 명령 → PASS.

- [ ] **Step 5: 커밋** — `feat(sms-sender): Graph 로 현황을 읽고 10분 캐시 + 새로고침`

---

### Task 5: 화면 필터(순수 함수)

**Files:**
- Create: `src/features/sms-sender/filters.ts`
- Test: `src/features/sms-sender/__tests__/filters.test.ts`

**Interfaces:**
- Consumes: Task 2 타입, `fixtures.ts` + `parseSmsSender`(데이터 만들기).
- Produces:
  ```ts
  type Params = Record<string, string | undefined>;
  export type SchoolFilters = { q: string; gubun: string; stage: string; docs: Completeness | ""; checkOnly: boolean; school: number | null };
  export type GubunCard = { gubun: string; schools: number; lines: number; deficient: number; checks: number };
  export type SchoolDetail = { school: School; numbers: SenderNumber[]; checks: CheckItem[] };
  export type NumberFilters = { q: string; status: string; gubun: string; page: number };
  export const GUBUN_ORDER = ["4년제", "전문대학", "대학원", "초중고"] as const;
  export const STAGE_OPTIONS = ["접수", "접수+PIMS", "PIMS", "검토완료", "진행 중", "PDF 없음"] as const;
  export const NUMBER_STATUS_ORDER = ["일괄 등록", "추가 등록", "서류 미비"] as const;
  export const NUMBERS_PAGE_SIZE = 50;
  parseSchoolFilters(sp: Params): SchoolFilters
  stageLabel(s: School): string
  filterSchools(schools: readonly School[], f: SchoolFilters): School[]
  gubunCards(schools: readonly School[]): GubunCard[]
  schoolDetail(data: SmsSenderData, no: number | null): SchoolDetail | null
  parseNumberFilters(sp: Params): NumberFilters
  matchesNumberQuery(n: SenderNumber, q: string): boolean
  filterNumbers(rows: readonly SenderNumber[], f: NumberFilters): SenderNumber[]
  pageSlice<T>(rows: readonly T[], page: number, size: number): T[]
  filterChecks(rows: readonly CheckItem[], kind: string): CheckItem[]
  orderedOptions(values: readonly string[], preferred: readonly string[]): string[]
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
it("parseSchoolFilters — 공백 정리·모르는 값은 비움", () => {
  expect(parseSchoolFilters({ q: " 가나 ", gubun: "4년제", stage: "PIMS", docs: "미비", check: "1", school: "3" }))
    .toEqual({ q: "가나", gubun: "4년제", stage: "PIMS", docs: "미비", checkOnly: true, school: 3 });
  expect(parseSchoolFilters({ docs: "아무거나", school: "abc" })).toMatchObject({ docs: "", school: null });
});
it("stageLabel", …);   // pdfs [] → "PDF 없음", 제출완료/접수+PIMS → "접수+PIMS", 제출완료(sub null) → "제출완료", 검토완료 → "검토완료", 기타 → "기타 폴더"
it("filterSchools — 이름 검색은 공백 무시", …);  // q "가나 대학교" → 가나대학교
it("filterSchools — 단계·서류·확인만", …);       // stage "PDF 없음", docs "확인 안 됨"(docs null 포함), checkOnly
it("gubunCards — 4장 고정 + 있을 때만 기타", () => {
  // 4년제 2곳(회선 2+3, 서류 미비 0+1, 확인 1곳) + 기타 1곳 → 5장, 4년제 { schools: 2, lines: 5, deficient: 1, checks: 1 }, 초중고 0곳 카드도 존재
});
it("matchesNumberQuery — 하이픈·공백 무시, 학교명도", () => {
  // "02-0000-0001": "0200000001" ✓ · "02 0000-0001" ✓ · "0000-0001" ✓ · "가나" ✓(학교) · "0399" ✗ · "" ✓
});
it("filterNumbers — 상태·구분", …);
it("parseNumberFilters — page 는 1 이상 정수", …);  // "abc"→1, "0"→1, "3"→3
it("pageSlice — 범위 밖 page 는 마지막 페이지", () => {
  const rows = Array.from({ length: 120 }, (_, i) => i);
  expect(pageSlice(rows, 3, 50)).toHaveLength(20);
  expect(pageSlice(rows, 999, 50)).toEqual(pageSlice(rows, 3, 50));
  expect(pageSlice([], 5, 50)).toEqual([]);
});
it("schoolDetail — 없는 No·null 은 null, 있으면 번호·확인을 schoolNo 로", …);
it("orderedOptions — 선호 순서 먼저, 데이터에만 있는 값은 뒤에", () => {
  expect(orderedOptions(["번호 없음", "추가 등록", "일괄 등록", "일괄 등록"], NUMBER_STATUS_ORDER))
    .toEqual(["일괄 등록", "추가 등록", "서류 미비", "번호 없음"]);
});
it("filterChecks — 유형", …);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/features/sms-sender/__tests__/filters.test.ts --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현** — 파라미터 이름: 학교 `q gubun stage docs check school`, 번호 `q status gubun page`, 확인 `type`. `matchesNumberQuery`: `t = q.trim()`, 비면 true; `t.replace(/[\s-]/g, "")` 가 `/^\d+$/` 이면 `n.digits.includes(...)`, 아니면 공백 지운 학교명 포함. `filterSchools` 의 서류 판정은 `s.docs?.completeness ?? "확인 안 됨"`. `pageSlice` 는 `Math.min(page, Math.max(1, Math.ceil(len / size)))` 로 자른다.

- [ ] **Step 4: 통과 확인** — Step 2 명령 → PASS.

- [ ] **Step 5: 커밋** — `feat(sms-sender): 학교·발신번호·확인 필요 화면 필터`

---

### Task 6: URL 훅 · 기준 바 · 서류 기준 모달

**Files:**
- Create: `src/app/dashboard/internal-admin/_components/use-set-params.ts`, `…/SourceBar.tsx`, `…/CriteriaModal.tsx`
- Test: `src/app/dashboard/internal-admin/__tests__/use-set-params.test.tsx`, `…/SourceBar.test.tsx`

**Interfaces:**
- Consumes: `refreshSmsSenderCache` (Task 4), `ModalShell`, `kstFormat`.
- Produces:
  - `useSetParams(): (patch: Record<string, string | null>) => void` — 다른 파라미터 보존, `null`/`""` 는 지움, patch 에 `page` 가 없으면 `page` 를 지운다, `router.push(\`${pathname}?${next}\`)`.
  - `useDebouncedSearch(key: string, delayMs = 300): [string, (v: string) => void]`
  - `SourceBar(props: { fileName: string; fetchedAt: string; offRuleFiles: string[]; unmatchedPdfs: string[]; criteria: string[][] | null })`
  - `SourceError({ message }: { message: string })` (SourceBar.tsx 에서 export)
  - `CriteriaModal({ rows, onClose }: { rows: string[][]; onClose: () => void })`

- [ ] **Step 1: 실패하는 테스트 작성** — `next/navigation` 은 `WorkloadControls.test.tsx` 처럼 mock(`push`, `usePathname` → `"/dashboard/internal-admin"`). 쿼리는 `new URLSearchParams(push.mock.calls[0][0].split("?")[1])` 로 읽어 단언.

```ts
it("patch 는 다른 파라미터를 남기고 page 를 지운다", …);  // "tab=schools&page=3&q=가나" + { gubun: "4년제" } → tab·q 유지, gubun "4년제", page null
it("null 은 지우고 page patch 는 남긴다", …);
it("검색은 300ms 뒤 한 번만", …);                          // fake timers: 299ms push 0회, 300ms 1회, q 값
// SourceBar
it("파일 꼬리와 KST 기준 시각", () => {
  render(<SourceBar fileName="SMS 발신번호 사전등록 현황_261017.xlsm" fetchedAt="2026-10-26T00:05:00Z" offRuleFiles={[]} unmatchedPdfs={[]} criteria={null} />);
  expect(screen.getByText("현황 파일 _261017.xlsm · 기준 09:05")).toBeInTheDocument();
});
it("새로고침은 action 을 부르고 실패 문구를 보인다", …);  // mock 이 { ok: false, error: "권한 없음 — …" } → 그 문구
it("서류 기준 — 있으면 모달, 없으면 비활성", …);           // criteria [["No","서류"],["1","발신번호 사전등록 신청서"]] → 클릭 후 셀 텍스트; null → disabled + title "05. 제출 서류 기준 시트를 찾지 못했습니다"
it("원천 경고는 있을 때만", …);                           // offRuleFiles 1 → "규칙 밖 파일 1개", unmatchedPdfs 2 → "이름 미대조 PDF 2개", 0 이면 둘 다 없음
it("버튼은 버튼 호버 표준", …);                           // 새로고침 className 에 "hover:bg-ink" "hover:text-cream"
it("SourceError 는 alert 로 문구를", …);                  // role="alert" + message
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/dashboard/internal-admin/__tests__ --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현** — 기준 문구는 **한 텍스트 노드**: `` `현황 파일 ${tail} · 기준 ${HHmm}` ``, `tail` = 이름의 `/_\d{6}\.xlsm$/` 부분, 시각 = `kstFormat({ hour: "2-digit", minute: "2-digit" })`. 새로고침은 `useTransition` 으로 action 호출(진행 중 disabled). 원천 경고 문구 옆 `<details>` 로 파일명 목록. `CriteriaModal` = `ModalShell size="xl" title="제출 서류 기준"` 안에 행을 그대로 그린 표(가공 없음). `SourceError` = `role="alert"` 박스(`border-line-soft bg-situation-bg`) + 문구 + "xlsm 헤더를 확인하거나 새로고침하세요."

- [ ] **Step 4: 통과 확인** — Step 2 명령 + `npx vitest run src/components/common --maxWorkers=1` → 둘 다 PASS.

- [ ] **Step 5: 커밋** — `feat(internal-admin): 기준 시각·새로고침·서류 기준 바`

---

### Task 7: 학교 탭 + 학교 인스펙터

**Files:**
- Create: `src/app/dashboard/internal-admin/_components/SchoolsTab.tsx`, `…/SchoolInspector.tsx`
- Test: `src/app/dashboard/internal-admin/__tests__/SchoolsTab.test.tsx`, `…/SchoolInspector.test.tsx`

**Interfaces:**
- Consumes: `useSetParams`·`useDebouncedSearch` (Task 6), `GubunCard`·`SchoolFilters`·`SchoolDetail`·`stageLabel`·`STAGE_OPTIONS` (Task 5), `DOC_KINDS` (Task 2), `ListSearch`·`ListSelect`, `InspectorPanel` (`../../_components/inspector/InspectorPanel`), `kstFormat`.
- Produces:
  - `SchoolsTab(props: { cards: GubunCard[]; schools: School[]; filters: SchoolFilters; detail: SchoolDetail | null })` — `schools` 는 페이지가 이미 거른 것
  - `SchoolInspector(props: { detail: SchoolDetail | null; onClose: () => void })`

- [ ] **Step 1: 실패하는 테스트 작성** (`rawSource` + `parseSmsSender` 로 데이터)

```ts
// SchoolsTab
it("구분 카드 — 숫자 한 줄, 누르면 ?gubun", () => {
  // 카드 button name /4년제/, 텍스트 "2곳", "회선 5 · 서류 미비 1 · 확인 1" (한 노드), 클릭 → gubun=4년제
});
it("선택된 카드는 aria-pressed + vermilion, 다시 누르면 해제", …);   // className 에 "border-vermilion" "bg-vermilion/10", 클릭 → gubun null
it("표 — 단계·회선·서류 점·PDF", () => {
  // 가나대학교 행: "접수", 회선 셀 className 에 "tabular-nums", aria-label "신청서 O" … "신분증 ✕" 8개, PDF 링크 href = webUrl, target "_blank", rel "noopener noreferrer"
  // 다라대학교 행: "PDF 없음"
});
it("행 호버·선택 표준", …);                // tr className 에 "hover:bg-line-soft"; filters.school 1 → 그 행 aria-selected true + "bg-vermilion/10"
it("행 클릭 → ?school=No", …);
it("필터 — 단계·서류 select, 확인 필요만", …);  // 단계 select 옵션 = STAGE_OPTIONS, 체크 → check=1, 해제 → null
it("결과 없음 문구", …);                    // schools [] → "조건에 맞는 학교가 없습니다"
// SchoolInspector
it("서류 8종과 미제출 사유", …);
it("사본 둘이면 PDF 링크 둘", …);           // "통합 PDF 열기 · 접수", "통합 PDF 열기 · 검토완료"
it("발신번호 10줄 + 전체 보기 링크", () => {
  // 12줄 → 표시 10, 링크 "발신번호 탭에서 전체 보기 (12)" href = `/dashboard/internal-admin?tab=numbers&q=${encodeURIComponent(name)}&gubun=${encodeURIComponent(gubun)}`
});
it("확인 항목 — 없으면 문구", …);           // "이 학교의 확인 필요 항목이 없습니다"
it("PDF·서류 줄이 없을 때", …);             // pdfs [] → "통합 PDF 없음", docs null → "_서류 시트에 이 학교 줄이 없습니다"
it("닫기 → onClose", …);                    // Escape
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/dashboard/internal-admin/__tests__/SchoolsTab.test.tsx src/app/dashboard/internal-admin/__tests__/SchoolInspector.test.tsx --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현** — 카드는 `<button aria-pressed>` + `border border-line-soft bg-situation-bg p-4 text-left transition-colors hover:border-ink`(선택 시 `border-vermilion bg-vermilion/10`), 큰 숫자 `text-2xl font-bold tabular-nums`. 필터 줄: `ListSearch`(`useDebouncedSearch("q")`, placeholder `학교명 검색`) · `ListSelect` 단계 · `ListSelect` 서류(`완비/미비/확인 안 됨`) · 체크박스 `확인 필요만`. 표 열: 학교명 · 구분 · 단계 · 회선 · 서류 · 확인 · PDF. 서류 점은 `DOC_KINDS` 순서 8칸(`O` → `text-ink`, `✕` → `text-vermilion`, `대체` → `대` `text-muted`, 빈칸 → `·` `text-muted`), 칸마다 `aria-label={\`${kind} ${mark || "없음"}\`}`. 인스펙터 닫기 = `setParams({ school: null })`. 인스펙터 수정일은 `kstFormat({ year: "numeric", month: "2-digit", day: "2-digit" })`.

- [ ] **Step 4: 통과 확인** — Step 2 명령 + `npx vitest run src/components/common --maxWorkers=1` → PASS.

- [ ] **Step 5: 커밋** — `feat(internal-admin): 학교 탭 — 구분 카드·필터·서류 점·인스펙터`

---

### Task 8: 발신번호 탭 + 확인 필요 탭

**Files:**
- Create: `src/app/dashboard/internal-admin/_components/NumbersTab.tsx`, `…/ChecksTab.tsx`
- Test: `src/app/dashboard/internal-admin/__tests__/NumbersTab.test.tsx`, `…/ChecksTab.test.tsx`

**Interfaces:**
- Consumes: `useSetParams`·`useDebouncedSearch`, `NumberFilters`·`NUMBERS_PAGE_SIZE`, `ListSearch`·`ListSelect`·`ListPagination`.
- Produces:
  - `NumbersTab(props: { rows: SenderNumber[]; total: number; filters: NumberFilters; statusOptions: string[]; gubunOptions: string[] })` — `rows` 는 현재 페이지, `total` 은 거른 뒤 건수
  - `ChecksTab(props: { rows: CheckItem[]; total: number; kind: string; kindOptions: string[] })` — `total` 은 `_확인` 전체 행 수

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// NumbersTab
it("머리글 순서", …);                 // columnheader 텍스트 = ["발신번호","학교","상태","등록일","제출 서류","비고"]
it("숫자·날짜 표기", …);              // 번호 셀 "tabular-nums", registeredAt null → "–"
it("서류 미비 상태는 vermilion", …);
it("검색창 placeholder 와 디바운스", …);  // placeholder "발신번호 또는 학교명 — 하이픈 없이도", 300ms 뒤 q
it("상태·구분 select 는 받은 옵션", …);
it("건수와 페이지네이션", …);          // "120건" 텍스트, total 120 → "1 / 3"
it("결과 없음 문구", …);              // "조건에 맞는 발신번호가 없습니다"
// ChecksTab
it("머리글과 건수", …);               // ["유형","대상","내용","근거","할 일"], "확인 필요 23건"(total)
it("학교로 이어지는 대상은 링크", …);  // schoolNo 1 → link href "/dashboard/internal-admin?tab=schools&school=1", 텍스트 = 대상 첫 줄
it("이어지지 않는 대상은 줄바꿈 보존 텍스트", …);  // className 에 "whitespace-pre-line"
it("유형 select → ?type", …);
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/dashboard/internal-admin/__tests__/NumbersTab.test.tsx src/app/dashboard/internal-admin/__tests__/ChecksTab.test.tsx --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현** — 표 머리글·행은 Global Constraints 표준. 발신번호 탭 검색창은 큰 `ListSearch`(`className="max-w-xl"`). `ListPagination total={total} pageSize={NUMBERS_PAGE_SIZE}`. 확인 탭 링크 아래 줄(번호 등)은 링크 밖 `whitespace-pre-line` 텍스트.

- [ ] **Step 4: 통과 확인** — Step 2 명령 + `npx vitest run src/components/common --maxWorkers=1` → PASS.

- [ ] **Step 5: 커밋** — `feat(internal-admin): 발신번호·확인 필요 탭`

---

### Task 9: 페이지 연결 · 헤드라인 · 최종 검증

**Files:**
- Create: `src/app/dashboard/internal-admin/page.tsx`, `src/app/dashboard/internal-admin/__tests__/page.test.ts`
- Modify: `src/app/dashboard/_data/page-meta-config.ts` (`"work-assignment"` 항목 뒤)
- Test: `src/app/dashboard/_data/__tests__/internal-admin-menu.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: Task 1–8 전부, `findSidebarMeta`, `resolvePageMeta`, `PageHeader`, `PageTabs`, `ProjectPattern`, `getPatternMockData`·`ProjectMockData`, `requireMenu`.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `internal-admin-menu.test.ts`: `PAGE_META["internal-admin"]` 가 `{ headline: { accent: "프로젝트", title: "내부관리자" } }` 를 포함.
  - `page.test.ts` (`work-assignment/__tests__/tabs.test.ts`·`route-move.test.ts` 처럼 주석 지운 원문 대조):

```ts
it("탭 이름·순서 — 추가 제출은 없다", () => {
  expect(declaredTabs()).toEqual([
    { key: "overview", label: "개요" }, { key: "schools", label: "학교" },
    { key: "numbers", label: "발신번호" }, { key: "checks", label: "확인 필요" },
  ]);
  expect(SRC).not.toContain("추가 제출");
});
it("기본 탭은 학교", () => expect(SRC).toMatch(/return hit \? hit\.key : "schools"/));
it('가드는 requireMenu("internal-admin") 하나', () => {
  expect(SRC).toMatch(/const slug = "internal-admin"/);
  expect(SRC).toMatch(/requireMenu\(slug\)/);
  expect(SRC).not.toMatch(/permission\s*[=!]==?\s*["']admin["']/);
});
it("원천 실패는 오류 화면", () => expect(SRC).toMatch(/<SourceError/));
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/app/dashboard/internal-admin/__tests__/page.test.ts src/app/dashboard/_data/__tests__/internal-admin-menu.test.ts --maxWorkers=1` → FAIL.

- [ ] **Step 3: 구현**
  - `page-meta-config.ts`: `"internal-admin": { headline: { accent: "프로젝트", title: "내부관리자" }, description: "SMS 발신번호 사전등록 현황을 학교·발신번호·확인 필요 항목으로 찾아봅니다." }`.
  - `page.tsx` (`searchParams: Promise<Record<string, string | undefined>>`): `requireMenu(slug)` → `findSidebarMeta` → `TABS`(href `/dashboard/internal-admin?tab=…`) + `parseTab`(기본 `schools`) → 헤더(`PageHeader`) + `PageTabs`.
    - `overview`: `<ProjectPattern title={meta.label} data={getPatternMockData(slug, "project") as ProjectMockData} header={<>{header}{tabs}</>} />` — Graph 안 읽음.
    - 그 외: `await getSmsSenderData()` → `!ok` 면 헤더 + 탭 + `<SourceError message>`. `ok` 면 헤더 + 탭 + `SourceBar` + `<section className="p-7">` 에 탭별:
      - schools: `filters = parseSchoolFilters(sp)` → `SchoolsTab cards={gubunCards(data.schools)} schools={filterSchools(data.schools, filters)} detail={schoolDetail(data, filters.school)}`
      - numbers: `f = parseNumberFilters(sp)`, `rows = filterNumbers(data.numbers, f)` → `NumbersTab rows={pageSlice(rows, f.page, NUMBERS_PAGE_SIZE)} total={rows.length}`, 옵션은 `orderedOptions(… NUMBER_STATUS_ORDER)` / `orderedOptions(… GUBUN_ORDER)`
      - checks: `ChecksTab rows={filterChecks(data.checks, sp.type ?? "")} total={data.checks.length}`, 옵션 `orderedOptions(kinds, [])`
  - 파일 머리 주석: 가드가 라우트 하나인 이유(지정자 집합 + `canViewMenu`), 개요가 Graph 를 안 읽는 이유.

- [ ] **Step 4: 통과 확인** — Step 2 명령 → PASS.

- [ ] **Step 5: 정적 검사** — `next-env.d.ts` 가 없으면 먼저 `npx next typegen`.
  - `npm run typecheck` → exit 0
  - `npx eslint src/features/sms-sender src/app/dashboard/internal-admin src/features/auth src/app/dashboard/_data` → 0 errors

- [ ] **Step 6: 관련 테스트 묶음** — 소비처는 grep 으로: `grep -rl "sidebar-helpers\|features/auth/permission\|features/sms-sender" src` 의 테스트 디렉터리 + 아래.
  Run: `npx vitest run src/features/sms-sender src/app/dashboard/internal-admin src/features/auth src/app/dashboard/_data src/app/dashboard/__tests__ src/features/operators src/features/assistant src/app/dashboard/work-assignment/__tests__/route-move.test.ts src/components/common --maxWorkers=1`
  Expected: 0 failed.

- [ ] **Step 7: 실데이터 대조(읽기 전용, 1회용)** — 워크트리 루트에 `_diag-sms-sender.test.ts`: `vi.mock("server-only", () => ({}))`, `..\OPS-Console\.env.local` 을 읽어 `AZURE_AD_*`·`SHAREPOINT_DRIVE_ID` 만 `process.env` 에 넣고 `parseSmsSender(await fetchSmsSenderSource())`. **건수만** 스크래치패드 파일에 쓴다(이름·번호 출력 금지). `npx vitest run _diag-sms-sender.test.ts --maxWorkers=1`. 기대(2026-10-26 실측): 학교 101 · 발신번호 595 · 확인 23 · PDF 사본 131(학교 88) · `pdfs.length === 0` 인 학교 13 = `docs.completeness === "확인 안 됨"` 13, 둘이 어긋나는 학교 0 · `unmatchedPdfs` 0 · `offRuleFiles` 0 · 현황 파일 꼬리 `_261017.xlsm`(또는 더 새것) · `schoolNo` 가 붙은 확인 항목 11. 값이 다르면 멈추고 보고. **끝나면 diag 파일 삭제**(`git status` 에 안 남게).

- [ ] **Step 8: 커밋** — `feat(internal-admin): 내부관리자 페이지 — SMS 발신번호 현황 탭 연결`

- [ ] **Step 9: 보안 리뷰 요청(spec §9)** — security-reviewer 에 `permission.ts`·`sidebar-helpers.ts`·`actions.ts`·마이그레이션 diff 를 넘긴다(질문: 지정자 집합 밖 메뉴 판정이 그대로인가, `allowedMenus` 가 admin 전용을 열 수 있는가, action 이 라우트 가드 없이 열리는가).

- [ ] **Step 10: 머지 전후 DB 절차(사용자 승인 하, 코드 밖)** — 머지 **전**: Supabase SQL Editor 에 `20261026_internal_admin_menu_revoke.sql` 적용 → `select count(*) from operators where 'internal-admin' = any(allowed_menus);` = 0 확인(지금 코드는 `allowedMenus` 를 안 보므로 선적용해도 영향 없음). 머지 **후**: 지정자마다 `update operators set allowed_menus = array_append(allowed_menus, 'internal-admin') where email = '<지정자>' and not ('internal-admin' = any(allowed_menus));` — `scripts/toggle-allowed-menus.mjs` 는 배열을 통째로 바꾸므로 쓰지 않는다. 지정자 계정으로 메뉴 보임 / 미지정 계정으로 주소 직접 열면 `/dashboard` 로 튕김, 둘 다 확인.

---

## Self-Review

1. **Spec coverage** — §5 라우트·탭·권한 3곳: Task 1(사이드바·라우트 판정), Task 4(action 재판정), Task 9(라우트). §6.0 기준 바·새로고침·서류 기준: Task 6. §6.1 개요: Task 9. §6.2 학교: Task 5·7. §6.3 발신번호: Task 5·8. §6.4 확인 필요(행 수로 셈, 첫 줄 링크): Task 3·8. §7 데이터 계층·별칭·헤더 오류 화면: Task 2–4, 9. §9 security-reviewer: Task 9 Step 9. §11 DB 부여·확인: Task 9 Step 10. §12 규칙 밖 파일 표시: Task 3·6, `고를 값` 열: Task 2 픽스처. 빈 곳 없음.
2. **Step scan** — 테스트 단계는 이름·단언·값을 적었고, 같은 모양이 되풀이되는 케이스는 입력→기대값 한 줄로 줄였다. 코드 단계는 시그니처와 스펙 값만, 본문은 정규식·정렬 순위처럼 테스트가 정하지 못하는 부분만 적었다.
3. **Type consistency** — `SchoolRow`(Task 2) → `School`(Task 3) → `SchoolFilters`·`SchoolDetail`(Task 5) → `SchoolsTab` props(Task 7) 이름 일치. `RawPdf.folder` 를 `stageOf(folder)`·`PdfCopy.folder` 에서 같은 이름으로 씀. `refreshSmsSenderCache`·`__resetSmsSenderCache`·`getSmsSenderData` 가 Task 4·6·9 에서 같은 이름.
4. **Review Focus** — 다섯 줄 모두 소유 Task 에 테스트가 있다(1·2 → Task 2, 3 → Task 4, 4 → Task 3, 5 → Task 5).
5. **Proportion** — 스펙 174줄 대비 계획 약 690줄(약 4배). 늘어난 몫은 테스트 단언·실측 헤더 원문·인터페이스 시그니처이고 함수 본문은 없다(정규식·정렬 순위·URL 모양만). 실측 헤더는 이 계획만 가진 정보라 줄이지 않았다.
