-- closing_service_changes — 마감 서비스 값이 바뀐 칸의 이력.
--
-- 인제스트(/api/closing/ingest)는 오래 `ignoreDuplicates: true` 라 한 번 적재된
-- service_id 를 통째로 건너뛰었다. 그래서 Moa 쪽 값이 바뀌어도 영영 반영되지 않았다
-- (국립군산대 수시모집 1035061 은 실제로 단독인데 solo=false 로 몇 달째 굳어 있었다).
-- 이제 바뀐 행을 갱신하는데, 갱신은 예전 값을 지운다 — 지워지는 값을 여기에 남긴다.
--
-- service_id 는 Moa 서비스ID 정수이고 **FK 를 걸지 않는다**. closing_services 는
-- Moa 의 스크랩 미러지 원장이 아니라서, FK 를 걸면 이력 무결성이 스크래퍼 가용성에
-- 묶인다(open_notice_sends·entertest_test_runs 가 같은 이유로 FK 없다).
-- 타입은 원본 closing_services.service_id(integer) 를 그대로 따른다 — 이 테이블은
-- 그 행의 이력이므로 키 표현이 달라질 이유가 없다.

begin;

create table if not exists public.closing_service_changes (
  id          uuid primary key default gen_random_uuid(),
  service_id  integer not null,          -- Moa 서비스ID (FK 없음)
  field       text not null,             -- closing_services 컬럼명
  prev_value  text,                      -- null = 비어 있던 칸이 채워짐
  next_value  text,                      -- null = 있던 값이 비워짐
  scraped_at  timestamptz not null,      -- 이 변경을 실어온 배치의 스크래핑 시각
  -- **changed_at 이 아니다.** 언제 바뀌었는지는 알 길이 없고(스크랩 주기 사이
  -- 어딘가다) 언제 발견했는지만 안다. 이름이 거짓말하면 안 된다.
  detected_at timestamptz not null default now()
);

-- field 에 허용값 check 를 걸지 않는다 — 값은 코드의 CLOSING_DIFF_FIELDS(as const)
-- 에서만 나와 타입 단계에서 오타가 불가능하고, 컬럼이 하나 늘 때마다 마이그레이션을
-- 잊으면 야간 인제스트 전체가 죽는다. 관측 테이블이 본 작업을 멈춰 세우면 안 된다.
--
-- 대신 "안 바뀐 것을 이력에 남기지 않는다"는 불변식은 건다. 정상 동작에서는 결코
-- 걸릴 수 없고(같다고 판정한 행은 애초에 여기 안 온다), 걸린다면 diff 가 깨진 것이다.
-- 스크래퍼는 +09:00 로 보내고 DB 는 +00:00 으로 돌려주므로, 시각을 문자열로 비교하는
-- 회귀가 생기면 매 실행 전 행이 '변경됨' 으로 쏟아진다 — 조용히 쌓이느니 여기서 멎는다.
alter table public.closing_service_changes
  drop constraint if exists closing_service_changes_actual_change_chk;
alter table public.closing_service_changes
  add constraint closing_service_changes_actual_change_chk
  check (prev_value is distinct from next_value);

-- 서비스 한 건의 이력을 최신순으로.
create index if not exists closing_service_changes_service_idx
  on public.closing_service_changes (service_id, detected_at desc);
-- "최근에 뭐가 바뀌었나" — 배포 후 첫 실행의 누적 드리프트를 훑을 때 쓴다.
create index if not exists closing_service_changes_detected_idx
  on public.closing_service_changes (detected_at desc);

alter table public.closing_service_changes enable row level security;

-- 읽기는 운영부 전원(closing_services 와 같은 공개 범위).
drop policy if exists "closing_service_changes_select" on public.closing_service_changes;
create policy "closing_service_changes_select"
  on public.closing_service_changes for select
  to authenticated
  using (true);

-- INSERT/UPDATE/DELETE 정책 없음 — 적재는 인제스트 API 가 service_role(RLS bypass)로만.
grant select on public.closing_service_changes to authenticated;
grant all on public.closing_service_changes to service_role;

commit;

notify pgrst, 'reload schema';

-- 시드는 없다. 갱신을 시작하기 전의 값 변화는 관측된 적이 없어 남길 것이 없고,
-- 첫 실행이 몇 달치 누적 드리프트를 한꺼번에 잡아 채운다(그게 첫 이력이다).
--
-- 검증 (수동):
-- \d public.closing_service_changes
-- 기대: 7 컬럼 + actual_change check + 인덱스 2개 + RLS select 정책 1개
-- insert into public.closing_service_changes
--   (service_id, field, prev_value, next_value, scraped_at)
--   values (1, 'solo', 'false', 'false', now());
-- 기대: check 위반으로 거부 (안 바뀐 것은 이력이 아니다)
