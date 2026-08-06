# 팀 뉴스레터 — 대학가 소식 · 수시 준비 · 기능 소개 핀 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3호부터 뉴스레터에 대학가 소식 1건(claude 선별)과 수시 준비 주차 목표를 싣고, 기능 소개를 호수별로 지정할 수 있게 한다.

**Architecture:** 세 기능 모두 `BriefingPayload`의 optional 필드로 들어간다. 서버(`buildBriefingData`)가 뉴스 후보와 수시 목표를 담고, 로컬 `claude -p`가 후보 중 1건을 골라 `story.newsPick`에 넣으며, 렌더러가 필드 유무로 섹션을 조건부 출력한다. API 라우트·DB 스키마·발행 흐름은 무변경 — 발행 스크립트가 서버 payload에 덧붙이는 것이 `story` 하나뿐이라 `newsPick`을 그 안에 두면 배관이 필요 없다.

**Tech Stack:** TypeScript / Next.js App Router / Vitest / Supabase(admin client) / claude CLI(`claude -p`)

## Global Constraints

- 대상 호수는 **3호부터**. 1·2호는 발행 완료라 payload가 고정이므로 optional 필드 패턴만으로 자동 충족된다.
- 새 섹션은 **데이터가 없으면 필드를 만들지 않는다.** 렌더러는 필드 유무로만 판단한다 (빈 배열·빈 문자열로 "있음" 표시 금지).
- `any` 금지. `@ts-ignore` 금지. `console.log` 잔류 금지 (`console.error`/`console.warn`은 기존 패턴대로 허용).
- 주석·문구는 한국어. 커밋 접두사만 영어 (`feat:`/`fix:`/`test:`/`docs:`).
- 날짜 비교는 `yyyy-MM-dd` ISO 문자열 사전순. 시각 계산은 KST(`Asia/Seoul`) 기준 — 테스트는 `TZ=Asia/Seoul`로 돈다.
- 뉴스레터 색은 `nl-sky` / `nl-ivory` / `nl-muted` / `nl-ink` 토큰만 사용. 하드코딩 hex 금지.
- 4년제 수시 접수 시작: **2026-09-07**. 전문대는 같은 날 시작해 9/30 종료(표시에는 4년제만 쓴다).
- 신규 `FEATURE_INTROS` 항목은 **배열 끝에 append**한다. 중간 삽입 시 4호·40호 순환 테스트가 깨진다.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/features/automations/jobs/team-briefing-build.ts` | 순수 집계·타입·선택 로직 | `SasiWeek`/`SasiGoal`/`NewsCandidate`/`NewsPick` 타입, `SASI_WEEKS` 상수, `pickSasiGoal()`, `FEATURE_PINS` + `pickFeatureIntros` 분기, `FEATURE_INTROS` 2건 append, `BriefingStory.newsPick?`, `BriefingPayload.newsCandidates?`·`sasiGoal?` |
| `src/features/automations/jobs/__tests__/team-briefing-build.test.ts` | 위 순수 함수 테스트 | 신규 describe 2개 + 기존 "3호 순환" 테스트 교체 |
| `scripts/team-briefing/story-lib.mjs` | claude 프롬프트·파싱·폴백 | 프롬프트에 뉴스 후보·JSON 계약 추가, `parseStoryJson(text, candidates)` 검증 |
| `src/features/automations/jobs/__tests__/team-briefing-story-lib.test.ts` | 위 테스트 | `newsPick` 파싱·환각 방지 케이스 |
| `scripts/team-briefing/publish-local.mjs` | 실행 흐름 | `parseStoryJson`에 후보 전달 |
| `src/features/automations/jobs/team-briefing.ts` | 데이터 fetch·조립 | `news` 후보 조회 + `pickSasiGoal` 주입 |
| `src/features/automations/jobs/__tests__/team-briefing.test.ts` | 위 테스트 | `news` 테이블 mock + payload 단언 |
| `src/app/r/briefing/[token]/_components/NewsletterIcons.tsx` | 뉴스레터 아이콘 | `NewspaperIcon`·`FlagIcon` 추가 |
| `src/app/r/briefing/[token]/_components/BriefingNewsletter.tsx` | 뉴스레터 렌더 | 두 섹션 조건부 렌더 |
| `src/app/r/briefing/[token]/_components/__tests__/BriefingNewsletter.test.tsx` | 위 테스트 | 섹션 렌더/미렌더 |

**작업 순서 근거:** Task 1·2는 서로 독립인 순수 함수다. Task 3이 타입을 정의하고, Task 4가 그 타입을 채우며, Task 5가 소비한다. 1→2→3→4→5 순서로 가면 각 태스크가 앞선 결과만 의존한다.

---

### Task 1: 수시 준비 주차표 + `pickSasiGoal`

**Files:**
- Modify: `src/features/automations/jobs/team-briefing-build.ts`
- Test: `src/features/automations/jobs/__tests__/team-briefing-build.test.ts`

**Interfaces:**
- Consumes: 파일 내 기존 헬퍼 `ymdToUtc(ymd: string): Date` (38행 부근)
- Produces:
  - `export type SasiGoal = { label: string; rangeLabel: string; devTarget?: string; testTarget?: string; note?: string; dDay: number; applyStartLabel: string }`
  - `export function pickSasiGoal(todayYmd: string): SasiGoal | undefined`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`team-briefing-build.test.ts` 상단 import에 `pickSasiGoal`을 추가하고, 파일 끝에 append:

```ts
describe("pickSasiGoal — 발행일이 속한 수시 주차", () => {
  it("8월 1주차 시작일(8/3)이면 개발 50%·테스트 20%", () => {
    const g = pickSasiGoal("2026-08-03");
    expect(g).toEqual({
      label: "8월 1주차",
      rangeLabel: "8/3~8/9",
      devTarget: "50%",
      testTarget: "20%",
      note: undefined,
      dDay: 35,
      applyStartLabel: "9/7(월)",
    });
  });

  it("주차 마지막 날(8/9)도 같은 주차", () => {
    expect(pickSasiGoal("2026-08-09")?.label).toBe("8월 1주차");
  });

  it("다음 날(8/10)은 다음 주차로 넘어간다", () => {
    const g = pickSasiGoal("2026-08-10");
    expect(g?.label).toBe("8월 2주차");
    expect(g?.devTarget).toBe("70%");
    expect(g?.testTarget).toBe("50%");
  });

  it("8월 4주차는 개발 목표가 없고 테스트 100%만", () => {
    const g = pickSasiGoal("2026-08-24");
    expect(g?.devTarget).toBeUndefined();
    expect(g?.testTarget).toBe("100%");
  });

  it("9월 1주차는 목표 대신 비고", () => {
    const g = pickSasiGoal("2026-09-04");
    expect(g?.label).toBe("9월 1주차");
    expect(g?.note).toBe("최종 테스트 진행");
    expect(g?.dDay).toBe(3);
  });

  it("마지막 주차를 넘기면 섹션이 사라진다", () => {
    expect(pickSasiGoal("2026-09-05")).toBeUndefined();
  });

  it("시작 이전(7/26)도 없음", () => {
    expect(pickSasiGoal("2026-07-26")).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing-build.test.ts -t "pickSasiGoal"`
Expected: FAIL — `pickSasiGoal is not a function` (또는 import 에러)

- [ ] **Step 3: 최소 구현**

`team-briefing-build.ts`의 `// ─── 일정 그룹 ───` 섹션 **앞**에 추가한다 (날짜 헬퍼 `ymdToUtc`/`addDaysYmd` 바로 아래):

```ts
// ─── 수시 준비 주차 목표 ─────────────────────────────────────

/** 4년제 수시 접수 시작일 — D-day 기준. 전문대도 같은 날 시작(9/30 종료). */
const SASI_APPLY_START_YMD = "2026-09-07";

type SasiWeek = {
  label: string;
  startYmd: string;
  endYmd: string;
  devTarget?: string;
  testTarget?: string;
  note?: string;
};

/**
 * 2026 수시 준비 주차별 목표 — 운영부 확정표.
 * 마지막 주차(9/4)를 넘기면 pickSasiGoal이 undefined를 돌려 섹션이 자동으로 사라진다.
 */
const SASI_WEEKS: SasiWeek[] = [
  { label: "7월 5주차", startYmd: "2026-07-27", endYmd: "2026-08-02", devTarget: "20%" },
  { label: "8월 1주차", startYmd: "2026-08-03", endYmd: "2026-08-09", devTarget: "50%", testTarget: "20%" },
  { label: "8월 2주차", startYmd: "2026-08-10", endYmd: "2026-08-16", devTarget: "70%", testTarget: "50%" },
  { label: "8월 3주차", startYmd: "2026-08-17", endYmd: "2026-08-23", devTarget: "100%", testTarget: "70%" },
  { label: "8월 4주차", startYmd: "2026-08-24", endYmd: "2026-08-30", testTarget: "100%" },
  { label: "9월 1주차", startYmd: "2026-08-31", endYmd: "2026-09-04", note: "최종 테스트 진행" },
];

export type SasiGoal = {
  label: string;
  /** "8/3~8/9" */
  rangeLabel: string;
  devTarget?: string;
  testTarget?: string;
  note?: string;
  /** 4년제 접수 시작까지 남은 일수 */
  dDay: number;
  /** "9/7(월)" */
  applyStartLabel: string;
};

/** "2026-08-03" → "8/3" (앞 0 제거) */
function mmddSlash(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = ymdToUtc(toYmd).getTime() - ymdToUtc(fromYmd).getTime();
  return Math.round(ms / 86400000);
}

/**
 * 발행일이 속한 수시 주차 1건. 어느 주차에도 안 걸리면 undefined —
 * 시즌이 끝나면 섹션이 저절로 사라지므로 나중에 코드를 지우러 올 필요가 없다.
 */
export function pickSasiGoal(todayYmd: string): SasiGoal | undefined {
  const week = SASI_WEEKS.find(
    (w) => todayYmd >= w.startYmd && todayYmd <= w.endYmd,
  );
  if (!week) return undefined;
  return {
    label: week.label,
    rangeLabel: `${mmddSlash(week.startYmd)}~${mmddSlash(week.endYmd)}`,
    devTarget: week.devTarget,
    testTarget: week.testTarget,
    note: week.note,
    dDay: daysBetween(todayYmd, SASI_APPLY_START_YMD),
    applyStartLabel: "9/7(월)",
  };
}
```

`BriefingPayload`(508행 부근)에 필드 추가:

```ts
  /** 수시 준비 주차 목표 — 시즌 밖이면 없음 */
  sasiGoal?: SasiGoal;
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing-build.test.ts -t "pickSasiGoal"`
Expected: PASS 7건

- [ ] **Step 5: 커밋**

```bash
git add src/features/automations/jobs/team-briefing-build.ts src/features/automations/jobs/__tests__/team-briefing-build.test.ts
git commit -m "feat(briefing): 수시 준비 주차 목표 선택 함수"
```

---

### Task 2: 기능 소개 핀 + 카탈로그 2건

**Files:**
- Modify: `src/features/automations/jobs/team-briefing-build.ts` (`FEATURE_INTROS`, `pickFeatureIntros`)
- Test: `src/features/automations/jobs/__tests__/team-briefing-build.test.ts` (기존 describe 수정 + 신규)

**Interfaces:**
- Consumes: 기존 `FEATURE_INTROS: FeatureIntro[]`, `FEATURE_ROTATION`
- Produces: `pickFeatureIntros(issueNo: number, count?: number): FeatureIntro[]` — 시그니처 불변, 핀 우선 동작 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

기존 테스트 중 **"3호는 앵커 다음(index 2)부터 3건"** 을 아래로 **교체**한다 (404행). 3호가 핀으로 바뀌므로 이 단언은 더 이상 유효하지 않다:

```ts
  it("3호는 핀으로 지정한 2건", () => {
    const r = pickFeatureIntros(3);
    expect(r.map((f) => f.title)).toEqual([
      "경쟁률 세팅 점검 자동화",
      "백업 요청 검색에 합격자통합관리 발표 서비스",
    ]);
  });
```

그리고 파일 끝에 신규 describe를 append:

```ts
describe("pickFeatureIntros — 호수별 핀", () => {
  it("핀 없는 호는 기존 순환을 그대로 쓴다", () => {
    expect(pickFeatureIntros(4)).toEqual(FEATURE_INTROS.slice(5, 8));
  });

  it("핀이 있어도 count를 명시하면 그 개수만", () => {
    expect(pickFeatureIntros(3, 1)).toHaveLength(1);
  });

  it("핀 항목은 카탈로그에 실제로 존재한다", () => {
    for (const f of pickFeatureIntros(3)) {
      expect(FEATURE_INTROS).toContain(f);
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing-build.test.ts -t "pickFeatureIntros"`
Expected: FAIL — 3호가 핀 2건이 아니라 `FEATURE_INTROS.slice(2,5)`를 돌려줌

- [ ] **Step 3: 최소 구현**

`FEATURE_INTROS` 배열 **끝**에 2건 append (중간 삽입 금지 — 4호·40호 테스트가 깨진다):

```ts
  {
    menu: "AI & 자동화 > 자동화실행",
    title: "경쟁률 세팅 점검 자동화",
    desc: "TEST 서버 경쟁률 세팅(스케줄·안내 문구·접수일정)을 대조해 어긋난 건을 담당 운영자 Teams 개인 채팅으로 알립니다. 합의된 정상 건은 예외로 등록해 알림에서 뺄 수 있어요.",
  },
  {
    menu: "서비스 > 백업 요청",
    title: "백업 요청 검색에 합격자통합관리 발표 서비스",
    desc: "백업 요청 서비스 검색에서 원서접수뿐 아니라 합격자통합관리시스템 발표 서비스도 함께 찾습니다. [원서]/[발표] 배지로 구분되고, 발표 서비스는 서비스목록에서 붙여넣기로 일괄등록해요.",
  },
```

`FEATURE_ROTATION` 선언 바로 아래에 핀 맵 추가:

```ts
/**
 * 호수별 기능 소개 지정 — title로 지정한다.
 *
 * 인덱스로 잡으면 카탈로그에 항목을 추가할 때 뒤 인덱스가 밀려 과거 핀이 조용히
 * 다른 기능을 가리킨다. title은 카탈로그 내 고유하고, 이 맵만 읽어도 어느 호에
 * 무엇을 실었는지 사람이 안다. 핀이 없는 호는 FEATURE_ROTATION 순환이 돈다.
 */
const FEATURE_PINS: Record<number, string[]> = {
  3: ["경쟁률 세팅 점검 자동화", "백업 요청 검색에 합격자통합관리 발표 서비스"],
};
```

`pickFeatureIntros` 본문 맨 앞(`const len = FEATURE_INTROS.length;` 위)에 분기 추가:

```ts
  const pinned = FEATURE_PINS[Math.max(1, Math.floor(issueNo))];
  if (pinned) {
    // title 오타로 발행이 깨지지 않게, 못 찾은 항목은 건너뛴다.
    const picked = pinned
      .map((t) => FEATURE_INTROS.find((f) => f.title === t))
      .filter((f): f is FeatureIntro => f !== undefined);
    if (picked.length > 0) return picked.slice(0, count ?? picked.length);
  }
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing-build.test.ts`
Expected: PASS 전체 (4호·40호·count 기존 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add src/features/automations/jobs/team-briefing-build.ts src/features/automations/jobs/__tests__/team-briefing-build.test.ts
git commit -m "feat(briefing): 기능 소개 호수별 핀 + 신규 2건 추가"
```

---

### Task 3: 뉴스 후보 타입 + claude 프롬프트·파싱

**Files:**
- Modify: `src/features/automations/jobs/team-briefing-build.ts` (타입만)
- Modify: `scripts/team-briefing/story-lib.mjs`
- Modify: `scripts/team-briefing/publish-local.mjs`
- Test: `src/features/automations/jobs/__tests__/team-briefing-story-lib.test.ts`

**Interfaces:**
- Consumes: Task 1의 `BriefingPayload` (필드 추가 지점)
- Produces:
  - `export type NewsCandidate = { title: string; url: string; source?: string | null; publishedAt?: string | null; keyword?: string | null }`
  - `export type NewsPick = { title: string; url: string; source?: string | null; publishedAt?: string | null; comment: string }`
  - `BriefingStory.newsPick?: NewsPick`
  - `BriefingPayload.newsCandidates?: NewsCandidate[]`
  - `parseStoryJson(text: string, candidates?: NewsCandidate[])` — 2번째 인자 추가(기본 `[]`)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`team-briefing-story-lib.test.ts` 파일 끝에 append:

```ts
describe("parseStoryJson — 대학가 소식 픽", () => {
  const candidates = [
    { title: "사립대학구조개선법 시행령 통과", url: "https://a.example/1" },
    { title: "광양보건대 폐교부지 공공매입 촉구", url: "https://a.example/2" },
  ];
  const base = {
    headline: "h",
    intro: "i",
    sections: { contracts: "c", schedule: "s", closing: "cl", ai: "a" },
  };

  it("후보에 있는 링크를 고르면 newsPick이 살아남는다", () => {
    const text = JSON.stringify({
      ...base,
      newsPick: {
        title: "사립대학구조개선법 시행령 통과",
        url: "https://a.example/1",
        comment: "교육부가 직접 폐교 명령을 내릴 수 있게 됩니다.",
      },
    });
    const story = parseStoryJson(text, candidates);
    expect(story?.newsPick?.url).toBe("https://a.example/1");
    expect(story?.newsPick?.comment).toContain("교육부");
  });

  it("후보에 없는 링크는 버린다 (환각 방지)", () => {
    const text = JSON.stringify({
      ...base,
      newsPick: {
        title: "지어낸 기사",
        url: "https://fake.example/999",
        comment: "그럴듯한 코멘트",
      },
    });
    const story = parseStoryJson(text, candidates);
    expect(story).not.toBeNull();
    expect(story?.newsPick).toBeUndefined();
  });

  it("comment가 없으면 버린다", () => {
    const text = JSON.stringify({
      ...base,
      newsPick: { title: "t", url: "https://a.example/1" },
    });
    expect(parseStoryJson(text, candidates)?.newsPick).toBeUndefined();
  });

  it("newsPick이 아예 없어도 story는 정상 파싱된다", () => {
    const story = parseStoryJson(JSON.stringify(base), candidates);
    expect(story?.headline).toBe("h");
    expect(story?.newsPick).toBeUndefined();
  });

  it("후보를 안 넘기면 newsPick은 무조건 버린다", () => {
    const text = JSON.stringify({
      ...base,
      newsPick: { title: "t", url: "https://a.example/1", comment: "c" },
    });
    expect(parseStoryJson(text)?.newsPick).toBeUndefined();
  });
});

describe("buildStoryPrompt — 뉴스 후보", () => {
  it("후보가 있으면 제목과 링크를 프롬프트에 싣는다", () => {
    const p = buildStoryPrompt(
      {
        ...payload,
        newsCandidates: [
          {
            title: "사립대 구조개선법 통과",
            url: "https://a.example/1",
            source: "usline",
          },
        ],
      },
      3,
    );
    expect(p).toContain("사립대 구조개선법 통과");
    expect(p).toContain("https://a.example/1");
    expect(p).toContain("newsPick");
  });

  it("후보가 없으면 '없음'으로 표기한다", () => {
    expect(buildStoryPrompt(payload, 3)).toContain("대학가 소식 후보: 없음");
  });
});
```

> `payload`는 이 테스트 파일 9행의 모듈 레벨 픽스처다 (새로 만들지 말 것).

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing-story-lib.test.ts`
Expected: FAIL — `newsPick`이 undefined가 아니라 파싱조차 안 됨 / 프롬프트에 후보 문자열 없음

- [ ] **Step 3: 최소 구현 — 타입**

`team-briefing-build.ts`에 추가 (`BriefingStory` 선언 앞):

```ts
// ─── 대학가 소식 (통폐합·폐교) ───────────────────────────────

/** claude에게 넘기는 뉴스 후보 1건 — news 테이블 row 축약. */
export type NewsCandidate = {
  title: string;
  url: string;
  source?: string | null;
  publishedAt?: string | null;
  keyword?: string | null;
};

/** claude가 고른 1건 + 운영부 관점 코멘트. */
export type NewsPick = {
  title: string;
  url: string;
  source?: string | null;
  publishedAt?: string | null;
  comment: string;
};
```

`BriefingStory`에 필드 추가:

```ts
  /** 대학가 소식 1건 — claude가 후보 중 골랐을 때만. 구 발행분에는 없다. */
  newsPick?: NewsPick;
```

`BriefingPayload`에 필드 추가:

```ts
  /** 대학가 소식 후보 (통폐합·폐교, 최근 7일) — claude 선별 입력. 발행 후에도 남겨 감사 추적에 쓴다. */
  newsCandidates?: NewsCandidate[];
```

- [ ] **Step 4: 최소 구현 — 프롬프트**

`story-lib.mjs`의 `buildStoryPrompt` 안, `albumLine` 정의 아래에 추가:

```js
  const newsLine =
    (payload.newsCandidates ?? []).length === 0
      ? "없음"
      : payload.newsCandidates
          .map(
            (n, i) =>
              `${i + 1}) ${n.title}${n.source ? `(${n.source})` : ""} ${n.url}`,
          )
          .join("\n  ");
```

JSON 계약 줄(98행)을 교체한다:

```js
{"headline": "...", "teaser": "...", "intro": "...", "sections": {"contracts": "...", "schedule": "...", "closing": "...", "ai": "...", "celebration": "...", "features": "...", "album": "..."}, "newsPick": {"title": "...", "url": "...", "comment": "..."}}
```

규칙 목록(`- album:` 줄 다음)에 추가:

```js
- newsPick: 아래 '대학가 소식 후보' 중 운영부(대학 입시·원서접수 운영) 동료가 알아둘 만한 기사를 **정확히 1건만** 고르세요. title·url은 후보에 적힌 것을 **그대로 복사**하고(변형·창작 금지), comment에는 왜 알아둘 만한지를 1~2문장으로 쓰세요. 정치·연예 등 업무와 무관한 기사만 있거나 후보가 '없음'이면 newsPick 키를 아예 빼세요 — 억지로 고르지 마세요.
```

데이터 블록(`- 사진·영상:` 줄 다음)에 추가:

```js
- 대학가 소식 후보: ${newsLine}
```

- [ ] **Step 5: 최소 구현 — 파싱**

`parseStoryJson` 시그니처와 반환을 바꾼다:

```js
/**
 * claude 응답 텍스트 → BriefingStory | null. 코드펜스/전후 텍스트 허용.
 * candidates를 넘기면 newsPick.url이 후보에 실제로 있는지 대조한다 —
 * LLM이 기사를 지어내 링크가 깨진 채 발행되는 것을 막는 유일한 방어선이다.
 */
export function parseStoryJson(text, candidates = []) {
```

`return { ... }` 직전에 픽 검증을 넣고, 반환 객체에 `newsPick`을 추가한다:

```js
  const p = obj?.newsPick;
  const known = new Set(candidates.map((c) => c.url));
  const newsPick =
    p && isStr(p.title) && isStr(p.url) && isStr(p.comment) && known.has(p.url)
      ? {
          title: p.title,
          url: p.url,
          source: isStr(p.source) ? p.source : undefined,
          publishedAt: isStr(p.publishedAt) ? p.publishedAt : undefined,
          comment: p.comment,
        }
      : undefined;
```

```js
  return {
    headline: obj.headline,
    teaser: isStr(obj?.teaser) ? obj.teaser : undefined,
    intro: obj.intro,
    newsPick,
    sections: { /* 기존 그대로 */ },
  };
```

- [ ] **Step 6: 호출부에 후보를 넘긴다**

`publish-local.mjs`의 `generateStory` 안, `parseStoryJson(...)` 호출에 2번째 인자를 추가한다:

```js
    const story = parseStoryJson(out, payload.newsCandidates ?? []);
```

> `fallbackStory`는 손대지 않는다 — 폴백에는 `newsPick`이 없어야 한다(고를 근거가 없으므로).

- [ ] **Step 7: 통과를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing-story-lib.test.ts`
Expected: PASS 전체

- [ ] **Step 8: 커밋**

```bash
git add src/features/automations/jobs/team-briefing-build.ts scripts/team-briefing/story-lib.mjs scripts/team-briefing/publish-local.mjs src/features/automations/jobs/__tests__/team-briefing-story-lib.test.ts
git commit -m "feat(briefing): 대학가 소식 후보 프롬프트 + 픽 환각 방지 검증"
```

---

### Task 4: 서버 집계 — 뉴스 후보 조회 + 수시 목표 주입

**Files:**
- Modify: `src/features/automations/jobs/team-briefing.ts` (`buildBriefingData`)
- Test: `src/features/automations/jobs/__tests__/team-briefing.test.ts`

**Interfaces:**
- Consumes: Task 1의 `pickSasiGoal`, Task 3의 `NewsCandidate`
- Produces: `payload.newsCandidates`·`payload.sasiGoal`이 채워진 `BriefingPayload`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

**먼저 mock 체이너에 `.in()`을 추가한다.** 새 쿼리가 `.in("keyword", [...])`를 쓰는데 현재 `chain()`에 없어 `TypeError`가 난다. `Chain` 타입(46행)과 `chain()` 본문(56행) 양쪽에 한 줄씩:

```ts
type Chain = {
  select: () => Chain;
  not: () => Chain;
  in: () => Chain;      // ← 추가
  gte: () => Chain;
  // ... 나머지 그대로
};
```

```ts
  const c: Chain = {
    select: () => c,
    not: () => c,
    in: () => c,        // ← 추가
    gte: () => c,
    // ... 나머지 그대로
  };
```

`adminFrom.mockImplementation`(122행)에 `news` 분기를 추가한다 — `operators` 분기 옆:

```ts
    if (table === "news")
      return chain([
        {
          title: "사립대학구조개선법 시행령 통과",
          link: "https://a.example/1",
          source: "usline",
          published_at: "2026-08-06T00:00:00+09:00",
          keyword: "폐교",
        },
      ]);
```

그리고 아래 테스트를 append한다:

```ts
it("뉴스 후보와 수시 목표를 payload에 담는다", async () => {
  const res = await buildBriefingData();
  expect(res.ok).toBe(true);
  if (!res.ok) return;
  expect(res.payload.newsCandidates).toEqual([
    {
      title: "사립대학구조개선법 시행령 통과",
      url: "https://a.example/1",
      source: "usline",
      publishedAt: "2026-08-06T00:00:00+09:00",
      keyword: "폐교",
    },
  ]);
  // 수시 시즌 안이면 주차가, 밖이면 undefined가 들어간다. 실행일에 따라 값이 달라지므로
  // 상수와 비교하지 않고 pickSasiGoal(오늘)과 일치하는지로 단언한다 —
  // 그렇게 해야 9월이 지나도 이 테스트가 시들지 않는다.
  expect(res.payload.sasiGoal).toEqual(
    pickSasiGoal(
      new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }),
    ),
  );
});
```

이 테스트 파일은 현재 `runTeamBriefing`·`stageBriefingDraft`·`publishStagedDraft`만 import한다. **`buildBriefingData`와 `pickSasiGoal`을 둘 다 추가해야 한다:**

```ts
import {
  runTeamBriefing,
  stageBriefingDraft,
  publishStagedDraft,
  buildBriefingData,
} from "../team-briefing";
import { pickSasiGoal } from "../team-briefing-build";
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts -t "뉴스 후보"`
Expected: FAIL — `newsCandidates`가 undefined

- [ ] **Step 3: 최소 구현**

`team-briefing.ts`의 import에 추가:

```ts
  pickSasiGoal,
  type NewsCandidate,
```

`buildBriefingData` 안, 사진 수집(`collectNewsletterImages`) 호출 **앞**에 추가:

```ts
  // 대학가 소식 후보 — 통폐합·폐교 최근 7일. claude가 이 중 1건을 고른다.
  // 최신순 상한 20건: 프롬프트 길이를 묶으면서 한 주치를 덮기에 충분하다.
  const { data: newsData, error: newsErr } = await admin
    .from("news")
    .select("title, link, source, published_at, keyword")
    .in("keyword", ["통폐합", "폐교"])
    .gte("published_at", `${addDaysYmd(todayYmd, -7)}T00:00:00+09:00`)
    .order("published_at", { ascending: false })
    .limit(20);
  if (newsErr) return { ok: false, message: `뉴스 조회 실패: ${newsErr.message}` };
  const newsCandidates: NewsCandidate[] = (newsData ?? []).map((n) => ({
    title: String(n.title),
    url: String(n.link),
    source: n.source as string | null,
    publishedAt: n.published_at as string | null,
    keyword: n.keyword as string | null,
  }));
```

payload 조립부(`return { ok: true, payload: { ... } }`)에 두 필드를 추가한다:

```ts
      newsCandidates,
      sasiGoal: pickSasiGoal(todayYmd),
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/automations/jobs/__tests__/team-briefing.test.ts`
Expected: PASS 전체 (기존 테스트 포함 — `news` 분기를 안 넣은 기존 케이스가 깨지면 mock에 빈 배열 분기를 추가한다)

- [ ] **Step 5: 커밋**

```bash
git add src/features/automations/jobs/team-briefing.ts src/features/automations/jobs/__tests__/team-briefing.test.ts
git commit -m "feat(briefing): 뉴스 후보 조회 + 수시 목표를 payload에 담는다"
```

---

### Task 5: 뉴스레터 렌더 — 두 섹션

**Files:**
- Modify: `src/app/r/briefing/[token]/_components/NewsletterIcons.tsx`
- Modify: `src/app/r/briefing/[token]/_components/BriefingNewsletter.tsx`
- Test: `src/app/r/briefing/[token]/_components/__tests__/BriefingNewsletter.test.tsx`

**Interfaces:**
- Consumes: `payload.sasiGoal`(Task 1), `payload.story.newsPick`(Task 3)
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`BriefingNewsletter.test.tsx` 파일 끝에 append. `payload`는 이 파일 6행의 모듈 레벨 픽스처다 (새로 만들지 말 것):

```tsx
describe("대학가 소식 · 수시 준비 섹션", () => {
  it("newsPick이 있으면 제목·코멘트·링크를 렌더한다", () => {
    render(
      <BriefingNewsletter
        issueNo={3}
        payload={{
          ...payload,
          story: {
            headline: "h",
            intro: "i",
            sections: {
              contracts: "c",
              schedule: "s",
              closing: "cl",
              ai: "a",
            },
            newsPick: {
              title: "사립대학구조개선법 시행령 통과",
              url: "https://a.example/1",
              source: "usline",
              comment: "교육부가 직접 폐교 명령을 내릴 수 있게 됩니다.",
            },
          },
        }}
      />,
    );
    expect(screen.getByText("대학가 소식")).toBeInTheDocument();
    expect(screen.getByText(/교육부가 직접 폐교 명령/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "사립대학구조개선법 시행령 통과" }),
    ).toHaveAttribute("href", "https://a.example/1");
  });

  it("newsPick이 없으면 섹션 자체가 없다", () => {
    render(<BriefingNewsletter issueNo={3} payload={payload} />);
    expect(screen.queryByText("대학가 소식")).not.toBeInTheDocument();
  });

  it("sasiGoal이 있으면 주차·목표·D-day를 렌더한다", () => {
    render(
      <BriefingNewsletter
        issueNo={3}
        payload={{
          ...payload,
          sasiGoal: {
            label: "8월 1주차",
            rangeLabel: "8/3~8/9",
            devTarget: "50%",
            testTarget: "20%",
            dDay: 35,
            applyStartLabel: "9/7(월)",
          },
        }}
      />,
    );
    expect(screen.getByText("수시 준비")).toBeInTheDocument();
    expect(screen.getByText("8월 1주차 (8/3~8/9)")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("D-35")).toBeInTheDocument();
  });

  it("sasiGoal이 없으면 섹션 자체가 없다", () => {
    render(<BriefingNewsletter issueNo={3} payload={payload} />);
    expect(screen.queryByText("수시 준비")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run "src/app/r/briefing/[token]/_components/__tests__/BriefingNewsletter.test.tsx"`
Expected: FAIL — "대학가 소식"/"수시 준비" 텍스트를 못 찾음

- [ ] **Step 3: 아이콘 2개 추가**

`NewsletterIcons.tsx` 끝에 append (파일 공통 `base` 스프레드와 점눈+미소 스타일을 따른다):

```tsx
/** 신문 — 대학가 소식. 접힌 모서리에 표정. */
export function NewspaperIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.5 7.5h14a1.5 1.5 0 0 1 1.5 1.5v11a2 2 0 0 1-2 2h-12a2 2 0 0 1-2-2V7.5Z" />
      <path d="M20 11h2.5a1 1 0 0 1 1 1v8a2 2 0 0 1-2 2H20" />
      <path d="M7.5 11h5v3h-5z" />
      <path d="M15.5 11h1.5M15.5 14h1.5M7.5 17.5h9" />
      <circle cx="9" cy="12.2" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="11" cy="12.2" r="0.55" fill="currentColor" stroke="none" />
      <path d="M9.3 13.2c.5.4 1 .4 1.5 0" strokeWidth={1.2} />
    </svg>
  );
}

/** 깃발 — 수시 준비 목표. 정상에 별 하나. */
export function FlagIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 23V4.5" />
      <path d="M7 5.5h11.5l-2.2 3.6 2.2 3.6H7" />
      <path d="M4.8 23h4.4" />
      <path
        d="m11.4 8.1.5-1.1.5 1.1 1.2.2-.9.8.2 1.2-1-.6-1 .6.2-1.2-.9-.8 1.2-.2Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
```

- [ ] **Step 4: 섹션 렌더 구현**

`BriefingNewsletter.tsx` import에 `NewspaperIcon`, `FlagIcon`을 추가하고, 구조 분해에 `sasiGoal`을 추가한다:

```tsx
    featureIntros = [],
    sasiGoal,
    images,
    story,
```

`{/* ── 이번 주 기능 소개 ... */}` 블록 **앞**에 두 섹션을 넣는다 (수시 준비 → 대학가 소식 순):

```tsx
          {/* ── 수시 준비 (시즌 안일 때만) ────────────── */}
          {sasiGoal && (
            <Section
              icon={<FlagIcon className="h-6 w-6 text-nl-sky" />}
              title="수시 준비"
            >
              <Card>
                <p className="text-[16px] font-bold text-nl-sky">
                  {`${sasiGoal.label} (${sasiGoal.rangeLabel})`}
                </p>
                {sasiGoal.note ? (
                  <p className="mt-2 text-[15px] leading-[1.75]">
                    {sasiGoal.note}
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1 text-[15px] leading-[1.75]">
                    {sasiGoal.devTarget && (
                      <li>
                        <span className="text-nl-muted">개발요청</span>{" "}
                        <span className="font-bold">{sasiGoal.devTarget}</span>
                      </li>
                    )}
                    {sasiGoal.testTarget && (
                      <li>
                        <span className="text-nl-muted">테스트오픈</span>{" "}
                        <span className="font-bold">{sasiGoal.testTarget}</span>
                      </li>
                    )}
                  </ul>
                )}
                <p className="mt-3 text-[15px]">
                  <span className="text-nl-muted">4년제 수시 접수까지 </span>
                  <span className="font-bold text-nl-sky">{`D-${sasiGoal.dDay}`}</span>
                  <span className="text-nl-muted">{` (${sasiGoal.applyStartLabel})`}</span>
                </p>
              </Card>
            </Section>
          )}

          {/* ── 대학가 소식 (claude가 골랐을 때만) ────────── */}
          {story?.newsPick && (
            <Section
              icon={<NewspaperIcon className="h-6 w-6 text-nl-sky" />}
              title="대학가 소식"
            >
              <Card>
                <a
                  href={story.newsPick.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[16px] font-bold text-nl-sky underline"
                >
                  {story.newsPick.title}
                </a>
                {story.newsPick.source && (
                  <p className="mt-0.5 text-xs font-medium text-nl-muted">
                    {story.newsPick.source}
                  </p>
                )}
                <p className="mt-2 text-[15px] leading-[1.75]">
                  {story.newsPick.comment}
                </p>
              </Card>
            </Section>
          )}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run "src/app/r/briefing/[token]/_components/__tests__/BriefingNewsletter.test.tsx"`
Expected: PASS 전체

- [ ] **Step 6: 전체 검증**

```bash
npm test
npm run typecheck
npx eslint src/features/automations src/app/r/briefing scripts/team-briefing
```
Expected: 전부 통과, 실패 0 / exit 0

- [ ] **Step 7: 커밋**

```bash
git add "src/app/r/briefing/[token]/_components"
git commit -m "feat(briefing): 대학가 소식·수시 준비 섹션 렌더"
```

---

## 운영 절차 (구현 후)

1. PR 머지 → 배포
2. **3호 초안을 다시 생성한다** — 기존 8/3자 draft에는 새 필드가 없다. 회사/맥에서 `node scripts/team-briefing/publish-local.mjs` 실행 (기존 draft를 덮어씀)
3. 자동화 페이지에서 초안 확인 — 대학가 소식 1건, 수시 준비 주차, 기능 소개 2건이 보이는지
4. 이상 없으면 **[발행]**

`--dry` 옵션으로 스토리만 먼저 볼 수 있다: `node scripts/team-briefing/publish-local.mjs --dry`

## 4호 이후

기능 소개는 매 호 사용자가 지정한다. 지정이 오면 `FEATURE_PINS`에 1줄 추가하면 끝이다:

```ts
const FEATURE_PINS: Record<number, string[]> = {
  3: ["경쟁률 세팅 점검 자동화", "백업 요청 검색에 합격자통합관리 발표 서비스"],
  4: ["..."],   // ← 다음 호
};
```
