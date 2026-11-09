"""verify.py — 업로드 전 검사. 06·07 말고는 아무것도 바뀌지 않았는가.

작업 사본 모양은 excel_apply.ps1 이 만드는 것을 흉내 낸다(1행 제목 · 8행 헤더 · 9행~ 데이터 ·
틀 고정 A9 · 자동 필터 A8:…). 번호·학교는 전부 가짜다.
"""
import json
import tempfile
import unittest
from pathlib import Path

from openpyxl.formatting.rule import CellIsRule
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

from openpyxl import load_workbook

import compare
import fixtures
import verify

VBA = b"original-vba-project-bytes" * 40
OLD_MOA = [[1, "양쪽", "010-0000-0009", "테스트대학교C", "", "테스트대학교C", "등록완료", 1, "", ""]]


def sheet_dict(sheet, after, header, order, other, rows, counts):
    return {"sheet": sheet, "afterSheet": after, "title": sheet, "headerRow": 8, "firstDataRow": 9,
            "header": header, "order": order, "other": other, "rows": rows, "counts": counts,
            "textColumns": [c for c in header if c != "No" and not c.endswith(" 수")]}


MOA = sheet_dict(
    compare.SHEET, compare.AFTER_SHEET, compare.HEADER, compare.ORDER_MOA, "Moa",
    [[1, "양쪽", "010-0000-0001", "테스트대학교A", "2026-01-02", "테스트대학교A", "등록완료", 2, "2026-01-03", ""],
     [2, "세종만", "010-0000-0002", "테스트대학교B", "2026-01-04", "", "", "", "", ""]],
    {"Moa만": 0, "세종만": 1, "양쪽": 1, "대조 제외": 0, "세종 고유": 2, "Moa 고유": 1})
PIMS = sheet_dict(
    compare.PIMS_SHEET, compare.PIMS_AFTER_SHEET, compare.PIMS_HEADER, compare.PIMS_ORDER, "PIMS",
    [[1, "PIMS만", "010-0000-0003", "", "", "테스트대학교A", "등록완료", 1, "2026-02-01", ""]],
    {"PIMS만": 1, "세종만": 0, "양쪽": 0, "대조 제외": 0, "세종 고유": 0, "PIMS 고유": 1})


def layout(sd, rows=None) -> list[list]:
    """excel_apply.ps1 의 배치 — 빈 문자열은 Excel 이 빈 칸으로 쓴다."""
    body = [[None if v == "" else v for v in r] for r in (sd["rows"] if rows is None else rows)]
    return [[sd["title"]], [], [], [], [], [], [], list(sd["header"])] + body


def with_view(targets: dict[str, int], hidden=("_학교",), names=()):
    """대상 시트에 틀 고정·필터, 숨김 시트, 이름 정의를 얹는 setup."""
    def setup(wb):
        for title, n in targets.items():
            if title in wb.sheetnames:
                ws = wb[title]
                ws.freeze_panes = "A9"
                ws.auto_filter.ref = f"A8:J{max(8 + n, 8)}"
        for title in hidden:
            wb[title].sheet_state = "hidden"
        wb["03. 번호 목록"].merge_cells("A1:B1")
        for name in ("고를값_구분",) + tuple(names):
            wb.defined_names.add(DefinedName(name, attr_text="'_학교'!$A$1:$A$2"))
    return setup


def base_sheets() -> dict[str, list[list]]:
    return {"03. 번호 목록": [["번호 목록"], ["010-0000-0001"]],
            "05. 제출 서류 기준": [["학교"], ["테스트대학교A"]],
            compare.SHEET: layout(MOA, OLD_MOA),
            compare.PIMS_SHEET: layout(PIMS, []),
            "_학교": [["테스트대학교A", "=A1"], ["테스트대학교B", 9001]]}


def after_sheets(**overrides) -> dict[str, list[list]]:
    s = base_sheets()
    s[compare.SHEET] = layout(MOA)
    s[compare.PIMS_SHEET] = layout(PIMS)
    s.update(overrides)
    return s


def same_hashes(_path):
    return {"Module1": "a" * 64, "ThisWorkbook": "b" * 64}


class VerifyTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.before = self._write("before.xlsm", base_sheets(), {compare.SHEET: 1, compare.PIMS_SHEET: 0})

    def tearDown(self):
        self._tmp.cleanup()

    def _write(self, name, sheets, targets=None, vba=VBA, **view) -> Path:
        targets = {compare.SHEET: len(MOA["rows"]), compare.PIMS_SHEET: len(PIMS["rows"])} \
            if targets is None else targets
        p = self.dir / name
        p.write_bytes(fixtures.make_xlsm_like(sheets, vba, setup=with_view(targets, **view)))
        return p

    def _verify(self, after, sheets=(MOA, PIMS), hashes=same_hashes):
        return {c.label: c for c in verify.verify_workbook(self.before, after, list(sheets), module_hashes=hashes)}

    def _failed(self, checks) -> list[str]:
        return verify.failed_labels(list(checks.values()))

    def test_06_07_교체는_시트_목록이_그대로여야(self):
        checks = self._verify(self._write("after.xlsm", after_sheets()))
        self.assertEqual(self._failed(checks), [])
        self.assertEqual(len(checks), 9 + 9 * 2)

    def test_대상_시트가_비면_실패(self):
        checks = self._verify(self._write("after.xlsm", base_sheets(), {compare.SHEET: 1, compare.PIMS_SHEET: 0}),
                              sheets=())
        self.assertEqual(self._failed(checks), [verify.LABEL_TARGETS])

    def _with(self, name, extra, sheets=None):
        """기본 모양에 extra(wb) 를 더 얹은 작업 사본."""
        def setup(wb):
            with_view({compare.SHEET: 2, compare.PIMS_SHEET: 1})(wb)
            extra(wb)
        p = self.dir / name
        p.write_bytes(fixtures.make_xlsm_like(sheets or after_sheets(), VBA, setup=setup))
        return p

    def test_대상_외_시트_값_타입이_바뀌면_실패(self):
        changed = after_sheets(_학교=[["테스트대학교A", "=A1"], ["테스트대학교B", "9001"]])
        checks = self._verify(self._write("after.xlsm", changed))
        self.assertEqual(self._failed(checks), [verify.LABEL_CELLS])

    def test_대상_외_틀_고정이_바뀌면_실패(self):
        p = self._with("after.xlsm", lambda wb: setattr(wb["05. 제출 서류 기준"], "freeze_panes", "A2"))
        self.assertEqual(self._failed(self._verify(p)), [verify.LABEL_META])

    def test_대상_외_조건부_서식이_바뀌면_실패(self):
        def cf(wb):
            wb["05. 제출 서류 기준"].conditional_formatting.add(
                "A1:A2", CellIsRule(operator="equal", formula=['"X"']))
        self.assertEqual(self._failed(self._verify(self._with("after.xlsm", cf))), [verify.LABEL_META])

    def test_대상_외_유효성이_바뀌면_실패(self):
        def dv(wb):
            v = DataValidation(type="list", formula1='"가,나"')
            v.add("A2")
            wb["05. 제출 서류 기준"].add_data_validation(v)
        self.assertEqual(self._failed(self._verify(self._with("after.xlsm", dv))), [verify.LABEL_META])

    def test_시트_범위_이름은_번호가_밀려도_같다(self):
        def local(wb):
            wb["_학교"].defined_names.add(DefinedName("고를값_로컬", attr_text="'_학교'!$A$1:$A$2"))
        s = base_sheets()
        del s[compare.PIMS_SHEET]
        p = self.dir / "before.xlsm"
        p.write_bytes(fixtures.make_xlsm_like(s, VBA, setup=lambda wb: (with_view({compare.SHEET: 1})(wb), local(wb))))
        self.before = p
        checks = self._verify(self._with("after.xlsm", local))
        self.assertEqual(self._failed(checks), [])
        self.assertIn("_학교!고를값_로컬", verify.names_of(load_workbook(p)))

    def test_시트_순서가_바뀌면_실패(self):
        s = after_sheets()
        reordered = {k: s[k] for k in ["05. 제출 서류 기준", "03. 번호 목록", compare.SHEET, compare.PIMS_SHEET, "_학교"]}
        checks = self._verify(self._write("after.xlsm", reordered))
        self.assertEqual(self._failed(checks), [verify.LABEL_SHEETS])

    def test_숨김이_풀리면_실패(self):
        checks = self._verify(self._write("after.xlsm", after_sheets(), hidden=()))
        self.assertIn(verify.LABEL_SHEETS, self._failed(checks))
        self.assertIn(verify.LABEL_META, self._failed(checks))

    def test_원본에_없던_대상은_afterSheet_바로_뒤여야(self):
        s = base_sheets()
        del s[compare.PIMS_SHEET]
        self.before = self._write("before.xlsm", s, {compare.SHEET: 1})
        ok = self._verify(self._write("after.xlsm", after_sheets()))
        self.assertEqual(self._failed(ok), [])

        s = after_sheets()
        at_end = {k: s[k] for k in ["03. 번호 목록", "05. 제출 서류 기준", compare.SHEET, "_학교", compare.PIMS_SHEET]}
        bad = self._verify(self._write("after2.xlsm", at_end))
        self.assertEqual(self._failed(bad), [verify.LABEL_SHEETS])

    def test_대상_외_시트_셀이_하나라도_다르면_실패(self):
        changed = after_sheets(_학교=[["테스트대학교A", "=A1"], ["테스트대학교Z", 9001]])
        checks = self._verify(self._write("after.xlsm", changed))
        c = checks[verify.LABEL_CELLS]
        self.assertFalse(c.ok)
        self.assertEqual(self._failed(checks), [verify.LABEL_CELLS])
        self.assertIn("_학교", c.detail)
        self.assertIn("불일치 1", c.detail)
        self.assertNotIn("테스트대학교", c.detail)

    def test_수식_문자열도_비교한다(self):
        changed = after_sheets(_학교=[["테스트대학교A", "=A2"], ["테스트대학교B", 9001]])
        checks = self._verify(self._write("after.xlsm", changed))
        self.assertEqual(self._failed(checks), [verify.LABEL_CELLS])

    def test_대상_외_병합이_바뀌면_실패(self):
        after = self._write("after.xlsm", after_sheets())
        checks = self._verify(after)
        self.assertTrue(checks[verify.LABEL_META].ok)

        def unmerge(wb):
            with_view({compare.SHEET: 2, compare.PIMS_SHEET: 1})(wb)
            wb["03. 번호 목록"].unmerge_cells("A1:B1")
        p = self.dir / "after2.xlsm"
        p.write_bytes(fixtures.make_xlsm_like(after_sheets(), VBA, setup=unmerge))
        self.assertEqual(self._failed(self._verify(p)), [verify.LABEL_META])

    def test_생성_데이터와_다르면_실패(self):
        expected = {**MOA, "rows": [MOA["rows"][0], [2, "세종만", "010-0000-0002", "테스트대학교B", "2026-01-05",
                                                      "", "", "", "", ""]]}
        checks = self._verify(self._write("after.xlsm", after_sheets()), sheets=(expected, PIMS))
        self.assertEqual(self._failed(checks), [f"{compare.SHEET}: 데이터 = 생성 데이터(셀 단위)"])

    def test_데이터_뒤에_남은_행이_있으면_실패(self):
        extra = MOA["rows"] + [[None, None, None, None, None, None, None, None, None, "남은 칸"]]
        checks = self._verify(self._write("after.xlsm", after_sheets(**{compare.SHEET: layout(MOA, extra)})))
        self.assertIn(f"{compare.SHEET}: 데이터 = 생성 데이터(셀 단위)", self._failed(checks))

    def test_데이터_중간_빈_행은_불일치(self):
        gap = [MOA["rows"][0], [None] * 10, MOA["rows"][1]]
        checks = self._verify(self._write("after.xlsm", after_sheets(**{compare.SHEET: layout(MOA, gap)})))
        self.assertIn(f"{compare.SHEET}: 데이터 = 생성 데이터(셀 단위)", self._failed(checks))

    def test_헤더_너비_밖_남은_칸을_잡는다(self):
        wide = [list(MOA["rows"][0]) + ["남은 칸"], MOA["rows"][1]]
        checks = self._verify(self._write("after.xlsm", after_sheets(**{compare.SHEET: layout(MOA, wide)})))
        self.assertEqual(self._failed(checks), [f"{compare.SHEET}: 데이터 = 생성 데이터(셀 단위)"])

        rows = layout(MOA)
        rows[7] = rows[7] + ["남은 머리글"]
        checks = self._verify(self._write("after2.xlsm", after_sheets(**{compare.SHEET: rows})))
        self.assertEqual(self._failed(checks), [f"{compare.SHEET}: 헤더(8행)"])

    def test_발신번호가_숫자면_실패(self):
        rows = [list(MOA["rows"][0]), list(MOA["rows"][1])]
        rows[0][2] = 1000000001
        checks = self._verify(self._write("after.xlsm", after_sheets(**{compare.SHEET: layout(MOA, rows)})))
        self.assertIn(f"{compare.SHEET}: 발신번호 칸 전부 텍스트", self._failed(checks))

    def test_대상_시트_수식이_있으면_실패(self):
        rows = [list(MOA["rows"][0]), list(MOA["rows"][1])]
        rows[1][9] = "=A1"
        checks = self._verify(self._write("after.xlsm", after_sheets(**{compare.SHEET: layout(MOA, rows)})))
        self.assertIn(f"{compare.SHEET}: 수식 0", self._failed(checks))

    def test_틀_고정과_자동_필터를_본다(self):
        def no_view(wb):
            with_view({compare.PIMS_SHEET: 1})(wb)
        p = self.dir / "after.xlsm"
        p.write_bytes(fixtures.make_xlsm_like(after_sheets(), VBA, setup=no_view))
        failed = self._failed(self._verify(p))
        self.assertIn(f"{compare.SHEET}: 틀 고정 A9", failed)
        self.assertIn(f"{compare.SHEET}: 자동 필터 A8:", failed)
        self.assertNotIn(f"{compare.PIMS_SHEET}: 틀 고정 A9", failed)

    def test_분류_건수와_합계를_본다(self):
        wrong = {**MOA, "counts": {**MOA["counts"], "세종만": 2, "세종 고유": 2}}
        failed = self._failed(self._verify(self._write("after.xlsm", after_sheets()), sheets=(wrong, PIMS)))
        self.assertIn(f"{compare.SHEET}: 양쪽+세종만 = 세종 고유", failed)
        self.assertIn(f"{compare.SHEET}: 분류 건수 = 생성 데이터", failed)
        self.assertNotIn(f"{compare.SHEET}: 양쪽+Moa만 = Moa 고유", failed)

    def test_대상_시트가_없으면_실패(self):
        s = after_sheets()
        del s[compare.PIMS_SHEET]
        failed = self._failed(self._verify(self._write("after.xlsm", s)))
        self.assertIn(f"{compare.PIMS_SHEET}: 시트 있음", failed)

    def test_매크로_바이트가_다르면_실패(self):
        checks = self._verify(self._write("after.xlsm", after_sheets(), vba=b"short"))
        self.assertEqual(self._failed(checks), [verify.LABEL_VBA_HASH])

    def test_모듈_소스가_다르면_실패(self):
        def differ(path):
            return same_hashes(path) if path == self.before else {"Module1": "c" * 64, "ThisWorkbook": "b" * 64}
        checks = self._verify(self._write("after.xlsm", after_sheets()), hashes=differ)
        self.assertEqual(self._failed(checks), [verify.LABEL_MODULES])

    def test_모듈을_하나도_못_읽으면_실패(self):
        checks = self._verify(self._write("after.xlsm", after_sheets()), hashes=lambda _p: {})
        self.assertEqual(self._failed(checks), [verify.LABEL_MODULES])

    def test_이름_정의가_늘면_실패(self):
        checks = self._verify(self._write("after.xlsm", after_sheets(), names=("고를값_추가",)))
        self.assertEqual(sorted(self._failed(checks)), sorted([verify.LABEL_NAMES, verify.LABEL_RAW_NAMES]))

    def test_대상_외_시트_필터_범위가_바뀌면_실패(self):
        def filtered(wb):
            with_view({compare.SHEET: 2, compare.PIMS_SHEET: 1})(wb)
            wb["05. 제출 서류 기준"].auto_filter.ref = "A1:A2"
        p = self.dir / "after.xlsm"
        p.write_bytes(fixtures.make_xlsm_like(after_sheets(), VBA, setup=filtered))
        failed = self._failed(self._verify(p))
        self.assertIn(verify.LABEL_RAW_NAMES, failed)
        self.assertIn(verify.LABEL_META, failed)

    def test_실패_라벨에_값이_없다(self):
        rows = [list(MOA["rows"][0]), list(MOA["rows"][1])]
        rows[0][2] = 1000000001
        sheets = after_sheets(**{compare.SHEET: layout(MOA, rows)},
                              _학교=[["테스트대학교Z", "=B9"], ["010-0000-0077", 9002]])
        checks = verify.verify_workbook(self.before, self._write("after.xlsm", sheets, vba=b"short"),
                                        [MOA, PIMS], module_hashes=lambda _p: {})
        dumped = json.dumps([c.__dict__ for c in checks] + [verify.failed_labels(checks)], ensure_ascii=False)
        self.assertGreaterEqual(len(verify.failed_labels(checks)), 4)
        for value in ("010-0000", "1000000001", "테스트대학교", "=B9", "9002"):
            self.assertNotIn(value, dumped)


if __name__ == "__main__":
    unittest.main()
