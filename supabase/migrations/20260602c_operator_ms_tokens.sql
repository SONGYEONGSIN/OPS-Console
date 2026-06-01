-- operator_ms_tokens — MS SSO 위임 인증용 운영자별 provider refresh token.
-- 경위서 .docx를 운영자 자격으로 SharePoint 업로드("만든 사람"=운영자)하기 위해
-- 로그인(OAuth) 콜백에서 provider_refresh_token을 저장하고, 발송 시 이 토큰으로
-- 위임 Graph access token을 발급한다.
--
-- ⚠️ 민감: refresh token은 평문 저장. RLS로 authenticated 전면 차단 — 오직 서버
-- (service_role admin client)만 접근. 향후 강화: 암호화 at-rest.

begin;

create table if not exists public.operator_ms_tokens (
  operator_email          text primary key,
  provider_refresh_token  text not null,
  scope                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists operator_ms_tokens_set_updated_at on public.operator_ms_tokens;
create trigger operator_ms_tokens_set_updated_at
before update on public.operator_ms_tokens
for each row execute function public.set_updated_at();

-- RLS: authenticated 전면 차단 (정책 없음 = 거부). 서버 service_role만.
alter table public.operator_ms_tokens enable row level security;
revoke all on public.operator_ms_tokens from authenticated;
grant all on public.operator_ms_tokens to service_role;

notify pgrst, 'reload schema';

commit;

-- 검증 (수동):
-- select count(*) from public.operator_ms_tokens;  -- → 0
-- select polname from pg_policies where tablename='operator_ms_tokens';  -- → 0건 (authenticated 차단)
