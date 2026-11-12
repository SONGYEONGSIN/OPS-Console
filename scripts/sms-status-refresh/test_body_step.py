"""body_step — 현황 파일 단계의 PR-3b 몫(숨김 표 셋·01~03 보기·00. 요약·`_수정` payload)과 기준 판 받기.

현황 파일 모양은 test_verify_table.build(가짜 값만) + `_확인` 시트, 세종 리스트는 test_compare 의 가짜 바이트다.
Graph 는 가짜다 — 실제 파일·버전 기록은 만지지 않는다.
"""
import tempfile
import unittest
from pathlib import Path

import test_verify_table as tt
from body_step import Body, after_rows, build_body, change_lines, fetch_baseline
from contract import StepFailure
from graph import FileVersion, GraphError
from sheet_names import SUMMARY_SHEET, VIEW_OF
from summary_sheet import base_line
from test_compare import sejong_bytes
from test_views import chain, link_summary
from verify_table import LOST, META_HEADER, META_SHEET, Table

SEJONG_NAME = "세종 등록 리스트_261107.xlsx"
DAY = "2026-11-12"
SEARCH_LINKS = {"B9": "01. 학교별 현황!F6", "C9": "02. 학교별 제출 서류!E6", "D9": "03. 번호 목록!D6"}
MOA_ROWS = [[1, "Moa만", "010-0000-0099", "", "", "", "", "", "", ""],
            [2, "양쪽", "010-0000-0001", "", "", "", "", "", "", ""]]


def add_issues(wb):
    ws = wb.create_sheet("_확인")
    ws.sheet_state = "hidden"
    ws.append(["No", "유형", "대상", "내용"])
    ws.append([1, "유형01", "테스트대학교B", "x"])


def status_workbook(path: Path, *, meta=None, links=True) -> Path:
    """현황 파일 흉내 — 06·07 + 00 요약(보기 링크) + 01~03 보기 + 숨김 3장 + `_확인`(+ meta 가 있으면 `_수정`)."""
    fns = [add_issues] + ([link_summary(SEARCH_LINKS)] if links else [])
    if meta is not None:
        fns.append(tt.edits_sheet(meta))
    return tt.build(path, moa_rows=MOA_ROWS, mutate=chain(*fns))


class FakeVersions:
    def __init__(self, versions=(), error=None, download_error=None):
        self._versions, self.error, self.download_error = list(versions), error, download_error
        self.calls: list[tuple] = []

    def versions(self, item_id):
        self.calls.append(("versions", item_id))
        if self.error is not None:
            raise self.error
        return list(self._versions)

    def download_version(self, item_id, version_id):
        self.calls.append(("download_version", item_id, version_id))
        if self.download_error is not None:
            raise self.download_error
        return b"first-version"


class FetchBaselineTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.before = self.dir / "before.xlsm"
        self.before.write_bytes(b"now")

    def tearDown(self):
        self._tmp.cleanup()

    def test_가장_오래된_판을_받는다(self):
        g = FakeVersions([FileVersion("3.0", "2026-11-03T00:00:00Z"), FileVersion("1.0", "2026-10-17T00:00:00Z"),
                          FileVersion("2.0", "2026-10-20T00:00:00Z")])
        path = fetch_baseline(g, "wb", self.dir, self.before)
        self.assertEqual(path, self.dir / "baseline.xlsm")
        self.assertEqual(path.read_bytes(), b"first-version")
        self.assertEqual(g.calls[-1], ("download_version", "wb", "1.0"))

    def test_버전이_하나뿐이면_지금_파일이_기준_판(self):
        g = FakeVersions([FileVersion("1.0", "2026-10-17T00:00:00Z")])
        self.assertEqual(fetch_baseline(g, "wb", self.dir, self.before), self.before)
        self.assertEqual([c[0] for c in g.calls], ["versions"])

    def test_버전_목록을_못_받으면_baseline_missing(self):
        for g in (FakeVersions(error=GraphError(403)), FakeVersions([]),
                  FakeVersions([FileVersion("2.0", "b"), FileVersion("1.0", "a")], download_error=GraphError(404))):
            with self.assertRaises(StepFailure) as cm:
                fetch_baseline(g, "wb", self.dir, self.before)
            self.assertEqual(cm.exception.code, "baseline_missing")


class LinesTest(unittest.TestCase):
    def test_바뀐_점은_건수만(self):
        tables = [{"sheet": "_번호", "beforeRows": 592, "rows": [[]] * 599, "added": ["k"] * 7, "removed": []},
                  {"sheet": "_학교", "beforeRows": 3, "rows": [[]] * 3, "added": [], "removed": []}]
        meta_new = [(LOST, "_번호", "k1", "비고", "x", "", DAY), ("기계", "_번호", "k2", "비고", "", "", DAY),
                    (LOST, "_학교", "k3", "S열", "y", "", DAY)]
        got = change_lines(tables, meta_new, ["02: … 값만 씀 3칸", "04: … 값만 씀 2칸"])
        self.assertEqual(got, ("_번호: 592→599행 · 새 7 · 빠짐 0", "_학교: 3→3행 · 새 0 · 빠짐 0",
                               "옮기지 못한 메모 2건 — _수정 '못 옮김'", "요약 링크 못 건 칸 5"))
        self.assertEqual(change_lines(tables[1:], meta_new[1:2], []), ("_학교: 3→3행 · 새 0 · 빠짐 0",))

    def test_올린_뒤_기대_행은_새_행_수(self):
        # 머리글 1행 + 새 행 수 — U(고를 값)가 더 길면 U 끝(값만 세는 사용 범위라 서식만 남은 행은 안 센다)
        tables = {"_번호": Table((), ((1,),) * 5, 3), "_학교": Table((), ((1,),) * 2, 9)}
        payloads = [{"sheet": "_번호", "rows": [[]] * 7}, {"sheet": "_학교", "rows": [[]] * 4}]
        self.assertEqual(after_rows(tables, payloads), {"_번호": 8, "_학교": 9})


class BuildBodyTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.asked: list[int] = []

    def tearDown(self):
        self._tmp.cleanup()

    def _build(self, before: Path, baseline: Path | None = None) -> Body:
        def baseline_fn():
            self.asked.append(1)
            return baseline or before
        return build_body(before, sejong_bytes(), SEJONG_NAME, DAY, baseline_fn)

    def test_첫_실행은_기준_판을_묻고_payload_를_만든다(self):
        before = status_workbook(self.dir / "before.xlsm")
        body = self._build(before)
        self.assertEqual(self.asked, [1])
        self.assertEqual(body.baseline, before)
        self.assertEqual([(p["kind"], p["sheet"]) for p in body.sheets],
                         [("table", "_학교"), ("table", "_서류"), ("table", "_번호"),
                          *(("view", v) for v in VIEW_OF), ("summary", SUMMARY_SHEET), ("meta", META_SHEET)])
        meta = body.sheets[-1]
        self.assertEqual(meta["header"], list(META_HEADER))
        self.assertTrue(meta["rows"] and all(len(r) == 7 for r in meta["rows"]))
        note = base_line(SEJONG_NAME, DAY)
        self.assertEqual({p["noteText"] for p in body.sheets if p["kind"] == "view"}, {note})
        self.assertEqual(body.sheets[-2]["rows"][4][0], note)  # 요약 A5 와 보기 A4 가 같은 문자열
        links = set(body.sheets[-2]["links"].values())  # 요약 링크 = 보기 payload 의 검색 칸
        self.assertTrue(links and links <= set(SEARCH_LINKS.values()), links)
        for line in body.changes:
            self.assertNotIn("010-0000", line)
            self.assertNotIn("테스트대학교", line)
        self.assertTrue(body.changes[0].startswith("_학교: 3→"), body.changes)

    def test_수정_시트가_있으면_기준_판을_받지_않는다(self):
        before = status_workbook(self.dir / "before.xlsm", meta=[])
        body = self._build(before)
        self.assertEqual(self.asked, [])
        self.assertIsNone(body.baseline)

    def test_기준_판에_숨김_표가_없으면_baseline_missing(self):
        before = status_workbook(self.dir / "before.xlsm")
        bare = self.dir / "bare.xlsm"
        bare.write_bytes(tt.fixtures.make_xlsm_like({"x": [["a"]]}, b"VBA"))
        with self.assertRaises(StepFailure) as cm:
            self._build(before, bare)
        self.assertEqual(cm.exception.code, "baseline_missing")

    def test_보기_모양이_다르면_기준_판을_받기_전에_view_shape(self):
        before = status_workbook(self.dir / "before.xlsm")
        from openpyxl import load_workbook
        wb = load_workbook(before)
        del wb["02. 학교별 제출 서류"]
        broken = self.dir / "broken.xlsx"
        wb.save(broken)
        with self.assertRaises(StepFailure) as cm:
            self._build(broken)
        self.assertEqual(cm.exception.code, "view_shape")
        self.assertEqual(self.asked, [])


if __name__ == "__main__":
    unittest.main()
