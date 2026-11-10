"""verify_view.py — 보기 시트(01~03)·`00. 요약`·`_수정` 검사.

숨김 표의 행 수가 바뀌면 보기 시트의 수식·조건부 서식·`/ N건` 이 새 행 수를 따라가야 한다(결정 1).
원본·작업 사본은 test_verify_table.build 모양에 `00. 요약`(맨 앞)·`04`+`_확인`(안 만지는 장)을 얹는다.
작업 사본의 보기 시트는 fixtures_status.resize_view(COM 이 하는 일)로 맞추고, 실패는 그 뒤에 일부러 망가뜨린다.
"""
import json
import tempfile
import unittest
from pathlib import Path

from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.cell.cell import MergedCell
from openpyxl.worksheet.hyperlink import Hyperlink

import fixtures_status as fs
import test_verify as tv
import test_verify_table as tt
import verify
import verify_table as vt
import verify_view as vv

SUMMARY = "00. 요약"
V1, V3 = "01. 학교별 현황", "03. 번호 목록"
D = "테스트대학교D"
SEARCH = {V1: ["G6"], "02. 서류별 현황": ["G6"], V3: ["D6"]}
CHECK_HEADS = [("No", 6, "C", "no"), ("유형", 10, "C", "kind"), ("대상", 20, "L", "name"), ("내용", 30, "L", "note")]
EDIT = ["기계", "_학교", tt.A, "확인", "확인함"]


def summary(sejong=3, missing=0):
    """요약 값(1행~)과 링크 — 0 칸엔 링크가 없다(결정 8)."""
    rows = [["SMS 발신번호 사전등록 현황: 요약"], ["▪ 기준 자료: 테스트 자료"], [],
            [f"■ 등록 현황 · {sejong}곳"], ["4년제", sejong - 1, "전문대학", 1], ["서류 미비", missing]]
    links = {"B5": f"{V1}!G6", "D5": f"{V1}!G6"}
    return rows, ({**links, "B6": f"{V3}!D6"} if missing else links)


def write_summary(wb, rows, links):
    """`00. 요약` 을 맨 앞에 만들거나 비우고 다시 쓴다 — 값만 + 시트 안 링크."""
    ws = wb[SUMMARY] if SUMMARY in wb.sheetnames else wb.create_sheet(SUMMARY, 0)
    for row in ws.iter_rows():
        for c in row:
            if not isinstance(c, MergedCell):  # 병합된 칸은 왼쪽 위만 값·링크를 가진다
                c.hyperlink, c.value = None, None
    for r, row in enumerate(rows, start=1):
        for c, v in enumerate(row, start=1):
            ws.cell(r, c).value = v
    for coord, loc in links.items():
        sheet, cell = loc.split("!")
        ws[coord].hyperlink = Hyperlink(ref=coord, location=f"'{sheet}'!{cell}")
    if "A1:I1" not in {str(m) for m in ws.merged_cells.ranges}:
        ws.merge_cells("A1:I1")


def base(wb):
    write_summary(wb, *summary())
    recs = [{"no": 1, "kind": "확인", "name": tt.A, "note": "메모 X", "tags": ["확인"]}]
    fs.search_sheet(wb, "04. 확인 필요", "_확인", CHECK_HEADS, recs, fs.picks_of(recs))


def school_d():
    sch = {**tt.school(4, D, "", 1), "apply": "", "pims": ""}
    doc = {"no": 4, "name": D, "kind": "4년제", "lines": 1, "state": "등록", "status": "서류 확인 안 됨",
           "pdf": None, "tags": ["4년제"]}
    return tt.schools() + [sch], tt.docs() + [doc]


def count_cell(ws):
    return next(c for row in ws.iter_rows(max_row=8) for c in row
                if isinstance(c.value, str) and c.value.startswith("=") and "건\"" in c.value)


class VerifyViewTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.before = tt.build(self.dir / "before.xlsm", moa_rows=tv.OLD_MOA, mutate=base)

    def tearDown(self):
        self._tmp.cleanup()

    def _after(self, name="after.xlsm", nums=None, schs=None, dcs=None, keep=(), sm=None, edits=None, extra=None):
        """keep 의 숨김 표는 보기 시트를 맞추지 않는다(옛 범위 그대로)."""
        def mutate(wb):
            base(wb)
            for hid, recs in (("_번호", nums or tt.numbers()), ("_학교", schs or tt.schools()),
                              ("_서류", dcs or tt.docs())):
                tt.rewrite(wb, hid, recs)
                if hid not in keep:
                    tt.resize(wb, hid, len(recs))
            write_summary(wb, *(sm or summary()))
            if edits is not None:
                tt.edits_sheet(edits)(wb)
            if extra is not None:
                extra(wb)
        return tt.build(self.dir / name, mutate=mutate)

    def _sheets(self, after, tables=None, sm=None, meta=None, views=True):
        hids = ("_번호", "_학교", "_서류")
        out = [tt.payload(self.before, after, s, **(tables or {}).get(s, {})) for s in hids]
        out += [tt.view_payload(after, s) for s in hids] if views else []
        rows, links = sm or summary()
        out.append({"kind": "summary", "sheet": SUMMARY, "rows": rows, "links": links, "searchCells": SEARCH})
        if meta is not None:
            out.append({"kind": "meta", "sheet": vt.META_SHEET, "rows": [r + ["", "2026-11-10"] for r in meta]})
        return out

    def _failed(self, after, sheets=None, **kw):
        checks = verify.verify_workbook(self.before, after, [tv.MOA, tv.PIMS] + (sheets or self._sheets(after, **kw)),
                                        module_hashes=tv.same_hashes, baseline=self.before)
        return verify.failed_labels(checks), checks

    def _grown(self, name="after.xlsm", **kw):
        schs, dcs = school_d()
        return self._after(name, nums=tt.changed_numbers(), schs=schs, dcs=dcs, **kw)

    _ADDED = {"_번호": {"added": ["01000000010"]}, "_학교": {"added": [D]}, "_서류": {"added": [D]}}

    def test_정상_갱신은_통과(self):
        sm = summary(sejong=4, missing=1)
        after = self._grown(sm=sm, edits=[EDIT])
        failed, checks = self._failed(after, tables=self._ADDED, sm=sm, meta=[EDIT])
        self.assertEqual(failed, [])
        self.assertEqual(len(checks), 27 + 1 + 3 * vt.CHECKS_PER_TABLE + 1 + 3 * vv.CHECKS_PER_VIEW
                         + vv.CHECKS_PER_SUMMARY + vv.CHECKS_PER_META)

    def test_뷰가_옛_범위를_보면_실패(self):
        # 01 을 안 맞추면 새 학교가 보기 화면에서 안 보인다 — 참조 범위·/ N건·행 수식이 모두 잡는다
        after = self._grown(keep=("_학교",))
        failed, _ = self._failed(after, tables=self._ADDED)
        self.assertEqual(failed, [vt.label(V1, x) for x in (vv.L_RANGE, vv.L_COUNT, vv.L_ROWS)])

        def old(cell_of, a, b):
            def edit(wb):
                c = cell_of(wb[V3])
                c.value = c.value.replace(a, b)
            return edit
        idx = f"{chr(64 + len(fs.NUMBER_HEADS) + 2)}9"  # 숨김 순번 열 — `_번호!$P$2:$P$N` 을 본다
        cases = (("건수", old(count_cell, "/ 6건", "/ 5건"), [vv.L_COUNT]),
                 ("순번", old(lambda ws: ws[idx], "$P$7", "$P$6"), [vv.L_RANGE]),
                 ("INDEX", old(lambda ws: ws["D10"], "D$7", "D$6"), [vv.L_RANGE]),
                 ("건수_범위", old(count_cell, "$P$7", "$P$6"), [vv.L_RANGE, vv.L_COUNT]))
        for tag, edit, expected in cases:
            after = self._grown(f"after-{tag}.xlsm", extra=edit)
            self.assertEqual(self._failed(after, tables=self._ADDED)[0], [vt.label(V3, x) for x in expected], tag)

    def test_CF_가_안_따라가면_실패(self):
        def old_cf(wb):
            ws = wb[V3]
            rules = [r for cf in ws.conditional_formatting for r in cf.rules]
            ws.conditional_formatting = ConditionalFormattingList()
            for r in rules:
                ws.conditional_formatting.add("E9:E13", r)  # 원본 5행 → 9~13행 그대로
        after = self._grown(extra=old_cf)
        self.assertEqual(self._failed(after, tables=self._ADDED)[0], [vt.label(V3, vv.L_CF)])

    def test_줄면_남은_수식_실패(self):
        nums = [r for r in tt.numbers() if r["num"] != "010-0000-0003"]
        gone = {"_번호": {"removed": ["01000000003"]}}
        self.assertEqual(self._failed(self._after(nums=nums), tables=gone)[0], [])
        # 맞추지 않으면 13행(옛 마지막 줄)의 수식이 빈 줄을 센다
        stale = self._after("after-stale.xlsm", nums=nums, keep=("_번호",))
        self.assertEqual(self._failed(stale, tables=gone)[0],
                         [vt.label(V3, x) for x in (vv.L_RANGE, vv.L_COUNT, vv.L_TAIL, vv.L_CF)])
        left = self._after("after-left.xlsm", nums=nums,
                           extra=lambda wb: setattr(wb[V3]["A13"], "value", '=IF($J13="","",1)'))
        failed, checks = self._failed(left, tables=gone)
        self.assertEqual(failed, [vt.label(V3, vv.L_TAIL)])
        self.assertIn("13행", {c.label: c for c in checks}[vt.label(V3, vv.L_TAIL)].detail)

    def test_요약_링크가_빠지면_실패(self):
        sm = summary(missing=1)
        dropped = (sm[0], {k: v for k, v in sm[1].items() if k != "B6"})
        failed, _ = self._failed(self._after(sm=dropped), sm=sm)
        self.assertEqual(failed, [vt.label(SUMMARY, vv.L_SUM_LINKS)])
        zero = summary()[0], {**summary()[1], "B6": f"{V3}!D6"}  # 0 칸에 링크
        self.assertEqual(self._failed(self._after("after-zero.xlsm", sm=zero), sm=zero)[0],
                         [vt.label(SUMMARY, vv.L_SUM_TARGET)])
        elsewhere = summary()[0], {**summary()[1], "B5": f"{V1}!A9"}  # 검색 칸이 아닌 곳
        self.assertEqual(self._failed(self._after("after-else.xlsm", sm=elsewhere), sm=elsewhere)[0],
                         [vt.label(SUMMARY, vv.L_SUM_TARGET)])
        failed, checks = self._failed(self._after("after-num.xlsm"), sm=summary(sejong=4))
        self.assertEqual(failed, [vt.label(SUMMARY, vv.L_SUM_DATA)])
        dumped = json.dumps([c.__dict__ for c in checks], ensure_ascii=False)
        for value in ("테스트", "등록 현황", "4년제"):
            self.assertNotIn(value, dumped)

    def test__수정_은_숨김_맨_끝(self):
        place = vt.label(vt.META_SHEET, vv.L_META_PLACE)
        visible = self._after(edits=[EDIT], extra=lambda wb: setattr(wb[vt.META_SHEET], "sheet_state", "visible"))
        self.assertIn(place, self._failed(visible, meta=[EDIT])[0])
        moved = self._after("after-moved.xlsm", edits=[EDIT],
                            extra=lambda wb: wb.move_sheet(vt.META_SHEET, offset=-1))
        self.assertIn(place, self._failed(moved, meta=[EDIT])[0])
        self.assertEqual(self._failed(self._after("after-ok.xlsm", edits=[EDIT]), meta=[EDIT])[0], [])

    def test__수정_은_이어_쓰고_텍스트(self):
        human = ["사람", "_번호", "01000000002", "비고", "메모 X"]
        self.before = tt.build(self.dir / "before-e.xlsm", moa_rows=tv.OLD_MOA,
                               mutate=lambda wb: (base(wb), tt.edits_sheet([EDIT])(wb)))
        ok = self._after("after-e.xlsm", edits=[EDIT, human])
        self.assertEqual(self._failed(ok, meta=[EDIT, human])[0], [])
        dropped = self._after("after-drop.xlsm", edits=[human])  # 원본 행을 지웠다
        self.assertEqual(self._failed(dropped, meta=[human])[0], [vt.label(vt.META_SHEET, vv.L_META_KEEP)])
        number = [*human[:2], 1000000002, *human[3:]]  # 텍스트 서식이 아니라 숫자로 바뀐 키
        typed = self._after("after-int.xlsm", edits=[EDIT, number])
        self.assertEqual(self._failed(typed, meta=[EDIT, number])[0], [vt.label(vt.META_SHEET, vv.L_META_TEXT)])

    def test_숨김_표에_보기_검사가_없으면_실패(self):
        after = self._after()
        self.assertEqual(self._failed(after, views=False)[0], [vv.L_VIEWS])


if __name__ == "__main__":
    unittest.main()
