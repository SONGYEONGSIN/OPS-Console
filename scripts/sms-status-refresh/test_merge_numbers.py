"""merge_numbers.py — `_번호` 보존 갱신(세종 순서로 다시 쓰고, 사람 칸은 같은 키의 원본 값).

표는 test_merge_schools.table 로 만든 verify_table.Table(fixtures_status 머리글, P 수식, T 태그)이고, 세종 회선은
sejong 레코드 모양을 손으로 만든다. 학교·번호는 전부 가짜다(`테스트대학교A`, `010-0000-0001`).
"""
import unittest

import edits
import fixtures_status as fs
import keys
import merge_numbers as mn
import test_merge_schools as tm
import test_verify_table as tvt
import verify_table as vt
from contract import StepFailure
from table_rows import combos, tag_cell

A, B, C, D = tvt.A, tvt.B, tvt.C, tm.D
SHEET = "_번호"
S = vt.COLUMNS.index("S")  # 머리글 없는 사람 칸(추가 검색 글자 자리)
K_SHARED_A, K_SHARED_C = f"{A}|010-0000-0009", f"{C}|010-0000-0009"  # 공유 번호 — 원문 키
DAY = "2026-11-12"


def numbers_table(records=None, extra=None) -> vt.Table:
    """`_번호` 원본 표 — extra 는 {행 번호(0부터): S 칸 값}."""
    t = tm.table(SHEET, tvt.numbers() if records is None else records)
    rows = [list(r) for r in t.rows]
    for i, v in (extra or {}).items():
        rows[i][S] = v
    return vt.Table(t.header, tuple(map(tuple, rows)), t.u_last)


def num_lines():
    """tvt.numbers() 와 같은 번호를 같은 순서로 — 바뀐 것이 없는 세종 리스트."""
    return [tm.line(A, "010-0000-0001"), tm.line(A, "010-0000-0002", "추가 등록"),
            tm.line(B, "010-0000-0003", "서류 미비"), tm.line(C, "010-0000-0009"),
            tm.line(A, "010-0000-0009", "추가 등록")]


def machine_own(records=None) -> edits.Ownership:
    """기준 판 = 원본 → 판정 칸이 기계(다시 계산)."""
    return edits.Ownership.from_baseline({SHEET: numbers_table(records)})


def run(lines=None, numbers=None, own=None, schs=None, dcs=None):
    numbers = numbers or numbers_table()
    schools, docs = tm.table("_학교", schs or tvt.schools()), tm.table("_서류", dcs or tvt.docs())
    return numbers, mn.merge_numbers(numbers, num_lines() if lines is None else lines, schools, docs,
                                     own or edits.Ownership())


def col(name):
    return tm.col(SHEET, name)


def cells(rows, name):
    return [r[col(name)] for r in rows]


def lost(meta):
    return [(r[2], r[3], r[4]) for r in meta if r[0] == vt.LOST]


class MergeNumbersTest(unittest.TestCase):
    def test_세종_순서와_No(self):
        lines = num_lines()
        lines = [lines[2]] + lines[:2] + lines[3:]
        _n, m = run(lines)
        self.assertEqual(cells(m.rows, "No"), [1, 2, 3, 4, 5])
        self.assertEqual(cells(m.rows, "학교명"), [B, A, A, C, A])
        self.assertEqual(cells(m.rows, "발신번호")[:2], ["010-0000-0003", "010-0000-0001"])
        self.assertEqual(cells(m.rows, "상태")[:2], ["서류 미비", "일괄 등록"])
        self.assertEqual(cells(m.rows, "등록일자")[0], "2026-01-02")
        self.assertEqual((m.added, m.removed), ((), ()))

    def test_하이픈이_달라도_메모를_옮긴다(self):
        # 번호가 하나뿐이면 키가 숫자라 하이픈이 달라도 같은 행이다
        lines = num_lines()
        lines[1] = tm.line(A, "01000000002", "추가 등록")
        _n, m = run(lines)
        self.assertEqual(cells(m.rows, "비고")[1], "메모 X / 번호 없음")
        self.assertEqual((m.added, m.removed), ((), ()))
        # 공유 번호는 원문 키 — 하이픈이 바뀌면 키가 바뀌지만 '학교 + 숫자' 로 짝을 찾아 비고를 옮긴다
        recs = tvt.numbers()
        recs[4] = {**recs[4], "note": "공유 메모"}
        lines = num_lines()[:3] + [tm.line(C, "01000000009"), tm.line(A, "010 0000 0009", "추가 등록")]
        numbers, m = run(lines, numbers=numbers_table(recs, extra={4: "s-a"}))
        self.assertEqual(m.rows[4][col("비고")], "공유 메모")
        self.assertEqual(m.rows[4][S], "")  # 새 키 행의 사람 칸은 빈칸(L_NEW) — 그 값은 못 옮김으로 남는다
        self.assertIn((K_SHARED_A, f"{A}|010 0000 0009"), m.decisions.moved)
        self.assertEqual(m.decisions.ambiguous, ())
        kb, ka = keys.number_keys(*[[(r[col("학교명")], r[col("발신번호")]) for r in t]
                                    for t in (numbers.rows, m.rows)])
        self.assertEqual(set(m.added), set(ka) - set(kb))
        self.assertEqual(set(m.removed), set(kb) - set(ka))

    def test_공유_번호는_학교별로(self):
        lines = num_lines() + [tm.line(A, "010-0000-0003", "추가 등록")]  # B 의 번호를 A 도 쓴다
        numbers, m = run(lines, numbers=numbers_table(extra={3: "s-c", 4: "s-a"}))
        self.assertEqual(len(m.rows), 6)
        self.assertEqual([(r[col("학교명")], r[S]) for r in m.rows[3:5]], [(C, "s-c"), (A, "s-a")])
        self.assertEqual(cells(m.rows, "구분")[2], "전문대학")
        self.assertEqual(m.added, (f"{A}|010-0000-0003",))
        self.assertEqual(m.removed, ())

    def test_빠진_번호_메모는_못_옮김(self):
        lines = [x for x in num_lines() if x["num"] != "010-0000-0002"]
        numbers = numbers_table(extra={1: "s-2"})
        _n, m = run(lines, numbers=numbers)
        self.assertEqual(m.removed, ("01000000002",))
        self.assertEqual(set(m.orphans), {("01000000002", "비고", "메모 X / 번호 없음"),
                                          ("01000000002", "S열", "s-2")})
        self.assertFalse(any("메모 X" in str(v) for r in m.rows for v in r))
        meta = edits.meta_rows(None, m.decisions.changes, edits.Ownership(), today=DAY)
        self.assertEqual(lost(meta), list(m.orphans))

    def test_짝이_둘이면_못_옮김(self):
        recs = tvt.numbers()
        recs[4] = {**recs[4], "note": "공유 메모"}
        lines = num_lines()[:4] + [tm.line(A, "01000000009"), tm.line(A, "010 0000 0009")]
        _n, m = run(lines, numbers=numbers_table(recs))
        self.assertEqual(m.removed, (K_SHARED_A,))
        self.assertEqual(m.decisions.ambiguous, (K_SHARED_A,))
        self.assertEqual(m.decisions.moved, ())
        self.assertFalse(any("공유 메모" in str(v) for r in m.rows for v in r))
        self.assertIn((K_SHARED_A, "비고", "공유 메모"), m.orphans)
        # 반대쪽 — 빠진 원본 둘이 새 행 하나를 두고 다투면 역시 옮기지 않는다
        recs2 = recs[:4] + [{**recs[4], "num": "01000000009"}, {**recs[4], "no": 6, "num": "010 0000 0009"}]
        lines2 = num_lines()[:4] + [tm.line(A, "010-0000-0009")]
        _n, m2 = run(lines2, numbers=numbers_table(recs2))
        self.assertEqual(len(m2.decisions.ambiguous), 2)
        self.assertNotIn("공유 메모", m2.rows[4][col("비고")])

    def test_구분은_학교_행을_따른다(self):
        schs = tvt.schools()
        schs[0] = {**schs[0], "kind": "대학원"}  # `_학교` 구분은 사람이 고칠 수 있다
        lines = num_lines()
        lines[2] = tm.line(B, "010-0000-0003", "서류 미비", univ=9002)  # kind() 로는 4년제
        lines.append(tm.line(D, "010-0000-0010"))  # `_학교` 에 없는 학교 → kind()
        _n, m = run(lines, schs=schs)
        self.assertEqual(cells(m.rows, "구분"), ["대학원", "대학원", "전문대학", "4년제", "대학원", "4년제"])
        self.assertIn("|대학원 · 일괄 등록|", m.rows[0][19])

    def test_제출_서류는_서류_행으로(self):
        base = tvt.numbers()
        base[0] = {**base[0], "docs": ""}  # 기준 판엔 비어 있었다 → 원본 '완료' 는 사람이 쓴 것
        dcs = tvt.docs()
        dcs[1] = {**dcs[1], "d1": "✕", "status": "1종 미제출"}
        dcs[2] = {**dcs[2], "status": "모두 제출"}
        lines = num_lines() + [tm.line(C, "", text="준비 중")]
        _n, m = run(lines, own=machine_own(base), dcs=dcs)
        self.assertEqual(cells(m.rows, "제출 서류"),
                         ["완료", "서류 보완 필요", "보완 필요: 신청서", "서류 모두 제출", "서류 보완 필요", ""])
        self.assertEqual(m.rows[5][col("발신번호")], "준비 중")
        self.assertIn((SHEET, "01000000001", "제출 서류"), m.decisions.kept)
        self.assertNotIn((SHEET, "01000000002", "제출 서류"), m.decisions.kept)
        # `_서류` 행을 못 찾으면 이어진 키는 원본 그대로(계산하지 못한 것을 빈칸으로 덮지 않는다)
        recs = tvt.numbers()
        recs[3] = {**recs[3], "docs": "완료"}
        _n, gone = run(num_lines(), numbers=numbers_table(recs), own=machine_own(recs), dcs=tvt.docs()[:2])
        self.assertEqual(gone.rows[3][col("제출 서류")], "완료")
        self.assertEqual(gone.decisions.no_doc, (K_SHARED_C,))

    def test_비고는_덧붙이기만(self):
        lines = num_lines()
        lines[1] = {**lines[1], "memo": "새 메모"}
        lines[3] = {**lines[3], "memo": "메모 C", "check": "확인 메모"}
        _n, m = run(lines, own=machine_own())
        self.assertEqual(cells(m.rows, "비고")[1:4], ["메모 X / 새 메모", "", "메모 C / 확인 메모"])
        lines[1] = {**lines[1], "memo": "메모 X"}  # 이미 있는 조각은 다시 안 붙는다
        _n, m = run(lines, own=machine_own())
        self.assertEqual(m.rows[1][col("비고")], "메모 X")
        _n, kept = run([{**lines[1], "memo": "새 메모"} if i == 1 else x for i, x in enumerate(lines)])
        self.assertEqual(kept.rows[1][col("비고")], "메모 X / 번호 없음")  # 사람 칸은 그대로
        # 메모 안의 `; ` 조각이 이미 다 있으면 붙이지 않는다(school_rows 와 같은 조각 판정)
        recs = tvt.numbers()
        recs[2] = {**recs[2], "note": "x / y"}
        lines[2] = {**lines[2], "memo": "x; y"}
        _n, semi = run(lines, numbers=numbers_table(recs), own=machine_own(recs))
        self.assertEqual(semi.rows[2][col("비고")], "x / y")

    def test_새_번호의_사람_칸은_빈칸(self):
        lines = num_lines() + [tm.line(A, "010-0000-0004", "추가 등록", memo="m4")]
        _n, m = run(lines, numbers=numbers_table(extra={0: "s-1"}))
        new = m.rows[-1]
        self.assertEqual(m.added, ("01000000004",))
        self.assertEqual((new[S], new[col("비고")], new[col("제출 서류")]), ("", "m4", "서류 보완 필요"))
        self.assertEqual(m.rows[0][S], "s-1")  # 이어진 키의 사람 칸은 원본 그대로

    def test_P_태그_타입(self):
        _n, m = run(num_lines() + [tm.line(D, "010-0000-0010")], own=machine_own())
        for i, r in enumerate(m.rows, start=2):
            self.assertEqual(r[15], fs.p_formula(tm.box(SHEET), i, len(fs.NUMBER_HEADS), tm.U_LAST))
            self.assertEqual(len(r), vt.WIDTH)
            for v in r:
                self.assertIsInstance(v, (str, int))
        tags = ["등록 회선", "서류 보완 필요", "등록 회선 · 서류 보완 필요", "일괄 등록"]
        self.assertEqual(m.rows[0][19], tag_cell(combos("4년제", tags)))
        self.assertEqual(m.rows[-1][19], tag_cell(combos("4년제", ["등록 회선", "일괄 등록"])))  # 서류 행 없음
        self.assertEqual(m.decisions.no_doc, ("01000000010",))

    def test_결정에_meta_rows_입력이_있다(self):
        numbers, m = run([x for x in num_lines() if x["num"] != "010-0000-0002"])
        self.assertEqual([(c.sheet, c.before, list(map(list, c.rows))) for c in m.decisions.changes],
                         [(SHEET, numbers, m.rows)])

    def test_모양이_다르면_실패(self):
        t = numbers_table()
        header = tuple(None if vt.base_name(h) == "비고" else h for h in t.header)
        with self.assertRaises(StepFailure) as e:
            run(numbers=vt.Table(header, t.rows, t.u_last))
        self.assertEqual(e.exception.code, "sheet_shape")

    def test_같은_입력으로_다시_돌리면_같다(self):
        recs = tvt.numbers()
        recs[4] = {**recs[4], "note": "공유 메모"}
        lines = [tm.line(A, "010-0000-0001", memo="p"), tm.line(B, "010-0000-0003", "서류 미비", memo="x; y"),
                 tm.line(C, "01000000009"), tm.line(A, "010 0000 0009", memo="x / y"), tm.line(D, "010-0000-0010")]
        numbers = numbers_table(recs, extra={0: "s-1", 1: "s-2"})
        own = machine_own(recs)
        runs, metas, old = [], [], None
        for _ in range(3):
            _n, m = run(lines, numbers=numbers, own=own)
            meta = edits.meta_rows(old, m.decisions.changes, own, today=DAY)
            runs.append(m.rows)
            metas.append(meta)
            own, old = edits.Ownership.from_meta(meta), meta
            numbers = vt.Table(numbers.header, tuple(map(tuple, m.rows)), numbers.u_last)
        self.assertEqual(runs[0][3][col("비고")], "공유 메모 / x / y")
        self.assertEqual(runs[0], runs[1])
        self.assertEqual(runs[1], runs[2])
        self.assertEqual(metas[0], metas[1])
        self.assertEqual(metas[1], metas[2])


if __name__ == "__main__":
    unittest.main()
