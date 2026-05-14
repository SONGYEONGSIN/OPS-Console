-- services 도메인 — service_id 재부여
-- 학교키(앞 4자리)는 기존 service_id의 첫 4글자 그대로 유지.
-- 시퀀스(뒤 3자리)는 학교키별로 write_start_at asc(nulls last) 정렬 후 001부터 재부여.
--
-- 변환 예:
--   100266 (가천대학교(대학원), 학교키 1002) → 1002001
--   100267 (같은 학교 다음 작성시작)         → 1002002
--   6001008 (경찰대학, 학교키 6001)          → 6001001
--
-- UNIQUE 제약 회피: 2단계 처리 (임시 음수값 → 최종 new_id).

begin;

------------------------------------------------------------
-- 1) 임시 컬럼에 새 service_id 계산
------------------------------------------------------------

alter table public.services add column service_id_new bigint;

with renumbered as (
  select id,
    left(service_id::text, 4)::bigint * 1000 + row_number() over (
      partition by left(service_id::text, 4)
      order by write_start_at asc nulls last, created_at asc, id asc
    ) as new_id
  from public.services
)
update public.services s
set service_id_new = r.new_id
from renumbered r
where r.id = s.id;

------------------------------------------------------------
-- 2) UNIQUE 충돌 회피 — 음수로 임시 변경
------------------------------------------------------------

update public.services set service_id = -service_id;

------------------------------------------------------------
-- 3) 새 값으로 적용
------------------------------------------------------------

update public.services set service_id = service_id_new;

------------------------------------------------------------
-- 4) 임시 컬럼 제거
------------------------------------------------------------

alter table public.services drop column service_id_new;

------------------------------------------------------------
-- 5) PostgREST schema reload
------------------------------------------------------------

notify pgrst, 'reload schema';

commit;
