-- incident_reports — SharePoint 업로드 URL 컬럼 추가 (2차 Phase C)
-- 발송 시 06.경위서 폴더에 업로드한 docx의 webUrl을 보관한다.
-- doc_number(시행번호)는 1차에서 이미 존재. 여기서는 sharepoint_url만 추가.
--
-- 관련 SharePoint IDs (코드는 env에서 읽음, 참고용):
--   공문관리대장.xlsx itemId : 01TGOQVTW4WZDUAMTSPBEJKONCW6V37L2U
--   06.경위서 폴더 itemId     : 01TGOQVTXYXPVN6FVGH5F37SY2CMWMROXN
--   drive                     : 기존 SHAREPOINT_DRIVE_ID

begin;

alter table public.incident_reports
  add column if not exists sharepoint_url text;

notify pgrst, 'reload schema';

commit;
