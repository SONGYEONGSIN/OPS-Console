-- 메일함별 서명(signature) — 초안 본문 끝에 자동 append.
-- Outlook 서명은 Graph로 못 읽고 발송 시 자동첨부도 안 되므로 DB에 저장한다.
-- ingest 잡(scripts/mailbox-ingest.mjs)이 generateDraft 결과 끝에 append.

begin;

alter table public.mailbox_settings add column if not exists signature text;

commit;

notify pgrst, 'reload schema';
