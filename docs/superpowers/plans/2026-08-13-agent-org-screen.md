# 에이전트 조직 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자동화 잡 17개와 레지스트리 밖 자동 실행 3건을 파이프라인 4단계 + 조율로 묶어 카드 격자로 보여주고, 조직도가 현실과 갈라지면 CI가 막게 한다.

**Architecture:** 팀 정의는 `features/agent-org/registry.ts` 순수 데이터 한 곳. 잡 라벨은 복사하지 않고 `automations/registry.ts`에서 `jobId`로 조회한다. 조회·조립은 순수 함수 `resolve.ts`가 하고(테스트 가능), 페이지는 RSC라 `server-only` 레지스트리를 직접 import한다. 화면은 인사이트 영상 카드와 같은 3열 격자.

**Tech Stack:** Next.js App Router (RSC), TypeScript, Tailwind (디자인 토큰), Vitest + @testing-library/react

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-08-13-agent-org-design.md` (권위 있는 출처)
- 하드코딩 색상 금지 — Tailwind 토큰만 (`bg-situation-bg` / `border-line` / `text-ink` / `text-muted` / `text-faint`)
- 배지는 공통 규칙만 사용 — `statusBadgeTone()`. **새 라벨을 `badge-tone.ts`에 추가하지 않는다**
- 미구현 자리 라벨은 **`예정`**. `준비 중`은 `중`으로 끝나 규칙이 진행(빨강)으로 판정한다 (2026-08-13 실측 확인)
- `any` / `@ts-ignore` / `eslint-disable` / `!` 단언 금지
- 폴백 로직 금지 — 불가능한 상태는 조용히 넘기지 말고 던진다
- 테스트 먼저(RED) → 최소 구현(GREEN) → 커밋. 가드는 **역검증**으로 실제 실패를 확인한다
- 훅 우회 금지 — Bash/Python/셸 리다이렉션으로 파일을 고치지 않는다. 막히면 BLOCKED로 보고한다
- 커밋 메시지는 Conventional Commits, 한국어 본문

## 범위 밖

탭(현황·에이전트·채널) · 카드 클릭 이동 · 팀장 LLM 구현 · `agent_traces` · `automations/registry.ts` 편입.

---

### Task 1: 조직 데이터와 갈라짐 방지 가드

조직도가 현실과 갈라지지 않게 막는 것이 이 기능의 핵심이다. 데이터와 가드를 함께 만든다.

**Files:**
- Create: `src/features/agent-org/types.ts`
- Create: `src/features/agent-org/registry.ts`
- Test: `src/features/agent-org/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: `AUTOMATION_JOBS` from `@/features/automations/registry` (테스트에서만; vitest가 `server-only`를 빈 모듈로 alias 한다 — `vitest.config.ts:9-15`)
- Produces: `AGENT_TEAMS: readonly AgentTeam[]`, 타입 `AgentTeam` / `AgentMember` / `AgentMemberSource`

- [ ] **Step 1: 타입을 쓴다**

`src/features/agent-org/types.ts`:

```ts
/**
 * 팀원의 출처 — 판별 유니온이라 "정확히 하나"가 컴파일 시점에 강제된다.
 *
 * 레지스트리가 자동 실행의 전부가 아니다(2026-08-13 확인). 실패 알림은 잡이 아니라
 * recordAutomationRun 직후 도는 상시 동작이고, 백업·자료 요청 예약 발송은
 * cron-job.org가 5분마다 때리는 별도 엔드포인트다. 이들을 "예정"으로 두면
 * 돌고 있는 것을 안 돈다고 표시하게 된다.
 */
export type AgentMemberSource =
  | { kind: "job"; jobId: string }
  | { kind: "outside"; path: string; note: string }
  | { kind: "planned" };

export type AgentMember = {
  /** 카드 좌측 라벨 — "마감", "입금" 처럼 짧게 */
  role: string;
  /** kebab-case 식별자 — 전 팀에서 유일해야 한다 */
  agent: string;
  /** LLM으로 판단하는 자리. 화면에 ✦ */
  llm?: boolean;
  source: AgentMemberSource;
};

export type AgentTeam = {
  id: string;
  name: string;
  leader: { name: string; tagline: string };
  /** 성향 칩 — 읽기 전용 라벨이라 호버·선택 인터랙션을 주지 않는다 */
  traits: string[];
  members: AgentMember[];
};
```

- [ ] **Step 2: 실패하는 가드를 쓴다**

`src/features/agent-org/__tests__/registry.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { AGENT_TEAMS } from "../registry";
import { AUTOMATION_JOBS } from "@/features/automations/registry";

/**
 * 조직도가 현실과 갈라지는 것을 막는다.
 *
 * 2026-08-13 하루에 같은 구조의 사고를 세 번 겪었다(날짜 입력·버튼 표준·팀 값).
 * 전부 "타입 검사도 CI도 통과하는데 화면만 틀린" 종류였다. 조직도는 사람이 손으로
 * 유지하는 목록이라 같은 실패에 가장 취약하다.
 *
 * 보증 범위: 레지스트리 잡 17개만 완전성을 본다. kind:"outside" 셋은 손으로 적은
 * 것이라, 레지스트리 밖에 네 번째가 새로 생기면 이 테스트가 못 잡는다
 * (CRON_SECRET 엔드포인트 15개의 역할이 셋으로 섞여 있어 자동 판정 시 오탐).
 */
const allMembers = AGENT_TEAMS.flatMap((t) =>
  t.members.map((m) => ({ team: t.name, ...m })),
);

describe("에이전트 조직 레지스트리", () => {
  it("모든 jobId가 자동화 레지스트리에 실재한다", () => {
    const known = new Set(AUTOMATION_JOBS.map((j) => j.id));
    for (const m of allMembers) {
      if (m.source.kind !== "job") continue;
      expect(known, `${m.team} ${m.agent}의 jobId`).toContain(m.source.jobId);
    }
  });

  it("레지스트리 잡이 각각 정확히 한 팀에 속한다", () => {
    const placed = allMembers
      .filter((m) => m.source.kind === "job")
      .map((m) => (m.source.kind === "job" ? m.source.jobId : ""));
    const missing = AUTOMATION_JOBS.map((j) => j.id).filter(
      (id) => !placed.includes(id),
    );
    const duplicated = placed.filter(
      (id, i) => placed.indexOf(id) !== i,
    );
    expect(missing, "조직도에 배치되지 않은 잡").toEqual([]);
    expect(duplicated, "두 팀에 중복 배치된 잡").toEqual([]);
  });

  it("outside 경로의 파일이 실재한다", () => {
    for (const m of allMembers) {
      if (m.source.kind !== "outside") continue;
      const rel = m.source.path.startsWith("/api/")
        ? join("src", "app", m.source.path.slice(1), "route.ts")
        : join("src", m.source.path);
      expect(existsSync(join(process.cwd(), rel)), `${m.agent} → ${rel}`).toBe(
        true,
      );
    }
  });

  it("에이전트 이름이 전 팀에서 유일하다", () => {
    const names = allMembers.map((m) => m.agent);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dup, "중복된 에이전트 이름").toEqual([]);
  });

  it("에이전트 이름이 kebab-case다", () => {
    for (const m of allMembers) {
      expect(m.agent, `${m.team} ${m.role}`).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    }
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/features/agent-org/__tests__/registry.test.ts`
Expected: FAIL — `Failed to resolve import "../registry"` (아직 파일이 없다)

- [ ] **Step 4: 조직 데이터를 쓴다**

`src/features/agent-org/registry.ts`:

```ts
import type { AgentTeam } from "./types";

/**
 * 팀 정의의 단일 소스. 화면·테스트가 여기서만 읽는다.
 *
 * 잡의 라벨·설명을 여기 복사하지 않는다 — automations/registry.ts에서 jobId로 찾아
 * 렌더한다. 복사하면 잡 설명을 고칠 때 두 곳이 되고 한쪽만 고쳐진다(#963에서 겪음).
 *
 * 팀장 이름은 성을 뺀 이름만 쓴다. 사내 별칭으로 읽히게 하려는 것이고, 실존 인물을
 * 그대로 지칭하지 않기 위해서다. 팀이 늘면 같은 계열(축구)에서 고른다.
 */
export const AGENT_TEAMS: readonly AgentTeam[] = [
  {
    id: "collect",
    name: "수집팀",
    leader: {
      name: "지성",
      tagline: "두 개의 심장 — 90분 내내 온 그라운드를 돈다",
    },
    traits: ["완주", "빠짐없이", "현장확인", "반복내성"],
    members: [
      { role: "마감", agent: "closing-scraper", source: { kind: "job", jobId: "closing-scrape" } },
      { role: "메일", agent: "mail-ingestor", llm: true, source: { kind: "job", jobId: "mailbox-ingest" } },
      { role: "영상", agent: "insight-collector", source: { kind: "job", jobId: "insights-collect" } },
      { role: "뉴스", agent: "news-collector", source: { kind: "job", jobId: "news-collect" } },
      { role: "오픈소스", agent: "tip-scout", source: { kind: "job", jobId: "ai-tips-collect" } },
    ],
  },
  {
    id: "judge",
    name: "판단팀",
    leader: {
      name: "성용",
      tagline: "중원에서 각을 읽고 어디로 갈지 정한다",
    },
    traits: ["대조", "근거우선", "의심", "예외기억"],
    members: [
      { role: "세팅", agent: "ratio-auditor", llm: true, source: { kind: "job", jobId: "ratio-audit" } },
      { role: "링크", agent: "page-checker", source: { kind: "job", jobId: "ratio-page-check" } },
      { role: "입금", agent: "deposit-matcher", source: { kind: "job", jobId: "receivables-deposit-match" } },
      { role: "계약", agent: "contract-snapshotter", source: { kind: "job", jobId: "contract-completion-snapshot" } },
    ],
  },
  {
    id: "deliver",
    name: "전달팀",
    leader: {
      name: "강인",
      tagline: "킥이 정확하다 — 원하는 발밑에 꽂는다",
    },
    traits: ["정확한수신자", "절제", "브랜드일관", "오발신방지"],
    members: [
      { role: "독려(외부)", agent: "school-reminder", source: { kind: "job", jobId: "receivables-mail-school" } },
      { role: "독려(내부)", agent: "operator-reminder", source: { kind: "job", jobId: "receivables-mail-operator" } },
      { role: "세금", agent: "edi-notifier", source: { kind: "job", jobId: "smileedi-mail" } },
      { role: "서비스", agent: "service-notifier", source: { kind: "job", jobId: "service-notice-mail" } },
      { role: "공지", agent: "notice-broadcaster", source: { kind: "job", jobId: "notice-teams-share" } },
      { role: "소식지", agent: "briefing-writer", llm: true, source: { kind: "job", jobId: "team-briefing" } },
      { role: "보고", agent: "weekly-report-notifier", source: { kind: "job", jobId: "weekly-report-rollover" } },
      {
        role: "백업 예약",
        agent: "backup-dispatcher",
        source: {
          kind: "outside",
          path: "/api/backup-requests/dispatch",
          note: "예약된 백업 요청 발송 · 5분마다",
        },
      },
      {
        role: "자료 예약",
        agent: "data-request-dispatcher",
        source: {
          kind: "outside",
          path: "/api/data-requests/dispatch",
          note: "예약된 자료 요청 발송 · 5분마다",
        },
      },
    ],
  },
  {
    id: "observe",
    name: "관측팀",
    leader: {
      name: "현우",
      tagline: "골문 뒤에서 전체를 보고 먼저 소리친다",
    },
    traits: ["무소식감지", "소음억제", "비용추적", "조용함"],
    members: [
      { role: "일일", agent: "digest-reporter", source: { kind: "job", jobId: "automation-digest" } },
      {
        role: "실패",
        agent: "failure-watcher",
        source: {
          kind: "outside",
          path: "features/automations/failure-notify.ts",
          note: "실패 즉시 알림 · 중복 억제",
        },
      },
      { role: "추적", agent: "trace-recorder", source: { kind: "planned" } },
    ],
  },
  {
    id: "coordinate",
    name: "조율",
    leader: {
      name: "명보",
      tagline: "감독 — 누구를 언제 넣을지 정한다",
    },
    traits: ["확인게이트", "권한분리", "모르면모른다", "대신실행"],
    // 팀원 없이 직접 수행한다. 운영자 질문을 받아 어느 팀의 일인지 정하고
    // 승인받아 대신 실행한다. 본체 설계는 2026-08-10-assistant-system-agent-design.md
    members: [],
  },
];
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/features/agent-org/__tests__/registry.test.ts`
Expected: PASS (5건)

- [ ] **Step 6: 가드가 실제로 잡는지 역검증한다**

`registry.ts`에서 수집팀의 `news-collector` 한 줄을 **주석 처리**하고 테스트를 돌린다.

Run: `npx vitest run src/features/agent-org/__tests__/registry.test.ts`
Expected: FAIL — `조직도에 배치되지 않은 잡: expected [ 'news-collect' ] to deeply equal []`

확인했으면 주석을 **되돌린다**. 다시 돌려 5건 통과를 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add src/features/agent-org
git commit -m "feat(agent-org): 파이프라인 4단계 조직 정의와 갈라짐 방지 가드"
```

---

### Task 2: 화면용 조립 함수

카드가 쓸 모양으로 바꾸는 순수 함수. `server-only`를 import하지 않아 단위 테스트가 가능하다.

**Files:**
- Create: `src/features/agent-org/resolve.ts`
- Test: `src/features/agent-org/__tests__/resolve.test.ts`

**Interfaces:**
- Consumes: `AgentTeam` from `./types` (Task 1)
- Produces:
  - `buildJobLabels(jobs: readonly { id: string; label: string }[]): ReadonlyMap<string, string>`
  - `resolveTeam(team: AgentTeam, labels: ReadonlyMap<string, string>): ResolvedTeam`
  - 타입 `ResolvedTeam` / `ResolvedMember`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/agent-org/__tests__/resolve.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildJobLabels, resolveTeam } from "../resolve";
import type { AgentTeam } from "../types";

const labels = buildJobLabels([
  { id: "closing-scrape", label: "서비스 마감 스크래핑" },
]);

const team: AgentTeam = {
  id: "collect",
  name: "수집팀",
  leader: { name: "지성", tagline: "온 그라운드를 돈다" },
  traits: ["완주"],
  members: [
    { role: "마감", agent: "closing-scraper", source: { kind: "job", jobId: "closing-scrape" } },
    { role: "실패", agent: "failure-watcher", source: { kind: "outside", path: "features/automations/failure-notify.ts", note: "실패 즉시 알림" } },
    { role: "추적", agent: "trace-recorder", source: { kind: "planned" } },
  ],
};

describe("resolveTeam", () => {
  it("잡 팀원은 레지스트리 라벨을 detail로 쓴다", () => {
    const r = resolveTeam(team, labels);
    expect(r.members[0].detail).toBe("서비스 마감 스크래핑");
    expect(r.members[0].planned).toBe(false);
  });

  it("outside 팀원은 직접 쓴 설명을 detail로 쓴다", () => {
    const r = resolveTeam(team, labels);
    expect(r.members[1].detail).toBe("실패 즉시 알림");
    expect(r.members[1].planned).toBe(false);
  });

  it("planned 팀원만 planned=true다", () => {
    const r = resolveTeam(team, labels);
    expect(r.members[2].planned).toBe(true);
    expect(r.members[2].detail).toBe("");
  });

  it("팀장·성향을 그대로 옮긴다", () => {
    const r = resolveTeam(team, labels);
    expect(r.leaderName).toBe("지성");
    expect(r.tagline).toBe("온 그라운드를 돈다");
    expect(r.traits).toEqual(["완주"]);
  });

  it("없는 jobId는 조용히 넘기지 않고 던진다", () => {
    const broken: AgentTeam = {
      ...team,
      members: [
        { role: "x", agent: "ghost", source: { kind: "job", jobId: "no-such-job" } },
      ],
    };
    expect(() => resolveTeam(broken, labels)).toThrow(/no-such-job/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/agent-org/__tests__/resolve.test.ts`
Expected: FAIL — `Failed to resolve import "../resolve"`

- [ ] **Step 3: 구현한다**

`src/features/agent-org/resolve.ts`:

```ts
import type { AgentTeam } from "./types";

export type ResolvedMember = {
  role: string;
  agent: string;
  llm: boolean;
  /** 화면에 적을 한 줄. planned면 빈 문자열 */
  detail: string;
  planned: boolean;
};

export type ResolvedTeam = {
  id: string;
  name: string;
  leaderName: string;
  tagline: string;
  traits: string[];
  members: ResolvedMember[];
};

/** jobId → label. 잡 라벨을 조직 레지스트리에 복사하지 않기 위한 조회표. */
export function buildJobLabels(
  jobs: readonly { id: string; label: string }[],
): ReadonlyMap<string, string> {
  return new Map(jobs.map((j) => [j.id, j.label]));
}

export function resolveTeam(
  team: AgentTeam,
  labels: ReadonlyMap<string, string>,
): ResolvedTeam {
  return {
    id: team.id,
    name: team.name,
    leaderName: team.leader.name,
    tagline: team.leader.tagline,
    traits: team.traits,
    members: team.members.map((m) => {
      const base = { role: m.role, agent: m.agent, llm: m.llm ?? false };
      if (m.source.kind === "planned") {
        return { ...base, detail: "", planned: true };
      }
      if (m.source.kind === "outside") {
        return { ...base, detail: m.source.note, planned: false };
      }
      const label = labels.get(m.source.jobId);
      if (label === undefined) {
        // registry.test.ts가 막는 상태다. 조용히 jobId로 대체하면 화면이 그럴듯하게
        // 틀린 채 남으므로 크게 실패시킨다.
        throw new Error(
          `조직도가 없는 잡을 가리킨다: ${m.agent} → ${m.source.jobId}`,
        );
      }
      return { ...base, detail: label, planned: false };
    }),
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/agent-org/__tests__/resolve.test.ts`
Expected: PASS (5건)

- [ ] **Step 5: 커밋**

```bash
git add src/features/agent-org/resolve.ts src/features/agent-org/__tests__/resolve.test.ts
git commit -m "feat(agent-org): 화면용 조립 함수와 없는 잡 즉시 실패"
```

---

### Task 3: 팀 카드 컴포넌트

인사이트 영상 카드(`VideoGrid.tsx:20-26`)와 같은 규격. 정적이라 `"use client"`를 붙이지 않는다.

**Files:**
- Create: `src/app/dashboard/agents/_components/TeamCard.tsx`
- Test: `src/app/dashboard/agents/_components/__tests__/TeamCard.test.tsx`

**Interfaces:**
- Consumes: `ResolvedTeam` from `@/features/agent-org/resolve` (Task 2), `statusBadgeTone` / `BADGE_TONE` from `@/app/dashboard/_components/inspector/list-variants/badge-tone`
- Produces: `<TeamCard team={ResolvedTeam} />`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/dashboard/agents/_components/__tests__/TeamCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TeamCard } from "../TeamCard";
import { BADGE_TONE } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
import type { ResolvedTeam } from "@/features/agent-org/resolve";

const team: ResolvedTeam = {
  id: "judge",
  name: "판단팀",
  leaderName: "성용",
  tagline: "중원에서 각을 읽고 어디로 갈지 정한다",
  traits: ["대조", "의심"],
  members: [
    { role: "세팅", agent: "ratio-auditor", llm: true, detail: "경쟁률 세팅 점검", planned: false },
    { role: "입금", agent: "deposit-matcher", llm: false, detail: "입금 매칭 자동화", planned: false },
    { role: "추적", agent: "trace-recorder", llm: false, detail: "", planned: true },
  ],
};

describe("TeamCard", () => {
  it("팀 이름·팀장·한 줄 설명을 보여준다", () => {
    render(<TeamCard team={team} />);
    expect(screen.getByText("판단팀")).toBeInTheDocument();
    expect(screen.getByText("성용")).toBeInTheDocument();
    expect(
      screen.getByText("중원에서 각을 읽고 어디로 갈지 정한다"),
    ).toBeInTheDocument();
  });

  it("성향 칩을 전부 보여준다", () => {
    render(<TeamCard team={team} />);
    expect(screen.getByText("대조")).toBeInTheDocument();
    expect(screen.getByText("의심")).toBeInTheDocument();
  });

  it("팀원의 역할·이름·설명을 보여준다", () => {
    render(<TeamCard team={team} />);
    expect(screen.getByText("ratio-auditor")).toBeInTheDocument();
    expect(screen.getByText("경쟁률 세팅 점검")).toBeInTheDocument();
  });

  it("LLM으로 판단하는 자리에만 ✦를 붙인다", () => {
    render(<TeamCard team={team} />);
    const marks = screen.getAllByTitle("LLM으로 판단합니다");
    expect(marks).toHaveLength(1);
  });

  it("미구현 자리에만 예정 배지를 붙이고 공통 규칙 색을 쓴다", () => {
    render(<TeamCard team={team} />);
    const badges = screen.getAllByText("예정");
    expect(badges).toHaveLength(1);
    // '준비 중'은 '중'으로 끝나 규칙이 진행(빨강)으로 판정한다. '예정'이라야 대기(회색)다.
    expect(badges[0]).toHaveClass(...BADGE_TONE.idle.split(" "));
  });

  it("팀원이 없으면 직접 수행이라고 말한다", () => {
    render(<TeamCard team={{ ...team, members: [] }} />);
    expect(screen.getByText("직접 수행")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/dashboard/agents/_components/__tests__/TeamCard.test.tsx`
Expected: FAIL — `Failed to resolve import "../TeamCard"`

- [ ] **Step 3: 구현한다**

`src/app/dashboard/agents/_components/TeamCard.tsx`:

```tsx
import { statusBadgeTone } from "@/app/dashboard/_components/inspector/list-variants/badge-tone";
import type { ResolvedTeam } from "@/features/agent-org/resolve";

/**
 * 미구현 자리 라벨. '준비 중'을 쓰면 '중'으로 끝나 공통 규칙이 진행(빨강)으로
 * 판정한다 — 대기(회색)로 보이게 하려면 이 라벨이라야 한다.
 */
const PLANNED_LABEL = "예정";

/** 성향 칩 — 누를 수 없으므로 호버·선택 인터랙션 표준을 적용하지 않는다. */
function TraitChip({ label }: { label: string }) {
  return (
    <span className="inline-block border border-line-soft px-1.5 py-0.5 text-2xs text-muted">
      {label}
    </span>
  );
}

export function TeamCard({ team }: { team: ResolvedTeam }) {
  return (
    <section className="flex flex-col gap-3 border border-line bg-situation-bg p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold text-ink">{team.name}</h2>
        <span className="text-xs text-muted">{team.leaderName}</span>
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">{team.tagline}</p>

      <div className="flex flex-wrap gap-1">
        {team.traits.map((t) => (
          <TraitChip key={t} label={t} />
        ))}
      </div>

      <div className="border-t border-line-soft pt-3">
        <p className="mb-2 text-2xs uppercase tracking-[0.18em] text-muted">
          팀원
        </p>
        {team.members.length === 0 ? (
          <p className="text-xs text-muted">직접 수행</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {team.members.map((m) => (
              <li key={m.agent} className="flex items-start gap-2 text-xs">
                <span className="w-16 shrink-0 text-muted">{m.role}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-ink">{m.agent}</span>
                    {m.llm && (
                      <span
                        title="LLM으로 판단합니다"
                        className="text-vermilion"
                        aria-label="LLM으로 판단합니다"
                      >
                        ✦
                      </span>
                    )}
                    {m.planned && (
                      <span
                        className={`inline-block px-1.5 py-0.5 text-2xs ${statusBadgeTone(PLANNED_LABEL)}`}
                      >
                        {PLANNED_LABEL}
                      </span>
                    )}
                  </span>
                  {m.detail && (
                    <span className="block text-2xs text-faint">{m.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/dashboard/agents/_components/__tests__/TeamCard.test.tsx`
Expected: PASS (6건)

- [ ] **Step 5: 배지 회귀를 역검증한다**

`TeamCard.tsx`의 `PLANNED_LABEL`을 잠시 `"준비 중"`으로 바꾸고 테스트를 돌린다.

Run: `npx vitest run src/app/dashboard/agents/_components/__tests__/TeamCard.test.tsx`
Expected: FAIL — `예정` 텍스트를 못 찾아 실패한다. 라벨을 `"예정"`으로 **되돌리고** 다시 통과를 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add src/app/dashboard/agents/_components
git commit -m "feat(agent-org): 팀 카드 컴포넌트"
```

---

### Task 4: 페이지와 메뉴 등록

RSC 페이지가 두 레지스트리를 합쳐 카드 격자를 그린다. 사이드바·메타에 등록해 실제로 열리게 한다.

**Files:**
- Create: `src/app/dashboard/agents/page.tsx`
- Modify: `src/app/dashboard/_data.ts` (`AI & 자동화` 그룹 — `자동화실행` 항목 **바로 위**)
- Modify: `src/app/dashboard/_data/page-meta-config.ts` (`automations` 항목 바로 앞)
- Test: `src/app/dashboard/_data/__tests__/agents-menu.test.ts`

**Interfaces:**
- Consumes: `AGENT_TEAMS` (Task 1), `buildJobLabels`/`resolveTeam` (Task 2), `TeamCard` (Task 3), `AUTOMATION_JOBS` from `@/features/automations/registry`

- [ ] **Step 1: 실패하는 메뉴 테스트를 쓴다**

`src/app/dashboard/_data/__tests__/agents-menu.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sidebarSections } from "../../_data";
import { PAGE_META } from "../page-meta-config";

const allItems = sidebarSections.flatMap((s) =>
  s.entries.flatMap((e) => (e.kind === "item" ? [e] : e.items)),
);

describe("에이전트 메뉴 등록", () => {
  it("slug agents가 사이드바에 있다", () => {
    const item = allItems.find((i) => i.slug === "agents");
    expect(item).toBeDefined();
    expect(item?.label).toBe("에이전트");
  });

  it("자동화실행 바로 위에 있다", () => {
    const group = sidebarSections
      .flatMap((s) => s.entries)
      .find((e) => e.kind === "group" && e.label === "AI & 자동화");
    expect(group).toBeDefined();
    const slugs =
      group && group.kind === "group" ? group.items.map((i) => i.slug) : [];
    expect(slugs.indexOf("agents")).toBe(slugs.indexOf("automations") - 1);
  });

  it("전원 열람이다 — adminOnly가 아니다", () => {
    const item = allItems.find((i) => i.slug === "agents");
    expect(item?.adminOnly).toBeFalsy();
  });

  it("페이지 메타가 등록되어 있다", () => {
    const entry = PAGE_META.agents;
    expect(entry).toBeDefined();
    expect(entry?.headline.title).toBe("에이전트");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/dashboard/_data/__tests__/agents-menu.test.ts`
Expected: FAIL — `expected undefined to be defined` (사이드바에 항목이 없다)

- [ ] **Step 3: 사이드바에 등록한다**

`src/app/dashboard/_data.ts` — `AI & 자동화` 그룹에서 `자동화실행` 항목 **바로 앞**에 넣는다:

```ts
          {
            ico: "·",
            label: "에이전트",
            slug: "agents",
            pattern: "dash",
          },
          {
            ico: "·",
            label: "자동화실행",
            slug: "automations",
            pattern: "list",
          },
```

- [ ] **Step 4: 페이지 메타를 등록한다**

`src/app/dashboard/_data/page-meta-config.ts` — `automations` 항목 바로 앞:

```ts
  agents: {
    headline: { accent: "AI & 자동화", title: "에이전트" },
    description:
      "운영 자동화를 파이프라인 네 단계로 묶어 봅니다. 무엇이 무엇을 위해 도는지 한눈에 봅니다.",
  },
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/app/dashboard/_data/__tests__/agents-menu.test.ts`
Expected: PASS (4건)

- [ ] **Step 6: 페이지를 쓴다**

`src/app/dashboard/agents/page.tsx`:

```tsx
import { findSidebarMeta } from "../_data";
import { resolvePageMeta } from "../_data/page-meta-derive";
import { PageHeader } from "../_components/page-header/PageHeader";
import { requireMenu } from "@/features/auth/menu-guard";
import { AUTOMATION_JOBS } from "@/features/automations/registry";
import { AGENT_TEAMS } from "@/features/agent-org/registry";
import { buildJobLabels, resolveTeam } from "@/features/agent-org/resolve";
import { TeamCard } from "./_components/TeamCard";

export default async function AgentsPage() {
  const slug = "agents";
  await requireMenu(slug);

  const meta = findSidebarMeta(slug);
  if (!meta) return null;
  const pathname = `/dashboard/${slug}`;

  const labels = buildJobLabels(AUTOMATION_JOBS);
  const teams = AGENT_TEAMS.map((t) => resolveTeam(t, labels));
  const memberCount = teams.reduce((n, t) => n + t.members.length, 0);
  const config = resolvePageMeta(slug, meta, memberCount);

  return (
    <>
      <PageHeader
        pathname={pathname}
        meta={config.meta}
        headline={config.headline}
        description={config.description}
      />
      <div className="p-5 lg:p-7">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} />
          ))}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 7: 전체 검증**

```bash
npm run typecheck
npm run lint
npx vitest run src/features/agent-org src/app/dashboard/agents src/app/dashboard/_data
```

Expected: typecheck 0 errors · lint 0 errors · 테스트 전건 통과

- [ ] **Step 8: 커밋**

```bash
git add src/app/dashboard/agents src/app/dashboard/_data.ts src/app/dashboard/_data/page-meta-config.ts src/app/dashboard/_data/__tests__/agents-menu.test.ts
git commit -m "feat(agent-org): 에이전트 조직 화면과 메뉴 등록"
```

---

### Task 5: 전체 스위트와 PR

**Files:** 없음 (검증·PR만)

- [ ] **Step 1: 전체 스위트를 돌린다**

```bash
npx vitest run --maxWorkers=3
```

> 이 PC는 16GB라 기본 워커 수로 돌리면 도중에 죽는다(2026-08-13 겪음). `--maxWorkers=3`을 붙인다.

Expected: 실패 0건

- [ ] **Step 2: 빌드를 확인한다**

```bash
npm run build
```

Expected: exit 0

> `NODE_ENV=development`가 셸에 새면 dev React로 prerender 되어 `/_global-error`에서 useContext 에러가 난다. 그때는 `unset NODE_ENV` 후 다시 돌린다.

- [ ] **Step 3: 푸시하고 PR을 연다**

```bash
git push -u origin feat/agent-org-screen
gh pr create --base main --head feat/agent-org-screen \
  --title "feat(agent-org): 에이전트 조직 화면" \
  --body "$(cat <<'EOF'
## Summary

자동화 잡 17개와 레지스트리 밖 자동 실행 3건을 파이프라인 네 단계 + 조율로 묶어 카드 격자로 보여줍니다.

| 팀 | 팀장 | 팀원 |
|---|---|---|
| 수집팀 | 지성 | 5 |
| 판단팀 | 성용 | 4 |
| 전달팀 | 강인 | 9 |
| 관측팀 | 현우 | 3 |
| 조율 | 명보 | 직접 수행 |

설계: `docs/superpowers/specs/2026-08-13-agent-org-design.md`

## 조직도가 거짓말이 되지 않게

잡의 라벨을 조직 레지스트리에 **복사하지 않습니다** — `jobId`로 자동화 레지스트리에서 찾아 렌더합니다. 그리고 **잡을 추가하고 조직도에 안 넣으면 CI가 실패**합니다.

보증 범위는 정직하게 적었습니다 — 레지스트리 잡 17개만 완전성을 보고, `outside` 셋은 손으로 적은 것이라 네 번째가 생기면 못 잡습니다.

## 배지

`준비 중`은 `중`으로 끝나 공통 규칙이 **진행(빨강)**으로 판정합니다. 의도는 대기(회색)라 라벨을 **`예정`**으로 썼습니다. `badge-tone.ts`는 건드리지 않았습니다.

## Test plan

- [x] RED → GREEN → 커밋 사이클
- [x] **역검증** — 잡 하나를 조직도에서 빼니 `조직도에 배치되지 않은 잡`으로 실패
- [x] **역검증** — 라벨을 `준비 중`으로 되돌리니 배지 테스트 실패
- [x] typecheck 0 · lint 0 · 전체 스위트 통과 · build exit 0
- [ ] 실화면 — 카드 3열, 전달팀 카드 길이, `예정` 배지가 회색인지

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 자체 검토

**스펙 대조**

| 스펙 요구 | 구현 태스크 |
|---|---|
| §2 팀 5 · 팀장 · 성향 · 팀원 | Task 1 |
| §2 레지스트리 밖 3건을 `outside`로 | Task 1 |
| §4 진실 원천 `agent-org/registry.ts` | Task 1 |
| §4 잡 라벨 복사 금지 | Task 2 (`buildJobLabels` 조회) |
| §4 갈라짐 방지 테스트 | Task 1 (4건 런타임) + 타입 (출처 배타성) |
| §4 역검증 | Task 1 Step 6, Task 3 Step 5 |
| §5 위치 — `자동화실행` 바로 위, 전원 열람 | Task 4 |
| §5 카드 격자 3열 (VideoGrid 규격) | Task 3 · Task 4 |
| §5 배지를 새로 만들지 않음 | Task 3 (`statusBadgeTone`만) |
| §5 성향 칩에 인터랙션 없음 | Task 3 (`TraitChip`) |
| §6 탭·클릭·팀장 구현 제외 | 전 태스크에서 미포함 |

**스펙과 달라진 두 가지 — 의도적이다**

1. **출처를 판별 유니온으로** 바꿨다. 스펙은 "테스트가 잡는다"였지만 유니온이면 **컴파일 시점에** 막힌다. 런타임 테스트는 4건이 되고, 대신 kebab-case 검사를 더했다.
2. **미구현 라벨이 `준비 중` → `예정`.** `준비 중`은 `중`으로 끝나 규칙이 진행(빨강)으로 판정한다(2026-08-13 실측). 스펙 의도인 회색을 지키려면 라벨을 바꿔야 하고, `badge-tone.ts`에 예외를 더하는 것보다 낫다.

**팀원 수 정정**: 스펙 §2 "총 20자리"는 `planned` 하나를 빠뜨린 수다. 실제는 **21** (잡 17 + outside 3 + planned 1).

---

## 실행 방식

**Plan complete and saved to `docs/superpowers/plans/2026-08-13-agent-org-screen.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — 태스크마다 새 서브에이전트를 붙이고 사이사이 리뷰, 빠른 반복

**2. Inline Execution** — 이 세션에서 executing-plans로 배치 실행, 체크포인트마다 확인

**Which approach?**
