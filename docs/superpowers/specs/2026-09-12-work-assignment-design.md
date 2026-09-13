---
share: true
status: 초안
updated: 2026-09-12
revision: 2
---

# 업무배정 — 총괄장을 DB 원장으로

> **rev 2 (2026-09-12)** — rev 1 초안을 사용자가 검토한 뒤 셋이 뒤집혔다.
>
> 1. **에이전트 판정을 채택했다.** rev 1 은 결정적 산식을 권고했고 근거는 "같은 입력에 같은 답이 나와야 테스트·되돌리기가 성립한다"였다. 사용자는 판정을 에이전트에 맡기고 **마지막 승인을 관리자가** 하는 쪽을 골랐다. 제안이 적용 전까지 사실이 아닌 구조(§5.4)가 그 승인 관문이고, 산식은 폐기가 아니라 **제약 검산기**로 남는다(§4·§6.3).
> 2. **"네 업무종류에 건수 원천이 없다"는 틀렸다.** 대학원은 `closing_services` 에 이미 있고(2026학년도 381건/52곳), PIMS·발표는 `announcement_services` 로 센다(1145행, 배정 대상 15명 전원이 담당자). 성적산출만 원천이 없고, **상담앱은 사용자가 자동 배정에서 뺐다**(§6.2·§14).
> 3. **연차 그룹 7개는 확정**이고 3월 갱신 상기 알림을 붙인다(§6.4).
>
> rev 1 의 판단이 틀렸던 것이 아니라 **전제가 달랐다** — 산식 권고는 결정성을 1급 가치로 둔 것이고, 사용자는 사람의 판단에 가까운 배정을 택한 뒤 승인 관문으로 위험을 막는 쪽을 골랐다. 같은 논쟁을 되풀이하지 않도록 양쪽 근거를 남긴다.

**질문**: 매년 사람이 엑셀을 열어 손으로 옮기던 대학 배정을, 근거와 이력과 되돌리기가 있는 원장으로 어떻게 옮기는가.
**날짜**: 2026-09-12

---

## 1. 왜

지금 절차는 이렇다.

1. 학년도마다 총괄장 파일을 **새로 만들어** 운영자에게 공지한다.
2. 운영자 배정은 팀장이, 개발자 배정은 개발부가 한다 — 파일을 열어 칸을 채우고 개발부에는 **말로 요청**한다.
3. 매년 연차에 맞게 대학 배정을 조금씩 바꾼다.
4. 새 서비스가 들어오면 연차를 고려해 **그때그때 손으로** 배정한다.

이 절차에는 세 가지가 없다. **근거**(왜 이 사람인지가 파일에 안 남는다), **이력**(작년 누구였는지는 작년 파일을 찾아야 한다), **되돌리기**(잘못 지운 칸은 복구할 방법이 파일 버전 이력뿐이다).

그리고 앱에는 이미 **배정의 사본이 둘** 있는데 둘 다 총괄장의 수동 변경을 반영하지 않는다.

| 테이블 | 원천 | 담당자 표현 | 총괄장 변경 반영 |
|---|---|---|---|
| `services` | Folio + 앱 CRUD | `operator_email` FK + `operator_name` 스냅샷 | ❌ |
| `closing_services` | Moa 스크랩 미러(append) | `operator_name` 텍스트만 | ❌ |

`closing_services` 쪽 위험은 이미 다른 설계가 지적해 뒀다 — *"append-only 스냅샷이라 최초 적재 후 담당자 변경이 반영되지 않는다. 1년치 성과의 분모가 틀어질 수 있다"*(`2026-08-29-agent-console-design.md` §4). 배정의 원천이 파일이면 이 어긋남을 고칠 자리가 없다.

---

## 2. 사용자가 확정한 결정 (바꾸지 않는다)

| # | 결정 | 이 설계에 미치는 영향 |
|---|---|---|
| 1 | **배정의 원천은 DB.** 총괄장 엑셀은 내보내기 산출물로 강등 | 화면·잡·이력이 모두 DB를 본다. 엑셀은 단방향 출력(§7) |
| 2 | **물량 스크래퍼를 만들지 않는다.** Moa `Statistics/RealTime` 접수건수 미수집 | 배정 근거는 **연차 그룹 · 담당 대학 수 · 서비스 건수 · 대학당 서비스 수** 네 가지(§6) |
| 3 | **학년도는 한 시트에 열로 추가.** 학년도마다 새 파일을 만들지 않는다 | 내보내기 시트가 학년도를 열로 늘린다(§7.2) |
| 4 | **판정은 에이전트가 하고 마지막 승인은 관리자가 한다** (rev 2) | 판정이 회사 PC로 간다. 서버는 근거를 조립하고 결과를 검산한다(§6) |
| 5 | **연차 그룹 7개를 그대로 시드한다** (rev 2) | §5.2 시드 유지 + 3월 갱신 상기(§6.4) |
| 6 | **상담앱은 일단 패스** (rev 2) | 화면에는 보이되 자동 배정 대상에서 제외(§14) |

### 결정 3에 대한 한 가지 구분

결정 3은 **엑셀의 표현**이다. DB에서 학년도를 열(`operator_2027`, `operator_2026` …)로 두면 학년도가 하나 늘 때마다 마이그레이션이 필요하고, "이 대학의 담당자 변천"을 한 번의 조회로 못 본다. 그래서 **DB는 행**(`academic_year` 컬럼이 자연키에 들어간다), **엑셀은 열**이다. 같은 결정을 두 표현이 각자의 방식으로 만족한다 — 둘을 잇는 것이 내보내기의 일이다.

---

## 3. 조사로 드러난 것

### 3.1 총괄장의 모양이 곧 배정의 단위다

`02. 배정리스트`는 2줄 헤더다. r0에 `2027/2026 × 운영자/개발자` 블록(블록당 6칸), r1에 `재외/수시/정시/편입/외국인/백업자` 하위유형. 그리드 대표값은 **2027 수시** 열이다(`parse.ts` `BLOCK_WIDTH = 6`).

> 여섯 번째 라벨은 **`백업자`** 다(2026-09-13 라이브 헤더 실측 — r1 인덱스 17). 이 문서가 처음에 `백업`으로 적었는데 시트가 그렇지 않다. `parseBaejungList`가 r1 라벨을 그대로 `subtypes[].label`에 담으므로 **원장의 `subtype`도 `백업자`**다. 정규화해서 `백업`으로 바꾸지 않는다 — 어휘를 두 벌로 만들면 내보내기 왕복이 깨진다(§5.1과 같은 이유). 실측 좌표: r0 1 대분류 · 3 대학명 · 12/18/24/30 블록 시작, 데이터 293행.

| 시트 | 업무종류 | 하위유형 | 개발자 |
|---|---|---|---|
| 02. 배정리스트 | 원서접수 | 재외/수시/정시/편입/외국인/백업자 | 있음 |
| 03. 대학원 | 대학원 | 없음 | 있음 |
| 04. PIMS | PIMS | 운영자 FULL / 환·충 | **없음** |
| 06. 성적산출 | 성적산출 | 없음 | 있음 |
| 07. 상담앱 | 상담앱 | 없음 | 있음 |

즉 한 칸을 가리키는 좌표는 **학년도 × 대학 × 업무종류 × 하위유형 × 역할**이다. 이게 그대로 자연키가 된다(§5.1). 대학만으로는 부족하다는 증거가 실데이터에 있다 — **여러 운영자로 갈린 대학이 44곳**이고 숙명여대·부산대는 세 명이다.

### 3.2 운영자/개발자 값은 전부 시트 칸에 있고 DB에 없다

`features/assignments/`는 Graph `usedRange` **GET만** 한다(`queries.ts`). `/dashboard/assignments` 3탭은 `ListPattern readOnly`이고 PATCH 경로가 없다. 반면 **쓰기 가능한 `lib/microsoft/workbook-session.ts`(`persistChanges: true`)는 이미 있고** 계약·미수·전도금이 쓰고 있다(`features/receivables/sheet-write.ts`가 토큰 1회 + 세션 1회 + 504 재발급 1회 retry 패턴). 내보내기는 새 인프라가 아니라 **이미 있는 쓰기 경로에 시트 하나를 더 붙이는 일**이다.

### 3.3 연차는 DB에 없고, 재입사가 계산을 깬다

`operators`에는 `hired_at`·`team`·`role`·`emp_no`·`status`·`permission`이 있다. **연차 컬럼도, 연차 그룹 컬럼도, 배정 대상 여부 칸도 없다.** 연차는 `features/auth/operators.ts`의 `tenureYears()`가 파생한다.

사용자가 준 그룹은 7개다.

| 그룹 | 인원 |
|---|---|
| 1그룹1 | 한효진 · 윤지혜 |
| 1그룹2 | 박시현 · 김슬기 |
| 2그룹 | 김지영 · 이해영 |
| 3그룹 | 정윤나 · 임종우 |
| 4그룹 | 전혜인 · 김유민 |
| 5그룹 | 기자의 · 김지현 |
| 6그룹 | 김지나 · 김승현 · 전지은 |

입사일로 그룹 **순서**는 재현되지만 **경계는 사람 판단**이다(3그룹이 2019~2022로 폭이 넓다). 그래서 그룹은 계산하지 않고 저장한다.

**재입사가 계산을 깬다.** 배정 대상 한 명은 DB `hired_at`이 최근이고 하드코딩 배열은 15년 전이다. 배정 근거는 **경력** 쪽이다. 20명 중 두 원천이 갈린 사람은 그 한 명뿐이고, 다른 한 명은 DB에만 있어 상세가 빈다.

> **시드에서 밟게 되는 함정**: `20260509_operators_table.sql`의 시드 이메일 도메인과 `features/auth/operators.ts`의 도메인이 배정 대상 한 명에게서 다르다. 라이브 행은 그 뒤 편집됐다(`hired_at`이 시드와 다르다). **이메일로 시드하면 이 행을 놓친다** — 이름으로 시드하고 건수를 세어 확인한다(§5.2).

### 3.4 배정 대상을 가리는 칸이 없다

활성 21명 중 배정 대상은 15명이다. 제외는 팀장·부장·이사·기획팀·테스트 계정인데, **파생 규칙으로 재현하면 테스트 계정이 통과한다** — `테스트1`/`테스트2`는 `team='운영2팀'`, `role='매니저'`로 실 운영자와 구별되지 않는다. 그리고 `이이화`는 DB에만 있어 역할을 모른다.

### 3.5 이미 고른 건수는 다시 고를 것이 없다

측정된 현황(2026학년도 창):

| 항목 | 값 |
|---|---|
| 대학 | 286곳 |
| 서비스 | 928건 |
| 대학당 서비스 | 3.2건 |
| 여러 운영자로 갈린 대학 | 44곳 |
| 운영자별 담당 대학 | 17 ~ 29곳 |
| 운영자별 담당 서비스 | 43 ~ 91건 |
| 운영자별 대학당 밀도 | 1.7 ~ 5.4 |

**연차가 높으면 대학은 적고 대학당 서비스는 많다.**

| 운영자 | 입사 | 대학 | 서비스 | 밀도 |
|---|---|---|---|---|
| 한효진 | 2007 | 17곳 | 91건 | 5.4 |
| 김승현 | 2025 | 29곳 | 48건 | 1.7 |

월별 진행은 9월 296건이 최번월, 3월 38건이 최저다. 그런데 **최번월에도 운영자별 건수는 15~25로 이미 고르다.** 건수 균등화만으로는 바꿀 것이 없고, 오히려 위 표의 차이(의도된 것)를 지우려 든다. 목표 함수가 무엇이어야 하는지는 §6이 답한다.

### 3.6 재사용해야 하는 것

| 무엇 | 어디 | 쓰는 곳 |
|---|---|---|
| 학년도 경계(3/01 00:01 ~ 익년 2월 말 23:59, 윤년 동적) | `features/closing/academic-year.ts` `academicYearRangeKST` | 정기 생성 잡의 학년도 판정 |
| 같은 규칙의 python 구현 | `scripts/moa-closing/scrape.py` `academic_year_range` | (변경 없음) |
| 이력 테이블 모양 | `20260912_closing_service_changes.sql` | §5.3 |
| 변경 칸 추출 | `features/closing/diff-row.ts` (`CLOSING_DIFF_FIELDS` as const + `diffClosingRow`) | §5.3 |
| 관리자 취합 보고 | `features/ratio-audit/dispatch.ts` (`48:notes` + 담당 미상·실패를 한 메시지에) | §8 |
| 실행 이력·미실행 감지 | `features/automations/run-recorder.ts` `recordAutomationRun` | §6.4 |
| 워크북 쓰기 | `lib/microsoft/workbook-session.ts` + `features/receivables/sheet-write.ts` | §7 |
| 목록·인스펙터 | `list-variants/assignments/` (variant 이미 등록됨) | §9 |
| 요청큐 + 원자적 claim | `ratio_audit_requests` + `api/ratio-audit/audit-request/route.ts` (GET claim / POST 보고) | §6.4 |
| 큐 적재 정책 | `features/ratio-audit/audit-requests/enqueue.ts` (pending/running 1건 · `STALE_RUNNING_MS` 70분 · `QUEUED_MARK`) | §6.4 |
| MCP 격리 | `scripts/postal/extract-local.mjs` (`strictMcpConfig` + `mcpServers: {}` + `settingSources: []`) | §6.3 |
| 프롬프트 조립은 서버 | `features/assistant/claude-prompt.ts` | §6.3 |

**에이전트 판정에서 재사용하는 실측 교훈 셋** (전부 이 레포에 주석으로 남아 있다):

- `allowedTools`만 주고 `permissionMode: "bypassPermissions"`면 **Bash가 그대로 실행된다** — `disallowedTools`를 함께 줘야 "Bash로 실행하라"는 프롬프트 지시도 무시된다(`serve-local.mjs`, 2026-08-16 실측).
- `strictMcpConfig`·`mcpServers`·`settingSources` 셋이 없으면 `disallowedTools`를 줘도 **그 PC의 MCP가 열려 있다** — 한 줄로 개인 캘린더를 읽어낸 사례가 있다(같은 날 실측).
- 프롬프트에 **em dash 한 글자**가 있으면 스케줄러·폴러 환경(cp949)에서 `UnicodeEncodeError`로 배치 판정이 통째로 죽는다(`moa-ratio/judge.py`, 2026-08-03 재현). 인코딩을 고정하고 프롬프트에서 em dash를 쓰지 않는다.

**세 번째 학년도 정의를 만들지 않는다.** `academicYearRangeKST(now).start.date`의 연도 + 1이 학년도 라벨이다.

---

## 4. 무엇을 만드나

```
                     ┌──────────────── Supabase ─────────────────┐
[정기] 3/01 이후      │                                           │
 assignment-year-    │  assignments            (확정 원장)        │
 rollover (daily)  ──▶  assignment_proposals   (제안 — 아직 사실 아님)
       │              │  assignment_proposal_batches (배치 + 근거) │
       │              │  assignment_changes     (바뀐 칸의 이전 값) │
[상시] 평일           │                                           │
 assignment-         │  operators +assignable +tenure_group       │
 unassigned-sweep  ──▶            +career_start_at                │
                     └───────────────────────────────────────────┘
                              │                    │
        관리자 Teams 노트 채팅 ◀┘                    ▼
        (변경 대학 · 미배정 · 이름 미매칭)      /dashboard/assignments
                                            대학배정 · 제안 · 배분현황
                                                     │
                                        [내보내기] admin 수동
                                                     ▼
                                    총괄장 `(앱) 배정확정` 시트 (단방향)
```

**판정은 에이전트(LLM)가 하고, 마지막 승인은 관리자가 한다**(사용자 결정, rev 2). 근거 넷이 전부 숫자라 결정적 산식으로도 짤 수 있었지만, 사용자는 사람의 판단에 가까운 배정을 골랐다. 위험은 **제안이 적용 전까지 사실이 아니라는 구조**(§5.4)가 막는다 — 모델이 이상한 답을 내도 원장은 그대로이고, 반려가 기본 선택지다.

그 대가가 셋이고 전부 설계에 반영해야 한다.

- **서버에서 LLM 을 부를 수 없다.** `@anthropic-ai/claude-agent-sdk` 는 의존성에 있지만 호출처가 전부 `scripts/` 다(어시스턴트 폴러·우편물 판독·ai-tips·dev-control). `src/` 안에는 없고 `ANTHROPIC_API_KEY` 를 읽는 서버 코드도 없다. 그래서 **판정은 회사 PC 로 간다**(§6.4). 3월 1일에 PC 가 꺼져 있어도 요청은 `pending` 으로 남아 PC 가 켜지면 처리되고(F12), cron 이 실패한 경우는 `daily` 가 다음 날 다시 적재한다(F5) — **두 겹이 서로 다른 실패를 덮는다.**
- **테스트가 배정값을 단언할 수 없다.** 같은 입력에 다른 답이 날 수 있다. 그래서 테스트는 **제약 준수와 형태**를 단언한다(§6.3).
- **'판단 실패'라는 실패 모드가 새로 생긴다**(F11·F12).

**산식은 버리지 않는다 — 검산기로 남긴다.** §6.1 의 목표 함수는 이제 배정을 *만드는* 도구가 아니라, 에이전트 제안이 상한·배정 대상·분할 보존·그룹 경계를 지켰는지 기계적으로 검사하는 **게이트**다. 제약을 어긴 제안은 배치에 담기지 않고 그 이유가 보고에 남는다. 이것이 없으면 모델이 44곳을 흩어 놓거나 한 사람에게 30곳을 몰아주는 배치가 관리자 화면까지 올라온다.

---

## 5. 스키마

### 5.1 확정 원장 — `assignments`

```sql
-- supabase/migrations/20260913_assignments_tables.sql
-- 업무배정 원장 — 총괄장 엑셀에서 DB로 원천을 옮긴다.
-- 설계: docs/superpowers/specs/2026-09-12-work-assignment-design.md
--
-- 학년도는 **행**이다(컬럼이 아니다). 엑셀에서는 열로 늘어나지만(사용자 결정 3),
-- DB에서 열로 두면 학년도가 하나 늘 때마다 마이그레이션이 필요하고 "이 대학의
-- 담당자 변천"을 한 번에 못 본다. 두 표현을 잇는 것은 내보내기의 일이다.

begin;

create table if not exists public.assignments (
  id              uuid primary key default gen_random_uuid(),
  academic_year   smallint not null,          -- 2027 (academicYearRangeKST 라벨)
  university_name text not null,
  work_kind       text not null,              -- ServiceKind: 원서접수/대학원/PIMS/성적산출/상담앱
  subtype         text not null default '',   -- 원서접수: 수시/정시/편입/재외/외국인/백업
                                              -- PIMS: FULL/환충 · 그 외 업무: '' (빈 문자열)
  role            text not null check (role in ('운영','개발')),
  assignee_email  text references public.operators(email)
                    on update cascade on delete set null,
  assignee_name   text not null default '',   -- 이름 스냅샷 (매칭 실패 시 이것만 남는다)
  university_type text,                       -- 02.배정리스트 '대분류' 스냅샷
  note            text,
  updated_by      text,                       -- 마지막으로 바꾼 사람 (이력은 별도 테이블)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 자연키. **subtype 이 not null default '' 인 이유가 여기 있다** — Postgres 의 unique 는
-- null 을 서로 다른 값으로 보므로, subtype 이 null 이면 같은 배정이 몇 번이고 들어간다.
create unique index if not exists assignments_natural_key
  on public.assignments (academic_year, university_name, work_kind, subtype, role);

-- '내 배정' 칩 + 운영자별 부하 집계.
create index if not exists assignments_assignee_idx
  on public.assignments (assignee_email, academic_year);
-- 목록은 학년도 한 해를 대학명 순으로 훑는다.
create index if not exists assignments_year_univ_idx
  on public.assignments (academic_year, university_name);

drop trigger if exists assignments_set_updated_at on public.assignments;
create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();
```

**`work_kind`·`subtype`에 check 를 걸지 않는다.** 두 값은 시트 구조를 따라가고 시트는 자란다(`05.모의논술`·`08.채널`이 이미 파일에 있고 이번 범위 밖이다). `closing_service_changes`가 같은 판단을 해뒀다 — *"컬럼이 하나 늘 때마다 마이그레이션을 잊으면 야간 인제스트 전체가 죽는다."* 어휘는 코드의 `as const` + zod가 지킨다(`ASSIGNMENT_WORK_KINDS`는 기존 `SERVICE_KINDS`를 그대로 쓴다 — 두 번째 어휘를 만들지 않는다). 반면 `role`은 **정의상 둘뿐**이라 check 를 건다.

### 5.2 운영자 칸 세 개

```sql
-- supabase/migrations/20260913b_operators_assignment_columns.sql
begin;

alter table public.operators
  -- 배정 대상 여부. **파생하지 않는다** — 테스트 계정 2개가 team='운영2팀'/role='매니저'
  -- 로 실 운영자와 구별되지 않아 어떤 규칙도 그것을 걸러내지 못한다(설계 §3.4).
  -- default false: 새로 들어온 사람에게 대학이 저절로 배정되는 일이 없다.
  add column if not exists assignable boolean not null default false,
  -- 연차 그룹. 순서는 입사일로 재현되지만 **경계는 사람 판단**이라 저장한다.
  -- check 를 걸지 않는다 — 그룹이 하나 늘 때 마이그레이션을 잊으면 조직 화면
  -- 저장이 500 으로 죽는다. 값은 features/assignments/tenure.ts 의 as const + zod.
  add column if not exists tenure_group text,
  -- 배정 근거가 되는 경력 시작일. hired_at 은 인사 사실이라 건드리지 않는다 —
  -- 재입사자는 hired_at 이 최근이어서 연차를 그대로 쓰면 신입으로 읽힌다.
  add column if not exists career_start_at date;

comment on column public.operators.career_start_at is
  '배정 근거용 경력 시작일. null 이면 hired_at 을 쓴다(단일 정의: features/assignments/tenure.ts careerStartOf).';

-- 시드 — **이름으로 한다.** 시드 대상 한 명은 시드 SQL 의 이메일 도메인과 코드의
-- 도메인이 다르고 라이브 행은 그 뒤 편집됐다. 이메일로 시드하면 그 행을 놓친다(§3.3).
-- ⚠️ PostgREST 경로에는 safeupdate 가 켜져 있다 — WHERE 없는 UPDATE/DELETE 는 거부된다.
--    아래는 모두 WHERE 가 있다. 전체를 대상으로 해야 할 때는 `where true` 를 쓴다.
update public.operators set assignable = true, tenure_group = '1-1'
 where name in ('한효진','윤지혜');
update public.operators set assignable = true, tenure_group = '1-2'
 where name in ('박시현','김슬기');
update public.operators set assignable = true, tenure_group = '2'
 where name in ('김지영','이해영');
update public.operators set assignable = true, tenure_group = '3'
 where name in ('정윤나','임종우');
update public.operators set assignable = true, tenure_group = '4'
 where name in ('전혜인','김유민');
update public.operators set assignable = true, tenure_group = '5'
 where name in ('기자의','김지현');
update public.operators set assignable = true, tenure_group = '6'
 where name in ('김지나','김승현','전지은');

update public.operators set career_start_at = '2011-02-07' where name = '김슬기';

-- 새 컬럼은 스키마 캐시를 갱신하지 않으면 조회에 안 보인다.
-- **commit 앞에 둔다** — 원장 마이그레이션과 문자 우편함 선례와 같은 자리다.
notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.operators where assignable;                  -- 기대 15
-- select tenure_group, count(*), string_agg(name, ',' order by name)
--   from public.operators where assignable group by 1 order by 1;          -- 기대 7행 (2·2·2·2·2·2·3)
-- select name, hired_at, career_start_at from public.operators
--  where career_start_at is not null;                                      -- 기대 1행
-- 15 가 아니면 이름이 시드와 다른 행이 있다 — 그 행을 찾아 고친다(추측해 채우지 않는다).
```

그룹 값은 `'1-1' < '1-2' < '2' < … < '6'` 으로 **문자열 정렬이 곧 연차 순서**다(한 자리 숫자라 성립). 화면 라벨(`1그룹1`)은 `tenure.ts`의 as const가 갖는다.

### 5.3 이력 — `assignment_changes`

```sql
create table if not exists public.assignment_changes (
  id              uuid primary key default gen_random_uuid(),
  academic_year   smallint not null,
  university_name text not null,
  work_kind       text not null,
  subtype         text not null default '',
  role            text not null,
  prev_assignee   text,                    -- null = 비어 있던 칸이 채워짐
  next_assignee   text,                    -- null = 있던 값이 비워짐
  source          text not null,           -- import|manual|proposal|revert
  actor_email     text,                    -- 사람이 바꿨으면 그 사람, 잡이면 null
  note            text,
  -- **changed_at 이다(detected_at 이 아니다).** closing_service_changes 가
  -- detected_at 을 고른 이유는 "언제 바뀌었는지는 알 길이 없고 언제 발견했는지만
  -- 안다 — 이름이 거짓말하면 안 된다" 였다. 여기서는 우리가 바꾼다. 시각을 안다.
  changed_at      timestamptz not null default now()
);

-- "안 바뀐 것을 이력에 남기지 않는다" — 선례와 같은 불변식.
alter table public.assignment_changes
  drop constraint if exists assignment_changes_actual_change_chk;
alter table public.assignment_changes
  add constraint assignment_changes_actual_change_chk
  check (prev_assignee is distinct from next_assignee);

create index if not exists assignment_changes_cell_idx
  on public.assignment_changes
     (academic_year, university_name, work_kind, subtype, role, changed_at desc);
create index if not exists assignment_changes_recent_idx
  on public.assignment_changes (changed_at desc);
```

**`prev_assignee`·`next_assignee` 의 단위는 이메일이다**(`operators.email`). 원장은 담당자를 두 칸(`assignee_email` + `assignee_name`)으로 쪼개지만 이력·제안은 한 칸이라 단위를 정해 둬야 한다 — §6.3 의 G1·G2 와 F8 대조가 이메일로만 성립한다. 이름 스냅샷은 원장에만 두고 이력에는 별도 칸을 두지 않는다. 이력이 append-only 라 PR3 가 한 번 이름으로 적재하면 백필밖에 남지 않는다.

**`role` check 는 원장에만 있다.** 이력·제안에는 걸지 않는다 — 이력은 지난 사실의 기록이고 어휘가 바뀌어도 옛 행이 제약 위반이 되면 안 된다. 어휘는 zod 가 쓰기 시점에 지킨다.

**되돌리기는 삭제가 아니다.** 한 이력 행을 되돌리면 원장을 `prev_assignee`로 바꾸고 `source='revert'`인 **새 이력 행**을 남긴다. 이력을 지우는 경로는 만들지 않는다.

### 5.4 제안 — 확정과 **다른 테이블**에 둔다

```sql
create table if not exists public.assignment_proposal_batches (
  id             uuid primary key default gen_random_uuid(),
  academic_year  smallint not null,
  kind           text not null check (kind in ('annual','single')),
  status         text not null default 'pending'
                 check (status in ('pending','applied','rejected','partial')),
  requested_by   text not null,            -- 'automation' 또는 관리자 이메일
  -- 이 배치가 본 근거의 스냅샷: 그룹별 목표(대학 수·밀도), 운영자별 실측, 상한.
  -- 그룹 값은 operators 의 컬럼이라 나중에 바뀐다 — 그때 이 배치를 다시 설명할 수
  -- 없게 되므로 판정에 쓴 값을 여기 얼려 둔다.
  --
  -- **에이전트가 판정하므로(rev 2) 여기에 모델이 본 것과 말한 것도 함께 남긴다**:
  --   { groups, targets, measured, limits,           ← 프롬프트에 들어간 입력
  --     model, prompt_hash, verdict_raw,             ← 무엇으로 어떻게 판정했나
  --     rejected: [{ 자연키, 위반 제약 }] }           ← 게이트가 버린 행(§6.3)
  -- 관리자가 '에이전트가 관리하는 모든 사항'을 확인해야 하므로(사용자 요구) 모델이
  -- 무엇을 보고 그랬는지가 남아야 한다. 컬럼을 늘리지 않는 이유는 이 값이 화면 한
  -- 곳에서 펼쳐 보이기만 하고 조회 조건이 되지 않기 때문이다.
  basis          jsonb not null default '{}'::jsonb,
  summary        text,
  created_at     timestamptz not null default now(),
  decided_at     timestamptz,
  decided_by     text
);

create table if not exists public.assignment_proposals (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.assignment_proposal_batches(id)
                    on delete cascade,
  academic_year   smallint not null,
  university_name text not null,
  work_kind       text not null,
  subtype         text not null default '',
  role            text not null,
  prev_assignee   text,                    -- 제안 시점의 확정값 (적용 전 경합 감지용)
  next_assignee   text not null,
  -- 사람이 읽는 근거 한 줄 + 기계가 읽는 점수. 근거 없는 제안은 적용 버튼을 못 얻는다.
  reason          text not null,
  score           jsonb not null default '{}'::jsonb,
  decision        text not null default 'pending'
                  check (decision in ('pending','applied','rejected')),
  decided_at      timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists assignment_proposals_batch_idx
  on public.assignment_proposals (batch_id, decision);
```

**왜 한 테이블에 `status`를 두지 않는가.** 오픈안내(`open_notice_sends`의 `status='scheduled'` 대기 행)가 제안과 확정을 한 테이블에 둔 선례인데, 거기서 '대기'는 **이미 내려진 결정**이고 실행만 남은 상태다(토글 ON = 결정). 여기서 제안은 **아직 사실이 아닌 후보**다. 한 테이블에 섞으면 모든 조회에 `status='confirmed'`를 붙여야 하고, 그 한 줄을 빠뜨리는 자리가 조회마다 생긴다 — 빠뜨리면 화면이 제안을 사실로 보여준다. 배치 수명(생성 → 검토 → 적용/반려)과 근거 스냅샷도 확정 행에는 없는 칸이다.

**적용 시 경합**: `prev_assignee`가 지금 원장의 값과 다르면 그 행은 적용하지 않고 '그 사이 바뀜'으로 표시한다. 제안을 만든 뒤 사람이 손으로 고쳤을 수 있다.

### 5.5 RLS·GRANT

| 테이블 | select | 쓰기 |
|---|---|---|
| `assignments` | `to authenticated using (true)` — 오늘 총괄장이 전원 공개다 | 정책 없음. server action 이 service_role 로만 |
| `assignment_changes` | 같음 | 같음 |
| `assignment_proposals` | `using (public.is_admin())` | 같음 |
| `assignment_proposal_batches` | `using (public.is_admin())` | 같음 |

`grant select … to authenticated` + `grant all … to service_role`(42501 함정). `is_admin()`은 `20260510b_operators_permission_rls.sql`에 이미 있다. 마이그레이션 끝에 `notify pgrst, 'reload schema';`.

---

## 6. 배정 알고리즘

### 6.1 목표와 제약 — 그룹 **안에서만** 맞춘다

> rev 2: 이 절의 산식은 **버리지 않는다.** 판정하지 않고 **세 곳에 쓰인다** — 에이전트에게 주는 근거(§6.3), 검산기의 기준(§6.3 G6), 배분현황 탭의 표(§9.4). 버린 것은 rev 1의 **생성기**(탐욕적 이동)뿐이다.

부하 지표 셋 중 둘만 독립이다.

```
univ(op)  = 담당 대학 수
svc(op)   = 담당 서비스 건수
dens(op)  = svc / univ            ← 대학당 서비스 수
```

`svc = univ × dens`이므로 건수는 결과값이다. 목표는 `(univ, dens)` 둘로 잡는다.

```
target(g)  = 그룹 g 의 배정 대상 평균 (univ, dens)
dev(op)    = |univ(op) - target.univ| / target.univ
           + |dens(op) - target.dens| / target.dens

minimize   Σ dev(op)  +  λ · (변경 건수)
```

**왜 전체 균등화가 아닌가.** 건수는 최번월에도 15~25로 이미 고르다(§3.5). 전체를 균등화하면 한효진(17곳/91건/5.4)과 김승현(29곳/48건/1.7)을 같게 만들려 드는데, 그 차이는 **연차에 따라 의도된 것**이다. 고른 건수 뒤에 아주 다른 대학 수와 밀도가 숨어 있고, 그것이 연차와 함께 움직인다. 그래서 그룹 간 차이는 손대지 않고 **그룹 안의 편차만** 줄인다 — 같은 연차인데 한 명이 17곳, 다른 한 명이 29곳이면 그건 조정할 것이다.

**연속성이 1급 목표다**(`λ`). 대학 담당자와의 관계가 자산이고, 사용자의 현재 절차도 "매년 조금씩 바꾼다"다. 그래서 최적해를 찾지 않는다 — **상한이 연속성을 강제한다.**

rev 1 은 여기에 탐욕적 이동 **생성기**를 뒀다. rev 2 에서 생성은 에이전트가 하고(§6.3), 이 절은 **에이전트가 지켜야 할 제약**을 정의한다. 아래 목록은 프롬프트에도 들어가고 게이트(§6.3 G1~G7)도 같은 것을 본다 — **둘이 상수 하나에서 나와야** 프롬프트와 검산이 어긋나지 않는다(`objective.ts` 의 `ASSIGNMENT_LIMITS`).

```
C1 assignable = true 인 운영자만 배정받는다.
C2 이동은 같은 tenure_group 안에서만. 그룹 간 이동 금지.
C3 상한: 운영자 1인당 3곳 / 배치 전체 15곳.
C4 갈린 44곳과 하위유형이 갈린 건은 건드리지 않는다.
C5 옮길 수 있는 대학은 "그 업무종류의 모든 하위유형을 한 사람이 혼자 맡은" 단순 건만.
C6 대학은 통째로 옮긴다(한 업무종류 안에서). 쪼개지 않는다.
C7 상담앱은 대상이 아니다(결정 6).
C8 이동은 Σdev 를 개선해야 한다 — 과부하자에서 저부하자 방향으로만.
```

**제약은 두 자리에서 지켜진다 — 입력에서 빼거나, 출력에서 거부한다.** 게이트(§6.3)가 C 전부와 1:1 대응하지 않는 것은 누락이 아니라 분담이다.

| 제약 | 어떻게 지켜지나 |
|---|---|
| C1 · C2 · C3 · C4 · C8 | **출력 게이트** — 차례로 G1 · G3 · G5 · G4 · G6 이 거부한다 |
| C5 · C6 · C7 | **입력 차단** — 후보 목록에 단순 건만 담고 상담앱을 아예 넣지 않는다(§6.3 입력표). 제안할 수 없는 것은 거부할 필요가 없다 |
| (대응 C 없음) | G2(경합) · G7(근거 문장)은 배정 정책이 아니라 **응답의 형태**를 본다 |

입력 차단이 게이트보다 나은 자리가 있다. 후보에 없는 대학을 모델이 들고 오면 그건 제약 위반이 아니라 **환각**이고, `parse-response` 가 '모르는 대학명'으로 먼저 떨군다.

**44곳은 건드리지 않는다.** 여러 운영자로 갈린 대학은 사람이 이유가 있어 갈라놓은 것으로 보고 보존한다. 하위유형이 갈린 건(수시/정시 담당자가 다른 경우)도 같다. 자동 이동은 단순한 건만 만지고, 복잡한 건은 목록에 '분할'로 표시해 사람에게 남긴다.

**대학은 통째로 옮긴다**(한 업무종류 안에서). 쪼개면 한 대학에 담당자가 늘어 대학 쪽 혼선이 커진다. 업무종류끼리는 독립 처리한다 — 원서접수 담당과 PIMS 담당은 원래 다를 수 있다.

**승격은 따로 다루지 않는다.** 3월에 관리자가 누군가의 `tenure_group`을 올리면 그 사람은 새 그룹의 target과 비교되므로 자동으로 조정 후보가 된다.

### 6.2 근거 데이터의 원천과 그 한계

| 근거 | 원천 | 비고 |
|---|---|---|
| 연차 그룹 | `operators.tenure_group` | 사람이 넣는다 |
| 담당 대학 수 | `assignments` (확정 원장) | 학년도로 자른다 |
| 서비스 건수 | **업무종류마다 다르다 — 아래 표를 본다** | 학년도 창 = `academicYearRangeKST` |
| 대학당 서비스 수 | 위 둘의 비 | |
| 주·월·연 진행 건수 | `services.write_start_at` ~ `write_end_at` **겹침** | 배분현황 탭 표시 |

**`closing_services` 는 담당자가 아니라 건수를 위해 쓴다.** rev 1 은 "쓰지 않는다"고 적었는데 그건 구분을 놓친 것이다. 그 테이블의 `operator_name` 은 append 미러의 낡은 스냅샷이라 **담당자로는 못 쓴다**(§1). 하지만 **대학별 서비스 수**를 셀 때는 담당자 칸을 보지 않으므로 아무 문제가 없다 — 담당자는 원장에서 오고, 건수는 대학 이름으로 집계한다. 이 구분이 rev 2 에서 네 업무종류의 원천을 되찾아 준다.

| 업무종류 | 건수 원천 | 실측(2026학년도) |
|---|---|---|
| 원서접수 | `services`(`operator_email` FK) + `closing_services` 대학별 집계 | 928건 / 286곳 |
| 대학원 | **`closing_services` 에 이미 있다** — 구분이 `대학원 후기` 260 · `대학원` 86 · `대학원 전기` 30 · 법학전문대학원 5 | 381건 / 52곳 |
| PIMS · 발표 | **`announcement_services`** — `last_announce_at` 으로 연도를 자른다. 담당자는 총괄장에서 이름 동기화(`announcement-services/sync-operators.ts`) | 1145행(2024:80 / 2025:403 / 2026:662), 배정 대상 **15명 전원**이 담당자로 등장(1인 32~93행 / 3~8곳), `operator_synced_at` 991행 |
| 성적산출 | **없다** | 대학 수만으로 부하를 본다 |
| 상담앱 | — | **자동 배정 대상이 아니다**(사용자 결정 rev 2). 화면에는 보이되 제안을 만들지 않는다 |

**남은 한계는 성적산출 하나다.** `services` 는 원서접수 카탈로그라(`application_type` 이 공통원서/반응형원서/일반접수) 성적산출 건수가 어디에도 없다. 그 업무종류만 대학 수로 본다.

**스크래퍼는 여전히 만들지 않는다**(사용자 결정 2). 위 두 원천은 이미 DB 에 있는 것이고 Moa `Statistics/RealTime` 을 긁지 않는다.

### 6.3 에이전트 판정과 제약 검산

판정은 회사 PC 의 Agent SDK 가 한다. 서버는 **입력표를 조립하고 응답을 검산한다**(어시스턴트 선례 — 프롬프트가 서버에 있어야 표현을 고칠 때 회사 PC 를 안 만진다).

에이전트에게 주는 것은 표 넷이다. 배정 대상과 그룹, 그룹별 목표(`target`), 운영자별 실측(`univ`·`svc`·`dens`), 그리고 옮길 수 있는 대학 후보 목록이다. 받는 것은 **이동 목록**이고 각 줄에 대학·업무종류·하위유형·역할·이전 담당자·제안 담당자·근거 문장이 있어야 한다.

**응답은 그대로 믿지 않는다.** 다음을 어긴 줄은 배치에 담기지 않고 그 이유가 보고에 남는다.

```
G1. 제안 담당자가 assignable = true 인가
G2. 이전 담당자가 지금 원장의 값과 같은가        (경합 — §5.4)
G3. 이동이 같은 연차 그룹 안인가                  (그룹 간 이동 금지 — §6.1)
G4. 분할 44곳·하위유형이 갈린 건이 아닌가
G5. 상한을 넘지 않는가  (운영자당 3곳 / 배치 15곳)
G6. Σdev 가 개선되는가  (§6.1 의 목표 함수를 검산기로 쓴다)
G7. 근거 문장이 비어 있지 않은가
```

**G6 이 산식을 살려 두는 자리다.** rev 1 의 목표 함수는 배정을 만드는 도구에서 **판정을 채점하는 도구**로 역할만 바뀌었다. 이것이 없으면 모델이 44곳을 흩어 놓거나 한 사람에게 30곳을 몰아주는 배치가 관리자 화면까지 올라온다.

**단건 배정**(관리자가 한 서비스를 지목)도 같은 경로를 쓰되, 후보가 좁아 에이전트 없이 끝나는 경우가 많다. 같은 대학·같은 업무종류를 이미 맡은 사람이 있으면 그 사람이고(근거: "이 대학의 원서접수를 이미 담당"), 그것도 없으면 에이전트에게 묻는다. **후보가 없으면 미배정으로 두고 보고한다 — 추측해 채우지 않는다.**

**테스트는 배정값을 단언하지 않는다.** 같은 입력에 다른 답이 날 수 있으므로, RED 은 **G1~G7 게이트가 위반 줄을 걸러내는지**를 단언한다. 게이트는 순수 함수라 결정적이고, 모델 응답은 고정 fixture 로 주입한다.

### 6.4 잡 구성 — 둘로 나눈다

**판정이 회사 PC 에 있으므로 서버 잡과 판정을 가른다**(rev 2). 경쟁률 점검과 같은 구조다 — 서버 잡은 **요청을 적재**하고, 회사 PC 폴러가 **claim 해 판정**한다.

| 잡 | id | cadence | 실행 주체 | 하는 일 |
|---|---|---|---|---|
| 학년도 배정 요청 적재 | `assignment-year-rollover` | `daily` | cron-job.org → `/api/automations/run` | 현재 학년도의 annual 배치가 없으면 **판정 요청을 `pending` 으로 적재**. 있으면 `skipped`. 더불어 **3월 갱신 상기**를 보고에 한 줄 붙인다(아래) |
| 미배정 감지 | `assignment-unassigned-sweep` | `weekday` | 같음 | 배정이 없는 (대학×업무종류)·새 서비스를 찾아 **단건 판정 요청 적재** + 보고 |
| 판정 실행 | 잡이 아니다 | 5분 폴링 | **회사 PC 폴러** | `pending` 을 원자적 claim → Agent SDK 판정(§6.3) → G1~G7 검산 → 제안 배치 적재 → 보고 endpoint 로 결과 회신 |
| 엑셀 내보내기 | `assignment-export` | `manual` (`manualOnly: true`) | admin 버튼 | §7 |

요청 큐는 `ratio_audit_requests` 의 모양을 그대로 따른다 — 조건부 UPDATE 원자적 claim, `STALE_RUNNING_MS` 초과 `running` 자동 `failed`, 그리고 **pending/running 이 있으면 새 적재를 막는다**(같은 판정이 두 벌 돌아 제안 배치가 겹치는 것을 막는다).

**왜 정기 생성이 `daily`인가.** 연 1회 잡을 `cadence`에 담을 값이 없다(`hourly|weekday|daily|weekly|monthly|manual`). `monthly`로 두면 미실행 판정이 매달 오탐하고, `manual`로 두면 **판정 대상에서 빠져 3월 1일에 안 돌아도 아무도 모른다** — 그게 정확히 "코드 밖에서 끝나는" 사각지대다. 그래서 잡을 매일 돌리고, 학년도가 바뀌었는데 그 학년도의 배치가 없을 때만 만든다. 셋이 따라온다: 미실행 감지가 `daily` 임계로 정상 작동하고, 3월 1일에 cron이 실패해도 다음 날 만들어지며, 나머지 364일은 `skipped: true`라 실패 집계에 안 들어간다(`AutomationRunResult.skipped`가 이미 그 뜻이다).

**왜 두 잡인가.** 주기가 다르고 실패의 뜻이 다르다 — 연간 생성 실패는 '새 학년도를 시작할 수 없다'이고, 미배정 감지 실패는 '새 서비스가 무주공산이다'다. 한 잡에 묶으면 3월 1일의 대량 변경과 평일의 1건 추가가 같은 이력 줄에 섞여 "왜 오늘 300건이 바뀌었나"를 구분할 수 없다.

**회사 PC 가 필요하다**(rev 2). 판정이 Agent SDK 이고 서버에는 LLM 호출 경로가 없다(§4). 이 구조의 값은 **서버 잡이 매일 돌아 기록을 남긴다는 점**이다 — PC 가 꺼져 있어도 요청 적재는 계속되고, 그래서 PC 중단이 '조용한 무동작'이 아니라 **pending 적체**로 드러난다. 잡은 모두 `recordAutomationRun` 을 통과하고, 회사 PC 는 보고 endpoint 에서 같은 함수를 부른다(`/api/closing/run-log` 가 그렇게 한다).

관리자 화면의 '이 서비스 배정해줘' 버튼은 **단건 판정 요청을 적재**하고 폴러가 5분 안에 가져간다. 같은 대학·같은 업무종류를 이미 맡은 사람이 있으면 그 자리에서 끝나 요청을 만들지 않는다(§6.3) — 흔한 경우가 즉시 처리되고 애매한 경우만 판정으로 간다.

#### 3월 갱신 상기 — 무엇을 보고 판정하는가 (결정 5)

그룹은 저장값이라 **아무도 안 고치면 작년 그룹으로 배정이 돈다.** rollover 가 요청을 적재할 때 지금 그룹 구성을 **직전 annual 배치의 `basis.groups` 와 비교**해 같으면 보고에 한 줄을 붙인다.

```
⚠ 연차 그룹이 2026학년도 배치와 동일합니다 — 3월 갱신을 확인하세요.
```

**`operators.updated_at` 을 쓰지 않는다.** 전화번호 한 칸만 고쳐도 시각이 움직여 **'그룹을 검토했다'로 읽힌다** — 그 신호는 거짓이면서 조용하다. 컬럼을 새로 두지도 않는다: 알고 싶은 것은 '언제 고쳤나'가 아니라 '작년과 같은가'이고, 그 답은 이미 `basis` 에 얼려 둔 값에 있다(§5.4). 첫 해에는 비교 대상이 없어 이 줄이 안 나온다(정상).

---

## 7. 엑셀 내보내기

### 7.1 운영자들이 보는 파일을 앱이 쓰는 위험

| 안 | 내용 | 판정 |
|---|---|---|
| A. `02. 배정리스트`를 직접 PATCH | 대학명으로 행을 찾아 담당자 칸만 갱신 | **위험**. 사람이 행을 삽입하면 좌표가 밀려 남의 칸을 쓴다. 되돌리기가 파일 버전 이력뿐이다 |
| B. **같은 파일에 앱 전용 시트** `(앱) 배정확정` | 사람이 쓰는 02~07 은 건드리지 않는다 | **채택** |
| C. 별도 파일로 내보내 링크 공지 | 가장 안전 | 강등한 파일이 계속 살아 서로 다른 값을 보인다 — 결정 1과 어긋난다 |

**B를 고른 이유**: 사람 편집 영역과 앱 쓰기 영역이 물리적으로 갈리고, 운영자는 여는 파일이 그대로다(탭만 다르다). 그리고 앱은 그 시트를 **통째로 다시 쓴다** — 행 매칭도 좌표 계산도 없으므로 남의 칸을 지우는 경로가 존재하지 않는다. 재실행은 멱등이다.

시트 이름에 번호를 붙이지 않는다 — `05.모의논술`·`08.채널`이 이미 있어 번호는 충돌한다. `(참고) 업무분장`과 같은 접두 형식을 따른다. 시트가 없으면 앱이 만든다.

**1행에 경고를 박는다**: `이 시트는 OPS-Console 이 자동으로 다시 씁니다 — 직접 고친 내용은 다음 내보내기에 사라집니다.`

### 7.2 열 구성 — 학년도가 열로 늘어난다 (결정 3)

```
r0: 대학명 | 대분류 | 2027 운영자(6) | 2027 개발자(6) | 2026 운영자(6) | 2026 개발자(6) | 대학원(2) | PIMS(2) | 성적산출(2) | 상담앱(2)
r1:       |        | 재외 수시 정시 편입 외국인 백업자 | (동일) | (동일) | (동일) | 운영 개발 | 운영 개발 | 운영 개발 | 운영 개발
```

> **PIMS 칸이 어긋난다.** 위 r1은 4종을 모두 `운영 개발`로 적었는데 §3.1대로 PIMS에는 개발자가 없고 하위유형이 `FULL/환충`이다. 내보내기(PR8)에서 PIMS 2칸을 `FULL 환충`으로 둘지, `운영`만 두고 1칸으로 줄일지 그때 정한다 — PR3의 이관은 §3.1을 따른다.

`02. 배정리스트`의 2줄 헤더 모양을 그대로 재현한다 — 눈에 익은 형태가 곧 이관의 비용을 줄인다. 원서접수 외 4종을 같은 시트에 합치는 이유는 화면의 대학배정 표와 같은 모양이기 때문이다(대학 한 행에 전부 보인다).

**두 학년도만 싣는다**(현재 + 직전). `02` 시트가 오늘 2027/2026 두 해만 갖고 있는 것과 같고, 셋 이상은 DB에서 본다 — 시트는 산출물이라 원천의 전부를 실을 의무가 없다. 학년도가 하나 늘면 열이 20칸 오른쪽으로 밀린다(그게 결정 3이다).

### 7.3 쓰는 방법

`features/receivables/sheet-write.ts` 패턴: 토큰 1회 + `getWorkbookSession` 1회 + 408/503/504면 `refreshWorkbookSession` 후 1회 retry. 단, 행별 PATCH가 아니라 **한 range에 2차원 배열 한 번**으로 쓴다(부분 실패 창을 없앤다). 행 수가 줄었으면 잔여 구간을 `range/clear`.

**확정본만 나간다** — 제안은 내보내지 않는다. **수동 트리거만**이다: 자동으로 매일 쓰면 사람이 열어 둔 파일의 값이 불시에 바뀐다. `ASSIGNMENT_EXPORT_DRY_RUN=true`면 조립까지만 하고 Graph를 부르지 않는다(`MAIL_DRY_RUN` 관례).

---

## 8. 실패는 어디로 가나

원칙은 기존과 같다. **Teams 메시지는 흘러가고 목록은 남는다** — 둘 다 쓴다.

| 무엇 | 화면 | Teams |
|---|---|---|
| 연간 제안 생성 | 제안 탭 배치 1건 | 관리자 노트 채팅: "2027학년도 제안 N건 / 변경 대학 M곳" + 링크 |
| 미배정 | 목록 행에 **`미배정` 배지** | 미배정 감지 잡이 건수 보고 |
| 이름 미매칭 (`assignee_email` null) | 인스펙터에 **`연결 안 됨`** | 같은 메시지의 '닿지 않은 것' 절 |
| 제안 적용 경합 | 그 행에 **`그 사이 바뀜`** | 적용 결과 요약에 건수 |
| 잡 실패 | 자동화 페이지 이력 | `recordAutomationRun` → 실패 즉시 + 일일 보고 |
| 내보내기 실패 | 자동화 페이지 이력 | 같음 |

발신은 경쟁률 점검·팀 뉴스레터와 같은 계정(`TEAMS_AUTOMATION_SENDER` → `TEAMS_BRIEFING_SENDER` → 기본값), 관리자 취합은 `48:notes`. 담당 미상·실패·건너뜀을 **한 메시지에 모으는 모양**은 `features/ratio-audit/dispatch.ts`를 따른다 — 조용히 묻히는 경로를 만들지 않는다.

**담당 운영자에게 개인 발송을 하지 않는다.** 배정 변경은 관리자의 결정이고, 확정 전 제안이 당사자에게 먼저 가면 안 된다. 확정된 배정은 화면과 내보낸 시트로 본다.

### 실패 모드

| # | 상황 | 어떻게 드러나는가 | 어디로 |
|---|---|---|---|
| F1 | 대학명 표기가 갈린다(`서울대` vs `서울대학교`) | 새 대학으로 보여 미배정 1건이 뜬다 | 정규화는 trim + 공백 접기까지만. **별칭을 추측해 잇지 않는다** — 보고하고 사람이 고친다 |
| F2 | 이름 → 이메일 미매칭 | `assignee_email` null + `연결 안 됨` 배지 | 이름 스냅샷은 남으므로 배정 자체는 보인다 |
| F3 | `assignable`을 아무도 안 켰다 | 제안이 0건 | 배분현황 탭 머리에 **'배정 대상 N명'**. 0이면 제안 버튼이 이유를 말한다 |
| F4 | `tenure_group`이 빈 사람이 있다 | 그 사람은 target 계산에서 빠진다 | 배분현황 탭에 '그룹 미설정' 줄로 뜬다. 조용히 평균에 섞지 않는다 |
| F5 | 3월 1일에 cron 실패 | 다음 날 만들어진다(§6.4) | 이틀 이상이면 미실행 감지가 잡는다 |
| F6 | 사람이 `02` 시트를 고친다 | **드러나지 않는다** — 앱은 그 시트를 안 읽는다(1회 이관 후) | 열린 질문 3 |
| F7 | 내보내기 중 Graph 504 | 세션 재발급 1회 retry → 실패면 이력 + Teams | 시트가 반쯤 쓰이지 않는다(한 번의 PATCH) |
| F8 | 제안 적용 중 누군가 손으로 고침 | `prev_assignee` 대조 → 그 행만 건너뛴다 | `그 사이 바뀜` 배지 |
| F9 | 배정 대상이 한 명뿐인 그룹 | target = 그 사람 자신이라 편차가 0 | 이동 후보가 안 생긴다(정상). 그룹 간 이동은 안 한다 |
| F10 | 재입사자의 `career_start_at` 누락 | 연차가 실제보다 짧게 보인다 | 그룹은 저장값이라 배정에 영향 없다. 배분현황의 연차 표시만 틀린다 |
| F11 | **에이전트 응답이 제약을 어긴다** | 그 줄이 배치에 담기지 않는다(G1~G7) | 보고에 '검산 탈락 N건'과 어긴 게이트를 적는다. 전부 탈락하면 제안 0건이고 **그 이유가 남는다** — 조용히 빈 배치가 되지 않는다 |
| F12 | **회사 PC 폴러가 안 돈다** | 제안이 생기지 않는다 | 서버 잡은 계속 돌아 요청을 적재하므로 **pending 적체**로 드러난다. 폴러 하트비트 + 적체 건수를 관리자 보고에 싣는다 |
| F13 | 에이전트 응답이 JSON 으로 파싱되지 않는다 | 판정 1회 실패 | 폴러가 `failed` 로 회신하고 `recordAutomationRun` 이 실패를 남긴다. 다음 날 요청이 다시 적재된다(F5 와 같은 구조) |
| F14 | **관리자가 `operators` 의 이메일을 바꾸거나 행을 지운다** | **드러나지 않는다** — FK 가 원장을 따라 고치지만(`on update cascade`) 또는 비우지만(`on delete set null`) server action 밖이라 `assignment_changes` 행이 안 남는다. 실측: 삭제 전후 이력 행수 2 → 2. `updated_at` 만 움직이고 `updated_by` 는 이전 편집자로 남아 거짓 귀속이 된다 | **원장을 바꾸며 이력을 안 남기는 경로가 둘이고 둘 다 FK 다.** FK 의미는 바꾸지 않는다 — cascade 를 떼면 정당한 이메일 변경이 `23503` 으로 막혀 이력 구멍이 UX 고장으로 바뀔 뿐이고, 이력 칸은 설계상 FK 없는 스냅샷이라 **어떤 FK 설정으로도 동기화되지 않는다.** 막는 자리는 둘이다: **PR2** 가 운영자 수정 action 에서 원장 갱신과 이력 적재를 한 트랜잭션에 담고, **PR4** 되돌리기가 되돌릴 주소가 `operators` 에 없으면 원장에 쓰지 않고 `연결 안 됨` 으로 돌려준다 |

---

## 9. 화면

### 9.1 기존 3탭과의 관계 — 대학배정 탭을 **교체한다**

| 탭 | 지금 | 이후 |
|---|---|---|
| `?tab=univ` 대학배정 | 5시트 Graph GET, readOnly | **DB 원장**. admin 편집 + 이력 + 미배정 배지 |
| `?tab=proposals` 제안 | — | **신규** (admin only) |
| `?tab=workload` 배분현황 | — | **신규** — 근거를 눈으로 보는 자리 |
| `?tab=duties` 업무분장 | 시트 그리드 | 그대로 |
| `?tab=pricing` 가격정책 | 시트 파싱 | 그대로 |

**공존시키지 않는다.** 같은 화면에 같은 뜻의 표가 둘이면 어느 쪽이 사실인지 매번 물어야 하고, 시트 뷰를 남기는 것은 강등이 아니라 이중화다(결정 1). 업무분장·가격정책은 배정과 무관한 참고 자료라 그대로 둔다. 헤더의 **`총괄장` 원본 파일 버튼도 유지**한다 — 내보낸 결과를 확인하는 경로다(`workbook/assignments-master`, `WORKBOOKS`에 이미 등록).

**전환 안전장치**: 교체 전에 가져오기로 시트 값을 DB에 넣고, **시트 ↔ DB 대조를 통과해야 한다**(PR3). 대조는 대학 수·칸 수·칸별 이름 일치까지 본다.

### 9.2 대학배정 탭

`list-variants/assignments/`가 이미 있다(`View` + `Table` + `ASSIGNMENTS_FILTERS`). **데이터 소스만 바꾼다**: `_row-mapper.ts`가 시트 조인 결과 대신 원장 행을 `ListRow`로 옮긴다. 기존 것을 그대로 쓴다 — 검색(대학명·담당자 양방향), `내 배정` 칩, 대분류 필터, 페이지네이션 30.

추가되는 것:
- **`EditForm`**(신규 슬롯 — registry 1줄): admin이 업무종류·하위유형·역할별 담당자를 고친다. 후보는 `assignable` 운영자. 저장은 server action → 원장 UPDATE + `assignment_changes` INSERT.
- **인스펙터에 `변경 이력` 절**: 그 대학의 `assignment_changes`를 최신순으로. 각 줄에 `되돌리기`. 이력을 별도 탭으로 빼지 않는 이유는 이력을 보고 싶은 순간이 그 대학을 보고 있는 순간이기 때문이다.
- **배지**: `미배정` / `연결 안 됨` / `분할`(여러 담당자).

시각은 `kstFormat`(`kstDateTime`), 건수·대학 수는 **기본 폰트 + `tabular-nums`**, 호버·선택은 CLAUDE.md 인터랙션 표준, 헤더 액션은 `HeaderActionButton`.

### 9.3 제안 탭 (admin only)

배치 목록 → 배치 하나를 고르면 변경 행이 표로 뜬다: `대학 | 업무종류 | 하위유형 | 역할 | 이전 → 제안 | 근거`. 버튼은 `전체 적용` / `행별 적용` / `반려`. 배치 머리에 `basis`(그룹별 목표와 실측, 상한)를 펼쳐 본다 — **관리자가 에이전트가 관리하는 모든 사항을 확인할 수 있어야 한다**는 요구가 여기서 충족된다.

### 9.4 배분현황 탭

운영자 한 줄에: `이름 | 그룹 | 경력 | 대학 수 | 서비스 건수 | 밀도 | 그룹 목표 대비 | 주 | 월 | 연`. 그룹으로 묶어 보여주고 그룹 머리에 target을 적는다. 편차가 임계를 넘은 줄을 강조한다. 여기가 §6의 근거를 사람이 검산하는 자리다.

### 9.5 권한

| 행위 | 누구 |
|---|---|
| 대학배정 탭 열람 | **전원** (`requireMenu('assignments')`) — 오늘도 전원이 총괄장을 본다 |
| 담당자 편집 · 제안 적용 · 되돌리기 · 내보내기 | **admin only** (`requireAdmin` + server action 재검사) |
| 제안 탭 · 배분현황 탭 | admin only (RLS도 `is_admin()`) |

배정은 남의 업무량을 정하는 일이라 열람과 편집을 가른다. 개발자 배정을 개발부가 직접 넣을지는 → 열린 질문 1. 배분현황을 전원에게 열지는 → 열린 질문 2.

---

## 10. 영향 파일

### 신규 (약 38 — rev 2 에서 판정 큐·폴러·검산으로 8 증가)

| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260913_assignments_tables.sql` | 테이블 4 + 인덱스 + RLS/GRANT |
| `supabase/migrations/20260913b_operators_assignment_columns.sql` | 컬럼 3 + 시드 |
| `src/features/assignments/tenure.ts` | `TENURE_GROUPS` as const + `careerStartOf` |
| `src/features/assignments/ledger-schemas.ts` | zod + 자연키 타입 |
| `src/features/assignments/ledger-queries.ts` | 원장·이력·제안 조회 |
| `src/features/assignments/actions.ts` | `updateAssignment`/`revertChange`/`applyProposal`/`rejectProposal`/`importAssignments`/`exportAssignments` |
| `src/features/assignments/import.ts` | 시트 → 원장 행 (순수) |
| `src/features/assignments/diff.ts` | 바뀐 칸 추출 (`diff-row.ts` 선례) |
| `src/features/assignments/workload.ts` | 부하 집계 (순수) |
| `src/features/assignments/proposal/objective.ts` | target·편차 (순수) — rev 2 에서 **검산 점수**로 역할 변경 |
| `src/features/assignments/proposal/gate.ts` | **G1~G7 제약 검산** (순수, rev 2 신규) |
| `src/features/assignments/proposal/prompt.ts` | **입력표 조립 + 프롬프트** (서버에 둔다, rev 2 신규) |
| `src/features/assignments/proposal/parse-response.ts` | **모델 응답 파싱** (순수, rev 2 신규) |
| `src/features/assignments/proposal/single.ts` | 단건 즉시 판정 (순수) — 후보가 좁을 때 에이전트를 거치지 않는다 |
| `src/features/assignments/proposal/persist.ts` | 배치 적재 |
| `src/features/assignments/proposal/report.ts` | Teams HTML |
| `src/features/assignments/propose-requests/enqueue.ts` | **판정 요청 적재** (rev 2 신규, `ratio-audit/audit-requests` 선례) |
| `supabase/migrations/20260913c_assignment_propose_requests.sql` | **판정 요청 큐** (rev 2 신규) |
| `src/app/api/assignments/propose-request/route.ts` | **claim + 결과 회신** (CRON_SECRET, rev 2 신규) |
| `scripts/assignments/propose-local.mjs` | **회사 PC 폴러 — Agent SDK 판정** (rev 2 신규) |
| `scripts/assignments/register-propose-task.ps1` | 스케줄러 등록 5분 (rev 2 신규) |
| `src/features/assignments/export-sheet.ts` | 열 조립(순수) + Graph 쓰기 |
| `src/features/automations/jobs/assignment-year-rollover.ts` | 잡 |
| `src/features/automations/jobs/assignment-unassigned-sweep.ts` | 잡 |
| `src/features/automations/jobs/assignment-export.ts` | 잡 (manualOnly) |
| `.../list-variants/assignments/EditForm.tsx` | admin 편집 |
| `src/app/dashboard/assignments/_components/ProposalPanel.tsx` | 제안 탭 |
| `src/app/dashboard/assignments/_components/WorkloadTable.tsx` | 배분현황 탭 |
| `__tests__/` 약 10 | 아래 태스크의 RED |

### 수정 (약 15 — rev 2 에서 폴러 창구 가드로 3 증가)

| 파일 | 변경 |
|---|---|
| `src/features/assignments/schemas.ts` | 원장 타입 추가(기존 `SERVICE_KINDS` 재사용) |
| `src/app/dashboard/assignments/page.tsx` | 탭 5개 + DB 소스 |
| `src/app/dashboard/assignments/_row-mapper.ts` | 원장 행 → `ListRow` |
| `.../list-variants/registry.ts` | `assignments`에 `EditForm` 1줄 |
| `.../list-variants/assignments/View.tsx` | 이력 절 + 배지 |
| `.../patterns/ListPattern.tsx` | `ListRow` 배정 필드 확장 |
| `src/features/operators/schemas.ts` | `assignable`·`tenure_group`·`career_start_at` zod |
| `src/features/operators/actions.ts` | 위 3필드 저장 |
| `.../list-variants/team/{View,EditForm}.tsx` | 3필드 표시·편집 |
| `src/features/automations/registry.ts` | 잡 3건 |
| `src/proxy.ts` | `PUBLIC_PATHS` 에 폴러 창구 1줄 (rev 2 — 없으면 307) |
| `src/__tests__/proxy-cron-paths.test.ts` | `CRON_ROUTES` 1줄 (rev 2) |
| `src/proxy.test.ts` | 케이스 1개 (rev 2) |
| `CLAUDE.md` | '업무배정' 절 신설 |

**합계 약 53파일** → HARD-GATE **전체 설계 등급**(이 문서). DB 스키마 + 권한 로직 + 외부 폴러로 복잡도 보정도 걸린다. worktree 권장:

```
git worktree add ../OPS-Console-feat-work-assignment feat/work-assignment
```

---

## 11. 태스크 (PR 분해)

순서가 곧 안전장치다. **스키마 → 사람 값 → 이관·대조 → 화면 → 근거 → 제안 → 잡 → 내보내기.** 어느 지점에서 멎어도 기존 시트 조회가 계속 돈다(PR4까지는 화면이 시트를 본다).

```
PR1(스키마) ─ PR2(운영자 칸) ─ PR3(이관·대조) ─ PR4(화면 교체) ─┬─ PR5(배분현황) ─┐
                                                                      └─ PR6(검산·프롬프트) ┴─ PR7(큐·폴러·잡·제안) ─ PR8(내보내기) ─ PR9(문서)
```

병렬 가능: **PR5 / PR6**(둘 다 순수 함수, 서로 안 부른다).

### PR1 — 스키마 + 어휘 (5파일 · 간략 설계)

- **파일**: 마이그레이션 2, `assignments/ledger-schemas.ts`, `__tests__/ledger-schemas.test.ts`, `__tests__/migration-contract.test.ts`
- **RED**: 자연키 zod가 `subtype` 빈 문자열을 통과하고 `null`은 거부한다 / `role`이 `운영|개발` 밖을 거부한다 / **`migration-contract.test.ts`가 마이그레이션 SQL 원문을 읽어 컬럼명·자연키 컬럼 순서를 코드 상수와 대조한다**(`features/sms-codes/__tests__/rpc.test.ts` 선례 — 라우트 테스트는 mock에 대고 단언하므로 이름이 어긋나도 초록인 채로 프로덕션에서 죽는다)
- **검증**: `npm test -- src/features/assignments` + §5.2의 검증 SQL을 사용자가 SQL Editor에서 실행(`assignable` 15건)
- **의존**: 없음

### PR2 — 운영자 칸 (8파일 · 간략 설계)

- **파일**: `assignments/tenure.ts`, `operators/schemas.ts`, `operators/actions.ts`, `team/{View,EditForm}.tsx`, `ListPattern.tsx`, tests 2
- **RED**: `careerStartOf({career_start_at:null, hired_at:'2016-07-27'})` → `'2016-07-27'` / 저장된 경력 시작일이 있으면 그것 / `TENURE_GROUPS` 정렬이 연차 순 / zod가 미등록 그룹 값을 거부 / admin이 아니면 저장 거부
- **검증**: `npm test -- src/features/operators src/features/assignments` · 조직 화면에서 한 명을 켜고 그룹을 넣어 저장 1회
- **의존**: PR1

### PR3 — 이관 + 대조 (6파일 · 간략 설계)

- **파일**: `assignments/import.ts`, `actions.ts`(`importAssignments`), `ledger-queries.ts`, tests 3
- **RED**: `02` 고정 fixture → 2027 운영/개발 × 6 하위유형이 12행이 된다 / `04. PIMS`는 개발 행이 **안 생긴다**(`subtype: 'FULL'|'환충'`) / 빈 칸은 행을 만들지 않는다 / 대학명 정규화는 trim + 공백 접기까지만이고 **별칭을 잇지 않는다** / 같은 fixture를 두 번 넣어도 자연키로 멱등 / 대조 함수가 시트 칸 수와 원장 행 수 불일치를 건수로 돌려준다 / **담당자 없는 칸은 이력 행을 만들지 않는다** — 그러면 `prev=next=null` 이 되어 check 제약이 트랜잭션을 통째로 죽인다(`23514` 실측). 미배정은 설계가 정상으로 인정한 상태다(F2)
- **구현**: 기존 `parse.ts`를 그대로 재사용(파서는 손대지 않는다). 적재는 admin server action 1회 실행
- **검증**: `npm test -- src/features/assignments` · 라이브 1회 실행 후 대조 0건 불일치 + `select count(*) from assignments where academic_year=2027;`
- **의존**: PR1

### PR4 — 화면 교체 (9파일 · 간략 설계)

- **파일**: `page.tsx`, `_row-mapper.ts`, `assignments/{View,EditForm}.tsx`, `registry.ts`, `actions.ts`, `ListPattern.tsx`, tests 2
- **RED**: 원장 행 → `ListRow`가 대학 한 행에 업무종류를 모은다 / `미배정`·`연결 안 됨`·`분할` 배지가 **텍스트가 아니라 클래스까지** 단언된다(텍스트만 보면 표준 위반이 초록 CI를 통과한다) / 비-admin의 `updateAssignment`가 거부된다 / 저장이 `assignment_changes` 1행을 남기고 **값이 같으면 안 남긴다**(check 제약과 같은 불변식) / `되돌리기`가 새 이력 행을 만든다(삭제하지 않는다) / **되돌릴 주소가 `operators` 에 없으면**(이메일 변경으로 cascade 된 뒤) 원장에 쓰지 않고 `연결 안 됨` 으로 돌려준다 — 그냥 쓰면 FK 23503 이다(F14)
- **검증**: `npm test` · `npm run typecheck` · `npm run lint` · 화면에서 한 칸 변경 → 이력 → 되돌리기 1회
- **의존**: PR3

### PR5 — 배분현황 (5파일 · 간략 설계)

- **파일**: `assignments/workload.ts`, `WorkloadTable.tsx`, `page.tsx`, tests 2
- **RED**: 대학 수·건수·밀도 산출 / 학년도 창이 `academicYearRangeKST`를 쓴다(**자체 정의 금지** — 테스트가 그 모듈을 spy한다) / 주·월·연 진행이 **겹침**으로 세어진다(구간 양끝 경계 포함) / 그룹 미설정자가 평균에 섞이지 않는다 / `assignable=false`는 집계에서 빠진다
- **검증**: `npm test -- src/features/assignments` · 화면 수치를 §3.5 측정치와 눈으로 대조
- **의존**: PR4

### PR6 — 검산 + 프롬프트 + 단건 (8파일 · 간략 설계)

**전부 순수 함수다.** 에이전트 응답은 fixture 로 주입하므로 이 PR 에 모델 호출이 없다 — 판정의 옳음을 기계로 검사할 수 있는 부분을 먼저 못 박는다.

- **파일**: `proposal/{objective,gate,prompt,parse-response,single}.ts`, tests 3
- **RED**:
  - `gate` 가 G1~G7 을 각각 걸러낸다 — **배정 대상 아님 · 경합 · 그룹 밖 이동 · 분할 44곳 · 상한 초과 · Σdev 악화 · 근거 빈 줄**을 케이스마다 한 건씩
  - `target` 이 그룹 평균이고 **그룹 간 비교를 하지 않는다**(한효진과 김승현을 같게 만들려는 이동은 G3 에서 탈락한다)
  - `parse-response` 가 JSON 이 아닌 응답·필드 누락·모르는 대학명을 **거부하고 이유를 돌려준다**(던지지 않는다 — 폴러가 `failed` 로 회신해야 한다)
  - `prompt` 가 배정 대상만 입력표에 담는다(`assignable=false` 와 그룹 미설정자가 안 들어간다). **비밀값이 프롬프트에 섞이지 않는다**
  - 단건: 같은 대학·같은 업무종류 담당자가 있으면 **에이전트를 거치지 않는다** / 없으면 '판정 필요'를 돌려준다 / 배정 대상이 0명이면 미배정
- **검증**: `npm test -- src/features/assignments/proposal`
- **의존**: PR4 (원장 타입)

### PR7 — 큐 + 회사 PC 폴러 + 잡 + 제안 탭 (19파일 · **전체 설계 상한 초과**)

**상한을 넘으므로 둘로 쪼갤 수 있다** — (7a) 큐·폴러·판정, (7b) 잡·제안 탭. 7a 만 머지해도 관리자 화면에서 수동 요청으로 판정을 돌려 볼 수 있으므로 쪼개는 편이 안전하다.

- **파일**: 마이그레이션 1(큐), `propose-requests/enqueue.ts`, `api/assignments/propose-request/route.ts`, `scripts/assignments/{propose-local.mjs,register-propose-task.ps1}`, `proposal/{persist,report}.ts`, jobs 2, `registry.ts`, `actions.ts`, `ProposalPanel.tsx`, `page.tsx`, **`proxy.ts` + 회귀 테스트 2건**, tests 3
- **RED**:
  - claim 이 **원자적**이다 — `status='pending'` 조건부 UPDATE 로, 두 번 부르면 두 번째는 빈손이다(ratio-audit 선례)
  - **pending/running 이 있으면 새 적재를 막는다**(판정이 두 벌 돌아 배치가 겹치지 않게)
  - `STALE_RUNNING_MS` 초과 `running` 이 `failed` 로 넘어간다
  - rollover 가 **같은 학년도에 두 번째 요청을 만들지 않는다**(`skipped: true`) / 학년도 경계 전후로 판정이 갈린다(2026-02-28 vs 2026-03-01)
  - 그룹 구성이 **직전 annual 배치의 `basis.groups` 와 같으면** 3월 갱신 상기가 보고에 들어간다(§6.4 — `operators.updated_at` 은 전화번호 한 칸에도 움직여 쓰지 않는다)
  - 폴러 창구가 `PUBLIC_PATHS` 에 **먼저** 들어가 있어야 한다 — 테스트 목록에 경로를 먼저 넣어 실패를 보고 나서 가드를 고친다(sms 우편함 T4 와 같은 순서)
  - 폴러 응답이 게이트를 통과한 줄만 배치에 담기고 **탈락 건수와 어긴 게이트가 보고에 남는다**(F11)
  - `basis` 에 그룹 목표와 상한이 얼려 담긴다 / 적용 시 `prev_assignee` 불일치 행은 건너뛴다 / 반려가 원장을 건드리지 않는다 / 비-admin 적용 거부
  - 폴러 모듈이 **`strictMcpConfig`·`settingSources: []`·`disallowedTools` 를 넘긴다**(어시스턴트 선례 — 없으면 그 PC 의 메일·Teams·노션 MCP 에 닿는다)
- **검증**: `npm test` · 자동화 페이지에서 rollover 수동 실행 → 큐에 pending 1건 → 회사 PC 폴러가 claim → 제안 탭에 배치 1건 + `automation_runs` 2행(적재·판정) + Teams 수신 1건(`AUTOMATION_REPORT_DRY_RUN=true` 로 먼저)
- **의존**: PR6

### PR8 — 내보내기 (6파일 · 간략 설계)

- **파일**: `export-sheet.ts`, `jobs/assignment-export.ts`, `registry.ts`, `actions.ts`, `page.tsx`(버튼), tests 2
- **RED**: 열 조립이 §7.2 헤더를 만든다(2줄, 두 학년도) / 학년도가 하나 늘면 열이 20칸 밀린다 / 확정만 나가고 제안은 안 나간다 / `ASSIGNMENT_EXPORT_DRY_RUN=true`면 **fetch가 호출되지 않는다** / 1행 경고 문구가 들어간다 / 504면 세션 재발급 후 1회 retry
- **검증**: dry-run 1회 → 실 내보내기 1회 → SharePoint에서 `(앱) 배정확정` 시트를 열어 화면과 대조
- **의존**: PR7

### PR9 — 문서 (2파일)

- **파일**: `CLAUDE.md`(절 신설), 이 문서 `status: 확정`
- **검증**: `npm run build`
- **의존**: PR8

---

## 12. 코드 밖 등록 체크리스트

**레지스트리 등록은 동작이 아니다.** 아래를 하지 않으면 코드는 초록인데 기능은 죽어 있다.

| # | 무엇 | 어디 | 안 하면 |
|---|---|---|---|
| 1 | 마이그레이션 **3건** 실행 + 검증 SQL (원장·운영자 칸·판정 큐) | Supabase SQL Editor | 모든 조회가 42P01 |
| 2 | `assignable` 15명 + 그룹 7개 입력 | 조직 화면(또는 시드 SQL) | 제안이 0건 (F3) |
| 3 | 재입사자 `career_start_at` 확인 | 같음 | 연차 표시만 틀린다 (F10) |
| 4 | 시트 → DB 이관 1회 실행 + 대조 0건 | 배정 화면 admin 버튼 | 화면이 빈다 |
| 5 | **cron-job.org 2건 등록** — `POST /api/automations/run?jobId=assignment-year-rollover` (매일 08:30), `…?jobId=assignment-unassigned-sweep` (평일 10:30). `Authorization: Bearer ${CRON_SECRET}` | cron-job.org | **자동 생성·감지가 통째로 죽는다.** 미실행 감지는 등록된 잡만 본다 |
| 6 | env `ASSIGNMENT_EXPORT_DRY_RUN` (첫 주 `true`) | Vercel Production | 첫 내보내기가 실파일에 쓴다 |
| 7 | `(앱) 배정확정` 시트 생성 확인 | SharePoint 총괄장 | 앱이 만들지만 이름이 다르면 두 장이 생긴다 |
| 8 | **PC 작업 스케줄러 등록 1회** — `scripts/assignments/register-propose-task.ps1` 를 회사 PC 에서 한 번 실행(5분 폴링) | 회사 PC | **판정이 통째로 안 돈다.** 3월이 지나도 제안이 생기지 않고, 커밋만으로는 등록되지 않는다(§6.4) |
| 9 | 새 env 없음 | — | `SHAREPOINT_*`·`TEAMS_AUTOMATION_SENDER`·`CRON_SECRET`은 이미 있다. 회사 PC `.env.local` 의 `CRON_SECRET`·`OPS_CONSOLE_BASE_URL` 도 이미 있다(다른 폴러 셋이 쓴다). **claude CLI 도 이미 설치돼 있다** — `ANTHROPIC_API_KEY` 를 새로 두지 않는다 |

> `vercel env add`를 stdin으로 넣으면 끝 줄바꿈이 값에 저장돼 전부 401이다. 줄바꿈 없이 넣고 `env pull`로 대조, 값 변경은 redeploy가 있어야 반영된다(2026-09-11).

> **새 CRON_SECRET 창구가 하나 생긴다**(rev 2) — `/api/assignments/propose-request`(§10·§11 과 같은 이름이어야 한다). `proxy.ts`의 `PUBLIC_PATHS`에 넣지 않으면 **307로 `/login`에 돌려보내지고**, 라우트는 멀쩡한데 폴러는 리다이렉트만 받는다. 타입 검사도 테스트도 못 잡고 배포 후에야 드러난다 — 심박(`/api/pollers/heartbeat`)이 그렇게 걸렸다(2026-08-21). 그 사고 뒤 생긴 회귀 테스트 **둘을 함께 갱신한다**(PR7). 접두사 매칭이므로 `/api/assignments`를 통째로 넣지 않는다.
>
> rev 1 은 "창구를 만들지 않으므로 `proxy.ts` 변경이 없다"고 적었다. 판정이 회사 PC로 가면서 그 전제가 깨졌다.

---

## 13. 리스크

| # | 리스크 | 처리 |
|---|---|---|
| R1 | 이관 후 사람이 `02` 시트를 고쳐 DB와 갈린다 | **재가져오기를 만들지 않는다**(DB를 덮어쓰는 버튼은 원장을 파일에 종속시킨다). 시트에 안내를 넣을지는 열린 질문 3 |
| R2 | 대학명 문자열이 유일 키다(대학 테이블 없음) | 정규화는 trim + 공백 접기. 별칭은 잇지 않고 보고한다(F1). 대학 마스터는 별도 건 |
| R3 | 그룹이 2~3명이라 평균이 흔들린다 | 그룹 **안에서만** 보고 임계를 넘은 건만 옮긴다. 상한이 3곳/15곳이라 한 번에 크게 틀어지지 않는다 |
| R4 | 첫 제안이 사람 눈에 이상하다 | 제안은 **적용 전까지 사실이 아니다**. 반려가 기본 선택지이고 원장은 그대로다 |
| R5 | 앱이 쓰는 시트를 사람이 편집 | 앱 전용 시트 + 1행 경고 + 통째로 다시 쓰기. 사람 편집 영역과 갈라져 있다(§7.1) |
| R6 | 개발자 배정을 admin이 대리 입력해야 한다 | 오늘도 말로 요청하고 사람이 넣는다 — 나빠지지 않는다. 권한 분리는 열린 질문 1 |
| R7 | **성적산출**만 건수 원천이 없다 | 대학 수만으로 본다. 대학원은 `closing_services`, PIMS·발표는 `announcement_services` 로 센다(§6.2, rev 2) |
| R8 | 연 1회 잡의 미실행이 늦게 드러난다 | `daily`로 돌려 `skipped`를 쌓는다(§6.4). 3월 1일을 놓쳐도 다음 날 만들어진다 |
| R9 | **모델이 같은 표에 다른 답을 낸다** | 배정값을 테스트하지 않고 **G1~G7 게이트**를 테스트한다(§6.3). 제안은 적용 전까지 사실이 아니고 관리자 승인이 관문이다. 게이트 탈락은 건수와 이유가 보고에 남는다(F11) |
| R10 | **판정이 회사 PC 에 매달린다** | 서버 잡은 매일 돌아 요청을 적재하므로 PC 중단이 **pending 적체**로 드러난다(F12). 3월 1일을 놓쳐도 다음 날 다시 적재된다. 경쟁률 점검이 2년째 같은 구조로 돌고 있다 |

---

## 14. 비범위 (Non-goals)

| 안 하는 것 | 왜 |
|---|---|
| **물량(접수건수) 스크래퍼** | 사용자 결정 2 |
| **대학 마스터 테이블** | 대학명 문자열로 충분하고, 만들면 이 PR이 '대학 정규화'까지 끌어안는다(R2) |
| **업무분장·가격정책 DB 이관** | 배정과 무관한 참고 자료. 요구가 없다 |
| **상담앱 자동 배정** | 사용자가 '일단 패스'. 화면에는 보이되 제안을 만들지 않는다(§6.2) |
| **성적산출 건수 기반 배정** | 건수 원천이 없다. 대학 수만으로 본다(§6.2) |
| **담당 운영자 개인 알림** | 배정은 관리자 결정이고 확정 전 제안이 당사자에게 가면 안 된다(§8) |
| **`02` 시트 직접 쓰기** | §7.1 A안 |
| **시트 → DB 재가져오기** | R1 |
| **최적화 솔버** | 연속성이 1급 목표라 상한 + 게이트가 요구에 맞다(§6.1). 판정은 에이전트가 하고 솔버를 끼우면 생성기가 둘이 된다 |
| **결정적 폴백 생성기** | 에이전트가 못 돌 때 산식으로 대신 만들지 않는다 — 같은 질문에 두 답이 나오고, `donts.md` 의 폴백 금지에도 걸린다. 판정이 안 되면 **수동 배정**이 그대로 가능하다 |
| **`closing_services` 담당자 보정** | 별개 건. 이 설계는 원장을 만들고, 사본 정합은 그 위에서 따로 다룬다 |
| **05.모의논술 · 08.채널 시트** | 이번 범위 밖(어휘는 자랄 수 있게 열어 뒀다 — §5.1) |

---

## 15. 열린 질문

> **rev 2 에서 닫힌 것 셋**: 에이전트 판정 채택(rev 1 Q1) · 대학원·PIMS 건수 원천 확보와 상담앱 제외(rev 1 Q8) · 연차 그룹 확정과 3월 알림(rev 1 Q9).

1. **개발자 배정을 개발부가 앱에서 직접 넣는가?** 지금 설계는 admin only이고, 개발부 몫은 사용자가 대리 입력한다(오늘과 같다). 그들에게 열려면 `permission` 말고 **무엇으로 가릴지**가 필요하다 — `role`? 새 칸? 그들의 계정이 `operators`에 있는지도 확인이 필요하다.
2. **배분현황(운영자별 대학 수·건수·밀도)을 전원에게 열어도 되는가?** 지금은 admin only로 뒀다. 총괄장에 이름은 이미 다 보이지만 **건수는 새로 노출되는 값**이다.
3. **이관 후 `02. 배정리스트` 시트를 어떻게 하는가?** 방치하면 누군가 고치고 DB와 갈린다(F6·R1). 선택지: (a) 시트 1행에 '원천은 OPS-Console' 안내, (b) 시트 보호, (c) 방치. 재가져오기는 만들지 않는 편이 맞다고 본다.
4. **이동 상한과 임계값** — 운영자당 3곳 / 배치 15곳 / 그룹 내 편차 임계를 잠정으로 뒀다. 첫 배치를 보고 정하는 것이 맞아 보인다. 첫 제안을 dry-run으로 만들어 같이 보시겠는가?
5. **팀 경계를 넘겨 대학을 옮겨도 되는가?**(운영1팀 ↔ 운영2팀) 총괄장은 팀을 가리지 않지만, 실무에서 팀 안에서만 옮기는 관례가 있다면 제약으로 넣어야 한다.
6. **갈린 44곳을 자동 이동에서 빼는 것이 맞는가?** 사람이 이유가 있어 갈라놨다고 보고 보존했다. 그중 '이유가 사라진' 건이 있다면 목록으로 주시면 해제 대상으로 표시한다.
7. **성적산출의 서비스 건수 원천이 없다.** 대학원은 `closing_services`, PIMS·발표는 `announcement_services` 로 해결됐지만 성적산출은 어디에도 없어 **대학 수만으로** 부하를 본다. 그쪽도 건수를 볼 곳이 있는가? 없다면 업무종류별 가중치가 필요할 수 있다.
8. **`(앱) 배정확정` 시트 이름을 이대로 쓰는가?** 번호(`05`·`08`)는 이미 쓰이고 있어 피했다. 운영자에게 익숙한 다른 이름이 있으면 그것으로 한다.
9. **판정 프롬프트를 먼저 같이 보시겠는가?** 에이전트가 무엇을 보고 무엇을 돌려주는지가 배정 품질을 결정한다. PR6 의 `prompt.ts` 를 짜기 전에 입력표와 지시문을 문서로 확인하는 편이 안전하다.
