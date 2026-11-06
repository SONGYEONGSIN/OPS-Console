-- 학교별 제출 서류 업로드 알림 기록.
-- '03. 학교별 제출 서류' 폴더의 파일(드라이브 item id)마다 내용 해시와, 새 파일 / 교체 알림을
-- 이미 보냈는지 기억한다. 첫 실행은 기존 파일을 seeded 로 적재만 한다.
-- 올린 사람의 메일·이름은 저장하지 않는다 — 담당자 본인 업로드는 skipped_self 상태로만 남는다.
-- 서버 전용(service_role). 정책 0개 = 전면 거부.

begin;

create table if not exists public.sms_sender_doc_upload_notices (
  item_id text primary key,
  name text not null,
  folder_path text not null,
  web_url text,
  content_hash text,

  change_kind text not null default 'new'
    check (change_kind in ('new','replaced')),
  state text not null default 'pending'
    check (state in ('seeded','skipped_self','pending','sending','sent','failed','dry_run')),
  attempts int not null default 0,
  claimed_at timestamptz,
  sent_at timestamptz,
  message_id text,
  error text,

  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sms_sender_doc_upload_notices enable row level security;
revoke all on public.sms_sender_doc_upload_notices from public, anon, authenticated;
grant all on public.sms_sender_doc_upload_notices to service_role;

commit;

notify pgrst, 'reload schema';
