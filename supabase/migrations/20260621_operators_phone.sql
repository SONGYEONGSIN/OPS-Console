-- operators.phone — 운영자 전화번호(선택). 경위서 공문 하단 담당자 연락처에 사용.

begin;

alter table public.operators
  add column if not exists phone text;

notify pgrst, 'reload schema';

commit;
