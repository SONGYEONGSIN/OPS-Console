-- 운영자별 entertest 테스트 계정 ID (ID=PW 동일). 운영자마다 상이.
alter table public.operators
  add column if not exists entertest_account text;

comment on column public.operators.entertest_account is
  'entertest 원서접수 테스트 계정 ID (로그인 PW는 ID와 동일). 운영자별 상이.';
