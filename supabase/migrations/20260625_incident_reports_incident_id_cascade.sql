-- 사고(incident) 삭제 시 연결된 경위서(incident_report)도 함께 삭제.
--
-- 버그: 20260601_incident_reports.sql는 incident_id FK를 `on delete set null`로 생성했으나,
-- 20260602e가 incident_id를 NOT NULL로 변경하면서 FK의 on-delete 동작은 그대로 두었다.
-- → 연결된 경위서가 있는 사고를 삭제하면 set null 시도가 NOT NULL 제약을 위반해
--   삭제 자체가 실패한다("null value in column incident_id ... violates not-null constraint").
--
-- 수정: incident_id FK를 on delete cascade로 교체. 데이터 모델(사고 1 ↔ 경위서 0..1,
-- incident_id 필수)상 경위서는 사고 없이는 존재할 수 없으므로 cascade가 정합적이며,
-- incident_mail_sends(이미 on delete cascade)와도 일관된다.

begin;

-- incident_id에 걸린 FK 제약을 이름에 의존하지 않고 찾아 제거 (중복 FK 생성 방지).
-- unique 제약(incident_reports_incident_id_unique, contype='u')은 건드리지 않는다.
do $$
declare
  fk_name text;
begin
  select c.conname into fk_name
  from pg_constraint c
  where c.conrelid = 'public.incident_reports'::regclass
    and c.contype = 'f'
    and c.conkey = array[
      (select a.attnum from pg_attribute a
        where a.attrelid = 'public.incident_reports'::regclass
          and a.attname = 'incident_id')
    ];
  if fk_name is not null then
    execute format('alter table public.incident_reports drop constraint %I', fk_name);
  end if;
end $$;

alter table public.incident_reports
  add constraint incident_reports_incident_id_fkey
  foreign key (incident_id) references public.incidents(id) on delete cascade;

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select confdeltype from pg_constraint
--   where conrelid='public.incident_reports'::regclass and contype='f';  -- → 'c' (cascade)
-- 연결된 경위서가 있는 사고 1건 삭제 → 경위서도 함께 삭제되고 에러 없음 확인.
