# 경위서·사고 DB 쓰기 권한 잠금 — 설계

> 2026-11-26 · 브랜치 `fix/incident-write-permissions` · 등급: **전체 설계**(14파일 — 마이그레이션 2 포함, 권한 로직·DB 권한 변경이라 한 등급 올림) · 운영 DB 의 정책·권한은 **실측 전**이다(§7 SQL 로 먼저 확인)

## 1. 문제 — 결재를 DB 에서 건너뛸 수 있다

브라우저에는 anon 키와 로그인 JWT 가 있어서, 로그인한 사람은 누구나 PostgREST(`/rest/v1/incident_reports`)를 직접 부를 수 있다. 서버 action 의 검사는 그 길에 없다. 지금 경위서는 **DB 가 넓고 action 이 좁다**(`20260601b_incident_reports_rls.sql`). 그런데 action 들이 상태 전이를 **사용자 client**(`createClient()`)로 해서, DB 가 넓은 그대로여야 앱이 돈다.

### 확정된 공격 (마이그레이션 원문 기준)

| # | 공격 | 판정 | 근거 |
|---|---|---|---|
| A1 | 작성자가 `status='approved'` 로 직접 PATCH → 발송 | **가능** | update 정책 USING 이 작성자를 받는다(`20260601b:36-42`). WITH CHECK 가 없어 USING 이 새 행에도 걸리지만 `author_email` 은 그대로라 통과한다. 테이블 전체 `grant update`(`:60`). `sendIncidentReport` 는 `status === "approved"`(`mail-actions.ts:51`)와 작성자/admin(`:54`)만 본다 — `approved_at`·승인 이력은 안 본다. 공문 PDF + Graph 발송(`:173`) + 시행번호 채번(`:83`) + SharePoint 보관(`:133`)까지 간다. **공문 팀장 칸에는 발송 때 다시 계산한 진짜 팀장 이름이 찍힌다**(`:70`) — 승인한 적 없는 사람의 이름이다. 승인자도 같은 길로 상태를 아무 값으로(예: 보내지 않고 `sent`) 바꿀 수 있다 |
| A2 | 작성자가 draft 에서 `approver_email=본인` PATCH → 제출 → 본인 승인 → 발송 | **가능** | 제출은 `approver_email` 이 비었을 때만 다시 계산한다(`actions.ts:231`). 승인은 `approver_email === me.email` 만 본다(`:270`). 활동 로그에 정상 `팀장 승인` 이 남아 A1 보다 눈에 안 띈다. 공문 팀장 칸은 역시 진짜 팀장(`mail-actions.ts:70`). 결정 5 '본인 작성 → 본인 승인 허용' 은 결재선이 본인을 팀장으로 고른 경우의 이야기다 — 여기는 결재선이 고르지 않은 사람이다 |
| A3 | `status='approved'` 행을 바로 INSERT → 발송 | **가능**(경위서가 아직 없는 사고에 한해 — `incident_id` unique) | insert `with check (true)`(`20260601b:28-29`). 발송 검사가 작성자만 보므로 **viewer 권한 운영자도** 된다 |
| A4 | 승인·발송 뒤 본문 고치기 | **가능 — PostgREST 없이도** | `updateIncidentReport`(`actions.ts:130-154`)에 상태 검사가 없고 RLS 도 상태를 안 본다. 승인 뒤 경위서 칸은 동결 스냅샷이라(`schemas.ts:19 isReportLiveMirrored`) 고친 값이 그대로 발송된다(`mail-actions.ts:112-117` 은 `rep` 값을 쓴다). 화면은 편집칸을 잠그지만(`ReportEditorWorkspace.tsx:96`) server action 은 화면 밖에서 부를 수 있다 |
| A5 | 작성자가 경위서 행 DELETE | **가능**(상태 무관) | `20260601b:48-54`. `incident_report_mail_sends.report_id` 가 `on delete cascade` 라(`20260601c:16`) **발송 이력도 같이 지워진다.** 앱에는 경위서 삭제 경로가 없다 — 쓰지 않는 권한이다 |
| A6 | 작성자가 `doc_number`·`sharepoint_url`·`recipient_emails`·`draft_date`·`author_*`·`incident_id` 를 임의값으로 | **가능** | 테이블 전체 grant. 시행번호가 공문관리대장과 어긋나고, `sharepoint_url` 은 화면에 링크로 나간다. `incident_id` 는 갱신 스키마에도 들어 있다(`schemas.ts:94` = 생성 스키마 `.partial()`) |

**막히는 것**: 작성자·승인자·admin 이 아닌 사람의 update(USING). 발송 이력 쓰기(`incident_report_mail_sends` 는 admin 만 — `20260601c:62-79`). operators 고치기(admin 만 — `20260510b:43-52`) — 그래서 결재선을 정하는 `operators.leader`·`role`·`team` 은 못 바꾼다.

**운영 DB 가 원문과 다를 수 있다.** 위 판정은 마이그레이션 원문 기준이다. 적용 전에 §7 SQL 로 정책·권한을 실측하고, 원문과 다르면 이 문서의 판정부터 고친다.

### 같이 고칠 앱 쪽 구멍

- 상태 전이(`transition`)가 '읽고 → 검사 → 쓴다' 를 따로 해서 원자적이지 않다(`actions.ts:163-176`). 지금은 RLS 가 마지막 문을 지키지만, admin client 로 옮기면 그 문이 없어진다 — update 에 상태 조건을 같이 건다(§4).
- 발송 때 결재선 덮어쓰기(`mail-actions.ts:66-77`)는 의도된 동작이다(주석: 화면과 같은 공문을 내려고 발송 시점에 굳힌다). 그런데 화면(`[id]/page.tsx:67-74`)은 **저장값 먼저**, 발송은 **라이브 먼저**라 오히려 둘이 갈릴 수 있고, 그때 팀장 칸이 '실제로 승인한 사람(`approver_email`)' 과 다른 이름이 된다 → 사용자 결정 2(§10).

## 2. 잠그는 방식 — 비교와 선택

| | (A) 칼럼 단위 GRANT | (B) BEFORE 트리거 | (C) RLS 좁히기 |
|---|---|---|---|
| 하는 일 | `revoke` 후 본문 칸만 `grant update (col…)`. insert·delete 는 authenticated 에서 회수. 보호 칸을 쓰는 action 은 admin client | 보호 칸이 바뀌면(`new.x is distinct from old.x`) authenticated 에게 `raise` | update USING·WITH CHECK 에 `status in ('draft','rejected')` + 작성자/admin |
| PostgREST·supabase-js | PostgREST 는 요청 본문의 키만 SET 에 넣으므로 `.update({ apology }).eq().select().single()` 은 그대로 된다(RETURNING 은 테이블 select 권한으로 충족). 권한 없는 칸이 하나라도 섞이면 문장 전체가 `42501`(`permission denied for table incident_reports`) → HTTP 403 → supabase-js `error.code === "42501"` | 트리거 문구 그대로 에러. errcode 를 `42501` 로 주면 403 | 대상 행이 0개가 되어 에러 없이 0행 → `.single()` 이 `PGRST116` |
| 새 칼럼이 생기면 | **기본으로 막힌다**(allowlist). 잊으면 저장이 42501 로 바로 깨져 드러난다 | **기본으로 열린다**(denylist). 결재 칸이 하나 늘 때 목록에 안 넣으면 조용히 열린다 | 무관(행만 본다) |
| 못 하는 것 | 어느 **행**인지(상태·작성자) | — (대신 규칙이 action 과 두 벌) | 옛 값↔새 값 비교. draft 에서 `approver_email=본인`(A2)을 못 막는다 |
| 레포 패턴 | `20261106b_s2_memos_harden.sql`(anon insert 를 칼럼으로 좁힘) · `20260627_entertest_test_runs.sql`(칼럼 select) · 최근 표는 `revoke all … from public, anon, authenticated` 후 필요한 것만(`20261125_incident_severity.sql`, `20261116_ops_weekly.sql`) | `20261106b_s2_memos_harden.sql` 의 `s2_memos_flood`(값 강제) | 레포 전반 |
| 테스트 | grant 칼럼 목록 = `incidentReportUpdateSchema` 키 + `updated_at` 을 원문 대조로 묶을 수 있다(단일 원천) | 원문 대조뿐. 동작은 실 Postgres 가 있어야 본다 | 원문 대조 |

**선택: (A) + (C).** (A) 가 '어느 칸', (C) 가 '어느 행' 을 맡고, 보호 칸 쓰기는 서버 action 이 검사한 뒤 admin client 로만 한다.

- **잊어도 안전한 쪽이 (A) 다.** 경위서는 결재·발송 칸이 계속 붙어 온 표다(`approver_role`·`service_name`·`greeting` 이 차례로 붙었다). (B) 는 그때마다 목록을 기억해야 하고, 기억해야 지켜지는 규칙은 언젠가 안 지켜진다.
- **(C) 없이 (A) 만이면** 작성자가 승인 뒤 본문 칸(사과문 등)을 PostgREST 로 고치는 A4 가 남는다. (C) 없이는 DB 가 상태를 모른다.
- **(B) 는 사고(incidents) 담당자 칸에 쓴다**(§5) — 거기는 반대로 거의 모든 칸이 공용 편집 칸이고 막을 칸이 둘뿐이라 denylist 가 맞다. allowlist 로 하면 어제 붙은 `severity` 같은 새 칸이 생길 때마다 사고 저장이 깨진다.

## 3. 보호 칸 — 확정

`incident_reports` 칼럼 31개(`20260601` 23 + `sharepoint_url`·`handling_rows`·`approver_role`·`director_role`·`ceo_role`·`service_name`·`greeting`·`closing`).

- **authenticated 가 고칠 수 있는 칸(11)** = `incidentReportUpdateSchema` 의 키에서 `incident_id` 를 뺀 것 + `updated_at`:
  `recipient_university` · `title` · `gyeongwi` · `cause` · `handling` · `handling_rows` · `prevention` · `apology` · `greeting` · `closing` · `updated_at`
  - `updated_at` 은 `updateIncidentReport` 가 보내서 넣는다. BEFORE 트리거 `set_updated_at` 이 늘 `now()` 로 덮으므로(`20260509_operators_table.sql:34-39`) 임의값이 남지 않는다.
  - 수신대학·제목은 화면이 보내지 않지만(사고에서 동기화) 스키마에 있고, 승인 때 사고 값으로 덮인다(`actions.ts:286-295`). 좁히는 것은 이 PR 밖.
- **보호 칸(20) — 서버(service_role)만**: `id` · `incident_id` · `service_name` · `draft_date` · `author_name` · `author_email` · `approver_name` · `approver_email` · `approver_role` · `director_name` · `director_role` · `ceo_name` · `ceo_role` · `status` · `reject_reason` · `approved_at` · `recipient_emails` · `doc_number` · `sharepoint_url` · `created_at`
- **insert·delete 는 authenticated 에게 없다.** 생성은 `createIncidentReport` 가 admin client 로, 삭제는 사고 삭제의 FK cascade 로만 일어난다. FK 동작은 참조하는 표의 소유자 권한으로 돌아서 authenticated 의 delete 권한과 무관하다 — 그래도 §8 탐침으로 확인한다.

보호 칸을 쓰는 곳(바뀐 뒤 전부 admin client):

| 칸 | 쓰는 action |
|---|---|
| 전부(생성) | `createIncidentReport` |
| `status`·`reject_reason`·`approved_at`·결재 칸·승인 스냅샷(`service_name` + 본문) | `submitForApproval` · `approveIncidentReport` · `rejectIncidentReport` · `revokeApproval` · `revokeSend` (모두 `transition`) |
| `doc_number` | `issueIncidentReportDocNumber`(이미 admin) · `sendIncidentReport`(이미 admin) · `revokeApproval`(비움) |
| `sharepoint_url`·`recipient_emails`·발송 스냅샷(`author_*`·결재 칸) | `sendIncidentReport`(이미 admin) · `revokeApproval`(`sharepoint_url` 비움) |

## 4. 앱 변경 — 지금 무엇을 보고, 옮긴 뒤에도 남는가

admin client 로 옮긴다는 것은 그 쓰기에서 RLS 를 끈다는 뜻이다. 옮긴 action 의 권한은 **action 의 검사가 전부**가 되므로, 검사가 이미 있는지를 줄 단위로 확인하고 테스트로 고정한다.

| action | 지금 보는 것 | 쓰기 client | 바뀐 뒤 |
|---|---|---|---|
| `createIncidentReport` (`actions.ts:46-128`) | 로그인(`:49-50`) · zod(`:52-55`). 작성자=본인·`status='draft'`·결재선은 서버가 채운다(`:107-110`) | 사용자(`:96`) | **insert 만 admin client.** 검사·채우는 값 그대로. 사고 prefill 읽기(`:63-69`)는 사용자 client 그대로(select 는 열려 있다) |
| `updateIncidentReport` (`:130-154`) | 로그인 · zod 뿐. 행 권한은 RLS(작성자·승인자·admin), **상태는 아무도 안 본다** | 사용자(`:143`) | **사용자 client 그대로** — DB 잠금이 실제로 쓰이는 유일한 길이라 grant·RLS 와 action 검사가 두 겹이 된다. update 앞에 행을 읽어 ① 작성자 또는 admin 이 아니면 `수정 권한이 없습니다.` ② `draft`·`rejected` 가 아니면 `작성 중이거나 반려된 경위서만 고칠 수 있습니다.` 갱신 스키마에서 `incident_id` 를 뺀다(`incidentReportCreateSchema.omit({ incident_id: true }).partial()`) |
| `transition` (`:156-180`) | `from` 상태(`:169`) — 읽기와 쓰기가 따로라 원자적이지 않다 | 사용자(`:162`) | **admin client + update 에 `.in("status", from)`.** 읽은 뒤 상태가 바뀌었으면 0행 → `.single()` 실패 → 지금처럼 에러로 돌려준다. 아래 호출자 검사는 손대지 않는다 |
| └ `submitForApproval` (`:212-255`) | 작성자 또는 admin(`:225-227`) · 승인자 비면 재계산, 못 찾으면 막음(`:231-235`) · from `draft`·`rejected` | (transition) | 그대로 |
| └ `approveIncidentReport` (`:257-317`) | **승인자 본인만**(`:270-272` — admin 도 못 한다) · from `pending_approval` · 사고 스냅샷 복사(`:277-297`) | (transition) | 그대로 |
| └ `rejectIncidentReport` (`:319-356`) | 승인자 본인만(`:333-335`) · from `pending_approval` | (transition) | 그대로 |
| └ `revokeApproval` (`:362-414`) | 승인자 또는 admin(`:373-375`) · from `approved` | (transition) | 그대로 |
| └ `revokeSend` (`:421-456`) | admin 만(`:424-426`) · from `sent` | (transition) | 그대로 |
| `recomputeChainColumns` (`:186-210`) | 읽기만 | — | 그대로(사용자 client 읽기) |
| `issueIncidentReportDocNumber` (`:467-504`) | 로그인만 · `approved`·`sent` 에서만 채번(`:485`) | admin | 그대로 — 잠금 뒤 `approved` 는 정상 승인으로만 닿는다 |
| `sendIncidentReport` (`mail-actions.ts:31-220`) | `status === "approved"`(`:51`) · 작성자 또는 admin(`:54`) | admin | 검사 그대로 — 잠금 뒤에는 이 두 검사로 충분해진다. 발송 스냅샷 규칙도 그대로(결정 2 = 현행 유지) |

**승인자가 본문을 고치는 흐름은 없다.** 편집 화면의 `editable` 은 상태만 본다(`ReportEditorWorkspace.tsx:96`, 페이지는 로그인 사용자를 넘기지 않는다 — `[id]/page.tsx:93-101`). 그래서 지금은 경위서를 여는 누구에게나 편집칸이 열리고, 저장이 되느냐는 RLS(작성자·승인자·admin)가 정한다. 승인자 차례(`pending_approval`)에는 편집칸이 잠겨 있고, 반려하면 작성자에게 돌아간다 — 승인자 편집은 '막혀 있지 않았을 뿐' 쓰이는 흐름이 아니다. → **결정 1**(추천: 작성자·admin 만). 정해지면 페이지가 `canEdit`(작성자·admin)을 넘겨 편집칸도 같은 기준으로 잠근다. 안 그러면 권한 없는 사람이 저장을 눌렀을 때 공유 칸은 사고에 먼저 저장되고(`ReportEditorWorkspace.tsx:142-152`) 경위서 칸만 거절되는 반쪽 저장이 된다.

## 5. 사고(incidents) 담당자 — 판정

- **앱 길로는 담당자가 안 바뀐다.** `updateIncident`(`incidents/actions.ts:94-140`)는 소유 검사 없이 누구나 아무 사고나 고치지만, `incidentUpdateSchema = incidentCreateSchema.partial()` 이고 생성 스키마에 `assignee_*` 가 없다(`incidents/schemas.ts:71-91` — zod 는 모르는 키를 버린다). 경위·원인·처리 같은 나머지 칸은 공용 장부라 누구나 고치는 것이 설계다.
- **DB 길로는 바뀐다.** update 정책이 active admin·member 면 아무 칸이나 받는다(`20260526b_incidents_rls.sql:26-34`).
- 담당자를 바꿔서 얻는 것:
  1. **본인이 승인자가 되는가 — 아니다.** 승인자는 담당자의 `leader` → 같은 팀 팀장 → 같은 팀 부장이고(`queries.ts:50-51`), operators 는 admin 만 고친다. member 는 결재선에 들 수 없다. 팀장이 남의 사고 담당자를 자기 팀원으로 바꾸면 자기가 승인자가 되지만, 원래 승인 권한자이고 결정 5 가 본인 승인을 허용한다 — '승인자 고르기' 수준이다.
  2. **승인 뒤 담당자를 바꾸면 공문 팀장 칸이 바뀐다.** 발송 때 결재선을 새 담당자 기준으로 다시 계산해 덮기 때문이다(`mail-actions.ts:64-77`). 결정 2 는 이 라이브 계산을 유지하기로 했고(각 팀의 팀장), 담당자 칸은 아래 트리거로 authenticated 가 못 바꾸므로 이 경로는 닫힌다.
  3. **남의 사고를 지울 수 있게 된다 — 실제 위험.** 삭제 정책이 `admin OR assignee_email = 본인`(`20260527c:13-16`)이라, 담당자를 본인으로 바꾸면 그 사고를 지울 수 있다. 경위서는 FK cascade 로 함께 지워지고(`20260625:34-36`) 그 발송 이력(`incident_report_mail_sends`)도 cascade 로 사라진다. 발송까지 끝난 공문 기록이 member 한 사람 손에 지워진다.
- **판정: 고칠 가치가 있다 — 이유는 결재가 아니라 삭제다.** 앱에 담당자를 바꾸는 길이 없어 DB 에서 막아도 앱은 안 깨진다. 막는 칸은 `assignee_email`·`assignee_name` 둘이고 방식은 (B) 트리거다(§2). member 의 공용 편집은 그대로.
- **승인·발송된 경위서가 있는 사고는 admin 만 지운다**(사용자 결정 2026-11-26 '관리자만 삭제'). 담당자 잠금은 '남의 사고' 를 막을 뿐, 담당자 본인이 자기 사고를 지우면 발송된 공문과 그 이력이 cascade 로 함께 사라지는 것은 그대로다. 삭제 정책을 `admin OR (assignee = 본인 AND 승인·발송된 경위서 없음)` 으로 바꾸고(§6-2b), 앱 `deleteIncident` 가 같은 조건을 먼저 확인해 `승인·발송된 경위서가 있는 사고는 관리자만 삭제할 수 있습니다.` 를 돌려준다 — **action 검사가 정본이고 RLS 는 두 번째 겹**이라 마이그레이션 적용 전에도 같은 동작이다. 확인 쿼리가 실패하면 지우지 않는다(조용한 0건 금지).
- 범위 밖(언급만): insert 때 `assignee_*` 를 남으로 넣는 것(insert 정책이 담당자=본인을 안 본다, `20260526b:16-24`) — 얻는 것이 '남이 지울 수 있는 사고를 하나 만든다' 정도다.

## 6. 마이그레이션 초안

### 6-1. `supabase/migrations/20261126_incident_reports_write_lock.sql`

```sql
-- 경위서(incident_reports) 쓰기 잠금 — 결재·발송 칸은 서버(service_role)만 쓴다.
-- 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md
--
-- 1) authenticated 는 본문 칸만 고친다(칼럼 grant). 새 칼럼은 기본으로 막힌다 — 여기 적지 않으면 못 쓴다.
--    목록은 incidentReportUpdateSchema 키 + updated_at 과 같아야 한다(write-lock-migration.test.ts).
-- 2) 어느 행을: 작성자 또는 admin, 작성 중·반려만.
-- 3) insert·delete 는 authenticated 에게 없다 — 생성은 server action(service_role), 삭제는 사고 삭제의 cascade.
-- 4) revoke all 이 grant 보다 앞이어야 한다 — 테이블 권한을 회수하면 칼럼 권한도 같이 회수된다.
-- 적용 순서: 앱(admin client 전환) 배포가 먼저다. 이 파일을 먼저 적용하면 옛 앱의 생성·제출·승인이 42501 로 깨진다.

begin;

revoke all on public.incident_reports from public, anon, authenticated;
grant select on public.incident_reports to authenticated;
grant update (
  recipient_university, title, gyeongwi, cause, handling, handling_rows,
  prevention, apology, greeting, closing, updated_at
) on public.incident_reports to authenticated;
grant all on public.incident_reports to service_role;

drop policy if exists incident_reports_insert on public.incident_reports;
drop policy if exists incident_reports_delete on public.incident_reports;

drop policy if exists incident_reports_update on public.incident_reports;
create policy incident_reports_update on public.incident_reports
  for update to authenticated
  using (
    status in ('draft', 'rejected')
    and (author_email = (select auth.jwt() ->> 'email') or (select public.is_admin()))
  )
  with check (
    status in ('draft', 'rejected')
    and (author_email = (select auth.jwt() ->> 'email') or (select public.is_admin()))
  );

notify pgrst, 'reload schema';

commit;
```

- select 정책 `incident_reports_read`(전원 읽기)와 RLS enable 은 그대로다.
- `is_admin()`·`auth.jwt()` 는 `(select …)` 로 감싼다 — 맨 호출은 행마다 평가된다. `is_admin()` 은 지금 정책의 인라인 admin 판정과 같은 조건이다(`20260510b:23-28`, email + `permission='admin'`).
- WITH CHECK 는 USING 과 같다. 작성자·상태 칸은 grant 가 없어 바꿀 수 없으니 겹쳐 적는 것이지만, 생략하면 USING 이 쓰인다는 규칙을 읽는 사람이 알아야 하므로 적어 둔다.

### 6-2. `supabase/migrations/20261126b_incidents_assignee_guard.sql`

```sql
-- 사고(incidents) 담당자 칸 잠금 — authenticated 는 assignee_* 를 못 바꾼다.
-- 설계: docs/superpowers/specs/2026-11-26-incident-write-permissions-design.md §5
-- 담당자를 본인으로 바꾸면 삭제 정책(admin OR assignee)을 통과해 남의 사고와 그 경위서(cascade)를 지울 수 있었다.
-- 앱은 담당자를 바꾸지 않는다(incidentUpdateSchema 에 assignee_* 없음). 나머지 칸의 공용 편집은 그대로.
-- service_role(서버)·postgres(SQL Editor)는 막지 않는다. security definer 로 바꾸지 말 것 — current_user 가 소유자가 된다.

begin;

create or replace function public.incidents_guard_assignee()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.assignee_email is distinct from old.assignee_email
       or new.assignee_name is distinct from old.assignee_name) then
    raise exception '사고 담당자는 바꿀 수 없습니다' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.incidents_guard_assignee() from public, anon, authenticated;

drop trigger if exists incidents_guard_assignee on public.incidents;
create trigger incidents_guard_assignee
before update of assignee_email, assignee_name on public.incidents
for each row execute function public.incidents_guard_assignee();

commit;
```

- `current_user` 는 security invoker 함수(기본)에서 문장을 실행한 역할이다. PostgREST 는 요청마다 `set local role authenticated`, admin client 는 `service_role` 로 돈다.
- 트리거 함수의 execute 권한은 트리거를 만들 때만 검사한다 — 회수해도 authenticated 의 update 때 트리거는 돈다(`s2_memos_flood` 와 같은 모양, `20261106b:30`).
- `before update of …` 는 SET 에 그 칸이 있을 때만 돈다. PostgREST 는 요청 본문의 키만 SET 에 넣으므로 담당자 칸을 안 보내는 사고 저장(`updateIncident`)에는 아예 안 돈다.

### 6-2b. `supabase/migrations/20261126c_incidents_delete_reported_admin_only.sql`

담당자 트리거(b)와 주제가 달라 레포 관례(한 파일 한 주제, 같은 날 b·c 접미사)대로 따로 둔다.

```sql
begin;

alter table public.incidents enable row level security;

drop policy if exists "incidents_delete_admin_or_assignee" on public.incidents;
create policy "incidents_delete_admin_or_assignee"
  on public.incidents for delete
  to authenticated
  using (
    (select public.is_admin())
    or (
      assignee_email = (select auth.jwt() ->> 'email')
      and not exists (
        select 1 from public.incident_reports r
        where r.incident_id = incidents.id
          and r.status in ('approved', 'sent')
      )
    )
  );

notify pgrst, 'reload schema';

commit;
```

- 정책 안의 `incident_reports` 읽기는 호출자(authenticated) 권한으로 돈다 — 그 표의 select 정책이 `using (true)` 라 보인다(잠금 뒤에도 select 는 그대로).
- 두 잠금 마이그레이션 모두 `alter table … enable row level security` 를 다시 적는다(이미 켜져 있어 멱등). 정책이 있어도 꺼져 있으면 아무것도 안 막는다.

### 6-3. 롤백 SQL

```sql
-- 롤백 1: 경위서 쓰기 잠금 → 20260601b 상태
begin;
grant select, insert, update, delete on public.incident_reports to authenticated;
drop policy if exists incident_reports_update on public.incident_reports;
create policy incident_reports_update on public.incident_reports
  for update to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or approver_email = auth.jwt() ->> 'email'
    or exists (select 1 from public.operators o where o.email = auth.jwt() ->> 'email' and o.permission = 'admin')
  );
drop policy if exists incident_reports_insert on public.incident_reports;
create policy incident_reports_insert on public.incident_reports
  for insert to authenticated with check (true);
drop policy if exists incident_reports_delete on public.incident_reports;
create policy incident_reports_delete on public.incident_reports
  for delete to authenticated
  using (
    author_email = auth.jwt() ->> 'email'
    or exists (select 1 from public.operators o where o.email = auth.jwt() ->> 'email' and o.permission = 'admin')
  );
notify pgrst, 'reload schema';
commit;

-- 롤백 2: 사고 담당자 잠금 제거
begin;
drop trigger if exists incidents_guard_assignee on public.incidents;
drop function if exists public.incidents_guard_assignee();
commit;

-- 롤백 3: 사고 삭제 정책 → 20260527c 상태 (admin OR 담당자 본인)
begin;
drop policy if exists "incidents_delete_admin_or_assignee" on public.incidents;
create policy "incidents_delete_admin_or_assignee"
  on public.incidents for delete
  to authenticated
  using (
    public.is_admin()
    or assignee_email = (auth.jwt() ->> 'email')
  );
notify pgrst, 'reload schema';
commit;
```

- 롤백 3 뒤에도 앱 `deleteIncident` 의 확인은 남아 앱 길로는 승인·발송 경위서가 있는 사고를 비admin 이 못 지운다(DB 길만 다시 열린다).

- **새 앱은 옛 DB 에서도 돈다**(admin client 는 RLS 를 안 타고, `updateIncidentReport` 는 옛 정책이 더 넓다). 그래서 DB 만 롤백해도 안전하다. 반대로 **잠긴 DB 에서 옛 앱은 깨진다** — 앱을 되돌릴 때는 DB 를 먼저 롤백한다.
- 롤백 1 은 anon 권한을 되살리지 않는다. 원문(`20260601b`)이 anon 에 준 적이 없고, Supabase 기본 권한으로 들어가 있었다면 실측(§7)에서 보인다 — anon 정책이 없어 행은 원래 못 읽었다.

## 7. 운영 DB 실측 SQL — 읽기 전용

적용 **전**에 한 번(원문과 같은지), 적용 **뒤**에 한 번(잠겼는지) SQL Editor 에서 돌린다. 모두 select 다.

```sql
-- 1) RLS 켜짐·강제 여부
select c.relname, c.relrowsecurity as rls_on, c.relforcerowsecurity as rls_forced
from pg_class c
where c.oid in ('public.incident_reports'::regclass,
                'public.incidents'::regclass,
                'public.incident_report_mail_sends'::regclass);

-- 2) 정책 원문 — 원문과 다르면 §1 판정부터 다시 본다
select tablename, policyname, cmd, roles, permissive, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('incident_reports', 'incidents', 'incident_report_mail_sends')
order by tablename, cmd, policyname;

-- 3) 테이블 단위 권한
select table_name, grantee,
       string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('incident_reports', 'incidents', 'incident_report_mail_sends')
  and grantee in ('PUBLIC', 'anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;

-- 4) 칼럼 단위 쓰기 권한 — 테이블 권한이 있으면 모든 칼럼이 나온다. 잠금 뒤 incident_reports UPDATE 는 11칸만
select table_name, grantee, privilege_type, count(*) as n_columns,
       string_agg(column_name, ', ' order by column_name) as columns
from information_schema.column_privileges
where table_schema = 'public'
  and table_name in ('incident_reports', 'incidents')
  and grantee in ('anon', 'authenticated')
  and privilege_type in ('INSERT', 'UPDATE')
group by table_name, grantee, privilege_type
order by table_name, grantee, privilege_type;

-- 5) 한 줄 판정 — 보이는 범위와 무관한 실제 권한 (지금 기대: 앞 다섯 true / 잠금 뒤: insert·delete·status·approver false, apology true)
select
  has_table_privilege('authenticated', 'public.incident_reports', 'INSERT') as can_insert,
  has_table_privilege('authenticated', 'public.incident_reports', 'DELETE') as can_delete,
  has_column_privilege('authenticated', 'public.incident_reports', 'status', 'UPDATE') as status_update,
  has_column_privilege('authenticated', 'public.incident_reports', 'approver_email', 'UPDATE') as approver_update,
  has_column_privilege('authenticated', 'public.incident_reports', 'apology', 'UPDATE') as apology_update,
  has_column_privilege('authenticated', 'public.incidents', 'assignee_email', 'UPDATE') as assignee_update;

-- 6) 트리거 (잠금 뒤 incidents_guard_assignee 가 보여야 한다)
select event_object_table as table_name, trigger_name, action_timing,
       event_manipulation, action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('incident_reports', 'incidents')
order by event_object_table, trigger_name, event_manipulation;

-- 7) 정책·트리거가 부르는 함수 정의
select p.proname, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('is_admin', 'set_updated_at', 'incidents_guard_assignee');

-- 8) 흔적 — 승인 시각·승인자 없이 승인·발송된 경위서, 작성자 = 승인자(팀장 본인 작성이면 정상)
select id, status, author_email, approver_email, approved_at, doc_number, created_at, updated_at
from public.incident_reports
where (status in ('approved', 'sent') and (approved_at is null or approver_email is null))
   or approver_email = author_email
order by updated_at desc;
```

- 4) 의 `information_schema` 는 '현재 역할이 주거나 받은 권한' 만 보여 준다. 표 소유자(postgres)로 돌리면 다 보이지만, 의심스러우면 5) 의 `has_*_privilege` 가 판정이다.
- 8) 에 행이 나오면 적용 전에 사용자에게 보인다 — 잠금은 앞으로를 막을 뿐 지난 행을 고치지 않는다.

## 8. 검증

### 8-1. 단위 테스트 (CI)

- **원문 대조 — 경위서**(`src/features/incident-reports/__tests__/write-lock-migration.test.ts`, 새 파일). 주석을 먼저 지운다(`/\/\*[\s\S]*?\*\//g`, `/--.*$/gm` — 정의를 주석 처리하고도 초록이면 대조가 아니다, `ops-weekly/__tests__/migration.test.ts:12-18` 과 같은 함수).
  - `grant update (…)` 칼럼 집합 = `Object.keys(incidentReportUpdateSchema.shape)` + `updated_at` (**단일 원천** — 편집 칸을 스키마에만 넣고 grant 를 잊으면, 또는 그 반대면 빨강)
  - 보호 칸 20개(§3)가 grant 목록에 하나도 없다(의도를 이름으로 적어 둔다)
  - `revoke all on public.incident_reports from public, anon, authenticated` 가 있고 **모든 grant 보다 앞**이다
  - authenticated 에게 `grant insert`·`grant delete`·테이블 단위 `grant update on`·`grant all on` 이 없다
  - `incident_reports_insert`·`incident_reports_delete` 는 drop 만 있고 create 가 없다
  - update 정책의 using·with check 각각에 `status in ('draft', 'rejected')` · `author_email = (select auth.jwt() ->> 'email')` · `(select public.is_admin())` 가 있고 `approver_email` 이 없다
- **원문 대조 — 사고 담당자**(`src/features/incidents/__tests__/assignee-guard-migration.test.ts`, 새 파일 — 같은 폴더 `severity-migration.test.ts` 모양). `current_user in ('authenticated', 'anon')` · 두 칸의 `is distinct from` · `errcode = '42501'` · `security definer` 없음 · `before update of assignee_email, assignee_name on public.incidents` · `revoke execute … from public, anon, authenticated`.
  - 같은 파일에 **`incidentUpdateSchema` 에 `assignee_email`·`assignee_name` 키가 없다** — 앱이 담당자를 보내기 시작하면 트리거에 막히므로 둘을 묶어 둔다.
- **actions**(`actions.test.ts`): admin client mock 에 `update().eq().in().select().single()` 과 `insert().select().single()` 을 붙인다.
  - 상태 전이 5개 — 쓰기가 **admin client** 로 가고 `.in("status", from)` 이 걸리며, 사용자 client 의 update 는 안 불린다
  - 전이 update 가 0행(`PGRST116`)이면 에러로 돌려준다(경합)
  - 권한 없음(비작성자 제출 · 비승인자 승인/반려 · 비승인자·비admin 승인 취소 · 비admin 발송 취소) — **어느 client 로도 쓰지 않는다**. 옮기기 전에도 초록인 회귀 단언이라, 검사 한 줄을 잠시 지워 빨강이 되는지 확인한다(Red-Green)
  - `createIncidentReport` — insert 가 admin client 로, 값은 지금과 같다(작성자=본인, `status='draft'`)
  - `updateIncidentReport` — approved·sent·pending 거절(쓰기 없음) · 비작성자 member 거절 · 작성자 draft/rejected 통과(사용자 client) · admin 의 남의 draft 통과 · 입력의 `incident_id` 가 patch 에 안 실린다 · (결정 1-a) 승인자 거절
- **schemas**(`schemas.test.ts`): 갱신 스키마가 `incident_id` 를 버린다.
- ~~(결정 2-a) **mail-actions**~~ — 하지 않는다. 사용자 결정 2(2026-11-26) = 공문 팀장 칸은 '운영부 각 팀의 팀장' = 현행(발송 순간 담당자 팀의 팀장을 라이브 계산) 유지. `mail-actions.ts`·`mail-actions.test.ts` 는 바꾸지 않는다.
- (결정 1-a) **편집 화면**(`ReportEditorWorkspace.test.tsx`): `canEdit=false` 면 draft 여도 편집칸·저장이 잠긴다.

### 8-2. DB 동작 — Docker 는 선택, 운영 탐침이 정식

- **레포에 로컬 Supabase 설정이 없다**(`supabase/config.toml` 없음). Docker 로 하려면 일회성 `postgres:15` 에 스텁(`authenticated`·`anon`·`service_role` 역할, `auth.jwt()` = `current_setting('request.jwt.claims', true)::jsonb`)을 만들고 operators·incidents·incident_reports 마이그레이션과 이번 두 파일만 골라 올려야 한다. **가능하지만** SQL 수준의 권한·RLS 만 보이고 PostgREST 동작(역할 전환·safeupdate·403 매핑)은 안 보인다 — SMS 우편함 때 Docker·SQL Editor 는 통과하고 PostgREST 경로에서만 터진 적이 있다. 그래서 **선택**이다(하면 scratch 에, 레포에는 안 넣는다).
- **정식 1 — 운영 SQL 탐침**(적용 뒤, 사용자가 실행). 쓰기를 '시도' 하는 것이라 아래 틀로 **한 문장씩 따로** 돌린다 — 성공하면 `rollback` 이 되돌리고, 실패하면 그 트랜잭션은 커밋 없이 끝난다. 값은 지금 값 그대로(`set x = x`)라 무엇이 새도 내용은 안 바뀐다.

  ```sql
  begin;
  set local role authenticated;
  select set_config('request.jwt.claims', '{"email":"<작성자 이메일>","role":"authenticated"}', true);
  <아래 한 문장>;
  rollback;
  ```

  | # | 문장 | 기대 |
  |---|---|---|
  | P1 | `update public.incident_reports set status = status where id = '<작성자의 draft id>'` | `42501` |
  | P2 | `update public.incident_reports set approver_email = approver_email where id = '<작성자의 draft id>'` | `42501` |
  | P3 | `update public.incident_reports set apology = apology where id = '<작성자의 draft id>' returning id` | 1행 |
  | P4 | `update public.incident_reports set apology = apology where id = '<작성자의 approved·sent id>' returning id` | 0행 |
  | P5 | `insert into public.incident_reports (incident_id, recipient_university, title, author_name, author_email) values ('00000000-0000-0000-0000-000000000000', 'x', 'x', 'x', '<작성자 이메일>')` | `42501`(열려 있었다면 FK 위반 `23503` — 어느 쪽이든 행은 안 생긴다) |
  | P6 | `delete from public.incident_reports where id = '00000000-0000-0000-0000-000000000000'` | `42501`(열려 있었다면 0행) |
  | P7 | (member 이메일로) `update public.incidents set assignee_email = '<본인>' where id = '<남의 사고 id>'` | `42501` `사고 담당자는 바꿀 수 없습니다` |
  | P8 | (member 이메일로) `update public.incidents set prevention = prevention where id = '<아무 사고 id>' returning id` | 1행 — 공용 편집 유지 |

- **정식 2 — PostgREST 실경로**(공격을 그대로 재현). `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`(e2e 계정 — 운영자 권한과 무관하게 DB 역할은 `authenticated`)로 anon 키 client 에 로그인해 `.from("incident_reports").update({ status: "draft" }).eq("id", <draft 인 경위서 id>).select()` → `error.code === "42501"`(HTTP 403). 칼럼 권한은 행을 고르기 전에 검사하므로 남의 행이어도 42501 이다. 지금 값과 같은 값을 넣으므로 잠금이 없어도 내용은 안 바뀐다. P5·P6 도 같은 방식(없는 id)으로. 일회성 스크립트는 scratch 에 둔다.
- **정식 3 — 화면 한 바퀴**(`MAIL_DRY_RUN=true`): 경위서 생성 → 사과문 저장 → 제출 → 승인 → 반려·다시 제출 → 승인 → 발송(dry-run) → 발송 취소 → 승인 취소. 각 단계 활동 로그와 상태 배지 확인. 본문 저장은 사용자 client 라 PostgREST 를 실제로 거친다.

## 9. 태스크 (TDD 순서 — 각 RED → GREEN)

묶음 넷은 서로 독립이다(①T1-T3 ②T4-T8 ③T9 ④T10-T11). 단 `actions.test.ts` 는 T4-T7 이 차례로 고치므로 한 사람(에이전트)이 맡는다 — 한 파일을 동시에 고치면 편집이 깨진다.

| # | 태스크 (2-5분) | 파일 | 변경 | 검증 | 의존 |
|---|---|---|---|---|---|
| T1 | 갱신 스키마에서 `incident_id` 제외 | `schemas.ts` · `__tests__/schemas.test.ts` | `parse({ incident_id, apology })` 결과에 `incident_id` 가 없다(RED) → `incidentReportCreateSchema.omit({ incident_id: true }).partial()` | 해당 테스트 초록 | 없음 |
| T2 | 경위서 잠금 원문 대조 테스트 | `__tests__/write-lock-migration.test.ts`(새) | §8-1 단언 전부. 파일이 없어 RED | 빨강 확인 | T1(칼럼 집합이 스키마에서 온다) |
| T3 | 마이그레이션 작성 | `supabase/migrations/20261126_incident_reports_write_lock.sql`(새) | §6-1 그대로 | T2 초록 | T2 |
| T4 | `transition` → admin client + `.in("status", from)` | `actions.ts` · `__tests__/actions.test.ts` | admin mock 에 update 체인. 전이 5종이 admin update·상태 필터를 단언하고 0행이면 에러(RED) → `transition` 교체 | actions 테스트 전체 초록 | 없음 |
| T5 | 권한 없음 회귀 단언 | `__tests__/actions.test.ts` | 가드 5개 각각 '어느 client 로도 쓰지 않는다'. 검사 한 줄을 잠시 지워 빨강 → 복원 | Red-Green 확인 | T4 |
| T6 | `createIncidentReport` insert → admin client | `actions.ts` · `actions.test.ts` | insert 가 admin 으로, 값 동일(RED) → 교체 | 초록 | T4 |
| T7 | `updateIncidentReport` 상태·작성자 검사 | `actions.ts` · `actions.test.ts` | §8-1 의 6종(RED) → 행을 읽어 두 검사, update 는 사용자 client 유지 | 초록 | T1 · 결정 1 |
| T8 | (결정 1-a) 편집 화면 `canEdit` | `[id]/page.tsx` · `ReportEditorWorkspace.tsx` · `__tests__/ReportEditorWorkspace.test.tsx` | `canEdit=false` 면 잠김(RED) → 페이지가 `getCurrentOperator()` 로 `작성자 \|\| admin` 을 계산해 넘기고 `editable = canEdit && (draft \|\| rejected)` | 초록 | T7 |
| T9 | ~~(결정 2-a) 발송 팀장 칸 = 실제 승인자~~ — **하지 않는다**(사용자 결정 2: 각 팀의 팀장 = 현행 유지) | — | — | — | — |
| T10 | 사고 담당자 가드 원문 대조 + 스키마 단언 | `src/features/incidents/__tests__/assignee-guard-migration.test.ts`(새) | §8-1 단언. 파일이 없어 RED | 빨강 확인 | 결정 3 |
| T11 | 마이그레이션 작성 | `supabase/migrations/20261126b_incidents_assignee_guard.sql`(새) | §6-2 그대로 | T10 초록 | T10 |
| T12 | CLAUDE.md 한 줄 | `CLAUDE.md` 사고보고 문단 | 경위서 결재·발송 칸은 서버만 · authenticated 는 본문 11칸(스키마 = grant, 원문 대조) · 작성 중/반려 · 작성자/admin · 새 칼럼은 기본 막힘 · 사고 담당자는 트리거 잠금 · **잠금 마이그레이션은 앱 배포 뒤 적용** | — | T3 · T11 |
| T12b | (리뷰 반영) 경위서 생성 권한 · 본문 저장 원자성 · grant 문 전체 고정 · `canEditReport` 공용 함수 · 테스트 파일 분리 · 승인·발송 경위서 사고 삭제 admin 만 · RLS 재확인 | `permissions.ts`(새) · `actions.ts` · `incidents/actions.ts` · `20261126c_…`(새) · 테스트 | 항목마다 RED → GREEN | 초록 | T1-T12 |
| T13 | 검증 | — | `npm run typecheck` · 고친 ts/tsx `npx eslint` · `npm test -- src/features/incident-reports src/features/incidents src/app/dashboard/incident-reports src/app/dashboard/_components/inspector/list-variants/incident-reports --maxWorkers=2` · `npm test -- src/components/common --maxWorkers=2`(레포 전역 가드) | 0 errors · 0 failures | 전부 |
| T14 | 배포·적용(사용자와) | — | §11 순서 | §7·§8-2 | T13 |

## 10. 사용자 결정

1. **승인자(팀장)가 본문을 고칠 수 있나** — (a) **작성자·admin 만**(추천) / (b) 작성자·승인자·admin(지금 RLS 그대로). 승인자 편집 흐름이 없고(§4), 승인자가 고치면 '작성자가 쓰고 팀장이 승인' 이 '팀장이 고치고 팀장이 승인' 이 된다. 지금 흐름은 반려 사유로 돌려보내는 것이다. (b) 면 정책 USING·WITH CHECK 에 `or approver_email = (select auth.jwt() ->> 'email')` 를 더하고 T8 의 `canEdit` 도 같게 한다.
2. **발송 공문의 팀장 칸** — **확정(2026-11-26): 사용자 답 '운영부 각 팀의 팀장' = (b) 현행 유지.** 발송 순간 담당자 팀의 팀장을 라이브로 계산하는 지금 동작을 그대로 둔다(T9 없음). 잠금 뒤에는 `approver_*` 를 서버(생성·제출의 결재선 계산)만 정하므로 평소엔 승인자 = 그 팀의 팀장이다. 검토했던 선택지: (a) 실제 승인자(`approver_email`)로 고정, 부장·본부장·담당자는 지금처럼 라이브(당초 추천) / (b) 지금대로 라이브 먼저 / (c) 승인 뒤 결재선이 바뀌었으면 발송을 막고 재승인. 부장·본부장은 앱에서 승인하는 칸이 아니라 라이브로 옛 행의 틀린 저장값을 고치는 효과를 남긴다. 팀장 칸만은 '승인한 사람' 이어야 한다. `author_*` 를 발송 때 담당자로 굳히는 것은 의도대로 둔다(주석 + `mail-actions.test.ts:328` 테스트) — 잠금 뒤 남는 영향은 '발송 취소 뒤 재발송·승인 취소 뒤 수정을 담당자가 맡는다' 뿐이다.
3. **사고 담당자 잠금을 이 PR 에 넣나** — (a) **넣는다**(추천 — 마이그레이션 1 + 테스트 1, 앱 무변경) / (b) 별도 PR.

## 11. 영향 파일 · 배포 순서

| 파일 | 변경 | 조건 |
|---|---|---|
| `supabase/migrations/20261126_incident_reports_write_lock.sql` | 새 파일 | |
| `supabase/migrations/20261126b_incidents_assignee_guard.sql` | 새 파일 | 결정 3-a |
| `supabase/migrations/20261126c_incidents_delete_reported_admin_only.sql` | 새 파일 — 승인·발송 경위서가 있는 사고는 admin 만 삭제 | 사용자 결정(관리자만 삭제) |
| `src/features/incident-reports/permissions.ts` · `__tests__/permissions.test.ts` | 새 파일 — `canEditReport`(화면·action 공용) · `canCreateReport`(사고 등록과 같은 기준) | |
| `src/features/incident-reports/__tests__/actions-write-lock.test.ts` | 새 파일 — 쓰기 잠금 action 테스트(actions.test.ts 800줄 상한) | |
| `src/features/incidents/actions.ts` · `__tests__/actions.test.ts` · `__tests__/delete-policy-migration.test.ts`(새) | `deleteIncident` 확인 + 원문 대조 | 사용자 결정(관리자만 삭제) |
| `src/features/incident-reports/actions.ts` | `transition`·생성 admin client, `updateIncidentReport` 검사 | |
| `src/features/incident-reports/schemas.ts` | 갱신 스키마 `incident_id` 제외 | |
| ~~`src/features/incident-reports/mail-actions.ts`~~ | 바꾸지 않는다 | 결정 2 = 현행 유지 |
| `src/features/incident-reports/__tests__/actions.test.ts` · `schemas.test.ts` | 테스트 | |
| `src/features/incident-reports/__tests__/write-lock-migration.test.ts` | 새 파일 | |
| `src/features/incidents/__tests__/assignee-guard-migration.test.ts` | 새 파일 | 결정 3-a |
| `src/app/dashboard/incident-reports/[id]/page.tsx` · `_components/ReportEditorWorkspace.tsx` · `_components/__tests__/ReportEditorWorkspace.test.tsx` | `canEdit` | 결정 1-a |
| `CLAUDE.md` | 한 줄 | |

**합계 12파일**(이 문서 제외 — 결정 1-a·3-a, 결정 2 는 현행 유지라 `mail-actions` 2파일 빠짐) · 잠금 필수분만이면 7파일(경위서 마이그레이션 + `actions.ts`·`schemas.ts` + 테스트 3 + `CLAUDE.md`). 결정 1-a +3, 2-a +2, 3-a +2.

**배포 순서 — 평소와 반대다.** DB 변경 PR 은 보통 머지 전에 마이그레이션을 적용하지만(칼럼이 먼저 있어야 코드가 돈다), 이 PR 은 권한을 **빼는** 변경이라 옛 앱이 잠긴 DB 에서 깨진다.

1. PR 머지 → Vercel 배포 완료 확인
2. §7 실측(전) — 원문과 다르면 멈추고 보고
3. 마이그레이션 세 개 적용(SQL Editor — `20261126` → `20261126b` → `20261126c`)
4. §7 다시(후) — 5) 의 기대값 확인
5. §8-2 탐침 P1~P8 · PostgREST 실경로 · 화면 한 바퀴
6. 이상하면 §6-3 롤백 — DB 만 되돌려도 새 앱은 돈다

## 12. 리스크

- **순서 역전** — 마이그레이션을 먼저 적용하면 옛 앱의 생성·제출·승인·반려·취소가 `42501` 로 깨진다(§11).
- **편집 칸을 늘릴 때 둘 다** — 스키마와 grant 를 함께 고쳐야 한다. 하나만 고치면 원문 대조가 빨강이다. 결재·발송 칸을 늘릴 때는 아무것도 안 해도 막힌다 — 그게 목적이다.
- **오류 문구·403 매핑은 실측 전** — 칼럼 권한 실패가 `permission denied for table incident_reports`(42501)로 나는지는 §8-2 정식 2 로 확인한다. 앱은 `error.message` 를 그대로 보여 주므로, `updateIncidentReport` 의 앞선 검사가 먼저 걸러 사용자에게는 한국어 문구가 간다.
- **admin 운영자도 PostgREST 로는 보호 칸을 못 쓴다** — DB 역할이 같은 `authenticated` 다. 앱의 admin 동작은 service_role 이라 무관하고, 사람이 SQL Editor(postgres)로 고치는 길은 열려 있다.
- **다음 PR(사용자 결정)**: 승인 경합(보안 리뷰 MEDIUM-2) — 승인 대기 중 사고 공유 칸은 누구나 고칠 수 있어, 승인 순간 스냅샷에 승인자가 못 본 수정이 들어갈 수 있다(공용 장부 설계). 막을지·어떻게 막을지는 사용자가 정한다.
- 범위 밖(언급만): `sendIncidentReport` 는 로그인·작성자/admin 만 본다(권한 등급은 안 본다 — 생성이 막혀 viewer 가 새 경위서의 작성자가 될 길은 닫혔다) · `rejectIncidentReport` 사유 길이 제한 없음(admin client 라 DB 제약도 없다) · 발송 이중 클릭 시 메일 두 통(상태 검사 → 발송 → 갱신 사이 경합) · 사고 insert 때 남을 담당자로 넣기.
