-- 서비스별 정산·발행 상태.
--
-- 서비스 하나가 거치는 두 단계를 한 줄에 담는다.
--
--   전형료정산 → settled_at / settled_by
--   계산서발행 → issued_at / issue_type / issued_by
--
-- 두 단계가 서비스와 1:1이고 순서가 정해져 있어(정산 다음 발행) 표를 나눌 이유가
-- 없다. 나누면 계산서발행이 매번 조인해야 하고 한 서비스의 상태가 두 곳에 흩어진다.
--
-- **정산완료가 없으면 계산서발행 목록에 나오지 않는다.** 그게 이 표의 존재 이유다 —
-- 지금까지 '정산이 끝났다'를 기록하는 곳이 아예 없어서, 계산서발행이 무엇을
-- 대상으로 삼아야 할지 말할 수 없었다.
--
-- service_id 는 Moa 서비스ID(정수)이고 **FK 를 걸지 않는다** — closing_services 는
-- 스크랩 미러라 FK 를 걸면 이력 무결성이 스크래퍼에 묶인다 (open_notice_sends 선례).
create table if not exists public.service_billing (
  service_id bigint primary key,

  -- 1단계: 전형료정산
  settled_at timestamptz,
  settled_by text,

  -- 3단계: Moa 내부관리자 정산 화면에서 가져온다. **사람이 적는 값이 아니다** —
  -- 미수채권 대장이 이미 청구금액을 갖고 있어 손으로 두 번 적으면 어느 쪽이
  -- 맞는지 알 수 없게 된다. 연동 전까지 null 이고 화면에는 '—' 로 비워 둔다.
  settled_amount bigint,
  amount_synced_at timestamptz,

  -- 2단계: 계산서발행
  issued_at timestamptz,
  -- 인수인계 폼(handover/payment-fields.ts)의 발행유형과 같은 선택지.
  issue_type text check (issue_type in ('학생부담', '청구', '영수')),
  issued_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 발행은 정산완료 위에만 얹힌다. 순서가 뒤집힌 행은 만들지 않는다.
  constraint service_billing_issue_needs_settle
    check (issued_at is null or settled_at is not null)
);

-- 계산서발행 목록은 '정산완료된 것'만 훑는다.
create index if not exists service_billing_settled_at_idx
  on public.service_billing (settled_at)
  where settled_at is not null;

alter table public.service_billing enable row level security;

-- settlement_deadlines 와 같다 — 운영부 공동 업무라 열람은 공개, 쓰기는 서버만.
create policy "service_billing_select"
  on public.service_billing
  for select to authenticated using (true);

grant select on public.service_billing to authenticated;
grant all on public.service_billing to service_role;
