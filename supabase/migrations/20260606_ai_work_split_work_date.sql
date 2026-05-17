-- ai_work.work_date (단일 date) → work_start_date + work_end_date 분할.
-- UI 라벨이 "작업 일자" → "작업 기간"으로 바뀌면서 며칠 걸린 작업도 표시.
-- 기존 row는 시작=종료=work_date로 채워 정보 손실 없음.

begin;

-- 1) 새 컬럼 추가 (nullable로 일단)
alter table public.ai_work
  add column if not exists work_start_date date,
  add column if not exists work_end_date date;

-- 2) 기존 work_date 값을 양쪽에 복사 (마이그 멱등성을 위해 null인 것만)
update public.ai_work
   set work_start_date = work_date
 where work_start_date is null;

update public.ai_work
   set work_end_date = work_date
 where work_end_date is null;

-- 3) not null 강제
alter table public.ai_work
  alter column work_start_date set not null,
  alter column work_end_date set not null;

-- 4) end >= start 제약
alter table public.ai_work
  drop constraint if exists ai_work_work_date_range_check;
alter table public.ai_work
  add constraint ai_work_work_date_range_check
  check (work_end_date >= work_start_date);

-- 5) 기존 인덱스 삭제 + 새 인덱스 (start_date desc, created_at desc)
drop index if exists public.ai_work_work_date_desc_idx;
create index if not exists ai_work_work_start_date_desc_idx
  on public.ai_work (work_start_date desc, created_at desc);

-- 6) 옛 컬럼 drop
alter table public.ai_work
  drop column if exists work_date;

commit;

notify pgrst, 'reload schema';
