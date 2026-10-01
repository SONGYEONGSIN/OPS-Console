-- 우편물 — 누운 사진을 세운 뒤의 재판독이 '바로 섰다'고 확인할 때까지 옛 사진을 남긴다.
--
-- 판독이 방향을 잘못 짚으면 사진이 엉뚱하게 돌아간다(탐침 7번 중 1번). 세운 뒤 다시 판독해
-- 바로 섰으면 이 경로의 옛 사진을 지우고, 아니면(또는 재판독이 실패하면) 이 경로로 되돌린다.
-- 자동 세우기가 건 재판독(requested_by = 'auto-rotate') 행에만 채운다.
alter table public.postal_extract_requests
  add column if not exists rotated_from text;

comment on column public.postal_extract_requests.rotated_from is
  '자동 세우기 전 사진 경로 — 재판독이 바로 섰다고 확인하면 지우고, 아니면 되돌린다';
