-- 체크리스트 공유 링크 재설계: 부서별 작성 토큰(dept-fill) → 전 부서 통합 작성 토큰(fill)
-- 작성 공유 링크 1개(fill, 전 부서 작성) + 확인 공유 링크 1개(report, 임원 읽기).
-- 기존 부서별 토큰은 통합 링크로 재발급 유도 위해 정리.
delete from checklist_share_tokens where kind = 'dept-fill';

alter table checklist_share_tokens drop constraint if exists dept_fill_requires_department;
alter table checklist_share_tokens drop constraint if exists checklist_share_tokens_kind_check;
alter table checklist_share_tokens
  add constraint checklist_share_tokens_kind_check check (kind in ('fill', 'report'));
