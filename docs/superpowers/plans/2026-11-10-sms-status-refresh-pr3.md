# 현황 최신화 PR-3

**Goal:** 버튼 한 번에 (3a) 세종 메일의 새 발번 리스트를 Teams 에 저장하고 (3b) 최신 세종 리스트로 `_번호`·`_학교`·`_서류` 세종 열과 `00. 요약`을 다시 계산해 06·07 과 함께 올린다.

**Spec:** `docs/superpowers/specs/2026-11-06-sms-status-refresh-design.md` §6.2 ①(첨부만)·④·§8. **출처** = `report/SMS 발신번호 사전등록/` 의 `data.py`·`build_xlsx.py`·`layout.py`·`summary.py`(git 밖) — 규칙은 원문대로, 여기엔 다른 점만.

**PR 분할:** PR-3a 검사 확장 + ① 첨부 저장(T1~5) → PR-3b ④ 본체 보존 갱신(T6~15, 3a 머지 후 `feat/sms-status-refresh-body`). DB 변경 없음(`watermarks jsonb` 있음).

## Global Constraints

PR-2 계획서(`…/plans/2026-11-07-sms-status-refresh-button.md`) 그대로 + 아래.
- 경로 없는 파일은 `scripts/sms-status-refresh/`, 새 모듈마다 `test_<모듈>.py`, 커밋 접두사 `feat(sms-status-refresh): `.
- **GREEN** = PR-2 unittest 명령 + `-p "test_<모듈>*.py"`. **VT** = `npm test -- <경로> --maxWorkers=1`. 전체 스위트·build·dev 서버 금지.
- `.Delete(`·행 `.Insert(` 금지 — 행 삭제는 U(고를 값)와 `고를값_*` 를 함께 줄인다.
- 결과·로그엔 건수·시트·파일 이름만.

## 고정한 결정

1. 값·수식만 쓴다 — 숨김 3장은 2행부터 A~T 를 덮고 남는 행 `ClearContents()`, 뷰 새 행은 수식 + 9행 서식, CF 는 `ModifyAppliesToRange`(행 범위가 `$2:$N`·CF·`/ N건`·뷰 행에 박혀 있다).
2. `_번호` = 세종 순서·No 1..n. `_학교`·`_서류` = 기존 행 제자리, 새 학교는 끝에 같은 No(사람 칸 빈칸, 단 `_서류` 제출 상태 `서류 확인 안 됨`), 세종에서 빠진 학교는 행을 남기고 세종 열만 0·`-`·`번호 없음`.
3. 키 — `_번호`: 번호 숫자(`~` 없음·8자리 이상·모든 쪽에서 1회), 아니면 (정규화 학교명, 원문). `_학교`·`_서류`: 정규화 학교명(겹치면 + 구분). 정규화 = NFC·공백 접기·`NAME_FIX`. `_번호` 구분은 이어진 `_학교` 행을 따른다(새 학교는 `kind()`).
4. 세종 열 — `_번호` No·학교명·구분·발신번호·상태·등록일자 / `_학교` 등록 회선·일괄·추가·서류 미비·최근 등록일 / `_서류` 등록 회선·세종 등록 상태. 기준 판정 열 — `_번호` 제출 서류·비고, `_학교` 제출 서류·확인·비고. 나머지(모르는 열 포함)는 사람. P·T 다시 씀, U 안 건드림.
5. 기준 판정 — `_수정` 이 없으면 현황 파일 `_261017` 의 **SharePoint 버전 기록 중 첫 판**(Graph `/items/{id}/versions` 가장 오래된 것 `/content`, 사용자 확정 2026-11-10 — `_261015` 는 쓰지 않는다), 있으면 `_수정` 의 `기계` 값과 비교해 다르거나 없으면 `사람`(이후 계속).
6. 비고 두 열은 덧붙이기만, 지울 수 있는 건 `번호 없음` 뿐(레포 밖 입력이 섞여 있다).
7. `_수정` = 숨김·맨 끝 시트, `구분·시트·키·열·값·사유·기록일`, 구분 `기계`·`사람`·`못 옮김`(이어 감).
8. `00. 요약` 은 출처 배치로 다시 쓴다(링크 = 각 뷰 검색 칸, 0 은 링크 없음). 기준 자료 줄(00·01~03) = `세종 「{파일 이름}」 … {YYYY-MM-DD} 갱신`. 04·05·`_확인` 은 안 만진다.
9. 상태 = B 칸 바탕색(출처 `row[1]`), 모르는 색은 `번호 없음`, B≠C 는 경고 건수.
10. 메일 — `SMS_STATUS_MAILBOX_UPN` 의 `inbox` 아래 `01. 결제사/세종텔레콤`·`02.운영부/운영2팀/{SMS_STATUS_SEJONG_CONTACT_FOLDER}`(하위 2단계), watermark 뒤 첨부 있는 메일을 오래된 순 50통·120초까지. 인라인 아닌 첨부 중 `발번\s*리스트`·4MB 이하 → `put_new(SEJONG_DIR, 원래 이름)`, 409 = 이미 있음. 권한 = 메일함 기능과 같은 앱의 Application `Mail.Read`(새 권한 없음).
11. mail watermark = max(이전, 처리한 마지막)을 ok 마다 다시 낸다. 첫 기준 `FIRST_WATERMARK`.

## Review Focus

사람 칸 이동·삭제(T1·T10) · 옛 범위를 보는 뷰(T2·T11) · 기준 판정 오류(T1·T8) · COM 구조 변경(T13·T15) · 메일 누락·덮어쓰기(T4)

## PR-3a

### Task 1: 검사 ① — 숨김 시트 (검사 먼저)
- **Files** 새 `keys.py`·`verify_table.py`·`fixtures_status.py`(테스트용 `layout.search_sheet` 이식) / 고침 `verify.py`
- **Interfaces** `school_key`·`number_keys(*sides)`·`read_table(wb, sheet) -> Table(header, rows, u_last)`(T6 이 재사용)·payload `table {sheet, beforeRows, columns, textColumns, rows, added, removed}`·`verify_workbook(…, *, baseline=None)` — 키는 before/after 에서 따로 센다
- [ ] 사전 확인(컨트롤러, 읽기만): `_261017`(과 그 버전 기록) 이 결정 1·3·4·5·8 과 맞는지 — 다르면 계획부터
- [ ] RED `숫자만_같으면_같은_키`·`사람_칸_딴_줄_실패`·`사람_판정_칸_변경_실패`·`비고는_덧붙이기만`·`빠진_메모_누락은_실패`·`U_가_바뀌면_실패`·`06_07_만이면_27개_그대로`
- [ ] GREEN → 커밋 `숨김 시트 검사`

### Task 2: 검사 ② — 뷰·요약·`_수정`
- **Files** 새 `verify_view.py` / 고침 `verify.py`
- **Interfaces** payload `view`·`summary`·`meta` 의 필드를 여기서 정한다(T11~T13 이 따른다)
- [ ] RED `뷰가_옛_범위를_보면_실패`·`CF_가_안_따라가면_실패`·`줄면_남은_수식_실패`·`요약_링크가_빠지면_실패`·`_수정_은_숨김_맨_끝`
- [ ] GREEN → 커밋 `뷰·요약·_수정 검사`

### Task 3: 메일함 읽기 — `mailbox.py`
- **Files** 새 `mailbox.py`
- **Interfaces** `Mailbox(token, upn, http)`·`folder_id(path)`(`inbox` 부터 `childFolders?$filter=displayName eq '…'`)·`descendants(fid, depth=2)`·`messages_since(fid, since)`(`$filter=receivedDateTime gt {since} and hasAttachments eq true&$orderby=receivedDateTime asc&$top=50`)·`attachments(mid)`·`attachment_bytes(mid, aid)`(`/$value`). 구현자가 확인: Graph 가 이 조합을 거절하면 정렬은 코드에서
- [ ] RED `이름_경로로_폴더_찾기`·`작은따옴표는_두_번`·`다음_쪽까지_읽는다`·`403_은_MailboxError`
- [ ] GREEN → 커밋 `메일함 읽기`

### Task 4: 첨부 저장 단계 — `mail_step.py`
- **Files** 새 `mail_step.py` / 고침 `contract.py`(`STEP_IDS = ("mail", "moa", "pims", "workbook")`)·`refresh.py`(`REGISTERED["mail"]`)·`workbook_step.py`(`_stale_tail`: ` · 새 세종 메일은 확인 못 함`)·`contract.ts`(`STEP_LABEL.mail = "메일 첨부"`)·STEP_IDS 단언 테스트 둘
- **Interfaces** `run_mail_step(ctx, *, graph_factory, mailbox_factory, clock)` — summary `메일 N통 · 저장 S · 이미 있음 E · 건너뜀 K`, 코드 `mail_config`·`mail_folder_missing`·`mail_access_denied`·`mail_failed`
- [ ] RED `발번_리스트만_저장`·`같은_이름은_이미_있음`·`watermark_는_처리한_마지막_메일`·`메일_없어도_watermark_유지`·`시험_실행은_저장_없음`·`50통_120초_상한`·`저장_실패는_watermark_없음`·`결과에_메일_원문_없음`·`같은_실행_06_07_이_새_리스트를_쓴다`
- [ ] GREEN(PY 전체 + VT(`src/features/sms-sender/status-refresh`) + typecheck) → 커밋 `세종 메일 첨부 저장`

### Task 5: PR-3a 검증·시험·PR
- **Files** 고침 `.env.example`(`SMS_STATUS_MAILBOX_UPN=`·`SMS_STATUS_SEJONG_CONTACT_FOLDER=`)·`CLAUDE.md`(자동화 표 `sms-status-refresh` 행에 `+PR-3a: 세종 메일 첨부 저장`)
- [ ] PY 전체 · VT(`src/features/sms-sender src/features/agent-org src/features/automations src/app/api/automations src/app/dashboard/settings`) · typecheck 0 · 개인정보 스캔
- [ ] **STOP — 시험(읽기만)**: 두 env 를 넣고 `SMS_STATUS_REFRESH_DRY_RUN=true` + `refresh.py --steps mail` → `메일 N통`, Teams 새 파일 없음
- [ ] PR `feat: SMS 현황 최신화 — 세종 메일 발번 리스트 자동 저장 (PR-3a)` → 머지 후 버튼 → '메일 첨부 성공'

## PR-3b

### Task 6: 행 템플릿·숨김 시트 모양·실패 코드
- **Files** 새 `formula_template.py`·`sheet_table.py` / 고침 `contract.py`, `src/features/sms-sender/status-refresh/` 의 `contract.ts`·`contract.test.ts`
- **Interfaces** `infer(formulas, *, last, hidden) -> Template`·`render(t, r, last)`·`check_shape(table)`·`read_meta(wb)`·`check_targets(wb)`, 코드 `baseline_missing`·`sheet_shape`·`view_shape`
- [ ] RED `P_행_참조와_끝이_움직인다`·`고정_숫자는_그대로`·`한_행만_달라도_불일치`·`사람_칸_수식은_sheet_shape`·`새_실패_코드_문구`
- [ ] GREEN·VT → 커밋 `행 템플릿·숨김 시트 모양`

### Task 7: 세종 리스트 — `sejong.py`
- **Files** 새 `sejong.py`(`data.py` 의 `load_lines`·`STATE_BY_FILL`·`kind`·`check_note`·`date_fix`)
- **Interfaces** `load_sejong_lines(data: bytes) -> (lines, warnings)`·`group_schools(lines)`
- [ ] RED `상태는_대학명_칸_바탕색`·`모르는_색과_B_C_다름은_경고`·`머리글이_다르면_source_shape`
- [ ] GREEN → 커밋 `세종 리스트 읽기`

### Task 8: 사람 칸 기준 — `edits.py`
- **Files** 새 `edits.py`
- **Interfaces** `Ownership.from_meta(rows)`·`.from_baseline(tables)`·`owner(sheet, key, col, value)`·`append_only(cur, new, sep)`·`meta_rows(…)`
- [ ] RED `기준과_다르면_사람`·`기준에_없으면_사람`·`한번_사람이면_계속`·`못_옮김은_이어_간다`·`append_only("A / 메모", "A / 새", " / ") == "A / 메모 / 새"`
- [ ] GREEN → 커밋 `사람 칸 기준`

### Task 9: `_학교`·`_서류` 계산 — `merge_schools.py`
- **Files** 새 `merge_schools.py`(`build_xlsx.py` 의 `school_records`·`check_records`)
- **Interfaces** `merge_schools(school, docs, groups, targets, own) -> SchoolMerge(school_rows, doc_rows, added, vanished, decisions)` — T 태그는 최종 값으로
- [ ] RED `세종_열만_다시_계산`·`새_학교는_끝에_같은_No_로`·`빠진_학교는_행을_남긴다`·`사람이_고친_확인은_그대로`
- [ ] GREEN → 커밋 `_학교·_서류 보존 갱신`

### Task 10: `_번호` 계산 — `merge_numbers.py`
- **Files** 새 `merge_numbers.py`(`build_xlsx.py` 의 `number_records`)
- **Interfaces** `merge_numbers(numbers, lines, schools, own) -> NumberMerge(rows, added, removed, orphans, decisions)`
- [ ] RED `하이픈이_달라도_메모를_옮긴다`·`공유_번호는_학교별로`·`빠진_번호_메모는_못_옮김`·`짝이_둘이면_못_옮김`·`구분은_학교_행을_따른다`
- [ ] GREEN → 커밋 `_번호 보존 갱신`

### Task 11: 01~03 뷰 — `views.py`
- **Files** 새 `views.py`
- **Interfaces** `view_payload(wb, view, hidden, n, note_text)` — 검색 칸 = DV `=고를값_*` 칸, CF 끝 ≠ `8+옛 행 수` 거나 템플릿 불일치면 `view_shape`
- [ ] RED `한_줄_늘면_범위_k_건수가_따라간다`(01: `$P$2:$P$103`·k=102·`/ 102건`)·`줄면_수식도_준다`·`추가_열도_따라간다`(02 `PDF 보기`)
- [ ] GREEN → 커밋 `01~03 뷰 행 수 따라가기`

### Task 12: `00. 요약` — `summary_sheet.py`
- **Files** 새 `summary_sheet.py`(`summary.py`·`layout.py`)
- **Interfaces** `summary_payload(schools, docs, numbers, checks, search, base_text)`
- [ ] RED `다섯_구분_11_유형이면_63행_병합_C51_I62`·`0_칸에는_링크가_없다`·`파란_수는_그_키로_거른_행_수`
- [ ] GREEN → 커밋 `00. 요약 집계`

### Task 13: COM 쓰기 — `excel_sheets.ps1`
- **Files** 새 `excel_sheets.ps1`(BOM, dot-source) / 고침 `excel_apply.ps1`(`kind` 없거나 `compare` 면 기존대로)·`test_ps_static.py`
- **Interfaces** `Write-TableSheet`(text 열 `'@'`, A~T `Value2`, P `Formula`, 남는 행 `ClearContents()`)·`Write-ViewSheet`(9행 서식은 칸별 속성으로 — `Copy` 는 CF 까지 복제한다, `ModifyAppliesToRange` 수가 다르면 throw)·`Write-MetaSheet`(맨 끝·`Visible = 0`)·`Write-SummarySheet`(`ClearHyperlinks()`·`UnMerge()`·`Cells.Clear()` 후 다시 씀). 저장 한 번, `Calculation` 불변
- [ ] RED(정적) `Delete_Insert_Copy_Save_없음`·`표는_U_를_안_쓴다`·`계산_모드를_안_바꾼다`
- [ ] GREEN·pwsh 구문 검사(실제 Excel 은 T15) → 커밋 `COM 쓰기 확장`

### Task 14: 현황 파일 단계에 끼우기
- **Files** 고침 `workbook_step.py`·`test_run_budget.py`·`test_ps_static.py`(재저장 금지 목록)
- **Interfaces** Consumes T1·T2·T6~T13. 기준 = 현황 파일의 첫 버전(`_수정` 없을 때만 받음, 버전 기록이 1개뿐이면 그 판 = 지금 파일), 올린 뒤 기대 행 `max(n+1, u_last)`(구현자가 확인: `used_range_rows` 가 서식만 남은 행도 세는지), 바뀐 점 `_번호: 592→599행 · 새 7 · 빠짐 0`·(있으면) `옮기지 못한 메모 N건 — _수정 '못 옮김'`, `EXCEL_RESERVE_S` 120→300·`EXCEL_MIN_S` 300→420
- [ ] RED `첫_실행은_기준_파일을_받는다`·`기준_파일이_없으면_baseline_missing`·`올린_뒤_기대_행은_새_행_수`·`바뀐_점은_건수만`, 예산 `800→500`·`500→200`·`419→시간 부족`
- [ ] GREEN(PY 전체 + typecheck) → 커밋 `현황 파일 단계 연결`

### Task 15: PR-3b 검증·시험·PR
- **Files** 고침 `CLAUDE.md`(같은 행에 `+PR-3b: 숨김 시트·요약 갱신`)
- [ ] PY 전체 · VT(`src/features/sms-sender src/app/dashboard/internal-admin`) · typecheck · lint 0 · 개인정보 스캔
- [ ] **STOP — 실 파일 시험(사용자와)**: `SMS_STATUS_REFRESH_DRY_RUN=true` + `refresh.py --steps workbook` → `검사 n/n 통과 · 올리지 않음`. 사용자가 `work.xlsm` 을 연다 — 복구 알림 없음·01~03 끝 행·00 파란 수 클릭
- [ ] PR `feat: SMS 현황 최신화 — 숨김 시트·요약 보존 갱신 (PR-3b)` → 머지 후 버튼 1회: '현황 파일 성공'·'내 대학' 그대로

## 실행 시간 (예산 25분)

정상 ≈ 7.5분. 상한 합 30.5분(mail 2.5·Moa 9·PIMS 3·현황 파일 16). mail 은 120초에 멈추고 Excel 은 남은 시간 < 420초면 `excel_failed`, 아니면 타임아웃 min(600, 남은 − 300) — 앞이 최악(14.5분)이어도 25분 안.

## 사용자 확인 필요

1. **메일함·담당자 폴더 이름** — 권장: 조사 때 읽은 그 메일함, 폴더 이름(사람 이름)은 회사 PC `.env.local` 에만.
2. **세종에서 빠진 학교** — 권장: 행을 남긴다. 담당자·'내 대학'·No 이음이 그 행에 있다.
3. ~~`_261017` 이 `_261015` 의 복사본인가~~ → **확정(2026-11-10): `_261017` 파일 기준**(결정 5).

1·2 도 권장안으로 확정(2026-11-10): 메일함 = 조사 때 그 메일함, 빠진 학교 = 행 유지·세종 열만 0.
