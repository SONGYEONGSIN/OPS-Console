"""merge_numbers 끝에서 끝까지 — 계산 rows 와 meta_rows 를 작업 사본에 써서 검사(verify_workbook)의 `_번호`·
못 옮김(verify_memos)·`_수정` 검사를 돌린다(test_merge_schools_verify 와 같은 방식).

원본·기준 판·작업 사본은 test_verify_table.build 로 같은 모양을 만든다. 계산 쪽은 원본을 openpyxl 로 읽어
merge_schools → merge_numbers 를 차례로 돌리고(실제 흐름), 작업 사본에는 `_번호` rows 를 A~T 에 그대로, `_수정` 은
meta_rows 를 숨김·맨 끝 시트에 쓴다(COM 이 하는 일). 픽스처에 섞은 것 — 이어진 키의 사람 칸(S) · 빠진 번호의 사람
비고·사람 칸 · 하이픈이 바뀐 공유 번호(보조 짝으로 비고를 옮김) · 사람이 고친 제출 서류 · 새 학교의 새 번호.
학교·번호는 전부 가짜다.
"""
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook

import edits
import keys
import merge_numbers as mn
import merge_schools as ms
import table_rows
import test_merge_schools as tm
import test_merge_schools_verify as tmv
import test_verify as tv
import test_verify_table as tvt
import verify
import verify_memos as vm
import verify_table as vt
from sejong import group_schools

SHEET = "_번호"
DAY = "2026-11-12"


def before_numbers():
    recs = tvt.numbers()
    recs[0] = {**recs[0], "extra": "s-1"}  # 이어지는 키의 사람 칸
    recs[1] = {**recs[1], "extra": "s-2"}  # 빠지는 번호의 사람 칸(비고는 기준 판과 달라 사람)
    recs[4] = {**recs[4], "note": "공유 메모", "extra": "s-a"}  # 하이픈이 바뀌는 공유 번호
    return recs


def baseline_numbers():
    recs = before_numbers()
    recs[0] = {**recs[0], "docs": ""}  # 원본 '완료' 는 사람이 쓴 것
    recs[1] = {**recs[1], "note": ""}  # 원본 비고는 사람이 쓴 것
    return recs


def write_meta(wb, meta):
    """`_수정` — 숨김·맨 끝, 칸 전부 텍스트(T13 COM 이 '@' 로 쓴다)."""
    ws = wb.create_sheet(vt.META_SHEET)
    ws.sheet_state = "hidden"
    ws.append(list(vt.META_HEADER))
    for r in meta:
        ws.append(list(r))


class MergeNumbersVerifyTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _merge(self, before: Path, baseline: Path):
        bwb = load_workbook(before)
        numbers, school, docs = (vt.read_table(bwb, s) for s in (SHEET, "_학교", "_서류"))
        lines = [tm.line(tvt.A, "010-0000-0001", memo="새 메모"), tm.line(tvt.B, "010-0000-0003", "서류 미비"),
                 tm.line(tvt.C, "01000000009"), tm.line(tvt.A, "010 0000 0009", "추가 등록"),
                 tm.line(tm.D, "010-0000-0010")]
        sm = ms.merge_schools(school, docs, group_schools(lines), (), edits.Ownership())
        merged = [vt.Table(t.header, tuple(map(tuple, rows)), t.u_last)
                  for t, rows in ((school, sm.school_rows), (docs, sm.doc_rows))]
        own = edits.Ownership.from_baseline({SHEET: vt.read_table(load_workbook(baseline), SHEET)})
        m = mn.merge_numbers(numbers, lines, *merged, own)
        return numbers, m, edits.meta_rows(None, m.decisions.changes, own, today=DAY)

    def test_계산_결과가_검사를_통과한다(self):
        before = tvt.build(self.dir / "before.xlsm", nums=before_numbers(), moa_rows=tv.OLD_MOA)
        baseline = tvt.build(self.dir / "baseline.xlsm", nums=baseline_numbers(), moa_rows=tv.OLD_MOA)
        numbers, m, meta = self._merge(before, baseline)

        def mutate(wb):
            tmv.write_rows(wb, SHEET, m.rows)
            tvt.resize(wb, SHEET, len(m.rows))
            write_meta(wb, meta)
        after = tvt.build(self.dir / "after.xlsm", nums=before_numbers(), mutate=mutate)
        sheets = [table_rows.table_payload(SHEET, numbers, m.rows, m.added, m.removed),
                  tvt.view_payload(after, SHEET),
                  {"kind": "summary", "sheet": tvt.SUMMARY, "rows": tvt.SUMMARY_ROWS, "links": {}, "merged": [],
                   "tips": {}, "styles": {}},
                  {"kind": "meta", "sheet": vt.META_SHEET, "rows": [list(r) for r in meta]}]
        checks = verify.verify_workbook(before, after, [tv.MOA, tv.PIMS] + sheets, module_hashes=tv.same_hashes,
                                        baseline=baseline)
        self.assertEqual(verify.failed_labels(checks), [])
        labels = {c.label for c in checks}
        for name in (vt.L_PERSON, vt.L_NEW, vt.L_KEYS, vt.L_NOTE, vt.L_DATA, vm.L_LOST_MEMOS):
            self.assertIn(vt.label(SHEET, name), labels)
        # 계산 쪽에서도 — 못 옮김 집합 = `_수정` 못 옮김 행, 키 = keys.number_keys, 옮긴 비고·사람 칸
        got = [(r[2], r[3], r[4]) for r in meta if r[0] == vt.LOST]
        self.assertEqual(got, list(m.orphans))
        self.assertIn(("01000000002", "비고", "메모 X / 번호 없음"), m.orphans)
        self.assertIn(("01000000002", "S열", "s-2"), m.orphans)
        self.assertEqual(m.rows[3][numbers.col("비고")], "공유 메모")
        self.assertEqual(m.rows[0][vt.COLUMNS.index("S")], "s-1")
        self.assertEqual(m.rows[0][numbers.col("제출 서류")], "완료")
        bt, at = vt.read_table(load_workbook(before), SHEET), vt.read_table(load_workbook(after), SHEET)
        kb, ka = keys.number_keys(*[[(r[bt.col("학교명")], r[bt.col("발신번호")]) for r in t.rows] for t in (bt, at)])
        self.assertEqual(set(m.added), set(ka) - set(kb))
        self.assertEqual(set(m.removed), set(kb) - set(ka))


if __name__ == "__main__":
    unittest.main()
