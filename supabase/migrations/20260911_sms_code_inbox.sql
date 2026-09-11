-- Moa 로그인 SMS 인증번호 자체 우편함.
-- 설계: docs/superpowers/specs/2026-09-11-sms-code-inbox-design.md
--
-- 폰(Tasker)이 넣고, 스크래퍼가 꺼내면서 지운다. 서버 전용 — 화면에 그릴 일이 없다.
-- ⚠️ 본문은 저장하지 않는다. 서버가 코드만 추출해 넣는다.

begin;

create table if not exists public.sms_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null check (code ~ '^[0-9]{4,8}$'),
  -- 폰 시각을 받지 않는다 — 폰 시계·로케일에 우편함 정확성을 묶지 않기 위함.
  received_at  timestamptz not null default now()
);

-- 인덱스를 두지 않는다: 비우기가 매 로그인 전에 전체 삭제하므로 상시 0~2행이다.

-- 로그인 점유 — 한 줄만 존재한다(id=1 고정). 소비자가 둘 이상 동시에 Moa 로그인에
-- 들어가면 SMS 두 통이 한 우편함에 섞여 서로의 코드를 꺼내 간다. 틀린 코드 제출은
-- 캡차 잠금으로 이어져 Moa 자동화 전체를 세운다(scrape.py 헤더 주석).
create table if not exists public.sms_code_lease (
  id           smallint primary key default 1 check (id = 1),
  consumer     text not null,
  acquired_at  timestamptz not null default now()
);

alter table public.sms_codes       enable row level security;
alter table public.sms_code_lease  enable row level security;
-- 정책 0개 = 전면 거부. 읽는 주체는 서버(service_role)뿐이다.
revoke all on public.sms_codes      from anon, authenticated;
revoke all on public.sms_code_lease from anon, authenticated;
grant all on public.sms_codes       to service_role;
grant all on public.sms_code_lease  to service_role;

-- 비우기 + 점유 획득. 한 호출로 묶는 이유: 점유를 못 잡았는데 남의 코드를 지우면
-- 상대가 굶는다. 순서가 아니라 원자성이 필요하다.
create or replace function public.claim_sms_inbox(p_consumer text, p_ttl_sec int)
returns table (acquired boolean, holder text, holder_since timestamptz, cleared int)
language plpgsql
as $$
declare
  v_ok boolean := false;
  v_cleared int := 0;
begin
  insert into public.sms_code_lease as l (id, consumer, acquired_at)
  values (1, p_consumer, now())
  on conflict (id) do update
    set consumer = excluded.consumer, acquired_at = excluded.acquired_at
    -- 같은 소비자의 재획득은 통과시킨다 — 재시도가 자기 리스에 막히면 안 된다.
    where l.consumer = excluded.consumer
       or l.acquired_at < now() - make_interval(secs => p_ttl_sec)
  returning true into v_ok;

  if v_ok is not true then
    return query
      select false, l.consumer, l.acquired_at, 0
      from public.sms_code_lease l where l.id = 1;
    return;
  end if;

  delete from public.sms_codes;
  get diagnostics v_cleared = row_count;
  return query select true, p_consumer, now(), v_cleared;
end;
$$;

-- 꺼내며 삭제. 만료분을 먼저 지우는 이유: 그것이 '최신'으로 뽑히면 죽은 코드를
-- 제출하게 된다. 만료 규칙을 이 함수 하나에 둔다(cron 불필요).
create or replace function public.pop_sms_code(p_consumer text)
returns table (code text, received_at timestamptz)
language plpgsql
as $$
declare
  v_code     text;
  v_received timestamptz;
begin
  delete from public.sms_codes where sms_codes.received_at < now() - interval '10 minutes';

  delete from public.sms_codes
   where sms_codes.id = (
     select s.id from public.sms_codes s order by s.received_at desc limit 1
   )
  returning sms_codes.code, sms_codes.received_at into v_code, v_received;

  -- 점유 반납은 **꺼냈을 때만**. 빈 우편함에 온 pop 에서 반납하면 폴링 첫 회(코드
  -- 도착 전)에 리스가 풀려, 남은 90초 동안 다른 소비자가 들어와 우편함을 비운다 —
  -- 리스가 막으려던 바로 그 창이다.
  if v_code is not null then
    delete from public.sms_code_lease where sms_code_lease.consumer = p_consumer;
    return query select v_code, v_received;
  end if;
end;
$$;

-- 함수는 기본이 PUBLIC 실행 가능이다. invoker 권한이라 anon 이 불러도 테이블에서
-- 막히지만, 그 우연에 기대지 않는다 — 실행 권한도 service_role 로 좁힌다.
revoke execute on function public.claim_sms_inbox(text, int) from public, anon, authenticated;
revoke execute on function public.pop_sms_code(text)          from public, anon, authenticated;
grant  execute on function public.claim_sms_inbox(text, int) to service_role;
grant  execute on function public.pop_sms_code(text)          to service_role;

-- 새 함수는 스키마 캐시를 갱신하지 않으면 .rpc() 가 404 를 돌려준다.
notify pgrst, 'reload schema';

commit;

-- 검증 (수동, SQL Editor):
-- select * from claim_sms_inbox('closing', 180);      -- t, closing, …, 0
-- select * from claim_sms_inbox('ratio-audit', 180);  -- f, closing, …, 0   ← 점유가 막는다
-- select * from claim_sms_inbox('closing', 180);      -- t                  ← 같은 소비자는 통과
-- select * from pop_sms_code('closing');              -- 0행 (빈 우편함)
-- select * from claim_sms_inbox('ratio-audit', 180);  -- f                  ← 빈 pop 은 반납하지 않는다
-- insert into sms_codes (code) values ('123456');
-- select * from pop_sms_code('closing');              -- 1행, 123456
-- select * from pop_sms_code('closing');              -- 0행               ← 꺼내며 지웠다
-- select * from claim_sms_inbox('ratio-audit', 180);  -- t                  ← 꺼냈으니 반납됐다
-- delete from sms_code_lease;                         -- 정리
-- select polname from pg_policies where tablename like 'sms_code%';  -- 0건
