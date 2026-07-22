-- 체크리스트 항목 이미지 첨부 — 작성폼에서 이미지 붙여넣기 지원.
-- 이미지는 Storage 'checklist' 버킷(공개)에 업로드하고 URL 배열을 저장한다.
alter table checklist_items
  add column if not exists attachments text[] not null default '{}';
