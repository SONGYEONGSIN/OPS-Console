"""숨김 시트 행을 잇는 키 — 검사(verify_table)와 PR-3b 계산이 같은 규칙을 쓴다.

계획서 '고정한 결정' 3:
- `_번호`: 번호 숫자(`~` 없음 · 8자리 이상 · **모든 쪽에서 1회**). 아니면 (정규화 학교명, 원문).
- `_학교`·`_서류`: 정규화 학교명. 겹치면 `+ 구분`.
- 정규화 = NFC · 공백 접기 · `NAME_FIX`.

'쪽' 은 비교하는 표 하나하나(원본·작업 사본·기준 판)다. 번호는 **쪽마다 따로** 센다 — 합쳐 세면 앞뒤에
한 번씩 있는 번호가 모두 2회가 된다. 어느 한 쪽에서라도 두 번 이상 나오는 번호는 모든 쪽에서 원문 키를
쓴다(쪽마다 키 모양이 갈리면 같은 행을 다른 행으로 본다). 그래도 겹치는 키는 나온 차례로 `#2`·`#3` 을
붙인다 — 엉뚱한 줄과 잇는 것보다, 순서가 바뀌면 다른 행으로 보는 편이 안전하다.
"""
from __future__ import annotations

import collections
import re
import unicodedata
from typing import Iterable, Sequence

# 출처 data.py — 세종 리스트 학교명 통일(같은 Univ 인데 이름만 다르게 들어간 줄)
NAME_FIX = {"한양대학교": "한양대학교(서울)"}
MIN_DIGITS = 8
_SPACE = re.compile(r"\s+")
_NOT_DIGIT = re.compile(r"\D")


def _text(v) -> str:
    return "" if v is None else str(v)


def school_key(name) -> str:
    """정규화 학교명 — NFC · 공백 접기 · NAME_FIX."""
    s = _SPACE.sub(" ", unicodedata.normalize("NFC", _text(name))).strip()
    return NAME_FIX.get(s, s)


def number_digits(raw) -> str | None:
    """번호 숫자 — `~`(범위)가 있거나 8자리 미만이면 None."""
    s = _text(raw)
    if "~" in s:
        return None
    d = _NOT_DIGIT.sub("", s)
    return d if len(d) >= MIN_DIGITS else None


def _dedupe(keys: Iterable[str]) -> list[str]:
    seen: collections.Counter[str] = collections.Counter()
    out = []
    for k in keys:
        seen[k] += 1
        out.append(k if seen[k] == 1 else f"{k}#{seen[k]}")
    return out


def number_keys(*sides: Sequence[tuple]) -> list[list[str]]:
    """쪽마다 (학교명, 번호 원문) 목록 → 쪽마다 키 목록(같은 순서)."""
    repeated: set[str] = set()
    for side in sides:
        counts = collections.Counter(d for _s, raw in side if (d := number_digits(raw)))
        repeated |= {d for d, n in counts.items() if n > 1}

    def one(school, raw) -> str:
        d = number_digits(raw)
        return d if d and d not in repeated else f"{school_key(school)}|{_text(raw).strip()}"

    return [_dedupe(one(s, r) for s, r in side) for side in sides]


def school_keys(*sides: Sequence[tuple]) -> list[list[str]]:
    """쪽마다 (학교명, 구분) 목록 → 쪽마다 키 목록. 어느 쪽에서든 겹치는 학교명은 모든 쪽에서 `학교명+구분`."""
    repeated: set[str] = set()
    for side in sides:
        counts = collections.Counter(school_key(n) for n, _k in side)
        repeated |= {k for k, n in counts.items() if n > 1}

    def one(name, kind) -> str:
        k = school_key(name)
        return f"{k}+{_text(kind).strip()}" if k in repeated else k

    return [_dedupe(one(n, k) for n, k in side) for side in sides]
