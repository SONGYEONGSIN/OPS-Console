# entertest 원서작성 자동화 해독 (v2 설계 자료)

`/dashboard/dev-test`의 테스트 실행을 **v1 도달성 스모크**에서 **v2 실제 원서작성 완주(결제 직전까지)**로
확장하기 위한 리버스엔지니어링 결과. 러너 `scripts/entertest/test_run.py`의 `check_apply_write`(미구현)
구현 근거가 된다. (2026-06 해독)

> 결제 직전까지 = 원서 작성 → 저장 → `/Payment/UnivWritingList`(결제 수단 선택) 도달. **실제 결제/접수완료는 하지 않음.**

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

## 참고

- DISCOVER 모드(`ENTERTEST_DISCOVER=true`)가 단계별 page_source/스크린샷 + 필드/버튼 인벤토리(`{단계}.fields.json`)를
  `scripts/entertest/discovery/`(gitignore)에 덤프 — 폼별 셀렉터 확정용.
- 함수 소스는 Wonseo 폼 인라인 JS에서 `PhotoRegist.toString()` 등으로 확인 가능.
