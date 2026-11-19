# 주간업무보고 역할별 화면 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주간업무보고 화면을 역할 탭 셋(내 보고서·제출 현황·관리)으로 가르고, 내 보고서는 '볼 것 | 쓸 것' 두 칸과 프로젝트·TF 서랍으로, 관리는 왼쪽 메뉴형으로 바꾸며, 남의 보고서·제출 현황·관리 데이터는 볼 수 있는 사람에게만 서버가 읽어 넘긴다.

**Architecture:** 판정은 순수 함수가 한다 — `permissions.ts` 의 `statusAccess`(관리자·그 주 당번 = `manage`, 보고 끝난 주의 받는 사람 = `read`)와 `_params.ts` 의 `resolveTab`(주소 어휘는 그대로, 권한 없는 값은 그 사람의 처음 화면, 볼 화면이 없으면 `null`). `_load.ts` 가 이 판정으로 보는 대상(`pickViewed`)과 읽을 데이터를 정하고, 볼 화면이 없으면 `no-access` 를 돌려준다. 화면 안의 전환은 URL 이 공유 상태다 — 영역(`tab`)·하위 칸(`sub`)·관리 메뉴(`section`)를 `history.replaceState` 로 바꾸고 `useSearchParams` 로 읽는다(#1265 `use-ops-sub.ts` 와 같은 방식). 영역 본문 셋·특이사항 셋·직접 추가 폼 셋·서랍 내용 둘·관리 칸 일곱은 늘 마운트하고 `hidden` 으로만 숨긴다.

**Tech Stack:** Next.js 16 App Router(RSC + client), React 19, TypeScript, Tailwind CSS 4, Supabase service_role(`createAdminClient`), Vitest + Testing Library(`npm test` = `TZ=Asia/Seoul`).

**Spec:** `docs/superpowers/specs/2026-11-19-ops-weekly-role-layout-design.md` (구속력 있음. 실행자는 이 계획과 spec 을 둘 다 읽는다.)

## Global Constraints

- **작업 위치**: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-ops-weekly-role-layout`(브랜치 `feat/ops-weekly-role-layout`)에서만. 본 트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console` 는 건드리지 않는다. node_modules 는 본 트리로 가는 정션이다 — 설치 명령 금지.
- **저메모리 PC**: dev 서버·`next build`·전체 vitest 금지. 테스트는 `npm test -- <파일들> --maxWorkers=1`. `npm run typecheck`·`npm run lint` 는 Task 17 에서만 돈다. CI 가 독립 검증이다.
- **바뀌지 않는 것**(spec §3): DB 스키마·RLS(마이그레이션 없음), 저장·제출·다시 작성 요청·최종 보고·굳히기·정정 동작, 확인 토글(영역 다섯 단위·추가만·제출을 막지 않음), `permissions.ts` 의 편집 판정(`canEditReport`·`canSubmitReport`·`canReturnReport`·`canEditDutySummary`·`checkFinalize`·`canReopenWeek`). 바뀌는 것은 **열람과 탭 노출**뿐이다.
- **만들지 않는 것**: '운영부 전체 모아보기', 머리띠의 제출 마감(A2), 발송(A2)·엑셀/워드(A3), `SettingsClient`·`SettingsPattern` 의 공통 컴포넌트 이전.
- **주소 어휘 그대로**(spec §6.6): `?week=&tab=&op=&sub=`, `tab` 값 7개 그대로. 새 파라미터는 `section` 하나. 호환용 shim·폴백 금지. `opsWeeklyHref(weekStart, tab, op, sub)` 시그니처를 바꾸지 않는다(A2 가 `features/ops-weekly/href.ts` 로 옮길 함수다).
- **권한 판정 자리**: 라우트 가드는 `requireMenu("ops-weekly")` 하나. 역할 판정은 `permissions.ts` 함수로만 하고 페이지·컴포넌트가 `permission === "admin"` 같은 문자열을 비교하지 않는다. 받는 사람 조회는 service role 로 본인 하나만 대조하고 명단은 화면에 내리지 않는다.
- **열람 제한은 화면 정리다. 보안 경계가 아니다**(spec §6.7) — 주간보고 표 select 정책이 `using (true)` 다. 이 한계를 CLAUDE.md 에 적는다(Task 17).
- **클라이언트 컴포넌트에 `week` 행을 통째로 넘기지 않는다**(spec §4 — 화면에 안 그려도 RSC 응답에 실린 값은 브라우저로 간다. 클라이언트 컴포넌트에 넘긴 객체는 키가 모두 실린다): 서버(page·ReportView)가 클라이언트 컴포넌트에 주는 `week` 는 그 컴포넌트가 읽는 칸만 담은 새 객체다. 머리띠 `WeekHeader` 는 `headerWeekOf`(T14 — `week_start`·`status`·`reported_at`), 관리 `ManageTab`(→ `DutySection`·`DutyPicker`)은 `Pick<WeekRow, "id" | "status" | "duty_email">`(T7). 당번 총평(`summary_this`·`summary_next`)은 제출 현황 데이터라 이 둘에 담지 않는다. 예외는 `StatusTab` 하나다 — 총평을 보여 주는 화면이고 `normalizedWeekStateOf(row: WeekRow)` 를 부르므로 행을 그대로 받되, 제출 현황을 열 수 있는 사람에게만 그린다(T15).
- **문구**: 설계가 바꾸라고 한 것만 바꾼다 — 영역 탭 'PIMS'→`합격자 발표`, 탭 '설정'→`관리`(그 탭을 부르는 링크 `설정에서 목록 보기`→`관리에서 목록 보기` 포함), 최종 보고 아래 `당번 또는 관리자만 보고할 수 있습니다` 삭제, 특이사항 버튼 `이 탭 확인`→`이 영역 확인`(spec §6.2·§6.3 이 그 이름으로 적었다). `constants.ts` 의 `AREA_LABEL` 은 바꾸지 않는다. 대신 이 화면에서 합격자 발표 영역을 부르는, 사람 눈에 보이는 'PIMS' 는 모두 `AREA_TAB_LABEL.pims`(`합격자 발표`)로 맞춘다 — 영역 탭, `PimsTab` 머리, `AreaNotes` 저장 실패 문구, 하위 탭 aria. (컨트롤러 판정: 탭 이름을 KPI 카드와 맞춘 설계 의도는 화면 전체의 일관성이다.) 그 밖의 새 문구는 각 태스크에 적힌 그대로 쓴다.
- **디자인 표준**(spec §5, CLAUDE.md Design System): 목록·메뉴 항목(관리 왼쪽 메뉴·영역 탭·표 행)은 호버 `hover:bg-line-soft`, 선택 `border-vermilion bg-vermilion/10 text-vermilion`. 버튼·토글 호버 `hover:bg-ink hover:text-cream`(보더 있으면 `hover:border-ink`). 표면 `bg-paper`, 카드 `bg-situation-bg`, 입력 `border-line-soft bg-field-bg`. 숫자 `tabular-nums`, 날짜는 `../_format` 의 함수(내부가 `kstFormat`). 하드코딩 색 금지.
- **숨김 마운트**: 영역·서랍·[목록 | 쓰기]·관리 메뉴를 바꿔도 입력과 저장 대기가 남아야 한다(spec §4). 숨기는 것은 `hidden` 속성(좁은 화면 전환만 `max-lg:hidden` 클래스)이고 언마운트하지 않는다. Testing Library `getByRole` 은 숨긴 요소를 못 찾는다 — 숨긴 쪽 단언은 `{ hidden: true }` 나 `toHaveAttribute("hidden")` 로 한다. **영역은 서버 `tab` 이 아니라 URL 에서 읽는다** — 페이지 테스트는 `setUrl("?week=…&tab=pims")`(`__tests__/search-params-mock.ts`)로 보려는 영역을 맞춘다.
- **UI 테스트는 모양까지**: 문구와 함께 클래스 토큰(`className.split(/\s+/)`)을 단언한다.
- **크기**: 파일 800줄 상한(400 권장), 함수 50줄 이하, 컴포넌트 1파일 1컴포넌트. `any`·`@ts-ignore`·`eslint-disable` 금지. 새 객체를 만든다(불변).
- **공통 컴포넌트**: `src/components/common/` 에 둔다. 이 폴더에는 barrel(`index.*`)이 없다(grep 결과) — 다른 공통 컴포넌트처럼 직접 경로로 import 하고 barrel 을 새로 만들지 않는다. 구현자가 한 번 더 확인해 barrel 이 있으면 한 줄 추가한다.
- **UI 태스크**(4·5·6·7·8·9·10·11·13·14·16)는 `frontend-design-specialist` 가 구현한다.
- **커밋**: 한 태스크 = 한 커밋, `feat:`/`fix:`/`refactor:`/`test:`/`docs:` + 한국어, 끝에 두 줄.
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```
- 한 태스크가 깨뜨리는 기존 테스트는 그 태스크 안에서 고친다. 커밋마다 그 태스크의 테스트 명령이 0 failed 다.

## Review Focus

1. **숨긴 채 마운트한 하위 탭 둘의 id 충돌** — 원서접수·합격자 발표 본문을 같이 마운트하면 두 `SubTabs` 가 `id="ops-subtabs"` 를 함께 쓰고, 합격자 발표 KPI 카드가 숨은 원서접수 줄로 스크롤해 아무 일도 안 일어난다. 영역별 id 여야 한다. → Task 12 RF1.
2. **쓰다 만 글** — 특이사항·직접 추가 제목·서랍 안 글이 영역 전환·[목록 | 쓰기]·서랍 여닫기 뒤에도 남고, 그 저장이 제출을 붙잡아야 한다. → Task 9·11·13 RF2.
3. **닫힌 서랍에 키보드로 들어감** — `InspectorPanel` 은 닫혀도 내용을 렌더하고 `aria-hidden` 만 건다. 그 안의 입력 칸이 Tab 순서에 남으면 보이지 않는 칸에 글이 들어간다. → Task 11 RF3(`inert`).
4. **`?op=` 대소문자·명단 밖 이메일** — 허용된 사람이 `?op=B@X` 로 열면 b 의 보고서, 명단에 없는 이메일이면 본인 보고서(본인도 명단 밖이면 제출 현황)여야 한다. → Task 15 RF4.
5. **쓸 것 패널이 화면보다 길 때** — 패널 아래 제출 버튼에 닿아야 한다(패널 안 스크롤). → Task 9 RF5 클래스 단언 + Task 17 사용자 1280 확인.

---

## 빌더 확인 해소 · 계획에서 정한 것

| 항목 | 결론 |
|---|---|
| `InspectorPanel` 이 닫혀도 내용을 두나 | 둔다 — `<div className={bodyClassName}>{children}</div>` 를 `open` 과 무관하게 렌더하고, `open` 은 `translate-x-*`·`aria-hidden`·ESC/바깥 클릭 리스너만 바꾼다(`InspectorPanel.tsx` 56–85행). 닫힌 내용의 키보드 진입은 서랍 내용 래퍼의 `inert` 로 막는다(셸은 안 고친다). 닫기 버튼은 셸에 없어 서랍 머리에 둔다. |
| `AREA_LABEL` 사용처 | `constants.ts` 의 `AREA_LABEL` 은 `_params.ts` 의 `TAB_LABEL` 한 곳에서만 쓴다. 화면 라벨만 바꾸도록 `_params.ts` 에 `AREA_TAB_LABEL`(pims = `합격자 발표`)을 새로 두고 `AREA_LABEL` 은 그대로 둔다. `AreaNotes.tsx` 의 지역 사본(저장 실패 문구 `PIMS 영역 특이사항`)·`PimsTab` 머리 `PIMS`·하위 탭 aria `PIMS 묶음` 도 `합격자 발표` 로 맞춘다(컨트롤러 판정 — Global Constraints '문구'). 영역 탭은 T8, 나머지 셋과 그 문구를 단언하는 기존 테스트는 T10, `page.tsx` 의 `TAB_TITLE` 은 T16. |
| 영역 전환 | URL `tab` 을 replaceState 로 바꾼다(sub 는 지운다 — 지금 탭 링크와 같이 기본 칸으로 간다). 세 영역 본문을 늘 마운트. |
| 서랍과 주소 (§8) | 서랍은 상태다. URL `tab=project\|tf` 면 그 서랍이 열린 채 시작하고 왼쪽은 원서접수다. [쓰기]는 주소를 안 바꾼다(왼쪽 영역을 잃지 않으려고). 닫을 때 URL `tab` 이 `project\|tf` 면 `application` 으로 바꾼다. |
| 남의 보고서를 볼 때 (§8) | 역할 탭 줄에서 `제출 현황` 이 켜져 보이고, 머리띠에 `{이름}의 보고서` 와 `‹ 제출 현황`(그 주 `tab=status`) 링크. 작성자 선택 상자는 남의 보고서를 열 수 있는 사람(그 주 당번·관리자, 보고 끝난 주의 받는 사람)에게만 남기고 일반 운영자에게는 그리지 않는다. spec §3 이 '바뀌는 것은 열람과 탭 노출뿐'이라 지금 있는 전환 수단을 없애지 않는다 — 당번이 여러 보고서를 차례로 볼 때 쓴다(컨트롤러 판정). 구현은 T14(WeekHeader `writerPicker`)·T15(조건 `statusAccess !== null`). 명단 밖 사람(당번·관리자)이 남의 보고서를 볼 때는 역할 탭 줄에 내 보고서가 없다 — 내 보고서 탭은 본인이 명단에 있을 때만 생긴다(spec §6.1, T15 `roles`). |
| 안내 화면 (§8) | 문구 + 주 이동(이전 주·다음 주·이번 주로). 최근 보고 주로 가는 링크는 두지 않는다 — 받는 사람에게는 대개 ‹ 이전 주가 그 주다. 명단이 0명이면 지금 문구 `작성 대상 명단이 비어 있습니다 — 관리자 설정을 확인하세요` 를 쓴다. |
| 요약 카드 '남음' (§8) | 그 종류 항목 중 금주 칸이 빈 것의 수. 빈 칸 = 태그와 `&nbsp;` 를 걷어 낸 글이 비고 `<img` 가 없는 HTML. |
| 전체 현황 주 수·제출 수 (§8) | 최근 8주(`OVERVIEW_WEEKS = 8`). 열린 주(정정 포함)는 지금 명단 ∩ 제출 / 지금 명단(제출 현황과 같은 계산), 보고 완료 주는 그 주 제출 보고서 / 그 주 보고서 행. 작업 칸의 '작성자별 보기(·고치기)'는 그 주 제출 현황 링크다 — 작성자별 [보기]가 거기 있다. |
| 관리 메뉴 전환 | `?section=` 을 replaceState 로(서버 왕복 없음), 일곱 칸 모두 마운트. 주 이동 링크는 `section` 을 들고 가지 않는다. |
| 직접 추가 자리 | 왼쪽 묶음 머리의 `+ 직접 추가` 는 없앤다 — 쓸 것 패널 한 곳(spec §6.2: 왼쪽에는 줄에 붙은 조작만). 묶음 선택지는 지금 `+ 직접 추가` 가 붙는 묶음과 같다(원서접수: 구분 미확인 제외, 구분 수집 전 주는 개발·테스트도 제외). |
| 역할 탭 줄 위치 | 주 머리띠 위. 탭이 하나뿐이면 그리지 않는다. |
| 폭 | 쓸 것 패널 360px, 서랍 `md:w-[min(48rem,100vw)]`(좁은 화면은 셸 기본 전체 폭 + 딤). |
| 보고서 행 목록 | 머리줄 `제출 n/m`(모두에게 보이는 숫자)과 닫힌 주의 보고서 찾기에 지금처럼 `listReports` 를 읽는다. 화면에 넘기는 것은 숫자와 보는 보고서뿐이고, 행 목록(`view.reports`)은 `tab=status` 일 때만 싣는다. |
| 정정으로 연 주의 받는 사람 | 그 주는 `open` 이라 받는 사람은 안내 화면이다(spec: 보고가 끝난 주만). 테스트로 고정한다. |

---

## File Structure

```
src/features/ops-weekly/permissions.ts            isDuty export · statusAccess                                  (T1)
src/app/dashboard/ops-weekly/_params.ts           resolveTab · roleTabsOf · buildRoleTabs · resolveArea ·
                                                  AREA_TAB_LABEL · MANAGE_SECTIONS · parseSection · manageHref  (T2) · parseTab 삭제(T15) · buildTabs 삭제(T16)
src/features/ops-weekly/week-queries.ts           listRecentWeeks                                               (T3)
src/features/ops-weekly/report-queries.ts         listReportStatusesForWeeks                                    (T3)
src/features/ops-weekly/overview.ts               순수: buildWeekOverview · weekPhaseOf · OVERVIEW_WEEKS          (T3)
src/app/dashboard/ops-weekly/_components/
  use-workflow.ts                                 StatusTab 에서 옮긴 useWorkflow                               (T4)
  WeekOverviewTable.tsx                           전체 현황 표                                                   (T4)
  use-ops-query.ts                                useOpsQueryValue · replaceOpsQuery                            (T6)
  ManageTab.tsx                                   관리 탭 (SettingsTab.tsx 삭제)                                 (T6·T7)
  DutyPicker.tsx · DutySection.tsx                당번 지정                                                     (T7)
  use-ops-area.ts · AreaTabs.tsx                  영역 상태·영역 탭                                              (T8)
  ReportLayout.tsx · WritePanel.tsx               두 칸·쓸 것 패널                                               (T9)
  ReportView.tsx                                  내 보고서 조립                                                 (T10)
  project-drawer-context.tsx · ProjectDrawer.tsx · ProjectSummaryCards.tsx   서랍                               (T11)
  DirectAddPanel.tsx                              직접 추가                                                     (T13)
  use-submit.ts · SubmitBar.tsx                   제출 (WeekHeader 에서 옮김)                                    (T14)
src/app/dashboard/ops-weekly/_groups.ts           묶음 제목 단일 소스 · directAddGroups · appSubStateOf            (T13)
src/app/dashboard/ops-weekly/_header-week.ts      순수: HeaderWeek · headerWeekOf (머리띠에 넘기는 칸)              (T14)
src/components/common/SectionMenuLayout.tsx       왼쪽 메뉴 + 내용 공통 레이아웃                                  (T5)
src/features/ops-weekly/settings-queries.ts       isRecipient                                                   (T15)
src/app/dashboard/ops-weekly/_load.ts             overview(T6) · 타입 export(T10) · 열람 판정·no-access·roles(T15)
src/app/dashboard/ops-weekly/page.tsx             T6·T7·T10·T11·T12·T13·T14·T15·T16
CLAUDE.md                                         ops-weekly 절                                                 (T17)
```

고치는 기존 컴포넌트: `StatusTab`(T4·T7), `UnmatchedNotice`(T6), `AreaNotes`·`ApplicationTab`·`PimsTab`·`LeaveTab`(T10·T13), `ProjectTab`(T11), `SubTabs`·`WeeklyKpiRow`(T12), `GroupShell`·`AutoGroupSection`(T13), `WeekHeader`(T14).

---

### Task 1: 열람 판정 순수 함수 — `statusAccess`

**Files:**
- Modify: `src/features/ops-weekly/permissions.ts`
- Test: `src/features/ops-weekly/__tests__/permissions.test.ts`

**Interfaces:**
- Consumes: `Actor`, `WeekState`(이미 있음, `dutyEmail` 은 `normalizedWeekStateOf` 로 정규화된 값)
- Produces:
  - `isDuty(actor: Actor, week: WeekState): boolean` — 지금 파일 안 `const isDuty` 를 `export function` 으로(로직 그대로)
  - `type StatusAccess = "manage" | "read" | null`
  - `statusAccess(actor: Actor, week: WeekState, isRecipient: boolean): StatusAccess` — 관리자 또는 그 주 당번 → `"manage"`, 아니면 받는 사람이면서 `week.status === "reported"` → `"read"`, 그 밖 `null`
- 남의 보고서를 여는지 판정하는 함수는 따로 두지 않는다 — `statusAccess(...) !== null` 이 그 판정이고, `?op` 를 받아들이는 자리는 T15 의 `pickViewed` 하나다(spec §6.7). 같은 판정을 두 함수로 두면 한쪽만 바뀌는 날 탭과 보고서가 갈린다.

- [ ] **Step 1: 실패하는 테스트를 쓴다** (기존 테스트 파일 끝에 추가)

```ts
const wk = (o: Partial<WeekState> = {}): WeekState => ({ status: "open", dutyEmail: "d@x", reopenedAt: null, ...o });
const who = (email: string, isAdmin = false): Actor => ({ email, isAdmin });

describe("statusAccess — 제출 현황·남의 보고서를 여는 사람", () => {
  it.each([
    ["관리자 · 열린 주", who("z@x", true), wk(), false, "manage"],
    ["관리자 · 보고된 주", who("z@x", true), wk({ status: "reported" }), false, "manage"],
    ["그 주 당번", who("d@x"), wk(), false, "manage"],
    ["다른 사람이 당번인 주", who("d@x"), wk({ dutyEmail: "e@x" }), false, null],
    ["당번 미지정 주", who("d@x"), wk({ dutyEmail: null }), false, null],
    ["받는 사람 · 보고된 주", who("r@x"), wk({ status: "reported" }), true, "read"],
    ["받는 사람 · 열린 주", who("r@x"), wk(), true, null],
    ["받는 사람 · 정정으로 연 주(open)", who("r@x"), wk({ reopenedAt: "2026-11-20T08:00:00Z" }), true, null],
    ["역할 없음 · 보고된 주", who("n@x"), wk({ status: "reported" }), false, null],
  ] as const)("%s", (_, actor, week, rec, want) => {
    expect(statusAccess(actor, week, rec)).toBe(want);
  });
  it("isDuty 를 내보낸다 — 당번 미지정이면 false", () => {
    expect(isDuty(who("d@x"), wk())).toBe(true);
    expect(isDuty(who("d@x"), wk({ dutyEmail: null }))).toBe(false);
  });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/features/ops-weekly/__tests__/permissions.test.ts --maxWorkers=1` → FAIL(`statusAccess` 없음).
- [ ] **Step 3: 구현한다.** Interfaces 의 두 함수와 타입. 기존 함수는 그대로 `isDuty` 를 부른다.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 → 0 failed.
- [ ] **Step 5: Commit** — `git add src/features/ops-weekly/permissions.ts src/features/ops-weekly/__tests__/permissions.test.ts` → `git commit -m "feat: 주간보고 열람 판정(제출 현황·남의 보고서) 순수 함수"`

---

### Task 2: 주소 해석 — 역할 탭·영역·관리 메뉴

**Files:**
- Modify: `src/app/dashboard/ops-weekly/_params.ts`
- Test: `src/app/dashboard/ops-weekly/__tests__/params.test.ts`

**Interfaces:**
- Consumes: `StatusAccess`(Task 1), `AREA_LABEL`(constants), `opsWeeklyHref`·`OpsTab`(이미 있음)
- Produces (기존 `parseTab`·`buildTabs` 는 이 태스크에서 지우지 않는다 — T15·T16 이 지운다):
  - `AREA_TABS = ["application","pims","leave"] as const`, `type AreaTab`
  - `AREA_TAB_LABEL: Record<AreaTab, string>` = `{ application: AREA_LABEL.application, pims: "합격자 발표", leave: AREA_LABEL.leave }`
  - `resolveArea(raw: string | null): AreaTab` — `AREA_TABS` 에 있으면 그대로, 아니면 `"application"`(project·tf·status 포함)
  - `type RoleTab = "report" | "status" | "manage"`, `ROLE_TAB_LABEL: Record<RoleTab, string>` = 내 보고서 / 제출 현황 / 관리
  - `roleTabOf(tab: OpsTab): RoleTab` — application·pims·project·tf·leave → report, status → status, settings → manage
  - `type TabAccess = { canReport: boolean; status: StatusAccess; manage: boolean }`
  - `resolveTab(raw: string | undefined, access: TabAccess): OpsTab | null` — 값이 허용되면 그대로(report 탭은 `canReport`, status 는 `status !== null`, settings 는 `manage`), 아니면 처음 화면: `canReport` → `"application"`, `status !== null` → `"status"`, 그 밖 `null`
  - `roleTabsOf(access: TabAccess): RoleTab[]` — 순서 report·status·manage 중 허용된 것
  - `buildRoleTabs(args: { weekStart: string; roles: readonly RoleTab[] }): PageTab[]` — key = role, href 는 `opsWeeklyHref(weekStart, "application" | "status" | "settings", null)`(op·sub 없음)
  - `MANAGE_SECTIONS = ["overview","duty","recipients","rotation","exclusions","projects","unmatched"] as const`, `type ManageSection`, `MANAGE_SECTION_LABEL` = 전체 현황 / 당번 지정 / 받는 사람 / 당번 순번표 / 작성 제외 / 프로젝트·TF 목록 / 안 붙은 서비스
  - `parseSection(raw: string | null): ManageSection` — 모르는 값·null 은 `"overview"`
  - `manageHref(weekStart: string, section: ManageSection): string` = `${opsWeeklyHref(weekStart, "settings", null)}&section=${section}`

- [ ] **Step 1: 실패하는 테스트를 쓴다** (기존 describe 는 그대로 두고 추가)

```ts
const W = "2026-11-16";
const acc = (o: Partial<TabAccess> = {}): TabAccess => ({ canReport: true, status: null, manage: false, ...o });

describe("resolveTab — 주소 어휘 그대로, 권한 없는 값은 처음 화면", () => {
  it("작성자만: status·settings·모르는 값·빈 값은 원서접수", () => {
    for (const raw of ["status", "settings", "xx", undefined]) expect(resolveTab(raw, acc())).toBe("application");
    expect(resolveTab("pims", acc())).toBe("pims");
    expect(resolveTab("tf", acc())).toBe("tf");
  });
  it("명단 밖 당번: 내 보고서 값은 제출 현황으로", () => {
    const a = acc({ canReport: false, status: "manage" });
    for (const raw of ["application", "project", "settings", undefined]) expect(resolveTab(raw, a)).toBe("status");
  });
  it("관리자는 settings 그대로", () => {
    expect(resolveTab("settings", acc({ canReport: false, status: "manage", manage: true }))).toBe("settings");
  });
  it("받는 사람(보고된 주): status 는 그대로, 나머지는 status", () => {
    const a = acc({ canReport: false, status: "read" });
    expect(resolveTab("status", a)).toBe("status");
    expect(resolveTab("settings", a)).toBe("status");
  });
  it("볼 화면이 없으면 null", () => {
    expect(resolveTab("status", acc({ canReport: false }))).toBeNull();
    expect(resolveTab(undefined, acc({ canReport: false }))).toBeNull();
  });
});

describe("역할 탭", () => {
  it("roleTabsOf — 일반 운영자 1개, 작성자 당번 2개, 명단 밖 관리자 2개, 작성자 관리자 3개", () => {
    expect(roleTabsOf(acc())).toEqual(["report"]);
    expect(roleTabsOf(acc({ status: "manage" }))).toEqual(["report", "status"]);
    expect(roleTabsOf(acc({ canReport: false, status: "manage", manage: true }))).toEqual(["status", "manage"]);
    expect(roleTabsOf(acc({ status: "manage", manage: true }))).toEqual(["report", "status", "manage"]);
  });
  it("roleTabOf — tab 값 7개를 역할로", () => {
    expect(OPS_TABS.map(roleTabOf)).toEqual(["report", "report", "report", "report", "report", "status", "manage"]);
  });
  it("buildRoleTabs — 라벨·주소, op·sub 를 들고 가지 않는다", () => {
    const t = buildRoleTabs({ weekStart: W, roles: ["report", "status", "manage"] });
    expect(t.map((x) => x.label)).toEqual(["내 보고서", "제출 현황", "관리"]);
    expect(t.map((x) => x.href)).toEqual([
      `/dashboard/ops-weekly?week=${W}&tab=application`,
      `/dashboard/ops-weekly?week=${W}&tab=status`,
      `/dashboard/ops-weekly?week=${W}&tab=settings`,
    ]);
  });
});

describe("영역·관리 메뉴", () => {
  it("resolveArea — 서랍·역할 탭 값은 원서접수", () => {
    expect(resolveArea("pims")).toBe("pims");
    expect(resolveArea("leave")).toBe("leave");
    for (const raw of ["project", "tf", "status", null]) expect(resolveArea(raw)).toBe("application");
  });
  it("영역 탭 라벨만 '합격자 발표' — 도메인 AREA_LABEL 은 그대로", () => {
    expect(AREA_TABS.map((a) => AREA_TAB_LABEL[a])).toEqual(["원서접수", "합격자 발표", "휴가·외근"]);
    expect(AREA_LABEL.pims).toBe("PIMS");
  });
  it("관리 메뉴 일곱 개 순서와 section 해석", () => {
    expect(MANAGE_SECTIONS.map((s) => MANAGE_SECTION_LABEL[s])).toEqual([
      "전체 현황", "당번 지정", "받는 사람", "당번 순번표", "작성 제외", "프로젝트·TF 목록", "안 붙은 서비스",
    ]);
    expect(parseSection(null)).toBe("overview");
    expect(parseSection("unmatched")).toBe("unmatched");
    expect(parseSection("nope")).toBe("overview");
    expect(manageHref(W, "unmatched")).toBe(`/dashboard/ops-weekly?week=${W}&tab=settings&section=unmatched`);
  });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/params.test.ts --maxWorkers=1` → FAIL(export 없음).
- [ ] **Step 3: 구현한다.** Interfaces 그대로. `StatusAccess` 는 `@/features/ops-weekly/permissions` 에서 type import(이 파일은 클라이언트도 읽는다 — permissions 는 순수라 괜찮다).
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 → 0 failed(기존 parseTab·buildTabs describe 포함).
- [ ] **Step 5: Commit** — `feat: 주간보고 역할 탭·영역·관리 메뉴 주소 해석`

---

### Task 3: 전체 현황 데이터 — 최근 주 조회와 행 만들기

**Files:**
- Modify: `src/features/ops-weekly/week-queries.ts`, `src/features/ops-weekly/report-queries.ts`
- Create: `src/features/ops-weekly/overview.ts`
- Test: `src/features/ops-weekly/__tests__/overview.test.ts`·`src/features/ops-weekly/__tests__/overview-queries.test.ts`(새), `week-queries.test.ts`·`report-queries.test.ts`(고치지 않고 돌리기만)

**Interfaces:**
- Consumes: `rowsOf`·`weekRowSchema`·`normEmail`·`weekRefFromStart`·`normalizedWeekStateOf`(이미 있음)
- Produces:
  - `listRecentWeeks(limit: number): Promise<WeekRow[]>` — `ops_weekly_weeks` `select("*")` · `order("week_start", { ascending: false })` · `limit(limit)`, `rowsOf` 로 던지고 `weekRowSchema.parse`
  - `type ReportStatusRow = { weekId: string; operatorEmail: string; status: ReportStatus }`
  - `listReportStatusesForWeeks(weekIds: readonly string[]): Promise<ReportStatusRow[]>` — 빈 배열이면 쿼리 없이 `[]`. `select("week_id, operator_email, status")` · `in("week_id", ids)`, 이메일은 `normEmail`
  - `overview.ts`(server-only 아님, 순수):
    - `OVERVIEW_WEEKS = 8`
    - `type WeekPhase = "open" | "reopened" | "reported"`; `weekPhaseOf(state: WeekState): WeekPhase` — reported → reported, open + `reopenedAt` → reopened, 그 밖 open
    - `type WeekOverviewRow = { weekId: string; weekStart: string; label: string; rangeLabel: string; state: WeekState; reportedAt: string | null; submitted: number; total: number; dutyName: string | null }`
    - `buildWeekOverview(args: { weeks: readonly WeekRow[]; reports: readonly ReportStatusRow[]; writers: readonly WriterCandidate[] }): WeekOverviewRow[]` — 받은 순서 그대로. `state = normalizedWeekStateOf(week)`. 라벨은 `weekRefFromStart(week_start)` 의 `label`·`rangeLabel`(null 이면 `week_start`·`""`). 제출 수: 열린 주(정정 포함)는 명단 ∩ 그 주 submitted / 명단 수, 보고 완료 주는 그 주 submitted 행 / 그 주 행. 당번 이름: 명단에서 `normEmail(duty_email)` 의 이름 → 없으면 `duty_email` → 당번 없으면 `null`(제출 현황의 `dutyNameOf` 와 같은 규칙)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 조회 함수 둘은 새 파일 `overview-queries.test.ts` 가 맡는다. 공용 `__tests__/fake-admin.ts` 는 `limit` 이 없고 읽기 호출을 기록하지 않는다 — **고치지 않는다**. `auto-queries.test.ts`(16·37·234행 — `limitSpy`·`passthrough`·`toHaveBeenCalledWith(1)`)처럼 그 파일 안에서 끝나는 체인 목을 쓴다. `week-queries.test.ts`·`report-queries.test.ts` 는 모듈 머리에서 `@/lib/supabase/admin` 을 fake-admin 으로 막고 있어 같은 파일에 다른 목을 둘 수 없다 — 그래서 새 파일이다. `WriterCandidate` 필드(`email`·`name`·`team`·`role`·`status`)는 `roster.ts` 그대로 픽스처를 채운다.

```ts
// overview.test.ts
const week = (o: Partial<WeekRow>): WeekRow => ({
  id: "w1", week_start: "2026-11-16", label_year: 2026, label_month: 11, label_week: 3,
  duty_email: "D@X", summary_this: "", summary_next: "", status: "open",
  reported_at: null, reported_by: null, reopened_at: null, reopened_by: null, ...o,
});
const rep = (weekId: string, operatorEmail: string, status: ReportStatus = "submitted") => ({ weekId, operatorEmail, status });
// writers: a@x 홍길동, d@x 당번이

it("열린 주: 지금 명단 ∩ 제출 / 지금 명단 — 명단 밖 제출은 세지 않는다", () => {
  const [r] = buildWeekOverview({ weeks: [week({})], reports: [rep("w1", "a@x"), rep("w1", "gone@x"), rep("w1", "d@x", "draft")], writers });
  expect([r.submitted, r.total]).toEqual([1, 2]);
});
it("보고 완료 주: 그 주 제출 행 / 그 주 행 — 지금 명단과 무관", () => {
  const [r] = buildWeekOverview({ weeks: [week({ status: "reported", reported_at: "2026-11-20T08:05:00Z" })],
    reports: [rep("w1", "a@x"), rep("w1", "gone@x"), rep("w1", "old@x")], writers });
  expect([r.submitted, r.total]).toEqual([3, 3]);
});
it("weekPhaseOf — 열림 / 정정으로 열림 / 보고 완료", () => {
  expect(weekPhaseOf({ status: "open", dutyEmail: null, reopenedAt: null })).toBe("open");
  expect(weekPhaseOf({ status: "open", dutyEmail: null, reopenedAt: "2026-11-21T01:00:00Z" })).toBe("reopened");
  expect(weekPhaseOf({ status: "reported", dutyEmail: null, reopenedAt: null })).toBe("reported");
});
it("당번 이름 — 대소문자 무시 명단 이름 → 이메일 → null", () => {
  const rows = buildWeekOverview({ weeks: [week({}), week({ id: "w2", duty_email: "x@x" }), week({ id: "w3", duty_email: null })], reports: [], writers });
  expect(rows.map((r) => r.dutyName)).toEqual(["당번이", "x@x", null]);
});
it("받은 순서(최근 주 먼저) 그대로, 라벨은 weekRefFromStart", () => {
  const rows = buildWeekOverview({ weeks: [week({ id: "b", week_start: "2026-11-16" }), week({ id: "a", week_start: "2026-11-09" })], reports: [], writers });
  expect(rows.map((r) => r.weekId)).toEqual(["b", "a"]);
  expect(rows[0].label).toBe(weekRefFromStart("2026-11-16")!.label);
});
```

```ts
// overview-queries.test.ts — 체인 목은 이 파일 안에서 끝난다(공용 fake-admin 은 그대로)
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

type Res = { data: unknown[] | null; error: { message: string } | null };
const responses = new Map<string, Res>();
const fromSpy: Mock = vi.fn();
const orderSpy: Mock = vi.fn();
const limitSpy: Mock = vi.fn();
const inSpy: Mock = vi.fn();

/** 체인 메서드는 자기 자신을 돌려주고, await 하면 그 테이블 응답이 나온다. */
function chain(table: string) {
  const self: Record<string, unknown> = {};
  const passthrough = (spy?: Mock) => (...a: unknown[]) => { spy?.(...a); return self; };
  self.select = passthrough();
  self.order = passthrough(orderSpy);
  self.limit = passthrough(limitSpy);
  self.in = passthrough(inSpy);
  self.then = (resolve: (v: Res) => unknown) => resolve(responses.get(table) ?? { data: [], error: null });
  return self;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => { fromSpy(table); return chain(table); } }),
}));

import { OVERVIEW_WEEKS } from "../overview";
import { listReportStatusesForWeeks } from "../report-queries";
import { listRecentWeeks } from "../week-queries";

const weekRow = (id: string, week_start: string) => ({
  id, week_start, label_year: 2026, label_month: 11, label_week: 3, duty_email: null,
  summary_this: "", summary_next: "", status: "open",
  reported_at: null, reported_by: null, reopened_at: null, reopened_by: null,
});

beforeEach(() => {
  responses.clear();
  for (const s of [fromSpy, orderSpy, limitSpy, inSpy]) s.mockClear();
});

describe("listRecentWeeks", () => {
  it("최근 주부터 OVERVIEW_WEEKS 개 — week_start 내림차순 · limit, 받은 순서 그대로", async () => {
    responses.set("ops_weekly_weeks", { data: [weekRow("b", "2026-11-16"), weekRow("a", "2026-11-09")], error: null });
    const rows = await listRecentWeeks(OVERVIEW_WEEKS);
    expect(fromSpy).toHaveBeenCalledWith("ops_weekly_weeks");
    expect(orderSpy).toHaveBeenCalledWith("week_start", { ascending: false });
    expect(limitSpy).toHaveBeenCalledWith(OVERVIEW_WEEKS);
    expect(rows.map((r) => r.id)).toEqual(["b", "a"]);
  });
  it("조회 실패는 던진다", async () => {
    responses.set("ops_weekly_weeks", { data: null, error: { message: "boom" } });
    await expect(listRecentWeeks(OVERVIEW_WEEKS)).rejects.toThrow("boom");
  });
});

describe("listReportStatusesForWeeks", () => {
  it("빈 배열이면 쿼리 없이 []", async () => {
    expect(await listReportStatusesForWeeks([])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });
  it("주 id 들을 in 한 번으로 읽고 이메일을 정규화한다", async () => {
    responses.set("ops_weekly_reports", { data: [{ week_id: "w1", operator_email: " A@X ", status: "submitted" }], error: null });
    expect(await listReportStatusesForWeeks(["w1", "w2"])).toEqual([{ weekId: "w1", operatorEmail: "a@x", status: "submitted" }]);
    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledWith("week_id", ["w1", "w2"]);
  });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/features/ops-weekly/__tests__/overview.test.ts src/features/ops-weekly/__tests__/overview-queries.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/features/ops-weekly/__tests__/week-queries.test.ts src/features/ops-weekly/__tests__/report-queries.test.ts --maxWorkers=1`(고친 두 모듈의 기존 테스트) → 0 failed.
- [ ] **Step 5: Commit** — `feat: 주간보고 전체 현황 — 최근 주 조회와 행 만들기`

---

### Task 4: 전체 현황 표 (구현: frontend-design-specialist)

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/use-workflow.ts`, `src/app/dashboard/ops-weekly/_components/WeekOverviewTable.tsx`
- Modify: `src/app/dashboard/ops-weekly/_components/StatusTab.tsx`(지역 `useWorkflow` 를 새 파일 import 로)
- Test: `src/app/dashboard/ops-weekly/__tests__/WeekOverviewTable.test.tsx`(새), `StatusTab.test.tsx`(그대로 통과해야 한다)

**Interfaces:**
- Consumes: `WeekOverviewRow`·`weekPhaseOf`(Task 3), `canReopenWeek`·`Actor`(permissions), `reopenWeek`(workflow-actions), `opsWeeklyHref`, `formatMdHm`(`../_format`), `BTN_CLASS`(styles)
- Produces:
  - `useWorkflow(): { pending: boolean; message: string | null; run: (fn: () => Promise<ActionResult>) => void }` — StatusTab 의 것을 그대로 옮긴다(끝나면 늘 `router.refresh()`)
  - `WeekOverviewTable(props: { rows: readonly WeekOverviewRow[]; actor: Actor }): JSX.Element`
    - 열: `주차 | 기간 | 상태 | 제출 | 당번 | 작업`. 래퍼 `overflow-x-auto` + 표 `min-w-[40rem]`(일회성, SubmissionTable 과 같은 이유). 행 `border-b border-line-soft hover:bg-line-soft`
    - 상태: open → `열림`, reopened → `정정으로 열림`(text-vermilion), reported → `` `보고 ${formatMdHm(reportedAt)}` ``(tabular-nums)
    - 제출 `` `${submitted}/${total}` ``(tabular-nums), 당번 `dutyName ?? "미지정"`
    - 작업: reported → [정정] 버튼(`canReopenWeek(actor, row.state)` 일 때, `BTN_CLASS`, 진행 중 disabled, `reopenWeek({ weekId })`) + [보기] 링크 / reopened → `작성자별 보기·고치기` 링크 / open → `작성자별 보기` 링크. 링크는 모두 `opsWeeklyHref(row.weekStart, "status", null)`
    - 실패 문구는 표 위 `role="alert"` `text-xs text-vermilion`
    - 행이 0개면 표 대신 `border border-line-soft bg-situation-bg` 상자에 `열린 주가 아직 없습니다`

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `reopenWeek` 와 `next/navigation`(refresh) 을 목으로.

```tsx
const row = (o: Partial<WeekOverviewRow> = {}): WeekOverviewRow => ({
  weekId: "w1", weekStart: "2026-11-16", label: "L", rangeLabel: "R",
  state: { status: "open", dutyEmail: "d@x", reopenedAt: null },
  reportedAt: null, submitted: 3, total: 9, dutyName: "홍길동", ...o,
});
const admin = { email: "z@x", isAdmin: true };
const reported = row({ weekId: "w0", weekStart: "2026-11-09", state: { status: "reported", dutyEmail: "d@x", reopenedAt: null }, reportedAt: "2026-11-13T08:05:00Z", submitted: 9 });
const reopened = row({ weekId: "w2", state: { status: "open", dutyEmail: "d@x", reopenedAt: "2026-11-14T01:00:00Z" } });

it("작업 칸이 주 상태대로 갈린다", () => {
  render(<WeekOverviewTable rows={[row(), reopened, reported]} actor={admin} />);
  const [open, re, rep] = screen.getAllByRole("row").slice(1);
  expect(within(open).getByRole("link", { name: "작성자별 보기" })).toHaveAttribute("href", "/dashboard/ops-weekly?week=2026-11-16&tab=status");
  expect(within(re).getByRole("link", { name: "작성자별 보기·고치기" })).toBeInTheDocument();
  expect(within(rep).getByRole("button", { name: "정정" })).toBeInTheDocument();
  expect(within(rep).getByRole("link", { name: "보기" })).toHaveAttribute("href", "/dashboard/ops-weekly?week=2026-11-09&tab=status");
  expect(within(open).queryByRole("button", { name: "정정" })).toBeNull();
});
it("상태 문구 — 열림 / 정정으로 열림(vermilion) / 보고 시각(숫자 정렬)", () => {
  render(<WeekOverviewTable rows={[row(), reopened, reported]} actor={admin} />);
  expect(screen.getByText("열림")).toBeInTheDocument();
  expect(screen.getByText("정정으로 열림").className).toContain("text-vermilion");
  const t = screen.getByText(`보고 ${formatMdHm("2026-11-13T08:05:00Z")}`);
  expect(t.className).toContain("tabular-nums");
});
it("제출 수는 숫자 정렬, 당번 없으면 미지정", () => {
  render(<WeekOverviewTable rows={[row({ dutyName: null })]} actor={admin} />);
  expect(screen.getByText("3/9").className).toContain("tabular-nums");
  expect(screen.getByText("미지정")).toBeInTheDocument();
});
it("[정정] 은 reopenWeek 를 부르고 새로 읽는다", async () => { /* 클릭 → reopenWeek({ weekId: "w0" }) 1회, refresh 1회 */ });
it("행 호버는 목록 표준, 표는 가로 스크롤 래퍼 안", () => {
  render(<WeekOverviewTable rows={[row()]} actor={admin} />);
  const tr = screen.getAllByRole("row")[1];
  expect(tr.className.split(/\s+/)).toContain("hover:bg-line-soft");
  expect(screen.getByRole("table").parentElement?.className).toContain("overflow-x-auto");
});
it("행이 없으면 빈 상태 상자", () => {
  render(<WeekOverviewTable rows={[]} actor={admin} />);
  const box = screen.getByText("열린 주가 아직 없습니다").closest("div") as Element;
  expect(box.className.split(/\s+/)).toEqual(expect.arrayContaining(["bg-situation-bg", "border-line-soft"]));
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/WeekOverviewTable.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** `useWorkflow` 를 옮기고 StatusTab 은 import 만 바꾼다. 표는 Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/WeekOverviewTable.test.tsx src/app/dashboard/ops-weekly/__tests__/StatusTab.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 주간보고 전체 현황 표(주 상태별 작업)`

---

### Task 5: 공통 왼쪽 메뉴 레이아웃 — `SectionMenuLayout` (구현: frontend-design-specialist)

왼쪽 메뉴 + 오른쪽 내용 꼴의 세 번째 복제라 공통으로 뽑는다(spec §6.5). `SettingsClient`·`SettingsPattern` 은 옮기지 않는다.

**Files:**
- Create: `src/components/common/SectionMenuLayout.tsx`
- Test: `src/components/common/__tests__/SectionMenuLayout.test.tsx` — 구현자가 확인할 것: 이 폴더의 테스트 위치 관례(`__tests__` 폴더인지 옆 파일인지). 관례를 따른다.

**Interfaces:**
- Produces:
  - `type SectionMenuItem<K extends string> = { key: K; label: string; badge?: number }`
  - `SectionMenuLayout<K extends string>(props: { ariaLabel: string; items: readonly SectionMenuItem<K>[]; active: K; onSelect: (key: K) => void; children: ReactNode }): JSX.Element`
  - 모양은 `src/app/dashboard/settings/SettingsClient.tsx` 56–77행을 그대로 옮긴다 — 그리드 `grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]`(높이 고정 부모가 없어 `flex-1 min-h-0` 은 뺀다), `<nav aria-label>` 클래스 그대로, 항목은 `<button type="button" aria-pressed>` + 같은 기본·선택·호버 클래스 + `◉`/`·` 표식. md 미만 가로 줄에서 이름이 꺾이지 않게 항목에 `max-md:shrink-0 max-md:whitespace-nowrap` 를 더한다. `badge` 가 있으면 이름 뒤 `ml-auto text-xs tabular-nums`. 내용 칸 `flex min-w-0 flex-col gap-4`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```tsx
const items = [{ key: "a", label: "전체 현황" }, { key: "b", label: "안 붙은 서비스", badge: 3 }] as const;
const view = (onSelect = vi.fn()) => render(
  <SectionMenuLayout ariaLabel="관리 메뉴" items={items} active="a" onSelect={onSelect}><p>내용</p></SectionMenuLayout>,
);
const tokens = (el: Element) => el.className.split(/\s+/);

it("md 이상 240px 왼쪽 메뉴 + 오른쪽 내용, md 미만은 위로 쌓인 가로 줄", () => {
  const { container } = view();
  expect(tokens(container.firstElementChild as Element)).toEqual(expect.arrayContaining(["grid", "grid-cols-1", "md:grid-cols-[240px_1fr]"]));
  expect(tokens(screen.getByRole("navigation", { name: "관리 메뉴" }))).toEqual(expect.arrayContaining(["max-md:flex-row", "max-md:overflow-x-auto"]));
});
it("선택 항목은 목록 선택 표준, 나머지는 hover:bg-line-soft", () => {
  view();
  const on = screen.getByRole("button", { name: /전체 현황/ });
  expect(on).toHaveAttribute("aria-pressed", "true");
  expect(tokens(on)).toEqual(expect.arrayContaining(["border-vermilion", "bg-vermilion/10", "text-vermilion"]));
  const off = screen.getByRole("button", { name: /안 붙은 서비스/ });
  expect(tokens(off)).toContain("hover:bg-line-soft");
  expect(tokens(off)).not.toContain("bg-vermilion/10");
});
it("배지는 이름 뒤 숫자 정렬", () => {
  view();
  expect(within(screen.getByRole("button", { name: /안 붙은 서비스/ })).getByText("3").className).toContain("tabular-nums");
});
it("누르면 onSelect(key), 내용은 오른쪽 칸에", () => {
  const onSelect = vi.fn();
  view(onSelect);
  fireEvent.click(screen.getByRole("button", { name: /안 붙은 서비스/ }));
  expect(onSelect).toHaveBeenCalledWith("b");
  expect(screen.getByText("내용")).toBeInTheDocument();
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/components/common/__tests__/SectionMenuLayout.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로(`"use client"` — 버튼 핸들러를 받는다).
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 → 0 failed. 공통 폴더 전역 가드도 본다: `npm test -- src/components/common --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 왼쪽 메뉴 + 내용 공통 레이아웃(SectionMenuLayout)`

---

### Task 6: 관리 탭 — 설정 탭을 왼쪽 메뉴형으로 (구현: frontend-design-specialist)

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/use-ops-query.ts`, `src/app/dashboard/ops-weekly/_components/ManageTab.tsx`
- Delete: `src/app/dashboard/ops-weekly/_components/SettingsTab.tsx`
- Modify: `_components/UnmatchedNotice.tsx`, `page.tsx`, `_load.ts`
- Test: `__tests__/SettingsTab.test.tsx` → `__tests__/ManageTab.test.tsx`(git mv 후 고침), `__tests__/use-ops-query.test.ts`(새), `_components/__tests__/UnmatchedNotice.test.tsx`, `__tests__/page-subtabs.test.tsx`, `__tests__/ApplicationTab.test.tsx`·`__tests__/PimsTab.test.tsx`(링크 이름), `__tests__/load-snapshot.test.ts`(목)

**Interfaces:**
- Consumes: `SectionMenuLayout`(T5), `WeekOverviewTable`(T4), `OVERVIEW_WEEKS`·`buildWeekOverview`(T3), `listRecentWeeks`·`listReportStatusesForWeeks`(T3), `MANAGE_SECTIONS`·`MANAGE_SECTION_LABEL`·`parseSection`·`manageHref`(T2)
- Produces:
  - `use-ops-query.ts`(`"use client"`): `useOpsQueryValue(name: string): string | null` = `useSearchParams()?.get(name) ?? null`; `replaceOpsQuery(changes: Readonly<Record<string, string | null>>): void` — `window.location.search` 에 적용(null 은 지움) 후 `history.replaceState`(`use-ops-sub.ts` 와 같은 이유로 location 을 읽는다). `use-ops-sub.ts` 는 고치지 않는다
  - `ManageTab(props: { bundle: SettingsBundle; unmatched: UnmatchedServices | null; overview: WeekOverviewRow[]; actor: Actor }): JSX.Element` — `SectionMenuLayout ariaLabel="관리 메뉴"`, 선택은 `parseSection(useOpsQueryValue("section"))`, 고르면 `replaceOpsQuery({ section })`. 칸은 모두 마운트하고 `<div data-section={key} hidden={key !== active}>`. 이 태스크의 메뉴는 `duty` 를 뺀 여섯(Task 7 이 넣는다). `unmatched` 배지는 `unmatched === null ? undefined : unmatched.application.length + unmatched.pims.length`. 기존 패널 다섯은 `SettingsTab` 의 props·`excluded` 걸러내기를 그대로 옮긴다. 전체 현황 칸은 머리 `전체 현황` + `WeekOverviewTable` — 구현자가 확인할 것: 기존 패널 머리(h2/h3 와 클래스)를 보고 같은 모양으로
  - `OpsWeeklyView`(week): `overview: WeekOverviewRow[] | null` 추가 — `tab === "settings" && actor.isAdmin` 일 때만 `listRecentWeeks(OVERVIEW_WEEKS)` → `listReportStatusesForWeeks(ids)` → `buildWeekOverview({ weeks, reports, writers })`(bundle·unmatched 와 `Promise.all`)
  - `page.tsx`: settings 칸은 `view.bundle !== null && view.overview !== null` 일 때 `ManageTab`. 원서접수·PIMS 의 `settingsHref` = `manageHref(weekStart, "unmatched")`, ProjectTab 의 = `manageHref(weekStart, "projects")`, 빈 명단 상자의 `설정 열기` = `manageHref(weekStart, "exclusions")`
  - `UnmatchedNotice`: 링크 문구 `관리에서 목록 보기`(prop 이름 `settingsHref` 는 그대로, 주석만 '관리 › 안 붙은 서비스')

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - `ManageTab.test.tsx` — `git mv __tests__/SettingsTab.test.tsx __tests__/ManageTab.test.tsx` 후 각 단언 앞에 그 패널의 `setUrl("?week=2026-11-16&tab=settings&section=…")` 를 둔다(숨은 칸은 `getByRole` 에 안 잡힌다). 구현자가 확인할 것: 기존 단언이 어느 패널 것인지. 단언 자체는 바꾸지 않는다 — 단 '패널 제목은 모두 h2 text-xl font-bold'(245행)는 네 패널을 한 번에 훑어 setUrl 하나로 다 보이게 할 수 없으니 아래 코드대로 숨긴 칸까지 찾도록 바꾼다. 이 파일의 `next/navigation` 목은 `useRouter` 만 있어 `useOpsQueryValue` 가 못 돈다 — `{ ...(await import("./search-params-mock")).navigationModule, useRouter: () => ({ push: vi.fn(), refresh }) }` 로 바꾼다. 기본값 감싸개 `SettingsTab`(34–39행 — `RealSettingsTab` 에 `unmatched={null}` 을 채운다)은 같은 꼴의 `ManageTab` 감싸개(`import { ManageTab as RealManageTab }`)로 바꿔 새 필수 props 도 채운다(`unmatched={null}`·`overview={[]}`·`actor={{ email: "z@x", isAdmin: true }}`, 넘긴 props 가 이긴다). 기존 `render(<SettingsTab …/>)` 는 `render(<ManageTab …/>)` 로 이름만 바꾼다. 그리고 아래를 더한다.

```tsx
// 감싸개 ManageTab 옆에 둔다 — 새 테스트가 쓴다
const renderManage = (props: Partial<ComponentProps<typeof RealManageTab>> = {}) =>
  render(<ManageTab bundle={bundle()} {...props} />);

it("메뉴 여섯 — 순서와 기본 선택(전체 현황)", () => {
  setUrl("?week=2026-11-16&tab=settings");
  renderManage();
  const nav = screen.getByRole("navigation", { name: "관리 메뉴" });
  expect(within(nav).getAllByRole("button").map((b) => b.textContent?.replace(/^[◉·]/, "").replace(/\d+$/, ""))).toEqual(
    ["전체 현황", "받는 사람", "당번 순번표", "작성 제외", "프로젝트·TF 목록", "안 붙은 서비스"]);
  expect(within(nav).getByRole("button", { name: /전체 현황/ })).toHaveAttribute("aria-pressed", "true");
});
it("메뉴를 고르면 section 만 바꾸고(서버 왕복 없음) 다른 칸은 숨긴 채 남는다", () => {
  setUrl("?week=2026-11-16&tab=settings");
  const { container } = renderManage();
  fireEvent.click(screen.getByRole("button", { name: /받는 사람/ }));
  expect(window.location.search).toBe("?week=2026-11-16&tab=settings&section=recipients");
  expect(container.querySelector('[data-section="overview"]')).toHaveAttribute("hidden");
  expect(container.querySelector('[data-section="recipients"]')).not.toHaveAttribute("hidden");
});
it("안 붙은 서비스 배지 — 원서접수 + 발표 건수, 못 읽었으면(null) 배지 없음", () => { /* renderManage({ unmatched: {application:[1건], pims:[1건]} }) → "2" */ });
// '패널 제목은 모두 h2 text-xl font-bold'(245) 를 이렇게 바꾼다 — 기본 메뉴가 전체 현황이라 네 칸 모두 숨어 있다
it("패널 제목은 모두 h2 text-xl font-bold — 숨긴 칸에도 마운트돼 있다", () => {
  setUrl("?week=2026-11-16&tab=settings");
  renderManage();
  for (const name of ["받는 사람", "당번 순번", "작성 제외", "프로젝트·TF 목록"]) {
    const h = screen.getByRole("heading", { name, hidden: true });
    expect(h.tagName).toBe("H2");
    expect(h.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-xl", "font-bold"]));
    expect(h.closest("[data-section]")).toHaveAttribute("hidden");
  }
});
```

```ts
// use-ops-query.test.ts
it("replaceOpsQuery — 값은 넣고 null 은 지운다", () => {
  setUrl("?week=2026-11-16&tab=settings&sub=dev");
  replaceOpsQuery({ section: "duty", sub: null });
  expect(window.location.search).toBe("?week=2026-11-16&tab=settings&section=duty");
});
```

  - `UnmatchedNotice.test.tsx`: 링크 이름 `설정에서 목록 보기` → `관리에서 목록 보기`.
  - `ApplicationTab.test.tsx`(331·348·365행)·`PimsTab.test.tsx`(129·140·151행): 같은 링크 이름 `설정에서 목록 보기` → `관리에서 목록 보기`. 안 고치면 365·151행이 깨지고 나머지는 헛단언이 된다(그래서 Step 2 가 이 두 파일도 돌린다).
  - `load-snapshot.test.ts`: `_load` 가 관리자 설정 탭에서 `listRecentWeeks`·`listReportStatusesForWeeks` 를 부른다 — week-queries 목에 `listRecentWeeks: async () => []`, report-queries 목에 `listReportStatusesForWeeks: async () => []` 를 더한다(없으면 vitest 가 '목에 그 export 가 없다'로 던져 '관리자의 설정 탭에서만' 두 테스트가 깨진다).
  - `page-subtabs.test.tsx`: 관리자 원서접수 링크 단언을 `{ name: "관리에서 목록 보기" }` · href `/dashboard/ops-weekly?week=2026-11-16&tab=settings&section=unmatched` 로, 비관리자 `queryByText("관리에서 목록 보기")` 로. 설정 탭 두 테스트는 `setUrl("?week=2026-11-16&tab=settings&section=unmatched")` 를 먼저 하고 view 에 `overview: []` 를 더한다.
- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/ManageTab.test.tsx src/app/dashboard/ops-weekly/__tests__/use-ops-query.test.ts src/app/dashboard/ops-weekly/_components/__tests__/UnmatchedNotice.test.tsx src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx src/app/dashboard/ops-weekly/__tests__/ApplicationTab.test.tsx src/app/dashboard/ops-weekly/__tests__/PimsTab.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로. `SettingsTab.tsx` 를 지운다(다른 import 가 없는지 grep).
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/responsive.test.tsx src/app/dashboard/ops-weekly/__tests__/UnmatchedServicesPanel.test.tsx src/app/dashboard/ops-weekly/__tests__/load-snapshot.test.ts --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 주간보고 설정 탭을 관리(왼쪽 메뉴·전체 현황)로`

분할 검토: 메뉴·칸·연결(page·_load)이 한 커밋에 바뀌어야 커밋마다 관리자가 설정을 열 수 있다 — 한 태스크로 둔다.

---

### Task 7: 당번 지정·정정을 관리로, 제출 현황 정리 (구현: frontend-design-specialist)

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/DutyPicker.tsx`, `src/app/dashboard/ops-weekly/_components/DutySection.tsx`
- Modify: `_components/StatusTab.tsx`, `_components/ManageTab.tsx`, `page.tsx`(ManageTab props)
- Test: `__tests__/DutySection.test.tsx`(새), `__tests__/StatusTab.test.tsx`, `__tests__/ManageTab.test.tsx`

**Interfaces:**
- Consumes: `useWorkflow`(T4), `setWeekDuty`(settings-actions), `canManageSettings`·`Actor`, `ListSelect`
- Produces:
  - `DutyPicker(props: { week: Pick<WeekRow, "duty_email">; writers: readonly WriterCandidate[]; onPick: (email: string) => void }): JSX.Element` — StatusTab 의 것을 그대로 옮긴다(`ariaLabel="당번"`, placeholder `당번 미지정`). 로직은 그대로이고, 읽는 칸이 `duty_email` 하나라 타입만 좁힌다
  - `DutySection(props: { week: Pick<WeekRow, "id" | "status" | "duty_email">; weekLabel: string; writers: readonly WriterCandidate[]; actor: Actor }): JSX.Element` — 머리 `당번 지정`, 그 아래 `weekLabel`(page 가 `` `${weekRef.label} · ${weekRef.rangeLabel}` `` 로 준다). `canManageSettings(actor) && week.status === "open"` 이면 `당번` + `DutyPicker` → `setWeekDuty({ weekId: week.id, dutyEmail })`(useWorkflow), 아니면 지금 당번 이름(없으면 `미지정`)과 `보고가 끝난 주는 당번을 바꿀 수 없습니다`
  - `ManageTab` props 에 `week: Pick<WeekRow, "id" | "status" | "duty_email">; weekLabel: string; writers: WriterCandidate[]` 추가, 메뉴 일곱(전체 현황 다음 `당번 지정`). `page.tsx` 는 행을 통째로 넘기지 않고 `week={{ id: week.id, status: week.status, duty_email: week.duty_email }}` 새 객체를 준다(Global Constraints 'week 행' — 당번 총평이 관리 화면 RSC 에 실리지 않는다)
  - `StatusTab`: `DutyPicker`·[정정]·`canPickDuty`·`canReopen`·`setWeekDuty`·`reopenWeek` import 를 지운다. `whyDisabled` 는 `string | null` 을 돌려주고 `forbidden` 이면 `null` — `FinalizeBar` 는 null 이면 문구 줄을 안 그린다(버튼 동작은 그대로). `SubmissionTable` 의 `settingsHref` 는 `canManageSettings(actor) ? manageHref(week.week_start, "exclusions") : undefined`(권한 문자열·`isAdmin` 직접 비교 대신 permissions 함수)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 구현자가 확인할 것: StatusTab.test 의 '당번 바꾸기는 admin · 열린 주에만'(315행)이 `ListSelect` 를 어떤 역할로 찾는지 — DutySection.test 가 같은 방법을 쓴다.

```tsx
// StatusTab.test.tsx — 바꾸는 것 (도우미는 이 파일의 것: base · WEEK · rep(email, status))
it("제출 현황에는 당번 바꾸기·정정이 없다 — 관리자·보고된 주여도", () => {
  render(<StatusTab {...base} actor={{ email: "z@x", isAdmin: true }} week={{ ...WEEK, status: "reported", reported_at: "2026-11-20T08:00:00Z" }} />);
  expect(screen.queryByRole("button", { name: "정정" })).toBeNull();
  expect(screen.queryByLabelText("당번")).toBeNull();
});
it("권한이 없으면(forbidden) 최종 보고 아래 안내 문구가 없다", () => {
  render(<StatusTab {...base} finalize={{ ok: false, reason: "forbidden", pending: [] }} />);
  expect(screen.queryByText("당번 또는 관리자만 보고할 수 있습니다")).toBeNull();
});
it("받는 사람(당번·관리자 아님)이 보고된 주를 열면 버튼이 하나도 없다", () => {
  render(<StatusTab {...base} actor={{ email: "r@x", isAdmin: false }} week={{ ...WEEK, status: "reported", reported_at: "2026-11-20T08:00:00Z" }}
    reports={[rep("a@x", "submitted")]} />);
  for (const name of ["다시 작성", "최종 보고", "정정"]) expect(screen.queryByRole("button", { name })).toBeNull();
  expect(screen.queryAllByRole("textbox")).toHaveLength(0); // 당번 총평 읽기 전용
});
// 지우는 것: '[정정] 은 admin · 보고된 주에만'(234) · '[정정] 은 reopenWeek 를 부른다'(255) · '당번 바꾸기는 admin · 열린 주에만'(315) · '권한이 없으면 이유를 적는다'(140, 위 테스트로 대체)
// 고치는 것: 'admin 에게만 명단 빈 상자에 설정 링크'(471) — href 에 "section=exclusions"
```

```tsx
// DutySection.test.tsx
it("열린 주: 당번을 고르면 setWeekDuty 를 부르고 새로 읽는다", async () => { /* 김철수 선택 → setWeekDuty({ weekId: "w1", dutyEmail: "b@x" }) 1회, refresh 1회 */ });
it("보고된 주: 고를 수 없고 이유를 적는다", () => {
  renderDuty({ week: { ...WEEK, status: "reported" } });
  expect(screen.queryByLabelText("당번")).toBeNull();
  expect(screen.getByText("보고가 끝난 주는 당번을 바꿀 수 없습니다")).toBeInTheDocument();
});
// ManageTab.test.tsx: 메뉴 단언을 일곱으로 — [..., "전체 현황", "당번 지정", "받는 사람", ...]
// ManageTab.test.tsx: 감싸개(T6)에 새 필수 props 기본값을 더한다 — week={{ id: "w1", status: "open", duty_email: null }} · weekLabel="11월 3주" · writers={[]}
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/StatusTab.test.tsx src/app/dashboard/ops-weekly/__tests__/DutySection.test.tsx src/app/dashboard/ops-weekly/__tests__/ManageTab.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx src/app/dashboard/ops-weekly/__tests__/responsive.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 당번 지정·정정을 관리로 옮기고 제출 현황에서 관리자 버튼 제거`

---

### Task 8: 영역 탭과 URL 영역 상태 (구현: frontend-design-specialist)

**Files:**
- Create: `src/app/dashboard/ops-weekly/_components/use-ops-area.ts`, `src/app/dashboard/ops-weekly/_components/AreaTabs.tsx`
- Modify: `_components/SubTabs.tsx`(`neighbour` 를 export 만)
- Test: `__tests__/AreaTabs.test.tsx`(새)

**Interfaces:**
- Consumes: `useOpsQueryValue`·`replaceOpsQuery`(T6), `AREA_TABS`·`AREA_TAB_LABEL`·`resolveArea`·`AreaTab`(T2), `Area`(constants)
- Produces:
  - `useOpsArea(): { area: AreaTab; setArea: (next: AreaTab, sub?: string | null) => void }` — `area = resolveArea(useOpsQueryValue("tab"))`, `setArea` = `replaceOpsQuery({ tab: next, sub: sub ?? null })`
  - `export function neighbour(key: string, index: number, last: number): number | null`(SubTabs.tsx, 로직 그대로)
  - `AreaTabs(props: { checked: readonly Area[] }): JSX.Element` — `role="tablist" aria-label="영역"`, 버튼 셋 `role="tab" id="area-tab-{key}" aria-controls="area-panel-{key}" aria-selected`, 라벨 `AREA_TAB_LABEL[key]` + 확인했으면 ` ✓`. 지금 영역을 다시 누르면 아무것도 안 한다. ←→·Home·End 는 `neighbour`. 모양: 기본 `min-h-9 whitespace-nowrap border-b-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink`, 선택 `border-vermilion bg-vermilion/10 font-semibold text-vermilion`, 나머지 `border-transparent text-ink hover:bg-line-soft`

- [ ] **Step 1: 실패하는 테스트를 쓴다** (`next/navigation` 은 `search-params-mock` 으로)

```tsx
it("라벨 — 원서접수 / 합격자 발표 / 휴가·외근, 확인한 영역은 ✓", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<AreaTabs checked={["pims"]} />);
  expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["원서접수", "합격자 발표 ✓", "휴가·외근"]);
});
it("영역을 고르면 tab 만 바꾸고 sub 는 지운다(서버 왕복 없음)", () => {
  setUrl("?week=2026-11-16&tab=application&sub=running");
  render(<AreaTabs checked={[]} />);
  fireEvent.click(screen.getByRole("tab", { name: "합격자 발표" }));
  expect(window.location.search).toBe("?week=2026-11-16&tab=pims");
  expect(screen.getByRole("tab", { name: "합격자 발표" })).toHaveAttribute("aria-selected", "true");
});
it("tab=project·tf 로 들어오면 원서접수가 선택돼 있다", () => {
  setUrl("?week=2026-11-16&tab=tf");
  render(<AreaTabs checked={[]} />);
  expect(screen.getByRole("tab", { name: "원서접수" })).toHaveAttribute("aria-selected", "true");
});
it("모양 — 선택은 목록 선택 표준, 나머지는 hover:bg-line-soft", () => {
  setUrl("?week=2026-11-16&tab=leave");
  render(<AreaTabs checked={[]} />);
  const on = screen.getByRole("tab", { name: "휴가·외근" }).className.split(/\s+/);
  expect(on).toEqual(expect.arrayContaining(["border-vermilion", "bg-vermilion/10", "text-vermilion"]));
  expect(screen.getByRole("tab", { name: "원서접수" }).className.split(/\s+/)).toContain("hover:bg-line-soft");
});
it("→ 키로 다음 영역", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<AreaTabs checked={[]} />);
  fireEvent.keyDown(screen.getByRole("tab", { name: "원서접수" }), { key: "ArrowRight" });
  expect(window.location.search).toContain("tab=pims");
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/AreaTabs.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/SubTabs.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 주간보고 영역 탭(합격자 발표) — 주소만 바꾸는 전환`

---

### Task 9: 내 보고서 두 칸 레이아웃 — ReportLayout·WritePanel (구현: frontend-design-specialist)

이 태스크는 두 컴포넌트와 그 테스트만 만들고 페이지에 붙이지 않는다 — 붙이는 것은 T10 이다. 페이지·기존 컴포넌트를 건드리지 않으므로 기존 테스트는 그대로다.

**Files:**
- Create: `_components/ReportLayout.tsx`, `_components/WritePanel.tsx`
- Test: `__tests__/ReportLayout.test.tsx`·`__tests__/WritePanel.test.tsx`(새)

(`_components/` = `src/app/dashboard/ops-weekly/_components/`, `__tests__/` = `src/app/dashboard/ops-weekly/__tests__/`. 이하 같다.)

**Interfaces:**
- Consumes: `useOpsArea`·`AreaTabs`(T8), `AREA_TABS`·`AreaTab`(T2), `Area`(constants)
- Produces:
  - `ReportLayout(props: { checked: readonly Area[]; areas: Record<AreaTab, ReactNode>; panel: ReactNode }): JSX.Element`(`"use client"`)
    - 바깥 `flex flex-col gap-4 p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-7 lg:p-7`
    - lg 미만에만 `[목록 | 쓰기]`: `<div role="group" aria-label="보기 전환" className="... lg:hidden">` 버튼 둘 `aria-pressed`, `min-h-9 border px-3 text-sm`, 선택 `border-ink bg-ink text-cream`, 나머지 `border-line-soft text-ink-soft hover:border-ink hover:bg-ink hover:text-cream`(토글은 버튼 표준). 상태는 `useState<"list" | "write">("list")`
    - 왼쪽 `<div className={\`min-w-0 ${view === "write" ? "max-lg:hidden" : ""}\`}>` 안에 `AreaTabs` + 영역 셋 `<div role="tabpanel" id="area-panel-{k}" aria-labelledby="area-tab-{k}" hidden={k !== area}>`
    - 오른쪽 `<aside aria-label="쓸 것" className={\`min-w-0 ${view === "list" ? "max-lg:hidden" : ""} lg:sticky lg:top-[calc(var(--ops-kpi-h,0px)+1rem)] lg:max-h-[calc(100dvh-var(--ops-kpi-h,0px)-7rem)] lg:overflow-y-auto lg:border-l lg:border-line-soft lg:pl-7\`}>` — 7rem = 셸 상단바 52px + 하단바 27px + 여백(`InspectorPanel` 의 `md:top-[52px] md:bottom-[27px]` 에서 온 가정). 구현자가 확인할 것: 대시보드 셸 content div 의 위·아래 크롬 높이. 다르면 이 값만 맞춘다
  - `WritePanel(props: { notes: Record<AreaTab, ReactNode>; directAdd?: Record<AreaTab, ReactNode> | null; projects?: ReactNode; submit?: ReactNode }): JSX.Element`(`"use client"`) — 위에서부터 특이사항 → 직접 추가 → 프로젝트·TF → 제출(spec §6.2.3). 영역별 슬롯(notes·directAdd)은 셋 다 그리고 `hidden={k !== area}`. 슬롯은 T10(`notes`)·T11(`projects`)·T13(`directAdd`)·T14(`submit`)이 채운다

- [ ] **Step 1: 실패하는 테스트를 쓴다.**

```tsx
// ReportLayout.test.tsx
const areas = { application: <p>원서 본문</p>, pims: <p>발표 본문</p>, leave: <p>휴가 본문</p> };
const tokens = (el: Element | null) => (el?.className ?? "").split(/\s+/);
it("lg 이상 두 칸 — 왼쪽 minmax(0,1fr) · 오른쪽 360px", () => {
  setUrl("?week=2026-11-16&tab=application");
  const { container } = render(<ReportLayout checked={[]} areas={areas} panel={<p>쓸 칸</p>} />);
  expect(tokens(container.firstElementChild)).toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
});
it("영역 본문 셋을 모두 마운트하고 지금 영역만 보인다", () => {
  setUrl("?week=2026-11-16&tab=pims");
  render(<ReportLayout checked={[]} areas={areas} panel={null} />);
  expect(screen.getByText("발표 본문").closest('[role="tabpanel"]')).not.toHaveAttribute("hidden");
  expect(screen.getByText("원서 본문").closest('[role="tabpanel"]')).toHaveAttribute("hidden");
});
it("RF5 쓸 칸 — lg 이상 KPI 높이만큼 비켜 붙고 화면보다 길면 안에서 스크롤", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<ReportLayout checked={[]} areas={areas} panel={<p>쓸 칸</p>} />);
  expect(tokens(screen.getByRole("complementary", { name: "쓸 것" }))).toEqual(expect.arrayContaining([
    "lg:sticky", "lg:top-[calc(var(--ops-kpi-h,0px)+1rem)]", "lg:max-h-[calc(100dvh-var(--ops-kpi-h,0px)-7rem)]", "lg:overflow-y-auto",
  ]));
});
it("[목록 | 쓰기] — lg 미만 전환, 안 보이는 칸은 max-lg:hidden 이고 마운트된 채", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<ReportLayout checked={[]} areas={areas} panel={<p>쓸 칸</p>} />);
  const group = screen.getByRole("group", { name: "보기 전환" });
  expect(tokens(group)).toContain("lg:hidden");
  expect(tokens(screen.getByRole("complementary", { name: "쓸 것" }))).toContain("max-lg:hidden");
  fireEvent.click(within(group).getByRole("button", { name: "쓰기" }));
  expect(within(group).getByRole("button", { name: "쓰기" })).toHaveAttribute("aria-pressed", "true");
  expect(tokens(within(group).getByRole("button", { name: "쓰기" }))).toEqual(expect.arrayContaining(["bg-ink", "text-cream"]));
  expect(tokens(screen.getByText("원서 본문").closest(".min-w-0"))).toContain("max-lg:hidden");
  expect(tokens(screen.getByRole("complementary", { name: "쓸 것" }))).not.toContain("max-lg:hidden");
});
it("RF2 [목록 | 쓰기] 를 오가도 쓸 칸 입력이 남는다", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<ReportLayout checked={[]} areas={areas} panel={<input aria-label="메모" />} />);
  fireEvent.change(screen.getByLabelText("메모"), { target: { value: "쓰던 글" } });
  const group = screen.getByRole("group", { name: "보기 전환" });
  fireEvent.click(within(group).getByRole("button", { name: "쓰기" }));
  fireEvent.click(within(group).getByRole("button", { name: "목록" }));
  expect(screen.getByLabelText("메모")).toHaveValue("쓰던 글");
});

// WritePanel.test.tsx
const slot = (k: string) => <p>{k}</p>;
it("순서 — 특이사항 → 직접 추가 → 프로젝트·TF → 제출", () => {
  setUrl("?week=2026-11-16&tab=application");
  const { container } = render(<WritePanel
    notes={{ application: slot("N-app"), pims: slot("N-pims"), leave: slot("N-leave") }}
    directAdd={{ application: slot("D-app"), pims: slot("D-pims"), leave: slot("D-leave") }}
    projects={slot("P")} submit={slot("S")} />);
  const text = container.textContent ?? "";
  expect(text.indexOf("N-app")).toBeLessThan(text.indexOf("D-app"));
  expect(text.indexOf("D-app")).toBeLessThan(text.indexOf("P"));
  expect(text.indexOf("P")).toBeLessThan(text.indexOf("S"));
});
it("RF2 특이사항은 왼쪽 영역을 따라 바뀌고 다른 영역 칸은 숨긴 채 남는다", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<WritePanel notes={{ application: <input aria-label="원서 금주" />, pims: <input aria-label="발표 금주" />, leave: slot("L") }} />);
  fireEvent.change(screen.getByLabelText("원서 금주"), { target: { value: "쓰던 글" } });
  act(() => setUrl("?week=2026-11-16&tab=pims"));
  expect(screen.getByLabelText("원서 금주").closest("[hidden]")).not.toBeNull();
  act(() => setUrl("?week=2026-11-16&tab=application"));
  expect(screen.getByLabelText("원서 금주")).toHaveValue("쓰던 글");
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/ReportLayout.test.tsx src/app/dashboard/ops-weekly/__tests__/WritePanel.test.tsx --maxWorkers=1` → FAIL(파일 없음).
- [ ] **Step 3: 구현한다.** Interfaces 그대로. 페이지·기존 컴포넌트는 건드리지 않는다.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 → 0 failed.
- [ ] **Step 5: Commit** — `feat: 내 보고서 두 칸 레이아웃(ReportLayout·WritePanel)`

---

### Task 10: 내 보고서에 두 칸 연결 — 특이사항을 쓸 것 패널로 (구현: frontend-design-specialist)

**Files:**
- Create: `_components/ReportView.tsx`(server 호환, `"use client"` 없음)
- Modify: `_components/AreaNotes.tsx`, `_components/ApplicationTab.tsx`, `_components/PimsTab.tsx`, `_components/LeaveTab.tsx`, `page.tsx`, `_load.ts`(타입 export 한 줄)
- Test: `__tests__/AreaNotes.test.tsx`, `__tests__/ApplicationTab.test.tsx`·`PimsTab.test.tsx`·`LeaveTab.test.tsx`, `__tests__/page-subtabs.test.tsx`, `__tests__/PendingSaves.test.tsx`(합격자 발표 저장 실패 문구)

**Interfaces:**
- Consumes: `ReportLayout`·`WritePanel`(T9), `AREA_TABS`·`AreaTab`·`AREA_TAB_LABEL`·`manageHref`(T2), `bodyKeyOf`
- Produces:
  - `_load.ts`: `export type OpsWeeklyWeekView = Extract<OpsWeeklyView, { kind: "week" }>`(page 의 `Week` 별칭이 이것을 쓴다)
  - `ReportView(props: { view: OpsWeeklyWeekView; op: string | null }): JSX.Element` — `view.snapshot`·`view.detail` 이 있을 때만 page 가 부른다. 영역 본문 셋(지금 page 의 props 그대로, `settingsHref = manageHref(weekStart, "unmatched")`)은 `ReportLayout` 의 `areas` 로, `AreaNotes` 셋(application·pims·leave)은 `WritePanel` 의 `notes` 로 만들어 `<ReportLayout checked={report?.checked_tabs ?? []} areas={…} panel={<WritePanel notes={…} />} />` 로 조립한다. `editable = view.canEdit && report !== null`
  - `page.tsx`: tab 이 application·pims·leave 면 `<ReportView key={bodyKeyOf({ reportId, weekStart, op: viewed?.email ?? "", tab: "report" })} …/>` — key 에 영역을 넣지 않아 영역이 바뀌어도(서버 이동이어도) 다시 마운트하지 않는다. project·tf 는 아직 지금 경로
  - `AreaNotes`: 버튼 `이 탭 확인` → `이 영역 확인`(안내 문구 그대로). 바깥 `<section>` 에 `@container`, 금주·차주 그리드 `md:grid-cols-2` → `@md:grid-cols-2`(편집·읽기 둘 다 — 360px 패널에서는 한 줄, 넓은 서랍에서는 두 칸). 지역 사본 `AREA_LABEL` 의 `pims` 값은 `AREA_TAB_LABEL.pims`(`../_params` 에서 import) — 저장 대기 라벨이라, 이 칸의 저장이 실패해 제출이 막힐 때의 문구가 `합격자 발표 영역 특이사항: …` 이 된다(컨트롤러 판정 (b))
  - `ApplicationTab`·`PimsTab`·`LeaveTab`: `AreaNotes` 를 뺀다. 바깥 래퍼 `flex flex-col gap-7 p-5 lg:p-7` → `flex flex-col gap-7`(바깥 여백은 ReportLayout 이 진다)
  - `PimsTab`(컨트롤러 판정 (b)): 머리 `TabHeading title="PIMS"` → `title={AREA_TAB_LABEL.pims}`, 하위 탭 `ariaLabel="PIMS 묶음"` → `` ariaLabel={`${AREA_TAB_LABEL.pims} 묶음`} ``(= `합격자 발표 묶음`)

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 구현자가 확인할 것: 영역 테스트 셋과 AreaNotes.test 에서 `영역 특이사항`·`이 탭 확인`·바깥 래퍼 클래스를 찾는 단언의 위치. 영역 테스트의 특이사항 단언은 지우고 `queryByRole("heading", { name: "영역 특이사항" })` 가 null 인지로 바꾼다. 컨트롤러 판정 (b) 로 바뀌는 문구를 단언하는 기존 테스트도 여기서 고친다 — `PimsTab.test.tsx` 71행 tablist 이름 `PIMS 묶음` → `합격자 발표 묶음`, 79행 heading `PIMS` → `합격자 발표`, `page-subtabs.test.tsx` 142행 tablist 이름 `PIMS 묶음` → `합격자 발표 묶음`.

```tsx
// AreaNotes.test.tsx — 추가·변경
it("버튼 이름은 '이 영역 확인'", () => { /* getByRole("button", { name: "이 영역 확인" }) */ });
it("금주·차주는 컨테이너가 넓을 때만 두 칸", () => {
  // 편집 그리드 토큰: "@md:grid-cols-2" 있음, "md:grid-cols-2" 없음 / section 토큰에 "@container"
});

// page-subtabs.test.tsx — 추가
it("원서접수: 영역 탭·쓸 것 패널, 특이사항 셋이 모두 마운트된다", async () => {
  state.view = viewFor("application", false);
  await renderPage("application");
  expect(screen.getByRole("tablist", { name: "영역" })).toBeInTheDocument();
  const panel = screen.getByRole("complementary", { name: "쓸 것" });
  // 패널 안으로 좁힌다 — T11 의 서랍(ProjectTab 둘)도 AreaNotes 를 마운트해 화면 전체로는 다섯이 된다
  expect(within(panel).getAllByRole("heading", { name: "영역 특이사항", hidden: true })).toHaveLength(3);
});
// 'PIMS 탭: 관리자만 안내, 하위 탭은 금주·차주' 는 renderPage 전에 setUrl("?week=2026-11-16&tab=pims") (tablist 이름은 위 Step 1 대로 '합격자 발표 묶음')

// PendingSaves.test.tsx — 추가 ('제출완료 x 자동 저장' describe 안, blockedWith 정의 아래)
it("합격자 발표 특이사항 저장이 실패하면 영역 탭 이름으로 막는다", async () => {
  saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
  render(<Screen area="pims" />);
  typeThenBlur("x");
  await screen.findByText("저장 안 됨");
  fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
  await waitFor(() => expect(blockedWith("합격자 발표 영역 특이사항")).toBe(true));
  expect(blockedWith("PIMS 영역 특이사항")).toBe(false);
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/AreaNotes.test.tsx src/app/dashboard/ops-weekly/__tests__/ApplicationTab.test.tsx src/app/dashboard/ops-weekly/__tests__/PimsTab.test.tsx src/app/dashboard/ops-weekly/__tests__/LeaveTab.test.tsx src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx src/app/dashboard/ops-weekly/__tests__/PendingSaves.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로. `StickyKpiBar` 를 감싸는 DOM 을 새로 두지 않는다 — 부모가 스크롤 컨테이너여야 `--ops-kpi-h` 가 패널까지 내려간다(`StickyKpiBar.tsx` 31–32행 주석).
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/hidden-panel-saves.test.tsx src/app/dashboard/ops-weekly/__tests__/body-key.test.ts --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 내 보고서 두 칸 연결 — 특이사항을 쓸 것 패널로`

분할 검토: 특이사항을 본문에서 떼는 일과 패널에 붙이는 일, 페이지 연결, 합격자 발표 문구는 한 커밋이다 — 나누면 입력 칸이 사라지거나 둘이 된다. 레이아웃 두 컴포넌트는 페이지 없이 테스트로 닫혀 T9 로 먼저 나갔다.

---

### Task 11: 프로젝트·TF 요약 카드와 넓은 서랍 (구현: frontend-design-specialist)

**Files:**
- Create: `_components/project-drawer-context.tsx`, `_components/ProjectDrawer.tsx`, `_components/ProjectSummaryCards.tsx`
- Modify: `_components/ProjectTab.tsx`(바깥 여백·`hideHeading`), `_components/ReportView.tsx`, `page.tsx`
- Test: `__tests__/ProjectSummaryCards.test.tsx`·`__tests__/ProjectDrawer.test.tsx`(새), `__tests__/ProjectTab.test.tsx`, `__tests__/page-subtabs.test.tsx`

**Interfaces:**
- Consumes: `InspectorPanel`(`../../_components/inspector/InspectorPanel`), `useOpsQueryValue`·`replaceOpsQuery`(T6), `WritePanel` 의 `projects` 슬롯(T9), `ReportView`(T10), `ProjectTab`, `ProjectEntryView`·`ProjectKind`, `manageHref`(T2), `BTN_CLASS`
- Produces:
  - `ProjectDrawerProvider(props: { children: ReactNode })` + `useProjectDrawer(): { openKind: ProjectKind | null; open: (kind: ProjectKind) => void; close: () => void }` — `urlKind` = URL `tab` 이 project·tf 면 그 값, `localKind` = [쓰기]로 연 값(useState), `openKind = localKind ?? urlKind`. `open` 은 주소를 안 바꾼다. `close` 는 `localKind` 를 비우고, `urlKind !== null` 이면 `replaceOpsQuery({ tab: "application", sub: null })`
  - `ProjectDrawer(props: { panels: Record<ProjectKind, ReactNode> }): JSX.Element` — `InspectorPanel open={openKind !== null} onClose={close} widthClassName="md:w-[min(48rem,100vw)]"`. 안: 머리 줄(`<h2>` `프로젝트`/`TF` + [닫기] `BTN_CLASS`) — **이 `<h2>` 가 그 영역의 제목이다. 패널의 `ProjectTab` 은 자체 제목을 그리지 않는다(`hideHeading`)** — + 두 패널 모두 마운트 `hidden={shown !== kind}`(`shown` = `openKind` 또는 닫히는 동안 마지막으로 연 kind). 내용 래퍼에 `inert={openKind === null ? true : undefined}`(RF3) — 구현자가 확인할 것: React 19 의 `inert` 불리언 prop 이 타입에 있는지
  - `remainingOf(entries: readonly ProjectEntryView[], kind: ProjectKind): number`(같은 파일 export) — 그 kind 중 금주가 빈 항목 수. 빈 칸 = `html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === ""` 이고 `/<img/i` 가 없는 것
  - `ProjectSummaryCards(props: { entries: readonly ProjectEntryView[]; checked: readonly Area[]; editable: boolean }): JSX.Element` — 카드 둘(프로젝트·TF), 각 `border border-line-soft bg-situation-bg p-3`: 이름(`<span>` — 제목 요소가 아니다. 서랍 머리와 같은 이름의 heading 이 화면에 둘이 되지 않게. 확인했으면 ` ✓`) · `` `${n}건` `` + 남음이 있으면 `` ` · ${r}건 남음` ``(tabular-nums) · 버튼 `쓰기`(편집 가능) / `보기`(아니면) → `open(kind)`
  - `ReportView`: 전체를 `ProjectDrawerProvider` 로 감싸고, `WritePanel projects={<ProjectSummaryCards …/>}`, `ReportLayout` 옆에 `<ProjectDrawer panels={{ project: <ProjectTab kind="project" hideHeading …/>, tf: <ProjectTab kind="tf" hideHeading …/> }} />`(props 는 지금 page 의 ProjectTab props, 관리자 `settingsHref = manageHref(weekStart, "projects")`)
  - `page.tsx`: project·tf 도 `ReportView`(ProjectTab 직접 렌더 가지를 지운다)
  - `ProjectTab`: 바깥 `flex flex-col gap-7 p-5 lg:p-7` → `flex flex-col gap-7`(서랍 body 가 p-5 를 진다). props 에 `hideHeading?: boolean` — true 면 `TabHeading`(제목 + 건수)을 그리지 않는다. 기본 false 라 ProjectTab.test 의 기존 제목 단언(238행 `inOrder(["프로젝트", …])` 등)은 그대로다

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 구현자가 확인할 것: ProjectTab.test 가 바깥 래퍼 클래스를 단언하는지.

```tsx
// ProjectSummaryCards.test.tsx — entry(kind, thisWeek) 는 이 파일에서 정의한다. ProjectEntryView 필드는 ProjectTab.test 의
// entry(id, kind, sortOrder, over) 가 채우는 그대로(아래 ProjectTab.test 추가분은 그 파일의 4인자 entry 를 쓴다 — 이름만 같다)
it("remainingOf — 빈 HTML(<p><br></p>·&nbsp;)은 남음, 그림만 있으면 남음 아님", () => {
  const es = [entry("project", ""), entry("project", "<p><br></p>"), entry("project", "<p>&nbsp;</p>"),
    entry("project", '<p><img data-ops-path="a.png"></p>'), entry("project", "<p>진행</p>"), entry("tf", "")];
  expect(remainingOf(es, "project")).toBe(3);
  expect(remainingOf(es, "tf")).toBe(1);
});
it("카드 — '프로젝트 2건 · 1건 남음' + [쓰기], 확인한 종류는 ✓", () => {
  renderCards({ entries: [entry("project", ""), entry("project", "<p>진행</p>")], checked: ["project"], editable: true });
  const card = screen.getByText(/^프로젝트/).closest("div") as Element;
  expect(card).toHaveTextContent("프로젝트 ✓");
  expect(card).toHaveTextContent("2건 · 1건 남음");
  expect(card.className.split(/\s+/)).toEqual(expect.arrayContaining(["bg-situation-bg", "border-line-soft"]));
  expect(within(card).getByRole("button", { name: "쓰기" })).toBeInTheDocument();
});
it("남음이 없으면 건수만, 편집할 수 없으면 [보기]", () => { /* tf 1건 진행 → "TF 1건", editable false → "보기" */ });

// ProjectDrawer.test.tsx — Provider 로 감싸고 패널은 입력 하나씩
const panels = { project: <input aria-label="프로젝트 글" />, tf: <input aria-label="TF 글" /> };
it("tab=tf 로 들어오면 TF 서랍이 열린 채 시작한다", () => {
  setUrl("?week=2026-11-16&tab=tf");
  renderDrawer(panels);
  expect(screen.getByRole("heading", { name: "TF" }).closest("aside")).toHaveAttribute("aria-hidden", "false");
});
it("RF3 닫힌 서랍의 내용은 마운트돼 있지만 inert 다", () => {
  setUrl("?week=2026-11-16&tab=application");
  renderDrawer(panels);
  const input = screen.getByLabelText("프로젝트 글");
  expect(input.closest("[inert]")).not.toBeNull();
});
it("RF2 닫았다 다시 열어도 쓰던 글이 남고, tab=project 로 연 서랍을 닫으면 주소는 application", () => {
  setUrl("?week=2026-11-16&tab=project");
  renderDrawer(panels);
  fireEvent.change(screen.getByLabelText("프로젝트 글"), { target: { value: "쓰던 글" } });
  fireEvent.click(screen.getByRole("button", { name: "닫기" }));
  expect(window.location.search).toBe("?week=2026-11-16&tab=application");
  expect(screen.getByLabelText("프로젝트 글")).toHaveValue("쓰던 글");
});
it("[쓰기]로 열면 주소는 그대로(왼쪽 영역을 잃지 않는다)", () => {
  setUrl("?week=2026-11-16&tab=pims");
  renderDrawerWithOpener("tf"); // useProjectDrawer().open("tf") 를 부르는 버튼을 함께 렌더
  fireEvent.click(screen.getByRole("button", { name: "열기" }));
  expect(window.location.search).toBe("?week=2026-11-16&tab=pims");
  expect(screen.getByRole("heading", { name: "TF" }).closest("aside")).toHaveAttribute("aria-hidden", "false");
});

// ProjectTab.test.tsx — 추가 (entry·N 은 이 파일의 것)
it("hideHeading — 서랍 안에서는 자체 제목을 그리지 않는다(서랍 머리가 그 영역의 제목)", () => {
  render(<ProjectTab kind="tf" entries={[entry("t1", "tf", 10)]} reportId="r" editable notes={N} hideHeading />);
  expect(screen.queryByRole("heading", { name: "TF" })).toBeNull();
  expect(screen.getByText("t1")).toBeInTheDocument();
});

// page-subtabs.test.tsx — 추가
it("tab=project: 서랍이 열리고 왼쪽은 원서접수, 프로젝트 제목은 서랍 머리 하나", async () => {
  setUrl("?week=2026-11-16&tab=project");
  state.view = viewFor("project", false);
  await renderPage("project");
  // 서랍 안 ProjectTab 은 hideHeading, 요약 카드 이름은 제목 요소가 아니다
  const titles = screen.getAllByRole("heading", { name: "프로젝트" });
  expect(titles).toHaveLength(1);
  expect(titles[0].closest("aside")).toHaveAttribute("aria-hidden", "false");
  expect(screen.getByRole("tab", { name: "원서접수" })).toHaveAttribute("aria-selected", "true");
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/ProjectSummaryCards.test.tsx src/app/dashboard/ops-weekly/__tests__/ProjectDrawer.test.tsx src/app/dashboard/ops-weekly/__tests__/ProjectTab.test.tsx src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/PendingSaves.test.tsx src/app/dashboard/ops-weekly/__tests__/responsive.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 프로젝트·TF 를 요약 카드와 넓은 서랍에서 쓰기`

---

### Task 12: KPI 카드가 영역·하위 칸을 서버 왕복 없이 바꾸기 + 하위 탭 id 를 영역별로

**Files:**
- Modify: `_components/SubTabs.tsx`, `_components/WeeklyKpiRow.tsx`, `page.tsx`(WeeklyKpiRow 에 `tab` 을 안 넘김)
- Test: `__tests__/WeeklyKpiRow.test.tsx`, `__tests__/SubTabs.test.tsx`, `__tests__/responsive.test.tsx`, `__tests__/page-subtabs.test.tsx`

**Interfaces:**
- Consumes: `useOpsArea`(T8), `useOpsSub`, `resolveAppSub`
- Produces:
  - `subTabsIdOf(tab: SubTabArea): string` = `` `ops-subtabs-${tab}` ``(SubTabs.tsx export). `SUB_TABS_ID` 는 지우고 SubTabs 의 줄 id 를 이것으로
  - `WeeklyKpiRow` props 에서 `tab` 을 뺀다. 지금 영역은 `useOpsArea().area`. 활성: 합격자 발표 카드 = `area === "pims"`, 그 밖 = `area === "application" && appSub === t.sub`. 평범한 왼쪽 클릭은 모두 가로채 `setArea(t.tab, t.sub ?? "thisWeek")` — 내 보고서는 영역 셋을 늘 마운트하므로 다른 영역 카드도 서버를 안 거친다. 같은 영역이면 바로, 다른 영역이면 `requestAnimationFrame` 안에서 `document.getElementById(subTabsIdOf(t.tab))?.scrollIntoView?.({ block: "nearest" })`. href(가운데 클릭·새 탭)는 지금과 같다

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `tab` prop 과 하위 탭 줄 id 를 쓰는 테스트를 고친다. id 는 테스트에 상수 `SUB_TABS_ID` 가 아니라 문자열 `"ops-subtabs"` 로 적혀 있다 — `SubTabs.test.tsx` 191행·`WeeklyKpiRow.test.tsx` 273행을 `"ops-subtabs-application"` 으로. `tab` 을 넘기던 곳(WeeklyKpiRow.test 의 `BASE`·228·286행, responsive.test 71행)은 prop 을 지우고 `setUrl` 로 영역을 맞춘다. 단 '제출 현황·설정 탭에서는 어떤 카드도 활성이 아니다'(239)와 '제출 현황 탭에서 누르면 원서접수로 일반 이동한다'(347)는 지운다 — 위 Interfaces 대로 영역은 `resolveArea` 가 status·settings 를 원서접수로 읽으므로 setUrl 로 옮기면 기대가 뒤집히고, KPI 줄은 내 보고서에서만 그린다(T15).

```tsx
// WeeklyKpiRow.test.tsx — 뒤집는 것: '다른 탭으로 가는 카드(합격자 발표)는 가로채지 않는다'(341)
// 이 파일의 BASE 는 { weekStart: "2026-11-16", op: null } 이 된다(tab 삭제)
it("다른 영역 카드(합격자 발표)도 가로채 tab=pims·sub=thisWeek 로 바꾼다", () => {
  setUrl("?week=2026-11-16&tab=application&sub=dev");
  render(<WeeklyKpiRow {...BASE} ownerName="홍길동" kpis={KPIS} />);
  const link = screen.getByText("합격자 발표").closest("a") as HTMLElement;
  expect(fireEvent.click(link)).toBe(false); // preventDefault
  expect(window.location.search).toBe("?week=2026-11-16&tab=pims&sub=thisWeek");
  expect(link).toHaveAttribute("aria-current", "true");
});
it("합격자 발표에서 운영 중 카드 → tab=application·sub=running", () => { /* setUrl(tab=pims) → 클릭 → search 단언 */ });
it("수정 키 클릭은 가로채지 않는다", () => { /* ctrlKey: true → 주소 그대로 */ });

// SubTabs.test.tsx (또는 WeeklyKpiRow.test) — RF1
it("RF1 원서접수·합격자 발표 하위 탭을 함께 마운트해도 줄 id 가 다르고, 카드는 그 영역 줄로 스크롤한다", () => {
  setUrl("?week=2026-11-16&tab=application");
  render(<>
    <SubTabs tab="application" ariaLabel="원서접수 묶음" tabs={[{ key: "dev", label: "개발 중", count: 1 }]} panels={{ dev: null }} />
    <div hidden><SubTabs tab="pims" ariaLabel="합격자 발표 묶음" tabs={[{ key: "thisWeek", label: "금주 발표", count: 1 }]} panels={{ thisWeek: null }} /></div>
    <WeeklyKpiRow kpis={KPIS} ownerName="홍길동" weekStart="2026-11-16" op={null} />
  </>);
  expect(document.querySelectorAll("#ops-subtabs-application, #ops-subtabs-pims")).toHaveLength(2);
  const target = document.getElementById("ops-subtabs-pims") as HTMLElement;
  target.scrollIntoView = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => { cb(0); return 0; }); // jsdom 에 없을 수 있다 — afterEach 에서 vi.unstubAllGlobals()
  fireEvent.click(screen.getByText("합격자 발표").closest("a") as HTMLElement);
  expect(target.scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/WeeklyKpiRow.test.tsx src/app/dashboard/ops-weekly/__tests__/SubTabs.test.tsx src/app/dashboard/ops-weekly/__tests__/responsive.test.tsx src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/StickyKpiBar.test.tsx src/app/dashboard/ops-weekly/__tests__/page-kpi-visibility.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: KPI 카드가 서버 왕복 없이 영역·하위 칸을 바꾸고 하위 탭 id 를 영역별로`

---

### Task 13: 직접 추가를 쓸 것 패널로 (구현: frontend-design-specialist)

**Files:**
- Create: `src/app/dashboard/ops-weekly/_groups.ts`, `_components/DirectAddPanel.tsx`
- Modify: `_components/GroupShell.tsx`, `_components/AutoGroupSection.tsx`, `_components/ApplicationTab.tsx`, `_components/PimsTab.tsx`, `_components/LeaveTab.tsx`, `_components/ReportView.tsx`, `page.tsx`
- Test: `__tests__/groups.test.ts`·`__tests__/DirectAddPanel.test.tsx`(새), `_components/__tests__/GroupShell.test.tsx`, `__tests__/ApplicationTab.test.tsx`·`PimsTab.test.tsx`·`LeaveTab.test.tsx`·`AutoGroupSection.test.tsx`

**Interfaces:**
- Consumes: `ManualItemForm`(그대로 — `onClose` 를 안 주면 [닫기]·autoFocus 가 없다), `useOpsSub`, `useOpsArea`(T8), `resolveAppSub`·`parseSub`·`PIMS_SUBS`, `FIELD_CLASS`, `WritePanel` 의 `directAdd` 슬롯(T9)·`ReportView`(T10)
- Produces:
  - `_groups.ts`(순수, 묶음 제목 단일 소스):
    - `APP_GROUP_TITLE = { dev: "개발 중", test: "테스트 중", unknown: "구분 미확인", running: "운영 중", opening: "차주 오픈 예정", closing: "차주 마감 예정", other: "원서접수 외 서비스" } as const`
    - `PIMS_GROUP_TITLE = { thisWeek: "금주 발표", nextWeek: "차주 발표" } as const`, `LEAVE_GROUP_TITLE = "휴가·외근 일정"`
    - `type DirectAddGroup = { key: string | null; label: string }`
    - `directAddGroups(area: AutoArea, devStatusCollected: boolean): DirectAddGroup[]` — application: 수집된 주 dev·test·running·opening·closing·other, 수집 전 주 running·opening·closing·other(구분 미확인은 늘 뺀다 — 지금 `allowAdd={false}` 인 묶음과 같다) / pims: thisWeek·nextWeek / leave: `[{ key: null, label: LEAVE_GROUP_TITLE }]`
    - `appSubStateOf(app: AutoSnapshot["application"] | null | undefined): { showUnknown: boolean; collected: boolean }` — page.tsx 의 `<WeeklyKpiRow appSubState={{ showUnknown: …, collected: … }}>` 식 그대로(계획 작성 시점 206–211행, T10~T12 를 거치며 줄이 바뀐다. page 의 KPI 와 DirectAddPanel 이 같이 쓴다)
  - `ApplicationTab`·`PimsTab`·`LeaveTab` 은 제목을 `_groups.ts` 에서 가져온다(문구 그대로). `section()` 의 4번째 인자 `allowAdd` 를 지운다
  - `GroupShell` props 에서 `add` 를 뺀다(버튼·폼·`useState` 삭제). `AutoGroupSection` props 에서 `allowAdd` 를 뺀다. `LeaveTab` 의 `add` 도 뺀다
  - `DirectAddPanel(props: { area: AutoArea; reportId: string; groups: readonly DirectAddGroup[]; appSubState: { showUnknown: boolean; collected: boolean } }): JSX.Element` — 머리 `<h3>직접 추가</h3>`. 묶음이 둘 이상이면 `<select aria-label="묶음" className={FIELD_CLASS}>`. 기본값 = 왼쪽에서 보는 하위 칸(application `resolveAppSub(raw, appSubState)`, pims `parseSub("pims", raw, PIMS_SUBS)`, leave `null`)이 `groups` 에 있으면 그것, 없으면 첫 묶음. 왼쪽 하위 칸이 바뀌면 선택도 따라 바뀌고, 사람이 고른 값은 다음 하위 칸 전환 전까지 남는다. 그 아래 `<ManualItemForm reportId area groupKey={선택} leave={area === "leave"} />`
  - `ReportView`: 편집 가능하고 보고서가 있으면 `WritePanel directAdd={{ application, pims, leave }}`(영역마다 `DirectAddPanel` 하나 — 셋 다 마운트), 아니면 `null`
  - `page.tsx`: KPI 의 `appSubState` 를 `appSubStateOf(view.snapshot?.application)` 로

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 구현자가 확인할 것: 영역·묶음 테스트에서 `+ 직접 추가`·`직접 추가 제목` 을 찾는 단언의 위치 — 왼쪽에는 이제 없다고 단언을 뒤집는다.

```ts
// groups.test.ts
it("directAddGroups — 지금 [+ 직접 추가] 가 붙던 묶음과 같다", () => {
  expect(directAddGroups("application", true).map((g) => g.key)).toEqual(["dev", "test", "running", "opening", "closing", "other"]);
  expect(directAddGroups("application", false).map((g) => g.key)).toEqual(["running", "opening", "closing", "other"]);
  expect(directAddGroups("pims", true).map((g) => g.label)).toEqual(["금주 발표", "차주 발표"]);
  expect(directAddGroups("leave", true)).toEqual([{ key: null, label: "휴가·외근 일정" }]);
});
it("appSubStateOf — 스냅샷이 없으면 수집됨·미확인 없음", () => {
  expect(appSubStateOf(undefined)).toEqual({ showUnknown: false, collected: true });
});
```

```tsx
// DirectAddPanel.test.tsx — addManualItem 은 목
const groups = directAddGroups("application", true);
const st = { showUnknown: true, collected: true };
it("묶음 기본값은 왼쪽에서 보는 하위 칸이고, 하위 칸이 바뀌면 따라간다", () => {
  setUrl("?week=2026-11-16&tab=application&sub=running");
  render(<DirectAddPanel area="application" reportId="r" groups={groups} appSubState={st} />);
  expect(screen.getByLabelText("묶음")).toHaveValue("running");
  act(() => setUrl("?week=2026-11-16&tab=application&sub=closing"));
  expect(screen.getByLabelText("묶음")).toHaveValue("closing");
});
it("하위 칸이 직접 추가가 없는 묶음(구분 미확인)이면 첫 묶음", () => {
  setUrl("?week=2026-11-16&tab=application&sub=unknown");
  render(<DirectAddPanel area="application" reportId="r" groups={groups} appSubState={st} />);
  expect(screen.getByLabelText("묶음")).toHaveValue("dev");
});
it("RF2 묶음을 바꾸고 하위 칸이 바뀌어도 쓰던 제목이 남고, [추가]는 고른 묶음으로", async () => {
  setUrl("?week=2026-11-16&tab=application&sub=running");
  render(<DirectAddPanel area="application" reportId="r" groups={groups} appSubState={st} />);
  fireEvent.change(screen.getByLabelText("직접 추가 제목"), { target: { value: "새 서비스" } });
  fireEvent.change(screen.getByLabelText("묶음"), { target: { value: "other" } });
  act(() => setUrl("?week=2026-11-16&tab=application&sub=dev"));
  expect(screen.getByLabelText("직접 추가 제목")).toHaveValue("새 서비스");
  fireEvent.change(screen.getByLabelText("묶음"), { target: { value: "opening" } });
  fireEvent.click(screen.getByRole("button", { name: "추가" }));
  await waitFor(() => expect(addManualItem).toHaveBeenCalledWith(expect.objectContaining({ area: "application", groupKey: "opening", title: "새 서비스" })));
});
it("휴가·외근 — 묶음 선택 없이 기간·구분 칸, groupKey null", () => {
  setUrl("?week=2026-11-16&tab=leave");
  render(<DirectAddPanel area="leave" reportId="r" groups={directAddGroups("leave", true)} appSubState={st} />);
  expect(screen.queryByLabelText("묶음")).toBeNull();
  expect(screen.getByLabelText("시작일")).toBeInTheDocument();
});
it("[닫기] 가 없다 — 패널에 늘 열려 있다", () => { /* queryByRole("button", { name: "닫기" }) null */ });

// GroupShell.test.tsx: "[+ 직접 추가] 버튼이 없다" — queryByRole("button", { name: "+ 직접 추가" }) null
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/groups.test.ts src/app/dashboard/ops-weekly/__tests__/DirectAddPanel.test.tsx src/app/dashboard/ops-weekly/_components/__tests__/GroupShell.test.tsx src/app/dashboard/ops-weekly/__tests__/ApplicationTab.test.tsx src/app/dashboard/ops-weekly/__tests__/PimsTab.test.tsx src/app/dashboard/ops-weekly/__tests__/LeaveTab.test.tsx src/app/dashboard/ops-weekly/__tests__/AutoGroupSection.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx src/app/dashboard/ops-weekly/__tests__/hidden-panel-saves.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 직접 추가를 쓸 것 패널로(묶음 기본값 = 보는 하위 칸)`

분할 검토: 왼쪽 [+ 직접 추가] 를 지우는 일과 패널에 붙이는 일은 한 커밋이어야 직접 추가가 사라지거나 둘이 되지 않는다.

---

### Task 14: 제출을 쓸 것 패널 한 곳으로, 머리띠 정리 (구현: frontend-design-specialist)

**Files:**
- Create: `_components/use-submit.ts`, `_components/SubmitBar.tsx`, `src/app/dashboard/ops-weekly/_header-week.ts`
- Modify: `_components/WeekHeader.tsx`, `_components/ReportView.tsx`, `page.tsx`
- Test: `__tests__/SubmitBar.test.tsx`·`__tests__/header-week.test.ts`(새), `__tests__/WeekHeader.test.tsx`, `__tests__/PendingSaves.test.tsx`, `__tests__/page-subtabs.test.tsx`

**Interfaces:**
- Consumes: `usePendingSaves`, `submitReport`, `HeaderActionButton`, `roleTabOf`·`opsWeeklyHref`(T2), `useOpsArea`(T8), `WritePanel` 의 `submit` 슬롯(T9)·`ReportView`(T10)
- Produces:
  - `_header-week.ts`(순수 — `"use client"` 를 붙이지 않는다. page(서버)가 부르고 WeekHeader 는 타입만 가져간다. `"use client"` 모듈이 내보낸 함수는 서버 컴포넌트에서 부를 수 없고, `_load.ts` 에 두면 page 테스트가 `_load` 를 통째로 목으로 바꿔 함수가 사라진다): `export type HeaderWeek = Pick<WeekRow, "week_start" | "status" | "reported_at">`, `export function headerWeekOf(week: WeekRow): HeaderWeek` — 그 세 칸만 담은 새 객체를 돌려준다. 당번 총평(`summary_this`·`summary_next`)은 제출 현황 데이터라 담지 않는다(Global Constraints 'week 행')
  - `use-submit.ts`: `useSubmit(reportId: string | null): { pending: boolean; message: string | null; waiting: boolean; submit: () => Promise<void> }` 와 문구 상수(`COMMITTED_PREFIX`·`SUBMIT_FAILED`·`SAVE_BLOCKED`·`SAVE_TIMEOUT`·`SAVE_WAITING`)를 WeekHeader 에서 **그대로** 옮긴다
  - `SubmitBar(props: { reportId: string | null; canSubmit: boolean }): JSX.Element` — `canSubmit` 이면 `HeaderActionButton` `제출완료`(진행 중 disabled). 대기 안내·결과 문구(`Notice`)는 `canSubmit` 과 무관하게 남는다 — 제출 뒤 새로고침으로 `canSubmit=false` 가 와도 '제출은 끝났지만…' 이 사라지면 안 된다. 바깥 `flex flex-col items-stretch gap-2 border-t border-line pt-4`
  - `WeekHeader` props: `week` 의 타입을 `WeekRow` → `HeaderWeek` 로 좁힌다(읽는 칸이 `week_start`·`status`·`reported_at` 셋뿐이다 — 지금 코드 138·154·210행). 지우는 것 `viewedName`(지금도 안 읽는다)·`canSubmit`·`reportId`·`writers`·`viewedEmail`·`tab`(제출 버튼·대기/결과 문구 삭제). 더하는 것 `showReportState: boolean`, `checkedCount: number`, `viewingOther: { name: string; backHref: string } | null`, `writerPicker: { writers: readonly { email: string; name: string }[]; viewedEmail: string | null } | null`. `showReportState` 면 상태 배지 + `` `확인 ${checkedCount}/5` ``(tabular-nums), 아니면 둘 다 없음. `viewingOther` 면 `` `${name}의 보고서` `` + `<Link href={backHref}>‹ 제출 현황</Link>`. 주 이동·`제출 n/m · 당번`·잠김·다시 작성 사유·지난주 안내는 그대로
  - **작성자 선택 상자는 없애지 않는다**(컨트롤러 판정 — '빌더 확인 해소' 표): `writerPicker !== null` 일 때만 지금의 `ListSelect ariaLabel="작성자"`(선택지 = `writerPicker.writers` 의 이름, 값 = `viewedEmail` 인 사람의 이름)를 지금 자리(주 이동 옆)에 그린다. `viewedEmail === null`(본인 보고서가 없는 명단 밖 당번·관리자·받는 사람)이면 첫 사람이 골라진 것처럼 보이지 않게 `placeholder="작성자 선택"` 을 준다. 컴포넌트 머리에서 `const { area } = useOpsArea()` 를 읽어 두고, 고르면 `router.push(opsWeeklyHref(week.week_start, area, email))` — 서버 `tab` 은 replaceState 뒤 낡으므로 URL 의 영역을 쓰고, 제출 현황·관리에서 고르면 `resolveArea` 가 원서접수를 준다. `useRouter` 는 이 이동에만 남는다
  - `page.tsx`: `week={headerWeekOf(week)}`(행을 통째로 넘기지 않는다), `showReportState = roleTabOf(tab) === "report"`, `checkedCount = new Set(report?.checked_tabs ?? []).size`, `viewingOther = op !== null && viewed !== null ? { name: viewed.name, backHref: opsWeeklyHref(weekStart, "status", null) } : null`, `writerPicker = view.writers.length > 0 ? { writers: view.writers.map((w) => ({ email: w.email, name: w.name })), viewedEmail: viewed?.email ?? null } : null`(지금과 같은 조건 — T15 가 열람 권한으로 좁힌다)
  - `ReportView`: `WritePanel submit={op === null ? <SubmitBar reportId={report?.id ?? null} canSubmit={view.canSubmit} /> : null}` — 남의 보고서에는 제출이 없다

- [ ] **Step 1: 실패하는 테스트를 쓴다.**
  - WeekHeader.test 의 제출 테스트 — '제출 버튼은 본인·열린 주에만, 표준 헤더 액션 모양'(93) · '이미 제출했으면 버튼 대신 제출 시각'(103 의 버튼 부분) · 164~226행 다섯 · '제출 실패 메시지는 머리 행 밖 아래 줄에서 vermilion'(248) — 를 `SubmitBar.test.tsx` 로 옮겨 `<SubmitBar reportId="r1" canSubmit />` 로 같은 단언을 한다. 단 187행의 `제출함` 배지 단언과 248행의 머리 행(`justify-end`) 단언은 WeekHeader 몫이라 옮기지 않는다 — 187 은 아래 'canSubmit 이 false 로 와도' 테스트가 대신하고, 248 은 vermilion·버튼 뒤 단언만 옮긴다.
  - 작성자 선택 상자는 남는다(컨트롤러 판정). '작성자를 바꾸면 op 를 달아 같은 탭으로 이동'(154)은 지우지 않고 아래 '작성자를 바꾸면 … 지금 영역으로' 로 바꾼다. '정보는 왼쪽 · 액션은 오른쪽 묶음, 그 부모 행이 양 끝 정렬'(237)은 버튼이 없어지므로 `제출 0/2` 글자에서 `justify-end` 묶음을 찾도록 바꾸고, 작성자 상자가 그 묶음 밖이라는 단언은 남긴다.
  - WeekHeader.test 의 `base` 는 지운 props(`viewedName`·`writers`·`viewedEmail`·`canSubmit`·`reportId`·`tab`) 대신 `showReportState: true`·`checkedCount: 0`·`viewingOther: null`·`writerPicker: { writers: [운영자A, 운영자B 두 사람 그대로], viewedEmail: "a@example.com" }` 를 갖는다. WeekHeader 에 남는 배지 테스트(103 의 제출 시각 부분·263 '상태 배지')는 이 `base` 로 돈다. `next/navigation` 목은 `{ ...(await import("./search-params-mock")).navigationModule, useRouter: () => ({ push, refresh }) }` 로 바꾼다 — 작성자 선택이 `useOpsArea` 로 URL 을 읽는다.
  - PendingSaves.test 는 `WeekHeader` 대신 `SubmitBar` 를 렌더하고 `제출완료` 를 누른다(단언 그대로). 구현자가 확인할 것: 이 파일이 WeekHeader 에 넘기던 props.

```tsx
// WeekHeader.test.tsx — 추가 (이 파일은 renderHeader 도우미가 없다 — render(<WeekHeader {...base} …/>) 로 쓴다)
it("내 보고서: 상태 배지와 확인 n/5(숫자 정렬)", () => {
  render(<WeekHeader {...base} showReportState checkedCount={2} reportStatus="draft" />);
  expect(screen.getByText("작성 중")).toBeInTheDocument();
  expect(screen.getByText("확인 2/5").className).toContain("tabular-nums");
});
it("제출 현황·관리에서는 배지·확인 수가 없다", () => {
  render(<WeekHeader {...base} showReportState={false} checkedCount={2} reportStatus="draft" />);
  expect(screen.queryByText("작성 중")).toBeNull();
  expect(screen.queryByText(/^확인 \d\/5$/)).toBeNull();
});
it("머리띠에는 제출 버튼이 없다", () => {
  render(<WeekHeader {...base} />);
  expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
});
it("작성자 선택 상자는 writerPicker 가 있을 때만 — 선택지는 명단 이름, 본인 보고서가 없으면 '작성자 선택'", () => {
  const { rerender } = render(<WeekHeader {...base} writerPicker={null} />);
  expect(screen.queryByLabelText("작성자")).toBeNull();
  rerender(<WeekHeader {...base} />);
  const names = () => within(screen.getByLabelText("작성자")).getAllByRole("option").map((o) => o.textContent);
  expect(names()).toEqual(["운영자A", "운영자B"]);
  rerender(<WeekHeader {...base} writerPicker={{ ...base.writerPicker, viewedEmail: null }} />);
  expect(names()).toEqual(["작성자 선택", "운영자A", "운영자B"]);
  expect(screen.getByLabelText("작성자")).toHaveValue("");
});
it("작성자를 바꾸면 op 를 달아 지금 영역으로, 제출 현황에서 고르면 원서접수로", () => {
  setUrl("?week=2026-11-16&tab=pims");
  render(<WeekHeader {...base} />);
  fireEvent.change(screen.getByLabelText("작성자"), { target: { value: "운영자B" } });
  expect(push).toHaveBeenLastCalledWith("/dashboard/ops-weekly?week=2026-11-16&tab=pims&op=b%40example.com");
  cleanup();
  setUrl("?week=2026-11-16&tab=status");
  render(<WeekHeader {...base} />);
  fireEvent.change(screen.getByLabelText("작성자"), { target: { value: "운영자B" } });
  expect(push).toHaveBeenLastCalledWith("/dashboard/ops-weekly?week=2026-11-16&tab=application&op=b%40example.com");
});
it("남의 보고서: 누구의 것인지와 제출 현황으로 돌아가는 링크", () => {
  render(<WeekHeader {...base} viewingOther={{ name: "김철수", backHref: "/dashboard/ops-weekly?week=2026-11-16&tab=status" }} />);
  expect(screen.getByText("김철수의 보고서")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "‹ 제출 현황" })).toHaveAttribute("href", "/dashboard/ops-weekly?week=2026-11-16&tab=status");
});

// header-week.test.ts — 새 파일
const WEEK: WeekRow = {
  id: "w1", week_start: "2026-11-16", label_year: 2026, label_month: 11, label_week: 3, duty_email: "d@x",
  summary_this: "당번 총평 금주", summary_next: "당번 총평 차주", status: "reported", reported_at: "2026-11-20T08:00:00Z",
  reported_by: "d@x", reopened_at: null, reopened_by: null,
};
it("머리띠가 읽는 세 칸만 담은 새 객체 — 당번 총평 키가 없다", () => {
  const h = headerWeekOf(WEEK);
  expect(Object.keys(h).sort()).toEqual(["reported_at", "status", "week_start"]);
  expect(h).toEqual({ week_start: "2026-11-16", status: "reported", reported_at: "2026-11-20T08:00:00Z" });
  expect(h).not.toHaveProperty("summary_this");
  expect(h).not.toHaveProperty("summary_next");
  expect(h).not.toBe(WEEK);
});

// SubmitBar.test.tsx — 옮긴 것에 더해
it("제출 뒤 canSubmit 이 false 로 와도 '제출은 끝났지만' 안내가 남는다", async () => { /* rerender(<SubmitBar reportId="r1" canSubmit={false} />) 후 status 문구 존재 */ });

// page-subtabs.test.tsx — 추가 (WeekHeader 는 목이라 화면의 제출완료는 패널 것뿐)
it("제출완료 는 정확히 하나 — 쓸 것 패널 안", async () => {
  state.view = viewFor("application", false);
  await renderPage("application");
  const buttons = screen.getAllByRole("button", { name: "제출완료" });
  expect(buttons).toHaveLength(1);
  expect(buttons[0].closest("aside")).toHaveAccessibleName("쓸 것");
});
it("남의 보고서(op)에서는 제출완료 가 없다", async () => { /* viewFor(..., { viewed: 김철수, writers: [...] }) → queryByRole null */ });
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/SubmitBar.test.tsx src/app/dashboard/ops-weekly/__tests__/header-week.test.ts src/app/dashboard/ops-weekly/__tests__/WeekHeader.test.tsx src/app/dashboard/ops-weekly/__tests__/PendingSaves.test.tsx src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로. 옮기는 코드는 로직을 바꾸지 않는다.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/_components/__tests__/pending-saves.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 제출을 쓸 것 패널 한 곳으로·머리띠에 내 상태와 확인 수`

---

### Task 15: 서버 열람 판정 — 권한 없는 데이터는 읽지 않고 안내 화면

**Files:**
- Modify: `src/features/ops-weekly/settings-queries.ts`, `_load.ts`, `page.tsx`, `_params.ts`(`parseTab` 삭제)
- Test: `__tests__/load-access.test.ts`(새), `src/features/ops-weekly/__tests__/settings-queries.test.ts`, `__tests__/page-empty-roster.test.tsx`, `__tests__/page-kpi-visibility.test.tsx`, `__tests__/params.test.ts`, `__tests__/page-subtabs.test.tsx`(작성자 선택 상자 조건·당번 총평 가드)

**Interfaces:**
- Consumes: `statusAccess`·`isDuty`·`canManageSettings`(T1), `resolveTab`·`roleTabsOf`·`roleTabOf`·`TabAccess`·`RoleTab`(T2)
- Produces:
  - `isRecipient(email: string): Promise<boolean>` = `(await listRecipients()).includes(normEmail(email))` — 명단 정규화는 `listRecipients` 한 길로, 결과는 불리언만 나간다
  - `OpsWeeklyView` 에 `| { kind: "no-access"; week: WeekRow; weekRef: WeekRef; emptyRoster: boolean }`, week 칸에 `roles: RoleTab[]`(역할 탭 줄에 그릴 역할 — 아래 `roles`)·`statusAccess: StatusAccess`
  - `loadOpsWeeklyPage` 순서: `state = normalizedWeekStateOf(week)` → `recipient` = `week.status === "reported" && !actor.isAdmin && !isDuty(actor, state)` 일 때만 `await isRecipient(actor.email)`, 아니면 false → `access = statusAccess(actor, state, recipient)` → `viewed = pickViewed(writers, actor, sp.op, access !== null)` → `tabAccess = { canReport: viewed !== null, status: access, manage: canManageSettings(actor) }` → `tab = resolveTab(sp.tab, tabAccess)`; `null` 이면 보고서·목록을 읽지 않고 `{ kind: "no-access", week, weekRef, emptyRoster: writers.length === 0 }`
  - `roles = roleTabsOf({ ...tabAccess, canReport: isWriter })`, `isWriter = writers.some((w) => w.email === actor.email)`(둘 다 정규화된 값 — `derive` 의 `writerEmails.has(actor.email)` 와 같은 판정). **내 보고서 탭은 본인이 명단에 있을 때만 생긴다**(spec §6.1 '명단에 없는 관리자·당번·받는 사람은 내 보고서 탭이 없고'). `tabAccess.canReport` 는 `viewed !== null` 그대로 둔다 — 명단 밖 당번·관리자가 `?op=` 로 연 남의 보고서 화면(tab=application 등)을 허용하는 값이고, 그때 탭 줄에 내 보고서는 없으며 켜져 보이는 것은 제출 현황이다(T16)
  - `pickViewed(writers, actor, op: string | undefined, canViewOthers: boolean): WriterCandidate | null` — 본인 = 명단의 `actor.email`. `canViewOthers` 이고 `op` 가 있으면 명단의 `normEmail(op)`, 없으면 본인. **명단 첫 사람으로 떨어지는 길을 지운다**. `?op` 를 받아들일지 정하는 자리는 여기 하나다(spec §6.7) — `canViewOthers` 에는 위에서 구한 `access !== null` 을 넘긴다(T1 에 같은 판정 함수를 두지 않는다)
  - 데이터: `loadViewedData`(스냅샷·상세·KPI)는 `roleTabOf(tab) === "report"` 일 때만, `loadStatusData` 는 `tab === "status"` 일 때만, 설정 번들·안 붙은 서비스·전체 현황은 `tab === "settings"` 일 때만. `view.reports` 는 지금처럼 status 일 때만 싣는다. 그 결과 KPI 는 제출 현황·관리에서 사라진다(spec §6.2.2)
  - `page.tsx`: `no-access` 면 `NoAccess`(page 안 함수, `NoWeek` 와 같은 꼴) — `BOX_CLASS` 상자에 `emptyRoster ? EMPTY_ROSTER : "이 주에 볼 수 있는 화면이 없습니다"`, 명단이 있을 때만 그 아래 `주간업무보고는 작성 대상과 그 주 당번·관리자가 봅니다. 받는 사람은 보고가 끝난 주를 볼 수 있습니다.`(text-xs text-muted), 링크 `‹ 이전 주`·`다음 주 ›`(`opsWeeklyHref(shiftWeek(weekStart, ±1), "status", null)`)·`이번 주로`. WeekBody 의 빈 명단 가지와 `OPEN_WITHOUT_ROSTER` 를 지운다(이제 report 탭은 `viewed` 가 있을 때만 열린다)
  - `page.tsx`(작성자 선택 상자 — 컨트롤러 판정): T14 가 둔 WeekHeader `writerPicker` 조건 `view.writers.length > 0` 을 `view.statusAccess !== null` 로 바꾼다. 남의 보고서를 열 수 있는 사람(그 주 당번·관리자, 보고 끝난 주의 받는 사람)에게만 상자와 명단이 내려가고, 일반 운영자에게는 `null` 이라 상자도 명단도 RSC 에 실리지 않는다. 선택지·주소(`?op=`)는 T14 그대로

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `load-access.test.ts` 의 목은 아래 첫 블록 그대로다 — `load-snapshot.test.ts` 와 같은 모듈(`server-only`·week-queries·report-queries·settings-queries·auto-queries·note-images)을 막되, 모두 `vi.fn` 이라 '안 읽었다'를 단언할 수 있다. 픽스처: 주 `w1`(2026-11-16, open, 당번 `d@x`), 명단 `a@x 홍길동`·`b@x 김철수`. 보고된 주를 쓰는 테스트는 `sp.week` 를 준다 — `_load` 는 이번 주 행이 보고됐으면 기본 주를 다음 주로 옮긴다(`defaultWeekStart`).

```ts
// load-access.test.ts — 목
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CurrentOperator } from "@/features/auth/queries";
import type { WeekRow } from "@/features/ops-weekly/schemas";
import { EMPTY, snap } from "./tab-fixtures";

const m = vi.hoisted(() => ({
  getWeek: vi.fn(),
  ensureWeek: vi.fn(),
  listWriters: vi.fn(),
  listRecentWeeks: vi.fn(),
  ensureReport: vi.fn(),
  listReports: vi.fn(),
  loadReportDetail: vi.fn(),
  listProjectEntriesForWeek: vi.fn(),
  listReportStatusesForWeeks: vi.fn(),
  loadSettingsBundle: vi.fn(),
  isRecipient: vi.fn(),
  loadAutoSnapshot: vi.fn(),
  loadUnmatchedServices: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/ops-weekly/week-queries", () => ({
  getWeek: m.getWeek, ensureWeek: m.ensureWeek, listWriters: m.listWriters, listRecentWeeks: m.listRecentWeeks,
}));
vi.mock("@/features/ops-weekly/report-queries", () => ({
  ensureReport: m.ensureReport, listReports: m.listReports, loadReportDetail: m.loadReportDetail,
  listProjectEntriesForWeek: m.listProjectEntriesForWeek, listReportStatusesForWeeks: m.listReportStatusesForWeeks,
}));
vi.mock("@/features/ops-weekly/settings-queries", () => ({
  loadSettingsBundle: m.loadSettingsBundle, isRecipient: m.isRecipient,
}));
vi.mock("@/features/ops-weekly/auto-queries", () => ({
  loadAutoSnapshot: m.loadAutoSnapshot, loadUnmatchedServices: m.loadUnmatchedServices,
}));
vi.mock("@/features/ops-weekly/note-images", () => ({
  signProjectEntries: async <T,>(entries: T) => entries,
}));

import { loadOpsWeeklyPage } from "../_load";

const WEEK: WeekRow = {
  id: "w1", week_start: "2026-11-16", label_year: 2026, label_month: 11, label_week: 3, duty_email: "d@x",
  summary_this: "", summary_next: "", status: "open",
  reported_at: null, reported_by: null, reopened_at: null, reopened_by: null,
};
const writer = (email: string, name: string) => ({ email, name, team: "운영1팀", role: "사원", status: "active" });
const reportFor = (weekId: string, email: string) => ({
  id: `r-${email}`, week_id: weekId, operator_email: email, status: "draft", submitted_at: null,
  returned_at: null, returned_by: null, return_reason: null, snapshot: null, checked_tabs: [],
});
/** getWeek(이번 주·지난주 조회)과 ensureWeek(보는 주) 모두 같은 행을 준다 */
function getWeekMock(over: Partial<WeekRow> = {}) {
  const week = { ...WEEK, ...over };
  m.getWeek.mockResolvedValue(week);
  m.ensureWeek.mockResolvedValue(week);
}
const isRecipientMock = (v: boolean) => m.isRecipient.mockResolvedValue(v);

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  getWeekMock();
  m.listWriters.mockResolvedValue([writer("a@x", "홍길동"), writer("b@x", "김철수")]);
  m.ensureReport.mockImplementation(async (weekId: string, email: string) => reportFor(weekId, email));
  m.listReports.mockResolvedValue([]);
  m.loadReportDetail.mockResolvedValue(EMPTY);
  m.listProjectEntriesForWeek.mockResolvedValue([]);
  m.listRecentWeeks.mockResolvedValue([]);
  m.listReportStatusesForWeeks.mockResolvedValue([]);
  m.loadSettingsBundle.mockResolvedValue({ marker: "bundle" });
  isRecipientMock(false);
  m.loadAutoSnapshot.mockResolvedValue(snap());
  m.loadUnmatchedServices.mockResolvedValue({ application: [], pims: [] });
});
```

```ts
// load-access.test.ts — 테스트
const load = (email: string, permission: "member" | "admin", sp: Record<string, string>) =>
  loadOpsWeeklyPage({ email, permission } as CurrentOperator, sp, new Date("2026-11-18T03:00:00Z"));

it("일반 운영자: ?tab=status&op=b 여도 본인 원서접수, 남의 데이터는 읽지 않는다", async () => {
  const v = await load("a@x", "member", { tab: "status", op: "b@x" });
  expect(v).toMatchObject({ kind: "week", tab: "application", viewed: { email: "a@x" }, roles: ["report"], statusAccess: null, reports: null, bundle: null, overview: null });
  expect(m.listProjectEntriesForWeek).not.toHaveBeenCalled();
  expect(m.loadSettingsBundle).not.toHaveBeenCalled();
  expect(m.ensureReport).not.toHaveBeenCalledWith("w1", "b@x");
});
it("일반 운영자: ?tab=settings 도 원서접수", async () => { /* tab "application", m.loadSettingsBundle 미호출 */ });
it("RF4 그 주 당번(명단 밖): ?op=B@X 는 b 의 보고서(탭 줄에 내 보고서 없음), 명단 밖 op 는 제출 현황", async () => {
  expect(await load("d@x", "member", { op: "B@X" })).toMatchObject({ tab: "application", viewed: { email: "b@x" }, roles: ["status"] });
  expect(await load("d@x", "member", { op: "x@x" })).toMatchObject({ tab: "status", viewed: null, roles: ["status"] });
});
it("당번이 아닌 주의 명단 밖 당번은 안내 화면 — 받는 사람 조회도 안 한다(열린 주)", async () => {
  getWeekMock({ duty_email: "e@x" });
  expect(await load("d@x", "member", {})).toMatchObject({ kind: "no-access", emptyRoster: false });
  expect(m.isRecipient).not.toHaveBeenCalled();
});
it("받는 사람: 보고된 주의 ?tab=status 는 읽기 전용 제출 현황", async () => {
  getWeekMock({ status: "reported", reported_at: "2026-11-20T08:00:00Z" });
  isRecipientMock(true);
  const v = await load("r@x", "member", { week: "2026-11-16", tab: "status" });
  expect(v).toMatchObject({ kind: "week", tab: "status", statusAccess: "read", roles: ["status"] });
  expect(m.isRecipient).toHaveBeenCalledWith("r@x");
});
it("받는 사람: 열린 주는 안내 화면", async () => { /* isRecipientMock(true) · open 주 → no-access */ });
it("명단 밖 관리자: 기본은 제출 현황, ?tab=settings 는 번들·안 붙은 서비스·전체 현황을 읽는다", async () => {
  expect(await load("z@x", "admin", {})).toMatchObject({ tab: "status", roles: ["status", "manage"] });
  const s = await load("z@x", "admin", { tab: "settings" });
  expect(s).toMatchObject({ tab: "settings" });
  expect(m.loadSettingsBundle).toHaveBeenCalledTimes(1);
  expect(m.listRecentWeeks).toHaveBeenCalledWith(8);
});
it("명단 밖 관리자가 ?op=작성자 로 열면 그 보고서를 보되 탭은 제출 현황·관리 둘", async () => {
  expect(await load("z@x", "admin", { op: "b@x" })).toMatchObject({ tab: "application", viewed: { email: "b@x" }, roles: ["status", "manage"] });
});
it("역할 없음·보고된 주·받는 사람 아님 → 안내 화면", async () => { /* getWeekMock(reported) · isRecipientMock(false) · sp.week → no-access */ });
it("명단 0명의 일반 운영자 → 안내 화면(emptyRoster)", async () => { /* m.listWriters.mockResolvedValue([]) → no-access, emptyRoster true */ });
it("작성자이면서 당번이 제출 현황을 열어도 스냅샷·KPI 를 읽지 않는다", async () => {
  getWeekMock({ duty_email: "a@x" }); // 보는 사람이 있어야 '탭 때문에 안 읽는다'가 드러난다
  await load("a@x", "member", { tab: "status" });
  expect(m.loadAutoSnapshot).not.toHaveBeenCalled();
});
```

```ts
// settings-queries.test.ts
it("isRecipient — 대소문자·공백을 맞춰 본인 하나만 대조, 조회 실패는 던진다", async () => {
  // fake-admin: ops_weekly_recipients → [{ email: " R@X " }]
  expect(await isRecipient("r@x")).toBe(true);
  expect(await isRecipient("z@x")).toBe(false);
  // 에러 응답 → rejects
});
```

  - `page-empty-roster.test.tsx`: view 를 `{ kind: "no-access", week, weekRef, emptyRoster: true }` 로 — `EMPTY_TEXT` 한 번 · 상자 클래스(`bg-situation-bg`·`border-line-soft`) 단언 유지. '설정 링크는 admin 에게만'은 `no-access` 에 링크가 없다는 단언으로 바꾼다(관리자는 안내 화면에 오지 않고 제출 현황의 빈 명단 상자에서 링크를 본다 — StatusTab.test 471 이 지킨다). 추가: `emptyRoster: false` 면 `이 주에 볼 수 있는 화면이 없습니다` + 안내 줄, `‹ 이전 주` href `…?week=2026-11-09&tab=status`.
  - `page-kpi-visibility.test.tsx`: 제목을 'KPI 는 내 보고서에서만'으로, application·pims·project 는 6장, status·settings 는 view 에 `kpis: null`(로더가 안 읽는다)을 주고 0장.
  - `params.test.ts`: `parseTab` describe 를 지운다.
  - `page-subtabs.test.tsx`: `viewFor` 기본값에 `roles: ["report"]`·`statusAccess: null` 을 더하고, WeekHeader 목을 `WeekHeader: (p: { writerPicker: unknown; week: unknown }) => <div data-testid="week-header" data-picker={p.writerPicker === null ? "none" : "shown"} data-week={JSON.stringify(p.week)} />` 로 바꾼다(T16 이 이 목을 그대로 쓴다). `data-week` 는 page 가 머리띠에 넘긴 객체를 화면에 드러내 RSC 로 가는 값을 단언하게 한다. 그리고 아래를 더한다 — 당번 총평 테스트는 T14 의 `headerWeekOf` 로 이미 초록인 가드다(page 가 행을 통째로 다시 넘기면 깨진다).

```tsx
// page-subtabs.test.tsx — 추가
it("작성자 선택 상자는 남의 보고서를 열 수 있는 사람에게만 — 일반 운영자 none, 당번·관리자(manage)·받는 사람(read) shown", async () => {
  for (const [statusAccess, want] of [[null, "none"], ["manage", "shown"], ["read", "shown"]] as const) {
    state.view = viewFor("application", false, { statusAccess });
    const { unmount } = await renderPage("application");
    expect(screen.getByTestId("week-header").dataset.picker).toBe(want);
    unmount();
  }
});
it("일반 운영자 화면에 당번 총평 문구가 없다 — 머리띠에는 세 칸만 넘어간다", async () => {
  state.view = viewFor("application", false, {
    week: { id: "w1", week_start: "2026-11-16", duty_email: null, status: "open", reported_at: null,
      summary_this: "총평금주문구", summary_next: "총평차주문구" },
  });
  const { container } = await renderPage("application");
  expect(JSON.parse(screen.getByTestId("week-header").dataset.week ?? "null"))
    .toEqual({ week_start: "2026-11-16", status: "open", reported_at: null });
  expect(container.innerHTML).not.toContain("총평금주문구");
  expect(container.innerHTML).not.toContain("총평차주문구");
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/load-access.test.ts src/features/ops-weekly/__tests__/settings-queries.test.ts src/app/dashboard/ops-weekly/__tests__/page-empty-roster.test.tsx src/app/dashboard/ops-weekly/__tests__/page-kpi-visibility.test.tsx src/app/dashboard/ops-weekly/__tests__/params.test.ts src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로. `_load.ts` 가 400줄을 넘으면 관리 데이터 읽기(`loadManageData`)를 같은 파일 안 함수로 뺀다.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/load-snapshot.test.ts --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 주간보고 열람 권한 — 권한 없는 데이터는 읽지 않고 안내 화면`

---

### Task 16: 역할 탭 줄 (구현: frontend-design-specialist)

**Files:**
- Modify: `page.tsx`, `_params.ts`(`buildTabs`·`TAB_LABEL` 삭제)
- Test: `__tests__/page-subtabs.test.tsx`, `__tests__/params.test.ts`

**Interfaces:**
- Consumes: `buildRoleTabs`·`roleTabOf`(T2), `view.roles`(T15 — `report` 는 본인이 명단에 있을 때만 들어 있다), `PageTabs`
- Produces:
  - `page.tsx` `WeekView`: 맨 위(주 머리띠 앞)에 `view.roles.length > 1` 일 때만 `<PageTabs active={op !== null ? "status" : roleTabOf(tab)} size="md" className="px-5 pt-4 lg:px-7" tabs={buildRoleTabs({ weekStart, roles: view.roles })} />`. 지금 KPI 아래의 `pt-1`/`pt-4` 래퍼와 영역 탭용 `buildTabs` 호출을 지운다. `TAB_TITLE` 의 `pims`→`AREA_TAB_LABEL.pims`(`합격자 발표` — 컨트롤러 판정 (b)), `settings`→`관리`
  - `_params.ts`: `buildTabs`·`TAB_LABEL` 을 지운다. 그 뒤 `AREA_LABEL` import 는 `AREA_TAB_LABEL` 에서만 쓴다

- [ ] **Step 1: 실패하는 테스트를 쓴다.** page-subtabs.test 의 `PageTabs` 목을 `PageTabs: ({ tabs, active }) => <nav data-testid="page-tabs" data-active={active}>{tabs.map((t) => <a key={t.key} href={t.href}>{t.label}</a>)}</nav>` 로 바꾼다. WeekHeader 목은 T15 가 바꾼 것(`<div data-testid="week-header" data-picker=… data-week=… />`)을 그대로 쓴다. 'KPI 바가 있으면 탭 줄 위 간격은 pt-1, 없으면 pt-4'(187) 는 지운다. params.test 의 `buildTabs` describe 둘과 '탭 이동 링크(buildTabs)는 sub 를 들고 가지 않는다'는 지운다(`buildRoleTabs` 테스트가 대신한다).

```tsx
it("일반 운영자(역할 하나)에게는 역할 탭 줄이 없다", async () => {
  state.view = viewFor("application", false, { roles: ["report"] });
  await renderPage("application");
  expect(screen.queryByTestId("page-tabs")).toBeNull();
});
it("작성자 관리자: 내 보고서·제출 현황·관리, 머리띠 위", async () => {
  state.view = viewFor("application", true, { roles: ["report", "status", "manage"] });
  await renderPage("application");
  const nav = screen.getByTestId("page-tabs");
  expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["내 보고서", "제출 현황", "관리"]);
  expect(nav.dataset.active).toBe("report");
  expect(nav.compareDocumentPosition(screen.getByTestId("week-header")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it("남의 보고서를 볼 때는 제출 현황이 켜져 보인다", async () => {
  state.view = viewFor("application", false, {
    roles: ["report", "status"],
    writers: [{ email: "a@example.com", name: "홍길동" }, { email: "b@example.com", name: "김철수" }],
    viewed: { email: "b@example.com", name: "김철수" },
  });
  await renderPage("application");
  expect(screen.getByTestId("page-tabs").dataset.active).toBe("status");
});
it("명단 밖 관리자가 ?op=작성자 로 열면 탭은 제출 현황·관리 둘이고 제출 현황이 켜져 있다", async () => {
  // roles 는 로더 몫이다(T15 load-access 의 같은 경우). 여기서는 그 roles 로 줄을 그리고 켜는 것만 본다
  state.view = viewFor("application", true, {
    actor: { email: "z@example.com", isAdmin: true },
    roles: ["status", "manage"],
    statusAccess: "manage",
    viewed: { email: "a@example.com", name: "홍길동" },
  });
  await renderPage("application");
  const nav = screen.getByTestId("page-tabs");
  expect(within(nav).getAllByRole("link").map((a) => a.textContent)).toEqual(["제출 현황", "관리"]);
  expect(nav.dataset.active).toBe("status");
});
```

- [ ] **Step 2: 실패를 확인한다.** `npm test -- src/app/dashboard/ops-weekly/__tests__/page-subtabs.test.tsx src/app/dashboard/ops-weekly/__tests__/params.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** Interfaces 그대로.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npm test -- src/app/dashboard/ops-weekly/__tests__/page-kpi-visibility.test.tsx src/app/dashboard/ops-weekly/__tests__/page-empty-roster.test.tsx --maxWorkers=1` → 0 failed.
- [ ] **Step 5: Commit** — `feat: 주간보고 역할 탭(내 보고서·제출 현황·관리)`

---

### Task 17: CLAUDE.md 와 최종 검증

**Files:**
- Modify: `CLAUDE.md`(`## /dashboard/ops-weekly — 운영부 주간업무보고` 절)

- [ ] **Step 1: CLAUDE.md 를 고친다.** 그 절의 문단 단위로, 지금 문장은 사실이 바뀐 곳만 고친다.
  - 새 문단(화면): 역할 탭 셋 — 내 보고서(작성 대상)·제출 현황(그 주 당번·관리자, 받는 사람은 보고 끝난 주만 읽기)·관리(관리자). 탭이 하나면 줄이 없다. 주소 어휘는 그대로(`tab` 이 역할을 정한다), 새 파라미터는 `section` 하나. 내 보고서는 lg 이상 '볼 것 | 쓸 것' 두 칸, lg 미만은 [목록 | 쓰기]. 프로젝트·TF 는 요약 카드 → 넓은 서랍(`tab=project|tf` 로 들어오면 열린 채). 영역·하위 칸·관리 메뉴는 replaceState 로 바꾸고 전부 마운트해 `hidden` 으로 숨긴다 — 입력·저장 대기를 지키는 장치라 언마운트로 바꾸지 말 것
  - 새 문단(열람): 남의 보고서는 그 주 당번·관리자·보고 끝난 주의 받는 사람만 연다(`pickViewed`) — 머리띠의 작성자 선택 상자도 이 셋에게만 보인다. 권한 없는 탭의 데이터는 서버가 읽지 않는다. 받는 사람 판정은 service role 로 본인 하나만. 이어서 그대로: **열람 제한은 화면 정리다. 보안 경계가 아니다.** 주간보고 표의 select 정책이 `using (true)` 라 로그인한 사람은 브라우저에서 DB 를 직접 읽을 수 있다. 같은 부서의 업무 보고라 정책은 그대로 둔다
  - 고칠 문장: '원서접수·PIMS 는 칸별 하위 탭' → '원서접수·합격자 발표는 …'(하위 탭 줄 id 가 영역별 `ops-subtabs-{영역}` 이라는 것 포함), '상단 KPI 줄은 lg 이상에서만 고정된다' 문단에 'KPI 는 내 보고서에서만 보이고, 쓸 것 패널은 `--ops-kpi-h` 만큼 비켜 붙는다' 한 줄, 관리자 정정 문장에 '정정·당번 지정은 관리 탭에서만'
- [ ] **Step 2: 영향 범위 테스트를 순서대로 돈다**(한 번에 하나, 앞이 끝난 뒤 다음).
  - `npm test -- src/app/dashboard/ops-weekly --maxWorkers=1`
  - `npm test -- src/features/ops-weekly --maxWorkers=1`
  - `npm test -- src/components/common --maxWorkers=1`(레포 전역 표준 가드가 여기 있다)
  - `npm test -- src/app/dashboard/_data/__tests__/ops-weekly-menu.test.ts --maxWorkers=1`
  - 기대: 각 0 failed. 실패하면 그 태스크로 돌아가 고친다(여기서 땜질하지 않는다)
- [ ] **Step 3: 타입·린트.** `npm run typecheck; echo exit=$?` → `exit=0`(next-env 에러면 먼저 `npx next typegen`). `npm run lint; echo exit=$?` → `exit=0`.
- [ ] **Step 4: 디자인 감사.** `/design-audit` 를 `src/app/dashboard/ops-weekly` 와 `src/components/common/SectionMenuLayout.tsx` 에 돌려 위반 0. 하드코딩 색·버튼 약한 호버(`hover:bg-washi`)·`font-mono` 숫자·`Intl.DateTimeFormat` 직접 호출이 없어야 한다.
- [ ] **Step 5: Commit** — `docs: 주간업무보고 역할별 화면 — CLAUDE.md`
- [ ] **Step 6: 사용자 확인(PR 프리뷰)** — 실행자가 하지 않는다. PR 본문 Test plan 에 체크 항목으로 남긴다.
  - 390 / 768 / 1280 폭: 두 칸이 쌓이지 않고 [목록 | 쓰기] 로 바뀐다(768 포함), 서랍이 좁은 화면에서 전체 폭 + 딤, 관리 메뉴가 md 미만에서 위 가로 줄
  - 1280×800: 쓸 것 패널을 끝까지 내려 `제출완료` 에 닿는다(RF5), 패널이 KPI 줄 밑에 깔리지 않는다
  - 역할별(spec §9): 일반 운영자 탭 줄·작성자 선택 상자 없음·`?tab=status`·`?tab=settings`·`?op=남` 이 본인 보고서 / 당번 두 탭·[보기]·작성자 선택 상자로 다음 보고서 / 관리자 세 탭·메뉴 일곱·전체 현황 작업 칸 / 받는 사람 보고된 주 읽기 전용·열린 주 안내 / 역할 없는 사람 안내
  - 영역 전환·서랍 여닫기·[목록 | 쓰기] 뒤 쓰던 글과 저장 대기가 남는다

---

## Self-Review 결과

- **spec 대조**: §2 목표 1–7 → T16·T15(1), T9·T10(2), T11(3), T7(4), T6·T3·T4(5), T15·T14(6 — 넘기지 않는 것에 머리띠 객체 포함), T9(7). §4 실패 목록 → 입력 유실 T9·T11·T13 RF2 / 주소 조작 T15 / RSC 유출 T15(읽지 않음)·T14·T7(행을 통째로 넘기지 않음) / 받는 사람 버튼 T7 / 볼 화면 없음 T15 / 관리자 버튼 T7 / 패널 길이 T9 RF5 / 기존 주소 T2·T11·T12 / 좁은 화면 T9 / 제출 두 곳 T14. §6.1 명단 밖 사람의 내 보고서 탭 없음 T15(`roles`)·T16. §6.5 UnmatchedNotice 링크 T6, 공통 컴포넌트 T5. §6.7 `?op` 판정 자리 `pickViewed` 하나 T15, 한계 문서화 T17. §8 빌더 몫은 위 '계획에서 정한 것' 표.
- **이름 일관성**: `statusAccess`·`StatusAccess`(T1) ↔ `TabAccess.status`(T2) ↔ `view.statusAccess`(T15). `useOpsQueryValue`·`replaceOpsQuery`(T6) ↔ T8·T11. `ReportLayout`·`WritePanel`(T9) ↔ `ReportView`(T10). `WritePanel` 슬롯 `notes`(T10)·`projects`(T11)·`directAdd`(T13)·`submit`(T14). `ReportView`(T10) ↔ T11·T13·T14. `hideHeading`(T11, ProjectTab ↔ ReportView). `subTabsIdOf`(T12). `manageHref`(T2) ↔ T6·T7·T10·T11. `HeaderWeek`·`headerWeekOf`(T14) ↔ T15(페이지 가드). `writerPicker`(T14) ↔ T15(조건). `roles`(T15) ↔ T16. `AREA_TAB_LABEL`(T2) ↔ T8·T10·T16.
- **남은 판단**: 위 표 밖에서 실행자가 정할 것은 없다. 구현자 확인 항목은 각 태스크 Step 1 에 적었다.

