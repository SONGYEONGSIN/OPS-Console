"""`_학교`·`_서류` 한 행의 값 — 출처 `build_xlsx.py` 의 school_records·check_records 를 옮겼다(규칙 원문 그대로).

출처와 다른 점(입력이 다르다):
- 팀즈 관리 자료(담당자·서비스·`book_note`)와 서류 PDF 대조(docs_check)는 이 레포에 없다. 그 칸은 사람 칸이라
  원본 값을 그대로 두고, `_학교` 제출 서류는 `_서류` 행의 서류 표시·제출 상태 칸에서 다시 만든다(출처 brief).
- 비고는 출처 memo(`; ` 결합) 중 지금 비고에 없는 조각만 ` / ` 로 덧붙인다(결정 6·Ruling 19). 출처가 `; ` 로 쓴
  비고를 다시 붙이지 않게 지금 비고는 ` / `·`; ` 둘 다로 나눠 본다. 지울 수 있는 건 `번호 없음` 조각뿐이다.
- 태그(T)는 그 행의 최종 값으로 만든다 — 사람이 고친 확인·담당자도 태그에 그대로 든다.
"""
from __future__ import annotations

from collections import Counter
from typing import Mapping, Sequence

from edits import append_only
from keys import school_key
from sejong import NO_NUMBER
from table_rows import combos, is_blank, text
from verify_table import NOTE_SEP, REMOVABLE_NOTE

STATES = ("일괄 등록", "추가 등록", "서류 미비")
BAD = "서류 미비"
CHECK = "확인 필요"
# 출처 docs_check.DOC_COLS — 10/15 세종 기준 대학 서류(열 순서). 표에 있는 열만 쓴다
DOC_COLS = ("신청서", "위임장", "이용증명원", "사업자등록증", "법인인감", "재직증명서", "신분증", "위탁계약서")
DONE_MARKS = ("O", "")
ALL_DONE, NO_DOC_CHECK = "모두 제출", "서류 확인 안 됨"  # 새 `_서류` 행 제출 상태 = verify_table.NEW_ROW_ALLOWED
REG_OK, REG_BAD = "등록 완료", "서류 미비 회선 있음"
EMPTY_DAY = "-"
_MEMO_SEP = "; "


def numbered(lines: Sequence[Mapping]) -> list[Mapping]:
    return [x for x in lines if x["state"] != NO_NUMBER]


def fmt_day(d) -> str:
    return d.strftime("%Y-%m-%d") if d else EMPTY_DAY


def school_sejong(lines: Sequence[Mapping]) -> dict[str, object]:
    """`_학교` 세종 열 — 등록 회선·일괄·추가·서류 미비·최근 등록일(date_fix 기준, 출처와 같다)."""
    nums = numbered(lines)
    cnt = Counter(x["state"] for x in nums)
    days = sorted(x["date_fix"] for x in nums if x["date_fix"])
    return {"등록 회선": len(nums), **{s: cnt.get(s, 0) for s in STATES},
            "최근 등록일": fmt_day(days[-1] if days else None)}


def doc_sejong(lines: Sequence[Mapping]) -> dict[str, object]:
    """`_서류` 세종 열 — 등록 회선·세종 등록 상태."""
    nums = numbered(lines)
    bad = sum(1 for x in nums if x["state"] == BAD)
    reg = NO_NUMBER if not nums else (f"{BAD} {bad}회선" if bad else REG_OK)
    return {"등록 회선": len(nums), "세종 등록 상태": reg}


def doc_category(state) -> str:
    s = text(state)
    return ALL_DONE if s == ALL_DONE else NO_DOC_CHECK if s == NO_DOC_CHECK else "미제출 있음"


def missing_docs(marks: Mapping[str, object]) -> list[str]:
    return [c for c in DOC_COLS if c in marks and text(marks[c]) not in DONE_MARKS]


def doc_brief(state, marks: Mapping[str, object]) -> str:
    """`_학교` 제출 서류 — 「2종 미제출 (법인인감, 신분증)」, 서류 이름은 미제출 있음일 때만."""
    names = missing_docs(marks)
    tail = f" ({', '.join(names)})" if doc_category(state) == "미제출 있음" and names else ""
    return text(state) + tail


def issue_names(targets) -> set[str]:
    """`_확인` 대상 → 학교명(첫 줄, ` (` 앞) — 출처 issue_names. 비교는 정규화 학교명으로."""
    return {school_key(text(t).split("\n")[0].split(" (")[0]) for t in targets if not is_blank(t)}


def school_check(name, lines: Sequence[Mapping], issues: set[str]) -> str:
    nums = numbered(lines)
    flagged = not nums or any(x["state"] == BAD for x in nums)
    return CHECK if school_key(name) in issues or flagged else ""


def _pieces(v) -> set[str]:
    return {p.strip() for part in text(v).split(NOTE_SEP) for p in part.split(_MEMO_SEP) if p.strip()}


def school_note(cur, lines: Sequence[Mapping]) -> str:
    """비고 — 번호가 있으면 `번호 없음` 조각만 지우고, 새 메모 조각만 덧붙인다."""
    nums = numbered(lines)
    parts = text(cur).split(NOTE_SEP)
    head = NOTE_SEP.join(p for p in parts if p.strip() != REMOVABLE_NOTE) if nums else text(cur)
    frags = sorted({x["memo"] for x in lines if x["memo"]} | {x["text"] for x in lines if x["text"]})
    frags = frags or ([] if nums else [NO_NUMBER])
    have = _pieces(head)
    return append_only(head, _MEMO_SEP.join(f for f in frags if f not in have), NOTE_SEP)


def _has(v) -> bool:
    return v not in (None, "", 0, "0")


def school_tags(v: Mapping[str, object]) -> list[str]:
    """`_학교` 태그 — v 는 {열 이름: 최종 값}."""
    kind = text(v.get("구분"))
    tags = ([] if _has(v.get("등록 회선")) else [NO_NUMBER]) + ([BAD] if _has(v.get(BAD)) else [])
    jp, pims = text(v.get("원서접수")) == "O", text(v.get("PIMS")) == "O"
    svc = (["원서접수"] if jp else []) + (["PIMS"] if pims else []) + ([] if jp or pims else ["서비스 미확인"])
    check = [CHECK] if text(v.get("확인")) == CHECK else []
    owner = text(v.get("담당자"))
    return combos(kind, tags + svc + check) + ([owner] if owner else [])


def doc_tags(v: Mapping[str, object]) -> list[str]:
    """`_서류` 태그 — v 는 {열 이름: 최종 값}."""
    cat = doc_category(v.get("제출 상태"))
    reg_text = text(v.get("세종 등록 상태"))
    reg = NO_NUMBER if reg_text == NO_NUMBER else REG_BAD if reg_text.startswith(BAD) else REG_OK
    missing = [c + " 미제출" for c in missing_docs(v)]
    return combos(text(v.get("구분")), [cat, reg, f"{reg} · {cat}"] + missing)
