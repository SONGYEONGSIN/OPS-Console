# 팀 브리핑 초안→확인→발행 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 팀 보고 브리핑이 사람 확인 없이 Teams 그룹채팅에 나가지 않게 하고, 자동화 실행 로그에서 과거 발행분 주소를 볼 수 있게 한다.

**Architecture:** `team_briefings`에 `status`(draft/published)를 추가해 발행을 두 단계로 나눈다. 로컬 스케줄러는 초안까지만 만들고 본인 Teams 채팅으로 미리보기 링크를 보낸다. 자동화 페이지의 admin server action이 호수를 확정하고 그룹채팅 티저를 발송한다. 실행 로그는 `team_briefings`를 읽는 리졸버를 추가해 발행분을 링크와 함께 타임라인에 붙인다.

**Tech Stack:** Next.js App Router, TypeScript, Supabase(service_role), zod, Microsoft Graph(Teams), Vitest.

설계 문서: `docs/superpowers/specs/2026-07-31-team-briefing-draft-publish-design.md`

## Global Constraints

- 커밋은 Conventional Commits, 한국어 본문. 접두사만 영어.
- TDD 강제: 테스트 작성 → 실패 확인(RED) → 최소 구현 → 통과 확인(GREEN). RED를 건너뛴 테스트는 무효.
- `any` / `@ts-ignore` / `eslint-disable` / `console.log` 금지.
- 색상 하드코딩 금지 — Tailwind 토큰 클래스 사용 (`text-ink`, `text-muted`, `border-line`, `bg-vermilion`, `text-cream`, `text-vermilion`).
- 폴백 로직 금지. 단, 환경변수 미설정 시 기능 생략은 기존 `TEAMS_NOTICE_CHAT_ID` 패턴과 동일하므로 허용.
- 불변성: 객체 직접 수정 금지, spread로 새 객체 생성.
- 테스트 실행은 대상 스코프만: `npx vitest run <경로>`. 전체 스위트는 이 PC 메모리 여건상 CI에 맡긴다.
- `status` 문자열 리터럴은 `"draft" | "published"` 유니온 타입으로만 다룬다.
- 브랜치: `feat/team-briefing-draft-publish` (이미 생성됨, 설계 문서 커밋 `da41f1a`).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `supabase/migrations/20260731_team_briefings_draft.sql` | status/published_at 컬럼 + 단일 초안 제약 |
| `src/features/team-briefings/queries.ts` | 공유 토큰 조회 (status 포함), 대기 초안 조회 |
| `src/features/automations/jobs/team-briefing.ts` | `stageBriefingDraft` / `publishStagedDraft` |
| `src/app/api/team-briefing/stage/route.ts` | 로컬 스케줄러용 초안 저장 엔드포인트 (기존 publish 대체) |
| `src/features/automations/actions.ts` | `publishBriefingDraftAction` (admin) |
| `src/features/automations/schemas.ts` | 발행 액션 입력 스키마 |
| `src/features/automations/queries.ts` | `AutomationStatus`에 대기 초안 정보 부착 |
| `src/features/automations/run-logs.ts` | `team-briefing` 로그 리졸버 |
| `src/features/automations/run-logs-normalize.ts` | `BriefingEntry` 타입 + 매핑 |
| `src/app/dashboard/automations/_components/AutomationHub.tsx` | 초안 대기 줄 + 미리보기/발행 |
| `src/app/dashboard/automations/_components/AutomationLogPanel.tsx` | `BriefingList` 렌더 |
| `src/app/r/briefing/[token]/page.tsx` | 초안 배너 |
| `scripts/team-briefing/publish-local.mjs` | 엔드포인트 stage로 변경 |
| `src/features/team-briefings/url.ts` | 뉴스레터 base URL 단일 정의 (신규) |

**설계서와의 차이 2건**:

1. 설계서는 `settings/_env.ts`에 `TEAMS_BRIEFING_DRAFT_CHAT_ID`를 노출한다고 했으나, 해당 파일에는 현재 `TEAMS_*` 키가 하나도 없어 단독 추가가 일관성을 깬다. 대신 미설정 시 `automation_runs` 메시지에 사실을 남겨 자동화 페이지에서 바로 보이게 한다 (Task 4).
2. 설계서의 `list-my-chats.mjs`는 만들지 않는다. Graph `/chats` 조회는 **위임 토큰**이 필요한데 기존 `.mjs` 스크립트들은 `client_credentials`(앱 토큰)만 쓴다. 채팅 ID는 Teams 클라이언트에서 "채팅 링크 복사"로 얻는 편이 확실하다 (Task 8).

**base URL 단일화 (중요)**: `team-briefing.ts`의 `baseUrl()`은 `NEXT_PUBLIC_APP_URL ?? FOLIO_BASE_URL ?? "http://localhost:3000"`이다. 초안 URL·발행 URL·로그 URL이 갈라지면 "확인한 링크 = 팀에 나가는 링크" 불변식이 깨지므로, 이 함수를 `src/features/team-briefings/url.ts`로 옮기고 세 소비자가 모두 import한다.

---

## Task 1: DB 마이그레이션 + 공유 토큰 조회에 status 반영

**Files:**
- Create: `supabase/migrations/20260731_team_briefings_draft.sql`
- Modify: `src/features/team-briefings/queries.ts`
- Test: `src/features/team-briefings/__tests__/queries.test.ts`

**Interfaces:**
- Produces: `TeamBriefing`에 `status: "draft" | "published"` 필드 추가. Task 6(초안 배너)이 소비.
- Produces: `team_briefings.status` / `published_at` 컬럼. Task 2·5가 소비.

- [ ] **Step 1: 마이그레이션 파일 작성**

`supabase/migrations/20260731_team_briefings_draft.sql`:

```sql
-- 팀 브리핑 초안(draft) 단계 — 사람이 내용을 확인한 뒤 발행하도록 분리한다.
-- 기존 행은 default 'published'로 남아 그대로 발행분으로 취급된다.
alter table public.team_briefings
  add column if not exists status text not null default 'published',
  add column if not exists published_at timestamptz;

alter table public.team_briefings
  drop constraint if exists team_briefings_status_check;
alter table public.team_briefings
  add constraint team_briefings_status_check
  check (status in ('draft', 'published'));

-- 초안은 동시에 1건만 존재한다 (새 초안이 이전 초안을 대체).
create unique index if not exists team_briefings_single_draft_idx
  on public.team_briefings (status) where status = 'draft';
```

- [ ] **Step 2: Supabase에 선적용**

프로젝트 관례 — DB 스키마 변경은 머지 전에 적용하고 service_role로 검증한다.
Supabase 대시보드 SQL Editor에 위 SQL을 붙여 실행한 뒤, 아래로 확인한다:

```bash
node -e "
const fs=require('fs');
const env=fs.readFileSync('.env.local','utf8');
const get=k=>{const m=env.match(new RegExp('^'+k+'=(.*)\$','m'));return m?m[1].trim():null};
const url=get('NEXT_PUBLIC_SUPABASE_URL'), key=get('SUPABASE_SERVICE_ROLE_KEY');
fetch(url+'/rest/v1/team_briefings?select=issue_no,status,published_at',{headers:{apikey:key,Authorization:'Bearer '+key}}).then(r=>r.json()).then(d=>console.log(JSON.stringify(d)));
"
```

Expected: `[{"issue_no":1,"status":"published","published_at":null}]`

- [ ] **Step 3: 실패하는 테스트 작성**

`src/features/team-briefings/__tests__/queries.test.ts`의 `describe("getTeamBriefingByShareToken")` 안에 추가:

```typescript
  it("status를 함께 반환한다 (초안 배너 판별용)", async () => {
    state.result = {
      data: {
        issue_no: 2,
        briefing_date: "2026-07-31",
        payload: { dateLabel: "2026-07-31 (금)" },
        status: "draft",
      },
      error: null,
    };
    const r = await getTeamBriefingByShareToken("tok-draft");
    expect(r!.status).toBe("draft");
  });

  it("status 누락(구 행)이면 published로 본다", async () => {
    state.result = {
      data: {
        issue_no: 1,
        briefing_date: "2026-07-24",
        payload: { dateLabel: "2026-07-24 (금)" },
      },
      error: null,
    };
    const r = await getTeamBriefingByShareToken("tok-old");
    expect(r!.status).toBe("published");
  });
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npx vitest run src/features/team-briefings`
Expected: FAIL — `r.status`가 `undefined`

- [ ] **Step 5: 최소 구현**

`src/features/team-briefings/queries.ts`:

```typescript
export type TeamBriefing = {
  issueNo: number;
  briefingDate: string;
  payload: BriefingPayload;
  status: "draft" | "published";
};
```

`select`에 `status`를 추가하고 반환 객체에 매핑한다:

```typescript
  const { data, error } = await admin
    .from("team_briefings")
    .select("issue_no, briefing_date, payload, status")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return {
    issueNo: data.issue_no as number,
    briefingDate: data.briefing_date as string,
    payload: data.payload as BriefingPayload,
    status: data.status === "draft" ? "draft" : "published",
  };
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run src/features/team-briefings`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 7: 커밋**

```bash
git add supabase/migrations/20260731_team_briefings_draft.sql src/features/team-briefings
git commit -m "feat(team-briefing): team_briefings status/published_at 컬럼 추가"
```

---

## Task 1.5: base URL 단일 정의 추출

**Files:**
- Create: `src/features/team-briefings/url.ts`
- Modify: `src/features/automations/jobs/team-briefing.ts`
- Test: `src/features/team-briefings/__tests__/url.test.ts`

**Interfaces:**
- Produces: `briefingBaseUrl(): string`, `briefingUrl(shareToken: string): string` — Task 2·3·6이 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/team-briefings/__tests__/url.test.ts`:

```typescript
import { describe, it, expect, afterEach } from "vitest";
import { briefingUrl } from "../url";

const saved = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = saved;
});

describe("briefingUrl", () => {
  it("NEXT_PUBLIC_APP_URL 기준으로 공유 경로를 만든다", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com";
    expect(briefingUrl("abc")).toBe("https://ops.example.com/r/briefing/abc");
  });

  it("끝 슬래시가 있어도 중복되지 않는다", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://ops.example.com/";
    expect(briefingUrl("abc")).toBe("https://ops.example.com/r/briefing/abc");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/features/team-briefings/__tests__/url.test.ts`
Expected: FAIL — 모듈 `../url` 없음

- [ ] **Step 3: 구현**

`src/features/team-briefings/url.ts`:

```typescript
/**
 * 뉴스레터 공유 URL 단일 정의.
 * 초안 미리보기 · 발행 티저 · 실행 로그가 모두 같은 주소를 써야
 * "확인한 링크 = 팀에 나가는 링크" 불변식이 유지된다.
 */
export function briefingBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FOLIO_BASE_URL ??
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function briefingUrl(shareToken: string): string {
  return `${briefingBaseUrl()}/r/briefing/${shareToken}`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/features/team-briefings/__tests__/url.test.ts`
Expected: PASS

- [ ] **Step 5: 기존 `baseUrl()` 제거**

`src/features/automations/jobs/team-briefing.ts`에서 로컬 `baseUrl()` 함수를 삭제하고
`briefingUrl`을 import해 `${baseUrl()}/r/briefing/${token}` 사용처를 전부 교체한다.

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts`
Expected: PASS (기존 테스트 유지)

- [ ] **Step 6: 커밋**

```bash
git add src/features/team-briefings src/features/automations/jobs/team-briefing.ts
git commit -m "refactor(team-briefing): 뉴스레터 URL 생성 단일 모듈로 추출"
```

---

## Task 2: 실행 로그에 발행 주소 노출

사용자 요청 중 독립적으로 가치가 나오는 부분이라 초안 흐름보다 먼저 넣는다.
`team_briefings`에 이미 있는 데이터를 읽으므로 지난 #1호가 백필 없이 표시된다.

**Files:**
- Modify: `src/features/automations/run-logs-normalize.ts`
- Modify: `src/features/automations/run-logs.ts`
- Modify: `src/app/dashboard/automations/_components/AutomationLogPanel.tsx`
- Test: `src/features/automations/__tests__/run-logs-normalize.test.ts`

**Interfaces:**
- Produces: `BriefingEntry { publishedAt: string; issueNo: number; url: string }`
- Produces: `toBriefingEntry(row, baseUrl)` — Task 없음(내부 사용). `JobRunLog`에 `{ kind: "briefing"; entries: BriefingEntry[] }` 분기 추가.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/automations/__tests__/run-logs-normalize.test.ts` 끝에 추가:

```typescript
import { toBriefingEntry } from "../run-logs-normalize";

describe("toBriefingEntry (팀 브리핑 발행 이력)", () => {
  it("published_at 우선, 공유 토큰으로 뉴스레터 URL 생성", () => {
    const e = toBriefingEntry(
      {
        issue_no: 2,
        share_token: "abc123",
        published_at: "2026-07-31T01:10:00.000Z",
        created_at: "2026-07-31T01:00:00.000Z",
      },
      "https://ops.example.com",
    );
    expect(e.issueNo).toBe(2);
    expect(e.publishedAt).toBe("2026-07-31T01:10:00.000Z");
    expect(e.url).toBe("https://ops.example.com/r/briefing/abc123");
  });

  it("published_at이 없는 구 행은 created_at을 쓴다", () => {
    const e = toBriefingEntry(
      {
        issue_no: 1,
        share_token: "old",
        published_at: null,
        created_at: "2026-07-24T04:35:01.786Z",
      },
      "https://ops.example.com",
    );
    expect(e.publishedAt).toBe("2026-07-24T04:35:01.786Z");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/features/automations/__tests__/run-logs-normalize.test.ts`
Expected: FAIL — `toBriefingEntry is not a function`

- [ ] **Step 3: 타입 + 매핑 구현**

`src/features/automations/run-logs-normalize.ts`에 추가 (다른 Entry 타입들 옆):

```typescript
export type BriefingEntry = {
  publishedAt: string;
  issueNo: number;
  url: string;
};

/** team_briefings 발행 행 → 로그 entry. 구 행은 published_at이 없어 created_at으로 대체. */
export function toBriefingEntry(
  row: {
    issue_no: number;
    share_token: string;
    published_at: string | null;
    created_at: string;
  },
  baseUrl: string,
): BriefingEntry {
  return {
    publishedAt: row.published_at ?? row.created_at,
    issueNo: row.issue_no,
    url: `${baseUrl}/r/briefing/${row.share_token}`,
  };
}
```

`JobRunLog` 유니온에 분기 추가:

```typescript
  | { jobId: string; kind: "briefing"; entries: BriefingEntry[] }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/features/automations/__tests__/run-logs-normalize.test.ts`
Expected: PASS

- [ ] **Step 5: 리졸버 등록**

`src/features/automations/run-logs.ts`에 함수 추가 (다른 `*Log` 함수들 옆):

```typescript
/** 팀 브리핑 — 발행분(status=published)을 호수·링크와 함께 노출한다. */
async function briefingLog(jobId: string): Promise<JobRunLog> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("team_briefings")
    .select("issue_no, share_token, published_at, created_at")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(LOG_LIMIT);
  const base = briefingBaseUrl();
  return {
    jobId,
    kind: "briefing",
    entries: (data ?? []).map((r) =>
      toBriefingEntry(
        {
          issue_no: r.issue_no as number,
          share_token: r.share_token as string,
          published_at: (r.published_at as string | null) ?? null,
          created_at: r.created_at as string,
        },
        base,
      ),
    ),
  };
}
```

import 추가: `toBriefingEntry` (./run-logs-normalize), `briefingBaseUrl` (@/features/team-briefings/url).
`LOG_RESOLVERS`에 한 줄:

```typescript
  "team-briefing": briefingLog,
```

`run-logs-normalize.ts`는 순수 모듈(env 접근 없음)이므로 base URL을 인자로 받는다 —
env 의존은 I/O 담당인 `run-logs.ts`에만 둔다.

- [ ] **Step 6: 렌더 컴포넌트**

`AutomationLogPanel.tsx` — import에 `type BriefingEntry` 추가 후, 다른 List들 옆에:

```tsx
function BriefingList({ entries }: { entries: BriefingEntry[] }) {
  return (
    <div className="space-y-5">
      {entries.map((e, i) => (
        <div key={i} className="space-y-2">
          <span className="text-xs text-ink">{fmtTime(e.publishedAt)}</span>
          <DefList items={[{ term: "호수", desc: `#${e.issueNo}호` }]} />
          <a
            href={e.url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-vermilion underline underline-offset-2"
          >
            뉴스레터 열기 →
          </a>
          {i < entries.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );
}
```

`DetailEntries` switch에 분기 추가:

```tsx
    case "briefing":
      return <BriefingList entries={indices.map((i) => log.entries[i])} />;
```

`entrySentAtList` switch에 분기 추가:

```typescript
    case "briefing":
      return log.entries.map((e) => e.publishedAt);
```

- [ ] **Step 7: 타입·린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors

- [ ] **Step 8: 커밋**

```bash
git add src/features/automations src/app/dashboard/automations
git commit -m "feat(team-briefing): 실행 로그에 발행 호수·뉴스레터 링크 노출"
```

---

## Task 3: 초안 저장 / 발행 확정 분리 (jobs)

**Files:**
- Modify: `src/features/automations/jobs/team-briefing.ts`
- Test: `src/features/automations/jobs/__tests__/team-briefing.test.ts`

**Interfaces:**
- Consumes: `team_briefings.status` (Task 1)
- Produces:
  - `stageBriefingDraft(payload: BriefingPayload): Promise<{ ok: true; url: string; nextIssueNo: number; notified: boolean } | { ok: false; message: string }>`
  - `publishStagedDraft(draftId: string): Promise<{ ok: true; issueNo: number; url: string; sent: boolean } | { ok: false; message: string }>`
  - 기존 `publishBriefing`은 제거한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`src/features/automations/jobs/__tests__/team-briefing.test.ts`에 추가. 기존 `chain()` 헬퍼와 `adminFrom` 모킹 스타일을 그대로 쓰되, `delete`/`update` 체인을 지원하도록 헬퍼를 확장한다:

```typescript
import { stageBriefingDraft } from "../team-briefing";

describe("stageBriefingDraft", () => {
  it("기존 초안을 지우고 status=draft로 저장한다", async () => {
    const deleteEq = vi.fn(() => Promise.resolve({ error: null }));
    const insert = vi.fn(async (row: Record<string, unknown>) => {
      expect(row.status).toBe("draft");
      return { error: null };
    });
    adminFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ count: 1, error: null }),
      }),
      delete: () => ({ eq: deleteEq }),
      insert,
    }));

    const r = await stageBriefingDraft({
      dateLabel: "2026-07-31 (금)",
      contracts: { bySheet: [], totalDone: 0, totalOngoing: 0 },
    });

    expect(r.ok).toBe(true);
    expect(deleteEq).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it("호수는 published 행만 세어 매긴다", async () => {
    const eqSpy = vi.fn(() => Promise.resolve({ count: 3, error: null }));
    adminFrom.mockImplementation(() => ({
      select: () => ({ eq: eqSpy }),
      delete: () => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }),
      insert: vi.fn(async () => ({ error: null })),
    }));

    const r = await stageBriefingDraft({
      dateLabel: "2026-07-31 (금)",
      contracts: { bySheet: [], totalDone: 0, totalOngoing: 0 },
    });

    expect(r.ok && r.nextIssueNo).toBe(4);
    expect(eqSpy).toHaveBeenCalledWith("status", "published");
  });

  it("그룹채팅 티저를 보내지 않는다", async () => {
    adminFrom.mockImplementation(() => ({
      select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
      delete: () => ({ eq: vi.fn(() => Promise.resolve({ error: null })) }),
      insert: vi.fn(async () => ({ error: null })),
    }));
    process.env.TEAMS_BRIEFING_DRAFT_CHAT_ID = "";

    await stageBriefingDraft({
      dateLabel: "2026-07-31 (금)",
      contracts: { bySheet: [], totalDone: 0, totalOngoing: 0 },
    });

    expect(sendTeamsMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts`
Expected: FAIL — `stageBriefingDraft is not a function`

- [ ] **Step 3: `stageBriefingDraft` 구현**

`src/features/automations/jobs/team-briefing.ts`에서 `publishBriefing`을 아래로 교체한다:

```typescript
/** 발행분 수 + 1 — 초안은 세지 않는다(호수가 밀리지 않도록). */
async function nextIssueNo(
  admin: ReturnType<typeof createAdminClient>,
): Promise<{ ok: true; value: number } | { ok: false; message: string }> {
  const { count, error } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  if (error)
    return { ok: false, message: `브리핑 호수 조회 실패: ${error.message}` };
  return { ok: true, value: (count ?? 0) + 1 };
}

/**
 * 초안 저장 — 사람이 내용을 확인할 수 있도록 발행 전 단계에 세워둔다.
 * 그룹채팅 티저는 보내지 않는다. 본인 Teams 채팅으로만 미리보기 링크를 알린다.
 * 초안은 1건만 유지 — 새 초안이 이전 초안을 대체한다.
 */
export async function stageBriefingDraft(
  payload: BriefingPayload,
): Promise<
  | { ok: true; url: string; nextIssueNo: number; notified: boolean }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const issue = await nextIssueNo(admin);
  if (!issue.ok) return issue;

  const { error: delErr } = await admin
    .from("team_briefings")
    .delete()
    .eq("status", "draft");
  if (delErr)
    return { ok: false, message: `이전 초안 정리 실패: ${delErr.message}` };

  const shareToken = crypto.randomUUID().replace(/-/g, "");
  const { error: insErr } = await admin.from("team_briefings").insert({
    issue_no: issue.value,
    briefing_date: kstTodayYmd(),
    payload,
    share_token: shareToken,
    status: "draft",
  });
  if (insErr)
    return { ok: false, message: `초안 저장 실패: ${insErr.message}` };

  const url = briefingUrl(shareToken);
  const draftChatId = process.env.TEAMS_BRIEFING_DRAFT_CHAT_ID || "";
  if (!draftChatId)
    return { ok: true, url, nextIssueNo: issue.value, notified: false };

  const sender =
    process.env.TEAMS_BRIEFING_SENDER ||
    process.env.TEAMS_NOTICE_SENDER ||
    BRIEFING_SENDER_DEFAULT;
  try {
    await sendTeamsChatMessage({
      operatorEmail: sender,
      chatId: draftChatId,
      html: `<p><b>[운영부 상황실]</b> 주간 브리핑 초안 #${issue.value}호가 준비됐습니다.</p><p><a href="${url}">미리보기 열기</a></p><p>확인 후 자동화 페이지에서 발행하세요.</p>`,
    });
  } catch {
    // 알림 실패로 초안을 버리지 않는다. 호출부가 notified:false를 이력에 남긴다.
    return { ok: true, url, nextIssueNo: issue.value, notified: false };
  }
  return { ok: true, url, nextIssueNo: issue.value, notified: true };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts`
Expected: PASS

- [ ] **Step 5: `publishStagedDraft` 실패 테스트 작성**

같은 파일에 추가:

```typescript
import { publishStagedDraft } from "../team-briefing";

describe("publishStagedDraft", () => {
  it("status/published_at을 갱신하고 토큰은 그대로 두며 그룹 티저를 보낸다", async () => {
    const update = vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null })),
    }));
    adminFrom.mockImplementation(() => ({
      select: () => ({
        eq: (col: string) =>
          col === "status"
            ? Promise.resolve({ count: 1, error: null })
            : {
                maybeSingle: () =>
                  Promise.resolve({
                    data: {
                      id: "d1",
                      issue_no: 2,
                      share_token: "tok2",
                      payload: {
                        dateLabel: "2026-07-31 (금)",
                        contracts: {
                          bySheet: [],
                          totalDone: 0,
                          totalOngoing: 0,
                        },
                      },
                    },
                    error: null,
                  }),
              },
      }),
      update,
    }));
    process.env.TEAMS_NOTICE_CHAT_ID = "chat-group";

    const r = await publishStagedDraft("d1");

    expect(r.ok).toBe(true);
    expect(r.ok && r.url).toContain("/r/briefing/tok2");
    expect(sendTeamsMock).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" }),
    );
  });

  it("초안이 없으면 ok:false", async () => {
    adminFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }));
    const r = await publishStagedDraft("missing");
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts`
Expected: FAIL — `publishStagedDraft is not a function`

- [ ] **Step 7: `publishStagedDraft` 구현**

```typescript
/**
 * 초안 발행 확정 — 호수를 확정하고 그룹채팅 티저를 발송한다.
 * share_token은 초안 때 부여한 값을 유지한다(확인한 링크 = 팀에 나가는 링크).
 * 티저 발송 실패 시에도 발행 자체(status=published)는 되돌리지 않는다 — 링크는 이미 유효하다.
 */
export async function publishStagedDraft(
  draftId: string,
): Promise<
  | { ok: true; issueNo: number; url: string; sent: boolean }
  | { ok: false; message: string }
> {
  const admin = createAdminClient();
  const { data: draft } = await admin
    .from("team_briefings")
    .select("id, issue_no, share_token, payload")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false, message: "발행할 초안이 없습니다" };

  const issue = await nextIssueNo(admin);
  if (!issue.ok) return issue;

  const { error: updErr } = await admin
    .from("team_briefings")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      issue_no: issue.value,
    })
    .eq("id", draftId);
  if (updErr)
    return { ok: false, message: `발행 처리 실패: ${updErr.message}` };

  const payload = draft.payload as BriefingPayload;
  const url = briefingUrl(draft.share_token as string);
  const chatId = process.env.TEAMS_NOTICE_CHAT_ID || "";
  if (!chatId)
    return { ok: true, issueNo: issue.value, url, sent: false };

  const sender =
    process.env.TEAMS_BRIEFING_SENDER ||
    process.env.TEAMS_NOTICE_SENDER ||
    BRIEFING_SENDER_DEFAULT;
  const html = buildBriefingTeaserHtml({
    issueNo: issue.value,
    dateLabel: payload.dateLabel,
    headline: payload.story?.headline,
    teaser: payload.story?.teaser,
    contracts: payload.contracts,
    closing: payload.closing,
    aiWork: payload.aiWork,
    tips: payload.tips,
    url,
  });
  try {
    await sendTeamsChatMessage({ operatorEmail: sender, chatId, html });
  } catch (e) {
    return {
      ok: false,
      message: `발행됨(#${issue.value}) · Teams 발송 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  return { ok: true, issueNo: issue.value, url, sent: true };
}
```

- [ ] **Step 8: `runTeamBriefing`을 초안 생성으로 변경**

같은 파일 하단 `runTeamBriefing`에서 `publishBriefing(payload)` 호출을 `stageBriefingDraft(payload)`로 바꾸고, 성공 메시지를 초안 문구로 교체한다:

```typescript
  const staged = await stageBriefingDraft(payload);
  if (!staged.ok) return { ok: false, message: staged.message };
  return {
    ok: true,
    message: `초안 #${staged.nextIssueNo}호 생성 — 발행 대기${staged.notified ? "" : " (본인 Teams 알림 미설정)"}`,
  };
```

`chatId` 미설정 시 조기 반환하던 가드는 제거한다 — 초안 생성에는 그룹채팅이 필요 없다.
`details` 변수가 이 변경으로 미사용이 되면 함께 제거한다(본인 변경이 만든 orphan).

- [ ] **Step 9: 테스트 통과 확인**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts`
Expected: PASS. `runTeamBriefing` 기존 테스트가 발행을 기대하고 있으면 초안 기대로 수정한다.

- [ ] **Step 10: 커밋**

```bash
git add src/features/automations/jobs
git commit -m "feat(team-briefing): 초안 저장/발행 확정 분리, 호수는 발행분만 집계"
```

---

## Task 4: stage API 라우트 + 로컬 스크립트

**Files:**
- Create: `src/app/api/team-briefing/stage/route.ts`
- Delete: `src/app/api/team-briefing/publish/route.ts`
- Modify: `src/app/api/team-briefing/__tests__/routes.test.ts`
- Modify: `scripts/team-briefing/publish-local.mjs`

**Interfaces:**
- Consumes: `stageBriefingDraft` (Task 3)
- Produces: `POST /api/team-briefing/stage` — 응답 `{ ok, url, nextIssueNo }` 또는 `{ ok: true, skipped: true, message }`

- [ ] **Step 1: 라우트 파일 이동**

```bash
git mv src/app/api/team-briefing/publish/route.ts src/app/api/team-briefing/stage/route.ts
```

- [ ] **Step 2: 테스트를 stage 기대로 수정 (RED)**

`src/app/api/team-briefing/__tests__/routes.test.ts`:
- `vi.mock("@/features/automations/jobs/team-briefing", ...)`의 `publishBriefing: publishMock`을 `stageBriefingDraft: stageMock`으로 바꾼다.
- `import { POST } from "../publish/route";` → `from "../stage/route";`
- 성공 케이스 기대값 교체:

```typescript
  it("정상 — stageBriefingDraft에 payload 전달, url/nextIssueNo 반환", async () => {
    stageMock.mockResolvedValue({
      ok: true,
      url: "https://x/r/briefing/tok",
      nextIssueNo: 2,
      notified: true,
    });
    const res = await POST(
      post({ secret: "s3cr3t", body: { payload: samplePayload } }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.nextIssueNo).toBe(2);
    expect(json.url).toBe("https://x/r/briefing/tok");
    expect(stageMock).toHaveBeenCalledWith(
      expect.objectContaining({ dateLabel: "2026-07-17 (금)" }),
    );
  });

  it("초안 생성 시 실행 이력에 '초안 … 발행 대기' 기록", async () => {
    stageMock.mockResolvedValue({
      ok: true,
      url: "https://x/r/briefing/tok",
      nextIssueNo: 2,
      notified: true,
    });
    await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } }));
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({ ok: true, skipped: false }),
    );
  });

  it("본인 Teams 알림 미설정이면 이력 메시지에 남긴다", async () => {
    stageMock.mockResolvedValue({
      ok: true,
      url: "https://x/r/briefing/tok",
      nextIssueNo: 2,
      notified: false,
    });
    await POST(post({ secret: "s3cr3t", body: { payload: samplePayload } }));
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({
        message: expect.stringContaining("알림 미설정"),
      }),
    );
  });
```

`#917`에서 넣은 OFF 게이트 테스트("자동 실행 OFF면 발행하지 않고 skipped:true")는 `publishMock` → `stageMock`으로 이름만 바꿔 유지한다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `npx vitest run src/app/api/team-briefing`
Expected: FAIL — stage 라우트가 아직 `publishBriefing`을 호출

- [ ] **Step 4: 라우트 구현**

`src/app/api/team-briefing/stage/route.ts` 본문에서 `publishBriefing` 호출부를 교체:

```typescript
import { stageBriefingDraft } from "@/features/automations/jobs/team-briefing";
```

```typescript
  const startedMs = Date.now();
  const r = await stageBriefingDraft(payload);
  await recordAutomationRun(JOB_ID, {
    ok: r.ok,
    skipped: false,
    message: r.ok
      ? `초안 #${r.nextIssueNo}호 생성 — 발행 대기${r.notified ? "" : " (본인 Teams 알림 미설정)"}`
      : r.message,
    durationMs: Date.now() - startedMs,
  });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    url: r.url,
    nextIssueNo: r.nextIssueNo,
  });
```

주석 블록의 "발행" 문구도 "초안 저장"으로 갱신한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run src/app/api/team-briefing`
Expected: PASS

- [ ] **Step 6: 로컬 스크립트 엔드포인트 변경**

`scripts/team-briefing/publish-local.mjs`:
- 헤더 주석의 흐름 설명을 `POST /api/team-briefing/stage(초안 저장)`으로 갱신
- 3단계 fetch URL을 `${BASE}/api/team-briefing/stage`로 변경
- 성공 로그 교체:

```javascript
console.log(
  `[briefing] 초안 #${pub.nextIssueNo}호 저장 완료 — ${pub.url} (자동화 페이지에서 발행)`,
);
```

- [ ] **Step 7: 커밋**

```bash
git add src/app/api/team-briefing scripts/team-briefing/publish-local.mjs
git commit -m "feat(team-briefing): 로컬 스케줄러를 초안 저장(stage)까지로 제한"
```

---

## Task 5: 발행 확정 server action

**Files:**
- Modify: `src/features/automations/schemas.ts`
- Modify: `src/features/automations/actions.ts`
- Test: `src/features/automations/__tests__/schemas.test.ts`, `src/features/automations/__tests__/actions.test.ts`

**Interfaces:**
- Consumes: `publishStagedDraft` (Task 3)
- Produces: `publishBriefingDraftAction(prev, formData): Promise<RunActionState>` — Task 6(UI)이 `useActionState`로 소비. formData 필드명 `draftId`.

- [ ] **Step 1: 스키마 테스트 (RED)**

`src/features/automations/__tests__/schemas.test.ts`에 추가:

```typescript
import { publishBriefingDraftInputSchema } from "../schemas";

describe("publishBriefingDraftInputSchema", () => {
  it("uuid draftId 허용", () => {
    expect(
      publishBriefingDraftInputSchema.safeParse({
        draftId: "11111111-2222-3333-4444-555555555555",
      }).success,
    ).toBe(true);
  });
  it("빈 값 거부", () => {
    expect(
      publishBriefingDraftInputSchema.safeParse({ draftId: "" }).success,
    ).toBe(false);
  });
});
```

Run: `npx vitest run src/features/automations/__tests__/schemas.test.ts` → FAIL

- [ ] **Step 2: 스키마 구현**

`src/features/automations/schemas.ts`:

```typescript
export const publishBriefingDraftInputSchema = z.object({
  draftId: z.string().uuid(),
});

export type PublishBriefingDraftInput = z.infer<
  typeof publishBriefingDraftInputSchema
>;
```

Run: `npx vitest run src/features/automations/__tests__/schemas.test.ts` → PASS

- [ ] **Step 3: 액션 테스트 (RED)**

`src/features/automations/__tests__/actions.test.ts`에 추가. 기존 파일의 `requireAdmin` 모킹 방식을 그대로 따른다:

```typescript
describe("publishBriefingDraftAction", () => {
  it("draftId 누락이면 ok:false", async () => {
    const f = new FormData();
    const r = await publishBriefingDraftAction(undefined, f);
    expect(r?.ok).toBe(false);
  });

  it("정상 — publishStagedDraft 호출 + 실행 이력 기록", async () => {
    publishStagedDraftMock.mockResolvedValue({
      ok: true,
      issueNo: 2,
      url: "https://x/r/briefing/tok",
      sent: true,
    });
    const f = new FormData();
    f.set("draftId", "11111111-2222-3333-4444-555555555555");
    const r = await publishBriefingDraftAction(undefined, f);
    expect(r?.ok).toBe(true);
    expect(recordRunMock).toHaveBeenCalledWith(
      "team-briefing",
      expect.objectContaining({ ok: true }),
    );
  });
});
```

Run: `npx vitest run src/features/automations/__tests__/actions.test.ts` → FAIL

- [ ] **Step 4: 액션 구현**

`src/features/automations/actions.ts`:

```typescript
/**
 * 초안 발행 확정 — 자동화 페이지 [발행] 버튼. admin 전용.
 * 사람이 미리보기로 내용을 확인한 뒤에만 그룹채팅 티저가 나간다.
 */
export async function publishBriefingDraftAction(
  _prev: RunActionState,
  formData: FormData,
): Promise<RunActionState> {
  await requireAdmin();

  const parsed = publishBriefingDraftInputSchema.safeParse({
    draftId: formData.get("draftId"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const startedMs = Date.now();
  const r = await publishStagedDraft(parsed.data.draftId);
  const message = r.ok
    ? `#${r.issueNo}호 발행 (Teams ${r.sent ? "발송" : "생략"}) — ${r.url}`
    : r.message;
  await recordAutomationRun("team-briefing", {
    ok: r.ok,
    skipped: false,
    message,
    durationMs: Date.now() - startedMs,
  });
  revalidatePath("/dashboard/automations");
  return { ok: r.ok, message };
}
```

import 추가: `publishBriefingDraftInputSchema` (./schemas), `publishStagedDraft` (./jobs/team-briefing).

Run: `npx vitest run src/features/automations/__tests__/actions.test.ts` → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/automations
git commit -m "feat(team-briefing): 초안 발행 확정 server action 추가"
```

---

## Task 6: 자동화 페이지 초안 대기 UI

**Files:**
- Modify: `src/features/team-briefings/queries.ts` (대기 초안 조회)
- Modify: `src/features/automations/types.ts` (`AutomationStatus.pendingDraft`)
- Modify: `src/features/automations/queries.ts` (`getAutomationStatuses`에 부착)
- Modify: `src/app/dashboard/automations/_components/AutomationHub.tsx`
- Test: `src/features/automations/__tests__/queries.test.ts`

**Interfaces:**
- Consumes: `publishBriefingDraftAction` (Task 5)
- Produces: `AutomationStatus.pendingDraft?: { id: string; issueNo: number; url: string; createdAt: string }`

- [ ] **Step 1: 대기 초안 조회 함수 (RED)**

`src/features/team-briefings/__tests__/queries.test.ts`에 추가:

```typescript
import { getPendingBriefingDraft } from "../queries";

describe("getPendingBriefingDraft", () => {
  it("초안 없으면 null", async () => {
    state.result = { data: null, error: null };
    expect(await getPendingBriefingDraft()).toBeNull();
  });
});
```

Run: `npx vitest run src/features/team-briefings` → FAIL

- [ ] **Step 2: 구현**

`src/features/team-briefings/queries.ts`:

```typescript
export type PendingBriefingDraft = {
  id: string;
  issueNo: number;
  url: string;
  createdAt: string;
};

/** 발행 대기 중인 초안 1건 — 없으면 null. 자동화 페이지 [미리보기]/[발행]에 쓴다. */
export async function getPendingBriefingDraft(): Promise<PendingBriefingDraft | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("team_briefings")
    .select("id, issue_no, share_token, created_at")
    .eq("status", "draft")
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    issueNo: data.issue_no as number,
    url: briefingUrl(data.share_token as string),
    createdAt: data.created_at as string,
  };
}
```

import 추가: `briefingUrl` (./url).

Run: `npx vitest run src/features/team-briefings` → PASS

- [ ] **Step 3: AutomationStatus에 필드 추가**

`src/features/automations/types.ts`:

```typescript
  pendingDraft?: {
    id: string;
    issueNo: number;
    url: string;
    createdAt: string;
  };
```

`src/features/automations/queries.ts`의 `getAutomationStatuses` 루프에서 team-briefing일 때만 채운다:

```typescript
    const pendingDraft =
      job.id === "team-briefing"
        ? ((await getPendingBriefingDraft()) ?? undefined)
        : undefined;
```

`out.push({ ..., pendingDraft })`로 전달한다.

- [ ] **Step 4: UI — 초안 대기 줄**

`AutomationHub.tsx`의 `AutomationRow` 스케줄 셀(`status.scheduleInfo` 아래) 뒤에 추가:

```tsx
        {status.pendingDraft && (
          <div className="mt-1 text-[11px] text-vermilion">
            초안 #{status.pendingDraft.issueNo}호 발행 대기
          </div>
        )}
```

`RunControl` 셀을 감싸는 `<td>`에 초안 액션을 붙인다 — `status.pendingDraft`가 있으면 `RunControl` 대신 아래를 렌더:

```tsx
function DraftControl({
  draft,
  isAdmin,
}: {
  draft: NonNullable<AutomationStatus["pendingDraft"]>;
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<RunActionState, FormData>(
    publishBriefingDraftAction,
    undefined,
  );
  return (
    <div className="flex flex-col items-start gap-1">
      <a
        href={draft.url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-vermilion underline underline-offset-2"
      >
        미리보기 →
      </a>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (!isAdmin) {
            e.preventDefault();
            alert(ADMIN_ONLY_MSG);
          }
        }}
      >
        <input type="hidden" name="draftId" value={draft.id} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-fit items-center border border-vermilion bg-vermilion cursor-pointer px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "발행 중…" : "발행"}
        </button>
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

- [ ] **Step 5: 타입·린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors

- [ ] **Step 6: 커밋**

```bash
git add src/features src/app/dashboard/automations
git commit -m "feat(team-briefing): 자동화 페이지 초안 대기 표시 + 미리보기/발행"
```

---

## Task 7: 미리보기 페이지 초안 배너

**Files:**
- Modify: `src/app/r/briefing/[token]/page.tsx`
- Test: `src/app/r/briefing/[token]/_components/__tests__/` 에 신규 배너 컴포넌트 테스트(선택) 또는 페이지 단위 확인

**Interfaces:**
- Consumes: `TeamBriefing.status` (Task 1)

- [ ] **Step 1: 배너 추가**

`src/app/r/briefing/[token]/page.tsx`:

```tsx
    <main className="min-h-screen bg-white">
      {briefing.status === "draft" && (
        <div className="border-b border-line bg-situation-bg px-4 py-3 text-center text-sm text-vermilion">
          초안입니다 — 아직 발행되지 않았습니다.
        </div>
      )}
      <BriefingNewsletter
        issueNo={briefing.issueNo}
        payload={briefing.payload}
      />
    </main>
```

- [ ] **Step 2: 타입·린트 확인**

Run: `npm run typecheck && npm run lint`
Expected: 0 errors

- [ ] **Step 3: 커밋**

```bash
git add src/app/r/briefing
git commit -m "feat(team-briefing): 미리보기에 초안 배너 표시"
```

---

## Task 8: 초안 알림 채팅 ID 설정 + 문서

**Files:**
- Modify: `CLAUDE.md`
- Modify: `scripts/team-briefing/README.md`

Graph `/chats` 조회는 위임 토큰이 필요해 기존 `.mjs`(client_credentials) 방식으로는 안 된다.
채팅 ID는 Teams 클라이언트에서 직접 얻는다.

- [ ] **Step 1: 채팅 ID 확보 (수동, 1회)**

1. Teams에서 본인과의 채팅(또는 알림받을 1:1 채팅)을 연다
2. 채팅 상단 `⋯` → **채팅 링크 복사**
3. 복사된 URL에서 `19:` 로 시작해 `@thread.v2` 로 끝나는 구간이 chat ID다
   예: `https://teams.microsoft.com/l/chat/19%3Aabc...%40thread.v2/0` → `19:abc...@thread.v2`
   (URL 인코딩된 `%3A`→`:`, `%40`→`@` 로 되돌린다)
4. `.env.local`과 Vercel 환경변수에 `TEAMS_BRIEFING_DRAFT_CHAT_ID`로 등록

미설정 상태로 두어도 초안은 정상 저장되며, 실행 로그에 "본인 Teams 알림 미설정"이 남는다.

- [ ] **Step 2: 문서 갱신**

`CLAUDE.md`의 자동화 잡 표에서 `team-briefing` 행 설명을 초안→확인→발행 흐름으로 갱신한다.
`scripts/team-briefing/README.md`에 위 Step 1의 `TEAMS_BRIEFING_DRAFT_CHAT_ID` 설정 절차를 추가한다.

- [ ] **Step 3: 커밋**

```bash
git add scripts/team-briefing CLAUDE.md
git commit -m "docs(team-briefing): 초안 알림 채팅 ID 설정 절차 + 흐름 문서 갱신"
```

---

## 최종 검증

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 errors
- [ ] `npx vitest run src/features/automations src/features/team-briefings src/app/api/team-briefing src/app/dashboard/automations` — 전부 통과
- [ ] PR 생성 → CI `build-check`(전체 vitest + production build) 통과 확인
- [ ] 라이브 검증 (배포 후):
  - 토글 ON으로 전환
  - `node scripts/team-briefing/publish-local.mjs` 실행 → 초안 저장 + 본인 Teams 알림 수신 + 그룹채팅에는 **아무것도 안 감**
  - 자동화 페이지에 "초안 #2호 발행 대기" 표시 확인, [미리보기]로 내용 확인
  - [발행] 클릭 → 그룹채팅 티저 수신, 실행 로그에 `#2호 · 링크` 표시
- [ ] Windows 작업 `OPS-Console-Team-Briefing` 재활성화 (`Enable-ScheduledTask`)

## 롤백

`status` 컬럼은 default `published`라 코드를 되돌려도 기존 발행분은 그대로 읽힌다.
초안 행이 남아 있으면 `delete from team_briefings where status = 'draft'`로 정리한다.
