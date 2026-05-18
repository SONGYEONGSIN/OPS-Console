-- onboarding_checklist_items: 회차별 trainee 체크리스트 진행도.
-- 가이드 콘텐츠(_content.ts)의 (섹션 title, 항목 title) 쌍을 키로 사용 — 순서 변경에 robust.
-- 항목 title이 변경되면 그 항목 진행은 리셋되지만, 동일 title은 유지된다.

begin;

create table if not exists public.onboarding_checklist_items (
  id            uuid primary key default gen_random_uuid(),
  cohort_id     uuid not null references public.onboarding_cohorts(id) on delete cascade,
  section_key   text not null,
  item_key      text not null,
  checked       boolean not null default false,
  checked_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cohort_id, section_key, item_key)
);

create index if not exists onboarding_checklist_items_cohort_idx
  on public.onboarding_checklist_items (cohort_id);

create or replace function public.onboarding_checklist_items_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  if new.checked is distinct from old.checked then
    new.checked_at = case when new.checked then now() else null end;
  end if;
  return new;
end;
$$;

drop trigger if exists onboarding_checklist_items_set_updated_at on public.onboarding_checklist_items;
create trigger onboarding_checklist_items_set_updated_at
  before update on public.onboarding_checklist_items
  for each row execute function public.onboarding_checklist_items_set_updated_at();

commit;

notify pgrst, 'reload schema';
