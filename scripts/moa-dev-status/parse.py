"""Moa 작업진행현황 표 파서. 표준 라이브러리만 쓴다(selenium 을 import 하지 않는다).

칸 모양이 하나라도 다르면 DevStatusFailure 로 멈춘다 — 일부만 넘기면 구분이 조용히 뒤집힌다.
담당자 칸(2번째)은 텍스트를 모으지 않는다.
"""
import re
from html.parser import HTMLParser

EXPECTED_HEADER: tuple[str, ...] = (
    "대학정보", "담당자", "접수기간", "엑셀 업로드",
    "개발 요청", "개발완료", "테스트 오픈", "리얼배포",
)
NO_RESULT_TEXT = "검색 결과가 존재하지 않습니다."

_TABLE_SUMMARY = "작업진행현황"
_ID_RE = re.compile(r"^\d{7}$")
# 테스트 오픈(7번째)·리얼배포(8번째) 칸 — 둘 다 '-' 아니면 초까지 있는 일시다
_STAMP_RE = re.compile(r"^(-|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$")
_MANAGER_CELL = 1  # 0부터: 2번째 칸


class DevStatusFailure(RuntimeError):
    def __init__(self, code: str, reason: str):
        super().__init__(f"{code}: {reason}")
        self.code = code
        self.reason = reason


def _squash(text: str) -> str:
    return " ".join(text.split())


def _nospace(text: str) -> str:
    # 실제 머리글은 <br /> 로 줄이 바뀐다("개발<br />요청") — 공백을 전부 지우고 비교한다
    return re.sub(r"\s+", "", text)


class _TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.found = False
        self.closed = False  # 대상 표의 </table> 을 봤는가
        self.header: list[str] = []
        # 행마다 칸 텍스트 목록(담당자 칸은 빈 문자열) + 첫 칸 정보
        self.rows: list[dict] = []
        self._depth = 0  # 0 = 대상 표 밖, 1 = 대상 표 안, 2+ = 중첩 표
        self._row: dict | None = None
        self._cell: list[str] | None = None
        self._cell_index = -1
        self._in_th = False
        self._th: list[str] = []
        self._span_depth = 0  # 첫 칸의 첫 span 안일 때 1

    def _abandon_open_row(self) -> None:
        # 닫히지 않은 행은 버리지 않고 표시해 두었다가 검증에서 실패시킨다
        if self._row is not None and self._row["cells"]:
            self._row["unclosed"] = True
            self.rows.append(self._row)
        self._row = None
        self._cell = None
        self._cell_index = -1

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            if self._depth > 0:
                self._depth += 1
            elif a.get("summary") == _TABLE_SUMMARY and not self.found:
                self.found = True
                self._depth = 1
            return
        if self._depth != 1:
            return
        if tag == "tr":
            self._abandon_open_row()
            self._row = {"cells": [], "block": False, "span": None, "span_done": False}
        elif tag == "th":
            self._in_th, self._th = True, []
        elif tag == "td" and self._row is not None:
            self._cell_index = len(self._row["cells"])
            self._cell = []
            self._row["cells"].append("")
            if self._cell_index == 0:
                tokens = (a.get("class") or "").split()
                self._row["block"] = "td_block" in tokens
        elif tag == "span" and self._cell is not None and self._cell_index == 0:
            if self._row["span"] is None:
                self._row["span"] = ""
                self._span_depth = 1
            elif self._span_depth:
                self._span_depth += 1

    def handle_endtag(self, tag):
        if tag == "table":
            if self._depth == 1:
                self._abandon_open_row()
                self.closed = True
            if self._depth > 0:
                self._depth -= 1
            return
        if self._depth != 1:
            return
        if tag == "th" and self._in_th:
            self.header.append(_squash("".join(self._th)))
            self._in_th = False
        elif tag == "td" and self._cell is not None:
            if self._cell_index != _MANAGER_CELL:
                self._row["cells"][self._cell_index] = _squash("".join(self._cell))
            self._cell = None
            self._cell_index = -1
        elif tag == "span" and self._span_depth:
            self._span_depth -= 1
        elif tag == "tr" and self._row is not None:
            if self._row["cells"]:
                self.rows.append(self._row)
            self._row = None

    def handle_data(self, data):
        if self._depth != 1:
            return
        if self._in_th:
            self._th.append(data)
        if self._cell is not None and self._cell_index != _MANAGER_CELL:
            self._cell.append(data)
            if self._span_depth and self._cell_index == 0:
                self._row["span"] += data


def parse_work_status(html: str) -> list[tuple[int, str, str]]:
    """(서비스ID, 테스트 오픈 원문, 리얼배포 원문) 목록."""
    p = _TableParser()
    p.feed(html)
    p.close()
    if not p.found:
        raise DevStatusFailure("table_missing", f'table[summary="{_TABLE_SUMMARY}"] 이 없다')
    if not p.closed:
        raise DevStatusFailure("table_missing", "표가 닫히지 않았다")
    if tuple(_nospace(h) for h in p.header) != tuple(_nospace(h) for h in EXPECTED_HEADER):
        raise DevStatusFailure("header_changed", f"머리글 {len(p.header)}칸이 기대와 다르다")
    rows = p.rows
    if all(len(r["cells"]) == 1 and NO_RESULT_TEXT in r["cells"][0] for r in rows):
        raise DevStatusFailure("empty", "행이 없거나 검색 결과가 없다")

    out: list[tuple[int, str, str]] = []
    seen: set[int] = set()
    for n, r in enumerate(rows, start=1):
        if r.get("unclosed"):
            raise DevStatusFailure("row_shape", f"행 {n}: tr 이 닫히지 않았다")
        if len(r["cells"]) != 8:
            raise DevStatusFailure("row_shape", f"행 {n}: 칸 수가 {len(r['cells'])}이다(8이어야 한다)")
        if not r["block"]:
            raise DevStatusFailure("row_shape", f"행 {n}: 첫 칸이 td_block 이 아니다")
        sid = (r["span"] or "").strip()
        if not _ID_RE.match(sid):
            raise DevStatusFailure("row_shape", f"행 {n}: 서비스ID span 이 7자리 숫자가 아니다")
        test_open, real_deploy = r["cells"][6], r["cells"][7]
        if not _STAMP_RE.match(test_open):
            raise DevStatusFailure("row_shape", f"행 {n}: 테스트 오픈 칸이 '-' 도 일시도 아니다")
        if not _STAMP_RE.match(real_deploy):
            raise DevStatusFailure("row_shape", f"행 {n}: 리얼배포 칸이 '-' 도 일시도 아니다")
        service_id = int(sid)
        if service_id in seen:
            raise DevStatusFailure("duplicate_id", f"행 {n}: 서비스ID {service_id} 가 중복이다")
        seen.add(service_id)
        out.append((service_id, test_open, real_deploy))
    return out
