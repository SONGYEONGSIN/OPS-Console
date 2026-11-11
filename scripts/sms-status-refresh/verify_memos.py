"""업로드 전 검사 ③ — 옮기지 못한 메모(lostMemos).

숨김 표(`_번호`·`_학교`·`_서류`)를 다시 쓰다 보면 키가 빠진 행이 생긴다. 그 행의 사람 칸(비고·메모 등)에 값이
있었다면 새 표 어디에도 둘 곳이 없다 — 조용히 사라지지 않게 `_수정` 에 구분 `못 옮김` 행으로 남겨야 한다.
검사: 시트마다 **빠진 키의 사람 칸 중 값이 있던 칸 {(키, 열, 값)} == 이번에 이은 `_수정` 의 그 시트 `못 옮김` 행 {(키, 열, 값)}.**

T10 계약 — `못 옮김` 행은 **칸마다 하나**다(`_수정` 이 키·열·값을 한 행에 담는 스키마이므로 키당 한 행이 아니다):
- 키: `keys.number_keys`/`school_keys` 를 (원본, 작업 사본) 두 쪽으로 돌려 얻은 원본 쪽 키 문자열
  (공유 번호가 `학교|원문` 키로 바뀌면 그 키). 빠진 키는 이 키 기준으로만 센다.
- 열: 괄호 꼬리를 뗀 머리글(`제출 서류 (10/15 기준)` → `제출 서류`), 머리글이 없으면 `I열`. `_수정` 의 다른 구분과 같은 표기.
- 값: 원본 칸 값의 문자열(None → ""). 세 칸이 모두 같아야 한다 — 키·열·값 중 하나라도 틀리면 그 메모는 새 표 어디에도 없다.

- '이번에 이은' 행 = meta payload rows 중 원본 `_수정` 데이터 행 뒤의 것. 앞 행은 지난 실행의 기록이고
  원본 그대로인지는 verify_view 의 `L_META_KEEP` 이 본다.
- 사람 칸 판정은 verify_table 의 `L_KEYS` 상세('빠진 행 중 메모 있음')와 같은 함수(`removed_memo_cells`)다 —
  두 곳이 다르게 세면 한쪽만 통과하는 날이 온다. 기준 판정 열은 `Owners`(`_수정` 의 기계/사람 기록, 없으면 기준 판)가
  가른다: 기계가 쓴 값 그대로인 칸은 메모가 아니다.
- meta payload 가 없으면 `못 옮김` 행은 0 이다(메모가 있던 행이 빠졌다면 그 자체로 실패).

통합 문서는 openpyxl 로 읽기만 한다. detail 에는 건수만 — 셀 값·키는 싣지 않는다.
"""
from __future__ import annotations

import collections
from typing import Sequence

from verify import Check
from verify_table import LOST, META_SHEET, SPECS, Owners, keyed, label, read_table, removed_memo_cells, roles
from verify_view import meta_rows

L_LOST_MEMOS = "빠진 키의 메모 = _수정 '못 옮김' 행"
CHECKS_PER_LOST = 1  # 숨김 표 payload 마다


def _old_count(bwb) -> int:
    """원본 `_수정` 의 데이터 행 수(머리글 제외) — 없으면 0."""
    if META_SHEET not in bwb.sheetnames or not hasattr(bwb[META_SHEET], "iter_rows"):
        return 0
    return max(len(meta_rows(bwb[META_SHEET])) - 1, 0)


def _text(v) -> str:
    return "" if v is None else str(v)


def _new_lost(bwb, sheets: Sequence[dict]) -> dict[str, set[tuple[str, str, str]]]:
    """meta payload 중 이번에 이은 `못 옮김` 행의 {(키, 열, 값)} 를 시트별로 모은다."""
    meta = next((sd for sd in sheets if sd.get("kind") == "meta"), None)
    rows = list(meta.get("rows", [])) if meta else []
    out: dict[str, set[tuple[str, str, str]]] = collections.defaultdict(set)
    for r in rows[_old_count(bwb):]:
        if len(r) > 4 and r[0] == LOST:
            out[_text(r[1])].add((_text(r[2]), _text(r[3]), _text(r[4])))
    return out


def check_lost_memos(bwb, awb, sheets: Sequence[dict], owners: Owners | None) -> list[Check]:
    """숨김 표 payload 마다 하나. 규칙이 없거나 시트가 없는 payload 는 check_table 이 이미 실패시킨다."""
    new = _new_lost(bwb, sheets)
    out = []
    for sd in sheets:
        sheet = sd.get("sheet")
        if sd.get("kind") != "table" or sheet not in SPECS or sheet not in bwb.sheetnames or sheet not in awb.sheetnames:
            continue
        spec = SPECS[sheet]
        bt, at = read_table(bwb, sheet), read_table(awb, sheet)
        bkeys, akeys = keyed(spec, [bt, at])
        human = (owners or Owners()).human_fn(sheet, spec, bt, bkeys)
        want = removed_memo_cells(bt.header, roles(bt.header, spec), human, bt.rows, bkeys, akeys)
        got = new.get(sheet, set())
        out.append(Check(label(sheet, L_LOST_MEMOS), want == got,
                         f"메모 칸 {len(want)} / 못 옮김 행 {len(got)}, 빠짐 {len(want - got)}·더함 {len(got - want)}"))
    return out
