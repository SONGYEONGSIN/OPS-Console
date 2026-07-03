#!/usr/bin/env python3
"""entertest 원서작성 범용 엔진 — jwtype role 레지스트리 (순수 로직).

사이트가 각 필드에 선언한 역할(`jwtype` 래퍼 + `data-*` 신호)로 채울 값을 결정한다.
폼마다 id 정규식을 늘리는 대신 jwtype 15종만 규칙화하면 전형 무관하게 커버된다.

설계·증거: docs/entertest-universal-engine-design.md
반환 None = 값-주입이 아니라 특수 처리(SEARCHFIELD→검색팝업, FILEFIELD→실파일 업로드)를
호출부가 담당해야 하는 role.
"""


def role_value(jwtype: str, attrs: dict) -> str | None:
    """필드 의미속성으로 채울 값을 결정. 특수 role이거나 미지원이면 None/기본값.

    attrs: 필드/래퍼의 data-* 신호 dict (data-phone-validate, data-limit, maxlength, searchid …).
    """
    jt = (jwtype or "").upper()

    if jt == "PHONEFIELD":
        # JX PhoneFnc 정규식(9차 해독): phone(랜드라인) /^(02|0[3-9][0-9])…/ 는 '010…' 불합격.
        pv = (attrs.get("data-phone-validate") or "").lower()
        if "phone" in pv and "mobile" not in pv:
            return "0215881588"  # 02-1588-1588 (랜드라인)
        return "01012345678"  # 010… (휴대 / multi / 미지정)

    if jt == "EMAILFIELD":
        return "test@test.com"

    if jt == "DATEFIELD":
        # 졸업일자 > 입학일자 제약(검증) → korname/id로 입학/졸업 구분해 순서 보장.
        hint = (attrs.get("korname") or "") + (attrs.get("idref") or attrs.get("id") or "")
        if any(k in hint for k in ("졸업", "Gradut", "End")):
            return "20220228"  # 졸업(늦은 날짜)
        if any(k in hint for k in ("입학", "Enter", "Start", "재학")):
            return "20180302"  # 입학(이른 날짜)
        return "20200228"  # YYYYMMDD (maxlength=8) 기본

    if jt in ("SEARCHFIELD", "FILEFIELD"):
        return None  # 특수 처리 — 호출부가 select_search_result / upload_* 위임

    return "TEST"  # 기본(TEXTFIELD 등 자유 텍스트)


if __name__ == "__main__":  # 간이 확인
    for jt, at in [
        ("PHONEFIELD", {"data-phone-validate": "phone"}),
        ("PHONEFIELD", {"data-phone-validate": "mobile"}),
        ("EMAILFIELD", {}),
        ("DATEFIELD", {"maxlength": "8"}),
        ("SEARCHFIELD", {"searchid": "Major"}),
    ]:
        print(jt, at, "→", role_value(jt, at))
