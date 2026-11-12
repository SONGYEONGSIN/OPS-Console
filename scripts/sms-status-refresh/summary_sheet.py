"""`00. 요약` payload — 출처 `summary.py` 배치를 실행마다 다시 쓴다(결정 8). COM 쓰기는 T13 몫이다.

입력은 T9/T10 이 합친 숨김 표(`verify_table.Table`, A~T)와 `_확인` 항목(`merge_schools.read_issues`)이다.
어댑터가 머리글 이름(`table_rows.named`)으로 출처 dict(jp·pims·check·lines·kind·state·doccat·cat·regcat·서류 8종)
를 만든다. 분류는 T(태그)를 만든 함수와 같은 것을 쓴다(`doc_category`·`reg_category`·`doc_tag`) — 그래야 파란 수
= 그 키로 거른 행 수다.

링크 = 각 보기 시트 검색 칸(`search`, T11 view payload `searchCell`). `search` 에 없는 시트(04 확인 필요 — 안
만지는 장)는 원본 요약 링크 대상 중 그 시트 것이 하나뿐이면 그것을 쓴다. 대상이 원본 요약 링크(`link_targets`)에
없으면 링크를 걸지 않고 값만 쓰며 payload `warnings` 에 시트·대상·칸 수를 적는다(verify L_SUM_TARGET 이 원본에 없는
대상을 거절한다). 0 인 칸에는 링크가 없다.

payload: {kind:"summary", sheet, rows, links:{칸:"시트!셀"}, merged:[...], tips:{칸:툴팁}, styles:{칸:스타일 키},
warnings:[...]} — 스타일 키·행 높이·열 너비는 `summary_layout` 머리 설명.
"""
from __future__ import annotations

import datetime as dt
import re
from collections import Counter
from typing import Callable, Iterable, Mapping, Sequence

from number_rows import doc_tag
from school_rows import CHECK, DOC_COLS, STATES, doc_category, reg_category
from sejong import NO_NUMBER
from sheet_names import ISSUE_VIEW, SUMMARY_SHEET, VIEW_OF
from summary_layout import GAP, Row, assemble, line, note, section, title
from table_rows import is_blank, named, text
from verify_table import Table

KINDS = ("4년제", "전문대학", "대학원", "초중고", "기타")
_VIEW = {hid: view for view, hid in VIEW_OF.items()}
S_SCHOOL, S_DOC, S_NUM = _VIEW["_학교"], _VIEW["_서류"], _VIEW["_번호"]
SHEETS = (S_SCHOOL, S_DOC, S_NUM, ISSUE_VIEW)
SCH, NUM, ISS, ALL = "학교만 보기", "번호만 보기", "건만 보기", "전체 보기"
DOC_CATS = ("모두 제출", "미제출 있음", "서류 확인 안 됨")
LINE_CATS = ("서류 모두 제출", "서류 보완 필요", "서류 확인 안 됨")
TITLE = "SMS 발신번호 사전등록 현황: 요약"
NOTES = ("파란 수를 누르면 해당 시트로 이동해 그 항목만 보여 줌 (처음 열 때 위쪽 「콘텐츠 사용」 클릭)",
         "일괄 등록은 2025-09 세종 일괄 등록분, 추가 등록은 그 뒤 추가분, 서류 미비는 세종이 서류 보완을 요청한 번호",
         "제출 서류는 팀즈 「03. 학교별 제출 서류」 PDF를 쪽마다 확인한 결과 (2026-10-15 세종 기준 대학 서류 8종)")
_DAY = re.compile(r"(?<!\d)(\d{6})(?!\d)")
_EXT = re.compile(r"\.[A-Za-z0-9]+$")  # 마지막 `.확장자` — 출처 문구에는 확장자가 없다
_BASE = "▪ 기준 자료: 세종 「{name}」 (2025-09 이후 등록한 번호만 있음), "


def base_line(sejong_name: str, today_kst: str) -> str:
    """기준 자료 줄(00 A5·01~03 A4) — 「」 안은 확장자를 뗀 이름. 작성일 = 이름의 YYMMDD(마지막 것),
    날짜가 아니면 작성일 구간을 뺀다."""
    name, made = _EXT.sub("", sejong_name), None
    for m in reversed(_DAY.findall(name)):
        try:
            made = dt.datetime.strptime(m, "%y%m%d").strftime("%Y-%m-%d")
            break
        except ValueError:
            continue
    return _BASE.format(name=name) + (f"{made} 작성, " if made else "") + f"{today_kst} 갱신"


# ---------------------------------------------------------------- 어댑터 (A~T 행 → 출처 dict)
def _records(t: Table) -> list[dict[str, object]]:
    rows = (named(t, r) for r in t.rows)
    return [v for v in rows if any(not is_blank(x) for x in v.values())]


def _has(v) -> bool:
    """school_rows.school_tags 의 '번호 없음' 판정과 같다(0·"0"·빈 칸 = 회선 없음)."""
    return v not in (None, "", 0, "0")


def school_records(t: Table) -> list[dict]:
    return [{"kind": text(v.get("구분")), "jp": text(v.get("원서접수")) == "O", "pims": text(v.get("PIMS")) == "O",
             "lines": _has(v.get("등록 회선")), "check": text(v.get("확인")) == CHECK} for v in _records(t)]


def doc_records(t: Table) -> list[dict]:
    return [{"kind": text(v.get("구분")), "cat": doc_category(v.get("제출 상태")), "state": text(v.get("제출 상태")),
             "regcat": reg_category(v.get("세종 등록 상태")), **{c: text(v.get(c)) for c in DOC_COLS}}
            for v in _records(t)]


def number_records(t: Table) -> list[dict]:
    return [{"kind": text(v.get("구분")), "state": text(v.get("상태")), "doccat": doc_tag(v.get("제출 서류"))}
            for v in _records(t)]


def issue_records(issues: Iterable[Mapping]) -> list[dict]:
    return [{"type": text(x.get("유형")), "target": text(x.get("대상"))} for x in issues]


# ---------------------------------------------------------------- 섹션 (출처 summary.build 순서 그대로)
Make = Callable[[list, str, str], list]


def _by_kind(rows: list, make: Make) -> list[Row]:
    out = [line(k, make(rs, f"{k} · ", k)) for k in KINDS if (rs := [x for x in rows if x["kind"] == k])]
    return out + [line("합계", make(rows, "", ""), total=True)]


def _count(xs: Iterable, pred) -> int:
    return sum(1 for x in xs if pred(x))


def _registration(schools: list, numbers: list) -> list[Row]:
    n_lines = _count(numbers, lambda x: x["state"] != NO_NUMBER)

    def reg(rs, pre, k):
        ns = [x for x in numbers if not k or x["kind"] == k]
        return ([(len(rs), S_SCHOOL, k, SCH), (_count(ns, lambda x: x["state"] != NO_NUMBER), S_NUM, pre + "등록 회선", NUM)]
                + [(_count(ns, lambda x, s=s: x["state"] == s), S_NUM, pre + s, NUM) for s in STATES]
                + [(_count(rs, lambda x: not x["lines"]), S_SCHOOL, pre + NO_NUMBER, SCH),
                   (_count(rs, lambda x: x["check"]), S_SCHOOL, pre + CHECK, SCH)])
    heads = ["구분", "학교", "등록 회선", "일괄 등록", "추가 등록", "서류 미비", NO_NUMBER, CHECK]
    return section(f"■ 등록 현황 · {len(schools)}곳 · {n_lines}회선", heads) + _by_kind(schools, reg) + [GAP]


def _lines_docs(schools: list, numbers: list) -> list[Row]:
    def lines_doc(rs, pre, k):
        ns = [x for x in numbers if (not k or x["kind"] == k) and x["state"] != NO_NUMBER]
        return [(len(ns), S_NUM, pre + "등록 회선", NUM)] + \
               [(_count(ns, lambda x, c=c: x["doccat"] == c), S_NUM, pre + c, NUM) for c in LINE_CATS]
    return (section("■ 등록 회선 × 제출 서류 (회선 수, 10/15 기준)", ["구분", "등록 회선", *LINE_CATS])
            + _by_kind(schools, lines_doc)
            + [note("※ 세종에 등록된 번호라도 그 학교 서류가 10/15 기준에 못 미치면 「서류 보완 필요」, "
                    "누르면 03. 번호 목록에서 해당 번호만 보임"), GAP])


def _one_missing(checks: list) -> Row:
    """서류 모두 제출 각주 — 0곳이면 출처 문구 그대로, 아니면 곳 수를 적는다(출처는 0곳을 박아 두었다)."""
    one = [x for x in checks if x["state"] == "1종 미제출"]
    cnt = Counter(c for x in one for c in DOC_COLS if x[c] not in ("O", ""))
    n_all = _count(checks, lambda x: x["cat"] == "모두 제출")
    head = ("10/15 기준(법인인감 필수, 재직증명서·신분증 둘 다)을 다 갖춘 학교"
            + ("는 아직 없음" if n_all == 0 else ""))
    tail = ", ".join(f"{k} {v}" for k, v in sorted(cnt.items(), key=lambda kv: -kv[1]))
    return note(f"※ 서류 모두 제출 {n_all}곳: {head}, 1종만 빠진 학교 {len(one)}곳 ({tail})")


def _services(schools: list, checks: list) -> list[Row]:
    def svc(rs, pre, k):
        cs = [x for x in checks if not k or x["kind"] == k]
        return ([(len(rs), S_SCHOOL, k, SCH),
                 (_count(rs, lambda x: x["jp"]), S_SCHOOL, pre + "원서접수", SCH),
                 (_count(rs, lambda x: x["pims"]), S_SCHOOL, pre + "PIMS", SCH),
                 (_count(rs, lambda x: not x["jp"] and not x["pims"]), S_SCHOOL, pre + "서비스 미확인", SCH)]
                + [(_count(cs, lambda x, c=c: x["cat"] == c), S_DOC, pre + c, SCH) for c in DOC_CATS])
    heads = ["구분", "학교", "원서접수", "PIMS", "서비스 미확인", "서류 모두 제출", "미제출 있음", "서류 확인 안 됨"]
    return (section("■ 서비스 · 제출 서류 현황 (학교 수)", heads) + _by_kind(schools, svc)
            + [note("※ 원서접수·PIMS 를 둘 다 쓰는 학교는 양쪽에 모두 셈"), _one_missing(checks), GAP])


def _registration_docs(checks: list) -> list[Row]:
    heads = ["세종 등록 상태", "학교", "서류 모두 제출", "미제출 있음", "서류 확인 안 됨"]
    out = section("■ 세종 등록 상태 × 제출 서류 (학교 수)", heads)
    for reg in ("등록 완료", "서류 미비 회선 있음", NO_NUMBER):
        rs = [x for x in checks if x["regcat"] == reg]
        out.append(line(reg, [(len(rs), S_DOC, reg, SCH)] +
                        [(_count(rs, lambda x, c=c: x["cat"] == c), S_DOC, f"{reg} · {c}", SCH) for c in DOC_CATS]))
    out.append(line("합계", [(len(checks), S_DOC, "", ALL)] +
                    [(_count(checks, lambda x, c=c: x["cat"] == c), S_DOC, c, SCH) for c in DOC_CATS], total=True))
    return out + [note("※ 세종에 등록은 됐지만 10/15 기준 서류가 빠진 학교는 보완 서류를 받아야 함 (KISA 점검 대상)"), GAP]


def _per_doc(checks: list) -> list[Row]:
    done = [x for x in checks if x["cat"] != "서류 확인 안 됨"]
    row = line("미제출", [(_count(done, lambda x, c=c: x[c] != "O"), S_DOC, f"{c} 미제출", SCH) for c in DOC_COLS])
    return (section("■ 서류별 미제출 학교 수 (서류 확인된 학교 기준)", ["서류", *DOC_COLS]) + [row]
            + [note("※ 법인인감은 직인대장·사용인감계 등으로 대신 낸 학교도 미제출로 셈 (10/7부터 법인인감 필수)"), GAP])


def _issues(issues: list) -> list[Row]:
    by: dict[str, list[str]] = {}
    for x in issues:
        by.setdefault(x["type"], []).append(x["target"].split("\n")[0])
    out = section(f"■ 확인 필요 · {len(issues)}건", ["유형", "건수", "대상"], merge_tail=True)
    out += [line(t, [(len(names), ISSUE_VIEW, t, ISS), (", ".join(names), None, "", "")], merge_tail=True,
                 list_col=True) for t, names in by.items()]
    return out + [line("합계", [(len(issues), ISSUE_VIEW, "", ALL)], total=True)]


# ---------------------------------------------------------------- payload
def _targets(search: Mapping[str, str], link_targets: Iterable[str]) -> tuple[dict, dict]:
    """보기 시트 → 걸 대상(원본 요약 링크에 있을 때만) / 걸려고 했던 대상."""
    allowed = set(link_targets)
    tried = {}
    for sheet in SHEETS:
        own = sorted(t for t in allowed if t.rpartition("!")[0] == sheet)
        tried[sheet] = f"{sheet}!{search[sheet]}" if search.get(sheet) else (own[0] if len(own) == 1 else None)
    return {s: (t if t in allowed else None) for s, t in tried.items()}, tried


def summary_payload(schools: Table, docs: Table, numbers: Table, issues: Sequence[Mapping],
                    search: Mapping[str, str], base_text: str, link_targets: Iterable[str]) -> dict:
    """합친 `_학교`·`_서류`·`_번호` 표 + `_확인` 항목 → `00. 요약` payload(1행부터, 값은 str·int 만)."""
    sch, chk, num, iss = school_records(schools), doc_records(docs), number_records(numbers), issue_records(issues)
    rows = (title(TITLE, NOTES, base_text) + [GAP] + _registration(sch, num) + _lines_docs(sch, num)
            + _services(sch, chk) + _registration_docs(chk) + _per_doc(chk) + _issues(iss))
    targets, tried = _targets(search, link_targets)
    return {"kind": "summary", "sheet": SUMMARY_SHEET, **assemble(rows, targets, tried)}
