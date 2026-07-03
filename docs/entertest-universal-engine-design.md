# entertest 범용 원서작성 엔진 설계 (2단계 — role 레지스트리)

> 1단계(DISCOVER 의미속성 캡처) + 9차 PHONEFIELD 수정으로 확보한 **실측 증거**를 기반으로,
> 폼마다 하드코딩 id 정규식을 늘리는 대신 **jwtype(사이트가 선언한 필드 역할)별 채우기 전략**으로
> 모든 전형을 커버하는 범용 엔진 설계. (2026-07-03)

## 문제 (현재 한계)

`check_apply_write`의 `_WONSEO_FILL_JS`/`_FORCE_FILL_JS`는 **id 정규식**(`/Mobile|Tel/i`, `/Period/`, `/Semester/` …)으로
값을 고른다. 폼이 바뀔 때마다:
- 새 id 패턴이 나오면 정규식을 추가해야 함 (무한 확장).
- 같은 "전화번호" 라벨이라도 랜드라인/휴대 구분을 id로는 알 수 없어 9차 같은 버그 발생.
- 어떤 필드가 왜 실패하는지 사후 추적이 어려움.

## 핵심 통찰 (증거)

사이트는 **모든 필드에 역할을 선언**한다 — `jwtype`(래퍼 span) + `data-*` 신호. 1210065(외국인 worst-case,
345필드)를 DISCOVER로 덤프하니 **단 15종 jwtype**으로 전부 분류됨(의미속성 314/345 캡처). 즉 "필드 하나하나"가
아니라 **jwtype 15종만 규칙화**하면 폼 무관하게 커버된다.

### role 레지스트리 증거표 (1210065 실측, 필수 159건)

| jwtype | 개수(필수) | 채우기 전략 | 값/포맷 근거 |
|---|---|---|---|
| **SEARCHFIELD** | 58 (58) | `select_search_result(searchid)` 또는 hidden `hdn{searchid}Code` 세팅 | `searchid=Major/Nationality/…` (해독 완료) |
| **RADIOFIELD** | 55 (31) | 값 `1`/`Y` 우선, 없으면 첫 옵션 click | 재현: `rdoSelTypeCode1` 등 |
| **SELECTFIELD** | 52 (9) | 첫 non-empty option(`selectedIndex=1`) | — |
| **TEXTFIELD** | 51 (26) | `data-limit`별 값: OnlyEng→`TEST`, OnlyNumDash→`010…`, 중문(txtC*)→`测试` | `data-limit=OnlyEng/OnlyNumDash` |
| **PHONEFIELD** | 17 (12) | `data-phone-validate`: phone→`0215881588`, mobile→`01012345678` | ✅ 9차 수정(PhoneFnc 정규식) |
| **DATEFIELD** | 9 (9) | `YYYYMMDD` (maxlength=8) | `txtHiGradeYMD1` maxlength=8 |
| **CHECKFIELD** | 17 (5) | 미체크 전부 check | 동의 체크박스 |
| **FILEFIELD** | 10 (5) | `upload_photo()`/`upload_documents()` 실파일 | 서버 실검증(위조 불가) |
| **ADDRESSFIELD** | 3 (3) | 우편번호 5자리(`12345`) + 주소 텍스트 | base maxlength=5 |
| **DATERANGEFIELD** | 12 (0) | 시작/끝 각 날짜 (재학일자 8자리 or 6자리) | `GradutePeriod`=YYYYMM |
| **SEMESTERFIELD** | 4 (0) | 마스크 "X학년 Y학기" → `42` | 3차 해독 |
| **SCOREFIELD** | 24 (0) | 숫자(학점 등) | — |
| **EMAILFIELD** | 1 (1) | `test@test.com` | placeholder 이메일 |
| **PERIODFIELD** | 1 (0) | 기간 텍스트 | — |
| (none) | 31 (0) | ASP.NET hidden(`__EVENTTARGET` 등) — skip | — |

## 아키텍처

신규 2모듈 + `check_apply_write` 통합(정규식 dispatch → role dispatch).

### 1. `scripts/entertest/field_roles.py` — role 레지스트리 (순수 로직, 단위 테스트 대상)

```python
# jwtype + data-* 신호 → 채울 값(문자열) 또는 특수 액션 토큰.
def role_value(jwtype: str, attrs: dict) -> str | None:
    """필드 의미속성으로 채울 값을 결정. None이면 이 role은 JS/파이썬 특수 처리(SEARCH/FILE)."""
```

- **순수 함수** = TDD 가능. 입력 `(jwtype, attrs)` → 출력 값. 브라우저 불필요.
- PHONEFIELD/TEXTFIELD/DATEFIELD 등 값-결정 로직을 여기로 이관(현재 JS 정규식에서).
- SEARCHFIELD/FILEFIELD는 `None` 반환 → 호출부가 기존 `select_search_result`/`upload_*`로 위임.

### 2. `scripts/entertest/form_configs.py` — 폼별 델타 (선택적 override)

```python
# 전형별로 role 기본값이 안 통하는 예외만 최소 기술. 대부분 폼은 빈 dict(기본 role로 커버).
FORM_OVERRIDES: dict[str, dict] = {
    # "1210065": {"txtSpecialField": "특정값"},  # 필요 시에만
}
```

- YAGNI: 기본 role로 커버되면 빈 dict. 실측으로 필요한 것만 추가.

### 3. 통합 — `_FORCE_FILL_JS`/`_WONSEO_FILL_JS`를 role-aware로

- JS는 필드의 `jwtype`+`data-*`를 파이썬으로 넘기고, 파이썬 `role_value()`가 결정한 값을 다시 JS로 주입.
- 또는 role→값 매핑 테이블을 JS에 주입(execute_script 인자)해 in-browser dispatch. **택1은 구현 시 결정**(파이썬 왕복이 테스트 용이).

## 검증 전략

- **단위(TDD)**: `field_roles.py`는 순수 함수 → `test_field_roles.py`로 각 jwtype/신호 조합 RED→GREEN.
  (예: `role_value("PHONEFIELD", {"data-phone-validate":"phone"}) == "0215881588"`)
- **통합(실측)**: 1210065 APPLY_WRITE 재현이 **회귀 앵커**. 현재 도달점(전화 통과→졸업일 DATEFIELD)에서
  DATEFIELD role 추가 시 다음 필드로 전진하는지 매 단계 실측.
- **골든 1104069 제약**: 모든 테스트 계정(jt29001·jt29005)이 이미 **접수완료 소진**돼 Wonseo 재진입 불가.
  → 1104069는 정적 골든 앵커로 쓸 수 없음. 대신 **1210065(외국인 worst-case superset)**를 단일 앵커로 삼음.
  (신규 클린 계정 확보 시 1104069 회귀 추가 가능 — 현재는 불가.)

## 단계 분해 (bite-sized)

1. `field_roles.py` + `test_field_roles.py` — PHONEFIELD/TEXTFIELD/DATEFIELD/EMAIL role RED→GREEN (순수 로직 이관).
2. `check_apply_write` 통합 — 정규식 fill을 role dispatch로 교체. 1210065 실측으로 전화 통과 유지 확인(회귀).
3. DATEFIELD role 적용 → 다음 롱테일까지 실측 전진(현 블로커 해소).
4. 잔여 롱테일(DATERANGE/ADDRESS/중문 페어…) role 수렴 — 실측 모달 메시지를 워크리스트로.
5. `form_configs.py` — 실측에서 role 기본값이 안 통한 예외만 등록.

## 리스크 / 비고

- role dispatch 전환은 **동작하는 PHONEFIELD 수정(9차)을 role로 재구현**하므로 회귀 위험 → 1단계에서 전화 role을
  먼저 테스트로 고정하고 통합.
- 실 사이트 실행이라 각 단계 실측은 회사/가정 IP(UA 게이트)에서만. 계정 소진 주의(DISCOVER/결제직전은 미소진).
