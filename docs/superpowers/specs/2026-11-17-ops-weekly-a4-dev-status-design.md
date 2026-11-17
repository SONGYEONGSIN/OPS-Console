# 운영부 주간업무보고 A4 — 개발/테스트 구분 수집 설계

작성 2026-11-17, 같은 날 사용자 결정·빌더 확인 반영. 근거: 승인받은 Moa 로그인 4회 정찰(작업 방식은 세션 4), A1 설계(`2026-11-16-ops-weekly-report-design.md`)와 A1 계획의 'Later PRs', 코드 읽기.

이 문서가 A1 §6.1 과 A1 계획 'Later PRs' 의 A4 항목(WorkStatistics 수집을 마감 스크랩 로그인에 얹기)을 대체한다. WorkStatistics 에는 운영자·개발자별 집계표만 있고 서비스별 구분이 없다(정찰 세션 1·2). 실행 방식도 사용자가 별도 실행으로 정했다(2026-11-17).

**범위 추가(사용자 2026-11-17)**: 자동 항목이 굳는 시점을 운영자의 [제출] 에서 당번의 [최종 보고] 로 옮긴다(§4.12). A1 의 '제출하면 자동 항목을 스냅샷으로 굳힌다' 를 대체한다.

## 1. 왜

원서접수 탭의 `개발 중`·`테스트 중` 카드와 묶음은 `ops_weekly_dev_status` 를 읽는다(`listDevStatuses` → `freshDevStages`). 그런데 그 표를 채우는 코드가 없어서 지금은 시작 전 서비스가 전부 `구분 미확인` 으로 나온다. A4 는 Moa `작업진행현황` 에서 서비스별 구분을 주 1회 가져와 그 표를 채운다.

성공 기준은 넷이다.
- 수요일 10:00 작성 요청이 나갈 때 그 주의 시작 전 서비스가 `개발 중`·`테스트 중` 으로 나뉘어 보인다.
- 수집이 실패한 주는 지난주 값 대신 `구분 미확인` 으로 보인다.
- 실패하면 Teams 로 알림이 온다.
- 수요일 전에 미리 제출한 보고서도 최종 보고 시각의 값으로 굳는다.

## 2. 목표 / 비목표

**목표**
- 회사 PC 예약 작업이 수요일 09:30 에 Moa 에 로그인해 작업진행현황 전체를 한 번 조회하고, 서비스ID 와 테스트 오픈 칸을 인제스트한다.
- 실패와 미실행이 기존 자동화 보고(실패 즉시 Teams, 11:00 일일 보고)에 잡힌다.
- (범위 추가) 자동 항목을 당번의 [최종 보고] 때 전원 것을 한꺼번에 굳힌다(§4.12).

**비목표**
- 주간보고 화면 변경. 굳는 시점 안내 한 줄(§4.12)만 더한다. 표는 A1 에 이미 있어 마이그레이션이 없다.
- 웹에서 다시 돌리는 버튼(요청 큐·폴러). 후속 PR 이다(사용자 2026-11-17).
- 작업진행현황의 다른 열(엑셀 업로드·개발 요청·개발완료·리얼배포)과 담당자·대학명 저장.
- 마감 스크랩(`scripts/moa-closing/scrape.py`) 수정. A4 는 가져다 쓰기만 한다.

## 3. 사용자 확정 사항 (바꾸지 않는다)

1. 원천은 Moa `/Develop/WorkStatus`(작업진행현황)다.
2. 로그인한 Selenium 페이지에서 폼 값을 넣고, 페이지 안에서 `$.ajax({url:'/Develop/WorkStatus',type:'POST',data:$('#form0').serialize(),headers:{'X-Requested-With':'XMLHttpRequest'}})` 를 돌린다. Manager·Developer·CategoryName 은 비우고, 오픈일 범위는 6번을 따른다. 브라우저 밖 `requests.post` 는 IIS 403 이 나므로 금지다.
3. `table[summary="작업진행현황"] tbody tr` 를 파싱한다. 서비스ID 는 `td.td_block` 안 `<span>` 의 7자리 숫자다. 7번째 칸 `테스트 오픈` 이 일시면 `test`, `-` 면 `dev` 다.
4. 주 1회 수요일 아침, 별도 실행이다. 10:00 작성 요청 전에 끝나야 하고 09:00 마감 스크랩과 겹치면 안 된다.
5. 로그인은 기존 Moa 로그인과 SMS 우편함 흐름을 재사용한다.
6. 오픈일 범위는 올 학년도 시작(오늘 또는 그 전의 가장 가까운 3/1, KST) ~ 오늘+6개월이다. 늘 앞으로 넓게 보고 2월 예외는 없다. 처음의 '그 학년도' 를 대체한다(§4.8).
7. 자동 항목(원서접수 개발/테스트, PIMS, 휴가/백업요청 링크)은 당번의 [최종 보고] 때 굳는다. 제출 때 고정되는 것은 손으로 쓴 내용뿐이다(§4.12).
8. 웹 재실행 버튼은 후속 PR 이다.

6~8 은 2026-11-17 에 추가된 결정이다.

**정찰로 확인한 사실**(세션 4)
- Manager 를 비우면 한 번의 요청으로 전 운영자 1,463행이 온다(2026-03-01~2027-02-28, 1.33MB, 페이징 없음).
- 응답은 조각이 아니라 전체 페이지다.
- 행은 8칸이고 링크나 data 속성이 없다. 서비스ID 는 모든 행에서 7자리이고 중복이 없다.
- 일시 칸은 `YYYY-MM-DD HH:MM:SS` 또는 `-` 이고 빈 문자열은 없다. 테스트 오픈이 `-` 인 행은 158개다.
- 기본값은 Manager = 로그인한 운영자, CategoryName = 수시다. 비우지 않으면 15행만 온다.

## 4. 결정

### 4.1 SMS 소비자 이름 — 새 값 `ops-weekly-dev-status`

`closing` 을 재사용하지 않는다. `claim_sms_inbox` 는 **같은 소비자의 재획득을 통과시킨다**(`20260911_sms_code_inbox.sql`, 재시도가 자기 리스에 막히지 않게 만든 규칙). 같은 이름을 쓰면 마감 스크랩이 로그인하는 도중에 A4 의 reset 이 409 없이 통과해 우편함을 비운다. 그러면 두 작업이 서로의 인증번호를 꺼내 가고, 틀린 코드를 제출하면 캡차 잠금으로 Moa 자동화 전체가 선다. 이름이 달라야 리스가 실제로 막는다.

이름은 표(`ops_weekly_dev_status`)와 잡 id 에 맞춘다. `dev-status` 는 `dev-test`·`dev-controls`·`dev-tools` 사이에서 다른 기능으로 읽힌다.

python 상수와 zod enum 은 짝을 맞춰야 한다. 어긋나도 에러가 나지 않기 때문이다. 서버가 400 을 주면 python 은 이를 `InboxUnavailable` 로 읽고 **조용히 make 로 넘어간다**.
- `SMS_CONSUMERS` 에 이름을 추가하고, `__tests__/schemas.test.ts` 의 목록을 다섯으로 고친다.
- python 은 `collect.py` 에 한 줄 상수 `SMS_CONSUMER = "ops-weekly-dev-status"` 를 둔다. OS env 로 덮어쓸 수 없게 한다. `.env.local` 오타 하나가 같은 조용한 폴백을 만들기 때문이다.
- 드리프트 테스트를 둔다. python 원문에서 상수를 읽어 enum 에 있는지 확인한다(`poller-drift.test.ts` 의 마지막 케이스와 같은 모양).
- **배포가 먼저다.** prod enum 에 이름이 없는 상태로 돌면 위의 폴백이 일어난다(§7).
- CLAUDE.md 'Moa 로그인 SMS 인증번호 우편함' 절의 '넷뿐' 을 다섯으로 고친다.

### 4.2 스크립트 — `scripts/moa-dev-status/`, 로그인은 import

| 파일 | 내용 |
|---|---|
| `collect.py` | 진입점. env·로그인·조회·인제스트·run-log, `SMS_CONSUMER` 상수, 수집 범위 함수 |
| `parse.py` | 순수 파서. 표준 라이브러리 `html.parser` 만 쓰고 selenium 을 import 하지 않는다 |
| `test_parse.py` · `test_collect.py` | 합성 HTML 과 가짜 드라이버로, 브라우저 없이 |
| `run-local.ps1` | 마감 `run-local.ps1` 과 같은 모양(Continue 상태로 python 호출, 종료 코드로 판정, `run-local.log`) |
| `register-task.ps1` | 작업 `OPS-Console-Ops-Weekly-Dev-Status`, 스위치 `-Unattended`·`-StorePassword` 는 마감과 같다 |

- 로그인·드라이버·학년도 계산은 `scripts/moa-closing/scrape.py` 를 **import** 해서 쓴다(`setup_driver`·`login_and_2fa`·`sms_urls`·`sms_source_label`·`academic_year_range`). 복사하면 2FA·캡차·리스 처리가 두 벌이 되고 한쪽만 고쳐진다. `moa-ratio/audit.py`·`moa-settlement/discover.py`·`sms-status-refresh/refresh.py` 가 이미 import 로 쓴다.
- sys.path 는 `refresh.py` 처럼 스크립트가 직접 넣는다(`python -I` 와 호환). selenium 과 scrape 는 로그인 함수 안에서 늦게 import 해서 테스트가 브라우저 없이 돌게 한다.
- `scrape.py` 는 고치지 않는다. 마감 스크랩이 깨질 위험을 A4 가 떠안지 않는다.
- 새 패키지는 없다. 파서가 표준 라이브러리라 `scripts/moa-closing/requirements.txt` 로 충분하고, 회사 PC 에 설치 단계를 새로 만들지 않는다.
- `CLOSING_DUMP_DIR` 를 레포 밖 임시 폴더로 정한다(`refresh.py` 선례). 로그인 실패 덤프 `fail-login.*` 가 스케줄러 작업 폴더(레포 루트)에 떨어지지 않게 하기 위해서다.
- env 는 마감과 같은 키를 쓴다(`MOA_USERNAME`·`MOA_PASSWORD`·`MAKE_SMS_CODE_URL`·`OPS_CONSOLE_BASE_URL`·`CRON_SECRET`). 빠지면 시작 전에 실패로 보고한다. 새 env 는 dry-run 하나다(§4.10).
- `scrape.SELECTORS` 는 서비스조회 화면용이다(`ddlMOACategoryName`). 작업진행현황은 `ddlCategoryName` 이다. `_set_value` 는 없는 id 를 받으면 아무 일도 하지 않으므로, §4.4 의 직렬화 확인이 이런 실수를 잡는다.

### 4.3 실행 시각과 409

**수요일 09:30 에 실행한다.** 트리거는 `-Weekly -DaysOfWeek Wednesday -At 09:30am`, 설정은 `StartWhenAvailable`·`WakeToRun`·`-MultipleInstances IgnoreNew` 다. 실행 제한은 마감 대기 상한과 재시도 몫을 더한 것보다 길게 둔다(예: 45분).
- 마감 스크랩은 평일 09:00 트리거다. `RUN_INTERVAL_WEEKS = 1` 이어서 **격주 게이트가 있어도 지금은 수요일마다 돈다.** 그 작업의 실행 제한이 20분이라, 정시에 시작한 실행은 늦어도 09:20 에 끝나 있다.
- A4 한 번은 로그인·조회·인제스트가 각 1회라 10:00 전에 끝나는 일이다. 빌더 확인: 라이브 1회의 소요 시간.
- **마감 작업이 실행 중이면 기다린다.** `run-local.ps1` 은 시작할 때 `OPS-Console-Closing-Scrape` 의 State 가 `Running` 인지 보고, 그렇다면 끝날 때까지 기다린다. 폴링 간격과 상한은 빌더 판단이다(마감 작업 실행 제한 20분이 기준). PC 가 늦게 켜지면 밀린 두 작업이 함께 뜨는데, A4 가 리스를 먼저 잡으면 409 재시도가 없는 마감 쪽이 그날 실패로 끝나기 때문이다. 작업 이름을 못 찾으면 기다리지 않고 진행하되 로그에 남긴다.
- 리스는 로그인 구간(reset~pop)만 막는다. 그래서 마감 수동 요청(폴러)과는 같은 계정의 세션이 겹칠 수 있다. 드물고, 겹치면 어느 쪽이든 run-log 실패로 드러나므로 받아들인다.

**409(`LeaseHeldError`)는 기다렸다가 다시 한다. 최대 3회다.** 드라이버를 닫고 240초(리스 TTL 180초보다 길게) 뒤에 처음부터 다시 한다. 3회째도 409 면 `lease_busy` 실패로 보고하고, 문구에 점유자 이름을 넣는다.
- reset 단계의 409 는 **아직 아무것도 제출하지 않았다**는 뜻이다. 다시 해도 SMS 나 캡차 위험이 없다. 다른 잡의 로그인은 보통 수십 초 안에 리스를 반납한다. 첫 409 에서 바로 실패하면 흔한 겹침 하나 때문에 그 주 전체가 `구분 미확인` 이 되고 사람이 다시 돌려야 한다.
- pop 단계의 409(앞선 pop 응답 유실)도 같은 규칙을 따른다. 코드를 제출하지 않았으므로 새로 로그인하면 문자가 1통 더 갈 뿐이다.
- **409 가 아닌 로그인 실패는 다시 하지 않는다**(비밀번호, 캡차, SMS 타임아웃). 반복 실패는 계정 잠금으로 이어진다(`_wait_login_accepted` 원칙).
- 같은 이름끼리는 리스가 막지 못한다. A4 두 개가 겹치는 것은 `IgnoreNew` 가 막는다.

### 4.4 조회와 파싱

- `/Develop/WorkStatus` 를 연다(로그인 뒤 기다리는 시간은 빌더 판단). `#ddlManager`·`#ddlDeveloper`·`#ddlCategoryName`·`#txtUnivServiceID`·`#txtServiceType`·`#txtServiceName` 은 비우고, `#txtApplyFromTime`·`#txtApplyToTime` 에는 수집 범위(§4.8)를 넣는다. 형식은 `YYYY-MM-DD` 다(서비스조회의 `YYYY-MM-DD HH:MM` 과 다르다). 값을 넣은 뒤 input·change 이벤트를 발생시킨다.
- **보내기 전에 `$('#form0').serialize()` 를 읽어 확인한다.** `Manager=`·`Developer=`·`CategoryName=` 이 비었는지, 날짜가 맞는지 본다. 값 넣기가 조용히 실패하면 기본값(본인·수시)으로 15행만 오기 때문이다. 확인에 실패하면 `form_not_set` 으로 멈춘다.
- `execute_async_script` 로 위의 `$.ajax` 를 돌려 상태 코드와 본문을 받는다. 타임아웃은 빌더 판단이다(세션 4 에서 1.33MB 응답이 돌아왔다). 200 이 아니면 `fetch_failed` 다.
- `parse.py` 는 표에서 행마다 `(service_id, test_open)` 만 꺼낸다. **담당자 칸(2번째)은 읽지 않는다.**
- 구분 판정은 서버가 한다(§4.5). 규칙을 한 곳에만 두기 위해서다. python 은 칸 모양만 확인한다.

### 4.5 인제스트 — `POST /api/ops-weekly/dev-status`

- 인증은 `Authorization: Bearer ${CRON_SECRET}` 이다(마감 인제스트와 같은 검사). 서버에 값이 없으면 500, 틀리면 401 이다.
- 본문은 `features/ops-weekly/dev-status-schemas.ts` 의 zod 로 검증한다: `{ rows: [{ service_id, test_open }] }`.
  - `service_id`: 양의 정수
  - `test_open`: 정규식 `^(-|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$`
  - `rows`: `min(1)`·`max(5000)`. service_id 가 중복되면 400 이다.
- **한 번에 보낸다.** 학년도 범위의 1,463행이 약 80KB 다. 범위를 앞으로 넓혀도(§4.8) 수천 행 안이라 Vercel 본문 한도(4.5MB)에 한참 못 미친다. 한 요청이면 upsert 문도 하나라 스냅샷이 쪼개지지 않는다. 5,000행을 넘으면 400 이 나고, 그때 다시 설계한다.
- `dev-status.ts` 에 `stageFromTestOpen(raw)` 를 더한다(`-` 이면 `dev`, 일시면 `test`). 읽는 쪽 계약과 같은 파일에 둔다.
- 응답은 `{ ok: true, received, dev, test }` 다. python 은 **응답 JSON 의 `ok === true`** 를 확인한다. PUBLIC_PATHS 가 빠지면 307 → `/login` HTML 이 성공처럼 보일 수 있기 때문이다.
- 실행 기록은 `POST /api/ops-weekly/dev-status/run-log` 로 남긴다. 본문은 `{ status: "success" | "failed", message(≤1000) }` 이고, 라우트가 `recordAutomationRun("ops-weekly-dev-status", …)` 를 부른다. 데이터와 분리하는 이유는 마감과 같다. 로그인 실패처럼 데이터가 없을 때도 흔적이 남아야 한다. 실행 기록 표는 따로 만들지 않는다(`automation_runs` 로 충분하다).
- `src/proxy.ts` 의 PUBLIC_PATHS 에 `"/api/ops-weekly/dev-status"` 한 줄을 더한다. 접두사 매칭이라 `/run-log` 도 같이 열리는데, 의도한 것이다. 두 라우트 모두 CRON_SECRET 을 직접 검사한다. `/api/ops-weekly` 로 넓히지 않는다. `src/__tests__/proxy-cron-paths.test.ts` 의 `SESSIONLESS_ROUTES` 에도 같은 경로를 더한다.

### 4.6 쓰기 — service_id 기준 upsert, 지우지 않는다

**upsert(`onConflict: "service_id"`)를 쓴다. 전체 교체(지우고 다시 넣기)는 쓰지 않는다.**
- 신선도 판정(§4.7)이 오래된 행을 이미 `구분 미확인` 으로 걸러 낸다. 이번 결과에서 빠진 서비스의 지난 행이 남아 있어도 틀린 값으로 보이지 않는다.
- 교체는 한 트랜잭션으로 묶는 함수(마이그레이션)가 필요하고, 덜 읽은 결과가 다른 행을 지운다. upsert 는 **아무것도 지우지 않으므로 '0건이면 지우지 않는다' 가 구조적으로 성립한다.**
- 행은 해마다 1,500개쯤 늘어난다. 정리하지 않는다.
- 저장 칸:
  - `service_id`
  - `stage`: 서버가 판정한 값
  - `raw_label`: 테스트 오픈 칸의 원문(`-` 또는 `YYYY-MM-DD HH:MM:SS`). 왜 그 구분이 나왔는지 되짚는 근거다.
  - `collected_at`
- **`collected_at` 은 서버가 요청을 받은 시각이다.** 한 실행의 모든 행이 같은 값을 갖는다. PC 시계는 믿지 않는다. PC 시계가 빠르면 지난 값이 몇 주씩 '이번 주' 로 보이기 때문이다. Moa 조회 시각과는 수십 초 차이다.
- upsert 뒤에 `.select()` 로 행을 돌려받지 않는다. 건수는 입력에서 센다.
- supabase-js 는 실패해도 예외를 던지지 않는다. `error` 를 직접 보고 500 으로 응답한다.
- `ops_weekly_dev_status` 말고 다른 표는 쓰지 않는다. 서버에서 날짜를 문자열로 만들 일이 생기면 `kstFormat` 을 쓴다.

### 4.7 신선도 — 수요일 수집이 실패하면

A1 규칙을 바꾸지 않는다. `freshDevStages` 는 `collected_at ≥ 그 주 월요일 00:00 KST` 인 행만 쓴다. 그 결과는 이렇다.
- 수요일 수집이 실패하면 그 주의 시작 전 서비스는 **전부 `구분 미확인`** 이다. 지난주 값을 이번 주 사실처럼 보여 주지 않는다. Teams 실패 알림을 보고 같은 주 안에 다시 돌리면(§4.10), 최종 보고 전의 보고서는 제출했든 안 했든 다음에 열 때부터 바뀐다.
- 최종 보고 뒤에는 바뀌지 않는다. 그때 굳기 때문이다(§4.12). A4 의 수집은 `ops_weekly_reports` 를 건드리지 않는다.
- 월·화에 쓰는 보고서는 수요일 수집 전까지 `구분 미확인` 이다. 미리 제출해도 굳지 않으므로 수집 뒤에는 그 값으로 바뀐다.
- 구분을 읽는 것은 시작 전(`phaseOf === "upcoming"`) 서비스뿐이다. 이미 열린 서비스의 행도 저장되지만 화면에는 영향이 없다.

### 4.8 수집 범위 — 올 학년도 시작 ~ 오늘+6개월

오픈일 범위는 **올 학년도 시작 ~ 오늘(KST)+6개월**이다(사용자 2026-11-17). 늘 앞으로 넓게 보고, 2월 예외는 두지 않는다.
- **시작일**은 오늘 또는 그 전의 가장 가까운 3/1(KST)이다. `scrape.academic_year_range(now)["start"]["date"]` 를 그대로 쓴다(TS `features/closing/academic-year.ts` 와 같은 계산). 3월 이후면 그해 3/1, 1·2월이면 전년 3/1 이다. 3월 1일 00:00 KST 에 넘어가고, 수요일에만 돌기 때문에 실제로는 3월 첫 수요일부터 새 시작일을 쓴다.
- **종료일**은 `collect.py` 의 순수 함수가 KST 오늘에 6개월을 더해 만든다. 그 달에 없는 날이면 그 달 말일로 맞춘다.
- **왜 앞으로 넓게 보나**: 구분을 읽는 것은 시작 전 서비스다. 처음 결정(학년도 끝까지)으로는 2월에 3월 오픈 서비스가 범위 밖이었다. 늘 6개월 앞까지 보면 그런 계절 구멍이 없다.
- 6개월은 빌더가 바꿀 수 있다. 바꾸면 이유를 코드 주석과 PR 본문에 적는다. 기준은 둘이다: 개발이 오픈보다 얼마나 먼저 시작되는가, 범위가 가장 넓어지는 2월에도 행 수가 5,000 상한(§4.5) 안인가.
- 날짜 부분(`YYYY-MM-DD`)만 쓰고, 범위를 run-log 문구에 적는다.

### 4.9 가드 — 이상하면 아무것도 쓰지 않는다

`parse.py` 는 아래 실패 코드로 멈추고, 그러면 인제스트를 부르지 않는다. 일부만 쓰는 일은 없다. 칸 모양이 바뀐 채로 일부를 쓰면 구분이 조용히 뒤집힌다.

| 코드 | 조건 |
|---|---|
| `table_missing` | `table[summary="작업진행현황"]` 이 없다(세션이 만료돼 로그인 화면이 온 경우 등) |
| `header_changed` | 머리글이 `대학정보 · 담당자 · 접수기간 · 엑셀 업로드 · 개발 요청 · 개발완료 · 테스트 오픈 · 리얼배포` 와 다르다 |
| `empty` | 행이 0개이거나, '검색 결과가 존재하지 않습니다.' 한 칸짜리 행뿐이다 |
| `row_shape` | 칸 수가 8이 아니거나, `<span>` 이 7자리 숫자가 아니거나, 테스트 오픈이 `-`·일시가 아니다 |
| `duplicate_id` | 같은 서비스ID 가 두 번 나온다 |

서버 zod 가 경계에서 같은 것을 한 번 더 본다(빈 배열·형식·중복이면 400).

행 수 비율 가드(지난번의 절반 미만이면 실패)는 두지 않는다. 3월 1일에 시작일이 넘어가면 지난 학년도 행이 범위에서 빠져 행 수가 정상적으로 크게 줄고, 그때마다 오탐이 난다. upsert 라 덜 읽어도 지워지는 것이 없고, 건수는 run-log 에 남는다.

### 4.10 실패가 보이게

- **레지스트리** `ops-weekly-dev-status`
  - label `주간보고 개발 구분 수집`, scheduleInfo `매주 수요일 09:30 (회사 PC 로컬 예약 작업)`, cadence `weekly`
  - `localOnly: true`. 웹에서 실행하지 않고, run 은 안내 문구만 돌려준다(`ai-tips-collect` 와 같은 모양).
- **알림 경로**: run-log → `recordAutomationRun` → 실패 즉시 Teams(직전 실행도 실패면 보내지 않는다) + 11:00 일일 보고.
- **문구**(숫자는 예시)
  - 성공: `수집 1,463건 — 테스트 1,305 · 개발 158 · 범위 {시작}~{끝} (SMS: 우편함)`
  - 실패: `{코드}: {이유}` 뒤에 `재실행: Start-ScheduledTask -TaskName 'OPS-Console-Ops-Weekly-Dev-Status'` 를 붙인다. 알림만 보고 바로 다시 돌릴 수 있게 하기 위해서다.
  - SMS 소스가 문구에 남으므로 make 폴백이 일어나면 드러난다.
- **미실행**(PC 꺼짐)을 일일 보고가 잡으려면 이 잡의 자동화 설정 행이 켜져 있어야 한다. 설정 행이 꺼진 잡은 미실행이 아니라 `off` 로 넘어간다(`digest.ts:101`, `queries.ts:176`). `localOnly` 잡은 화면에 토글이 없으므로 배포 때 그 행을 직접 켠다(§7). 켜도 실행되는 것은 없다. cron route 와 수동 실행 액션이 `localOnly` 잡을 거부한다(`types.ts`). 켜 두면 weekly 임계 216h 라 9일 뒤 일일 보고에 `미실행` 으로 뜬다. 그동안 그 주는 `구분 미확인` 으로 정직하게 보인다.
- `ai-tips-collect` 를 따라 하는 방법은 쓸 수 없다. 그 잡도 `localOnly`·weekly 뿐이고 다른 장치가 없어 같은 구멍이 있다. 이 PR 에서는 고치지 않고 언급만 한다.
- **dry-run**: `OPS_WEEKLY_DEV_STATUS_DRY_RUN=true` 면 로그인·조회·파싱 후 건수만 출력하고, 인제스트와 run-log 는 보내지 않는다(마감의 `CLOSING_DRY_RUN` 과 같다). **dry-run 도 로그인이라 인증 문자가 가므로 사용자 승인이 필요하다.**

### 4.11 이름을 남기지 않는다

응답 HTML 에는 운영자·개발자 이름이 들어 있다.
- 저장하는 칸은 `service_id`·`stage`·`raw_label`(테스트 오픈 원문)·`collected_at` 뿐이다. 서버 정규식이 `raw_label` 에 다른 글자가 들어오는 것을 막는다.
- 응답을 파일로 쓰거나 출력하지 않는다. 로그인 뒤에는 `_dump_page` 를 부르지 않는다(페이지 소스를 통째로 저장하는 함수다).
- 실패 문구에 셀 내용을 싣지 않는다. 행 번호와 이유만 쓴다.
- 테스트 픽스처는 손으로 만든 합성 HTML 이다(`운영자A`·`테스트대학교`·`1000001` 같은 자리값). 정찰 응답 파일(`50-*`)은 레포에 넣지 않는다.

### 4.12 범위 추가 — 자동 항목은 [최종 보고] 때 굳는다

사용자 결정(2026-11-17)이다. A1 의 '제출하면 자동 항목을 스냅샷으로 굳힌다' 를 대체한다. 이것으로 월·화에 미리 낸 보고서가 `구분 미확인` 으로 굳는 문제가 없어진다. 수집과 섞이지 않게 A4 안에서 별도 태스크·커밋으로 한다.

- **자동 항목**은 `loadAutoSnapshot`(`features/ops-weekly/auto-queries.ts`)이 만드는 `AutoSnapshot` 전체다. 원서접수 네 묶음(개발/테스트 포함), PIMS, 휴가·외근(백업요청 링크), 안 붙음 건수가 들어간다. 한 덩어리로 옮긴다. 묶음마다 굳는 시점이 다르면 한 보고서 안의 카드끼리 기준 시각이 갈린다.
- **지금 굳는 곳**: 제출 server action 이 `loadAutoSnapshot` 을 불러 `ops_weekly_reports.snapshot` 에 쓴다. 빌더 확인: submit action 의 snapshot 호출 위치, 그리고 `snapshot` 을 읽는 곳 전부(`features/ops-weekly`·`app/dashboard/ops-weekly` 에서 grep).
- **읽는 규칙**: `snapshot` 이 있으면 그 값을 쓰고, 없으면 그때 계산한다. 제출 여부는 보지 않는다. 정정으로 주가 다시 열려도 `snapshot` 이 남아 있으므로 굳은 값이 보인다.
- **제출 때**: 손으로 쓴 것(영역 특이사항, 건별 메모·빼기, 직접 추가, 프로젝트)만 고정된다. 편집 권한은 A1 그대로다. `snapshot` 은 쓰지 않는다.
- **제출했지만 최종 보고 전인 보고서 화면**: 자동 항목은 작성 중 보고서와 똑같이 열 때마다 새로 계산한다. 자동 목록 위에 '자동 항목은 최종 보고 때 굳습니다' 한 줄을 둔다. 숫자가 바뀌는 것을 보고 고장으로 읽지 않게 하기 위해서다.
- **[최종 보고] 때**: 그 주 보고서 전원의 `AutoSnapshot` 을 먼저 만들어 쓰고, 그다음에 주를 `reported` 로 바꾸고 `week-reported` 를 낸다. A3 훅이 `listReports(weekId)` 로 스냅샷을 읽어 엑셀·워드를 만들기 때문에 이 순서가 중요하다. 하나라도 실패하면 보고하지 않고(이벤트 없음) 당번 화면에 실패를 보인다. 다시 누르면 처음부터 다시 굳힌다.
- **첫 최종 보고는 전원 것을 덮어 쓴다.** 배포 전에 A1 규칙으로 제출 때 굳은 스냅샷도 이때 새 값으로 바뀐다.
- **정정(관리자 재오픈) 뒤 다시 보고할 때는 굳은 값을 그대로 둔다.** 고쳐지는 것은 손으로 쓴 내용뿐이고, 자동 항목은 첫 최종 보고 때의 값이다. 비어 있는 스냅샷만 채운다. `correction: true` 로 구분한다.
- 전원(지금 17명 안팎)을 한 번에 만든다. 지금 `loadAutoSnapshot` 은 1명 단위라 마감 전체 조회를 사람마다 반복한다. 공통 조회(마감·PIMS·일정)를 한 번만 읽게 나눌지는 빌더 판단이다.
- **CLAUDE.md** ops-weekly 절의 '**제출하면 자동 항목을 스냅샷으로 굳힌다.** …' 문단을 바꾼다. 새 문단에는 셋을 적는다: 자동 항목은 당번의 [최종 보고] 때 전원 것을 한꺼번에 굳힌다, 제출 때 고정되는 것은 손으로 쓴 내용뿐이다, 정정 뒤 다시 보고해도 굳은 값은 그대로다. 이유도 함께 적는다(제출 때 굳히면 수요일 수집 전에 낸 보고서가 `구분 미확인` 으로 굳고, 같은 주 보고서끼리 기준 시각이 갈린다). 같은 절의 `ops_weekly_dev_status` 줄에는 A4 가 수요일 09:30 에 채운다는 것을 적는다.

## 5. 영향 파일

| 파일 | 변경 |
|---|---|
| `scripts/moa-dev-status/` (`collect.py`·`parse.py`·`test_*.py`·`run-local.ps1`·`register-task.ps1`) | 신규 |
| `.gitignore` | `scripts/moa-dev-status/run-local.log` 한 줄(경로별 줄 규칙) |
| `src/features/ops-weekly/dev-status.ts` | `stageFromTestOpen` 추가 |
| `src/features/ops-weekly/dev-status-schemas.ts` (+ test) | 신규. 인제스트·run-log zod |
| `src/app/api/ops-weekly/dev-status/route.ts` · `run-log/route.ts` (+ test) | 신규 |
| `src/features/sms-codes/schemas.ts` · `__tests__/schemas.test.ts` | 소비자 추가 |
| `src/features/ops-weekly/__tests__/dev-status-drift.test.ts` | 신규. python 소비자 상수 대조 |
| `src/features/automations/registry.ts` | 잡 1개 |
| `src/proxy.ts` | PUBLIC_PATHS 1줄 |
| `src/__tests__/proxy-cron-paths.test.ts` | `SESSIONLESS_ROUTES` 에 `/api/ops-weekly/dev-status` |
| (범위 추가) 제출 action · 최종 보고 action · 보고서 조회·화면 (+ test) | 굳는 시점 이동, 안내 한 줄. 경로는 빌더 확인 |
| `CLAUDE.md` | 우편함 소비자 다섯, 자동화 잡 표 1행, ops-weekly 절(굳는 시점 문단 교체 + A4 줄) |

마이그레이션은 없다(`snapshot` 칸은 이미 비울 수 있다).

## 6. 테스트

**Python**(브라우저 없이, 기존 `moa-*` 테스트처럼 파일 단위로 실행)
- `parse.py` 를 합성 HTML 로 시험한다:
  - 정상: 일시와 `-` 가 섞여 있고, 칸 안에 공백·줄바꿈이 있다
  - 실패: 표 없음, 머리글 변경, 결과 없음 행, 칸 수 이상, span 이 7자리가 아님, 테스트 오픈 이상값, 중복
- 담당자 칸의 이름이 반환값과 실패 문구 어디에도 없다(픽스처의 이름으로 단언한다).
- 직렬화 확인: Manager 나 CategoryName 이 남아 있으면 `form_not_set` 이다.
- 재시도:
  - 가짜 로그인이 `LeaseHeldError` 를 두 번 내고 성공하면, 3회째에 성공하고 240초 대기가 두 번 있다(가짜 sleep).
  - 세 번 모두 409 면 `lease_busy` 다.
  - 409 가 아닌 예외는 한 번으로 끝난다.
- `SMS_CONSUMER` 는 한 줄 상수이고 env 로 바뀌지 않는다.
- 수집 범위 함수: 2월 말과 3월 1일 경계(KST), UTC 로는 전날인 KST 자정 직후, 그 달에 없는 날(8/31 의 6개월 뒤는 2월 말일, 윤년 포함).

**TS**(vitest)
- `stageFromTestOpen`.
- 인제스트 라우트:
  - 401
  - 400: 잘못된 JSON, 빈 배열, 형식 오류, 중복, 5,001행
  - 200: stage 판정, `collected_at` = 서버 시각(가짜 타이머), `raw_label` = 원문, upsert 대상 표는 `ops_weekly_dev_status` 하나
  - supabase error 면 500
- run-log 라우트: success·failed 가 `recordAutomationRun("ops-weekly-dev-status", { ok, message })` 로 이어진다.
- 소비자 목록 다섯, 드리프트 테스트, `SESSIONLESS_ROUTES` 의 새 경로.
- (범위 추가) 굳는 시점:
  - 제출해도 `snapshot` 이 비어 있고, 그 뒤 `ops_weekly_dev_status` 가 바뀌면 제출한 보고서의 자동 항목도 바뀐다.
  - [최종 보고] 는 전원 스냅샷을 쓴 뒤에 `week-reported` 를 낸다(훅이 채워진 스냅샷을 본다).
  - 굳히기가 하나라도 실패하면 주가 `reported` 가 되지 않고 이벤트도 없다.
  - 최종 보고 뒤에는 원천이 바뀌어도 화면 값이 그대로다.
  - 첫 최종 보고는 제출 때 굳은 옛 스냅샷을 덮어 쓴다. 정정 뒤 재보고는 굳은 값을 두고, 손으로 쓴 것만 바뀐다.
  - 제출했지만 최종 보고 전인 보고서 화면에 안내 한 줄이 보인다(문구와 위치를 단언한다).
- 검증 범위는 소비처로 정한다. `SMS_CONSUMERS`·`dev-status`·`PUBLIC_PATHS`·`AUTOMATION_JOBS`·`snapshot`·`loadAutoSnapshot` 을 grep 해서 나온 테스트 디렉터리를 함께 돌린다.

**라이브**는 **사용자 승인 후 1회**다(Moa 로그인 = 인증 문자 1통). 절차는 §7.

## 7. 배포 순서

1. 머지하고 Vercel 배포 완료를 확인한다. 새 소비자 이름이 prod enum 에 있어야 한다. 없으면 400 → make 폴백이 일어난다.
2. 메인 트리에서 `git pull` 한다. 작업 스케줄러는 메인 워킹트리의 파일을 실행한다.
3. `register-task.ps1 -Unattended` 로 등록하고, `Get-ScheduledTask` 로 다음 실행 시각(수 09:30)을 확인한다.
4. 이 잡의 자동화 설정 행을 켠다. `localOnly` 라 화면에 토글이 없으므로 SQL 로 켠다. 빌더 확인: `queries.ts:176` 이 읽는 표·칸 이름으로 SQL 을 체크리스트에 적는다. 안 켜면 일일 보고가 미실행을 `off` 로 넘긴다.
5. **승인을 받고** `Start-ScheduledTask` 를 1회 실행한 뒤 다음을 확인한다.
   - `run-local.log` 끝부분
   - `automation_runs` 의 `ops-weekly-dev-status` 성공 행, 문구의 건수와 `(SMS: 우편함)`
   - `ops_weekly_dev_status` 의 건수와 `collected_at`
   - 주간보고 화면에서 본인의 시작 전 서비스가 `개발 중`·`테스트 중` 으로 나뉘는지
6. 다음 수요일 09:30 실행 기록을 확인한다. 등록해 둔 것과 실제로 도는 것은 다르다.
7. (범위 추가) 그 주 첫 [최종 보고] 뒤 보고서 전원의 `snapshot` 이 채워졌는지 확인한다.

## 8. 빌더에게 맡기는 것 · 빌더 확인

**맡기는 것**
- 로그인 뒤 `/Develop/WorkStatus` 를 열고 기다리는 시간(세션 4 는 약 4초)
- `execute_async_script` 타임아웃(세션 4 에서 1.33MB 응답이 돌아왔다)
- 마감 작업 실행 중 대기의 PowerShell 폴링 간격·상한, 그에 맞춘 작업 실행 제한
- 종료일 +6개월 조정(바꾸면 이유를 적는다, §4.8)
- 최종 보고 때 공통 조회를 한 번만 읽게 나눌지(§4.12)
- 함수 나누기, 실패 문구, ps1 세부(로그 경로·인코딩은 마감 래퍼 그대로), 레지스트리 description 문장

**빌더 확인**
- 자동화 설정 행의 표·칸 이름(`queries.ts:176`). §7 의 SQL 에 쓴다.
- submit action 의 snapshot 호출 위치와 `snapshot` 을 읽는 곳 전부(§4.12).
- `schemas.test.ts` 말고 소비자 목록을 단언하는 곳이 있는지(grep `SMS_CONSUMERS`·`"settlement-discover"`).
- 최종 보고 액션의 소요 시간(전원 스냅샷을 한 번에 만든다).
- 제출과 최종 보고 사이에 자동 항목이 사라질 때(담당 변경 등) 거기 단 건별 메모·빼기를 A1 이 어떻게 다루는지(§11).

## 9. 범위 밖

- 화면 변경: '이번 주 수집 안 됨' 배너(굳는 시점 안내 한 줄은 범위 안이다)
- 웹 재실행 버튼(요청 큐·폴러). 후속 PR 이다(사용자 2026-11-17).
- 2차수, 다른 진행 열, 리얼배포 기준 판정
- 오래된 행 정리
- `ai-tips-collect` 의 같은 일일 보고 구멍(§4.10)

## 10. 사용자에게 물을 것

없다. 앞서 물었던 셋은 사용자가 2026-11-17 에 정리했다. 조기 제출은 굳는 시점 이동(§4.12)으로, 2월 범위는 앞으로 넓은 범위(§4.8)로, 웹 재실행은 후속 PR 로 정했다.

## 11. 리스크

- 같은 계정의 세션 겹침(§4.3). 리스는 로그인 구간만 막는다.
- Moa 화면이 바뀌면 §4.9 가드가 실패로 멈춘다. 그 주는 `구분 미확인` 이 되고 Teams 알림이 온다.
- 판정은 테스트 오픈 칸만 본다(사용자 확정). 테스트 없이 리얼배포한 서비스는 `개발 중` 으로 나온다.
- prod 배포 전에 새 소비자 이름으로 돌리면 make 로 폴백해 크레딧을 쓴다. §7 순서를 지킨다.
- CRON_SECRET 이 유출되면 구분을 위조할 수 있다. 표시 전용 값이라 마감 인제스트와 같은 수준이다.
- (범위 추가) 최종 보고가 늦어지면 그때까지 자동 항목이 움직인다. 의도다 — 기준 시각은 최종 보고 시각이다.
- (범위 추가) 굳히기가 실패하면 보고가 막힌다. 반쯤 보고된 주를 만들지 않으려는 의도다.
- (범위 추가) 배포 시점에 진행 중인 주에서 이미 제출된 보고서는 최종 보고 전까지 제출 때 굳은 옛 값을 보인다(읽는 규칙이 `snapshot` 우선이라서). 첫 최종 보고가 덮어 쓴다. A1 이 막 머지돼 실제 제출이 거의 없을 때라 정리 SQL 은 두지 않는다.
- (범위 추가) 제출과 최종 보고 사이에 자동 항목이 사라지면(담당 변경 등) 거기 단 건별 메모·빼기가 화면에서 함께 사라질 수 있다. 빌더 확인(§8).
