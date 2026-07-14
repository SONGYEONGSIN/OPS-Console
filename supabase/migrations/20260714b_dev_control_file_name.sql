-- 한 gen_flag가 같은 kind 파일을 여러 개 반환할 수 있어(예: _A.js + _C.js 모두 kind 'A')
-- (service_id, gen_flag, kind) 유니크가 충돌 → 파일명 기준으로 교체.
-- 기존 행은 시험 수집 데이터뿐이라 비우고 시작한다.
truncate table public.dev_control_analyses;
alter table public.dev_control_analyses add column file_name text not null;
alter table public.dev_control_analyses drop constraint dev_control_analyses_service_id_gen_flag_kind_key;
alter table public.dev_control_analyses add constraint dev_control_analyses_service_id_file_name_key unique (service_id, file_name);
