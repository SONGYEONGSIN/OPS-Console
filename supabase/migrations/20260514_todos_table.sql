-- 본인 전용 todo 테이블 (my-todo 도메인)
-- RLS는 별도 마이그레이션(20260514b). 본인 only — assignee_email = jwt email OR is_admin().
-- schedule_events 패턴 미러링하되 RLS 정책이 본질적으로 다름.

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.todos (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  body              text,
  done              boolean not null default false,
  done_at           timestamptz,                                -- done=true 시 ISO 8601
  due_at            timestamptz,                                -- 마감 미정 시 null
  priority          text not null default 'medium'
                    check (priority in ('low', 'medium', 'high')),
  assignee_email    text not null,                              -- 본인 (operators.email)
  created_by_email  text not null,                              -- 등록자 (보통 == assignee, 위임은 후속 epic)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- updated_at 자동
drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
before update on public.todos
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists todos_assignee_email_idx
  on public.todos (assignee_email);

create index if not exists todos_assignee_done_due_idx
  on public.todos (assignee_email, done, due_at);

------------------------------------------------------------
-- 3) 시드 — 송영석 본인 todo 3건
------------------------------------------------------------

insert into public.todos
  (title, body, done, due_at, priority, assignee_email, created_by_email, created_at)
values
  ('Q3 시프트 스케줄 초안 공유',
   '5/13 주간 회의 전까지 운영2팀 인원 배정 초안을 슬랙에 공유.',
   false, '2026-05-13T05:00:00Z', 'high',
   'ys1114@jinhakapply.com', 'ys1114@jinhakapply.com',
   '2026-05-10T00:00:00+09:00'),
  ('신규 운영자 OJT 일정 작성',
   '김지나 사원 OJT 일정 (5/14~5/20) 1:1 매칭 정리.',
   false, '2026-05-12T09:00:00Z', 'medium',
   'ys1114@jinhakapply.com', 'ys1114@jinhakapply.com',
   '2026-05-09T00:00:00+09:00'),
  ('PR #20 e2e 디버그',
   'post DB persist 새로고침 검증 일관 fail. listPosts cache 또는 RLS 정합성 가설 검증.',
   false, null, 'low',
   'ys1114@jinhakapply.com', 'ys1114@jinhakapply.com',
   '2026-05-08T00:00:00+09:00');

commit;

------------------------------------------------------------
-- 4) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select count(*) from public.todos;
-- 기대: 3
