-- 합격자발표 서비스의 담당 운영자.
--
-- 이 표는 붙여넣기로 들어온 자료라 운영자 컬럼이 없었다. 그래서 성과를 개인에
-- 귀속할 수 없었다 — 요청한 4갈래 중 이 갈래만 **원천적으로 불가능**했다.
--
-- 값은 총괄장(대학×서비스 배정)에서 이름으로 맞춰 채운다. 맞추지 못한 건
-- null 로 남는다 — 0 이나 빈 문자열로 채우면 '담당자 없음'과 '아직 못 맞춤'이
-- 구분되지 않는다.
alter table public.announcement_services
  add column if not exists operator_name text,
  -- 언제 맞췄는지. 총괄장이 바뀌면 다시 돌려야 하는데, 언제 돌렸는지 모르면
  -- 낡은 배정으로 성과를 낸 줄도 모른다.
  add column if not exists operator_synced_at timestamptz;

-- 성과 집계가 운영자로 훑는다.
create index if not exists announcement_services_operator_idx
  on public.announcement_services (operator_name)
  where operator_name is not null;
