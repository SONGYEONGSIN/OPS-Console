-- onboarding_cohorts에 초대/수락 시점 컬럼 추가
-- invited_at: admin이 메일 초대를 트리거한 시각 (재초대 시 갱신)
-- accepted_at: 신입이 비밀번호 설정 후 첫 로그인 시각

begin;

alter table public.onboarding_cohorts
  add column if not exists invited_at  timestamptz,
  add column if not exists accepted_at timestamptz;

create index if not exists onboarding_cohorts_pending_idx
  on public.onboarding_cohorts (invited_at)
  where accepted_at is null;

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.onboarding_cohorts
-- 기대: invited_at / accepted_at 두 컬럼 존재
