"""세종 발번 리스트 → 회선 목록(`_학교`·`_서류`·`_번호` 계산의 입력).

출처 `report/SMS 발신번호 사전등록/data.py` 의 `load_lines`·`STATE_BY_FILL`·`kind`·`check_note`·
`date_fix`·`by_school` 을 옮겼다. 규칙은 원문 그대로다.

`compare.load_sejong`(06·07 대조용)과 **번호 판정이 다르다.** 여기는 출처처럼 번호 칸의 첫 글자가 숫자인지로
가르고(범위 `~`·짧은 번호도 한 줄로 남긴다 — `_번호` 시트가 그대로 보여 준다), compare 는 `exclusion_reason` 으로
대조에 쓸 수 있는 번호만 거른다. 의도된 차이다.

상태는 번호가 아니라 **대학명 칸(B)의 바탕색**이다. 바탕색을 읽어야 하므로 openpyxl 을 읽기 전용이 아닌
일반 모드로 연다. 경고에는 건수만 싣는다(학교명·번호를 로그에 남기지 않는다).
"""
from __future__ import annotations

import datetime as dt
import io
from collections import OrderedDict

from openpyxl import load_workbook

from compare import SEJONG_COLS, check_header
from contract import StepFailure
from keys import NAME_FIX

# 세종 리스트의 바탕색 → 상태
STATE_BY_FILL = {"FFFFFF00": "일괄 등록", "FFFFC000": "추가 등록", "FFFF0000": "서류 미비"}
NO_NUMBER = "번호 없음"

# 세종 리스트 Univ 값이 우리 대학 ID 와 다른 곳이 있어(인하공전·서울예대 등) 이름으로도 가른다
JUNIOR = {"경복대학교", "수원여자대학교", "인하공업전문대학", "서울예술대학교"}
_AUTOFILL_NAME, _AUTOFILL_AFTER = "명지대학교", "2025.11.13"
_AUTOFILL_DATE = dt.date(2025, 11, 13)


def kind(univ, name: str) -> str:
    if "고등학교" in name or "영재학교" in name:
        return "초중고"
    if "대학원" in name:
        return "대학원"
    if "협회" in name:
        return "기타"
    if name in JUNIOR or (isinstance(univ, int) and 4000 <= univ < 5000):
        return "전문대학"
    return "4년제"


def _date(v):
    """등록일자 — datetime 또는 '2025.11.26' 문자열. 못 읽으면 None."""
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, str) and v.count(".") == 2:
        try:
            y, m, d = (int(x) for x in v.split("."))
            return dt.date(y, m, d)
        except ValueError:
            return None
    return None


def _univ(v):
    """Univ — 정수로 읽히면 정수(출처와 같다), 아니면 글자."""
    s = "" if v is None else str(v).strip()
    return int(s) if s.isdigit() else s


def _rgb(cell) -> str | None:
    """바탕색 'AARRGGBB'. 칠하지 않았거나 테마·색인 색이면 None(모르는 색)."""
    if not cell.fill.fill_type:
        return None
    rgb = cell.fill.fgColor.rgb
    return rgb if isinstance(rgb, str) else None


def check_note(x: dict) -> str:
    """세종 원본 값 중 손볼 곳 — 원본은 그대로 두고 메모로만 남긴다."""
    if x["name"] == _AUTOFILL_NAME and isinstance(x["raw_date"], str) and x["raw_date"] > _AUTOFILL_AFTER:
        return "등록일자 자동 채우기 오류로 보임, 메일상 11/13 등록"
    if x["name"] == "한양대학교(서울)" and x["num"].startswith("031-400"):
        return "안산 국번(031-400), ERICA 번호로 보임 (세종에는 서울로 등록)"
    return ""


def _line(row) -> tuple[dict, str | None, str | None] | None:
    """한 줄 → (회선 레코드, B 칸 색, C 칸 색). 대학명이 비면 None."""
    univ, name, num, memo, day = (c.value for c in row[:5])
    if not name:
        return None
    name = NAME_FIX.get(str(name).strip(), str(name).strip())
    b_rgb, c_rgb = _rgb(row[1]), _rgb(row[2])
    is_num = bool(num) and str(num)[:1].isdigit()
    x = {
        "univ": _univ(univ), "name": name, "kind": kind(_univ(univ), name),
        "num": str(num).strip() if is_num else "",
        "state": STATE_BY_FILL.get(b_rgb, NO_NUMBER) if is_num else NO_NUMBER,
        "date": _date(day), "raw_date": day,
        "memo": str(memo).strip() if memo and memo != "a" else "",
        "text": "" if is_num or not num else str(num),
    }
    check = check_note(x)
    fixed = {**x, "check": check, "date_fix": _AUTOFILL_DATE if check else x["date"]}
    return fixed, (b_rgb if is_num else None), (c_rgb if is_num else None)


def _open_rows(data: bytes) -> list[tuple]:
    """첫 시트의 모든 행(셀 그대로 — 바탕색이 필요하다). 못 열면 source_shape, 원인 문구는 싣지 않는다."""
    try:
        wb = load_workbook(io.BytesIO(data))
        try:
            return [tuple(r) for r in wb.worksheets[0].iter_rows()]
        finally:
            wb.close()
    except Exception as e:  # noqa: BLE001 — 깨진 파일의 종류가 다양하다. 클래스만 남긴다
        raise StepFailure("source_shape", f"세종 파일을 열지 못함 ({type(e).__name__})") from None


def load_sejong_lines(data: bytes) -> tuple[list[dict], list[str]]:
    """세종 발번 리스트 → (회선 목록, 경고 문구 목록). 번호 한 줄 = dict 하나.

    레코드: univ·name·kind·num·state·date·raw_date·memo·text·check·date_fix.
    번호가 있는 줄의 바탕색이 세 가지가 아니면 `번호 없음`으로 두고, 대학명(B)·번호(C) 칸 색이 다르면
    그대로 B 를 따르되 둘 다 건수로 알린다.
    """
    rows = _open_rows(data)
    check_header([tuple(c.value for c in r) for r in rows], 0, SEJONG_COLS, "세종")
    lines, unknown, mismatch = [], 0, 0
    for row in rows[1:]:
        parsed = _line(row)  # 머리글 검사가 통과했으면 모든 행이 5칸 이상이다
        if parsed is None:
            continue
        x, b_rgb, c_rgb = parsed
        lines.append(x)
        if x["num"] and b_rgb not in STATE_BY_FILL:
            unknown += 1
        if x["num"] and b_rgb != c_rgb:
            mismatch += 1
    warnings = ([f"모르는 바탕색 {unknown}줄"] if unknown else []) + \
        ([f"대학명·번호 칸 바탕색이 다른 줄 {mismatch}줄"] if mismatch else [])
    return lines, warnings


def group_schools(lines) -> OrderedDict:
    """(대학 ID, 학교명) → 회선 목록. 나온 순서를 지킨다."""
    g: OrderedDict = OrderedDict()
    for x in lines:
        g.setdefault((x["univ"], x["name"]), []).append(x)
    return g
