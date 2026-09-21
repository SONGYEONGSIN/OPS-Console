---
share: true
status: 초안
updated: 2026-09-21
revision: 1
---

# 관리 > 업무배정 — 결정하는 화면을 결정하는 자리에 둔다

> 선행 설계: `docs/superpowers/specs/2026-09-12-work-assignment-design.md` (PR1~PR7 머지 완료).
> 그 문서가 **원장을 만들었고**, 이 문서는 **그 원장을 쓰는 메뉴를 제자리에 놓는다.**

**질문**: 배분현황과 제안은 왜 총괄장 안에 있으면 안 되고, 옮긴 자리에서 무엇을 더 해야 하는가.
**날짜**: 2026-09-21

---

## 1. 한 줄 결론

**배분현황·제안을 `/dashboard/work-assignment` 로 옮기면 권한 가드가 코드에서 사라진다.** 지금 `assignments/page.tsx` 는 탭마다 admin 여부를 다시 판정하는데(`ADMIN_TABS` + `univ` 로 떨어뜨리기), `work-assignment` 는 이미 `ADMIN_ONLY_MENU_SLUGS` 에 있어 `requireMenu` 한 줄이 라우트 전체를 막는다. 옮기는 것이 곧 가드를 구조로 바꾸는 일이다.

---

## 2. 왜 지금 틀렸나

### 2.1 메뉴는 등록돼 있고 라우트가 없다

`src/app/dashboard/_data.ts:465` 에 `label: "업무배정" · slug: "work-assignment" · adminOnly: true` 가 있고 `_data/sidebar-helpers.ts:129` 의 `ADMIN_ONLY_MENU_SLUGS` 에도 있다. 그런데 `src/app/dashboard/work-assignment/` 디렉터리가 없다 — **admin 이 사이드바에서 누르면 404 다**(PR #788 `ff7dc8d2` 이후).

`_data/page-meta-config.ts` 의 `PAGE_META` 에도 `work-assignment` 항목이 없다. 없으면 `[slug]/page.tsx` 의 사이드바 라벨 fallback 으로 가는데, 우리는 전용 `page.tsx` 를 쓰므로 항목을 넣어야 머리말이 나온다.

### 2.2 권한 판정이 두 벌이다

`assignments/page.tsx:71` 의 `ADMIN_TABS = new Set(["workload","proposals"])` 와 `:124` 의 `ADMIN_TABS.has(requested) && !isAdmin ? "univ" : requested` 가 **메뉴 가드가 못 하는 일을 페이지가 손으로 한다.** 탭이 URL 이라 목록에서 빼는 것만으로는 안 되고, 그래서 떨어뜨리기가 필요했다.

옮기면 `canViewMenu("work-assignment", me)` 가 비-admin 을 `/dashboard` 로 돌려보낸다(`features/auth/permission.ts:44`). 탭 판정도, 탭 필터링도, `ADMIN_TABS` 도 사라진다. **가드를 지우는 변경이지 옮기기만 하는 변경이 아니다.**

### 2.3 자동 제안이 업무 흐름과 어긋난다

실제 흐름은 **2월 업무 종료 → 3월 연간 배정 → 중간 신규는 건건히 → 이후 모니터링** 이다. 2027학년도는 이미 배정이 끝났다(원장 1,858행).

그런데 `assignment-year-rollover` 는 `cadence: "daily"` 다. 선행 설계 §6.4 가 daily 를 고른 근거는 *"연 1회 잡을 `cadence` 에 담을 값이 없다 — `manual` 로 두면 판정 대상에서 빠져 3월 1일에 안 돌아도 아무도 모른다"* 였다. 그 근거는 **자동으로 도는 것이 목표일 때** 성립한다. 사용자가 연간 배정을 화면 버튼으로 시작하기로 한 이상 "안 돌아도 모른다" 는 위험이 아니다 — **누르지 않으면 안 도는 것이 정의다.** cron 등록은 이미 삭제됐다.

---

## 3. 확정 입력 (조사 대상 아님)

| # | 사용자가 준 것 |
|---|---|
| 1 | 배분현황·제안은 관리 > 업무배정으로 간다. 그 메뉴는 등록돼 있고 라우트만 없다 |
| 2 | `assignment-year-rollover` 는 수동 전용으로 바꾼다. cron 은 이미 지웠다 |
| 3 | 배분현황이 기본 탭이고 모니터링이다. 건수 원천이 연도별로 갈린다 — 2026학년도 `services`(2,511건/313곳), 2027학년도 `closing_services`(983건/286곳). 교차 실측: 2026학년도 `closing_services` 2건 · 2027학년도 `services` 0건 |
| 4 | 백업자 = 퇴사 승계용 상시 담당. `backup_requests`(휴가 건별 메일 이력) 재사용 불가 |
| 5 | 제안 화면에 대학별 건수. Moa 접수건수 스크래퍼는 별도 PR, 화면 자리만 잡는다 |
| 6 | 신규 서비스 화면이 답할 것 넷 — 어느 시트 · 언제 시작 · 어느 그룹 · 그 그룹이 가능한가 |
| 7 | `담당자 변경` 칼럼(`변경 O` 44건)을 파서가 읽는다. 원장 저장 여부는 이 설계가 판단 |
| 8 | 프로세스는 화면의 버튼으로 보인다 — 배경 크론이 아니라 |

---

## 4. 코드 실측으로 확인한 것

| 확인 | 근거 |
|---|---|
| 배분현황·제안 컴포넌트는 **이미 분리돼 있다** | `assignments/WorkloadTable.tsx` · `ProposalPanel.tsx` · `ProposalDecision.tsx` 가 각자 파일이고 데이터는 `page.tsx` 가 읽어 props 로 넘긴다. 이동이 재작성이 아니다 |
| 원장에 **쓰는 경로가 없다**(이관 철거됨) | `features/assignments/actions.ts` 의 export 는 `reconcileAssignments`(읽기 전용) · `updateAssignment` · `revertChange` 셋뿐. `importAssignments` 는 PR4a 에서 걷혔다 |
| 파서는 **2027 블록만** 원장으로 보낸다 | `import.ts:92` — *"원서접수의 `subtypes` 는 파서가 2027 블록만 담으므로 2026 칸은 여기로 오지 않는다"* |
| `services` 는 `closing_services` 와 **같은 모양**이다 | `20260520_services_table.sql:18-27` — `university_name` · `category` · `write_start_at` · `write_end_at` 가 전부 있다. `workload-sources.ts` 의 `ClosingRow` 를 그대로 만족한다 |
| `services` 에만 **담당자 FK 가 있다** | `operator_email text references operators(email)` + `operator_name` 스냅샷. `closing_services` 는 `operator_name` 텍스트뿐(낡은 미러) |
| `assignment_changes.source` 에 **check 가 없다** | `20260913_assignments_tables.sql:64` — `source text not null` 이고 `import\|manual\|proposal\|revert` 는 주석이다. 새 값에 마이그레이션이 필요 없다 |
| `assignment_proposal_batches.kind` 에는 **check 가 있다** | 같은 파일 `:95` — `check (kind in ('annual','single'))`. 인라인이라 제약 이름은 `assignment_proposal_batches_kind_check` |
| 연간 배치는 **학년도당 pending 1건** | 같은 파일 `:152` 부분 unique 인덱스 (`where kind='annual' and status='pending'`) |
| `is_admin()` 은 **`(select …)` 로 감싼다** | 같은 파일 `:181` 주석 — 맨 호출 696.6ms vs 감싼 호출 0.3ms(6,000행 실측) |
| `manual` cadence 는 **미실행 판정에서 빠진다** | `features/automations/digest.ts:38` `STALE_AFTER_HOURS.manual = null` → `isStale` 이 `false` 고정. `manualOnly` 는 `off`(자동 실행 꺼짐) 보고도 막는다(`:101`) |
| 자동화 잡은 **조직도 1행과 1:1** | `features/agent-org/__tests__/registry.test.ts` — `missing`·`duplicated` 둘 다 `[]` 를 단언. 잡을 추가·삭제하지 않으므로 이 설계는 조직도를 안 건드린다 |
| `<table>` 이 있는 파일의 첫 `<header>` 는 `mb-4` | `src/__tests__/list-heading-gap.test.ts`. `EXEMPT` 에 `ProposalPanel.tsx` 가 있다 |
| `workloadWindows(now: Date)` 는 **아무 날짜나 받는다** | `workload-sources.ts:108`. 주·월은 그 날짜 기준, 연은 `academicYearRangeKST(그 날짜)` |

마지막 줄이 요구 6-④ 의 답이다 — **새 서비스가 도는 주를 판정하려고 새 함수를 만들 필요가 없다.**

---

## 5. 라우트·탭·권한 경계

### 5.1 가르는 선

**총괄장은 사실이고, 업무배정은 결정이다.**

- 누가 무엇을 맡고 있는가 → 전원이 조회한다(오늘 총괄장 파일이 그렇다). 원장 select RLS 가 `using (true)` 인 것도 같은 판단이다.
- 누구에게 얼마나 줄 것인가 → 남의 업무량을 견주고 원장을 바꾸는 일이라 admin 이다. 선행 설계 열린 질문 2 가 2026-09-17 에 그렇게 닫혔다.

| 메뉴 | slug | 가드 | 탭 |
|---|---|---|---|
| 서비스 그룹 > 서비스사이클 > 총괄장 | `assignments` | `requireMenu` (전원) | 대학배정 · 업무분장 · 가격정책 |
| 관리 > 업무배정 | `work-assignment` | `requireMenu` + `ADMIN_ONLY_MENU_SLUGS` (admin) | **배분현황**(기본) · 신규배정 · 제안 · 백업자 |

### 5.2 "배분현황을 전원에게 열어야 하는가" — 아니다, 그리고 옮기는 것이 그 결정을 싸게 만든다

지금은 전원 열람 메뉴 안에 admin 탭이 얹혀 있어 **탭마다 판정이 필요하다.** 옮기면 가드가 라우트 하나로 모이고, `assignments/page.tsx` 에서 `ADMIN_TABS`·`isAdmin`·탭 필터가 통째로 빠진다.

열자는 요구가 나중에 생기면 **이 표를 여는 것이 답이 아니다.** 여기에는 그룹 목표 대비 편차가 있어 "누가 덜 일한다" 로 읽힌다. 본인 부하만 필요하면 `my-todo` 나 대시보드에 **본인 한 줄짜리 카드**를 두는 것이 맞다 — 같은 수치를 견줌 없이 보여준다. 이 설계 범위 밖이고 열린 질문 5 로 남긴다.

### 5.3 `page-meta-config.ts` 항목

```ts
  "work-assignment": {
    headline: { accent: "관리", title: "업무배정" },
    description:
      "운영자별 배분현황을 보고, 새 서비스와 연간 배정을 제안으로 만들고, 대학별 백업자를 관리합니다.",
  },
```

`accent` 는 사이드바 상위 묶음 이름이다(`assignments` 가 그룹 라벨인 `서비스사이클` 을 쓴다). `work-assignment` 는 섹션 직속 항목이라 섹션 제목 `관리` 를 쓴다.

---

## 6. 화면

### 6.0 공통

- 헤더 액션은 `components/common/HeaderActionButton`(vermilion 하나뿐, 변형 없음).
- 건수·대학 수·밀도는 **기본 폰트 + `tabular-nums`**. `font-mono` 는 쓰지 않는다.
- 시각은 `@/lib/kst-format` 의 `kstFormat`. `Intl.DateTimeFormat("ko-KR", …)` 직접 호출 금지.
- 표가 있는 섹션의 첫 `<header>` 에 `mb-4`(`list-heading-gap` 가드).
- 목록 행 호버 `hover:bg-line-soft`, 선택 `border-vermilion bg-vermilion/10 text-vermilion`.

### 6.1 배분현황 (기본 탭)

**지금 있는 표를 그대로 옮기고, 학년도 선택을 얹는다.**

머리에 학년도 셀렉트(`components/common/ListSelect` 재사용, `?year=`). 기본값은 `BAEJUNG_CURRENT_YEAR`.

```
[학년도 ▾ 2027]                         배정 대상 15명 · 원장 1,858칸

1그룹1  목표 대학 17.0곳 · 밀도 5.2
  이름   그룹  경력      대학  건수  밀도  목표대비  주  월  연
  ...
```

원천이 학년도에 따라 갈린다. **두 칸이 동시에 바뀐다** — 건수만 바꾸면 2026학년도에 담당자가 전원 0곳이 된다(원장에 2026 행이 없다).

| 학년도 | 담당자 원천 | 건수·구간 원천 | 목표·편차 |
|---|---|---|---|
| 현재(2027) | `assignments` 원장 | `closing_services` | **낸다** |
| 과거(2026) | `services.operator_email` | `services` | **안 낸다** |

**과거 연도에 목표를 내지 않는 이유**: `operators.tenure_group` 은 **오늘의 값 하나뿐**이다. 작년 숫자에 오늘 그룹을 씌우면 그때 존재한 적 없는 목표가 나오고, 그 목표 대비 편차는 그냥 틀린 숫자다. 과거 열은 대학 수·건수·밀도·주·월만 보여주고 그룹은 묶음 이름으로만 쓴다.

**화면이 원천을 말한다.** 표 머리에 `건수 원천: 서비스마감(closing_services)` / `건수 원천: 서비스목록(services) — 담당자도 그쪽 기록입니다` 를 적는다. 같은 표 모양에 다른 표를 넣어 놓고 말 안 하면, 2,511 → 983 을 보고 물량이 60% 줄었다고 읽는다. 실제로는 원천이 바뀐 것이다.

**빈 상태 문구**
- 배정 대상 0명: `배정 대상이 0명입니다 — 조직 · 권한에서 배정 대상을 켜세요.`
- 그 학년도에 담당자 기록이 없음: `2026학년도는 담당자 기록이 없습니다 — 서비스목록(services)에 운영자 메일이 비어 있습니다.`
- 그룹 미설정자: 기존대로 `그룹 미설정` 묶음으로 표에 남긴다(빼지 않는다).

**상세 리스트**(요구 3): 운영자 행을 누르면 그 사람의 (대학 × 업무종류) 목록이 인스펙터로 열린다 — `대학 | 업무종류 | 하위유형 | 건수 | 접수기간`. `buildWorkload` 가 이미 `keys`(대학\|업무종류)를 들고 있으므로 집계 함수를 바꾸지 않고 같은 입력에서 행을 만들면 된다.

### 6.2 신규배정 탭 — 네 가지에 답한다

원장에 있지만 담당자가 없는 (대학 × 업무종류) + `closing_services` 에 새로 들어온 서비스.

| 열 | 값 | 어디서 |
|---|---|---|
| 대학 · 업무종류 | | 원장 / `closing_services` |
| **① 어느 시트** | `02. 배정리스트` … | `work_kind` → 시트명 고정 표 (`SHEET_NAMES` 와 같은 어휘) |
| **② 언제 시작** | `2026-11-03 09:00` | `closing_services.write_start_at`, `kstFormat` |
| **③ 어느 그룹** | `[배정 요청]` 버튼 | 단건 판정 요청 적재 |
| **④ 가능한가** | 후보별 `주 3건 · 월 11건` | `buildWorkload` 를 **그 서비스 시작일 기준 창**으로 한 번 더 부른다 |

**④ 가 이 탭의 핵심이고, 코드를 거의 안 만든다.** `workloadWindows(new Date(service.write_start_at))` 를 넘기면 주·월 창이 그 서비스가 도는 시점으로 옮겨간다. 지금 주의 한가함을 근거로 12월 서비스를 얹으면 12월에 몰린다 — **"지금 여유 있나" 가 아니라 "그때 여유 있나" 를 묻는 화면이다.**

버튼은 `[배정 요청]` 하나. 누르면 `enqueueProposeRequest(me.email, { academicYear, kind: "single", universityName, workKind })` 가 돌고, 이미 같은 판정이 대기 중이면 그렇게 말한다(`EnqueueProposeResult.skipped`).

**빈 상태**: `새로 들어온 서비스가 없습니다 — 원장의 모든 대학에 담당자가 있습니다.`
**연결 안 됨**: 이름은 있고 메일이 없는 칸은 목록에 `연결 안 됨` 배지로 두되 **요청 버튼을 주지 않는다.** 고칠 것은 주소이지 배정이 아니다(선행 설계 F2).

### 6.3 제안 탭

`ProposalPanel` · `ProposalDecision` 을 그대로 옮긴다. 더하는 것 둘.

**(1) 헤더에 `[연간 제안 만들기]`**(admin). 선행 설계는 이 행위를 cron 에 뒀는데 요구 8 이 화면으로 옮긴다. **버튼이 `runAssignmentYearRollover` 와 같은 코어를 부른다** — 별도 enqueue 를 새로 쓰면 그 잡이 하는 두 가지(원장 비어 있으면 적재 안 함 · 연차 그룹이 작년 배치와 같으면 상기)를 버튼만 빼먹는다.

상기 문구는 **버튼의 반환값으로 화면에 띄운다**:

```
연차 그룹이 2026학년도 배치와 동일합니다 — 3월 갱신을 확인하세요.
```

배경 Teams 메시지보다 이 자리가 낫다. 연간 제안을 만들려는 바로 그 순간에 뜬다.

**(2) 대학별 건수 열**. 지금 있는 것으로 먼저 채운다 — `buildServiceCounts` 가 만드는 `대학|업무종류 → 건수`(서비스 건수)다. 열 머리에 원천을 적는다: `서비스 건수 (서비스마감 기준)`.

**Moa 접수건수는 이 PR 이 아니다.** 요구 5 의 `Statistics/RealTime` 은 DB 칼럼도 스크래퍼도 없고, 선행 설계 결정 2 가 *"물량 스크래퍼를 만들지 않는다"* 였다. 그 결정을 뒤집는 것이라면 별도 설계가 필요하다(열린 질문 2). 지금은 **열을 하나 더 두고 비워 둔다** — `접수건수 —`, 툴팁 `Moa 실시간 통계 연동 전입니다`. 자리를 잡아 두면 나중에 붙이는 PR 이 화면을 안 건드린다.

**빈 상태**: `제안 배치가 없습니다 — [연간 제안 만들기]를 누르면 판정 요청이 회사 PC로 갑니다.`

### 6.4 백업자 탭

원장의 (대학 × 업무종류)를 왼쪽에, 백업자를 오른쪽에 둔다.

```
대학          업무종류   담당자      백업자          지정일
가천대        원서접수   한효진      김슬기          2026-09-21
강원대        원서접수   윤지혜      —  [지정]
```

- `[지정]` → 인스펙터에서 후보(`status='active'`) 중 고른다. 담당자 본인은 후보에서 뺀다 — 자기 자신을 대신 볼 수는 없다.
- 헤더에 `[퇴사 승계]`(admin). 운영자를 고르면 그 사람이 담당인 칸 전부를 훑어 **제안 배치**를 만든다(§7.2).

**빈 상태**: `백업자가 지정된 대학이 없습니다. 담당자가 공백일 때 대신 볼 사람을 미리 정해 두면, 퇴사 승계가 한 번에 됩니다.`
**승계 대상 중 백업자가 없는 칸**: `백업자 미지정 N곳 — 이 칸은 승계 제안에 담기지 않습니다.` 승계를 눌렀을 때 이 숫자가 크면 그게 곧 "먼저 백업자를 채워라" 다.

---

## 7. 스키마

### 7.1 백업자 테이블

`assignments` 에 칸을 더하지 않는다. 원장의 자연키는 `(학년도, 대학, 업무종류, 하위유형, 역할)` 인데 백업자는 **하위유형·역할이 없는 값**이라, 원장에 두면 원서접수 한 대학에 같은 백업자가 5~6행 복제되고 그중 하나만 고치면 화면이 어느 값을 보여줄지 알 수 없다.

`role='백업'` 으로 원장에 넣는 안도 버린다. `role` 에 `check (role in ('운영','개발'))` 이 걸려 있어 마이그레이션이 필요하고, 더 나쁜 것은 **백업자가 배정으로 세어진다는 점**이다 — `buildWorkload` 는 `assignee_email` 이 있는 칸을 전부 담당으로 세므로 백업자가 붙은 사람의 대학 수·건수가 부풀고, 제안 게이트가 그 값을 근거로 판정한다. `parse.ts` 의 `isBackupLabel` 이 방금 막은 바로 그 오염이다.

```sql
-- supabase/migrations/20260921_assignment_backups.sql
-- 백업자 — '이 대학의 이 업무를 대신 볼 사람'. **배정이 아니다.**
-- 설계: docs/superpowers/specs/2026-09-21-work-assignment-menu-design.md
--
-- 원장(assignments)에 칸을 더하지 않는 이유는 단위가 다르기 때문이다. 원장의
-- 자연키에는 하위유형·역할이 들어가는데 백업자에는 그 둘이 없다 — 원장에 두면
-- 같은 값이 대학마다 5~6행 복제되고, 그중 한 행만 고쳤을 때 어느 값이 맞는지
-- 알 수 없다. 그리고 `buildWorkload` 가 `assignee_email` 있는 칸을 전부 담당으로
-- 세므로, 원장 행이 되는 순간 백업자가 부하로 계산된다.

begin;

create table if not exists public.assignment_backups (
  id              uuid primary key default gen_random_uuid(),
  academic_year   smallint not null,
  university_name text not null,
  work_kind       text not null,             -- ServiceKind (원장과 같은 어휘)
  -- 백업자는 **명부에 있어야 한다.** 이름만 있는 백업자는 승계에 쓸 수 없다 —
  -- 승계가 원장에 쓰는 값이 이메일이기 때문이다(assignment_changes 의 단위).
  --
  -- on delete cascade 인 이유: 퇴사의 정상 경로는 `status='inactive'` 이고 행은
  -- 남는다. 명부에서 **행을 지우는** 것은 오기입 정정 같은 드문 경우라, 그때는
  -- 그 사람을 가리키던 백업 지정도 같이 사라지는 것이 맞다.
  backup_email    text not null references public.operators(email)
                    on update cascade on delete cascade,
  backup_name     text not null default '',  -- 표시용 스냅샷
  note            text,
  updated_by      text,                      -- 마지막으로 지정한 사람
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 한 칸에 백업자는 하나다. 자연키는 원장보다 **짧다**(하위유형·역할이 없다).
create unique index if not exists assignment_backups_natural_key
  on public.assignment_backups (academic_year, university_name, work_kind);

-- '이 사람이 백업인 대학' — 퇴사 승계가 이 방향으로 읽는다.
create index if not exists assignment_backups_person_idx
  on public.assignment_backups (backup_email, academic_year);

drop trigger if exists assignment_backups_set_updated_at on public.assignment_backups;
create trigger assignment_backups_set_updated_at
before update on public.assignment_backups
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS · GRANT
-- ─────────────────────────────────────────────────────────────

alter table public.assignment_backups enable row level security;

-- ⚠️ `is_admin()` 을 `(select ...)` 로 감싼다 — 맨 호출은 qual 에 컬럼 참조가
--    없어도 행마다 평가된다(같은 마이그레이션 세트의 제안 정책과 같은 이유).
drop policy if exists "assignment_backups_admin_select" on public.assignment_backups;
create policy "assignment_backups_admin_select"
  on public.assignment_backups for select
  to authenticated
  using ((select public.is_admin()));

-- 쓰기 정책은 두지 않는다. server action 이 service_role 로만 쓴다.

grant select on public.assignment_backups to authenticated;
grant all    on public.assignment_backups to service_role;

-- 새 테이블은 스키마 캐시를 갱신하지 않으면 조회에 안 보인다. **commit 앞이다.**
notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.assignment_backups;                       -- 기대 0 (빈 채로 시작)
-- insert into public.assignment_backups
--   (academic_year, university_name, work_kind, backup_email, backup_name)
--   values (2027, '테스트대', '원서접수', '<명부에 있는 메일>', '테스트');
-- insert into public.assignment_backups
--   (academic_year, university_name, work_kind, backup_email, backup_name)
--   values (2027, '테스트대', '원서접수', '<같은 메일>', '테스트');  -- ERROR 23505 ← 자연키
-- delete from public.assignment_backups where university_name = '테스트대';  -- 정리
```

**비워 둔 채로 시작한다.** 시트의 2026 블록 백업자 칸(`[29]`)에 22행이 있지만 작년 값이고, 원장에 쓰는 이관 경로는 PR4a 에서 걷혔다. 되살려 22행을 넣는 것은 이 기능의 첫날에 할 일이 아니다 — 열린 질문 3.

### 7.2 승계를 위한 `kind` 확장

승계는 **원장을 직접 바꾸지 않고 제안 배치를 만든다.**

직접 쓰는 안을 버린 이유: 퇴사 승계는 한 번에 수십 칸을 옮기는 일인데, PostgREST 에는 호출 사이 트랜잭션이 없어 중간에 끊기면 절반만 넘어간다. 그리고 되돌릴 때 `assignment_changes` 를 칸마다 하나씩 되돌려야 해서 **사고를 통째로 수습할 단위가 없다.** 제안 배치에는 그 단위가 이미 있고(전체 적용 / 반려 / `partial`), 경합 검사(`prev_assignee` 대조)도 붙어 있다.

```sql
-- supabase/migrations/20260921b_proposal_kind_succession.sql
-- 퇴사 승계 배치 — 연간도 단건도 아니다. 배치 단위 적용·반려가 필요해서
-- 제안 파이프라인을 그대로 쓴다(설계 §7.2).
--
-- `assignment_proposal_batches.kind` 는 인라인 check 라 제약 이름이
-- `{테이블}_{컬럼}_check` 로 자동 생성돼 있다.

begin;

alter table public.assignment_proposal_batches
  drop constraint if exists assignment_proposal_batches_kind_check;

alter table public.assignment_proposal_batches
  add constraint assignment_proposal_batches_kind_check
  check (kind in ('annual', 'single', 'succession'));

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- insert into public.assignment_proposal_batches (academic_year, kind, requested_by)
--   values (2027, 'succession', 'test@example.com');                 -- 성공해야 한다
-- insert into public.assignment_proposal_batches (academic_year, kind, requested_by)
--   values (2027, 'bogus', 'test@example.com');                      -- ERROR 23514
-- delete from public.assignment_proposal_batches where requested_by = 'test@example.com';
```

`assignment_changes.source` 에는 check 가 없으므로(`:64` 는 주석이다) 승계 적용이 남기는 `source='succession'` 은 마이그레이션 없이 들어간다. 되돌리기는 기존 `revertChange` 가 그대로 받는다.

### 7.3 `담당자 변경` 칸 — **원장에 넣지 않는다**

마이그레이션 불필요. 근거 셋.

1. **채울 경로가 없다.** 원장에 시트 값을 쓰는 유일한 길이던 `importAssignments` 는 PR4a 에서 걷혔고, 그 철거의 근거(*"자연키 upsert 라 시트에 있는 모든 칸을 시트 값으로 되돌린다"*)는 지금도 유효하다. 칼럼만 만들면 영원히 null 이다.

2. **저장하는 순간 거짓말이 된다.** `변경 O`/`변경 X` 는 **직전 학년도 대비**라는 비교의 결과다. 앱에서 담당자를 바꿔도 그 칸은 안 따라가므로, 방금 앱이 바꾼 대학이 `변경 X` 로 남는다. 조용하고 틀린 신호다.

3. **원장은 같은 질문에 더 좋은 답을 이미 갖고 있다.** 학년도가 행이라(선행 설계 §2 결정 3의 DB 표현) 두 해를 나란히 놓으면 변경 여부가 **파생된다** — 얼려 둘 이유가 없다.

대신 쓰임새 하나는 살린다. **읽기 전용 `대조` 에 한 줄을 더한다**: 시트가 `변경 O` 라고 적은 44건과, 시트의 2027·2026 블록이 실제로 다른 칸을 견줘 어긋나면 건수로 보고한다.

> **이 대조가 무엇을 증명하고 무엇을 증명하지 않는지 적어 둔다.** 양쪽 값이 **같은 02 시트에서 나오므로** 교차 원천 검증이 아니다 — 증명하는 것은 *시트 안에서 사람이 플래그를 빠뜨렸는가* 하나뿐이다. 원장과 시트가 갈렸는지는 기존 `reconcile` 이 본다. 같은 원천에서 나온 두 값을 대조하고 통과했다고 안심한 사고가 이 레포에 이미 있다(PIMS 접힘, PR #1193).

---

## 8. 잡 — `assignment-year-rollover` 를 수동 전용으로

```ts
// features/automations/registry.ts
{
  id: "assignment-year-rollover",
  label: "학년도 배정 요청",
  description: "…\n연간 배정은 3월에 한 번 하는 일이라 자동 스케줄이 없습니다. 업무배정 > 제안 탭의 [연간 제안 만들기]나 이 버튼을 눌러야 판정 요청이 적재됩니다.",
  scheduleInfo: "수동 실행 — 업무배정 > 제안 탭 또는 이 버튼 (cron 미등록)",
  cadence: "manual",
  cooldownMinutes: 60,
  manualOnly: true,
  run: runAssignmentYearRollover,
}
```

따라오는 결과 셋을 미리 적는다.

| 결과 | 어디서 | 괜찮은가 |
|---|---|---|
| 미실행 감지에서 빠진다 | `digest.ts:38` `STALE_AFTER_HOURS.manual = null` | **그게 목적이다.** 안 누르면 안 도는 것이 정의다 |
| 일일 보고에서 `off` 로 안 뜬다 | `digest.ts:101` `if (!enabled && !job.manualOnly)` | 자동화 페이지에 토글 대신 `수동 전용 (cron 없음)` 이 뜬다(`AutomationHub.tsx:156`) |
| **3월 갱신 상기가 배경에서 안 온다** | 그 문구를 rollover 가 붙였다 | 버튼을 누른 그 화면에 띄운다(§6.3) — 연간 제안을 만들려는 순간에 뜨므로 오히려 낫다 |

**`assignment-unassigned-sweep` 은 평일 자동으로 남긴다.** 새 서비스가 무주공산인 것을 알아채는 일은 사람이 매일 누를 일이 아니다. 단, **판정 요청 적재를 걷고 감지·보고만 남긴다**(요구 8: 프로세스는 버튼이다). 걷으면:

- 제안 탭이 아무도 요청하지 않은 단건 배치로 차지 않는다.
- 요청은 §6.2 의 `[배정 요청]` 버튼이 만든다 — 누가 왜 만들었는지가 `requested_by` 에 남는다.
- `SWEEP_MAX_ENQUEUE`(10) 상한과 그 상한이 만든 "다음 실행이 이어 간다" 로직이 함께 빠진다.

조직도(`agent-org/registry.ts`)는 **안 건드린다.** 잡을 추가하지도 삭제하지도 않으므로 `registry.test.ts` 의 1:1 단언은 그대로 통과한다. rollover 행의 주석에 `daily` 가 적혀 있으면 문구만 고친다.

---

## 9. 영향 파일

### 신규 (약 16)

| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260921_assignment_backups.sql` | 백업자 테이블 + RLS/GRANT |
| `supabase/migrations/20260921b_proposal_kind_succession.sql` | `kind` check 확장 |
| `src/app/dashboard/work-assignment/page.tsx` | 라우트 + 탭 4 |
| `src/app/dashboard/work-assignment/BackupPanel.tsx` | 백업자 탭 |
| `src/app/dashboard/work-assignment/NewAssignmentPanel.tsx` | 신규배정 탭 |
| `src/app/dashboard/work-assignment/AnnualProposalButton.tsx` | `[연간 제안 만들기]` |
| `src/features/assignments/backup-schemas.ts` | zod + 자연키 타입 |
| `src/features/assignments/backup-queries.ts` | 백업자 조회 |
| `src/features/assignments/backup-actions.ts` | 지정·해제 |
| `src/features/assignments/succession.ts` | 퇴사자 → 제안 줄 (순수) |
| `src/features/assignments/succession-actions.ts` | 승계 배치 적재 |
| `src/features/assignments/newcomers.ts` | 신규·미배정 + 시트명 + 시작일 (순수) |
| `src/features/assignments/newcomer-queries.ts` | 위 조회 |
| `src/features/assignments/propose-actions.ts` | `[배정 요청]`·`[연간 제안 만들기]` server action |
| `src/features/assignments/past-workload.ts` | 과거 학년도 담당 집계 (`services.operator_email`, 순수) |
| `__tests__/` 약 10 | 아래 RED |

### 이동 (6 — 내용 무변경)

`WorkloadTable.tsx` · `ProposalPanel.tsx` · `ProposalDecision.tsx` + 각 테스트 3건을 `assignments/` → `work-assignment/` 로.

### 수정 (약 10)

| 파일 | 변경 |
|---|---|
| `src/app/dashboard/assignments/page.tsx` | 탭 3개로 축소, `ADMIN_TABS`·`isAdmin` 분기 제거 |
| `src/app/dashboard/_data/page-meta-config.ts` | `work-assignment` 항목 1건 |
| `src/features/assignments/workload-queries.ts` | `loadWorkloadSources(academicYear)` + 원천 분기 |
| `src/features/assignments/workload.ts` | 상세 리스트용 행 노출(집계 로직 무변경) |
| `src/features/automations/registry.ts` | rollover `manual` + `manualOnly` |
| `src/features/automations/jobs/assignment-unassigned-sweep.ts` | 적재 제거, 감지·보고만 |
| `src/features/assignments/actions.ts` | `reconcileAssignments` 에 `담당자 변경` 대조 1항목 |
| `src/features/agent-org/registry.ts` | rollover 행 주석 문구 |
| `src/__tests__/list-heading-gap.test.ts` | `EXEMPT` 가 경로 기반이면 1줄(파일명 기반이면 무변경 — 구현 시 확인) |
| `CLAUDE.md` | '업무배정' 절 신설 |

**합계 약 48파일** → HARD-GATE **전체 설계 등급**(이 문서). DB 스키마 + 권한 경계 이동으로 복잡도 보정도 걸린다.

```
git worktree add ../OPS-Console-feat-work-assignment-menu feat/work-assignment-menu
```

---

## 10. PR 분해

```
PR-F (잡 수동) ──────────────────────────────── 독립
PR-A (라우트 이동) ─┬─ PR-B (연도별 원천)
                    ├─ PR-C (백업자) ─ PR-D (승계)
                    ├─ PR-E (신규배정) ─ PR-G (제안 건수)
                    └────────────────────────── PR-H (문서)
```

병렬 가능: **PR-F 는 언제든** · **PR-B / PR-C / PR-E 는 PR-A 뒤에 셋이 동시에**.

### PR-A — 라우트 신설 + 탭 이동 (11파일 · 간략 설계)

- **파일**: `work-assignment/page.tsx`(신규) · `page-meta-config.ts` · `assignments/page.tsx` · 이동 6 · `list-heading-gap.test.ts`(조건부) · tests 1
- **변경**: 배분현황·제안을 새 라우트로 옮기고, `assignments/page.tsx` 에서 `ADMIN_TABS`·`isAdmin`·탭 필터를 **지운다**. 새 페이지는 `requireMenu("work-assignment")` 하나로 가드한다. 데이터 읽기(`listLedgerRows`·`loadWorkloadSources`·`listProposalBatches`)는 그대로 옮긴다.
- **RED**:
  - `/dashboard/work-assignment` 에서 비-admin 이 `/dashboard` 로 리다이렉트된다 (`canViewMenu` 경유 — 페이지가 자체 판정하지 **않는 것**을 단언한다)
  - `/dashboard/assignments?tab=workload` 가 더 이상 배분현황을 그리지 않는다 (`univ` 로 떨어진다)
  - `assignments/page.tsx` 에 `ADMIN_TABS` 문자열이 없다 (가드 이중화 제거의 증거)
  - `PAGE_META["work-assignment"]` 가 있고 `resolvePageMeta` 가 사이드바 fallback 을 타지 않는다
  - 이동한 세 컴포넌트의 기존 테스트가 **내용 변경 없이** 통과한다
- **검증**: `npm test` · `npm run typecheck` · `npm run lint` · 화면에서 admin 으로 4탭 진입 + 비-admin 계정으로 주소 직접 입력 1회
- **의존**: 없음

### PR-B — 배분현황 학년도 선택 + 연도별 원천 (9파일 · 간략 설계)

- **선행 확인(코드 전)**: `select count(*) filter (where operator_email is not null) as linked, count(*) from public.services where write_start_at >= '2025-03-01T00:01:00+09:00' and write_start_at <= '2026-02-28T23:59:00+09:00';` — `linked` 가 0 에 가까우면 과거 연도는 `operator_name` 텍스트 대조밖에 없고, 그건 다른 설계다(열린 질문 1).
- **파일**: `workload-queries.ts` · `past-workload.ts`(신규) · `workload.ts` · `work-assignment/page.tsx` · `WorkloadTable.tsx` · tests 4
- **RED**:
  - `loadWorkloadSources(2027)` 이 `closing_services` 를 읽고 `loadWorkloadSources(2026)` 이 `services` 를 읽는다 (테이블 이름을 단언한다 — 창만 바뀌고 테이블이 안 바뀌면 2026 이 2건이 된다)
  - 학년도 창이 `academicYearRangeKST` 에서 온다(자체 정의 금지 — 그 모듈을 spy 한다)
  - 과거 학년도 행에 `target`·`deviation` 이 **없다**(오늘의 그룹을 작년에 씌우지 않는다)
  - `services` 행이 `ClosingRow` 로 그대로 들어가고 `workKindOfClosing` 이 `category` 에 `대학원` 포함 여부로 가른다
  - 표 머리의 원천 문구가 학년도에 따라 갈린다 — **텍스트뿐 아니라 어느 테이블을 읽었는지까지** 단언한다
  - `?year=` 가 없으면 `BAEJUNG_CURRENT_YEAR`, 알 수 없는 값이면 같은 기본값(파싱 실패가 빈 표가 되지 않는다)
- **검증**: `npm test -- src/features/assignments` · 화면에서 2027 → 2026 전환 후 건수를 §3 실측(983 / 2,511)과 눈으로 대조
- **의존**: PR-A

### PR-C — 백업자 (10파일 · 간략 설계 + DB 보정)

- **파일**: 마이그레이션 1 · `backup-schemas.ts` · `backup-queries.ts` · `backup-actions.ts` · `BackupPanel.tsx` · `work-assignment/page.tsx` · tests 4
- **RED**:
  - `migration-contract.test.ts` 가 마이그레이션 원문을 읽어 컬럼명·자연키 컬럼 **순서**를 코드 상수와 대조한다 (`features/sms-codes/__tests__/rpc.test.ts` 선례). **대조 전에 `--` 주석을 지운다** — 주석 처리된 정의를 읽고 초록이 난 적이 있다
  - 같은 `(학년도, 대학, 업무종류)` 에 두 번 지정하면 갱신이지 추가가 아니다(자연키 upsert)
  - 담당자 본인은 후보에서 빠진다
  - 명부에 없는 이메일은 거부된다 (FK `23503` 이 아니라 읽을 수 있는 메시지로)
  - 비-admin 의 지정·해제가 거부된다 (화면 가림이 아니라 action 에서)
  - 쓰기 실패를 삼키지 않는다 — supabase-js 는 던지지 않으므로 `error` 를 안 보면 '저장했습니다' 가 뜬다
- **검증**: `npm test -- src/features/assignments` · 사용자가 SQL Editor 에서 마이그레이션 실행 + §7.1 검증 SQL · 화면에서 1건 지정 → 해제
- **의존**: PR-A

### PR-D — 퇴사 승계 (8파일 · 간략 설계)

- **파일**: 마이그레이션 1(`kind`) · `succession.ts` · `succession-actions.ts` · `BackupPanel.tsx` · tests 4
- **RED**:
  - 퇴사자의 (대학 × 업무종류) 중 **백업자가 있는 것만** 제안 줄이 된다 / 없는 것은 건수로 돌려준다(조용히 빠지지 않는다)
  - 제안 줄의 `prev_assignee` 가 퇴사자, `next_assignee` 가 백업자, `reason` 이 비어 있지 않다(스키마가 `not null` 이다)
  - 배치 `kind='succession'` 이고 **연간 배치의 부분 unique 인덱스에 걸리지 않는다**(`where kind='annual'`)
  - 백업자가 퇴사자 자신이면 그 줄을 만들지 않는다
  - 적용은 기존 `applyProposalBatch` 를 탄다 — 경합 줄이 `pending` 으로 남고 배치가 `partial` 이 된다(새 적용 경로를 만들지 않는 것을 단언한다)
  - 비-admin 거부
- **검증**: `npm test` · dry 한 건 — 테스트 계정으로 배치를 만들어 제안 탭에서 **반려**까지 해 본다(적용은 원장을 바꾸므로 실데이터로는 마지막에)
- **의존**: PR-C

### PR-E — 신규배정 탭 (9파일 · 간략 설계)

- **파일**: `newcomers.ts` · `newcomer-queries.ts` · `propose-actions.ts` · `NewAssignmentPanel.tsx` · `work-assignment/page.tsx` · tests 4
- **RED**:
  - 담당자가 **하나도 없는** (대학 × 업무종류)만 목록에 든다 — `findUnassignedKeys` 를 재사용한다(두 번째 판정을 만들지 않는 것을 단언한다)
  - `연결 안 됨`(이름 있고 메일 없음) 행에 `[배정 요청]` 버튼이 **없다**
  - 업무종류 → 시트명 표가 5종을 모두 덮는다(빠진 종류는 `—` 가 아니라 테스트 실패다)
  - **후보 부하가 그 서비스 시작일 기준 창으로 계산된다** — 12월 시작 서비스에 대해 `workloadWindows(12월 날짜)` 가 쓰이고, 오늘 기준 창이 아니다
  - `[배정 요청]` 이 `enqueueProposeRequest` 를 `kind:"single"` 로 부르고, 같은 요청이 대기 중이면 `skipped` 를 화면 문구로 돌려준다
  - 비-admin 거부
- **검증**: `npm test -- src/features/assignments` · 화면에서 1건 요청 → `assignment_propose_requests` 에 pending 1행 → 회사 PC 폴러가 가져가는지 확인
- **의존**: PR-A

### PR-F — 잡 수동 전환 (6파일 · 간략 설계)

- **파일**: `automations/registry.ts` · `jobs/assignment-unassigned-sweep.ts` · `agent-org/registry.ts`(주석) · tests 3
- **RED**:
  - rollover 가 `cadence:"manual"` + `manualOnly:true` 다
  - `digest` 가 rollover 를 `stale` 로도 `off` 로도 보고하지 않는다
  - sweep 이 **요청을 적재하지 않는다** (`enqueueProposeRequest` 호출처 0 을 단언한다) / 미배정·연결 안 됨 건수는 그대로 보고한다
  - `agent-org/registry.test.ts` 가 여전히 통과한다(잡 수가 안 변한다)
- **검증**: `npm test -- src/features/automations src/features/agent-org` · 자동화 페이지에서 rollover 카드에 토글 대신 `수동 전용 (cron 없음)` 이 뜨는지 눈으로
- **의존**: 없음

### PR-G — 제안 탭 대학별 건수 (5파일)

- **파일**: `ProposalPanel.tsx` · `work-assignment/page.tsx` · `AnnualProposalButton.tsx` · tests 2
- **RED**: 건수 열이 `대학\|업무종류` 키로 붙는다(대학 단위로 세면 갈린 44곳에서 남의 건수가 붙는다) / 원천 문구가 열 머리에 있다 / `접수건수` 열은 비어 있고 그 이유가 툴팁에 있다 / `[연간 제안 만들기]` 가 rollover 코어를 부른다(enqueue 를 재구현하지 않는 것을 단언한다) / 3월 상기 문구가 반환값으로 화면에 뜬다 / 비-admin 거부
- **검증**: `npm test` · 화면에서 버튼 1회 → 요청 1건 + 상기 문구
- **의존**: PR-A (+ 버튼은 PR-F 와 무관하게 동작하지만 PR-F 뒤가 말이 된다)

### PR-H — 문서 (2파일)

- `CLAUDE.md` '업무배정' 절 신설 · 이 문서 `status: 확정`
- **검증**: `npm run build`

---

## 11. 코드 밖 등록 체크리스트

**레지스트리 등록은 동작이 아니다.**

| # | 무엇 | 어디 | 안 하면 |
|---|---|---|---|
| 1 | 마이그레이션 **2건** 실행 + §7 검증 SQL | Supabase SQL Editor | 백업자·승계 조회가 전부 `42P01` / `kind` 가 `23514` |
| 2 | `assignment-year-rollover` cron **삭제 확인** | cron-job.org | 수동 전용인데 배경에서 계속 돌아 제안이 저절로 생긴다 (사용자 삭제 완료 — 재확인만) |
| 3 | `assignment-unassigned-sweep` cron **유지** (평일 09:30) | cron-job.org | 새 서비스가 무주공산인 것을 아무도 모른다 |
| 4 | 회사 PC 폴러 가동 확인 (`scripts/assignments/propose-local.mjs`, 5분) | 회사 PC 작업 스케줄러 | 버튼을 눌러도 요청이 `pending` 으로 쌓이기만 한다 |
| 5 | PR-B 전에 `services.operator_email` 채움률 조회 | SQL Editor | 과거 연도 표가 전원 0곳으로 나온다 |
| 6 | 새 env 없음 | — | `CRON_SECRET`·`SHAREPOINT_*`·`TEAMS_*` 는 이미 있다 |

---

## 12. 리스크

| # | 리스크 | 처리 |
|---|---|---|
| R1 | **연도별 원천 차이가 추세로 읽힌다** (2,511 → 983) | 표 머리에 원천을 적고, 과거 연도에는 목표·편차를 내지 않는다(§6.1). 한 화면에 두 해를 나란히 놓지 않는다 |
| ~~R2~~ | ~~`services.operator_email` 이 비어 있을 수 있다~~ | **해소(2026-09-21 실측)** — 2,485/2,511 = 99.0% 채움, 배정 대상 15명 전원 연결. 과거 연도를 연다(열린 질문 1) |
| R3 | 승계가 수십 칸을 한 번에 바꾼다 | 원장 직접 쓰기를 안 한다. 제안 배치 → 관리자 승인 → `applyProposalBatch` 의 경합 검사·`partial` 처리를 그대로 탄다(§7.2) |
| R4 | 백업자가 배정으로 세어진다 | 원장이 아니라 별 테이블이다(§7.1). `buildWorkload` 는 `assignments` 만 읽으므로 구조적으로 섞일 수 없다 |
| R5 | 옮기는 중 화면이 반쯤 사라진다 | PR-A 는 **내용 무변경 이동**이고 기존 테스트 3건이 그대로 따라간다. 이동 뒤 배분현황이 안 뜨면 그 테스트가 먼저 빨개진다 |
| R6 | `work-assignment` 가 `_data.ts` 와 `ADMIN_ONLY_MENU_SLUGS` 두 곳에 적혀 어긋난다 | 이미 둘 다에 있다. 레포 관례대로 메뉴 테스트 1건이 양쪽 등재를 단언한다(`_data/__tests__/tools-menu.test.ts` 선례) |
| R7 | 제안 탭이 두 메뉴에서 열리는 과도기 | PR-A 가 **한 커밋에서 옮긴다.** 양쪽에 두는 기간을 만들지 않는다 — 같은 뜻의 화면이 둘이면 어느 쪽이 사실인지 매번 물어야 한다 |
| R8 | `담당자 변경` 을 원장에 안 넣어 44건이 화면에서 사라진다 | 오늘도 화면에 없다(대학배정 탭은 원장만 읽는다). `대조` 가 어긋난 건수로 드러낸다(§7.3) |

---

## 13. 비범위

| 안 하는 것 | 왜 |
|---|---|
| **Moa `Statistics/RealTime` 접수건수 스크래퍼** | **이 설계의 범위 밖이지 하지 않는 일이 아니다** — 사용자가 결정 2 를 뒤집었다(열린 질문 2). 별도 설계 **PR-I** 로 간다. 여기서는 화면 자리(`접수건수` 열)만 잡는다 |
| **2026학년도 원장 이관** | 원장에 쓰는 경로가 PR4a 에서 걷혔고, 되살리려면 파서가 2026 블록을 내보내야 한다(`import.ts:92`). 과거 연도 배분현황은 `services` 로 충분하다 |
| **`assignments.assignee_changed` 칼럼** | §7.3 |
| **배분현황 전원 공개** | §5.2. 본인 한 줄 카드는 다른 화면의 일이다 |
| **총괄장 `02` 시트 직접 쓰기 / 백업자 시트 동기화** | 선행 설계 §7.1 A안과 같은 이유 |
| **제안 행별 적용** | 선행 설계 rev 6 — 한 줄만 적용하면 수시·정시가 갈려 게이트 G4 가 막으려던 분할이 화면 버튼으로 뚫린다 |
| **배분현황 과거 연도의 목표·편차** | 그룹이 오늘 값 하나뿐이라 존재한 적 없는 목표가 나온다(§6.1) |

---

## 14. 열린 질문

1. ~~**`services.operator_email` 이 2026학년도 창에서 얼마나 채워져 있는가?**~~ — **닫힘(2026-09-21 실측).** 2,511건 중 **2,485건(99.0%)** 이 채워져 있고, **배정 대상 15명 전원**이 `operator_email` 로 이어진다(그들에게 붙는 행 2,463건). `operator_name` 도 같은 채움률이라 메일이 빈 26건은 이름으로도 못 채운다. **과거 연도 탭을 연다.** R2 는 해소됐다.

2. ~~**제안 탭의 '대학별 건수' 는 서비스 건수인가, Moa 접수건수인가?**~~ — **닫힘(사용자 2026-09-21).** *"이것도 이제 확인하면 됨"* — **Moa 접수건수가 맞고, 선행 설계 결정 2 를 뒤집는다.** 다만 두 값은 서로를 대신하지 못한다(서비스 건수는 '몇 개를 맡았나', 접수건수는 '얼마나 몰리나'). 그래서 **두 열을 나란히** 둔다: PR-G 가 서비스 건수를 채우고, 접수건수는 자리만 잡았다가 **PR-I(별도 설계)** 가 채운다. 스크래퍼는 Moa 로그인·SMS 우편함·리스를 이미 쓰는 `scripts/moa-ratio` 계열에 붙는다 — 새 파이프라인이 아니다.

3. ~~**시트 2026 블록의 백업자 22건을 옮겨 드릴까?**~~ — **닫힘.** 사용자가 백업자의 목적을 *"기존 운영자가 퇴사하는 백업자 배정을 위한 프로세스"* 로 못 박았다. 앞을 보는 기능이고 작년 값은 근거가 아니다. **빈 채로 시작한다.**

4. **백업자의 단위가 (대학 × 업무종류)로 맞는가?** 시트의 백업자 칸은 02 시트(원서접수)에만 있다. 대학원·PIMS 에도 백업이 필요하면 지금 설계가 그대로 받지만, 원서접수만이라면 `work_kind` 를 자연키에서 빼도 된다 — 뺄 이유는 없어 보여 넣어 뒀다. **넣은 채로 간다**(빼는 것은 나중에 못 되돌리지만, 안 쓰는 것은 비용이 없다).

5. **운영자 본인의 부하 한 줄을 어딘가에 띄울까?** 배분현황은 admin 으로 닫는 것이 맞다고 보지만, "내 대학 수·이번 주 건수" 정도는 `my-todo` 나 대시보드에 있어도 견줌이 안 생긴다. 필요한가? — **사용자 판단 대기. 이 설계 범위 밖.**

6. **`[퇴사 승계]` 의 대상 선택을 `status='inactive'` 로 제한할까?** 지금 설계는 명부 전원에서 고르게 둔다(퇴사 처리 **전에** 미리 승계를 준비하는 경우가 있을 것 같아서). **전원에서 고르게 둔 채로 간다** — 퇴사 처리가 먼저 되면 그 사람 담당 칸을 화면에서 찾기가 오히려 어려워진다. 다만 `status` 를 행에 배지로 드러낸다.

7. **신규배정 탭이 '원장에 없는 새 대학' 까지 다뤄야 하는가?** 선행 설계 rev 6 이 그것을 감지에서 뺐다 — 서비스 원천과 원장의 이름이 안 맞는 키가 48곳이고 매일 같은 숫자라 늘 켜진 경고등이 된다. 지금 설계도 **원장에 있는 미배정만** 다룬다. 이름 갈림은 `대조` 가 드러낸다. — **그대로 간다.**
