"""views.py — 01~03 보기 시트 payload(숨김 표 행 수를 따라가는 행 수식·범위 끝·`/ N건`·조건부 서식).

현황 파일 모양은 test_verify_table.build(가짜 값만)로 만든다. 결과 모양의 정본은 fixtures_status.resize_view
(COM 이 하는 일)이고, 마지막 통합 테스트는 payload 를 COM 처럼 적용한 작업 사본을 실제 verify 로 검사한다.
"""
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Font
from openpyxl.worksheet.hyperlink import Hyperlink

import fixtures_status as fs
import test_verify as tv
import test_verify_table as tt
import verify
from contract import StepFailure
from sheet_names import SUMMARY_SHEET, VIEW_OF
from views import view_payload

V1, V2, V3 = "01. 학교별 현황", "02. 학교별 제출 서류", "03. 번호 목록"
NOTE = ("▪ 기준 자료: 세종 「테스트 발번 리스트_261020.xlsx」 (2025-09 이후 등록한 번호만 있음), "
        "2026-10-20 작성, 2026-11-12 갱신")
SEARCH = {V1: "F6", V2: "E6", V3: "D6"}  # 픽스처 검색 칸(fixtures_status.box_span 의 시작 열)
PDF = "PDF 보기"


def many_schools(count):
    return [tt.school(i, f"테스트대학교{i:03d}", "op-a", 1) for i in range(1, count + 1)]


def add_pdf_column(wb):
    """02 에 손으로 붙인 열 — 숨김 `_서류` R(PDF 주소)을 순번 열 K 로 꺼내 링크로 보인다."""
    ws, last = wb[V2], len(tt.docs()) + 1
    ws["L8"] = PDF
    for r in range(fs.DATA_FIRST, fs.DATA_FIRST + last - 1):
        ws[f"L{r}"] = f'=IF($K{r}="","",HYPERLINK(INDEX(\'_서류\'!$R$2:$R${last},$K{r}),"{PDF}"))'


def drop_validations(wb):
    for view in VIEW_OF:
        wb[view].data_validations.dataValidation = []


def link_summary(cells):
    """요약에 보기 시트 링크를 단다 — cells = {요약 칸: "시트!셀"}."""
    def mutate(wb):
        ws = wb[SUMMARY_SHEET]
        for coord, loc in cells.items():
            sheet, cell = loc.split("!")
            ws[coord] = 1
            ws[coord].hyperlink = Hyperlink(ref=coord, location=f"'{sheet}'!{cell}", tooltip="tip")
    return mutate


def chain(*fns):
    def mutate(wb):
        for fn in fns:
            fn(wb)
    return mutate


def apply_view(wb, p):
    """COM 이 view payload 로 할 일 — 9행부터 비우고 행 수식, `/ N건`, 기준 자료 줄, 조건부 서식 범위."""
    ws = wb[p["sheet"]]
    for row in ws.iter_rows(min_row=fs.DATA_FIRST):
        for c in row:
            c.value = None
    for i, vals in enumerate(p["rowFormulas"]):
        for j, v in enumerate(vals, start=1):
            if v != "":
                ws.cell(fs.DATA_FIRST + i, j).value = v
    ws[p["countCell"]] = p["countFormula"]
    ws[p["sourceNote"]] = p["noteText"]
    moved = {c["range"]: c["newRange"] for c in p["cf"]}
    old, ws.conditional_formatting = ws.conditional_formatting, ConditionalFormattingList()
    for cf in old:
        for rule in cf.rules:
            ws.conditional_formatting.add(moved.get(str(cf.sqref), str(cf.sqref)), rule)


class ViewsTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _path(self, name="book.xlsm", **kw):
        return tt.build(self.dir / name, **kw)

    def _rows_by_resize(self, path, view, hid, heads, n, width, rules=()):
        """resize_view 가 같은 n 으로 쓴 9~n+8행 — payload rowFormulas 의 정본."""
        wb = load_workbook(path)
        fs.resize_view(wb, view, hid, heads, n, rules)
        return [["" if (v := wb[view].cell(r, c).value) is None else v for c in range(1, width + 1)]
                for r in range(fs.DATA_FIRST, fs.DATA_FIRST + n)]

    def _shape(self, path, view, n=4) -> StepFailure:
        with self.assertRaises(StepFailure) as cm:
            view_payload(load_workbook(path), view, VIEW_OF[view], n, NOTE)
        self.assertEqual(cm.exception.code, "view_shape")
        return cm.exception

    def test_한_줄_늘면_범위_k_건수가_따라간다(self):
        path = self._path(schs=many_schools(101))
        p = view_payload(load_workbook(path), V1, "_학교", 102, NOTE)
        self.assertEqual({k: p[k] for k in ("kind", "sheet", "source", "rows", "sourceNote", "noteText", "countCell")},
                         {"kind": "view", "sheet": V1, "source": "_학교", "rows": 102, "sourceNote": "A4",
                          "noteText": NOTE, "countCell": "L6"})
        self.assertEqual(p["countFormula"], '="검색 결과 "&COUNT(\'_학교\'!$P$2:$P$103)&" / 102건"')
        self.assertEqual(len(p["rowFormulas"]), 102)
        last = p["rowFormulas"][-1]  # 110행
        self.assertEqual(last[15], '=IFERROR(SMALL(\'_학교\'!$P$2:$P$103,102),"")')  # P 순번 k = 102
        self.assertEqual(last[0], '=IF($P110="","",INDEX(\'_학교\'!A$2:A$103,$P110)&"")')
        self.assertEqual(last[14], "")  # O 는 데이터 열과 순번 열 사이 빈 칸
        self.assertEqual(p["rowFormulas"], self._rows_by_resize(path, V1, "_학교", fs.SCHOOL_HEADS, 102, 16))
        self.assertEqual(p["cf"], [])  # 01 에는 조건부 서식이 없다
        self.assertEqual(p["searchCell"], "F6")

    def test_줄면_수식도_준다(self):
        path = self._path()  # `_번호` 5행
        p = view_payload(load_workbook(path), V3, "_번호", 4, NOTE)
        self.assertEqual(p["rows"], 4)
        self.assertEqual(p["countFormula"], '="검색 결과 "&COUNT(\'_번호\'!$P$2:$P$5)&" / 4건"')
        self.assertEqual(len(p["rowFormulas"]), 4)
        self.assertEqual(p["rowFormulas"][-1][9], '=IFERROR(SMALL(\'_번호\'!$P$2:$P$5,4),"")')  # J12
        self.assertEqual(p["rowFormulas"], self._rows_by_resize(path, V3, "_번호", fs.NUMBER_HEADS, 4, 10,
                                                                tt.RULES["_번호"]))
        self.assertEqual(p["cf"], [{"range": "E9:E13", "newRange": "E9:E12"}])

    def test_추가_열도_따라간다(self):
        path = self._path(mutate=add_pdf_column)
        p = view_payload(load_workbook(path), V2, "_서류", 5, NOTE)
        rows = p["rowFormulas"]
        self.assertEqual([len(r) for r in rows], [12] * 5)
        self.assertEqual(rows[-1][11], f'=IF($K13="","",HYPERLINK(INDEX(\'_서류\'!$R$2:$R$6,$K13),"{PDF}"))')
        self.assertEqual(rows[-1][9], "")  # J 빈 칸
        self.assertEqual(rows[0][0], '=IF($K9="","",INDEX(\'_서류\'!A$2:A$6,$K9)&"")')

    def test_검색_칸은_DV_없이_숨김_P_의_MATCH_에서(self):
        links = {"B2": f"{V1}!F6", "C2": f"{V2}!E6", "D2": f"{V3}!D6"}
        wb = load_workbook(self._path(mutate=chain(drop_validations, link_summary(links))))
        self.assertTrue(all(not wb[v].data_validations.dataValidation for v in VIEW_OF))
        for view, hid in VIEW_OF.items():
            self.assertEqual(view_payload(wb, view, hid, 4, NOTE)["searchCell"], SEARCH[view], view)

    def test_요약_링크가_다른_칸이면_view_shape(self):
        path = self._path(mutate=link_summary({"B2": f"{V1}!A1"}))
        self.assertIn(V1, self._shape(path, V1).detail)

    def test_P_의_MATCH_가_다른_시트면_view_shape(self):
        def other(wb):
            hs = wb["_학교"]
            for r in range(2, hs.max_row + 1):
                v = hs.cell(r, 16).value
                if isinstance(v, str):
                    hs.cell(r, 16).value = v.replace(f"'{V1}'!", f"'{V2}'!")
        self._shape(self._path(mutate=other), V1)

    def test_CF_끝이_옛_행_수가_아니면_view_shape(self):
        def stretch(wb):
            ws = wb[V3]
            ws.conditional_formatting = ConditionalFormattingList()
            ws.conditional_formatting.add("E9:E20", FormulaRule(formula=['E9="미비"'], font=Font(bold=True)))
        self.assertIn("E9:E20", self._shape(self._path(mutate=stretch), V3).detail)

    def test_건수_칸이_옛_모양이_아니면_view_shape(self):
        def count_of(ws):
            return next(c for row in ws.iter_rows(max_row=8) for c in row
                        if isinstance(c.value, str) and "건\"" in c.value)

        def wrong_n(wb):
            c = count_of(wb[V3])
            c.value = c.value.replace(" / 5건", " / 7건")

        def gone(wb):
            count_of(wb[V3]).value = None

        def twice(wb):
            wb[V3]["A7"] = count_of(wb[V3]).value
        for i, fn in enumerate((wrong_n, gone, twice)):
            self._shape(self._path(f"count-{i}.xlsm", mutate=fn), V3)

    def test_짝이_아니면_view_shape(self):
        with self.assertRaises(StepFailure) as cm:
            view_payload(load_workbook(self._path()), V1, "_서류", 3, NOTE)
        self.assertEqual(cm.exception.code, "view_shape")

    # ------------------------------------------------------------ 통합: payload → COM 처럼 적용 → verify
    def _verify_applied(self, tag, nums, schs, dcs, tables):
        before = self._path(f"before-{tag}.xlsm", moa_rows=tv.OLD_MOA, mutate=add_pdf_column)
        bwb, new = load_workbook(before), {"_번호": nums, "_학교": schs, "_서류": dcs}
        views = [view_payload(bwb, view, hid, len(new[hid]), NOTE) for view, hid in VIEW_OF.items()]

        def mutate(wb):
            add_pdf_column(wb)
            for hid, recs in new.items():
                tt.rewrite(wb, hid, recs)
            for p in views:
                apply_view(wb, p)
        after = self._path(f"after-{tag}.xlsm", mutate=mutate)
        sheets = [tt.payload(before, after, s, **tables.get(s, {})) for s in new] + views + \
            [{"kind": "summary", "sheet": SUMMARY_SHEET, "rows": tt.SUMMARY_ROWS, "links": {}, "merged": [],
              "tips": {}, "styles": {}}]
        checks = verify.verify_workbook(before, after, [tv.MOA, tv.PIMS] + sheets,
                                        module_hashes=tv.same_hashes, baseline=before)
        return verify.failed_labels(checks), [c.label for c in checks]

    def test_적용하면_verify_보기_검사를_통과한다_늘_때(self):
        d = "테스트대학교D"
        schs = tt.schools() + [{**tt.school(4, d, "", 1), "apply": "", "pims": ""}]
        dcs = tt.docs() + [{"no": 4, "name": d, "kind": "4년제", "lines": 1, "state": "등록",
                            "status": "서류 확인 안 됨", "pdf": None, "tags": ["4년제"]}]
        failed, labels = self._verify_applied("grow", tt.changed_numbers(), schs, dcs,
                                              {"_번호": {"added": ["01000000010"]}, "_학교": {"added": [d]},
                                               "_서류": {"added": [d]}})
        self.assertEqual(failed, [])
        self.assertEqual(sum(1 for lb in labels if lb.split(": ", 1)[0] in VIEW_OF), 3 * 6)

    def test_적용하면_verify_보기_검사를_통과한다_줄_때(self):
        nums = [r for r in tt.numbers() if r["num"] != "010-0000-0003"]
        failed, _labels = self._verify_applied("shrink", nums, tt.schools(), tt.docs(),
                                               {"_번호": {"removed": ["01000000003"]}})
        self.assertEqual(failed, [])


if __name__ == "__main__":
    unittest.main()
