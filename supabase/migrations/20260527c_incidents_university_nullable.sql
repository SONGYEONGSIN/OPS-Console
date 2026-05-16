-- incidents.university_name NULL 허용 (PR-7)
-- 시트 import 시 대학명 미지정 row (사내 시스템 이슈 등) 보존 위해.

begin;

alter table public.incidents
  alter column university_name drop not null;

notify pgrst, 'reload schema';

commit;
