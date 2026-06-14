# 회의록(Meeting Minutes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영부 회의록을 유형(5종) 선택 → 노션형 블록 에디터로 작성하고, PDF 생성·메일 발송·SharePoint 업로드까지 지원하는 신규 메뉴를 만든다.

**Architecture:** 경위서(incident-reports) 패턴을 본떠 list-variant 기반 목록 + `/dashboard/meetings/[id]` 편집 워크스페이스. 메타(제목/일시/장소/참석자)는 DB 컬럼, 본문은 BlockNote 블록 JSON(`content`)으로 분리한 하이브리드. PDF는 블록→react-pdf 순수 매퍼로 변환(기존 react-pdf 스택 유지). 승인절차·시행번호 채번·incidents 종속은 제외.

**Tech Stack:** Next.js App Router, TypeScript, Supabase(@supabase/ssr + admin), zod, BlockNote(@blocknote/core·react·mantine), @react-pdf/renderer, Microsoft Graph(drive-upload·sendMail), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-14-meeting-minutes-design.md`
**Branch:** `feat/meeting-minutes`

---

## File Structure

**신규 생성**
- `supabase/migrations/20260614_meetings.sql` — meetings 테이블 + 인덱스 + updated_at 트리거
- `supabase/migrations/20260614b_meetings_rls.sql` — RLS + GRANT
- `supabase/migrations/20260614c_meeting_mail_sends.sql` — 발송 이력 테이블 + RLS
- `src/features/meetings/schemas.ts` — type/status enum, 라벨맵, zod row schema
- `src/features/meetings/templates.ts` — `buildSeedBlocks(type)` 시드 블록 빌더
- `src/features/meetings/pdf-model.ts` — `blocksToPdfModel(blocks)` 블록→PDF 데이터 매퍼(순수)
- `src/features/meetings/queries.ts` — `listMeetings`, `getMeeting`
- `src/features/meetings/actions.ts` — create/updateMeta/saveContent/delete/revokeSend 서버액션
- `src/features/meetings/mail-actions.ts` — `sendMeetingMinutes`
- `src/lib/pdf/meeting-pdf.tsx` — `renderMeetingPdf(model)` react-pdf 렌더러
- `src/app/api/meetings/[id]/pdf/route.ts` — PDF API
- `src/app/dashboard/meetings/page.tsx` — 목록 + "새 회의록"
- `src/app/dashboard/meetings/[id]/page.tsx` — 편집 워크스페이스(서버, 가드)
- `src/app/dashboard/meetings/[id]/_components/MeetingEditorWorkspace.tsx` — 메타 헤더 + 에디터 + 액션
- `src/app/dashboard/meetings/_components/MeetingEditor.tsx` — BlockNote 래퍼(dynamic ssr:false) + 자동저장
- `src/app/dashboard/meetings/_components/NewMeetingButton.tsx` — 유형 선택 모달
- `src/app/dashboard/_components/inspector/list-variants/meetings/{Table,View,EditForm,filters,status}.tsx|ts`
- 각 feature/variant `__tests__`

**수정**
- `src/app/dashboard/_components/inspector/list-variants/registry.ts` — import + `"meetings"` 등록
- `src/app/dashboard/_components/inspector/list-variants/types.ts:5` — Variant union에 `"meetings"` 추가
- `src/app/dashboard/settings/_env.ts` — `SHAREPOINT_MEETINGS_FOLDER_ID` 등록
- `package.json` — BlockNote 의존성
- (`_data.ts`의 `meetings` slug는 이미 존재 — 변경 불필요)

---

## Task 0: BlockNote 의존성 설치

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 설치**

Run: `npm install @blocknote/core @blocknote/react @blocknote/mantine`
Expected: 3개 패키지가 dependencies에 추가, 설치 성공.

- [ ] **Step 2: 블록 JSON 형태 확인(계약 고정)**

BlockNote 블록의 런타임 형태를 확인한다. 본 계획의 매퍼/시드는 아래 형태를 계약으로 가정한다:
```ts
// Block
{ id: string; type: "paragraph"|"heading"|"bulletListItem"|"numberedListItem"|"checkListItem"|"table";
  props: { level?: 1|2|3; checked?: boolean; [k:string]: unknown };
  content: InlineText[] | { type:"tableContent"; rows: { cells: InlineText[][] }[] };
  children: Block[] }
// InlineText
{ type:"text"; text:string; styles: { bold?:boolean; italic?:boolean; underline?:boolean; strike?:boolean } }
```
설치 후 `@blocknote/core`의 `Block`/`PartialBlock` 타입과 위 형태가 일치하는지 타입으로 확인(불일치 시 Task 3·4의 shape를 실제에 맞춰 조정).

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: 통과(에러 0).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(meetings): BlockNote 에디터 의존성 추가"
```

---

## Task 1: DB 마이그레이션 (meetings + mail_sends + RLS)

**Files:**
- Create: `supabase/migrations/20260614_meetings.sql`
- Create: `supabase/migrations/20260614b_meetings_rls.sql`
- Create: `supabase/migrations/20260614c_meeting_mail_sends.sql`

- [ ] **Step 1: meetings 테이블 마이그레이션 작성**

`supabase/migrations/20260614_meetings.sql`:
```sql
-- meetings — 회의록 도메인. 유형(템플릿) 선택 → 노션형 블록 본문(content jsonb).
-- 경위서 패턴 기반이나 승인체인·시행번호·incidents 종속 제외.

begin;

create table if not exists public.meetings (
  id            uuid primary key default gen_random_uuid(),
  type          text not null
                check (type in ('regular','field','project','memo','urgent')),
  title         text not null default '제목 없음',
  meeting_date  timestamptz,
  location      text,
  attendees     jsonb not null default '[]',
  author_email  text not null,
  status        text not null default 'draft'
                check (status in ('draft','sent')),
  content       jsonb not null default '[]',
  sharepoint_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists meetings_type_idx       on public.meetings (type);
create index if not exists meetings_status_idx      on public.meetings (status);
create index if not exists meetings_created_at_idx  on public.meetings (created_at desc);
create index if not exists meetings_author_idx      on public.meetings (author_email);

drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at
before update on public.meetings
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 2: RLS 마이그레이션 작성**

`supabase/migrations/20260614b_meetings_rls.sql`:
```sql
-- meetings RLS + GRANT. read 전원 / insert 전원 / update·delete 작성자 본인 또는 admin operator.

begin;

alter table public.meetings enable row level security;

drop policy if exists meetings_read on public.meetings;
create policy meetings_read on public.meetings
  for select to authenticated using (true);

drop policy if exists meetings_insert on public.meetings;
create policy meetings_insert on public.meetings
  for insert to authenticated with check (true);

drop policy if exists meetings_update on public.meetings;
create policy meetings_update on public.meetings
  for update to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email' and o.permission = 'admin'
    )
  );

drop policy if exists meetings_delete on public.meetings;
create policy meetings_delete on public.meetings
  for delete to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (
      select 1 from public.operators o
      where o.email = auth.jwt() ->> 'email' and o.permission = 'admin'
    )
  );

grant select, insert, update, delete on public.meetings to authenticated;

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 3: 발송 이력 테이블 마이그레이션 작성**

`supabase/migrations/20260614c_meeting_mail_sends.sql`:
```sql
-- meeting_mail_sends — 회의록 발송 이력. insert는 service_role(server only), read 전원.

begin;

create table if not exists public.meeting_mail_sends (
  id            uuid primary key default gen_random_uuid(),
  meeting_id    uuid references public.meetings(id) on delete cascade,
  sent_by_email text not null,
  recipients    jsonb not null default '[]',
  subject       text not null,
  status        text not null default 'sent'
                check (status in ('sent','dry_run','failed')),
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists meeting_mail_sends_meeting_idx on public.meeting_mail_sends (meeting_id);

alter table public.meeting_mail_sends enable row level security;

drop policy if exists meeting_mail_sends_read on public.meeting_mail_sends;
create policy meeting_mail_sends_read on public.meeting_mail_sends
  for select to authenticated using (true);

grant select on public.meeting_mail_sends to authenticated;

notify pgrst, 'reload schema';

commit;
```

- [ ] **Step 4: 마이그레이션 적용**

Supabase CLI 없음 → `DATABASE_URL`(풀러)로 인라인 적용:
```bash
DB=$(grep -E "^DATABASE_URL=" .env.local | head -1 | cut -d= -f2- | tr -d '"')
node -e 'const{Client}=require("pg");const fs=require("fs");(async()=>{const c=new Client({connectionString:process.env.DBURL,ssl:{rejectUnauthorized:false}});await c.connect();for(const f of ["20260614_meetings.sql","20260614b_meetings_rls.sql","20260614c_meeting_mail_sends.sql"]){await c.query(fs.readFileSync("supabase/migrations/"+f,"utf8"));console.log("applied",f);}await c.end();})().catch(e=>{console.error(e.message);process.exit(1)})' 
```
(DBURL 환경변수로 위 `$DB` 전달: `DBURL="$DB" node -e '...'`)
Expected: `applied 20260614_meetings.sql` 등 3줄.

- [ ] **Step 5: 적용 검증 (테이블·RLS 존재)**

```bash
DBURL="$DB" node -e 'const{Client}=require("pg");(async()=>{const c=new Client({connectionString:process.env.DBURL,ssl:{rejectUnauthorized:false}});await c.connect();const t=await c.query("select count(*)::int n from public.meetings");const r=await c.query("select relrowsecurity from pg_class where relname=$1",["meetings"]);console.log("meetings rows:",t.rows[0].n,"rls:",r.rows[0].relrowsecurity);await c.end();})()'
```
Expected: `meetings rows: 0 rls: true`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260614_meetings.sql supabase/migrations/20260614b_meetings_rls.sql supabase/migrations/20260614c_meeting_mail_sends.sql
git commit -m "feat(meetings): meetings·meeting_mail_sends 테이블 + RLS 마이그레이션"
```

---

## Task 2: schemas.ts (유형/상태 enum + zod)

**Files:**
- Create: `src/features/meetings/schemas.ts`
- Test: `src/features/meetings/__tests__/schemas.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/features/meetings/__tests__/schemas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  MEETING_TYPES, MEETING_TYPE_LABELS, MEETING_STATUS_LABELS, meetingRowSchema,
} from "../schemas";

describe("meeting enums", () => {
  it("유형 5종 + 한글 라벨", () => {
    expect(MEETING_TYPES).toEqual(["regular","field","project","memo","urgent"]);
    expect(MEETING_TYPE_LABELS.field).toBe("외근·출장 보고");
  });
  it("상태 라벨", () => {
    expect(MEETING_STATUS_LABELS.draft).toBe("작성중");
    expect(MEETING_STATUS_LABELS.sent).toBe("발송완료");
  });
});

describe("meetingRowSchema", () => {
  const valid = {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    type: "field", title: "부산대 미팅", meeting_date: "2026-06-14T04:30:00Z",
    location: "부산대", attendees: ["송영신"], author_email: "a@b.com",
    status: "draft", content: [], sharepoint_url: null,
    created_at: "2026-06-14T00:00:00Z", updated_at: "2026-06-14T00:00:00Z",
  };
  it("정상 파싱", () => { expect(meetingRowSchema.safeParse(valid).success).toBe(true); });
  it("잘못된 type 거부", () => {
    expect(meetingRowSchema.safeParse({ ...valid, type: "x" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/meetings/__tests__/schemas.test.ts`
Expected: FAIL (모듈 없음).

- [ ] **Step 3: schemas.ts 구현**

`src/features/meetings/schemas.ts`:
```ts
import { z } from "zod";

export const MEETING_TYPES = ["regular","field","project","memo","urgent"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_TYPE_LABELS: Record<MeetingType, string> = {
  regular: "정기회의",
  field: "외근·출장 보고",
  project: "프로젝트·킥오프",
  memo: "1:1·간단 메모",
  urgent: "긴급·이슈 대응",
};

export const MEETING_STATUSES = ["draft","sent"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  draft: "작성중",
  sent: "발송완료",
};

export const meetingRowSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(MEETING_TYPES),
  title: z.string(),
  meeting_date: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  attendees: z.array(z.string()).default([]),
  author_email: z.string(),
  status: z.enum(MEETING_STATUSES),
  content: z.array(z.unknown()).default([]),
  sharepoint_url: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type MeetingRow = z.infer<typeof meetingRowSchema>;

/** 메타 편집 입력(제목/일시/장소/참석자). */
export const meetingMetaSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요"),
  meeting_date: z.string().nullable(),
  location: z.string().nullable(),
  attendees: z.array(z.string()),
});
export type MeetingMetaInput = z.infer<typeof meetingMetaSchema>;
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/meetings/__tests__/schemas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/schemas.ts src/features/meetings/__tests__/schemas.test.ts
git commit -m "feat(meetings): 유형/상태 enum + zod row schema"
```

---

## Task 3: templates.ts (buildSeedBlocks)

**Files:**
- Create: `src/features/meetings/templates.ts`
- Test: `src/features/meetings/__tests__/templates.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/features/meetings/__tests__/templates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildSeedBlocks, MEETING_SEED_HEADINGS } from "../templates";

describe("buildSeedBlocks", () => {
  it("외근·출장 보고 시드 섹션", () => {
    expect(MEETING_SEED_HEADINGS.field).toEqual(["목적","면담 내용","결과·후속조치"]);
  });
  it("각 헤딩은 heading 블록 + 빈 후속 블록을 만든다", () => {
    const blocks = buildSeedBlocks("memo");
    // memo = ["메모","액션아이템"] → heading 2개 이상 존재
    const headings = blocks.filter((b) => b.type === "heading").map((b) => b.content);
    expect(headings).toEqual(["메모","액션아이템"]);
  });
  it("액션아이템 헤딩 뒤에는 checkListItem 시드", () => {
    const blocks = buildSeedBlocks("regular");
    const idx = blocks.findIndex((b) => b.type === "heading" && b.content === "액션아이템");
    expect(blocks[idx + 1]?.type).toBe("checkListItem");
  });
  it("결과·후속조치 헤딩 뒤에도 checkListItem", () => {
    const blocks = buildSeedBlocks("field");
    const idx = blocks.findIndex((b) => b.type === "heading" && b.content === "결과·후속조치");
    expect(blocks[idx + 1]?.type).toBe("checkListItem");
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/meetings/__tests__/templates.test.ts`
Expected: FAIL.

- [ ] **Step 3: templates.ts 구현**

`src/features/meetings/templates.ts`:
```ts
import type { MeetingType } from "./schemas";

/** 유형별 시드 섹션 헤딩(순서대로). */
export const MEETING_SEED_HEADINGS: Record<MeetingType, string[]> = {
  regular: ["안건","논의 내용","결정사항","액션아이템"],
  field: ["목적","면담 내용","결과·후속조치"],
  project: ["목표","범위","일정","R&R","리스크"],
  memo: ["메모","액션아이템"],
  urgent: ["상황","영향","조치","결정"],
};

/** 체크리스트로 시작하는 게 자연스러운 섹션(액션/후속). */
const CHECK_SECTIONS = new Set(["액션아이템","결과·후속조치"]);

/**
 * BlockNote PartialBlock[] 시드. heading(level 2) + 그 아래 빈 블록(단락 또는 체크) 1개씩.
 * 반환 타입은 BlockNote에 그대로 initialContent로 전달 가능한 최소 형태.
 */
export type SeedBlock =
  | { type: "heading"; props: { level: 2 }; content: string }
  | { type: "paragraph"; content: "" }
  | { type: "checkListItem"; content: "" };

export function buildSeedBlocks(type: MeetingType): SeedBlock[] {
  const out: SeedBlock[] = [];
  for (const heading of MEETING_SEED_HEADINGS[type]) {
    out.push({ type: "heading", props: { level: 2 }, content: heading });
    out.push(
      CHECK_SECTIONS.has(heading)
        ? { type: "checkListItem", content: "" }
        : { type: "paragraph", content: "" },
    );
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/meetings/__tests__/templates.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/templates.ts src/features/meetings/__tests__/templates.test.ts
git commit -m "feat(meetings): 유형별 시드 블록 빌더(buildSeedBlocks)"
```

---

## Task 4: pdf-model.ts (블록→PDF 데이터 매퍼, 순수)

가장 핵심적인 순수 유닛. BlockNote 블록 JSON을 react-pdf 렌더가 소비할 평탄한 데이터 모델로 변환한다. 렌더링과 분리해 단위 테스트 가능하게 한다.

**Files:**
- Create: `src/features/meetings/pdf-model.ts`
- Test: `src/features/meetings/__tests__/pdf-model.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/features/meetings/__tests__/pdf-model.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { blocksToPdfModel } from "../pdf-model";

describe("blocksToPdfModel", () => {
  it("heading → kind heading + level + 텍스트 런", () => {
    const m = blocksToPdfModel([
      { id:"1", type:"heading", props:{ level:2 }, content:[{ type:"text", text:"목적", styles:{} }], children:[] },
    ]);
    expect(m).toEqual([{ kind:"heading", level:2, runs:[{ text:"목적", bold:false, italic:false }] }]);
  });
  it("paragraph 인라인 bold/italic 보존", () => {
    const m = blocksToPdfModel([
      { id:"2", type:"paragraph", props:{}, content:[
        { type:"text", text:"중요 ", styles:{ bold:true } },
        { type:"text", text:"기울임", styles:{ italic:true } },
      ], children:[] },
    ]);
    expect(m[0]).toEqual({ kind:"paragraph", runs:[
      { text:"중요 ", bold:true, italic:false },
      { text:"기울임", bold:false, italic:true },
    ]});
  });
  it("bulletListItem / numberedListItem / checkListItem", () => {
    const m = blocksToPdfModel([
      { id:"3", type:"bulletListItem", props:{}, content:[{ type:"text", text:"불릿", styles:{} }], children:[] },
      { id:"4", type:"numberedListItem", props:{}, content:[{ type:"text", text:"번호", styles:{} }], children:[] },
      { id:"5", type:"checkListItem", props:{ checked:true }, content:[{ type:"text", text:"완료", styles:{} }], children:[] },
    ]);
    expect(m[0].kind).toBe("bullet");
    expect(m[1].kind).toBe("numbered");
    expect(m[2]).toMatchObject({ kind:"check", checked:true });
  });
  it("미지원 블록은 plain 텍스트로 폴백(런 추출)", () => {
    const m = blocksToPdfModel([
      { id:"6", type:"weirdEmbed", props:{}, content:[{ type:"text", text:"폴백", styles:{} }], children:[] },
    ]);
    expect(m).toEqual([{ kind:"paragraph", runs:[{ text:"폴백", bold:false, italic:false }] }]);
  });
  it("빈 content는 빈 런 배열", () => {
    const m = blocksToPdfModel([{ id:"7", type:"paragraph", props:{}, content:[], children:[] }]);
    expect(m[0]).toEqual({ kind:"paragraph", runs:[] });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/meetings/__tests__/pdf-model.test.ts`
Expected: FAIL.

- [ ] **Step 3: pdf-model.ts 구현**

`src/features/meetings/pdf-model.ts`:
```ts
/** PDF 렌더가 소비하는 평탄 모델. react-pdf 렌더와 분리(단위 테스트 가능). */
export type PdfRun = { text: string; bold: boolean; italic: boolean };
export type PdfNode =
  | { kind: "heading"; level: 1 | 2 | 3; runs: PdfRun[] }
  | { kind: "paragraph"; runs: PdfRun[] }
  | { kind: "bullet"; runs: PdfRun[] }
  | { kind: "numbered"; runs: PdfRun[] }
  | { kind: "check"; checked: boolean; runs: PdfRun[] };

type InlineText = { type: string; text?: string; styles?: { bold?: boolean; italic?: boolean } };
type Block = { type: string; props?: Record<string, unknown>; content?: unknown; children?: Block[] };

function toRuns(content: unknown): PdfRun[] {
  if (!Array.isArray(content)) return [];
  return content
    .filter((c): c is InlineText => !!c && typeof c === "object" && (c as InlineText).type === "text")
    .map((c) => ({
      text: c.text ?? "",
      bold: c.styles?.bold === true,
      italic: c.styles?.italic === true,
    }));
}

/** BlockNote 블록 배열 → PdfNode 배열. 기본 블록만 매핑, 그 외는 paragraph 폴백. */
export function blocksToPdfModel(blocks: Block[]): PdfNode[] {
  const out: PdfNode[] = [];
  for (const b of blocks ?? []) {
    const runs = toRuns(b.content);
    switch (b.type) {
      case "heading": {
        const lvl = b.props?.level;
        const level = (lvl === 1 || lvl === 2 || lvl === 3 ? lvl : 2) as 1 | 2 | 3;
        out.push({ kind: "heading", level, runs });
        break;
      }
      case "bulletListItem":
        out.push({ kind: "bullet", runs });
        break;
      case "numberedListItem":
        out.push({ kind: "numbered", runs });
        break;
      case "checkListItem":
        out.push({ kind: "check", checked: b.props?.checked === true, runs });
        break;
      case "paragraph":
        out.push({ kind: "paragraph", runs });
        break;
      default:
        // 미지원 블록 → plain 텍스트 폴백(런이 있으면 단락으로)
        out.push({ kind: "paragraph", runs });
    }
    // 중첩 children(목록 내부 등)은 평탄화하여 이어붙임
    if (Array.isArray(b.children) && b.children.length > 0) {
      out.push(...blocksToPdfModel(b.children));
    }
  }
  return out;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/meetings/__tests__/pdf-model.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/meetings/pdf-model.ts src/features/meetings/__tests__/pdf-model.test.ts
git commit -m "feat(meetings): 블록→PDF 데이터 매퍼(blocksToPdfModel)"
```

---

## Task 5: queries.ts (목록/단건 조회)

**Files:**
- Create: `src/features/meetings/queries.ts`

조회는 외부 의존(Supabase) 때문에 단위 테스트보다 타입/빌드 검증으로 충분. 패턴은 `src/features/incident-reports/queries.ts`의 `listIncidentReports`/`getIncidentReport`를 본뜬다(서버 클라이언트 `@/lib/supabase/server`).

- [ ] **Step 1: queries.ts 구현**

`src/features/meetings/queries.ts`:
```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { meetingRowSchema, type MeetingRow } from "./schemas";

export async function listMeetings(): Promise<MeetingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[meetings] list fail:", error.message);
    return [];
  }
  const out: MeetingRow[] = [];
  for (const row of data ?? []) {
    const p = meetingRowSchema.safeParse(row);
    if (p.success) out.push(p.data);
  }
  return out;
}

export async function getMeeting(id: string): Promise<MeetingRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const p = meetingRowSchema.safeParse(data);
  return p.success ? p.data : null;
}
```
(주의: `@/lib/supabase/server`의 export 명이 `createClient`인지 실제 파일에서 확인하고 일치시킨다. incident-reports/queries.ts의 import 라인을 그대로 복사.)

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/features/meetings/queries.ts
git commit -m "feat(meetings): 목록/단건 조회 queries"
```

---

## Task 6: actions.ts (서버 액션 + 상태 가드)

**Files:**
- Create: `src/features/meetings/actions.ts`
- Test: `src/features/meetings/__tests__/actions-guard.test.ts`

상태 전이 가드(순수)만 단위 테스트하고, 액션 자체는 빌드/타입 검증.

- [ ] **Step 1: 실패 테스트 작성 (상태 전이 가드)**

`src/features/meetings/__tests__/actions-guard.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { canRevokeSend } from "../actions-guard";

describe("canRevokeSend", () => {
  it("sent만 되돌리기 가능", () => {
    expect(canRevokeSend("sent")).toBe(true);
    expect(canRevokeSend("draft")).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/features/meetings/__tests__/actions-guard.test.ts`
Expected: FAIL.

- [ ] **Step 3: 가드 구현**

`src/features/meetings/actions-guard.ts`:
```ts
import type { MeetingStatus } from "./schemas";
/** 발송취소는 sent 상태에서만. */
export function canRevokeSend(status: MeetingStatus): boolean {
  return status === "sent";
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/features/meetings/__tests__/actions-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: actions.ts 구현**

`src/features/meetings/actions.ts` (`incident-reports/actions.ts`의 createIncidentReport/updateIncidentReport 구조 참고 — getCurrentOperator·revalidatePath 패턴 동일):
```ts
"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { buildSeedBlocks } from "./templates";
import { meetingMetaSchema, type MeetingType } from "./schemas";
import { canRevokeSend } from "./actions-guard";

const PATH = "/dashboard/meetings";

export async function createMeeting(type: MeetingType): Promise<{ ok: boolean; id?: string; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("meetings")
    .insert({ type, author_email: me.email, content: buildSeedBlocks(type) })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true, id: data.id as string };
}

export async function updateMeetingMeta(id: string, raw: unknown): Promise<{ ok: boolean; error?: string }> {
  const parsed = meetingMetaSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = createAdminClient();
  const { error } = await supabase.from("meetings").update(parsed.data).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PATH);
  return { ok: true };
}

export async function saveMeetingContent(id: string, content: unknown[]): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("meetings").update({ content }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteMeeting(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PATH);
  return { ok: true };
}

export async function revokeSendMeeting(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("meetings").select("status").eq("id", id).maybeSingle();
  if (!data || !canRevokeSend(data.status)) return { ok: false, error: "발송완료 상태만 취소할 수 있습니다." };
  const { error } = await supabase.from("meetings").update({ status: "draft" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`${PATH}/${id}`);
  revalidatePath(PATH);
  return { ok: true };
}
```
(주의: `getCurrentOperator` import 경로는 incident-reports/actions.ts에서 실제 경로를 복사. `createAdminClient` 경로 동일 확인.)

- [ ] **Step 6: typecheck + 가드 테스트**

Run: `npx tsc --noEmit && npx vitest run src/features/meetings/__tests__/actions-guard.test.ts`
Expected: 통과 + PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/meetings/actions.ts src/features/meetings/actions-guard.ts src/features/meetings/__tests__/actions-guard.test.ts
git commit -m "feat(meetings): CRUD·발송취소 서버액션 + 상태 가드"
```

---

## Task 7: meeting-pdf.tsx + PDF 라우트

**Files:**
- Create: `src/lib/pdf/meeting-pdf.tsx`
- Create: `src/app/api/meetings/[id]/pdf/route.ts`

`src/lib/pdf/incident-report-pdf.tsx`의 Document/Page·폰트 등록·`[운영부 상황실]` 헤더 패턴을 참고한다(Pretendard 폰트 등록 코드를 그대로 가져와 재사용).

- [ ] **Step 1: meeting-pdf.tsx 구현**

`src/lib/pdf/meeting-pdf.tsx`:
```tsx
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { blocksToPdfModel, type PdfNode, type PdfRun } from "@/features/meetings/pdf-model";
import { MEETING_TYPE_LABELS, type MeetingRow } from "@/features/meetings/schemas";

// 폰트 등록 — incident-report-pdf.tsx의 Pretendard 등록 블록을 동일하게 복사해 넣을 것.
// Font.register({ family: "Pretendard", fonts: [{ src: ... Regular }, { src: ... Bold, fontWeight: 700 }] });

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Pretendard", fontSize: 10, color: "#15120c" },
  brand: { fontSize: 9, color: "#b8331e", fontWeight: 700, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 8 },
  metaRow: { flexDirection: "row", marginBottom: 2, fontSize: 9, color: "#3d3529" },
  metaKey: { width: 60, color: "#716855" },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4, color: "#b8331e" },
  para: { marginBottom: 3, lineHeight: 1.5 },
  li: { flexDirection: "row", marginBottom: 2, lineHeight: 1.5 },
  liMark: { width: 14 },
});

function Runs({ runs }: { runs: PdfRun[] }) {
  if (runs.length === 0) return <Text> </Text>;
  return (
    <Text>
      {runs.map((r, i) => (
        <Text key={i} style={{ fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? "italic" : "normal" }}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

function Node({ node, idx }: { node: PdfNode; idx: number }) {
  if (node.kind === "heading") return <Text style={s.h2}><Runs runs={node.runs} /></Text>;
  if (node.kind === "paragraph") return <View style={s.para}><Runs runs={node.runs} /></View>;
  const mark = node.kind === "bullet" ? "•" : node.kind === "numbered" ? `${idx}.` : node.checked ? "☑" : "☐";
  return (
    <View style={s.li}>
      <Text style={s.liMark}>{mark}</Text>
      <Runs runs={node.runs} />
    </View>
  );
}

export function renderMeetingPdf(meeting: MeetingRow) {
  const model = blocksToPdfModel(meeting.content as Parameters<typeof blocksToPdfModel>[0]);
  const dateStr = meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "—";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>[운영부 상황실]</Text>
        <Text style={s.title}>{meeting.title}</Text>
        <View style={s.metaRow}><Text style={s.metaKey}>유형</Text><Text>{MEETING_TYPE_LABELS[meeting.type]}</Text></View>
        <View style={s.metaRow}><Text style={s.metaKey}>일시</Text><Text>{dateStr}</Text></View>
        <View style={s.metaRow}><Text style={s.metaKey}>장소</Text><Text>{meeting.location ?? "—"}</Text></View>
        <View style={s.metaRow}><Text style={s.metaKey}>참석자</Text><Text>{meeting.attendees.join(", ") || "—"}</Text></View>
        <View style={{ marginTop: 10 }}>
          {model.map((n, i) => <Node key={i} node={n} idx={i + 1} />)}
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: PDF 라우트 구현**

`src/app/api/meetings/[id]/pdf/route.ts` (incident-reports pdf route 패턴: `renderToBuffer`):
```ts
import { renderToBuffer } from "@react-pdf/renderer";
import { getMeeting } from "@/features/meetings/queries";
import { renderMeetingPdf } from "@/lib/pdf/meeting-pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) return new Response("not found", { status: 404 });
  const buffer = await renderToBuffer(renderMeetingPdf(meeting));
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="meeting-${id}.pdf"`,
    },
  });
}
```

- [ ] **Step 3: typecheck**

Run: `npx tsc --noEmit`
Expected: 통과. (Font.register 블록을 incident-report-pdf에서 복사했는지 확인.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf/meeting-pdf.tsx "src/app/api/meetings/[id]/pdf/route.ts"
git commit -m "feat(meetings): PDF 렌더러(blocksToPdfModel 기반) + PDF API"
```

---

## Task 8: mail-actions.ts (발송 + SharePoint 업로드)

**Files:**
- Create: `src/features/meetings/mail-actions.ts`

`src/features/incident-reports/mail-actions.ts: sendIncidentReport`를 본뜬다. 흐름: 권한 확인 → PDF 버퍼 생성(`renderToBuffer(renderMeetingPdf(meeting))`) → `MAIL_DRY_RUN`이면 이력만 / 아니면 Graph sendMail(PDF 첨부) → SharePoint 업로드(`uploadFileToFolder`, env 있으면) → 상태 `sent` + 이력 적재.

- [ ] **Step 1: mail-actions.ts 구현**

`src/features/meetings/mail-actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { getMeeting } from "./queries";
import { renderMeetingPdf } from "@/lib/pdf/meeting-pdf";
import { sendMail } from "@/lib/microsoft/sendmail";
import { uploadFileToFolder } from "@/lib/microsoft/drive-upload";

const DRY_RUN = process.env.MAIL_DRY_RUN === "true";

export async function sendMeetingMinutes(
  id: string,
  recipients: string[],
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  const meeting = await getMeeting(id);
  if (!meeting) return { ok: false, error: "회의록을 찾을 수 없습니다." };

  const supabase = createAdminClient();
  const subject = `[운영부 상황실] 회의록 — ${meeting.title}`;
  const pdf = Buffer.from(await renderToBuffer(renderMeetingPdf(meeting)));
  const fileName = `회의록_${meeting.title}.pdf`;

  if (DRY_RUN) {
    await supabase.from("meeting_mail_sends").insert({
      meeting_id: id, sent_by_email: me.email, recipients, subject, status: "dry_run",
    });
    await supabase.from("meetings").update({ status: "sent" }).eq("id", id);
    revalidatePath(`/dashboard/meetings/${id}`);
    return { ok: true };
  }

  try {
    await sendMail({
      from: me.email,
      to: recipients,
      subject,
      html: `<p>운영부 회의록을 전달드립니다. (${meeting.title})</p>`,
      attachments: [{ name: fileName, contentBytes: pdf.toString("base64"), contentType: "application/pdf" }],
    });

    let sharepointUrl: string | null = null;
    const driveId = process.env.SHAREPOINT_DRIVE_ID;
    const folderId = process.env.SHAREPOINT_MEETINGS_FOLDER_ID;
    if (driveId && folderId) {
      const uploaded = await uploadFileToFolder(driveId, folderId, fileName, pdf);
      sharepointUrl = uploaded?.webUrl ?? null;
    } else {
      console.warn("[meetings] SHAREPOINT_MEETINGS_FOLDER_ID 미설정 — 업로드 스킵");
    }

    await supabase.from("meetings").update({ status: "sent", sharepoint_url: sharepointUrl }).eq("id", id);
    await supabase.from("meeting_mail_sends").insert({
      meeting_id: id, sent_by_email: me.email, recipients, subject, status: "sent",
    });
    revalidatePath(`/dashboard/meetings/${id}`);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from("meeting_mail_sends").insert({
      meeting_id: id, sent_by_email: me.email, recipients, subject, status: "failed", error: msg,
    });
    return { ok: false, error: msg };
  }
}
```
(주의: `sendMail`·`uploadFileToFolder`의 실제 시그니처/인자명을 `lib/microsoft/sendmail.ts`·`drive-upload.ts`에서 확인하고 일치시킨다. incident-reports/mail-actions.ts의 sendMail 호출부를 그대로 복사하는 것이 가장 안전. `uploadFileToFolder` 반환의 `webUrl` 키 확인.)

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: dry-run 스모크 검증(선택, env MAIL_DRY_RUN=true 가정)**

코드 경로상 DRY_RUN 분기가 이력 `dry_run` + status `sent`만 적재함을 코드리뷰로 확인. (실제 발송 테스트는 Task 13 운영 검증에서.)

- [ ] **Step 4: Commit**

```bash
git add src/features/meetings/mail-actions.ts
git commit -m "feat(meetings): 회의록 메일 발송 + SharePoint 업로드(sendMeetingMinutes)"
```

---

## Task 9: list-variant (목록 표/필터/상태 + registry 등록)

**Files:**
- Create: `src/app/dashboard/_components/inspector/list-variants/meetings/filters.ts`
- Create: `src/app/dashboard/_components/inspector/list-variants/meetings/status.ts`
- Create: `src/app/dashboard/_components/inspector/list-variants/meetings/Table.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/meetings/View.tsx`
- Create: `src/app/dashboard/_components/inspector/list-variants/meetings/EditForm.tsx`
- Modify: `src/app/dashboard/_components/inspector/list-variants/registry.ts`
- Modify: `src/app/dashboard/_components/inspector/list-variants/types.ts:5` (Variant union)
- Test: `src/app/dashboard/_components/inspector/list-variants/meetings/__tests__/Table.test.tsx`

목록 표시는 list-variant Table을 쓰되, 편집은 별도 워크스페이스(Task 11)로 가므로 View/EditForm은 최소 구현(클릭 시 워크스페이스로 라우팅). `incident-reports` variant의 Table/filters/status 구조를 참고한다.

- [ ] **Step 1: Variant union 추가**

`types.ts:5` 부근 union에 `| "meetings"` 추가:
```ts
// 기존 union에 한 줄 추가
  | "meetings"
```

- [ ] **Step 2: filters.ts**

`.../meetings/filters.ts` (incident-reports/filters.ts 패턴 — `FilterDef[]` + blank factory):
```ts
import type { ListRow } from "../../../patterns/ListPattern";
import { MEETING_TYPE_LABELS, MEETING_TYPES } from "@/features/meetings/schemas";

export const MEETING_FILTERS = [
  { key: "type", label: "유형", options: MEETING_TYPES.map((t) => ({ value: t, label: MEETING_TYPE_LABELS[t] })) },
  { key: "status", label: "상태", options: [
      { value: "draft", label: "작성중" }, { value: "sent", label: "발송완료" } ] },
];

export function blankMeetingRow(): ListRow {
  return { id: "", name: "제목 없음" } as ListRow;
}
```
(주의: `FilterDef`/`ListRow` 실제 타입에 맞춰 필드명을 incident-reports/filters.ts와 동일하게 조정.)

- [ ] **Step 3: status.ts**

`.../meetings/status.ts` (상태→배지 톤; incident-reports/status.ts 패턴):
```ts
export const MEETING_STATUS_TONE: Record<string, string> = {
  draft: "bg-line-soft text-ink",
  sent: "bg-sage text-cream",
};
```

- [ ] **Step 4: Table.tsx**

`.../meetings/Table.tsx` (유형 배지·제목·일시·작성자·상태 컬럼). `incident-reports/Table.tsx`를 복사해 컬럼만 교체:
```tsx
"use client";
import type { ListRow } from "../../../patterns/ListPattern";
import { MEETING_TYPE_LABELS, MEETING_STATUS_LABELS } from "@/features/meetings/schemas";
import { MEETING_STATUS_TONE } from "./status";

type Props = { rows: ListRow[]; selectedId: string | null; onSelect: (row: ListRow) => void };

export function MeetingsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">유형</th><th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">일시</th><th className="px-3 py-2">작성자</th><th className="px-3 py-2">상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">데이터 없음</td></tr>
        ) : rows.map((row) => (
          <tr key={row.id} onClick={() => onSelect(row)}
            className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${selectedId === row.id ? "bg-washi-raised" : ""}`}>
            <td className="px-3 py-2"><span className="inline-block bg-line-soft px-2 py-0.5 text-xs">{MEETING_TYPE_LABELS[(row.meetingType ?? "regular") as keyof typeof MEETING_TYPE_LABELS]}</span></td>
            <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
            <td className="px-3 py-2 text-xs text-ink-soft">{row.meetingDate ?? "—"}</td>
            <td className="px-3 py-2 text-xs text-ink-soft">{row.author ?? "—"}</td>
            <td className="px-3 py-2"><span className={`inline-block px-2 py-0.5 text-xs ${MEETING_STATUS_TONE[row.status ?? "draft"]}`}>{MEETING_STATUS_LABELS[(row.status ?? "draft") as keyof typeof MEETING_STATUS_LABELS]}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```
(주의: `ListRow`에 `meetingType`/`meetingDate`/`author`/`status` 필드가 없으면, page.tsx에서 meeting → ListRow 매핑 시 채워 넣거나 ListRow 타입을 확장. incident-reports가 ListRow를 어떻게 채우는지 `_row-mapper.ts` 참고.)

- [ ] **Step 5: View.tsx / EditForm.tsx (최소 — 워크스페이스로 유도)**

`.../meetings/View.tsx`:
```tsx
import type { ViewProps } from "../types";
export function MeetingsView({ row }: ViewProps) {
  return (
    <div className="p-4 text-sm">
      <p className="mb-3 font-bold">{row.name}</p>
      <a href={`/dashboard/meetings/${row.id}`} className="inline-block border border-ink px-3 py-1 hover:bg-ink hover:text-cream">
        편집 화면 열기 →
      </a>
    </div>
  );
}
```
`.../meetings/EditForm.tsx`:
```tsx
import type { EditFormProps } from "../types";
export function MeetingsEditForm({ row, onCancel }: EditFormProps) {
  return (
    <div className="p-4 text-sm">
      <p className="mb-3">회의록 편집은 전용 화면에서 진행합니다.</p>
      <a href={`/dashboard/meetings/${row.id}`} className="inline-block border border-ink px-3 py-1 hover:bg-ink hover:text-cream">편집 화면 열기 →</a>
      <button onClick={onCancel} className="ml-2 text-muted">닫기</button>
    </div>
  );
}
```
(주의: `ViewProps`/`EditFormProps` 실제 시그니처를 types.ts에서 확인해 props 구조 맞춤.)

- [ ] **Step 6: registry 등록**

`registry.ts` import 추가 + 매핑 블록 추가:
```ts
// import 영역
import { MeetingsView } from "./meetings/View";
import { MeetingsEditForm } from "./meetings/EditForm";
import { MeetingsTable } from "./meetings/Table";
import { MEETING_FILTERS, blankMeetingRow } from "./meetings/filters";

// 매핑 객체 안 (incident-reports 블록 옆)
  meetings: {
    View: MeetingsView,
    EditForm: MeetingsEditForm,
    Table: MeetingsTable,
    Filters: MEETING_FILTERS,
    blank: blankMeetingRow,
  },
```

- [ ] **Step 7: Table 테스트 작성 + 실행**

`.../meetings/__tests__/Table.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MeetingsTable } from "../Table";

const row = { id: "m1", name: "부산대 미팅", meetingType: "field", meetingDate: "2026-06-14", author: "송영신", status: "draft" } as never;

describe("MeetingsTable", () => {
  it("유형/제목/상태 렌더", () => {
    render(<MeetingsTable rows={[row]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("외근·출장 보고")).toBeInTheDocument();
    expect(screen.getByText("부산대 미팅")).toBeInTheDocument();
    expect(screen.getByText("작성중")).toBeInTheDocument();
  });
});
```
Run: `npx vitest run src/app/dashboard/_components/inspector/list-variants/meetings/__tests__/Table.test.tsx`
Expected: PASS (먼저 RED 확인 후 GREEN).

- [ ] **Step 8: typecheck + Commit**

Run: `npx tsc --noEmit`
```bash
git add src/app/dashboard/_components/inspector/list-variants/meetings src/app/dashboard/_components/inspector/list-variants/registry.ts src/app/dashboard/_components/inspector/list-variants/types.ts
git commit -m "feat(meetings): list-variant(Table/filters/status/View/EditForm) + registry 등록"
```

---

## Task 10: MeetingEditor (BlockNote 래퍼 + 자동저장)

**Files:**
- Create: `src/app/dashboard/meetings/_components/MeetingEditor.tsx`

- [ ] **Step 1: MeetingEditor 구현**

`src/app/dashboard/meetings/_components/MeetingEditor.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { saveMeetingContent } from "@/features/meetings/actions";

type Props = { id: string; initialContent: unknown[] };

export function MeetingEditor({ id, initialContent }: Props) {
  const editor = useCreateBlockNote({
    initialContent: initialContent.length > 0 ? (initialContent as never) : undefined,
  });
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  function onChange() {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await saveMeetingContent(id, editor.document);
      setSaved(res.ok);
    }, 800);
  }

  return (
    <div>
      <div className="mb-2 text-xs text-gold">{saved ? "✓ 자동 저장됨" : "저장 중…"}</div>
      <BlockNoteView editor={editor} onChange={onChange} theme="light" />
    </div>
  );
}
```
(주의: BlockNote 버전에 따라 `BlockNoteView` import 위치(`@blocknote/mantine` vs `@blocknote/react`)·`editor.document` 접근이 다를 수 있음. Task 0에서 확인한 실제 API에 맞춤. 빈 시드면 `initialContent` undefined로 두고 빈 문서 시작.)

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/meetings/_components/MeetingEditor.tsx
git commit -m "feat(meetings): BlockNote 에디터 래퍼 + 자동저장"
```

---

## Task 11: 라우트 페이지 (목록 + 편집 워크스페이스 + 새 회의록)

**Files:**
- Create: `src/app/dashboard/meetings/page.tsx`
- Create: `src/app/dashboard/meetings/_components/NewMeetingButton.tsx`
- Create: `src/app/dashboard/meetings/[id]/page.tsx`
- Create: `src/app/dashboard/meetings/[id]/_components/MeetingEditorWorkspace.tsx`

- [ ] **Step 1: 목록 page.tsx**

`src/app/dashboard/meetings/page.tsx` (서버 컴포넌트; `incidents` 등 기존 list 페이지의 ListPattern 사용법을 참고해 listMeetings → ListRow 매핑):
```tsx
import { listMeetings } from "@/features/meetings/queries";
import { MEETING_TYPE_LABELS } from "@/features/meetings/schemas";
import { NewMeetingButton } from "./_components/NewMeetingButton";
// ListPattern import 경로는 기존 list 페이지(예: dashboard/incidents/page.tsx)에서 복사

export default async function MeetingsPage() {
  const meetings = await listMeetings();
  const rows = meetings.map((m) => ({
    id: m.id,
    name: m.title,
    meetingType: m.type,
    meetingDate: m.meeting_date ? new Date(m.meeting_date).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }) : "—",
    author: m.author_email,
    status: m.status,
    variant: "meetings" as const,
  }));
  return (
    <div>
      <div className="mb-4 flex justify-end"><NewMeetingButton /></div>
      {/* ListPattern variant="meetings" rows={rows} — 기존 list 페이지 패턴 그대로 */}
      {/* 클릭 시 인스펙터 View가 편집화면 링크 제공(Task 9) */}
    </div>
  );
}
```
(주의: 기존 list 페이지가 `ListPattern`/`DashboardShell` 등 어떤 래퍼를 쓰는지 `dashboard/incidents/page.tsx`를 열어 동일 구조로 맞춘다. rows→ListRow 필드명은 Task 9 Table이 읽는 키와 일치.)

- [ ] **Step 2: NewMeetingButton (유형 선택 모달)**

`src/app/dashboard/meetings/_components/NewMeetingButton.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createMeeting } from "@/features/meetings/actions";
import { MEETING_TYPES, MEETING_TYPE_LABELS } from "@/features/meetings/schemas";

export function NewMeetingButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function pick(type: (typeof MEETING_TYPES)[number]) {
    setBusy(true);
    const res = await createMeeting(type);
    if (res.ok && res.id) router.push(`/dashboard/meetings/${res.id}`);
    else { setBusy(false); setOpen(false); }
  }
  return (
    <>
      <button onClick={() => setOpen(true)} className="border border-ink bg-ink px-3 py-1.5 text-sm text-cream">+ 새 회의록</button>
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/30" onClick={() => !busy && setOpen(false)}>
          <div className="w-[320px] border border-ink bg-cream p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 text-sm font-bold">회의 유형 선택</p>
            <div className="flex flex-col gap-2">
              {MEETING_TYPES.map((t) => (
                <button key={t} disabled={busy} onClick={() => pick(t)}
                  className="border border-line-soft px-3 py-2 text-left text-sm hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-50">
                  {MEETING_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: 편집 워크스페이스 라우트 [id]/page.tsx**

`src/app/dashboard/meetings/[id]/page.tsx` (서버, 가드 — incident-reports/[id]/page.tsx의 `requireMenu` 패턴):
```tsx
import { notFound } from "next/navigation";
import { getMeeting } from "@/features/meetings/queries";
import { MeetingEditorWorkspace } from "./_components/MeetingEditorWorkspace";
// requireMenu import 경로는 incident-reports/[id]/page.tsx에서 복사

export default async function MeetingEditPage({ params }: { params: Promise<{ id: string }> }) {
  // await requireMenu("meetings");  // 경위서 [id] 페이지와 동일한 가드 호출
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) notFound();
  return <MeetingEditorWorkspace meeting={meeting} />;
}
```

- [ ] **Step 4: MeetingEditorWorkspace (메타 헤더 + 에디터 + 액션)**

`src/app/dashboard/meetings/[id]/_components/MeetingEditorWorkspace.tsx`:
```tsx
"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import type { MeetingRow } from "@/features/meetings/schemas";
import { MEETING_TYPE_LABELS, MEETING_STATUS_LABELS } from "@/features/meetings/schemas";
import { updateMeetingMeta } from "@/features/meetings/actions";
import { sendMeetingMinutes } from "@/features/meetings/mail-actions";

const MeetingEditor = dynamic(
  () => import("../../_components/MeetingEditor").then((m) => m.MeetingEditor),
  { ssr: false, loading: () => <p className="text-sm text-muted">에디터 로딩…</p> },
);

export function MeetingEditorWorkspace({ meeting }: { meeting: MeetingRow }) {
  const [title, setTitle] = useState(meeting.title);
  const [location, setLocation] = useState(meeting.location ?? "");
  const [attendees, setAttendees] = useState(meeting.attendees.join(", "));
  const [busy, setBusy] = useState(false);

  async function saveMeta() {
    await updateMeetingMeta(meeting.id, {
      title, location: location || null, meeting_date: meeting.meeting_date ?? null,
      attendees: attendees.split(",").map((s) => s.trim()).filter(Boolean),
    });
  }
  async function send() {
    setBusy(true);
    const res = await sendMeetingMinutes(meeting.id, attendees.split(",").map((s) => s.trim()).filter(Boolean));
    setBusy(false);
    if (!res.ok) alert(res.error);
  }

  return (
    <div className="mx-auto max-w-[820px] p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="bg-line-soft px-2 py-0.5 text-xs">{MEETING_TYPE_LABELS[meeting.type]}</span>
        <div className="flex items-center gap-2">
          <span className="bg-line-soft px-2 py-0.5 text-xs">{MEETING_STATUS_LABELS[meeting.status]}</span>
          <a href={`/api/meetings/${meeting.id}/pdf`} target="_blank" className="border border-ink px-3 py-1 text-sm hover:bg-ink hover:text-cream">PDF</a>
          <button disabled={busy} onClick={send} className="border border-ink bg-ink px-3 py-1 text-sm text-cream disabled:opacity-50">메일 발송</button>
        </div>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta}
        className="mb-3 w-full border-none text-2xl font-black outline-none" placeholder="제목 없음" />
      <div className="mb-1 flex gap-2 text-sm"><span className="w-14 text-muted">장소</span>
        <input value={location} onChange={(e) => setLocation(e.target.value)} onBlur={saveMeta} className="flex-1 bg-line-soft px-2 py-1" /></div>
      <div className="mb-4 flex gap-2 text-sm"><span className="w-14 text-muted">참석자</span>
        <input value={attendees} onChange={(e) => setAttendees(e.target.value)} onBlur={saveMeta} className="flex-1 bg-line-soft px-2 py-1" placeholder="쉼표로 구분" /></div>
      <hr className="mb-4 border-line-soft" />
      <MeetingEditor id={meeting.id} initialContent={meeting.content} />
    </div>
  );
}
```

- [ ] **Step 5: typecheck + 빌드 스모크**

Run: `npx tsc --noEmit`
Expected: 통과.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/meetings
git commit -m "feat(meetings): 목록·새 회의록 모달·편집 워크스페이스 라우트"
```

---

## Task 12: 권한 메뉴 + env 등록

**Files:**
- Modify: `src/app/dashboard/settings/_env.ts`
- (allowed_menus는 운영 데이터 — 코드 변경 아님: 운영자 `allowed_menus`에 `meetings` 포함 필요, Task 13 운영 메모)

- [ ] **Step 1: settings/_env.ts에 SHAREPOINT_MEETINGS_FOLDER_ID 등록**

`settings/_env.ts`의 SHAREPOINT_* 등록 블록(line 68~107 부근)에 한 줄 추가(기존 항목과 동일 형식):
```ts
  SHAREPOINT_MEETINGS_FOLDER_ID: process.env.SHAREPOINT_MEETINGS_FOLDER_ID,
```
(실제 등록 형식 — head+tail preview/boolean 여부 — 인접 SHAREPOINT_*_FOLDER_ID 항목과 동일하게 맞춘다.)

- [ ] **Step 2: typecheck + Commit**

Run: `npx tsc --noEmit`
```bash
git add src/app/dashboard/settings/_env.ts
git commit -m "chore(meetings): SHAREPOINT_MEETINGS_FOLDER_ID env 등록"
```

---

## Task 13: 전체 검증 + 운영 메모

- [ ] **Step 1: 전체 lint/typecheck/test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: typecheck 통과 / lint 변경파일 경고 0 / 전체 테스트 통과.

- [ ] **Step 2: dev 서버 수동 확인**

`/dashboard/meetings` → "새 회의록" → 유형 선택 → 편집 워크스페이스 진입(시드 블록 표시) → 제목/장소/참석자 입력(블러 저장) → 본문 블록 편집(자동저장 표시) → `PDF` 버튼으로 PDF 확인 → (MAIL_DRY_RUN=true) 메일 발송 시 상태 `발송완료` 전환 확인.

- [ ] **Step 3: 운영 메모 (코드 아님)**

- 운영자 `allowed_menus`에 `meetings` 추가(권한 가드 통과용).
- `.env`에 `SHAREPOINT_MEETINGS_FOLDER_ID`(운영부 > 03. 외근보고서 폴더 Graph item id) 주입 → 업로드 활성화.
- 운영 발송 전 `MAIL_DRY_RUN=false` 전환.

- [ ] **Step 4: PR 생성**

```bash
git push -u origin feat/meeting-minutes
gh pr create --base main --title "feat(meetings): 회의록 메뉴 + 노션형 양식(BlockNote) 신규 구현" --body "## Summary
- 회의록 유형 5종 선택 → 노션형 블록 에디터 작성
- 블록→react-pdf 매퍼로 PDF 생성, 메일 발송 + SharePoint 업로드
- 경위서 패턴 기반, 승인절차·시행번호 채번 제외

## Test plan
- [x] tsc / lint / npm test 전체 통과
- [x] dev 수동: 생성→편집→자동저장→PDF→발송(dry-run)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## 부록: 의존 순서 / 검증 포인트

- Task 0(설치) → 1(DB) → 2~4(순수 유닛, 병렬 가능) → 5·6(조회·액션) → 7(PDF) → 8(메일) → 9(variant) → 10(에디터) → 11(라우트) → 12(env) → 13(검증).
- **가장 리스크 있는 지점**: BlockNote 실제 API(Task 0에서 블록 shape 확정) + `sendMail`/`uploadFileToFolder` 시그니처(Task 8, 경위서 호출부 복사로 회피).
- 모든 "주의:" 메모는 구현 시 해당 레퍼런스 파일을 열어 시그니처/경로를 1:1 확인하라는 뜻(추측 금지).
