---
share: true
status: 확정
updated: 2026-08-22
revision: 3 (경쟁률 선택 + 구분선 축소)
---

# 오픈안내 — 개발·테스트 세 번째 탭에서 대학에 오픈 안내 메일

**질문**: 준비중 서비스의 원서접수 페이지가 열렸다는 사실을, 대학 담당자에게 어떻게 사고 없이 알리는가.
**날짜**: 2026-08-22

---

## 1. 왜

원서접수 페이지가 오픈되면 운영자가 대학 담당자에게 안내 메일을 보낸다. 지금은 그때마다 손으로 쓴다. 매번 들어가는 값이 정해져 있는데도 그렇다 — 대학명·모집구분·접수기간·접수주소·경쟁률 공개 주소·접수관리자 주소.

그중 **URL 두 개는 서비스ID 7자리가 박힌 조립 주소**다. 손으로 옮기면 틀린다. 틀린 링크는 대학 담당자가 404를 보는 것으로 끝나지 않고, 접수 기간 중 경쟁률을 못 보는 상태로 이어진다.

자료요청(`/dashboard/data-requests`)이 같은 문제를 이미 풀었다 — 초안을 서버가 만들고 운영자가 검토·편집해서 보낸다. 오픈안내는 그 구조를 그대로 가져오되, **대상 목록이 다르다**. 자료요청은 본인 담당 `services` 전체이고, 오픈안내는 **아직 접수가 시작되지 않은**(`upcoming`) 건이다. 그 목록은 개발·테스트 메뉴가 이미 그리고 있다.

그래서 새 메뉴가 아니라 **개발·테스트의 세 번째 탭**이다.

---

## 2. 무엇을 만드나

`/dashboard/dev-test?tab=open-notice` — 오픈 예정 + 접수 중 서비스 목록. 행을 클릭하면 인스펙터에서 수신자를 고르고 초안을 확인한 뒤 **자동 발송 토글을 켠다.** 오픈 시각이 되면 알아서 나간다. 발송 이력이 남고 목록에 배지가 뜬다.

> **개정 2** — 초안에서는 '지금 발송 / 예약 발송' 두 모드였다. **예약 시각을 사람이 입력하게 한 것이 실수였다** — 오픈 시각은 `write_start_at` 에 이미 있는데 다시 타이핑하게 만들었고, 같은 값이 두 벌이 되면 어긋난다. 토글로 바꾸면서 시각 입력과 '지금 발송'을 걷어냈다. 그에 딸려 목록 범위와 실패 노출도 바뀌었다(§4). 배관(dispatch·마이그레이션·HTML 변환기·초안 생성기·권한 판정)은 그대로다.

### 확정된 메일 초안

제목:

```
[진학어플라이] {대학명} {서비스명} 인터넷 원서접수 오픈 안내
```

본문:

```
안녕하세요.
진학어플라이 {운영자이름}입니다.

{대학명} {서비스명} 인터넷 원서접수 페이지가
아래와 같이 오픈되었음을 안내드립니다.

■ 오픈 정보
────────────────────────────────
· 대학명   : {대학명}
· 모집구분 : {서비스명}
· 접수기간 : {접수기간}
· 접수주소 : {접수주소URL}

■ 접수기간 중 운영 안내
────────────────────────────────
· 접수관리자  : https://nadmin.jinhakapply.com/Login.aspx
   └ 접수현황·경쟁률 실시간 조회
· 경쟁률 공개 : {경쟁률URL}
   └ 지원자 경쟁률 실시간 조회
· 지원자 문의 : 진학어플라이 고객센터 1544-7715
   └ 평일 09:00~18:00 (마감일 ~22:00 연장 운영)

문의사항은 아래 연락처로 연락 주시기 바랍니다.
감사합니다.
```

서명은 `buildHtmlSignature`가 자동으로 붙는다 — "아래 연락처"가 그것을 가리킨다.

### 값을 채우는 규칙

| 칸 | 출처 |
|---|---|
| 대학명 | `closing_services.university_name` |
| 모집구분 | `closing_services.service_name` — **가공하지 않는다** |
| 접수기간 | `write_start_at ~ write_end_at` (결제기간 `pay_*` 아님) |
| 접수주소 | `admission_type === "공통원서"` → `apply.jinhakapply.com`, 그 외 → `enter.jinhakapply.com` + `/Notice/{serviceId}/A` |
| 경쟁률 | `https://addon.jinhakapply.com/RatioV1/RatioH/Ratio{serviceId}1.html` (차수 1 고정) — **개정 3: 기본 제외, 체크박스로 켠다** |

**모집구분에 파생 로직을 넣지 않는 근거**: DB 실조회로 확인했다. `service_id=1130058` → `service_name = "2027학년도 수시모집"`. 이미 완성된 문장이다. `category`는 `"수시"`뿐이고 `admission_type`은 `반응형원서/공통원서/일반접수` 세 값 — 둘 다 모집구분이 아니다. 학년도를 접수일에서 역산하는 규칙(3월 이후면 +1년)을 넣으려 했으나 불필요하고, 틀릴 여지만 만든다.

**접수주소 호스트 분기 근거**: `features/entertest/target-url.ts:11-20`이 테스트 시스템에서 완전히 같은 분기를 한다(공통원서→nstest, 그 외→entertest). 그 주석이 *"분류가 비어 있으면 다수(반응형원서) 쪽으로 둔다"*고 명시하므로, `null`·미지의 신규값도 `enter`로 보낸다. **`target-url.ts`와 합치지 않는다** — 테스트 호스트 변경이 프로덕션 메일을 깨서는 안 된다.

---

## 3. 조사로 뒤집힌 전제

### 3.1 `closing_services`는 덮어쓰지 않는다

설계 초안에서 "매일 스크래핑이 delete-all + insert로 덮어쓴다"를 전제로 삼았다. **코드는 그렇지 않다.**

`app/api/closing/ingest/route.ts:76`

```ts
.upsert(insertRows, { onConflict: "service_id", ignoreDuplicates: true })
```

같은 파일 9행 주석: *"신규만 누적 — service_id(멱등 키) 충돌은 무시하고 기존에 없던 건만 insert. 한 번 적재된 마감 건은 이후 검색 결과에서 빠져도 유지(이력 누적)."*

혼동의 출처는 **문서 3곳이 코드와 어긋나 있는 것**이다 — `CLAUDE.md`("Moa 스크래핑, 매일 덮어씀"), `supabase/migrations/20260607c_closing_services_table.sql:2`("delete-all + insert"), `features/entertest/target-url.ts:6`. 구현이 나중에 바뀌었고 문서가 안 따라왔다. **별도 건으로 분리한다 — 이번 PR 범위가 아니다.**

결론(`service_id`를 정수로, FK 없이)은 유지하되 **근거를 교체한다**:

1. **선례가 있다** — `20260628_entertest_runs_service_id.sql:3`이 `entertest_test_runs.service_id bigint`를 FK 없이 추가했다. `closing_services`에 매달리는 이력 테이블의 확립된 패턴이다. 타입도 `bigint`로 맞춘다
2. `closing_services`는 Moa의 스크랩 미러지 원장이 아니다. FK를 걸면 메일 이력의 무결성이 스크래퍼 가용성에 묶인다
3. `ListRow.serviceIdNum?: number`가 이미 있다(`ListPattern.tsx:237`) — 정수 경로가 뚫려 있다

### 3.2 확정 초안이 HTML에서 무너진다

`lib/mail-signature.ts:27-28,70`의 `buildReplyHtml`은 `htmlEscape` 후 `\n`→`<br>`만 하고 `<div>`로 감싼다. **HTML은 연속 공백을 1칸으로 접는다.** 그 결과 확정 초안에서:

- `· 대학명   :` 과 `· 모집구분 :` 의 **콜론 열 정렬이 붕괴**한다
- `   └ 접수현황·경쟁률` 의 **선두 들여쓰기 3칸이 사라진다**

에디터에서는 완벽해 보이고 받은 편지함에서만 깨진다. `mail-signature.ts:52`가 회사명 뒤에 `&nbsp;&nbsp;`를 쓰는 것이 같은 문제를 이미 겪은 흔적이다.

→ **공백 보존 변환기 `open-notices/mail-html.ts`를 따로 만든다.** `white-space: pre-wrap`은 쓰지 않는다 — Outlook의 Word 렌더링 엔진이 무시하고, 대학 담당자 수신 환경이 Outlook 중심이다.

### 3.3 목록 정렬이 워크플로를 뒤집는다

`features/entertest/queries.ts:52`의 `listTestableServices()`는 `write_end_at` **내림차순**으로 준다. 마감 임박 순이 필요한 테스트 탭에는 맞지만, 오픈안내 대상은 전부 `upcoming`이라 그 순서면 **가장 늦게 열리는 건이 1페이지**에 오고 다음 주에 여는 건이 뒷장에 묻힌다.

→ `write_start_at` 오름차순(null 뒤)으로 다시 정렬한다. 원본 쿼리는 건드리지 않는다.

### 3.4 실데이터에 연도 오류가 9건 있다

`write_start_at`이 미래인 276건을 조회했다. 그중 1건(강릉영동대)은 `phaseOf`가 `closed`로 빼므로 **실제 목록은 275건**이다. `closing_services` 전체 867건의 phase 분포는 `closed 572 / running 20 / upcoming 275`.

- 시작 시각: 09:00(188) / 10:00(33) / 00:00(28) / 12:00(23) — **시각 성분은 진짜다**
- 종료 시각: 18:00(96) / 23:59(89) / 17:00(35)
- `write_start_at` null: **0건**
- **시작·종료 연도가 다른 건: 9건**

| 서비스 | 작성 기간 | 목록 |
|---|---|---|
| 건국대·경상국립대·대구가톨릭대·국립부경대·서울여대·세명대·국립순천대 (7건) | `2026.09.07(월) 09:00 ~ **2027**.09.11(토) 17:00` | **들어온다** |
| 진학대학교 결제사 테스트(KCP) | `2026.10.01 ~ 2027.05.31` (테스트 더미) | 들어온다 |
| 강릉영동대 수시1차 | `2026.09.07(월) 09:00 ~ **2025**.09.30(화) 23:59` | 제외 (`pay_end_at` 과거 → closed) |

강릉영동대 건은 `features/closing/phase.ts:25-27` 주석이 이미 *"원본 스크래핑의 연도 오류로 보인다"*고 지목한 그 건이고, `phaseOf`가 마감을 먼저 보는 덕에 목록에서 빠진다. **하지만 위 7건은 그 방어를 통과해 목록에 들어온다** — `pay_end_at`은 정상이고 `write_end_at`만 1년 뒤이기 때문이다. 초안 포맷이 마지막 방어선이 되는 이유가 이것이다.

→ **종료 연도는 시작과 같은 해일 때만 생략한다.** 항상 생략하면 건국대 초안이 `2026.09.07(월) 09:00 ~ 09.11(토) 17:00`으로 완벽해 보이고, 운영자가 1년 틀린 접수기간을 대학에 그대로 보낸다. 연도를 찍으면 `~ 2027.09.11`이 눈에 걸린다. **포맷 규칙이 데이터 오류를 드러내는 쪽으로 선다.**

---

## 4. 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 발송 이력 | `open_notice_sends` 테이블 신설 | 발송완료 배지 + 중복 발송 판정 |
| 발송 방식 | **자동 발송 토글 하나** | 오픈 시각은 `write_start_at` 에 이미 있다. 사람이 다시 입력하면 같은 값이 두 벌이 되고 어긋나면 엉뚱한 시각에 나간다. 토글 ON = `scheduled_at = write_start_at` 인 예약 행 생성, OFF = 대기 행 삭제(나간 이력은 남긴다) |
| 지금 발송 | **없앤다** | 목록이 오픈 전 건이라 '오픈 전에 오픈됐다고 보내기'가 되어 메일 문구("오픈되었음을 안내")와 모순된다 |
| 수신자·본문 확정 시점 | 토글 켤 때 | 자동으로 보내려면 누구에게 무엇을 보낼지 미리 정해져 있어야 한다. 고치려면 껐다 켠다 |
| dispatch | **신규 라우트** `/api/open-notices/dispatch` | 선례 2개(data-requests·backup-requests)와 같은 모양. 기존 라우트 일반화는 claim RPC가 `returns setof public.data_request_sends`로 테이블에 묶여 있어 동적 SQL 표면을 만들고, 살아 있는 프로덕션 메일 경로의 blast radius를 키운다 |
| `service_id` 타입 | `bigint`, FK 없음 | §3.1 |
| 공용 모듈 추출 | `deriveStatusByService` · `parseScheduledAtKst`를 `features/mail-sends/`로 **이동** | 27줄이지만 "예약 우선, 발송 차선" 우선순위 규칙을 담고 있어 두 벌이 되면 배지가 조용히 갈린다. 기존 테스트 6개가 무변경을 증명한다. `+09:00` 오프셋은 한 벌만 존재해야 한다 — `lib/kst-format.ts:6-9`가 같은 교훈을 명문화했다: *"기억해야 지켜지는 규칙은 언젠가 안 지켜진다"*. **재export shim은 만들지 않는다** |
| 수신자 조회 | `getRecipientsForUniversities` **재사용** | `contacts` 기반 순수 조회라 도메인 중립. 얇은 재export는 shim |
| searchParams | 세 탭 **공유**, 신규 코드 0줄 | `DevTestTabs.tsx:20-23`의 href가 파라미터를 전부 버려서 탭 전환 시 리셋된다. 컨트롤들은 기존 값을 보존하며 자기 키만 갱신하므로 `tab`이 자동으로 살아남는다. **이 href 동작을 "개선"하지 말 것 — 그게 리셋 장치다** |
| 발송 권한 | **본인 담당 건만**, admin은 전체 | 탭이라 `requireMenu("dev-test")` 하나가 세 탭을 다 가드한다. 자료요청은 자기 슬러그로 따로 게이트돼 있었다. 그대로 두면 개발·테스트 권한자 전원이 남의 담당 대학에 메일을 보낼 수 있다 |
| 본문 URL 자동 링크 | 포함 | 안내 메일의 본체가 URL 3개다 |
| 중복 발송 경고 | 포함 | 오픈안내는 1회성이라 중복이 바로 드러난다 |
| Realtime 토스트 | **제외** | 범위 축소 |
| 목록 범위 | **오픈 예정 + 접수 중** (`phaseOf !== "closed"`) | 개정 2에서 넓혔다. 오픈 예정만 담으면 **토글을 못 켠 채 오픈 시각이 지난 건이 목록에서 사라져 영영 안내를 못 보낸다.** CLAUDE.md 생애주기 원칙(겹침 금지)과 부딪히지만, 지난 행은 비활성이라 '처리 대상'이 아니라 '누락 표시'로 남는다. 결제까지 끝난 건은 이제 와서 안내할 이유가 없어 뺀다 |
| 실패 노출 | 목록 '발송실패' 배지 + 인스펙터 문구 | 자동이라 아무도 안 보고 있다. dispatch 결과는 `automation_runs` 에 안 남아 일일 보고에도 안 잡힌다(자료요청도 같은 사각지대). Teams 알림까지는 이번 범위 밖 |
| 지난 행 비활성화 | 자료요청과 동일하게 넣는다 | 아래 |

### 발송 권한을 판정하는 방법

목록은 전건 보이고 **발송만 막는다**. `closing_services.operator_name === me.operator?.name`, `me.permission === "admin"`이면 통과. 화면(`View.tsx`)에서 제출 버튼을 막고, **서버 action에서 같은 판정을 다시 한다.**

`me.displayName`이 아니라 **`me.operator?.name`을 쓴다.** `auth/queries.ts:56`이 `displayName: operator?.name ?? user.email.split("@")[0]` 이라, operators 매칭에 실패한 계정은 표시명이 이메일 아이디로 떨어진다. 그 값으로 대조하면 우연히 통과할 일은 없지만 의도가 흐려진다. `operator`가 null이면 담당 건 0으로 두고 admin bypass가 받는다.

**이름 문자열 대조의 위험은 실측으로 해소했다** — upcoming 275건의 `operator_name` 17종이 `operators.name` 21건에 **전부 존재**하고, null 운영자명은 **0건**이다. 동명이인·표기 차이로 본인 건이 막히는 경우가 현재 데이터에 없다. `closing_services`에는 이메일 컬럼이 없어 이름 대조 외의 수단이 없고, 경쟁률 점검 발송이 이미 같은 방식을 쓴다(CLAUDE.md: *"이름→메일은 `operators.name` 대조"*).

서버는 폼이 보낸 값을 믿지 않고 `service_id`로 `closing_services`를 다시 읽어 `operator_name`을 확인한다 — `features/entertest/queries.ts`의 `findServiceAdmissionType`이 이미 같은 이유로 존재한다(*"화면이 보낸 값을 믿지 않고 DB에서 다시 읽는다"*). 그 함수를 넓히지 말고 `open-notices/queries.ts`에 판정 전용 조회를 따로 둔다.

### 지난 행 비활성화

`data-request/Table.tsx:37-43,91-103`의 `isWriteStartPast` 패턴을 그대로 쓴다 — 작성시작이 지난 행은 `onClick` 제거 + `aria-disabled` + `opacity-60 cursor-not-allowed`.

**오늘 데이터로는 한 줄도 회색이 되지 않는다.** 목록이 `upcoming` 전용이라 정의상 작성시작이 미래이기 때문이다. 그럼에도 넣는 이유는 안전망이다:

- 페이지를 열어둔 채 접수 시작 시각을 넘기는 경우 (이 페이지는 `autoRefresh`지만 클릭과 렌더 사이에 틈이 있다)
- 위 §3.4의 연도 오류 7건처럼 날짜가 비정상인 건
- 나중에 목록 범위가 넓어질 때 자동으로 작동

planner는 "upcoming 전용이라 과거 행이 없으니 빼라"고 했으나, 채택하지 않는다. 비활성화는 **없어도 되는 코드가 아니라 값싼 방어**다.

> **개정 2** — 목록에 접수 중인 건까지 담으면서 이 가드가 **실제로 동작하는 장치**가 됐다. 토글을 못 켠 채 오픈된 건이 여기 걸린다. 인스펙터에서도 같은 판정으로 막는다. 단 그 판정은 **서버가 한다** — 렌더 중 `Date.now()` 는 리렌더마다 값이 흔들리고 React 컴파일러 규칙도 막는다.

### 중복 발송 경고가 작동하는 방식

`openNoticeStatus === "sent"`인 행에서 제출하면, 버튼이 바로 발송하지 않고 **한 번 더 눌러야 하는 확인 상태**로 바뀐다(마지막 발송 시각을 함께 보여준다). `window.confirm`은 쓰지 않는다 — 브라우저 모달은 이 하네스에서 다루기 어렵고, 인스펙터 안에서 해결되는 편이 일관된다. 서버는 막지 않는다: 재발송이 정당한 경우(수신자 오기입 후 재발송)가 있다.

---

## 5. 영향 파일

### 신규 (26)

| 파일 | 역할 |
|---|---|
| `features/mail-sends/status.ts` | 발송상태 파생(예약>발송) + `lastFailedAt`. 키는 `String()` 정규화 |
| `features/mail-sends/schedule-time.ts` | `parseScheduledAtKst` — KST 오프셋 단일 정의 |
| `features/mail-sends/__tests__/status.test.ts` | 6케이스 (data-requests에서 이관) + number 키 1케이스 |
| `features/mail-sends/__tests__/schedule-time.test.ts` | 오프셋 파싱 (이관) |
| `features/open-notices/mail-template.ts` | 초안 + `formatApplyPeriod`/`applyNoticeUrl`/`ratioUrl` |
| `features/open-notices/__tests__/mail-template.test.ts` | 초안·기간·URL |
| `features/open-notices/mail-html.ts` | **공백 보존** 평문→HTML + URL 링크 + 서명 결합 |
| `features/open-notices/__tests__/mail-html.test.ts` | 정렬 붕괴 방지 + 링크 |
| `features/open-notices/schemas.ts` | zod 입력 (`serviceId: number` 필수) |
| `features/open-notices/__tests__/schemas.test.ts` | 타입·mode·필수값 |
| `features/open-notices/actions.ts` | `sendOpenNoticeAction` |
| `features/open-notices/__tests__/actions.test.ts` | 토글 on/off · 시각 출처 · **권한 거부** |
| `features/open-notices/queries.ts` | 정렬 + 상태 조회 |
| `features/open-notices/__tests__/queries.test.ts` | `sortForOpenNotice` |
| `supabase/migrations/20260822_open_notice_sends_table.sql` | 테이블 + RLS + GRANT + status check |
| `supabase/migrations/20260822b_claim_due_open_notices_fn.sql` | `claim_due_open_notices()` |
| `.../list-variants/open-notice/View.tsx` | 인스펙터 발송 폼 |
| `.../list-variants/open-notice/Table.tsx` | 목록 + 상태 배지 |
| `.../list-variants/open-notice/filters.ts` | `OPEN_NOTICE_FILTERS = []` |
| `.../list-variants/open-notice/__tests__/Table.test.tsx` | 배지 렌더 + 지난 행 비활성화 |
| `.../list-variants/open-notice/__tests__/View.test.tsx` | 권한 가드 + 중복 경고 |
| `app/dashboard/dev-test/OpenNoticeSection.tsx` | 탭 섹션 (서버 컴포넌트) |
| `app/api/open-notices/dispatch/route.ts` | 자동 발송 cron 진입점 |
| `app/api/open-notices/dispatch/__tests__/route.test.ts` | 401/발송/dry_run/updateFailed |

추가로 `scripts/open-notices-dispatch.mjs`, `.github/workflows/open-notices-dispatch.yml`.

### 수정·삭제 (14)

| 파일 | 변경 |
|---|---|
| `features/data-requests/queries.ts` | `deriveStatusByService` 정의 삭제 → import |
| `features/data-requests/actions.ts` | `parseScheduledAtKst` import 경로 |
| `features/data-requests/__tests__/queries.test.ts` | import 경로 |
| `features/data-requests/schedule-time.ts` (+테스트) | **삭제** |
| `.../list-variants/types.ts` | `Variant` union에 `"open-notice"` |
| `.../list-variants/registry.ts` | import + 등록 블록 |
| `.../patterns/ListPattern.tsx` | `openNotice*` 필드 6개 |
| `app/dashboard/dev-test/page.tsx` | **3갈래 분기** + 데이터 조립 |
| `app/dashboard/dev-test/DevTestTabs.tsx` | TABS 3개 |
| `proxy.ts` + `proxy.test.ts` | PUBLIC_PATHS 1줄 + 회귀 |
| `features/agent-org/registry.ts` | dispatcher 블록 |
| `CLAUDE.md` | variant 31→32 (2곳) + 오픈안내 절 |

**합계 40파일** (신규 26 · 수정 12 · 삭제 2). HARD-GATE 전체 설계 등급 — `git worktree` 격리 권장.

---

## 6. 태스크 (커밋 9개)

의존 순서:

```
T1 (공용화) ─────────────────┐
                             ↓
T2 (초안) ─→ T3 (HTML) ─→ T5 (action) ─┐
                    │                   │
T4 (DB) ────────────┴───────────────────┤
                                        ↓
T1 ─→ T6 (쿼리) ─→ T7 (variant) ─→ T8 (탭) ─→ T9 (dispatch+문서)
```

병렬 가능: **T1 / T2 / T4 / T7-1**. 직렬 필수: **T3 → T5 → T9** (HTML 변환기가 즉시·예약 두 경로에 같이 들어가야 결과가 갈리지 않는다). **T4는 T5 구현 전에 실적용**되어 있어야 한다.

| # | 커밋 | 내용 | GREEN 판정 |
|---|---|---|---|
| T1 | `refactor(mail): 발송 상태·예약 시각 파서를 공용 모듈로` | `mail-sends/` 신설, data-requests에서 이동 | data-requests 기존 테스트가 **한 줄도 안 바뀐 채로** 통과 |
| T2 | `feat(open-notice): 오픈안내 메일 초안 생성` | `formatApplyPeriod`·URL 2종·`buildDefaultOpenNoticeText` | 같은 해/연도교차/null/UTC경계 + URL 분기 |
| T3 | `feat(open-notice): 평문 본문의 공백을 보존해 발송` | `mail-html.ts` — `&nbsp;` 변환 + URL 링크 | 들여쓰기 3칸 보존, 2칸 이상 런 보존, 1칸은 space 유지 |
| T4 | `feat(open-notice): 발송 이력 테이블 + claim RPC` | 마이그 2개 | `\d`로 제약 확인 + 남의 행 안 보이는지 실조회 |
| T5 | `feat(open-notice): 발송 server action` | schemas + actions | 권한거부 포함 (개정 2에서 토글 계약으로 교체) |
| T6 | `feat(open-notice): 목록·상태 조회` | `sortForOpenNotice` + 상태 조회 | `write_start_at` 오름차순, null 뒤 |
| T7 | `feat(open-notice): 인스펙터 variant 추가` | types/registry/ListRow/View/Table | `typecheck` 통과 + View 권한·중복경고 테스트 |
| T8 | `feat(open-notice): dev-test 오픈안내 탭` | Tabs + Section + page 3갈래 | 세 탭이 각자 섹션 렌더 |
| T9 | `feat(open-notice): 예약 발송 dispatch` | route/script/workflow/proxy/agent-org/CLAUDE.md | 잘못된 시크릿 POST → **401** (307이면 PUBLIC_PATHS 누락) |
| T10 | `feat(open-notice): 예약 발송을 자동 발송 토글로 바꾼다` | schemas/actions/View/Table/Section/queries/CLAUDE.md | 시각을 폼이 아니라 DB 에서 읽는다 · 지난 건 비활성 · 실패 배지 |

### 태스크별 못박을 것

- **T2** — `kstFormat({weekday:"short"})` + `formatToParts` 조합. `Intl.DateTimeFormat("ko-KR", …)` 직접 호출 금지(프로젝트 규칙, 12시간제로 샌다)
- **T3** — `buildOpenNoticeHtml`은 dispatch(T9)가 쓴다. 개정 2 이후 즉시 발송 경로가 없어져 실제 사용처는 하나지만, action 쪽도 같은 변환기를 참조해 두 경로가 갈리지 않게 한다
- **T5** — `createAdminClient()`로 insert (RLS에 INSERT 정책이 없어 `createClient()`면 조용히 실패). `revalidatePath("/dashboard/dev-test")` — data-requests 경로를 복사하면 배지가 영영 갱신 안 된다
- **T7** — hidden input은 `row.serviceIdNum`. `isWriteStartPast` 비활성화를 **넣는다**(planner 의견과 반대 — §4 참조). 버튼 호버는 `hover:bg-ink hover:text-cream`(표준). data-request View는 `hover:bg-line-soft`를 쓰지만 **기존 것은 고치지 않는다**(surgical). `formatMonthDay`도 복사하지 말고 `kstFormat` 사용. 비활성화 테스트는 **행을 손으로 만들어** 검증한다 — 실데이터로는 재현되지 않는다
- **T8** — `OpenNoticeSection`은 `services`를 **props로 받는다**. 내부에서 `listTestableServices()`를 다시 부르면 3중 호출이 된다(현재 page + DevControlSection 2중)
- **T9** — yml에 `cron:` 넣지 않는다(cron-job.org와 중복 발송)

---

## 7. 리스크

| # | 리스크 | 처리 |
|---|---|---|
| R1 | HTML 공백 접힘으로 초안 정렬 붕괴 | **T3이 막는다.** §3.2 |
| R2 | 수신자 조회를 275건 전체에 돌림 | `listTestableServices()`에 페이지네이션 인자가 없다. **30건 슬라이스 후** 조회 |
| R3 | 정렬 역전 | **T6이 막는다.** §3.3 |
| R4 | 연도 오류 9건이 그대로 발송 | **포맷 규칙이 드러낸다.** §3.4 |
| R5 | 헤더 건수가 항상 test 탭 기준 | `page.tsx:116`의 `total`이 탭과 무관 — **기존 버그, 물려받는다.** 고치지 않고 PR 본문에 기존 동작임을 명시 |
| R6 | 예약 행이 `sending`에 갇힘 | claim 후 update 전에 죽으면 다음 claim이 못 잡는다(수동 복구). **자료요청의 기존 설계 결함을 그대로 상속.** 다만 **실측상 한 번도 안 터졌다** — `data_request_sends` 26건(sent 23·dry_run 1·scheduled 2), `backup_request_mail_sends` 14건 전부 sent, 갇힌 행 0건. `updateFailed`로 관찰만 하고 복구 자동화는 미룬다 |
| R7 | 경쟁률 URL이 죽은 링크일 수 있음 | **개정 3에서 해소.** 실제로 터졌다 — 연세대 외국인전형(1108082) 초안에 경쟁률 URL이 박혔다. 목록 295건 중 59건이 경쟁률 미공개다. 기본 제외 + 인스펙터 체크박스로 바꿨다 |
| R8 | 테스트 더미가 목록에 섞임 | `진학대학교 결제사 테스트(KCP)`(9998783)가 upcoming에 있다. 기존 동작(테스트 탭도 동일) |
| R9 | cron-job.org 미등록 시 **자동 발송이 통째로 죽음** | 개정 2 이후 수동 발송 경로가 없어 이 의존이 더 커졌다. §8 |

---

## 8. 배포 후 잔여 (사람이 해야 함)

1. **마이그레이션 2개 적용**
2. **cron-job.org에 `/api/open-notices/dispatch` 5분 주기 등록** — 실 트리거는 GitHub Actions가 아니라 cron-job.org다(`data-requests-dispatch.yml:4-5`가 cron을 제거하고 주석으로 명시). **머지 ≠ 동작.** 등록 전까지 토글을 켜도 메일이 안 나간다 — 개정 2에서 수동 발송을 없앴으므로 **대체 경로가 없다**
3. 배포 후 잘못된 시크릿으로 POST해 **401**을 확인(307이면 PUBLIC_PATHS 누락)

> dispatch 라우트류는 `automation_runs`에 안 남아서 **automation-digest의 미실행 감지에도 안 잡힌다** — data-requests도 같은 사각지대다. 이번 범위 밖이지만 알고 있어야 한다.

## 10. 개정 3 — 실사용에서 나온 것 둘

메일을 실제로 받아보고 나온 수정이다.

- **경쟁률 줄이 기본으로 들어가면 안 된다** (R7이 실제로 터진 것). 연세대 외국인전형 초안에 경쟁률 URL이 박혔다 — 그 서비스는 경쟁률을 공개하지 않는다. 목록 295건 중 **59건**(대학원·외국인·편입·고등 등)이 그렇다. `listRatioAuditTargets()` 가 `category='수시'` 를 점검 대상으로 쓰는 것도 같은 사실을 가리킨다. **기본 제외 + 인스펙터 체크박스**로 바꿨다. 끌 때는 경쟁률 줄만 빼는 게 아니라 접수관리자 설명의 `└ 접수현황·경쟁률 실시간 조회` 도 `└ 접수현황 실시간 조회` 로 바꾼다 — 경쟁률을 안 쓰는 서비스면 관리자 화면 설명에도 그 단어가 없어야 한다. 체크박스는 본문 위에 둔다 — 켜면 본문을 다시 만들어서 편집 내용이 사라지므로 '정하고 나서 고친다' 순서가 되게 했다
- **구분선이 모바일에서 두 줄로 접혔다.** `─` 32자가 화면 폭을 넘어 긴 줄 + 짧은 꼬리로 갈라졌다. 16자로 줄였다. `■` 제목이 이미 구분 역할을 해서 선은 보조다

## 9. 별도 건으로 분리

| 순서 | 건 | 판단 |
|---|---|---|
| **이 PR 앞** | **문서-코드 불일치** — `closing_services` 적재 전략을 "덮어씀"으로 적은 3곳(`CLAUDE.md`, `20260607c` 마이그 주석, `target-url.ts:6`). 실제는 `upsert ignoreDuplicates` 누적 | 3줄짜리 `docs:` PR. 코드 변경 0줄이라 리스크 0. **이 설계의 FK 판단을 잘못 세우게 만든 원인**이고, 고치지 않으면 다음 사람이 같은 데서 넘어진다 |
| **이 PR 뒤** | **R5** 탭별 헤더 건수 — `page.tsx`의 `resolvePageMeta(slug, meta, total)`에서 `total`이 탭과 무관 | 지금도 틀려 있으나 탭이 3개가 되면 더 눈에 띈다. 이번 PR에 섞으면 리뷰 범위가 "신규 기능"에서 "기존 버그 수정 포함"으로 번진다 |
| **미룸** | **R6** `sending` 고착 복구 자동화 | 실측상 갇힌 행 0건 — 아직 안 터진 문제다. 게다가 고치려면 자료요청·백업요청·오픈안내 3곳 공통 복구 장치가 되어야 해서 그 자체로 별도 설계다. 실제로 한 번 터지면 그때 근거를 갖고 만든다 |
