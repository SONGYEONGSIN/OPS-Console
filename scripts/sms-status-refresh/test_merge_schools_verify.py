"""merge_schools 끝에서 끝까지 — 계산 결과를 작업 사본에 써서 검사(verify_workbook)의 `_학교`·`_서류` 검사를 돌린다.

원본·기준 판·작업 사본은 test_verify_table.build 로 같은 모양을 만들고 `_확인` 을 붙인다. 계산 쪽은 원본을
openpyxl 로 읽어 merge_schools 를 돌리고, 작업 사본에는 그 rows 를 숨김 표 A~T 에 그대로 쓴다(COM 이 하는 일).
payload 는 table_rows.table_payload 로 만든다. 픽스처에 섞은 것 — 새 학교 · 세종에서 빠진 학교 · 사람이 고친
확인(기준 판과 다름) · 기계 판정 칸 · 모르는 열(PDF 주소). 학교·번호·담당자는 전부 가짜다.
"""
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook

import edits
import keys
import merge_schools as ms
import table_rows
import test_merge_schools as tm
import test_verify as tv
import test_verify_table as tvt
import verify
import verify_table as vt
from sejong import group_schools

HIDS = ("_학교", "_서류")


def issues_sheet(wb):
    ws = wb.create_sheet("_확인")
    ws.sheet_state = "hidden"
    ws.append(["No", "유형", "대상", "내용", "근거", "할 일"])
    ws.append([1, "미제출", f"{tvt.B}\n010-0000-0003 (1회선)", "내용", "근거", "할 일"])


def write_rows(wb, hid, rows):
    """COM 이 하는 일 — 2행부터 A~T 를 덮고 남는 행은 비운다(U 는 안 건드린다). 빈 문자열은 빈 칸."""
    hs = wb[hid]
    for r in range(2, hs.max_row + 1):
        for c in range(1, vt.WIDTH + 1):
            hs.cell(r, c).value = None
    for i, row in enumerate(rows, start=2):
        for c, v in enumerate(row, start=1):
            hs.cell(i, c).value = None if v == "" else v


class MergeSchoolsVerifyTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def test_계산_결과가_검사를_통과한다(self):
        before = tvt.build(self.dir / "before.xlsm", moa_rows=tv.OLD_MOA, mutate=issues_sheet)
        base_rows = tvt.schools()
        base_rows[0] = {**base_rows[0], "check": ""}  # 원본 A 의 '확인함' 은 사람이 쓴 것
        baseline = tvt.build(self.dir / "baseline.xlsm", schs=base_rows, moa_rows=tv.OLD_MOA)
        bwb = load_workbook(before)
        school, docs = vt.read_table(bwb, "_학교"), vt.read_table(bwb, "_서류")
        own = edits.Ownership.from_baseline({"_학교": vt.read_table(load_workbook(baseline), "_학교")})
        lines = [x for x in tm.base_lines() if x["name"] != tvt.C] + \
            [tm.line(tvt.B, "010-0000-0006", "서류 미비"), tm.line(tm.D, "010-0000-0010")]
        m = ms.merge_schools(school, docs, group_schools(lines), ms.read_issues(bwb), own)

        def mutate(wb):
            issues_sheet(wb)
            for hid, rows in zip(HIDS, (m.school_rows, m.doc_rows)):
                write_rows(wb, hid, rows)
                tvt.resize(wb, hid, len(rows))
        after = tvt.build(self.dir / "after.xlsm", mutate=mutate)
        tables = [table_rows.table_payload(hid, t, rows, m.added[hid])
                  for hid, t, rows in zip(HIDS, (school, docs), (m.school_rows, m.doc_rows))]
        tables += [tvt.view_payload(after, hid) for hid in HIDS]
        tables += [{"kind": "summary", "sheet": tvt.SUMMARY, "rows": tvt.SUMMARY_ROWS, "links": {}, "merged": [],
                    "tips": {}, "styles": {}}]
        checks = verify.verify_workbook(before, after, [tv.MOA, tv.PIMS] + tables, module_hashes=tv.same_hashes,
                                        baseline=baseline)
        self.assertEqual(verify.failed_labels(checks), [])
        labels = {c.label for c in checks}
        for hid in HIDS:
            for name in (vt.L_PERSON, vt.L_NEW, vt.L_KEYS, vt.L_NOTE, vt.L_DATA):
                self.assertIn(vt.label(hid, name), labels)
        # 사람 칸 보존 · 새 학교 사람 칸 · 키 일치를 계산 쪽에서도 확인
        self.assertEqual(tm.cells(m.school_rows, "_학교", "확인"), ["확인함", "확인 필요", "확인 필요", ""])
        self.assertEqual(m.added, {"_학교": (tm.D,), "_서류": (tm.D,)})
        self.assertEqual(m.vanished, {"_학교": (tvt.C,), "_서류": (tvt.C,)})
        awb = load_workbook(after)
        for hid in HIDS:
            bt, at = vt.read_table(bwb, hid), vt.read_table(awb, hid)
            kb, ka = keys.school_keys(*[[(r[bt.col("학교명")], r[bt.col("구분")]) for r in t.rows] for t in (bt, at)])
            self.assertEqual(set(m.added[hid]), set(ka) - set(kb), hid)


if __name__ == "__main__":
    unittest.main()
