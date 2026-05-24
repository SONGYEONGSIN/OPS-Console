-- 성과리포트 — 2026 상반기 시드 데이터 (devonly).
-- 운영2팀 송영신(팀장) 평가자 + 운영2팀 팀원 3명 evaluatee.
--
-- 적용: Supabase Studio SQL Editor에서 실행 (service_role 권한 필요).
-- 적용 후 페이지 진입 시 4 row 노출.
--
-- 재적용 안전: cycle name unique + (cycle_id, evaluatee_email) unique로
-- 중복 insert 시 conflict, 기존 시드 유지.

begin;

-- 1) 사이클 1건
insert into public.performance_cycles (name, status)
values ('2026 상반기', 'open')
on conflict (name) do nothing;

-- 2) assignments 4건 — 송영신 팀장이 운영2팀 팀원 4명 평가
--    각 단계별 1건 시드 (1=목표설정 / 2=실행계획 / 4=중간점검 / 7=종합평가)
insert into public.performance_assignments
  (cycle_id, evaluator_email, evaluatee_email, current_step)
select c.id, e.evaluator, e.evaluatee, e.step
from public.performance_cycles c,
  (values
    ('ys1114@jinhakapply.com', 'pkm0313@jinhakapply.com',    1),  -- 박시현
    ('ys1114@jinhakapply.com', 'haelee0201@jinhakapply.com', 2),  -- 이해영
    ('ys1114@jinhakapply.com', 'rsjw2014@jinhakapply.com',   4),  -- 임종우
    ('ys1114@jinhakapply.com', 'kjh@jinhakapply.com',        7)   -- 김지현
  ) as e(evaluator, evaluatee, step)
where c.name = '2026 상반기'
on conflict (cycle_id, evaluatee_email) do nothing;

commit;

-- 검증:
-- select c.name, a.evaluator_email, a.evaluatee_email, a.current_step
-- from performance_assignments a
-- join performance_cycles c on c.id = a.cycle_id
-- order by a.created_at;
-- 기대: 4행
