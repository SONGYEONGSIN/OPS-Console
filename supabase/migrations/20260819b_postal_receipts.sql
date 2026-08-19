-- 우편물(등기발송) 영수증 보관.
--
-- 지금까지는 영수증을 A4에 풀칠하고, 등기번호·수취인을 손으로 엑셀에 옮겨 적었다.
-- 영수증을 여기에 올리면 원본이 남고, 이후 단계에서 추출·엑셀 기록으로 이어진다.
--
-- **결제 정보 칸을 만들지 않는다.** 영수증에는 카드 승인번호·가맹점번호가 찍혀 있는데
-- 업무에 쓸 일이 없다. 칸이 없으면 실수로도 안 들어간다.

-- 영수증 1장 = 화면의 카드 1개. 등기 여러 건이 한 장에 찍힌다.
create table if not exists public.postal_receipts (
  id uuid primary key default gen_random_uuid(),
  -- 비공개 버킷 안의 경로. 공개 URL은 만들지 않는다 — 서명 URL로만 연다.
  storage_path text not null unique,
  -- 영수증에서 읽는 값들. 1단계에서는 비어 있고 2단계(추출)에서 채운다.
  accepted_at timestamptz,
  receipt_no text,
  total_fee integer,
  item_count integer,
  -- 올린 사람 = 엑셀의 '확인' 칸. 나중에 조회할 때 누가 올렸는지가 곧 확인자다.
  uploaded_by text not null,
  -- 추출·검토를 마쳐 엑셀에 기록했는가.
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 등기 1건 = 엑셀 1행.
create table if not exists public.postal_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null
    references public.postal_receipts (id) on delete cascade,
  -- 영수증에서 읽는 것
  tracking_no text not null,
  postal_code text,
  fee integer,
  -- 수취인 "우석대 강정화" 를 갈라 담는다. 정식명 보정은 검토 화면에서 한다.
  recipient_org text,
  recipient_name text,
  -- 영수증에 없는 것 — 사람이 지정한다(4단계에서 총괄장 대조로 자동 채움).
  assignee text,
  -- 그날 몇 번째 건인가. 엑셀의 '순번'.
  day_seq integer,
  note text,
  created_at timestamptz not null default now()
);

alter table public.postal_receipts enable row level security;
alter table public.postal_items enable row level security;

-- 우편 발송은 운영부 공동 업무라 열람은 공개다. 다만 원본 파일은 별개 —
-- 버킷이 비공개라 이 정책만으로는 이미지가 열리지 않는다(서명 URL 필요).
create policy "postal_receipts_select"
  on public.postal_receipts
  for select to authenticated using (true);

create policy "postal_items_select"
  on public.postal_items
  for select to authenticated using (true);

grant select on public.postal_receipts to authenticated;
grant select on public.postal_items to authenticated;
grant all on public.postal_receipts to service_role;
grant all on public.postal_items to service_role;

-- 목록은 최근 발송부터 본다.
create index if not exists postal_receipts_created_idx
  on public.postal_receipts (created_at desc);
create index if not exists postal_items_receipt_idx
  on public.postal_items (receipt_id);

-- 저장 버킷 — **반드시 비공개**.
--
-- 기존 `checklist` 버킷은 공개라 URL만 알면 누구나 열린다. 영수증에는 수취인 실명과
-- 카드 결제 정보가 찍혀 있어 같은 방식으로 두면 안 된다.
insert into storage.buckets (id, name, public)
values ('postal-receipts', 'postal-receipts', false)
on conflict (id) do update set public = false;

-- 파일 접근은 서버(service_role)만 — 화면은 서버가 발급한 서명 URL로 연다.
create policy "postal_receipts_object_service_only"
  on storage.objects for all to service_role
  using (bucket_id = 'postal-receipts')
  with check (bucket_id = 'postal-receipts');
