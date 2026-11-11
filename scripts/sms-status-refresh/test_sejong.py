"""sejong.py — 세종 발번 리스트 읽기(바탕색 상태·구분·확인 메모).

학교·번호는 전부 가짜다. 바탕색은 openpyxl 로 그 자리에서 칠한다.
"""
import datetime as dt
import io
import unittest

from openpyxl import Workbook
from openpyxl.styles import PatternFill

import sejong
from contract import StepFailure
from fixtures import SEJONG_HEADER, make_xlsx

YELLOW, ORANGE, RED = "FFFFFF00", "FFFFC000", "FFFF0000"


def fill(rgb):
    return PatternFill(fill_type="solid", fgColor=rgb)


def sejong_bytes(rows, *, header=None):
    """rows: (값 5개, B 칸 색, C 칸 색). 색은 None 이면 칠하지 않는다."""
    wb = Workbook()
    ws = wb.active
    ws.append(header or SEJONG_HEADER)
    for values, b_rgb, c_rgb in rows:
        ws.append(values)
        n = ws.max_row
        if b_rgb:
            ws.cell(n, 2).fill = fill(b_rgb)
        if c_rgb:
            ws.cell(n, 3).fill = fill(c_rgb)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class StateByFillTest(unittest.TestCase):
    def test_상태는_대학명_칸_바탕색(self):
        data = sejong_bytes([
            ([9001, "테스트대학교A", "010-0000-0001", None, "2026.01.05"], YELLOW, YELLOW),
            ([9002, "테스트대학교B", "010-0000-0002", None, dt.datetime(2026, 2, 1)], ORANGE, ORANGE),
            ([9003, "테스트대학교C", "010-0000-0003", "미비 메모", None], RED, RED),
            ([9004, "테스트대학교D", "계약 미진행", None, None], None, None),
        ])
        lines, warnings = sejong.load_sejong_lines(data)
        self.assertEqual([x["state"] for x in lines],
                         ["일괄 등록", "추가 등록", "서류 미비", "번호 없음"])
        self.assertEqual(warnings, [])
        a, b, c, d = lines
        self.assertEqual(a["date"], dt.date(2026, 1, 5))
        self.assertEqual(b["date"], dt.date(2026, 2, 1))
        self.assertEqual(c["memo"], "미비 메모")
        self.assertEqual((d["num"], d["text"]), ("", "계약 미진행"))
        self.assertEqual(a["num"], "010-0000-0001")
        self.assertEqual(a["text"], "")

    def test_구분은_이름과_대학_ID로(self):
        data = sejong_bytes([
            ([9001, "테스트고등학교", "010-0000-0001", None, None], YELLOW, YELLOW),
            ([9002, "테스트대학원", "010-0000-0002", None, None], YELLOW, YELLOW),
            ([9003, "테스트협회", "010-0000-0003", None, None], YELLOW, YELLOW),
            ([4010, "테스트전문대", "010-0000-0004", None, None], YELLOW, YELLOW),
            ([9005, "경복대학교", "010-0000-0005", None, None], YELLOW, YELLOW),
            ([9006, "테스트대학교A", "010-0000-0006", None, None], YELLOW, YELLOW),
        ])
        lines, _ = sejong.load_sejong_lines(data)
        self.assertEqual([x["kind"] for x in lines],
                         ["초중고", "대학원", "기타", "전문대학", "전문대학", "4년제"])

    def test_학교명은_NAME_FIX로_통일(self):
        data = sejong_bytes([([1164, " 한양대학교 ", "010-0000-0001", None, None], YELLOW, YELLOW)])
        lines, _ = sejong.load_sejong_lines(data)
        self.assertEqual(lines[0]["name"], "한양대학교(서울)")

    def test_메모_a와_빈_학교명_줄(self):
        data = sejong_bytes([
            ([9001, "테스트대학교A", "010-0000-0001", "a", None], YELLOW, YELLOW),
            ([9002, None, "010-0000-0002", None, None], YELLOW, YELLOW),
        ])
        lines, _ = sejong.load_sejong_lines(data)
        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["memo"], "")


class WarningTest(unittest.TestCase):
    def test_모르는_색과_B_C_다름은_경고(self):
        data = sejong_bytes([
            ([9001, "테스트대학교A", "010-0000-0001", None, None], "FF00FF00", "FF00FF00"),
            ([9002, "테스트대학교B", "010-0000-0002", None, None], None, None),
            ([9003, "테스트대학교C", "010-0000-0003", None, None], YELLOW, RED),
            ([9004, "테스트대학교D", "010-0000-0004", None, None], YELLOW, YELLOW),
        ])
        lines, warnings = sejong.load_sejong_lines(data)
        self.assertEqual([x["state"] for x in lines], ["번호 없음", "번호 없음", "일괄 등록", "일괄 등록"])
        self.assertEqual(warnings, ["모르는 바탕색 2줄", "대학명·번호 칸 바탕색이 다른 줄 1줄"])

    def test_경고에_학교명과_번호를_싣지_않는다(self):
        data = sejong_bytes([([9001, "테스트대학교A", "010-0000-0001", None, None], YELLOW, RED)])
        _, warnings = sejong.load_sejong_lines(data)
        self.assertTrue(warnings)
        self.assertFalse(any("테스트대학교" in w or "010" in w for w in warnings))

    def test_번호_없는_줄의_색은_경고하지_않는다(self):
        data = sejong_bytes([([9001, "테스트대학교A", "계약 미진행", None, None], YELLOW, RED)])
        lines, warnings = sejong.load_sejong_lines(data)
        self.assertEqual(lines[0]["state"], "번호 없음")
        self.assertEqual(warnings, [])


class ShapeTest(unittest.TestCase):
    def test_머리글이_다르면_source_shape(self):
        data = sejong_bytes([], header=["Univ", "학교", "번호", "비고", "등록일자"])
        with self.assertRaises(StepFailure) as cm:
            sejong.load_sejong_lines(data)
        self.assertEqual(cm.exception.code, "source_shape")

    def test_깨진_파일도_source_shape(self):
        for data in (b"", b"not an xlsx"):
            with self.subTest(data=data):
                with self.assertRaises(StepFailure) as cm:
                    sejong.load_sejong_lines(data)
                self.assertEqual(cm.exception.code, "source_shape")

    def test_빈_시트도_source_shape(self):
        with self.assertRaises(StepFailure) as cm:
            sejong.load_sejong_lines(make_xlsx([]))
        self.assertEqual(cm.exception.code, "source_shape")


class CheckNoteTest(unittest.TestCase):
    def test_명지대_자동채우기_오류와_한양_안산_국번(self):
        data = sejong_bytes([
            ([9001, "명지대학교", "010-0000-0001", None, "2025.11.20"], YELLOW, YELLOW),
            ([9001, "명지대학교", "010-0000-0002", None, "2025.11.13"], YELLOW, YELLOW),
            ([1164, "한양대학교", "031-400-0001", None, "2025.10.01"], YELLOW, YELLOW),
            ([1164, "한양대학교", "02-0000-0001", None, "2025.10.01"], YELLOW, YELLOW),
        ])
        lines, _ = sejong.load_sejong_lines(data)
        self.assertIn("11/13", lines[0]["check"])
        self.assertEqual(lines[0]["date_fix"], dt.date(2025, 11, 13))
        self.assertEqual(lines[1]["check"], "")
        self.assertEqual(lines[1]["date_fix"], dt.date(2025, 11, 13))
        self.assertIn("031-400", lines[2]["check"])
        self.assertEqual(lines[3]["check"], "")
        self.assertEqual(lines[3]["date_fix"], dt.date(2025, 10, 1))


class GroupTest(unittest.TestCase):
    def test_대학_ID와_이름으로_묶고_순서를_지킨다(self):
        data = sejong_bytes([
            ([9002, "테스트대학교B", "010-0000-0001", None, None], YELLOW, YELLOW),
            ([9001, "테스트대학교A", "010-0000-0002", None, None], YELLOW, YELLOW),
            ([9002, "테스트대학교B", "010-0000-0003", None, None], YELLOW, YELLOW),
        ])
        lines, _ = sejong.load_sejong_lines(data)
        groups = sejong.group_schools(lines)
        self.assertEqual(list(groups), [(9002, "테스트대학교B"), (9001, "테스트대학교A")])
        self.assertEqual([x["num"] for x in groups[(9002, "테스트대학교B")]],
                         ["010-0000-0001", "010-0000-0003"])


if __name__ == "__main__":
    unittest.main()
