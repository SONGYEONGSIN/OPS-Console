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

-- ─────────────────────────────────────────────────────────────
-- 이력. **되돌리기는 삭제가 아니다** — 원장을 prev_assignee 로 바꾸고
-- source='revert' 인 새 행을 남긴다. 이력을 지우는 경로는 만들지 않는다.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.assignment_changes (
  id              uuid primary key default gen_random_uuid(),
  academic_year   smallint not null,
  university_name text not null,
  work_kind       text not null,
  subtype         text not null default '',
  role            text not null,
  -- **단위는 이메일이다**(`operators.email`). 원장은 담당자를 `assignee_email` +
  -- `assignee_name` 두 칸으로 쪼개지만 이력은 한 칸이라, 어느 쪽인지 정해 두지
  -- 않으면 PR3 가 이름을 넣고 §6.3 G1·G2 대조는 이메일로 읽는다. 이력은
  -- append-only 고 지우는 경로가 없어 한 번 잘못 적재하면 백필뿐이다.
  -- 이름 스냅샷은 원장의 `assignee_name` 에만 둔다(여기에 별도 칸을 두지 않는다).
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

-- "안 바뀐 것을 이력에 남기지 않는다" — closing_service_changes 와 같은 불변식.
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

-- ─────────────────────────────────────────────────────────────
-- 제안. **확정과 다른 테이블**이다 — 제안은 아직 사실이 아닌 후보라서,
-- 한 테이블에 섞으면 모든 조회에 status 조건을 붙여야 하고 그 한 줄을
-- 빠뜨리는 자리가 조회마다 생긴다(빠뜨리면 화면이 제안을 사실로 보여준다).
-- ─────────────────────────────────────────────────────────────

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
  -- 에이전트가 판정하므로 여기에 모델이 본 것과 말한 것도 함께 남긴다:
  --   { groups, targets, measured, limits,           ← 프롬프트에 들어간 입력
  --     model, prompt_hash, verdict_raw,             ← 무엇으로 어떻게 판정했나
  --     rejected: [{ 자연키, 위반 제약 }] }           ← 게이트가 버린 행
  -- 관리자가 '에이전트가 관리하는 모든 사항'을 확인해야 하므로 모델이 무엇을 보고
  -- 그랬는지가 남아야 한다. 컬럼을 늘리지 않는 이유는 이 값이 화면 한 곳에서
  -- 펼쳐 보이기만 하고 조회 조건이 되지 않기 때문이다.
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
  -- 이력과 같은 단위: **이메일**(`operators.email`).
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

-- 적용할 때 제안 한 줄마다 원장의 같은 칸을 자연키로 되찾아 경합을 본다(§6.3 G2).
-- 이 인덱스가 없으면 그 조회가 Seq Scan 이다 — 5,720행 배치에서 한 건에 8.1ms,
-- 배치 전체로는 사실상 quadratic 이 된다.
create index if not exists assignment_proposals_cell_idx
  on public.assignment_proposals
     (academic_year, university_name, work_kind, subtype, role);

-- 같은 학년도에 대기 중인 연간 배치는 하나뿐이다. §6.4 는 요청 큐에서 중복 적재를
-- 막지만 rollover 의 판정 기준은 **이 테이블**이라("현재 학년도 annual 배치가
-- 없으면"), cron 이 한 번 겹쳐 돌면 제안이 두 벌로 생긴다. 실제로 2건이 그대로
-- 들어가는 것을 확인했다.
create unique index if not exists assignment_proposal_batches_pending_annual_key
  on public.assignment_proposal_batches (academic_year)
  where kind = 'annual' and status = 'pending';

-- ─────────────────────────────────────────────────────────────
-- RLS · GRANT
--   원장·이력: 전원 읽기 (오늘 총괄장이 전원 공개다)
--   제안·배치: admin 만 읽기
--   쓰기: 정책 없음 — server action 이 service_role 로만 쓴다
--   GRANT 를 빼면 정책이 맞아도 42501 이다(학습된 함정).
-- ─────────────────────────────────────────────────────────────

alter table public.assignments                 enable row level security;
alter table public.assignment_changes          enable row level security;
alter table public.assignment_proposals        enable row level security;
alter table public.assignment_proposal_batches enable row level security;

drop policy if exists "assignments_select" on public.assignments;
create policy "assignments_select"
  on public.assignments for select
  to authenticated
  using (true);

drop policy if exists "assignment_changes_select" on public.assignment_changes;
create policy "assignment_changes_select"
  on public.assignment_changes for select
  to authenticated
  using (true);

-- ⚠️ `is_admin()` 을 **`(select ...)` 로 감싼다.** 맨 호출은 qual 에 컬럼 참조가
--    없어도 Postgres 가 행마다 평가한다. 6,000행 프로브 실측:
--      맨 호출      → `Filter: is_admin()`      · 696.6ms
--      감싼 호출    → `InitPlan 1` · `Filter: $0` ·   0.3ms
--    차단은 그대로다(양쪽 다 0행). 제안은 연간 배치 한 건이 286대학 × 20칸 =
--    5,720행이라 관리자가 탭을 열 때마다 이 비용을 낸다. 레포의 다른 정책은 맨
--    호출이지만 행이 수천이 되는 첫 테이블이 이것이다.
drop policy if exists "assignment_proposals_admin_select" on public.assignment_proposals;
create policy "assignment_proposals_admin_select"
  on public.assignment_proposals for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "assignment_proposal_batches_admin_select" on public.assignment_proposal_batches;
create policy "assignment_proposal_batches_admin_select"
  on public.assignment_proposal_batches for select
  to authenticated
  using ((select public.is_admin()));

-- Supabase 는 public 스키마의 새 테이블에 기본 권한을 깔아 준다 — 우리가 아무
-- GRANT 를 안 써도 anon 이 테이블에 닿고, 그때 막아 주는 것은 RLS 하나뿐이다.
-- 정책 한 줄이 잘못 열리면 그대로 공개되므로 기본 권한을 먼저 회수한다
-- (20260911_sms_code_inbox.sql 과 같은 순서).
revoke all on public.assignments                 from public, anon, authenticated;
revoke all on public.assignment_changes          from public, anon, authenticated;
revoke all on public.assignment_proposals        from public, anon, authenticated;
revoke all on public.assignment_proposal_batches from public, anon, authenticated;

grant select on public.assignments                 to authenticated;
grant select on public.assignment_changes          to authenticated;
grant select on public.assignment_proposals        to authenticated;
grant select on public.assignment_proposal_batches to authenticated;

grant all on public.assignments                 to service_role;
grant all on public.assignment_changes          to service_role;
grant all on public.assignment_proposals        to service_role;
grant all on public.assignment_proposal_batches to service_role;

-- 새 테이블은 스키마 캐시를 갱신하지 않으면 조회가 404 다.
notify pgrst, 'reload schema';

commit;

-- 검증 (수동, SQL Editor):
-- select count(*) from public.assignments;                     -- 0 (이관은 PR3)
-- select indexname from pg_indexes where tablename = 'assignments';
--   -- assignments_pkey · assignments_natural_key · assignments_assignee_idx · assignments_year_univ_idx
-- insert into public.assignments (academic_year, university_name, work_kind, subtype, role)
--   values (2027, '테스트대', '원서접수', '수시', '운영');       -- 1행
-- insert into public.assignments (academic_year, university_name, work_kind, subtype, role)
--   values (2027, '테스트대', '원서접수', '수시', '운영');       -- ERROR 23505 ← 자연키가 막는다
-- insert into public.assignments (academic_year, university_name, work_kind, subtype, role)
--   values (2027, '테스트대', '원서접수', '수시', '기획');       -- ERROR 23514 ← role check
-- insert into public.assignment_changes
--   (academic_year, university_name, work_kind, role, prev_assignee, next_assignee, source)
--   values (2027, '테스트대', '원서접수', '운영', 'a@example.com', 'a@example.com', 'manual');
--   -- ERROR 23514 ← 안 바뀐 것은 이력이 아니다
-- delete from public.assignments where university_name = '테스트대';  -- 정리
-- select tablename, policyname from pg_policies where tablename like 'assignment%';  -- 4건
