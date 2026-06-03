-- incidents.service_name — 사고가 발생한 서비스명(선택). services.service_name 참조(텍스트 스냅샷).
-- 대학명과 함께 사고를 더 구체적으로 식별. 선택 대학의 서비스 목록에서 검색해 입력.

begin;

alter table public.incidents
  add column if not exists service_name text;

notify pgrst, 'reload schema';

commit;
