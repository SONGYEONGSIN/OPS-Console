# 메뉴 IA 재구성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Folio Dashboard 사이드바 IA를 IT-ops 22 페이지에서 운영부 도메인 47 페이지로 전환 (라이프사이클 7단계 + 12 프로젝트 + 요청·자료 통합 + 분석·AI + 매뉴얼·가이드 + 관리). 신규 ProjectPattern 컴포넌트 추가.

**Architecture:** 기존 `dynamic [slug]` 라우트 + 4 패턴 시스템 그대로 활용 + ProjectPattern 1개 추가. 데이터 레이어(`_data.ts`, `_data/patterns.ts`) 전면 교체. layout.tsx 셸 / Sidebar 컴포넌트 / SbSection·SbGroup·SbItem 타입 / `findSidebarMeta` 헬퍼 모두 불변.

**Tech Stack:** Next.js 16 App Router · TypeScript · Tailwind CSS 4 · vitest + @testing-library/react · Playwright · spec: `design-ref/2026-04-30-menu-ia-redesign-design.md`

---

## File Structure

| 파일 | 변경 유형 | 책임 |
|---|---|---|
| `src/app/dashboard/_data.ts` | Modify (전면 교체) | sidebarSections 6 섹션 / 4 그룹 / 47 slot. SbPattern 타입에 "project" 추가 |
| `src/app/dashboard/_data/patterns.ts` | Modify (확장) | 47 slug에 대응하는 mock 데이터. ProjectMockData 타입 + 12 프로젝트 데이터 |
| `src/app/dashboard/_components/patterns/ProjectPattern.tsx` | Create | 5번째 패턴 컴포넌트. 헤더 + 탭 3개(상세/개선사항/활동 로그) + 탭별 콘텐츠 |
| `src/app/dashboard/[slug]/page.tsx` | Modify (분기 추가) | `meta.pattern === "project"` 분기 1개 추가 |
| `e2e/dashboard-pages.spec.ts` | Modify (전면 갱신) | ALL_SLUGS 47 배열 + ProjectPattern 탭 테스트 추가 |
| `src/app/dashboard/_components/patterns/__tests__/ProjectPattern.test.tsx` | Create | vitest 단위 테스트 |
| `src/app/dashboard/__tests__/_data.test.ts` | Create | findSidebarMeta + 47 slug 매핑 검증 |

---

## Task 1: SbPattern 타입 확장 + ProjectMockData 타입 정의

**Files:**
- Modify: `src/app/dashboard/_data.ts:9` (SbPattern 타입)
- Modify: `src/app/dashboard/_data/patterns.ts` (ProjectMockData 타입 추가)

타입 정의만 변경 — 런타임 영향 없음 (TDD 예외). 후속 task에서 사용으로 검증.

- [ ] **Step 1: SbPattern 타입에 "project" 리터럴 추가**

`src/app/dashboard/_data.ts` 9번째 줄 변경:

```ts
// Before
export type SbPattern = "list" | "dash" | "log" | "settings";

// After
export type SbPattern = "list" | "dash" | "log" | "settings" | "project";
```

- [ ] **Step 2: ProjectMockData 타입을 patterns.ts에 추가**

`src/app/dashboard/_data/patterns.ts` 상단(다른 타입 정의들 옆)에 추가:

```ts
export type ProjectMockData = {
  meta: {
    manager: string;       // 담당자
    status: string;        // 진행 상태 (예: "진행", "보류")
    quarterTarget: string; // 분기 목표 (예: "2026 Q2 · 62%")
    serviceCount: string;  // 서비스 수 (예: "14건 (배포 12 / 마감 2)")
  };
  attributes: { k: string; v: string }[];
  improvements: {
    title: string;
    pm: string;
    due: string;
    status: "run" | "rev" | "wait";
  }[];
  activities: { time: string; who: string; act: string }[];
};
```

- [ ] **Step 3: 타입 컴파일 검증**

```bash
npx tsc --noEmit
```

Expected: 컴파일 성공. 후속 task에서 이 타입을 사용한다.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/_data.ts src/app/dashboard/_data/patterns.ts
git commit -m "feat: SbPattern 타입에 project 추가 + ProjectMockData 정의"
```

---

## Task 2: sidebarSections 47 페이지 전면 교체 + findSidebarMeta 검증

**Files:**
- Modify: `src/app/dashboard/_data.ts:28-226` (sidebarSections 배열 전면 교체)
- Create: `src/app/dashboard/__tests__/_data.test.ts`

타입 정의 외 데이터 변경 — 런타임 영향 있음 (TDD 적용).

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/dashboard/__tests__/_data.test.ts` 생성:

```ts
import { describe, it, expect } from "vitest";
import { sidebarSections, findSidebarMeta } from "../_data";

const ALL_SLUGS = [
  "alerts", "my-todo", "schedule",
  "handover", "data-requests", "incidents", "contacts", "backup", "vault",
  "services", "contracts", "dev-test", "deploy", "closing", "settlement", "invoice", "receivables",
  "pims", "reception-admin", "internal-admin", "competition", "generator",
  "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  "worklog", "outcomes", "reports",
  "ai-insight", "ai-assistant", "my-ai-work", "ai-tips",
  "manual", "sop", "vibe-coding", "meetings", "faq",
  "team", "settings", "onboarding", "feedback", "notices",
];

describe("sidebarSections 신규 IA", () => {
  it("6 섹션", () => {
    expect(sidebarSections.length).toBe(6);
  });

  it("섹션 라벨 순서 정확", () => {
    expect(sidebarSections.map((s) => s.title)).toEqual([
      "개요",
      "요청 · 자료",
      "서비스 그룹",
      "분석 · AI",
      "매뉴얼 · 가이드",
      "관리",
    ]);
  });
});

describe("findSidebarMeta 47 slug 검증", () => {
  it.each(ALL_SLUGS)("%s slug에 대한 메타 lookup 성공", (slug) => {
    const meta = findSidebarMeta(slug);
    expect(meta).not.toBeNull();
    expect(meta?.label).toBeTruthy();
    expect(meta?.pattern).toMatch(/^(list|dash|log|settings|project)$/);
  });

  it("잘못된 slug → null", () => {
    expect(findSidebarMeta("nonexistent-zzz")).toBeNull();
  });
});

describe("프로젝트 12 항목 패턴 검증", () => {
  const PROJECT_SLUGS = [
    "pims", "reception-admin", "internal-admin", "competition", "generator",
    "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  ];
  it.each(PROJECT_SLUGS)("%s는 project 패턴", (slug) => {
    expect(findSidebarMeta(slug)?.pattern).toBe("project");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- _data.test.ts
```

Expected: FAIL — 신규 slug 대다수가 기존 sidebarSections에 없어 lookup이 null 반환.

- [ ] **Step 3: sidebarSections 전면 교체**

`src/app/dashboard/_data.ts` 28-226줄(`export const sidebarSections: SbSection[] = [...]`) 전체를 다음 구조로 교체. 라벨/slug/패턴은 spec(`design-ref/2026-04-30-menu-ia-redesign-design.md`) "신규 IA 정의" 섹션의 표 그대로:

```ts
export const sidebarSections: SbSection[] = [
  {
    title: "개요",
    entries: [
      { kind: "item", ico: "◉", label: "실시간 현황" },
      { kind: "item", ico: "✦", label: "새 알림", count: "3", slug: "alerts", pattern: "dash" },
      { kind: "item", ico: "✓", label: "오늘 할 일", count: "7", slug: "my-todo", pattern: "list" },
      { kind: "item", ico: "◰", label: "전체 일정", count: "14", slug: "schedule", pattern: "list" },
    ],
  },
  {
    title: "요청 · 자료",
    entries: [
      { kind: "item", ico: "◈", label: "인수인계", count: "2", slug: "handover", pattern: "list" },
      {
        kind: "group",
        label: "고객 응대",
        count: "9",
        defaultOpen: true,
        items: [
          { ico: "·", label: "자료 요청", count: "5", slug: "data-requests", pattern: "list" },
          { ico: "·", label: "사고 보고", count: "2", slug: "incidents", pattern: "list" },
          { ico: "·", label: "대학 연락처", count: "87", slug: "contacts", pattern: "list" },
        ],
      },
      { kind: "item", ico: "⌬", label: "백업 요청", count: "1", slug: "backup", pattern: "list" },
      { kind: "item", ico: "▣", label: "자료 보관", slug: "vault", pattern: "list" },
    ],
  },
  {
    title: "서비스 그룹",
    entries: [
      {
        kind: "group",
        label: "서비스사이클",
        count: "8",
        defaultOpen: true,
        items: [
          { ico: "·", label: "전체 서비스", count: "179", slug: "services", pattern: "list" },
          { ico: "·", label: "계약", count: "14", slug: "contracts", pattern: "list" },
          { ico: "·", label: "개발 · 테스트", count: "28", slug: "dev-test", pattern: "list" },
          { ico: "·", label: "배포 · 운영", count: "112", slug: "deploy", pattern: "list" },
          { ico: "·", label: "서비스 마감", count: "8", slug: "closing", pattern: "list" },
          { ico: "·", label: "전형료 정산", count: "7", slug: "settlement", pattern: "list" },
          { ico: "·", label: "계산서 발행", count: "3", slug: "invoice", pattern: "list" },
          { ico: "·", label: "미수 채권", count: "7", slug: "receivables", pattern: "list" },
        ],
      },
      {
        kind: "group",
        label: "프로젝트",
        count: "12",
        items: [
          { ico: "·", label: "PIMS", count: "4", slug: "pims", pattern: "project" },
          { ico: "·", label: "접수관리자", count: "12", slug: "reception-admin", pattern: "project" },
          { ico: "·", label: "내부관리자", count: "8", slug: "internal-admin", pattern: "project" },
          { ico: "·", label: "경쟁률", count: "3", slug: "competition", pattern: "project" },
          { ico: "·", label: "생성툴", count: "2", slug: "generator", pattern: "project" },
          { ico: "·", label: "매출 분석", count: "5", slug: "revenue", pattern: "project" },
          { ico: "·", label: "정산 · 진학캐쉬", count: "1", slug: "jh-cash", pattern: "project" },
          { ico: "·", label: "초중고 사업", slug: "k12", pattern: "project" },
          { ico: "·", label: "대교협 연계", slug: "kcue", pattern: "project" },
          { ico: "·", label: "추천인 검증", count: "7", slug: "referral", pattern: "project" },
          { ico: "·", label: "보증보험", slug: "guarantee", pattern: "project" },
          { ico: "·", label: "실적증명", slug: "performance", pattern: "project" },
        ],
      },
    ],
  },
  {
    title: "분석 · AI",
    entries: [
      {
        kind: "group",
        label: "분석 & 보고",
        count: "3",
        items: [
          { ico: "·", label: "업무 활동 로그", slug: "worklog", pattern: "log" },
          { ico: "·", label: "성과 리포트", slug: "outcomes", pattern: "dash" },
          { ico: "·", label: "분석 보고서", count: "3", slug: "reports", pattern: "list" },
        ],
      },
      {
        kind: "group",
        label: "AI & 자동화",
        count: "4",
        items: [
          { ico: "·", label: "AI 인사이트", count: "12", slug: "ai-insight", pattern: "dash" },
          { ico: "·", label: "AI 어시스턴트", slug: "ai-assistant", pattern: "settings" },
          { ico: "·", label: "내 AI 작업", count: "5", slug: "my-ai-work", pattern: "list" },
          { ico: "·", label: "AI 팁 공유", count: "8", slug: "ai-tips", pattern: "list" },
        ],
      },
    ],
  },
  {
    title: "매뉴얼 · 가이드",
    entries: [
      { kind: "item", ico: "§", label: "운영 매뉴얼", slug: "manual", pattern: "list" },
      { kind: "item", ico: "▥", label: "표준 절차 (SOP)", count: "12", slug: "sop", pattern: "list" },
      { kind: "item", ico: "⌘", label: "바이브코딩 가이드", count: "5", slug: "vibe-coding", pattern: "list" },
      { kind: "item", ico: "≡", label: "회의록", count: "8", slug: "meetings", pattern: "list" },
      { kind: "item", ico: "¶", label: "FAQ · 사례집", slug: "faq", pattern: "list" },
    ],
  },
  {
    title: "관리",
    entries: [
      { kind: "item", ico: "◐", label: "팀 · 권한", count: "17", slug: "team", pattern: "list" },
      { kind: "item", ico: "⚙", label: "시스템 설정", slug: "settings", pattern: "settings" },
      { kind: "item", ico: "✦", label: "신규 온보딩", slug: "onboarding", pattern: "settings" },
      { kind: "item", ico: "⚒", label: "개선 요청", count: "4", slug: "feedback", pattern: "list" },
      { kind: "item", ico: "✉", label: "공지사항", count: "3", slug: "notices", pattern: "list" },
    ],
  },
];
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
npm test -- _data.test.ts
```

Expected: PASS — 47 slug 모두 lookup 성공, 12 프로젝트 모두 project 패턴.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_data.ts src/app/dashboard/__tests__/_data.test.ts
git commit -m "feat: sidebarSections 47 페이지 IA로 전면 교체 + 매핑 테스트"
```

---

## Task 3: getPatternMockData 47 slug mock + 12 프로젝트 ProjectMockData

**Files:**
- Modify: `src/app/dashboard/_data/patterns.ts` (기존 mock 데이터 47 slug에 맞춰 갱신 + ProjectMockData 추가)

- [ ] **Step 1: 실패하는 테스트 추가** (`__tests__/_data.test.ts`에 추가)

```ts
import { getPatternMockData } from "../_data/patterns";

describe("getPatternMockData 47 slug 매칭", () => {
  it.each(ALL_SLUGS)("%s slug에 대해 mock 데이터 반환", (slug) => {
    const meta = findSidebarMeta(slug);
    expect(meta).not.toBeNull();
    if (!meta) return;
    const data = getPatternMockData(slug, meta.pattern);
    expect(data).not.toBeNull();
  });

  it("프로젝트 mock에 meta/attributes/improvements/activities 4개 필드 존재", () => {
    const data = getPatternMockData("pims", "project") as {
      meta: unknown;
      attributes: unknown;
      improvements: unknown;
      activities: unknown;
    };
    expect(data.meta).toBeDefined();
    expect(Array.isArray(data.attributes)).toBe(true);
    expect(Array.isArray(data.improvements)).toBe(true);
    expect(Array.isArray(data.activities)).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- _data.test.ts
```

Expected: FAIL — getPatternMockData에 신규 slug들이 없음.

- [ ] **Step 3: patterns.ts 갱신**

`src/app/dashboard/_data/patterns.ts`에서:

1. **기존 list 패턴 mock 데이터** — 같은 가벼운 placeholder 톤(`{ rows: [...] }`)으로 신규 27 list slug 추가. 예시 1개:

```ts
const handoverRows: ListRow[] = [
  { id: "HND-001", name: "야간 → 주간 인계 (배포)", status: "active", owner: "박지연", meta: "배포 대기 3건" },
  { id: "HND-002", name: "주간 → 야간 인계 (장애)", status: "review", owner: "김민수", meta: "장애 추적 중" },
];

// 신규 list slug 모두 동일 톤으로 작성:
// my-todo, schedule, data-requests, incidents, contacts, backup, vault,
// services, contracts, dev-test, deploy, closing, settlement, invoice, receivables,
// reports, my-ai-work, ai-tips,
// manual, sop, vibe-coding, meetings, faq,
// team, feedback, notices
```

2. **dash 패턴** — 4개 신규 slug. 예시:

```ts
const alertsWidgets: DashWidget[] = [
  { id: "W-ALERT-1", title: "신규 알림", value: "3", tone: "vermilion", sub: "지난 1시간" },
  { id: "W-ALERT-2", title: "처리 대기", value: "12", tone: "gold", sub: "오늘" },
  { id: "W-ALERT-3", title: "오늘 처리", value: "47", tone: "sage", sub: "완료율 92%" },
];
// outcomes, ai-insight, alerts 모두 동일 형태
```

3. **log 패턴** — worklog 1개:

```ts
const worklogLines: LogLine[] = [
  { time: "14:32", level: "INFO", msg: "박지연 - PIMS 접수폼 검증 작업 시작" },
  { time: "14:28", level: "INFO", msg: "김민수 - 사고 보고 SVC-MSG-003 처리 완료" },
  // ... 50줄
];
```

4. **settings 패턴** — 3개 신규 slug. 예시:

```ts
const aiAssistantSections: SettingsSection[] = [
  {
    id: "model",
    title: "모델 설정",
    fields: [
      { id: "default-model", type: "select", label: "기본 모델", options: ["claude-sonnet-4", "claude-opus-4-7"], value: "claude-sonnet-4" },
      { id: "temperature", type: "select", label: "응답 다양성", options: ["보수적", "균형", "창의적"], value: "균형" },
    ],
  },
  // ...
];
```

5. **project 패턴 — 12 프로젝트 데이터** (가장 큰 작업). 패턴:

```ts
const pimsProject: ProjectMockData = {
  meta: {
    manager: "박지연",
    status: "진행",
    quarterTarget: "2026 Q2 · 62%",
    serviceCount: "14건 (배포 12 / 마감 2)",
  },
  attributes: [
    { k: "담당자", v: "박지연 · 운영1팀" },
    { k: "서비스 수", v: "14건 (배포 12 / 마감 2)" },
    { k: "분기 목표", v: "2026 Q2 · 진행률 62%" },
    { k: "주요 일정", v: "2026-05-15 접수폼 검증 / 2026-05-30 권한 분리" },
  ],
  improvements: [
    { title: "접수 폼 검증 강화", pm: "박지연", due: "2026-05-15", status: "run" },
    { title: "알림 SMS 템플릿 통일", pm: "김민수", due: "2026-04-30", status: "rev" },
    { title: "관리자 권한 분리", pm: "미정", due: "2026-Q3", status: "wait" },
    { title: "통계 export 자동화", pm: "박지연", due: "2026-Q3", status: "wait" },
  ],
  activities: [
    { time: "2026-04-29", who: "박지연", act: "접수폼 검증 작업 진행 중" },
    { time: "2026-04-28", who: "김민수", act: "알림 SMS 템플릿 검토 완료" },
    { time: "2026-04-25", who: "박지연", act: "분기 목표 진행률 업데이트" },
  ],
};

// 동일 shape으로 12 프로젝트 작성:
// pims, reception-admin, internal-admin, competition, generator, revenue,
// jh-cash, k12, kcue, referral, guarantee, performance
// 각 프로젝트 담당자/개선과제/활동은 임의 placeholder. Supabase 연결 시 교체.
```

6. **`getPatternMockData` 함수 분기 갱신** — 47 slug switch/lookup:

```ts
export function getPatternMockData(slug: string, pattern: SbPattern): unknown {
  if (pattern === "list") {
    const map: Record<string, { rows: ListRow[] }> = {
      "my-todo": { rows: myTodoRows },
      "handover": { rows: handoverRows },
      // ... 27 list slug 모두
    };
    return map[slug] ?? { rows: [] };
  }
  if (pattern === "dash") {
    const map: Record<string, { widgets: DashWidget[] }> = {
      "alerts": { widgets: alertsWidgets },
      "outcomes": { widgets: outcomesWidgets },
      "ai-insight": { widgets: aiInsightWidgets },
    };
    return map[slug] ?? { widgets: [] };
  }
  if (pattern === "log") {
    return slug === "worklog" ? { lines: worklogLines } : { lines: [] };
  }
  if (pattern === "settings") {
    const map: Record<string, { sections: SettingsSection[] }> = {
      "ai-assistant": { sections: aiAssistantSections },
      "settings": { sections: systemSettingsSections },
      "onboarding": { sections: onboardingSections },
    };
    return map[slug] ?? { sections: [] };
  }
  // project 패턴
  const projectMap: Record<string, ProjectMockData> = {
    "pims": pimsProject,
    "reception-admin": receptionAdminProject,
    // ... 12 project 모두
  };
  return projectMap[slug] ?? null;
}
```

대시보드 인덱스(`/dashboard`)는 별도 page.tsx에서 처리하므로 인덱스 slug는 mock에 포함하지 않음.

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
npm test -- _data.test.ts
```

Expected: PASS — 47 slug 모두 mock 데이터 반환, project mock 4 필드 존재.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_data/patterns.ts src/app/dashboard/__tests__/_data.test.ts
git commit -m "feat: 47 slug mock 데이터 + 12 프로젝트 ProjectMockData 추가"
```

---

## Task 4: ProjectPattern 컴포넌트 + vitest 단위 테스트

**Files:**
- Create: `src/app/dashboard/_components/patterns/ProjectPattern.tsx`
- Create: `src/app/dashboard/_components/patterns/__tests__/ProjectPattern.test.tsx`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/app/dashboard/_components/patterns/__tests__/ProjectPattern.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProjectPattern } from "../ProjectPattern";
import type { ProjectMockData } from "../../../_data/patterns";

const sample: ProjectMockData = {
  meta: { manager: "박지연", status: "진행", quarterTarget: "Q2 62%", serviceCount: "14건" },
  attributes: [
    { k: "담당자", v: "박지연 · 운영1팀" },
    { k: "서비스 수", v: "14건" },
  ],
  improvements: [
    { title: "접수 폼 검증", pm: "박지연", due: "2026-05-15", status: "run" },
    { title: "권한 분리", pm: "김민수", due: "2026-Q3", status: "wait" },
  ],
  activities: [
    { time: "2026-04-29", who: "박지연", act: "검증 작업 시작" },
  ],
};

describe("ProjectPattern", () => {
  it("헤더에 title + 메타 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    expect(screen.getByRole("heading", { name: "PIMS", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/박지연/)).toBeInTheDocument();
  });

  it("탭 3개 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    expect(screen.getByRole("tab", { name: /상세/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /개선사항/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /활동 로그/ })).toBeInTheDocument();
  });

  it("기본 탭은 상세 — attributes 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    expect(screen.getByText("담당자")).toBeInTheDocument();
    expect(screen.getByText("박지연 · 운영1팀")).toBeInTheDocument();
  });

  it("개선사항 탭 클릭 시 improvements 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    fireEvent.click(screen.getByRole("tab", { name: /개선사항/ }));
    expect(screen.getByText("접수 폼 검증")).toBeInTheDocument();
    expect(screen.getByText("권한 분리")).toBeInTheDocument();
  });

  it("활동 로그 탭 클릭 시 activities 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    fireEvent.click(screen.getByRole("tab", { name: /활동 로그/ }));
    expect(screen.getByText(/검증 작업 시작/)).toBeInTheDocument();
  });

  it("개선사항 카운트 badge 노출", () => {
    render(<ProjectPattern title="PIMS" data={sample} />);
    const tab = screen.getByRole("tab", { name: /개선사항/ });
    expect(tab.textContent).toContain("2");
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

```bash
npm test -- ProjectPattern.test.tsx
```

Expected: FAIL — `ProjectPattern` 미정의.

- [ ] **Step 3: 최소 구현**

`src/app/dashboard/_components/patterns/ProjectPattern.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ProjectMockData } from "../../_data/patterns";

const STATUS_LABEL = { run: "진행", rev: "검토", wait: "대기" } as const;
const STATUS_COLOR = {
  run: "bg-gold/20 text-gold",
  rev: "bg-sage/20 text-sage",
  wait: "bg-line-soft text-muted",
} as const;

type Tab = "detail" | "improvements" | "activities";

export function ProjectPattern({
  title,
  data,
}: {
  title: string;
  data: ProjectMockData;
}) {
  const [tab, setTab] = useState<Tab>("detail");
  const improvementCount = data.improvements.length;

  return (
    <section className="flex h-full min-h-0 flex-col bg-paper">
      <header className="flex items-center justify-between border-b border-line bg-washi-raised px-5 py-4 lg:px-7">
        <div className="flex items-baseline gap-4">
          <h2 className="text-lg font-semibold text-ink lg:text-xl">{title}</h2>
          <span className="text-xs text-muted">
            담당 {data.meta.manager} · {data.meta.status}
          </span>
        </div>
        <span className="rounded bg-sage/20 px-3 py-1 text-xs text-sage">
          {data.meta.quarterTarget}
        </span>
      </header>

      <nav role="tablist" className="flex border-b border-line bg-washi px-5 lg:px-7">
        <TabButton active={tab === "detail"} onClick={() => setTab("detail")}>상세</TabButton>
        <TabButton active={tab === "improvements"} onClick={() => setTab("improvements")}>
          개선사항 <span className="ml-1 rounded bg-vermilion/15 px-2 text-[10px] text-vermilion">{improvementCount}</span>
        </TabButton>
        <TabButton active={tab === "activities"} onClick={() => setTab("activities")}>활동 로그</TabButton>
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-5 lg:p-7">
        {tab === "detail" && <DetailPanel data={data} />}
        {tab === "improvements" && <ImprovementsPanel data={data} />}
        {tab === "activities" && <ActivitiesPanel data={data} />}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-4 py-3 text-sm transition ${
        active
          ? "border-b-2 border-vermilion font-semibold text-vermilion"
          : "border-b-2 border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function DetailPanel({ data }: { data: ProjectMockData }) {
  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-[120px_1fr] lg:gap-x-4 lg:gap-y-2">
      {data.attributes.map((a) => (
        <div key={a.k} className="contents">
          <span className="text-xs text-muted lg:text-sm">{a.k}</span>
          <span className="text-sm text-ink">{a.v}</span>
        </div>
      ))}
    </div>
  );
}

function ImprovementsPanel({ data }: { data: ProjectMockData }) {
  return (
    <ul className="divide-y divide-line">
      {data.improvements.map((im) => (
        <li key={im.title} className="flex items-center gap-3 py-3">
          <span className="flex-1 text-sm text-ink">{im.title}</span>
          <span className="text-xs text-muted">{im.pm}</span>
          <span className="text-xs text-muted">{im.due}</span>
          <span className={`rounded px-2 py-0.5 text-[10px] ${STATUS_COLOR[im.status]}`}>
            {STATUS_LABEL[im.status]}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivitiesPanel({ data }: { data: ProjectMockData }) {
  return (
    <ul className="space-y-2 font-mono text-xs text-muted">
      {data.activities.map((a, i) => (
        <li key={i}>
          <span className="text-ink">{a.time}</span> {a.who} — {a.act}
        </li>
      ))}
    </ul>
  );
}
```

색상은 모두 Tailwind 토큰 클래스(`bg-paper`, `text-ink`, `bg-vermilion`, `text-sage` 등) — 기존 패턴 컴포넌트들과 동일한 톤. 하드코딩 hex 없음.

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

```bash
npm test -- ProjectPattern.test.tsx
```

Expected: PASS — 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/_components/patterns/ProjectPattern.tsx \
        src/app/dashboard/_components/patterns/__tests__/ProjectPattern.test.tsx
git commit -m "feat: ProjectPattern 컴포넌트 추가 (탭 3개)"
```

---

## Task 5: [slug]/page.tsx에 project 분기 추가

**Files:**
- Modify: `src/app/dashboard/[slug]/page.tsx:25-38`

- [ ] **Step 1: 분기 추가**

기존 if-chain의 settings 분기 이전에 project 분기 추가:

```tsx
import { ProjectPattern } from "../_components/patterns/ProjectPattern";
import type { ProjectMockData } from "../_data/patterns";

// ... 기존 코드 ...

  if (meta.pattern === "log") {
    const data = getPatternMockData(params.slug, "log") as { lines: LogLine[] };
    return <LogPattern title={meta.label} data={data} />;
  }
  if (meta.pattern === "project") {
    const data = getPatternMockData(params.slug, "project") as ProjectMockData;
    return <ProjectPattern title={meta.label} data={data} />;
  }
  const data = getPatternMockData(params.slug, "settings") as { sections: SettingsSection[] };
  return <SettingsPattern title={meta.label} data={data} />;
```

- [ ] **Step 2: 컴파일 + 빌드 검증**

```bash
npx tsc --noEmit && npm run build
```

Expected: 성공. project 분기에 cast 누락 시 union narrowing 오류.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/[slug]/page.tsx
git commit -m "feat: [slug]/page.tsx에 project 패턴 분기 추가"
```

---

## Task 6: e2e ALL_SLUGS 47 갱신 + ProjectPattern 탭 테스트

**Files:**
- Modify: `e2e/dashboard-pages.spec.ts:3-9` (ALL_SLUGS 배열) + 필요 시 selector 갱신
- Add tests: ProjectPattern 탭 인터랙션

- [ ] **Step 1: ALL_SLUGS 배열 47개로 교체**

`e2e/dashboard-pages.spec.ts:3-9`:

```ts
const ALL_SLUGS = [
  // 개요
  "alerts", "my-todo", "schedule",
  // 요청 · 자료
  "handover", "data-requests", "incidents", "contacts", "backup", "vault",
  // 서비스사이클
  "services", "contracts", "dev-test", "deploy", "closing", "settlement", "invoice", "receivables",
  // 프로젝트 (project 패턴)
  "pims", "reception-admin", "internal-admin", "competition", "generator",
  "revenue", "jh-cash", "k12", "kcue", "referral", "guarantee", "performance",
  // 분석 · AI
  "worklog", "outcomes", "reports",
  "ai-insight", "ai-assistant", "my-ai-work", "ai-tips",
  // 매뉴얼 · 가이드
  "manual", "sop", "vibe-coding", "meetings", "faq",
  // 관리
  "team", "settings", "onboarding", "feedback", "notices",
];
```

- [ ] **Step 2: 기존 selector 정합 점검**

`e2e/dashboard-pages.spec.ts`의 다음 테스트들이 새 라벨과 정합하는지 확인:

```ts
// "Sidebar active state" 테스트 — services는 그대로 사이드바에 존재 (라벨: "전체 서비스")
// "사이드바 클릭 → /dashboard/alerts" 테스트 — alerts는 "새 알림"으로 라벨 변경됨
//   기존: page.locator('a[href="/dashboard/alerts"]')... — href 기반이라 라벨 무관, 변경 불필요
// "ListPattern: 행 선택 시 Inspector 갱신" — services 페이지, mock의 첫 행 ID 표시 — mock data ID 갱신 필요
// "DashPattern: 위젯 선택" — alerts 페이지, button[aria-pressed] 첫 번째 → mock data first widget ID
// "팀 페이지: OPERATORS 17명" — team slug 그대로, 변경 불필요
```

각 테스트의 ID 어설션을 새 mock data 첫 행 ID에 맞춰 갱신:

```ts
// 예: services 첫 행 ID가 새 mock에서 "SVC-PAY-001" → "SVC-001"로 바뀌었다면 어설션도 갱신
await expect(inspector).toContainText("SVC-001");

// alerts dash 첫 widget ID가 "W-ALERT-1"이면:
await expect(inspector).toContainText("W-ALERT-1");
```

- [ ] **Step 3: ProjectPattern 탭 테스트 추가**

`e2e/dashboard-pages.spec.ts` 마지막에 추가:

```ts
test("ProjectPattern: 탭 [상세 / 개선사항 / 활동 로그] 전환", async ({ page }) => {
  await page.goto("/dashboard/pims");

  // 헤더
  await expect(page.getByRole("heading", { name: "PIMS", level: 2 })).toBeVisible();

  // 기본 탭: 상세 — attributes 노출
  await expect(page.getByText("담당자", { exact: true })).toBeVisible();

  // 개선사항 탭 클릭
  await page.getByRole("tab", { name: /개선사항/ }).click();
  await expect(page.getByText("접수 폼 검증 강화")).toBeVisible();

  // 활동 로그 탭 클릭
  await page.getByRole("tab", { name: /활동 로그/ }).click();
  await expect(page.locator("li").filter({ hasText: /접수폼 검증 작업/ })).toBeVisible();

  // URL은 /dashboard/pims 유지 (탭 state는 page-local)
  await expect(page).toHaveURL(/\/dashboard\/pims$/);
});
```

- [ ] **Step 4: e2e 실행 — 통과 확인**

```bash
npm run e2e -- --project=chromium dashboard-pages.spec.ts
```

Expected: 모든 테스트 PASS. 47 라우트 200 + 잘못된 slug 404 + 패턴별 인터랙션 성공.

- [ ] **Step 5: 전체 빌드/린트/타입/단위/e2e 최종 검증**

```bash
npx tsc --noEmit && npm run lint && npm test && npm run build
```

Expected: 모두 PASS.

- [ ] **Step 6: Commit**

```bash
git add e2e/dashboard-pages.spec.ts
git commit -m "test: e2e 47 slug + ProjectPattern 탭 인터랙션 테스트"
```

---

## Self-Review

**1. Spec coverage**:

| Spec 섹션 | 구현 task |
|---|---|
| 신규 IA (6 섹션 47 페이지) | Task 2 |
| ProjectPattern 명세 (탭 3개) | Task 4 |
| SbPattern 타입 확장 | Task 1 |
| ProjectMockData shape | Task 1 + Task 3 |
| 라우트 매핑 | Task 5 |
| count 의미 통일 규칙 | Task 2 (sidebarSections 데이터에 직접 반영) |
| 슬러그 충돌 회피 (settlement vs jh-cash) | Task 2 (sidebarSections에 jh-cash 적용) |
| e2e 갱신 | Task 6 |
| 단위 테스트 (findSidebarMeta) | Task 2 |
| 단위 테스트 (ProjectPattern) | Task 4 |

모든 spec 요구사항이 task에 매핑됨. 미정 항목(결재함, 검색바, URL 쿼리, 매뉴얼/온보딩 통합)은 spec에서 명시적으로 본 plan 범위 외로 분류 — task 없음 OK.

**2. Placeholder scan**: 검토 완료. "TBD" / "추후" / "fill in details" 없음. 모든 step에 실제 코드 또는 명확한 데이터 시그니처 포함. mock 데이터의 일부 신규 slug(27 list 중 다수)는 plan 본문에 패턴 + 예시 1개로 가이드하고 spec 표를 참조 — implementer가 동일 톤으로 채우는 형태로 의도. 순수 placeholder 아님.

**3. Type consistency**: 검토 완료.
- `SbPattern` (Task 1) ↔ `findSidebarMeta` 반환 타입 (Task 2) ↔ `getPatternMockData` 시그니처 (Task 3) ↔ `[slug]/page.tsx` 분기 (Task 5) — 모두 일관.
- `ProjectMockData` shape (Task 1) ↔ `pimsProject` 사용 (Task 3) ↔ `ProjectPattern` props (Task 4) ↔ `[slug]/page.tsx` cast (Task 5) — 모두 일관.
- 탭 키 (`detail` / `improvements` / `activities`) — Task 4 컴포넌트 내부에서만 사용, 외부 노출 없음. 일관.
- improvement status 리터럴 (`run` / `rev` / `wait`) — Task 1 타입 정의 ↔ Task 3 mock 데이터 ↔ Task 4 STATUS_LABEL/STATUS_COLOR 매핑 — 모두 일관.

수정 사항 없음.
