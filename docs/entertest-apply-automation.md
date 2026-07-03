# entertest 원서작성 자동화 해독 (v2 설계 자료)

`/dashboard/dev-test`의 테스트 실행을 **v1 도달성 스모크**에서 **v2 실제 원서작성 완주(결제 직전까지)**로
확장하기 위한 리버스엔지니어링 결과. 러너 `scripts/entertest/test_run.py`의 `check_apply_write`(미구현)
구현 근거가 된다. (2026-06 해독)

> 결제 직전까지(기본) = 원서 작성 → 저장 → `/Payment/UnivWritingList`(결제 수단 선택) 도달.
> **`ENTERTEST_PAY=true` opt-in 시 테스트 결제 → 접수완료까지** 진행(테스트 사이트 전용 PG, 실과금 없음).
> ⚠️ 접수완료 시 같은 계정/학교 재작성 불가(계정 소진) → 반복 테스트는 기본(결제직전)으로, 전 과정 완주 검증만
> PAY=true + 깨끗한 계정. 둘 다 ✅ 검증 완료(5·6차 로그).

## 환경 전제

- **게이트는 IP가 아니라 UA(브라우저) 체크** — 실제 Chrome이면 plain Selenium으로 통과. 회사 PC 불필요,
  어느 머신에서나 로컬 실행 가능 (python + selenium + Chrome).
- 로그인: `jt`+5자리 테스트 계정, **ID=PW 동일**. `/Login`(ASP.NET WebForms),
  `ContentPlaceHolderPage_txtUserName/txtPassword`에 JS로 값 주입 후 `Login()` 호출.

## 진입 시퀀스 (해독 완료)

1. `GET /Notice/{sid}/A` — 유의사항.
2. nav "원서작성" = `RedirectURL('/ApplyFirst/{sid}/A')` → 외부는 `/Notice/{sid}/T`, **iframe은 `/Noti/{sid}/T`**.
3. **실제 콘텐츠는 iframe `#frmNotice`(src=`/Noti/{sid}/{tab}`) 안에 있다.** 바깥 문서엔 nav/footer뿐 —
   동의서·폼 필드를 보려면 `switch_to.frame(#frmNotice)` 필수.
4. 동의서(iframe `/Noti/{sid}/T`): 체크박스 `c0`(모두 동의) + `chkNotice1~5`, 버튼 `开始填报志愿` onclick=`onApply()`.
5. 모두 체크 → `onApply()` → confirm **"원서를 작성하시겠습니까?"** accept → `/Wonseo/{sid}/{N}/A` = **실제 원서 폼**
   (이 페이지는 iframe 아님 — default content).

## 핵심 우회 기법 (두 난관 해결)

### 1. 파일 업로드 우회 (다이얼로그 불필요)
jw `FILEFIELD`는 static `<input type=file>`이 없다(클릭 시 동적 생성 + 네이티브 다이얼로그 → Selenium 불가).
하지만 업로드 **콜백이 hidden 필드만 세팅**하므로 JS로 직접 주입하면 클라이언트 검증 통과:

- **사진**: `PhotoRegist({storageUrl, FileName, Ext, Size})` 호출 — `txtPhotoFileName/Ext/Size` 세팅 +
  미리보기 img 표시. (`PhotoLoad(true)` = 계정 최근 사진 AJAX 로드도 가능)
- **서류**: hidden `hdnUploadFileName/OrgFile/Size/Type`(F_UploadFile=여권), `hdnUploadFile1*`(외국인등록증) 세팅.
- 업로드 이미지는 실제 파일/확장자 무관(테스트 환경, 결제 직전까지는 파일 존재 검증 없음).

### 2. 팝업 SEARCHFIELD 우회
국적·학과·학교 등 **필수 팝업 필드(`jwtype=SEARCHFIELD`)**는 검색 팝업으로 코드를 세팅한다. 직접 hidden
**`hdn{searchid}Code`**(예: `hdnNationalityCode`, `hdnNationality2Code`(현거주국), `hdnUnivMajorCode`,
`hdnGraduteUnivNationCode` …)만 채우면 된다. **검증은 "비어있지 않음"만 확인 — 'CN'/'1' 등 아무 값 OK**(검증됨).
필수 searchid 18종: Major, UnivSubMajor, Major2, UnivSubMajor2, Nationality, Nationality2, ExamNationality,
SchoolNationality, GraduteUniv, GraduteUnivNation, GraduteunivMajor, HiGradeName, GGradeName, EnterUniv,
EnterUnivMajor, PrevUniv, PrevUnivMajor, PrevUnivNation.

## 저장 + 검증 루프

- **저장 버튼**: `a.btn1.st1`, 텍스트 "저장 (保存)"(전형별로 "저장"만일 수도). onclick 없이 jQuery 핸들러 →
  요소를 직접 click. (정확매칭 필요 — "저장시 이벤트" 등 오답 회피)
- **검증은 네이티브 alert이 아니라 in-page `div.layer_cont` 커스텀 모달.** 확인 버튼 `a.btn3.st2`(전형별 상이).
  **첫 미충족 1건씩** 표시 → 채우고 재저장 반복.
- 숨김 상태의 필수 필드는 가시성 무시 force-set 필요(예: `txtPassport`).
- 모달을 broad 텍스트 매칭으로 닫으면 footer 등 오클릭으로 페이지 이탈 → `div.layer_cont`로 한정할 것.

## 필드 포맷 주의 (전형별 상이)

- **재학일자**: 숫자만. `txtPeriodStart/End`=8자리(YYYYMMDD), `txtGradutePeriodStart/End`=6자리(YYYYMM).
- **외국인등록번호** `txtEMemSsn_1`(앞6=생년월일) + `txtEMemSsn_2`(뒤). 성별/세기 digit과 생년 일치 필요
  (예: 뒤 첫자리 6=외국인 2000년대 → 앞자리 `05xxxx`. `90xxxx`+6=2090=미래 → "생년월일 날짜에 맞게" 거부).
- **영문/중문 페어 필드**: `txt{X}`=영문/한글, `txtC{X}`=중문. 중문 필드에 영문 넣으면 거부("…중문으로 입력").
  학교명·학과·주소가 각각 영문/중문 페어 (F_GraduteCollege/F_CGraduteUniv, F_GraduteUnivAddr/F_CGraduteUnivAddr …).

## 검증된 진척 (1104069 외국인 중문 편입 = worst-case 폼)

진입 → 채움 → 업로드 우회 → 저장 시 검증 루프가 다음 순서로 통과: 업로드 ✓ → 여권번호 ✓ → 국적 ✓ →
현거주국 ✓ → 코드 20종 ✓ → 생년월일 ✓ → 재학일자 ✓ → 학교 영문명 ✓ → (남은: 졸업대학 주소/학과 영문·중문 페어 long-tail).
→ **전 과정 자동화 가능 입증.** 남은 건 전형별 텍스트 필드 채우기(기계적).

## 남은 작업 / 다음 단계

1. `scripts/entertest/test_run.py`에 `check_apply_write` 추가 — 위 시퀀스(진입+채움+업로드우회+코드우회+저장 검증루프)를
   구조화. 전형 감지 + 필드 매핑 테이블. CHECKS에 1줄 등록.
2. 타깃 전형 우선순위 + 유효 테스트 데이터(생년월일·자격조건)는 운영자 확정 필요.
   - 일부 전형은 **자격 거부 게이트** 있음(예: 8108005 경연대회 — "참가자격" 모달, 계정/전형 조건 의존).
   - 학부 수시/정시는 6월엔 미오픈 — 폼이 외국인/대학원보다 짧음. 가능하면 그 시기 PoC가 쉬움.

## 진행 로그 — check_apply_write 1차 구현 (2026-06-19, 1104069)

`scripts/entertest/test_run.py`에 `enter_wonseo` + `check_apply_write`(broad-fill + 저장 검증루프) 구현.
`ENTERTEST_APPLY_WRITE=true`로 단독 실행(인제스트 X, 결과 출력)·반복 검증 가능.

**작동 확인된 것:**
- **진입 자동화 OK**: `enter_wonseo` — ApplyFirst → iframe `#frmNotice` 동의 체크박스 전체 체크 →
  `window.confirm` override → `onApply()` → `/Wonseo/1104069/4/A` 도달.
- **저장 트리거**: 저장 버튼 onclick = `javascript:DoValidate();` (이 폼 확정).
- **검증 모달 = `#globalAlert`** (해독 본문의 `div.layer_cont`는 전형별 변형 — 1104069은 `#globalAlert`).
  ⚠️ `#globalAlert`는 `position:fixed` + 0-size wrapper라 `offsetParent`/`getClientRects`가 0 →
  가시성 판정은 **`display!=='none' && visibility!=='hidden'` + innerText 존재**로만 해야 한다(`_MODAL_JS`).
- **검증 루프 진행 확인**(수동 diag, 모달 1건씩 닫으며): `여권번호를 입력해 주세요.`(passport=`EM0000000`)
  → `초·중·고 전체 재학년수`(=`txtTotal`, **readonly 자동합산** → 타깃 set 필요).

**현재 블로커 (다음 세션):**
- 루프 자동실행 시 모달 텍스트가 매 회 **"검색"** 으로 고착. 원인 추정: DoValidate 직후 SEARCHFIELD
  검색 팝업이 잠깐 떠서, 모달 **폴링(최대 5s)** 이 실제 `#globalAlert` 검증 메시지보다 "검색" 팝업을 먼저 잡음.
  (수동 diag는 고정 2s 후 1회 읽어 `#globalAlert`를 잡았음 — 타이밍 차.)
- 해결 방향(택1):
  1. 모달 폴링에서 **"검색" 팝업은 무시**하고 `#globalAlert` 검증 메시지만 대기(검색 레이어 셀렉터 제외 / 검색 팝업 자동 닫기 후 재판정).
  2. SEARCHFIELD(지원학과/국적 등) **검색 팝업이 애초에 안 뜨도록** 필요한 hidden 코드를 정확히 세팅.
     (포괄 `[id^=hdn][id$=Code]='1'`은 오히려 검색 팝업을 유발 → 역효과. 어떤 코드가 트리거인지 특정 필요.)
- 그 뒤 long-tail(졸업대학 주소/학과 영문·중문 페어 등) field-by-field 수렴 — 루프 모달 메시지를 워크리스트로.

**검증 도구**: `ENTERTEST_APPLY_WRITE=true ENTERTEST_TARGET_URL=.../Notice/1104069/A ENTERTEST_ACCOUNT=jt29005 python scripts/entertest/test_run.py`
— 진입 후 채움+저장을 15회 반복하며 각 회 모달 메시지를 출력. (이 PC에서 직접 실행 가능 — Chrome 필요.)

### 진행 로그 갱신 (2026-06-19, 2차)

검증 모달/검색팝업 정체를 완전히 규명하고 루프를 전진시킴:
- **검증 모달 = `#globalAlert`만** 본다. (`div.layer_cont`/`.layer.attention`은 SEARCHFIELD 검색팝업과
  클래스가 겹쳐 "검색" 오탐 → `_MODAL_JS`를 `#globalAlert` 단독으로 한정.)
- **SEARCHFIELD 검색팝업 = `#SearchLayer_Pop`** (class `layer search1`), 닫기 = `a.close`("닫기"). ESC 안 먹음.
  → `_close_search_popup()` 추가, 루프 매 회 채움 전후로 닫아 DoValidate 차단 방지.
- **메시지 기반 force-fill** 추가(`_force_fill_for_message`): 검증 모달이 지목한 필드를 placeholder/label로
  찾아 readonly/숨김 무시하고 force-set → broad-fill이 놓친 hidden/조건부 필드 수렴.
- **루프 전진 확인**(검색팝업 닫은 뒤): `여권번호`(EM0000000) → `이수학년 및 학기`까지 진행.
- 조기종료 버그 수정: "모달 없음=성공" 오판 제거 → **URL이 `/Wonseo` 벗어났을 때만** 저장성공 판정.

### 진행 로그 (2026-06-19, 3차 — 검색팝업/마스크 디스커버리)

검색팝업 구조·트리거 거의 규명. 단 **결과-row 선택 onclick은 미확보**(다음 단계 핵심).
- **`#SearchLayer_Pop` 구조**: 헤더(예 "대학 검색") + 검색 input(placeholder "대학명을…", **id/name 없음**
  → `#SearchLayer_Pop input[type=text]`(보이는 것)으로 선택) + **`a.btn_search`("검색")** + `a.close`("닫기").
  **결과 table/list는 검색 클릭 후 동적 로드**(초기 비어 있음).
- **팝업 오픈 = jQuery 바인딩 `Search(searchid)`** (예 `Search("Major")`/`"UnivSubMajor"`/`"MiddleSchool"`/`this.id`).
  ⚠️ **전역 아님** — `execute_script("Search(...)")` → `ReferenceError`. 인라인 `onclick="Search("`도 **없음**(전부
  jQuery 바인딩). → 팝업 열려면 **searchfield 돋보기 트리거 요소를 실제 click**해야 함(트리거 셀렉터 미특정).
- **마스크 필드**: `txtGraduteUnivYearSemester`("이수학년 및 학기")는 마스크 "X학년 Y학기" → '4'면 "4학년 _학기"
  (학기 빈칸)로 검증 실패 → **'42'(4학년 2학기)** 필요. force-fill/broad-fill `/Semester/` 분기 추가(적용 완료).
  다른 마스크 필드도 같은 식으로 2~N자리 필요할 수 있음.

**다음 단계 정확한 순서:**
1. searchfield **돋보기 트리거 요소 셀렉터** 디스커버리(magnifier/`.btn_search`류가 jQuery로 `Search()` 바인딩).
   클릭해 `#SearchLayer_Pop` 오픈. (form HTML `06_wonseo.html`에서 searchfield 옆 trigger 마크업 확인.)
2. 팝업 input에 쿼리 입력 → `a.btn_search` click → 동적 결과 대기 → **첫 결과 row 클릭 = 코드/이름 세팅**
   (이 onclick 메커니즘이 미확보분 — 결과 row의 onclick/`data-*` 확인 필요).
3. `select_search_result(driver, query)` 헬퍼화 → 막히는 searchfield별 호출. 그 뒤 long-tail은 force-fill로 수렴.

블로커 요약: ① searchfield 트리거 셀렉터, ② 결과-row 선택 onclick — 둘만 확보하면 헬퍼 완성 가능.

### 진행 로그 (2026-06-19, 4차 — 검색팝업 결과선택 완전 해독 ✅)

**SEARCHFIELD 결과선택 메커니즘 전부 규명·검증 → `select_search_result()` 헬퍼 구현.**
- searchfield 컨테이너: `<span jwtype="SEARCHFIELD" searchid="{X}" id="F_{X}">` (+ readonly `txt{X}Name` + hidden `hdn{X}Code`). jw 프레임워크(`jwidx`).
- **트리거 = `a#btn{searchid}`** (class `btn_search navy`). 예 `#btnNationality`,`#btnGraduteUniv`,`#btnMajor`. 클릭 → `#SearchLayer_Pop` 오픈. (`Search()` JS는 jQuery바인딩=전역호출 불가 → 이 버튼 클릭이 정답.) 일부 btn은 `display:none`(조건부).
- 팝업: 검색 input(보이는 `#SearchLayer_Pop input[type=text]`) + **`a.btn_search`("검색")** → 결과 `<ul><li>`.
  - 첫 `<li>` = 안내("해당하는 …를 선택하세요."). 데이터 li = `<li style="cursor:pointer"><a><span class="title">중국</span><span class="detail">CHINA</span></a></li>`.
  - **데이터 li 클릭(jQuery 바인딩, inline onclick 없음)** → `hdn{X}Code` + `txt{X}Name` 세팅 + 팝업 자동 닫힘. **검증됨**: `#btnNationality`→"중국"→`hdnNationalityCode=C0012184`, `txtNationalityName=중국`.
- 구현: `select_search_result(driver, searchid, query)` + `_resolve_open_popup(driver)`(이미 열린 팝업을 여러 쿼리로 해소). 루프 no-#globalAlert+팝업 분기에서 `_resolve_open_popup` 호출.

**남은 과제 (전체 폼 수렴 — 별도):**
- **DoValidate 피드백 불안정**: 같은 코드인데 어떤 실행은 globalAlert가 뜨고(여권→이수학년 진행) 어떤 실행은
  globalAlert/팝업 둘 다 안 뜸 → 비동기(마스크 onchange·검색결과 AJAX·저장 confirm) 레이스로 추정.
  안정화 필요: 각 단계 사이 명시적 대기(요소/네트워크 idle), DoValidate 직후 alert/confirm/네트워크 settle 대기.
- **per-searchfield 쿼리**: `_resolve_open_popup`은 광역 쿼리(중국/中/大学/…) 폭격 → 필드별 적합 쿼리·결과 0건 처리 보강 필요.
- 1104069는 searchfield 18 + 마스크/영중문 페어 long-tail → 완주까지 추가 그라인드. 단 **핵심 메커니즘(진입·저장루프·모달·검색팝업 결과선택)은 모두 확보**.

### 진행 로그 (2026-06-19, 5차 — ✅ 결제 직전까지 완주 달성)

`check_apply_write`가 1104069(외국인 중문 편입 worst-case)에서 **결제목록 도달까지 완전 통과**(`status: pass`,
2회차 JWValidate 통과 + 저장). 4차의 "DoValidate 피드백 불안정"은 잘못된 채널 추정이었고, 진짜 원인 5가지를 규명·수정:

1. **검증 피드백 = 네이티브 `alert()`** (not `#globalAlert`). `DoValidate`→`window.JWValidate()`가 첫 미충족 1건을
   `alert("…주세요.")`로 표시. 루프가 `window.alert`를 **무력화(no-op)** 해서 메시지를 통째로 삼킨 게 "불안정"의 정체.
   → `_INSTALL_ALERT_CAPTURE_JS`: alert를 `window.__alertMsg`에 **캡처**(삼키지 않음). `_alert_text()`로 소비.
2. **필드 정확 매칭 = jw 컨테이너 속성**. fuzzy 라벨/placeholder 매칭은 "동의" 부분문자열로 엉뚱한 라디오를 골랐다
   (`rdoPersonalDataAgree3` vs 실제 `F_UnivAgree`). jw는 필수 컨테이너 `<span jwtype korname searchid
   requiredalert="…주세요.">`에 메타 보존 → **`[requiredalert="<메시지>"]` 정확 일치**로 필드 특정,
   `jwtype`별 처리(RADIOFIELD→첫 라디오(value 1/Y) 체크, SEARCHFIELD→`SEARCH:{searchid}` 신호, TEXT→값 주입).
   라디오는 `el.value=` 가 아니라 **`checked`/click** 필요.
3. **사진·서류는 위조 불가 — 실제 업로드 필수**. 가짜 `PhotoRegist`/hidden 주입 시 서버가 storageUrl/파일을 검증해
   **`/Error/CommonError`(저장 실패)**. 사진(`hdnFlagPhoto=3`) = `#UpPic`→`PhotoDirect()`→iframe `#__frmHelper`
   (`DirectPhotoUpload.aspx`) `<input type=file id=UploadedPicture>` **`send_keys`**(다이얼로그 우회)→`#UploadBtn`→
   서버가 실제 storageUrl 생성→`PhotoRegist`. 서류(여권 `F_UploadFile`/외국인등록증 `F_UploadFile1`) = 트리거
   `btn{Name}Edit`→iframe `JSFileUpload` `<input type=file id=UploadedFile>` send_keys→`#UploadBtn`(`uploadFile()`).
   → `upload_photo()` / `upload_documents()`. 테스트 이미지는 PIL 300×400 JPEG(`_test_photo.jpg`, gitignore).
4. **업로드 보존 = broad-fill 선행**. 라디오/select 클릭이 조건부 섹션을 재렌더하며 업로드 hidden을 리셋한다
   (검증됨: broad-fill마다 `hdnUploadFileName` 비워짐). **업로드 전 broad-fill 2회로 렌더 안정화** → 이후 broad-fill은
   멱등(이미 채워짐→무동작)이라 업로드 생존.
5. **저장 경로 완성 = thenable alert/confirm**. 사이트의 `alert`/`confirm`은 **Promise 반환식**이고 저장 경로
   `JX.ExecuteSaveEvents`가 `confirm(...).then(t).catch(DoValidateExcept)`/`alert(...).finally(...)`로 체이닝.
   override가 boolean/undefined 반환 시 체인이 깨져 **저장이 조용히 중단**(DoValidateExcept). → override가 **동기 thenable**
   반환(confirm 자동 yes). 이 수정 직후 실제 저장 성공("이미 동일학교에 작성한 원서가 있습니다" 네이티브 alert가 증거).

**반복 실행 안정화:**
- **성공 판정 = 결제목록 권위**: URL 변화/신규·편집 모드에 의존하지 않고, 루프는 **`JWValidate()` 게이트**(통과 시에만
  `DoValidate`로 저장)로 돌린 뒤 `/Payment/UnivWritingList`에 `결제하기` 버튼 존재 + `작성한 원서가 없습니다` 부재로 판정.
  (`DoValidate` 직접 폴링이 "파일 업로드 완료" 등 비검증 alert를 오탐하던 문제도 제거.)
- **삭제 선행 = 매 회 신규 경로**: `delete_unpaid_applications()`가 `/MyPage/PayingPage` `삭제하기`→Deletelayer
  (chkagree 동의 **클릭 1회**(set+click은 토글되어 풀림) + passwd=계정(ID=PW) + `btnpasswdCheck`→`btnDelete`).
  네이티브 confirm은 드라이버 `unhandledPromptBehavior=accept`로 자동 수락. 기존 원서가 있으면 ApplyFirst가 편집
  페이지 `/Wonseo/{sid}/{N}/AC/{ApplyID}`로 직행하므로 `enter_wonseo`도 신규(동의 iframe)/기존(직행) 양 경로 처리.

**검증(연속 2회 pass)**: `ENTERTEST_APPLY_WRITE=true … python scripts/entertest/test_run.py`
→ 삭제 N건 → 신규 진입 → 사진 OK/서류 2건 → JWValidate 2회차 통과·저장 → `결제직전 도달 — 결제목록에 원서 있음`.

**남은 확장(별도)**: 다른 전형(학부 수시/정시·대학원 등) 폼 차이 대응, per-searchfield 적합 쿼리(현재 광역 폭격으로
충분 — 검증은 코드 존재만 확인), `check_apply_write`를 CHECKS 시퀀스/ingest에 정식 편입할지 결정.

### 진행 로그 (2026-06-19, 6차 — ✅ 결제·접수완료까지 완주)

`ENTERTEST_PAY=true` opt-in으로 **테스트 결제 → 접수완료**까지 codify·검증(jt29001 → 수험번호 `2026U14010851004`,
`status: pass`). 전 과정: 원서작성 → 저장 → 사진/서류 업로드 → 결제직전 → 테스트 결제 → 접수완료.

- **결제 흐름**(`complete_payment()`): 결제목록 `결제하기` → `/Payment/UnivPayBegin/{sid}/{ApplyID}` 결제수단 화면
  (계좌이체/신용카드/진학캐쉬 + **테스트 결제** 버튼 `onclick=PayClick('btnPay','PayTest')`=테스트 사이트 전용 PG, **실과금 없음**)
  → 테스트 결제 클릭 → `/Payment/PayConfirm/{sid}` "원서접수가 완료되었습니다" → `/Payment/UnivPayResult/{sid}`에
  **수험(접수)번호**(예 `2026U14010851004`) + 출력물. 미접수원서 → 접수원서로 이동.
- **계정 소진 주의**: 접수완료 후 같은 계정/학교는 재작성 불가 — ApplyFirst가 `/Notice/{sid}/A`로 바운스(동의 iframe
  체크박스 0개; 신규는 `/Noti/{sid}/T` 체크박스 6개). `enter_wonseo`가 **체크박스 0개면 "접수완료 차단" RuntimeError**로
  명확히 보고(main이 트레이스백 없이 메시지만). → 반복 테스트는 jt29001~ 중 미사용 계정 사용.
- **소진 현황**: jt29005(수동 결제 검증), jt29001(코드 PAY 검증) = 1104069 접수완료 상태. jt29002~29004는 클린.

### 진행 로그 (2026-07-03, 7차 — service_id 1210065(부산대 외국인 신입학) 전화필드 블로커 ⚠️ 미해결)

1104069(외국인 편입)는 완주하지만 **1210065(외국인 신입학)는 폼이 달라 전화번호 검증에서 무한루프 FAIL**("결제목록 비어있음"). 정밀 진단 결과:

- **폴러 스모크(run_checks 5체크)는 "페이지 도달"만 확인** — 폼 미작성. 그래서 dev-test의 "완료 pass 5/5"는 실제 접수완료가 아님. `ENTERTEST_PAY`는 run_checks와 무관(check_apply_write 전용).
- **전화 필드 구조**: 3분할 hidden `phoStuTel1/2/3` — ⚠️ **`id`가 아니라 `name` 기반**(ASP.NET WebForms). `getElementById` 실패 → `getElementsByName` 필요. visible `txtStuTel`은 `maxLength=13` = **대시 형식 "010-1234-5678" 기대**. 기존 `_WONSEO_FILL_JS`/`_FORCE_FILL_JS`는 "01012345678"만 넣어 pho2/3 빈값 → FAIL.
- **시도(모두 벽)**: ① JS로 pho1/2/3 직접세팅 → JWValidate 실행 시 리셋. ② `send_keys` 실타이핑 → pho 분할은 됨(010/1234/5678)이나 JWValidate가 unmasked txtStuTel에서 재파생해 깨짐. ③ **txtStuTel 대시형 + pho1/2/3 정확 세팅 → 값 전부 유지되는데도 JWValidate가 계속 "전화번호를 입력해 주세요" 거부.**
- **결론(핵심)**: 이 폼 JWValidate 전화 검증은 단순 값 채움으로 안 풀림 — **JS 데이터구조/검증 플래그/특정 입력 시퀀스** 요구로 추정. **다음: 사이트 JWValidate 전화 검증 로직 직접 리버스엔지니어링**(브라우저 devtools로 JWValidate 소스 + 전화 관련 hidden/JS var 추적).
- 그 외 남은 미충족 필수: 국적(SEARCHFIELD `txtNationalityName`/`txtHiSchoolNationalityName`), 동의(`chkTempOK11`·`rdoRefundSelectY`·`rdoAwarenessSurvey1`·`rdoUnivAgreeY`).
- **계정 미소진**(폼 저장 실패) — jt29005~jt29010 그대로.
- 검증 실행(집): `ENTERTEST_APPLY_WRITE=true ENTERTEST_PAY=true ENTERTEST_TARGET_URL=https://entertest.jinhakapply.com/Notice/1210065/A ENTERTEST_ACCOUNT=jt29005~jt29010 python scripts/entertest/test_run.py`

### 진행 로그 (2026-07-03, 8차 — 범용 작성 엔진 1단계: DISCOVER 의미속성 캡처 강화)

폼마다 무한 루프로 재확인하는 하드코딩(id 정규식·전화 10자리 고정) 대신, **사이트가 필드에 선언한 의미 속성을 읽어 role 기반으로 채우는 범용 엔진**으로 가는 첫 단계.

- `_INVENTORY_JS` 강화 — 필드별로 `korname`(한글명)·`requiredalert`(검증 실패 메시지)·`jwtype`(SEARCHFIELD 등)·`searchid`·`maxlength`·`readonly`/`disabled`·`class` + 모든 `jw*`/`data-*` 속성(`attrs`)과, 필드에 없으면 상위 4단계 래퍼의 jw 속성(`wrap`)까지 캡처. `[discover]` 로그에 `(의미속성 N)` 표기.
- **다음 (증거 수집)**: 두 폼을 DISCOVER로 덤프해 비교 →
  `ENTERTEST_DISCOVER=true ENTERTEST_TARGET_URL=.../Notice/1104069/A ...` (성공 골든),
  `.../Notice/1210065/A ...` (실패). `discovery/*.fields.json`의 전화(phoStuTel1/2/3·txtStuTel)·국적·동의 필드 `requiredalert`/`korname`/`maxlength`를 비교해 role 매핑 근거 확보.
- **2단계 예정**: `field_definitions.py`(role→포맷·값·감지) + `form_configs.py`(폼별 델타). 1104069를 회귀 앵커로.

### 진행 로그 (2026-07-03, 9차 — PHONEFIELD 랜드라인/휴대 포맷 구분 ✅)

DISCOVER + 실측(APPLY_WRITE)으로 1210065 **전화번호 무한 반복** 블로커의 근본 원인을 규명·수정.

- **재현**: APPLY_WRITE(jt29005)에서 `txtStuTel = 01012345678` 세팅에도 "전화번호(Telephone No.)를 입력해 주세요"가 7~15회 반복(진행 불가).
- **근본 원인**(추측 아님 — 페이지 인라인 JS `PhoneFnc` 정규식 실물): PHONEFIELD는 `data-phone-validate`로 랜드라인/휴대를 구분한다.
  - `phone`(랜드라인) `/^(02|0[3-9][0-9])([0-9]{1}[0-9]{2,3})([0-9]{4})$/`
  - `mobile`(휴대) `/^(010)([0-9]{4})([0-9]{4})$/`
  - `CompleteCheck`는 `val().replace(비숫자,'')` 후 정규식 검사 → **`010…`은 랜드라인 정규식 불합격**. `txtStuTel`(전화번호=랜드라인)에 휴대폰 번호를 넣어 무한 반복.
- **수정**(surgical): `_FORCE_FILL_JS`에 PHONEFIELD 분기 추가 — `data-phone-validate`에 phone만 있으면 `0215881588`(02-1588-1588), 아니면 `01012345678`. `_WONSEO_FILL_JS` 전화 분기도 상위 `[jwtype=PHONEFIELD]` 래퍼의 `data-phone-validate`로 동일 구분. 값 세팅 후 `blur`로 PhoneFnc 재포맷/완료.
- **검증**(실측): 재실행 시 전화번호 모달 **완전 소멸** → 국적 검색까지 통과, 다음 롱테일(`졸업(예정)일` DATEFIELD=`txtHiGradeYMD1`)로 전진. 전화 블로커 해소 확인.
- **남은 롱테일**(2단계 role 레지스트리 대상): DATEFIELD(`YMD` 날짜 포맷) 등 jwtype별 채우기 규칙 일반화.

### 진행 로그 (2026-07-03, 10차 — 범용 role 엔진 완성: 1210065 결제직전 완주 ✅)

설계(`docs/entertest-universal-engine-design.md`)대로 role 레지스트리를 구축, worst-case 외국인 폼
1210065를 **진입 → 전 필드 자동 → 저장 → 결제직전**까지 완주(저장=True). 각 롱테일을 실측으로 수렴:

- **`field_roles.py` + 단위테스트**(stdlib unittest 9건): `role_value(jwtype, attrs)` 순수 함수. PHONE(랜드라인/휴대)·EMAIL·DATE 값 결정, SEARCH/FILE은 특수처리 None. 값-role의 **단일 소스**.
- **통합**: `_force_fill_for_message`가 `ROLE:` 마커를 `role_value`로 해소 후 `_SET_VALUE_JS` 주입. id 정규식 대신 jwtype dispatch.
- **DATEFIELD**: `txtHiGradeYMD1 = 20200228`(YYYYMMDD) — role_value로 졸업일 전진.
- **CHECKFIELD 토글 버그**: `checked=true` 후 `click()`이 도로 해제 → **click 먼저 후 미체크만 force**. 개인정보 동의 무한반복 해소 → JWValidate=True(전체 검증 통과) 도달.
- **ADDRESSFIELD**: 우편번호 팝업 대신 `JX(name).Set({BASEAREA,ROADJUSO,OLDJUSO1,ROADJUSOETC,REGION})`로 `RoadData` 세팅 — 저장 핸들러 `ADDRESS.text()`가 `RoadData`(null)에 `ROADJUSOETC` 쓰다 크래시하던 원인 해소.
- **결과**: 13회차 JWValidate=True → **결제직전 도달**. 전화·날짜·동의·주소 블로커 전부 해소.
- **form_configs.py(step 5)**: 1210065가 role 기본값만으로 완주 → 폼별 override 불필요(YAGNI). 실측에서 필요한 폼이 나올 때 신설.

## 참고

- DISCOVER 모드(`ENTERTEST_DISCOVER=true`)가 단계별 page_source/스크린샷 + 필드/버튼 인벤토리(`{단계}.fields.json`)를
  `scripts/entertest/discovery/`(gitignore)에 덤프 — 폼별 셀렉터 확정용.
- 함수 소스는 Wonseo 폼 인라인 JS에서 `PhotoRegist.toString()` 등으로 확인 가능.
