-- closing_services 14컬럼 적재 — Moa 엑셀 실제 컬럼 확인(접수구분/결제시작/결제마감 추가).
-- 기존 11컬럼(서비스ID·대학명·지역·서비스명·대학구분·카테고리·운영자·개발자·작성시작·작성마감·단독여부)에
-- 엑셀 잔여 3컬럼을 더해 전건 적재. 모두 nullable (과거 배치 호환).

begin;

alter table public.closing_services
  add column if not exists admission_type text,        -- 접수구분 (수시/정시/추가/편입/재외국민 등)
  add column if not exists pay_start_at   timestamptz,  -- 결제시작
  add column if not exists pay_end_at     timestamptz;  -- 결제마감

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.closing_services
-- 기대: admission_type/pay_start_at/pay_end_at 3컬럼 추가 (총 18컬럼: 14 데이터 + id/scraped_at/created/updated)
