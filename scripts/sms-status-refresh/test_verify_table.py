"""verify_table.py — 숨김 시트(`_번호`·`_학교`·`_서류`)를 다시 쓴 작업 사본 검사.

원본·작업 사본·기준 판은 fixtures_status.search_sheet 로 같은 모양을 만들고, 작업 사본은 숨김 시트의
A~T 만 다시 쓴다(COM 이 하는 일 — U 와 뷰는 그대로). payload 는 작업 사본을 그대로 읽어 만든다(COM 이
payload 대로 썼다는 가정). 그래서 실패는 '사람 칸' 규칙에서 난다. 번호·학교·담당자는 전부 가짜다.
"""
import json
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

import compare
import fixtures
import fixtures_status as fs
import test_verify as tv
import verify
import verify_table as vt

A, B, C = "테스트대학교A", "테스트대학교B", "테스트대학교C"
VIEWS = {"_학교": ("01. 학교별 현황", fs.SCHOOL_HEADS), "_서류": ("02. 서류별 현황", fs.DOC_HEADS),
         "_번호": ("03. 번호 목록", fs.NUMBER_HEADS)}


def num(no, name, number, state, docs="", note="", kind="4년제"):
    return {"no": no, "name": name, "kind": kind, "num": number, "state": state, "date": "2026-01-02",
            "docs": docs, "note": note, "tags": [state, kind]}


def numbers():
    return [num(1, A, "010-0000-0001", "일괄", docs="완료"),
            num(2, A, "010-0000-0002", "추가", note="메모 X / 번호 없음"),
            num(3, B, "010-0000-0003", "미비", kind="전문대학"),
            num(4, C, "010-0000-0009", "일괄"),
            num(5, A, "010-0000-0009", "추가")]  # 공유 번호 — 원문 키로 잇는다


def school(no, name, owner, lines, check="", kind="4년제"):
    return {"no": no, "name": name, "kind": kind, "apply": "O", "pims": "O", "owner": owner, "lines": lines,
            "bulk": 1, "extra_n": lines - 1, "missing": 0, "recent": "2026-01-09", "docs": "완료",
            "check": check, "note": "", "tags": [kind]}


def schools():
    return [school(1, A, "op-a", 3, check="확인함"), school(2, B, "op-b", 1, kind="전문대학"),
            school(3, C, "op-c", 1)]


def doc(no, name, pdf, kind="4년제"):
    return {"no": no, "name": name, "kind": kind, "lines": 1, "state": "등록", "d1": "O", "d2": "",
            "status": "일부 제출", "todo": "위임장", "pdf": pdf, "tags": [kind]}


def docs():
    return [doc(1, A, "pdf-token-a"), doc(2, B, "pdf-token-b", kind="전문대학"), doc(3, C, None)]


def rewrite(wb, hid, records):
    """COM 이 하는 일 — 2행부터 A~T 를 덮고 남는 행은 비운다. U 는 안 건드린다."""
    name, heads = VIEWS[hid]
    hs = wb[hid]
    u_last = max([r for r in range(2, hs.max_row + 1) if hs.cell(r, 21).value is not None] or [1])
    for r in range(2, hs.max_row + 1):
        for c in range(1, 21):
            hs.cell(r, c).value = None
    box = f"'{name}'!${get_column_letter(fs.box_span([w for _h, w, *_ in heads])[0])}$6"
    for i, rec in enumerate(records, start=2):
        fs.write_hidden_row(hs, i, heads, rec, box, u_last)
        if "pdf" in rec:
            hs.cell(i, fs.PDF_COL).value = rec["pdf"]


def build(path: Path, *, nums=None, schs=None, dcs=None, moa_rows=None, mutate=None) -> Path:
    """현황 파일 모양 — 06·07 + 01~03 뷰 + 숨김 3장. mutate 는 저장 직전 통합 문서를 고친다."""
    nums, schs, dcs = nums or numbers(), schs or schools(), dcs or docs()
    moa = tv.MOA["rows"] if moa_rows is None else moa_rows
    pims = tv.PIMS["rows"] if moa_rows is None else []

    def setup(wb):
        for title, n in ((compare.SHEET, len(moa)), (compare.PIMS_SHEET, len(pims))):
            wb[title].freeze_panes = "A9"
            wb[title].auto_filter.ref = f"A8:J{8 + max(n, 0)}"
        for hid, recs in (("_학교", schs), ("_서류", dcs), ("_번호", nums)):
            name, heads = VIEWS[hid]
            rules = [("상태", '{c}{r}="미비"')] if hid == "_번호" else []
            fs.search_sheet(wb, name, hid, heads, recs, fs.picks_of(recs), rules=rules)
        hs = wb["_서류"]
        hs.cell(1, fs.PDF_COL).value = "PDF 주소"
        for i, d in enumerate(dcs, start=2):
            hs.cell(i, fs.PDF_COL).value = d["pdf"]
        if mutate is not None:
            mutate(wb)

    sheets = {compare.SHEET: tv.layout(tv.MOA, moa), compare.PIMS_SHEET: tv.layout(tv.PIMS, pims)}
    path.write_bytes(fixtures.make_xlsm_like(sheets, tv.VBA, setup=setup))
    return path


def payload(before: Path, after: Path, sheet: str, added=(), removed=(), **override) -> dict:
    bt, at = (vt.read_table(load_workbook(p), sheet) for p in (before, after))
    out = {"kind": "table", "sheet": sheet, "beforeRows": len(bt.rows), "columns": list(vt.COLUMNS),
           "textColumns": ["D"] if sheet == "_번호" else [], "rows": [list(r) for r in at.rows],
           "added": list(added), "removed": list(removed)}
    return {**out, **override}


def changed_numbers():
    """세종 열만 바뀌고(3번 상태) 새 번호 하나가 끝에 붙은 `_번호`."""
    rows = numbers()
    rows[2] = {**rows[2], "state": "일괄"}
    return rows + [num(6, B, "010-0000-0010", "추가", kind="전문대학")]


class VerifyTableTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.before = build(self.dir / "before.xlsm", moa_rows=tv.OLD_MOA)
        self.baseline = build(self.dir / "baseline.xlsm", moa_rows=tv.OLD_MOA)

    def tearDown(self):
        self._tmp.cleanup()

    def _after(self, name="after.xlsm", nums=None, schs=None, dcs=None, extra=None) -> Path:
        def mutate(wb):
            rewrite(wb, "_번호", nums or numbers())
            rewrite(wb, "_학교", schs or schools())
            rewrite(wb, "_서류", dcs or docs())
            if extra is not None:
                extra(wb)
        return build(self.dir / name, mutate=mutate)

    def _tables(self, after, **per_sheet):
        return [payload(self.before, after, s, **per_sheet.get(s, {})) for s in ("_번호", "_학교", "_서류")]

    def _verify(self, after, tables=None, baseline="default"):
        sheets = [tv.MOA, tv.PIMS] + (self._tables(after) if tables is None else tables)
        base = self.baseline if baseline == "default" else baseline
        return {c.label: c for c in verify.verify_workbook(self.before, after, sheets,
                                                            module_hashes=tv.same_hashes, baseline=base)}

    def _failed(self, checks):
        return verify.failed_labels(list(checks.values()))

    def test_정상_갱신은_통과(self):
        schs, dcs = schools(), docs()
        schs[1] = {**schs[1], "lines": 2, "extra_n": 1}  # 세종 열은 다시 계산해도 된다
        dcs[1] = {**dcs[1], "lines": 2, "state": "미비"}
        after = self._after(nums=changed_numbers(), schs=schs, dcs=dcs)
        checks = self._verify(after, self._tables(after, _번호={"added": ["01000000010"]}))
        self.assertEqual(self._failed(checks), [])
        self.assertEqual(len(checks), 27 + 3 * vt.CHECKS_PER_TABLE)

    def test_06_07_만이면_27개_그대로(self):
        after = build(self.dir / "after.xlsm")
        checks = self._verify(after, tables=[])
        self.assertEqual(self._failed(checks), [])
        self.assertEqual(len(checks), 27)

    def test_사람_칸_딴_줄_실패(self):
        rows = schools()
        rows[0], rows[1] = {**rows[0], "owner": "op-b"}, {**rows[1], "owner": "op-a"}
        checks = self._verify(self._after(schs=rows))
        self.assertEqual(self._failed(checks), [vt.label("_학교", vt.L_PERSON)])
        self.assertIn("담당자", checks[vt.label("_학교", vt.L_PERSON)].detail)

    def test_사람_판정_칸_변경_실패(self):
        rows = schools()
        rows[0] = {**rows[0], "check": ""}
        # 기준 판에선 비어 있던 칸을 사람이 '확인함' 으로 고쳤다 → 사람 칸, 다시 계산하면 안 된다
        base_rows = schools()
        base_rows[0] = {**base_rows[0], "check": ""}
        human = build(self.dir / "baseline-human.xlsm", schs=base_rows, moa_rows=tv.OLD_MOA)
        checks = self._verify(self._after(schs=rows), baseline=human)
        self.assertEqual(self._failed(checks), [vt.label("_학교", vt.L_PERSON)])
        self.assertIn("확인", checks[vt.label("_학교", vt.L_PERSON)].detail)
        # 기준 판과 같은 값이면 기계 칸 — 다시 계산해 바뀌어도 통과
        self.assertEqual(self._failed(self._verify(self._after("after2.xlsm", schs=rows))), [])

    def test_기준이_없으면_판정_칸은_사람(self):
        rows = schools()
        rows[0] = {**rows[0], "check": ""}
        checks = self._verify(self._after(schs=rows), baseline=None)
        self.assertEqual(self._failed(checks), [vt.label("_학교", vt.L_PERSON)])

    def test_비고는_덧붙이기만(self):
        rows = numbers()
        rows[1] = {**rows[1], "note": "메모 X / 새 메모"}  # '번호 없음' 만 지울 수 있다
        self.assertEqual(self._failed(self._verify(self._after(nums=rows))), [])
        rows[1] = {**rows[1], "note": "새 메모"}
        checks = self._verify(self._after("after2.xlsm", nums=rows))
        self.assertEqual(self._failed(checks), [vt.label("_번호", vt.L_NOTE)])

    def test_빠진_메모_누락은_실패(self):
        # 기준 판의 2번 비고가 비어 있었다 → 지금 비고는 사람이 쓴 메모
        base_rows = numbers()
        base_rows[1] = {**base_rows[1], "note": ""}
        self.baseline = build(self.dir / "baseline-memo.xlsm", nums=base_rows, moa_rows=tv.OLD_MOA)
        rows = [r for r in numbers() if r["num"] != "010-0000-0002"]
        after = self._after(nums=rows)
        failed = self._failed(self._verify(after))
        self.assertIn(vt.label("_번호", vt.L_LOST), failed)
        self.assertIn(vt.label("_번호", vt.L_KEYS), failed)
        ok = self._verify(after, self._tables(after, _번호={"removed": ["01000000002"]}))
        self.assertEqual(self._failed(ok), [])

    def test_메모_없는_행이_빠지면_키_증감만_본다(self):
        rows = [r for r in numbers() if r["num"] != "010-0000-0003"]
        after = self._after(nums=rows)
        self.assertEqual(self._failed(self._verify(after)), [vt.label("_번호", vt.L_KEYS)])
        ok = self._verify(after, self._tables(after, _번호={"removed": ["01000000003"]}))
        self.assertEqual(self._failed(ok), [])

    def test_학교_시트는_행이_빠지면_실패(self):
        after = self._after(schs=schools()[:2])
        checks = self._verify(after, self._tables(after, _학교={"removed": [C]}))
        self.assertEqual(self._failed(checks), [vt.label("_학교", vt.L_KEYS)])

    def test_U_가_바뀌면_실패(self):
        after = self._after(extra=lambda wb: setattr(wb["_번호"].cell(2, 21), "value", "다른 값"))
        self.assertEqual(self._failed(self._verify(after)), [vt.label("_번호", vt.L_U)])
        grown = self._after("after2.xlsm", extra=lambda wb: setattr(wb["_학교"].cell(40, 21), "value", "새 값"))
        self.assertEqual(self._failed(self._verify(grown)), [vt.label("_학교", vt.L_U)])

    def test_모르는_열도_사람_칸으로_보존(self):
        rows = docs()
        rows[0], rows[1] = {**rows[0], "pdf": "pdf-token-b"}, {**rows[1], "pdf": "pdf-token-a"}
        checks = self._verify(self._after(dcs=rows))
        self.assertEqual(self._failed(checks), [vt.label("_서류", vt.L_PERSON)])
        self.assertIn("PDF 주소", checks[vt.label("_서류", vt.L_PERSON)].detail)
        rows = docs()
        rows[0] = {**rows[0], "pdf": None}
        checks = self._verify(self._after("after2.xlsm", dcs=rows))
        self.assertEqual(self._failed(checks), [vt.label("_서류", vt.L_PERSON)])

    def test_수정_시트로_판정한다(self):
        def edits(kind):
            def add(wb):
                ws = wb.create_sheet(vt.META_SHEET)
                ws.sheet_state = "hidden"
                ws.append(list(vt.META_HEADER))
                ws.append([kind, "_학교", A, "확인", "확인함", "", "2026-11-10"])
            return add
        rows = schools()
        rows[0] = {**rows[0], "check": ""}
        for kind, expected in (("기계", []), ("사람", [vt.label("_학교", vt.L_PERSON)])):
            self.before = build(self.dir / f"before-{kind}.xlsm", moa_rows=tv.OLD_MOA, mutate=edits(kind))
            after = self._after(f"after-{kind}.xlsm", schs=rows, extra=edits(kind))
            # `_수정` 이 있으면 기준 판은 보지 않는다 — 기준 판은 None 이어도 같다
            self.assertEqual(self._failed(self._verify(after, baseline=None)), expected, kind)

    def test_생성_데이터와_다르면_실패(self):
        after = self._after()
        tables = self._tables(after)
        tables[1] = {**tables[1], "rows": tables[1]["rows"][:2]}
        self.assertEqual(self._failed(self._verify(after, tables)), [vt.label("_학교", vt.L_DATA)])
        tables = self._tables(after, _학교={"beforeRows": 9})
        self.assertEqual(self._failed(self._verify(after, tables)), [vt.label("_학교", vt.L_DATA)])

    def test_발신번호가_숫자면_실패(self):
        rows = numbers()
        rows[0] = {**rows[0], "num": 1000000001}
        after = self._after(nums=rows)
        self.assertIn(vt.label("_번호", vt.L_TEXT), self._failed(self._verify(after)))

    def test_머리글이_바뀌거나_모르는_시트면_실패(self):
        after = self._after(extra=lambda wb: setattr(wb["_학교"].cell(1, 13), "value", "확인2"))
        self.assertIn(vt.label("_학교", vt.L_HEADER), self._failed(self._verify(after)))
        tables = self._tables(self._after("after2.xlsm")) + [{"kind": "table", "sheet": "01. 학교별 현황"}]
        self.assertIn(vt.label("01. 학교별 현황", vt.L_KNOWN), self._failed(self._verify(after, tables)))

    def test_실패_라벨에_값이_없다(self):
        nums = [r for r in numbers() if r["num"] != "010-0000-0002"]
        nums[0] = {**nums[0], "note": "", "num": 1000000001}
        schs = schools()
        schs[0], schs[1] = {**schs[0], "owner": "op-b"}, {**schs[1], "owner": "op-a"}
        dcs = docs()
        dcs[0] = {**dcs[0], "pdf": None}
        checks = verify.verify_workbook(self.before, self._after(nums=nums, schs=schs, dcs=dcs),
                                        [tv.MOA, tv.PIMS] + self._tables(self.dir / "after.xlsm"),
                                        module_hashes=tv.same_hashes, baseline=None)
        dumped = json.dumps([c.__dict__ for c in checks], ensure_ascii=False)
        self.assertGreaterEqual(len(verify.failed_labels(checks)), 4)
        for value in ("테스트대학교", "010-0000", "0100000", "1000000001", "op-", "메모 X", "pdf-token"):
            self.assertNotIn(value, dumped)


if __name__ == "__main__":
    unittest.main()
