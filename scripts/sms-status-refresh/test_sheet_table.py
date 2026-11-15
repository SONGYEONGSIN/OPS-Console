"""sheet_table.py — PR-3b 가 다시 쓰기 전에 현황 파일 모양을 본다.

숨김 표의 사람 칸은 COM 이 문자열·숫자로만 옮긴다(Ruling 13) — 수식·날짜·bool 이 든 칸은 옮기면 모양이
바뀌므로 쓰기 전에 `sheet_shape` 로 멈춘다. 보기 시트 행 수식이 하나의 템플릿에 안 맞으면 새 행을 찍을 수
없으므로 `view_shape`. 현황 파일 모양은 test_verify_table.build(가짜 값만)로 만든다.
"""
import datetime
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

import fixtures_status as fs
import test_verify_table as tt
import verify_table as vt
from contract import FAILURE_CODES, StepFailure
from formula_template import render
from sheet_names import SUMMARY_SHEET, VIEW_OF
from sheet_table import check_shape, check_targets, read_edits

NEW_CODES = ("baseline_missing", "sheet_shape", "view_shape")


class SheetTableTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)

    def tearDown(self):
        self._tmp.cleanup()

    def _wb(self, name="book.xlsm", **kw):
        return load_workbook(tt.build(self.dir / name, **kw))

    def _code(self, fn, *args) -> StepFailure:
        with self.assertRaises(StepFailure) as cm:
            fn(*args)
        return cm.exception

    # ------------------------------------------------------------ 시트 맵·코드
    def test_시트_맵은_실파일_이름(self):
        # 출처 build_xlsx.py 의 S_SCHOOL·S_CHK·S_NUM — 02 는 '학교별 제출 서류'
        self.assertEqual(VIEW_OF, {"01. 학교별 현황": "_학교", "02. 학교별 제출 서류": "_서류",
                                   "03. 번호 목록": "_번호"})
        self.assertEqual(SUMMARY_SHEET, "00. 요약")
        self.assertEqual({name: hid for hid, (name, _h) in tt.VIEWS.items()}, VIEW_OF)  # 픽스처도 같은 이름

    def test_새_실패_코드는_계약에_있다(self):
        for code in NEW_CODES:
            self.assertIn(code, FAILURE_CODES)
            self.assertEqual(StepFailure(code).code, code)

    # ------------------------------------------------------------ check_shape
    def test_사람_칸_수식은_sheet_shape(self):
        wb = self._wb(mutate=lambda w: setattr(w["_학교"]["F3"], "value", "=1+1"))  # F 담당자 = 사람 열
        e = self._code(check_shape, vt.read_table(wb, "_학교"), "_학교")
        self.assertEqual(e.code, "sheet_shape")
        self.assertIn("F", e.detail)
        self.assertNotIn("=1+1", e.detail)
        # 기준 판정 열(사람이 고쳤을 수 있다)도 옮기는 칸이다
        wb = self._wb("judged.xlsm", mutate=lambda w: setattr(w["_학교"]["M2"], "value", "=A2"))
        self.assertEqual(self._code(check_shape, vt.read_table(wb, "_학교"), "_학교").code, "sheet_shape")

    def test_사람_칸_날짜_bool_은_sheet_shape(self):
        for cell, value in (("F2", datetime.datetime(2026, 1, 2)), ("F3", True)):
            wb = self._wb(f"t-{cell}.xlsm", mutate=lambda w, c=cell, v=value: setattr(w["_서류"][c], "value", v))
            self.assertEqual(self._code(check_shape, vt.read_table(wb, "_서류"), "_서류").code, "sheet_shape", cell)

    def test_세종_열·P·T·U_는_사람_칸_아님(self):
        def mutate(w):
            w["_학교"]["K2"].value = datetime.datetime(2026, 1, 9)  # 최근 등록일 — 다시 계산하는 세종 열
            w["_학교"]["U9"].value = True  # U 는 읽지도 쓰지도 않는다
        wb = self._wb(mutate=mutate)
        check_shape(vt.read_table(wb, "_학교"), "_학교")

    def test_못_찾은_열은_sheet_shape(self):
        wb = self._wb(mutate=lambda w: setattr(w["_학교"]["M1"], "value", "확인 여부"))
        e = self._code(check_shape, vt.read_table(wb, "_학교"), "_학교")
        self.assertEqual(e.code, "sheet_shape")
        self.assertEqual(self._code(check_shape, vt.read_table(wb, "_학교"), "_모름").code, "sheet_shape")

    def test_정상_표는_P_템플릿을_돌려준다(self):
        wb = self._wb()
        t = check_shape(vt.read_table(wb, "_번호"), "_번호")
        box = f"'03. 번호 목록'!${get_column_letter(fs.box_span([w for _h, w, *_ in fs.NUMBER_HEADS])[0])}$6"
        u_last = len(fs.picks_of(tt.numbers())) + 1
        self.assertEqual(render(t, 7, 7), fs.p_formula(box, 7, len(fs.NUMBER_HEADS), u_last))

    def test_P_한_행이_다르면_sheet_shape(self):
        wb = self._wb(mutate=lambda w: setattr(w["_번호"]["P4"], "value", '=IF(TRUE,3,"")'))
        e = self._code(check_shape, vt.read_table(wb, "_번호"), "_번호")
        self.assertEqual((e.code, "4행" in e.detail), ("sheet_shape", True))

    # ------------------------------------------------------------ read_edits
    def test_수정_시트가_없으면_None(self):
        self.assertIsNone(read_edits(self._wb()))

    def test_수정_행은_머리글_빼고_A_G_문자열(self):
        rows = [["기계", "_학교", tt.A, "확인", "확인함"], ["사람", "_번호", 1000000001, "비고", None]]

        def mutate(w):
            tt.edits_sheet(rows)(w)
            w[vt.META_SHEET].append([None] * 7)  # 끝 빈 행은 뗀다
        got = read_edits(self._wb(mutate=mutate))
        self.assertEqual(got, [("기계", "_학교", tt.A, "확인", "확인함", "", "2026-11-10"),
                               ("사람", "_번호", "1000000001", "비고", "", "", "2026-11-10")])

    def test_수정_머리글이_다르면_sheet_shape(self):
        def mutate(w):
            tt.edits_sheet([])(w)
            w[vt.META_SHEET]["F1"].value = "메모"
        self.assertEqual(self._code(read_edits, self._wb(mutate=mutate)).code, "sheet_shape")

    # ------------------------------------------------------------ check_targets
    def test_정상_파일은_보기_시트마다_템플릿(self):
        got = check_targets(self._wb())
        self.assertEqual(list(got), list(VIEW_OF))
        t = got["01. 학교별 현황"]["A"]  # 숨김 _학교 3행(2~4) — 새 표 5행이면 끝은 6
        self.assertEqual(render(t, 13, 6), '=IF($P13="","",INDEX(\'_학교\'!A$2:A$6,$P13)&"")')

    def test_시트가_없으면_view_shape(self):
        for gone in (SUMMARY_SHEET, "02. 학교별 제출 서류", "_번호"):
            wb = self._wb(f"gone-{gone[:2]}.xlsm", mutate=lambda w, g=gone: w.remove(w[g]))
            e = self._code(check_targets, wb)
            self.assertEqual(e.code, "view_shape", gone)

    def test_보기_행_수식이_한_행만_달라도_view_shape(self):
        wb = self._wb(mutate=lambda w: setattr(w["03. 번호 목록"]["B11"], "value", "=1"))
        e = self._code(check_targets, wb)
        self.assertEqual(e.code, "view_shape")
        self.assertIn("03. 번호 목록", e.detail)

    def test_숨김_표만_늘고_보기가_옛_범위면_view_shape(self):
        more = tt.schools() + [tt.school(4, "테스트대학교D", "", 1)]
        wb = self._wb(mutate=lambda w: tt.rewrite(w, "_학교", more))
        self.assertEqual(self._code(check_targets, wb).code, "view_shape")


if __name__ == "__main__":
    unittest.main()
