"""edits.py — 사람 칸 기준(Ownership)·`_수정` 기록 행(meta_rows)·비고 덧붙이기(append_only).

판정은 검사(verify_table.Owners)와 한 벌이어야 한다. 그래서 표는 verify_table.Table 을 그대로 쓰고,
마지막 테스트는 meta_rows 출력을 검사 쪽(verify_memos)에 그대로 넣어 본다. 번호·학교는 전부 가짜다.
"""
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook

import edits
import test_verify as tv
import test_verify_table as tt
import test_verify_view as tvv
import verify_memos as vm
import verify_table as vt

A, B = "테스트대학교A", "테스트대학교B"
SHEET = "_번호"
HEAD = ("No", "학교명", "구분", "발신번호", "상태", "등록일자", "제출 서류 (10/15 기준)", "비고")
K1, K2, K3 = "01000000001", "01000000002", "01000000003"
DAY = "2026-11-11"


def row(no, name, number, docs="", note=""):
    return (no, name, "4년제", number, "일괄", "2026-01-02", docs, note)


def table(*rows) -> vt.Table:
    return vt.Table(HEAD, tuple(rows), 1)


ORIG = table(row(1, A, "010-0000-0001", docs="완료"), row(2, A, "010-0000-0002", note="메모 X"),
             row(3, B, "010-0000-0003"))


def bound(own: edits.Ownership, before: vt.Table, after: vt.Table) -> edits.Ownership:
    bkeys, _a = vt.keyed(vt.SPECS[SHEET], [before, after])
    return own.bind(SHEET, before, bkeys)


def by_kind(rows, kind):
    return {(r[2], r[3]): r[4] for r in rows if r[0] == kind and r[1] == SHEET}


class OwnershipTest(unittest.TestCase):
    def test_기준과_다르면_사람(self):
        base = table(row(1, A, "010-0000-0001", docs="미완료"), row(2, A, "010-0000-0002", note="메모 X"),
                     row(3, B, "010-0000-0003"))
        own = bound(edits.Ownership.from_baseline({SHEET: base}), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", "완료"), vt.HUMAN)  # 기준과 다르다
        self.assertEqual(own.owner(SHEET, K2, "비고", "메모 X"), vt.MACHINE)  # 기준과 같다
        self.assertEqual(own.owner(SHEET, K3, "제출 서류", ""), vt.MACHINE)  # 둘 다 빈칸
        self.assertEqual(own.owner(SHEET, K3, "제출 서류", None), vt.MACHINE)  # 빈 문자열 = 빈 칸

    def test_기준_판은_타입까지_본다(self):
        base = table(row(1, A, "010-0000-0001", docs=1), row(2, A, "010-0000-0002"), row(3, B, "010-0000-0003"))
        own = bound(edits.Ownership.from_baseline({SHEET: base}), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", "1"), vt.HUMAN)  # "1" ≠ 1

    def test_기준에_없으면_사람(self):
        base = table(row(1, A, "010-0000-0001", docs="완료"))  # 2·3번 번호가 기준 판에 없다
        own = bound(edits.Ownership.from_baseline({SHEET: base}), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", "완료"), vt.MACHINE)
        self.assertEqual(own.owner(SHEET, K3, "제출 서류", ""), vt.HUMAN)  # 행이 없다
        no_col = vt.Table(HEAD[:6] + ("비고",), (row(1, A, "010-0000-0001")[:6] + ("",),), 1)
        own = bound(edits.Ownership.from_baseline({SHEET: no_col}), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", "완료"), vt.HUMAN)  # 열이 없다
        own = bound(edits.Ownership.from_baseline({}), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "비고", ""), vt.HUMAN)  # 시트가 없다
        self.assertEqual(bound(edits.Ownership(), ORIG, ORIG).owner(SHEET, K1, "비고", ""), vt.HUMAN)

    def test_수정_기록은_문자열로_비교하고_기계_행이_없으면_사람(self):
        meta = [(vt.MACHINE, SHEET, K1, "제출 서류", "1", "", DAY)]
        own = bound(edits.Ownership.from_meta(meta), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", 1), vt.MACHINE)  # str 비교 — 1 → "1"
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", "2"), vt.HUMAN)
        self.assertEqual(own.owner(SHEET, K1, "비고", ""), vt.HUMAN)  # 기계 행이 없다

    def test_한번_사람이면_계속(self):
        meta = [(vt.MACHINE, SHEET, K1, "제출 서류", "완료", "", DAY),
                (vt.HUMAN, SHEET, K1, "제출 서류", "완료", "", DAY)]
        own = bound(edits.Ownership.from_meta(meta), ORIG, ORIG)
        self.assertEqual(own.owner(SHEET, K1, "제출 서류", "완료"), vt.HUMAN)  # 기계 값과 같아도 사람
        # 다음 실행: 이미 사람으로 굳은 칸은 사람 행을 다시 쓰지 않는다 — 그래도 판정은 계속 사람
        rows = edits.meta_rows(meta, [edits.Change(SHEET, ORIG, ORIG.rows)], edits.Ownership.from_meta(meta), today=DAY)
        self.assertEqual(rows[:2], [tuple(r) for r in meta])
        self.assertNotIn((K1, "제출 서류"), by_kind(rows[2:], vt.HUMAN))
        again = bound(edits.Ownership.from_meta(rows), ORIG, ORIG)
        self.assertEqual(again.owner(SHEET, K1, "제출 서류", "완료"), vt.HUMAN)

    def test_첫_실행에_기준과_다른_칸은_사람_행으로_굳는다(self):
        base = table(row(1, A, "010-0000-0001", docs="미완료"), row(2, A, "010-0000-0002", note="메모 X"),
                     row(3, B, "010-0000-0003"))
        rows = edits.meta_rows(None, [edits.Change(SHEET, ORIG, ORIG.rows)],
                               edits.Ownership.from_baseline({SHEET: base}), today=DAY)
        self.assertEqual(by_kind(rows, vt.HUMAN), {(K1, "제출 서류"): "완료"})
        nxt = bound(edits.Ownership.from_meta(rows), ORIG, ORIG)
        self.assertEqual(nxt.owner(SHEET, K1, "제출 서류", "완료"), vt.HUMAN)

    def test_판정은_검사의_Owners_와_같다(self):
        meta = [(vt.MACHINE, SHEET, K1, "제출 서류", "완료", "", DAY), (vt.HUMAN, SHEET, K2, "비고", "", "", DAY)]
        bkeys, _a = vt.keyed(vt.SPECS[SHEET], [ORIG, ORIG])
        check = vt.Owners(edits=vt.edits_index(meta)).human_fn(SHEET, vt.SPECS[SHEET], ORIG, bkeys)
        own = edits.Ownership.from_meta(meta).bind(SHEET, ORIG, bkeys)
        for k in (K1, K2, K3):
            for col, v in (("제출 서류", "완료"), ("제출 서류", ""), ("비고", "메모 X"), ("비고", "")):
                self.assertEqual(own.owner(SHEET, k, col, v) == vt.HUMAN, check(k, col, v), (k, col, v))

    def test_묶지_않은_시트는_판정하지_않는다(self):
        with self.assertRaises(ValueError):
            edits.Ownership.from_meta([]).owner(SHEET, K1, "비고", "")


class MetaRowsTest(unittest.TestCase):
    def test_첫_실행은_판정_칸_전부_기계_행(self):
        rows = edits.meta_rows(None, [edits.Change(SHEET, ORIG, ORIG.rows)],
                               edits.Ownership.from_baseline({SHEET: ORIG}), today=DAY)
        want = {(k, c) for k in (K1, K2, K3) for c in ("제출 서류", "비고")}  # 빈 값 포함 6칸
        self.assertEqual(set(by_kind(rows, vt.MACHINE)), want)
        self.assertEqual(by_kind(rows, vt.MACHINE)[(K3, "비고")], "")
        # 그것을 `_수정` 으로 다시 읽으면 같은 값은 기계다 — 빈 칸도
        nxt = bound(edits.Ownership.from_meta(rows), ORIG, ORIG)
        for k, i in vt.keyed(vt.SPECS[SHEET], [ORIG, ORIG])[0].items():
            for col, c in (("제출 서류", 6), ("비고", 7)):
                self.assertEqual(nxt.owner(SHEET, k, col, ORIG.rows[i][c]), vt.MACHINE, (k, col))

    def test_행_모양은_A_G_일곱_칸_전부_문자열(self):
        rows = edits.meta_rows(None, [edits.Change(SHEET, ORIG, ORIG.rows[:2])],
                               edits.Ownership.from_baseline({SHEET: ORIG}), today=DAY)
        self.assertTrue(rows)
        for r in rows:
            self.assertEqual(len(r), len(vt.META_HEADER))
            self.assertTrue(all(isinstance(v, str) for v in r), r)
            self.assertEqual(r[6], DAY)
        with self.assertRaises(ValueError):
            edits.meta_rows(None, [], edits.Ownership(), today="2026/11/11")

    def test_기계_값이_바뀐_칸만_새_기계_행(self):
        meta = edits.meta_rows(None, [edits.Change(SHEET, ORIG, ORIG.rows)],
                               edits.Ownership.from_baseline({SHEET: ORIG}), today=DAY)
        after = (row(1, A, "010-0000-0001", docs="미완료"),) + ORIG.rows[1:]
        rows = edits.meta_rows(meta, [edits.Change(SHEET, ORIG, after)], edits.Ownership.from_meta(meta), today=DAY)
        self.assertEqual(rows[:len(meta)], meta)
        self.assertEqual(rows[len(meta):], [(vt.MACHINE, SHEET, K1, "제출 서류", "미완료", edits.REASON[vt.MACHINE], DAY)])
        later = bound(edits.Ownership.from_meta(rows), table(*after), table(*after))
        self.assertEqual(later.owner(SHEET, K1, "제출 서류", "미완료"), vt.MACHINE)  # 마지막 기계 행이 이긴다

    def test_새_키의_판정_칸은_기계_행(self):
        after = ORIG.rows + (row(4, B, "010-0000-0004", docs="완료"),)
        rows = edits.meta_rows([], [edits.Change(SHEET, ORIG, after)], edits.Ownership.from_meta([]), today=DAY)
        self.assertEqual(by_kind(rows, vt.MACHINE)[("01000000004", "제출 서류")], "완료")

    def test_못_옮김은_이어_간다(self):
        # 1회차: 2번 번호가 빠졌다 — 사람 칸 비고(기준 판에선 빈칸)를 `못 옮김` 으로 남긴다
        base = table(row(1, A, "010-0000-0001", docs="완료"), row(2, A, "010-0000-0002"),
                     row(3, B, "010-0000-0003"))
        after = (ORIG.rows[0], ORIG.rows[2])
        first = edits.meta_rows(None, [edits.Change(SHEET, ORIG, after)],
                                edits.Ownership.from_baseline({SHEET: base}), today="2026-11-10")
        lost = [r for r in first if r[0] == vm.LOST]
        self.assertEqual(lost, [(vm.LOST, SHEET, K2, "비고", "메모 X", edits.REASON[vm.LOST], "2026-11-10")])
        # 2회차: 원본 `_수정` 의 못 옮김 행이 그대로 앞에 남는다
        second = edits.meta_rows(first, [edits.Change(SHEET, table(*after), after)],
                                 edits.Ownership.from_meta(first), today=DAY)
        self.assertEqual(second[:len(first)], first)
        self.assertEqual([r for r in second if r[0] == vm.LOST], lost)

    def test_못_옮김_구분은_검사와_같은_상수(self):
        self.assertIs(edits.LOST, vm.LOST)


class AppendOnlyTest(unittest.TestCase):
    def test_새_조각만_붙인다(self):
        self.assertEqual(edits.append_only("A / 메모", "A / 새", " / "), "A / 메모 / 새")
        self.assertEqual(edits.append_only("A / 메모", "메모", " / "), "A / 메모")
        self.assertEqual(edits.append_only("", "A / 새", " / "), "A / 새")
        self.assertEqual(edits.append_only(None, None, " / "), "")
        self.assertEqual(edits.append_only("A", "새 / 새", " / "), "A / 새")
        self.assertEqual(edits.append_only(" A /  메모", "새", " / "), " A /  메모 / 새")  # 지금 조각은 한 글자도 안 바꾼다

    def test_세미콜론_결합은_한_조각(self):
        self.assertEqual(edits.append_only("A; B", "A; B / C", " / "), "A; B / C")
        self.assertEqual(edits.append_only("A", "A; B", " / "), "A / A; B")


class MetaRowsAgainstVerifyTest(unittest.TestCase):
    """6b LOW-1 — 같은 실행에서 이은 `기계`·`사람` 행은 verify_memos 가 `못 옮김` 으로 세지 않는다."""

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_meta_rows_출력으로_못_옮김_검사가_통과한다(self):
        before = tt.build(self.dir / "before.xlsm", moa_rows=tv.OLD_MOA, mutate=tvv.base)
        differ = tt.numbers()  # 1번 제출 서류·2번 비고가 기준 판에선 빈칸 → 둘 다 사람 칸
        differ[0], differ[1] = {**differ[0], "docs": ""}, {**differ[1], "note": ""}
        base_path = tt.build(self.dir / "base.xlsm", nums=differ, moa_rows=tv.OLD_MOA, mutate=tvv.base)
        nums = [r for r in tt.numbers() if r["num"] != "010-0000-0002"]

        def mutate(wb):
            tvv.base(wb)
            tt.rewrite(wb, SHEET, nums)
            tt.resize(wb, SHEET, len(nums))
        after = tt.build(self.dir / "after.xlsm", mutate=mutate)
        bwb, awb, base_wb = (load_workbook(p) for p in (before, after, base_path))
        tables = {s: vt.read_table(base_wb, s) for s in ("_번호", "_학교")}
        changes = [edits.Change(s, vt.read_table(bwb, s), vt.read_table(awb, s).rows) for s in ("_번호", "_학교", "_서류")]
        meta = edits.meta_rows(None, changes, edits.Ownership.from_baseline(tables), today=DAY)
        self.assertTrue(by_kind(meta, vt.MACHINE))
        self.assertEqual(by_kind(meta, vt.HUMAN), {(K1, "제출 서류"): "완료"})
        self.assertEqual(by_kind(meta, vt.LOST), {(K2, "비고"): "메모 X / 번호 없음"})
        sheets = [tt.payload(before, after, s, removed=[K2] if s == SHEET else []) for s in ("_번호", "_학교", "_서류")]
        sheets.append({"kind": "meta", "sheet": vt.META_SHEET, "rows": [list(r) for r in meta]})
        checks = vm.check_lost_memos(bwb, awb, sheets, vt.Owners(baseline=tables))
        self.assertEqual(len(checks), 3)
        self.assertEqual([c.label for c in checks if not c.ok], [])


if __name__ == "__main__":
    unittest.main()
