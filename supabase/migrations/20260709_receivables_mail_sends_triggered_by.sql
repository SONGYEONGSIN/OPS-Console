-- receivables_mail_sends.triggered_by 컬럼 추가
-- 발송을 트리거한 운영자(수동 발송 시 버튼 누른 admin). 실제 발신 운영자(sender_operator_id)와 구분한다.
-- 수동 발송이 담당 운영자 메일박스에서 나가도록 바뀌면서 sender_operator_id가
-- '실제 발신자'를 뜻하게 되어, '누가 대신 눌렀는지'를 담을 컬럼이 별도로 필요해졌다.
-- 자동화(cron) 경로는 트리거 주체가 없으므로 null 유지.
-- RLS/GRANT는 기존 20260511b 정책이 신규 컬럼을 포함하므로 추가 불필요.

begin;

alter table public.receivables_mail_sends
  add column if not exists triggered_by uuid
    references public.operators(id) on delete set null;

create index if not exists receivables_mail_sends_triggered_by_idx
  on public.receivables_mail_sends (triggered_by);

commit;

notify pgrst, 'reload schema';

-- 검증 (수동):
-- \d public.receivables_mail_sends
-- 기대: triggered_by (uuid, nullable, FK operators) 컬럼 존재 — 총 14 컬럼
-- (20260511 생성 마이그레이션 주석의 '12 컬럼'은 오기. 실제 기존 컬럼은 13개)
-- select policyname, cmd from pg_policies where tablename = 'receivables_mail_sends';
-- 기대: 기존 4건 유지 (_select / _insert_admin / _update_admin / _delete_admin)
