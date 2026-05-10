-- 게시판 (feedback / notice) 단일 posts 테이블 + 시드
-- ListPattern post-feedback / post-notice variant와 1:1 대칭. RLS는 별도 마이그레이션(20260512b).

begin;

------------------------------------------------------------
-- 1) 테이블
------------------------------------------------------------

create table if not exists public.posts (
  id            uuid primary key default uuid_generate_v4(),
  domain        text not null check (domain in ('feedback', 'notice')),
  slug          text unique,                                 -- 사람 친화 ID (FB-001 / NT-001) — 시드 보존용
  title         text not null,
  body          text,
  author_email  text not null,                               -- 등록자 (operators.email 일관)
  author_id     uuid,                                        -- best-effort (auth.users.id), 정규화는 후속
  owner_label   text,                                        -- 담당 free-text (예: '송영신 · 팀장')
  status        text not null default 'urgent'
                check (status in ('urgent', 'active', 'review', 'approved')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at 자동 (operators 마이그레이션의 set_updated_at 함수 재사용)
drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

------------------------------------------------------------
-- 2) 인덱스
------------------------------------------------------------

create index if not exists posts_domain_created_idx
  on public.posts (domain, created_at desc);

create index if not exists posts_author_email_idx
  on public.posts (author_email);

------------------------------------------------------------
-- 3) 시드 — 현재 mock 7건 이전
------------------------------------------------------------

insert into public.posts
  (domain, slug, title, body, author_email, owner_label, status, created_at)
values
  ('feedback', 'FB-004', '인스펙터 패널 width 320px이 좁음 — 본문이 잘림',
   'team 페이지에서 row 클릭 시 우측 패널이 320px 고정인데, 직급/팀/이메일이 한 줄에 안 들어와서 줄바꿈이 어색합니다. 최소 360px 이상 또는 사용자 조정 가능한 너비를 검토해주세요.',
   'ys1114@jinhakapply.com', '송영신', 'urgent',
   '2026-05-09T00:00:00+09:00'),
  ('feedback', 'FB-003', '사용자 권한 변경이 즉시 반영되지 않음',
   'admin이 다른 사용자의 권한을 member로 변경했을 때, 해당 사용자의 다른 탭/세션은 새로고침 전까지 admin으로 동작합니다. 즉시 회수가 안전한지 검토 필요.',
   'kjy0926@jinhakapply.com', '송영신', 'review',
   '2026-05-08T00:00:00+09:00'),
  ('feedback', 'FB-002', '모바일 햄버거 트리거 누락 회귀 — chrome 리브랜드',
   'PIVOT→OPS Console 리브랜드 시 AppBar의 ''메뉴 열기'' 버튼이 누락되었던 회귀. PR #7로 SidebarToggleProvider 도입 후 복구 완료.',
   'annooy@jinhakapply.com', '송영신', 'approved',
   '2026-05-08T00:00:00+09:00'),
  ('feedback', 'FB-001', '알림 모달에 외부 클릭으로 닫기 추가 요청',
   '현재는 ESC 또는 X 버튼만 닫기 가능합니다. 다른 모달처럼 모달 외부 영역(scrim) 클릭으로도 닫히게 해주세요.',
   'bluewhich87@jinhakapply.com', '송영신', 'active',
   '2026-05-07T00:00:00+09:00'),
  ('notice', 'NT-003', '2026 Q3 운영 정책 변경 — 시프트 스케줄 조정 안내',
   'Q3부터 시프트 스케줄을 2교대 → 3교대 시범 운영합니다. 1차 06:00–14:00 / 2차 14:00–22:00 / 3차 22:00–06:00. 자세한 인원 배정은 5/20 주간 회의에서 공유합니다.',
   'alcure23@jinhakapply.com', '허승철 · 부장', 'urgent',
   '2026-05-10T00:00:00+09:00'),
  ('notice', 'NT-002', '시스템 정기 점검 — 5/15(목) 23:00 ~ 익일 02:00',
   'Supabase Postgres 마이너 버전 업그레이드와 인증 SMTP 교체 작업이 진행됩니다. 점검 시간 동안 OPS Console 접속이 일시 차단될 수 있으니 미리 대시보드를 닫아주세요.',
   'ys1114@jinhakapply.com', '송영신 · 팀장', 'active',
   '2026-05-09T00:00:00+09:00'),
  ('notice', 'NT-001', '신규 운영자 합류 — 김지나 사원 (운영2팀)',
   '운영2팀에 김지나 사원(매니저)이 합류했습니다. 첫 주는 OJT로 시프트에서 제외하고, 5/14(수)부터 정상 시프트 투입 예정입니다. 환영해 주세요.',
   'ys1114@jinhakapply.com', '송영신 · 팀장', 'approved',
   '2026-05-07T00:00:00+09:00')
on conflict (slug) do nothing;

commit;

------------------------------------------------------------
-- 4) PostgREST schema cache reload
------------------------------------------------------------

notify pgrst, 'reload schema';

-- 검증 (수동):
-- select count(*), domain from public.posts group by domain order by 1 desc;
-- 기대: feedback 4, notice 3
