"""`_번호` 한 행의 값 — 출처 `build_xlsx.py` 의 number_records 를 옮겼다(규칙 원문 그대로).

출처와 다른 점(입력이 다르다):
- 출처의 `c`(check_records 한 줄 — 서류 PDF 대조)는 이 레포에 없다. 같은 값을 T9 가 합친 `_서류` 행
  ({열 이름: 값})의 제출 상태·서류 표시 칸에서 읽는다(`_학교` 제출 서류와 같은 원천).
- 제출 서류 `보완 필요: …` 는 빠진 서류 이름이 있을 때만 이름을 붙이고, 없으면 분류(`서류 보완 필요`)만 쓴다 —
  출처는 `보완 필요: ` 빈 꼬리를 만들 수 있었다(T9 `doc_brief` 의 빈 괄호를 막은 것과 같은 이유).
- 비고는 출처 memo(memo·check 를 ` / ` 로) 중 지금 비고에 없는 조각만 덧붙인다(결정 6·Ruling 19).
  번호가 있으면 `번호 없음` 조각만 지운다. 조각 판정은 `_학교` 비고와 같은 함수다.
- 태그(T)는 그 행의 최종 값으로 만든다 — 사람이 고친 제출 서류도 태그에 그대로 든다.
"""
from __future__ import annotations

from typing import Mapping

from edits import append_only
from school_rows import _pieces, doc_category, fmt_day, missing_docs
from sejong import NO_NUMBER
from table_rows import combos, text
from verify_table import NOTE_SEP, REMOVABLE_NOTE

# 출처 DOC_CAT — `_서류` 제출 상태 분류 → `_번호` 제출 서류
DOC_CAT = {"모두 제출": "서류 모두 제출", "미제출 있음": "서류 보완 필요", "서류 확인 안 됨": "서류 확인 안 됨"}
NEEDS_FIX, FIX_HEAD = "서류 보완 필요", "보완 필요"
REGISTERED = "등록 회선"
NO_NUM_TEXT = "-"


def registered(x: Mapping) -> bool:
    return x["state"] != NO_NUMBER


def number_sejong(x: Mapping, kind) -> dict[str, object]:
    """`_번호` 세종 열(No 제외) — 구분은 부르는 쪽이 `_학교` 행에서 정해 넘긴다."""
    return {"학교명": x["name"], "구분": kind, "발신번호": x["num"] or x["text"] or NO_NUM_TEXT,
            "상태": x["state"], "등록일자": fmt_day(x["date"])}


def number_doc(x: Mapping, doc: Mapping | None) -> str | None:
    """제출 서류 — 번호 없는 줄은 빈칸. 그 학교의 `_서류` 행이 없으면 None(계산하지 못함)."""
    if not registered(x):
        return ""
    if doc is None:
        return None
    cat = DOC_CAT[doc_category(doc.get("제출 상태"))]
    names = missing_docs(doc)
    return f"{FIX_HEAD}: {', '.join(names)}" if cat == NEEDS_FIX and names else cat


def number_note(cur, x: Mapping) -> str:
    """비고 — 번호가 있으면 `번호 없음` 조각만 지우고, 출처 memo 조각 중 없는 것만 ` / ` 로 덧붙인다."""
    parts = text(cur).split(NOTE_SEP)
    head = NOTE_SEP.join(p for p in parts if p.strip() != REMOVABLE_NOTE) if registered(x) else text(cur)
    have = _pieces(head)
    frags = [m for m in (x["memo"], x["check"]) if m and not _pieces(m) <= have]
    return append_only(head, NOTE_SEP.join(frags), NOTE_SEP)


def doc_tag(v) -> str:
    s = text(v)
    return NEEDS_FIX if s.startswith(FIX_HEAD) else s


def number_tags(v: Mapping[str, object]) -> list[str]:
    """`_번호` 태그 — v 는 {열 이름: 최종 값}. 출처: 등록 회선이면 `등록 회선`·제출 서류 분류, 그리고 상태."""
    state = text(v.get("상태"))
    doc = doc_tag(v.get("제출 서류"))
    tags = ([REGISTERED] + ([doc, f"{REGISTERED} · {doc}"] if doc else [])) if state != NO_NUMBER else []
    return combos(text(v.get("구분")), tags + [state])
