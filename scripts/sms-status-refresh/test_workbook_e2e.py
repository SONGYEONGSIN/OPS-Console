"""현황 파일 단계 끝에서 끝까지 — 가짜 Graph(현황 파일·버전 기록·세종·Moa·PIMS) + 가짜 COM(payload 를 openpyxl 로
적용) + 진짜 매크로 복원·진짜 검사(verify_workbook 90개). Excel·Teams 는 만지지 않는다. 값은 전부 가짜다.

가짜 COM 은 excel_apply.ps1 이 payload 로 할 일만 흉내 낸다 — 06·07 은 8행 머리글·9행부터 데이터·틀 고정·필터,
숨김 표는 2행부터 A~T(U 그대로), 보기는 test_views.apply_view, 요약은 지우고 값·병합·링크(툴팁), `_수정` 은 숨김·맨 끝.
"""
import json
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.hyperlink import Hyperlink

import test_verify as tv
import test_verify_table as tt
import verify
from contract import Context, Step, StepResult, run_steps
from test_body_step import status_workbook
from test_views import apply_view
from test_workbook_step import FakeGraph
from vba import restore_vba
from graph import SMS_ROOT
from test_workbook_step import WB_NAME
from workbook_step import DONE, run_workbook_step

WIDTH = 20  # 숨김 표 A~T


def _clear(ws, max_col=None):
    for row in ws.iter_rows(max_col=max_col):
        for c in row:
            c.value = None


def _compare(wb, sd):
    if sd["sheet"] not in wb.sheetnames:
        wb.create_sheet(sd["sheet"], wb.sheetnames.index(sd["afterSheet"]) + 1)
    ws = wb[sd["sheet"]]
    _clear(ws)
    for r, row in enumerate(tv.layout(sd), start=1):
        for c, v in enumerate(row, start=1):
            ws.cell(r, c).value = v
    ws.freeze_panes = "A9"
    ws.auto_filter.ref = f"A8:{get_column_letter(len(sd['header']))}{max(8 + len(sd['rows']), 8)}"


def _table(wb, sd):
    ws = wb[sd["sheet"]]
    for r in range(2, ws.max_row + 1):
        for c in range(1, WIDTH + 1):
            ws.cell(r, c).value = None
    for r, row in enumerate(sd["rows"], start=2):
        for c, v in enumerate(row, start=1):
            ws.cell(r, c).value = None if v == "" else v


def _summary(wb, sd):
    ws = wb[sd["sheet"]]
    for m in list(ws.merged_cells.ranges):
        ws.unmerge_cells(str(m))
    for row in ws.iter_rows():
        for c in row:
            c.value, c.hyperlink = None, None
    for r, row in enumerate(sd["rows"], start=1):
        for c, v in enumerate(row, start=1):
            if v != "":
                ws.cell(r, c).value = v
    for m in sd["merged"]:
        ws.merge_cells(m)
    for coord, loc in sd["links"].items():
        sheet, cell = loc.split("!")
        ws[coord].hyperlink = Hyperlink(ref=coord, location=f"'{sheet}'!{cell}", tooltip=sd["tips"][coord])


def _meta(wb, sd):
    if sd["sheet"] not in wb.sheetnames:
        wb.create_sheet(sd["sheet"]).sheet_state = "hidden"
    ws = wb[sd["sheet"]]
    _clear(ws)
    for r, row in enumerate([sd["header"], *sd["rows"]], start=1):
        for c, v in enumerate(row, start=1):
            ws.cell(r, c).value = v


APPLY = {None: _compare, "table": _table, "view": apply_view, "summary": _summary, "meta": _meta}


def fake_com(workbook: Path, data: Path, _pid: Path) -> None:
    """excel_apply.ps1 대신 — data.json 의 payload 를 차례로 적용하고 한 번 저장(매크로는 뒤에서 복원)."""
    wb = load_workbook(workbook, keep_vba=True)
    for sd in json.loads(data.read_text(encoding="utf-8"))["sheets"]:
        APPLY[sd.get("kind")](wb, sd)
    wb.save(workbook)


HUMAN_CHECK = "사람이 적은 확인"  # 지금 파일 `_학교` A 행 확인 칸 — 기준 판(첫 판)에는 빈칸


class BaselineGraph(FakeGraph):
    """첫 판이 지금 파일과 다른 Graph — 첫 판은 `_학교` A 확인이 빈칸, 지금 파일은 사람이 고친 값."""

    def __init__(self, first: bytes, **kw):
        super().__init__(**kw)
        self.first = first

    def download_version(self, item_id, version_id):
        self.calls.append(("download_version", item_id, version_id))
        return self.first


def _schools(check):
    return [{**s, "check": check} if s["name"] == tt.A else s for s in tt.schools()]


class WorkbookEndToEndTest(unittest.TestCase):
    def _run(self, graph, tmp: Path):
        seen = []

        def real_verify(before, after, sheets, baseline=None):
            checks = verify.verify_workbook(before, after, sheets, module_hashes=tv.same_hashes, baseline=baseline)
            seen.append(checks)
            return checks

        step = Step("workbook", lambda c: run_workbook_step(
            c, graph_factory=lambda: graph, apply=fake_com, restore=restore_vba, verify=real_verify,
            sleep=lambda _s: None, today=lambda: "2026-11-12"))
        ok = StepResult("x", "ok", "끝")
        r = run_steps([step], Context("req-1", {}, False, tmp, {"mail": ok, "moa": ok, "pims": ok}))[0]
        return r, seen

    def test_기준_판과_다른_사람_칸은_보존되고_수정에_사람_행이_남는다(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            first = status_workbook(d / "first.xlsm", schs=_schools("")).read_bytes()
            graph = BaselineGraph(first)
            graph.files[SMS_ROOT] = [("wb", WB_NAME, status_workbook(d / "now.xlsm", schs=_schools(HUMAN_CHECK)).read_bytes())]
            work = d / "work"
            r, seen = self._run(graph, work)
            self.assertEqual(verify.failed_labels(seen[0]) if seen else ["검사 안 돎"], [], r.detail)
            self.assertEqual((r.status, r.counts["checks"]), ("ok", 90), r.detail)
            wb = load_workbook(work / "work.xlsm")
            school = wb["_학교"]
            head = [c.value for c in school[1]]
            row = next(r for r in school.iter_rows(min_row=2, values_only=True) if r[head.index("학교명")] == tt.A)
            self.assertEqual(row[head.index("확인")], HUMAN_CHECK)
            meta = [tuple(r[:5]) for r in wb["_수정"].iter_rows(min_row=2, values_only=True)]
            self.assertIn(("사람", "_학교", tt.A, "확인", HUMAN_CHECK), meta)

    def test_현황_파일_단계를_끝까지_돌면_검사_90개가_통과한다(self):
        graph = FakeGraph()
        with tempfile.TemporaryDirectory() as tmp:
            r, seen = self._run(graph, Path(tmp))
        self.assertEqual(verify.failed_labels(seen[0]) if seen else ["검사 안 돎"], [], r.detail)
        self.assertEqual((r.status, r.counts["checks"], r.counts["uploaded"]), ("ok", 90, 1), r.detail)
        self.assertTrue(r.summary.startswith(f"{DONE} · 검사 90/90 통과 · 업로드 완료 "), r.summary)
        self.assertEqual(r.changes[2:], ("_학교: 3→6행 · 새 3 · 빠짐 0", "_서류: 3→6행 · 새 3 · 빠짐 0",
                                         "_번호: 5→6행 · 새 3 · 빠짐 2", "요약 링크 못 건 칸 2",
                                         "세종 경고: 모르는 바탕색 4줄", "기준 판: 버전 1.0 (2026-10-17)"))
        self.assertIn(("download_version", "wb", "1.0"), graph.calls)  # 첫 실행 — `_수정` 이 없어 기준 판을 받았다
        self.assertEqual(len(graph.puts), 1)


if __name__ == "__main__":
    unittest.main()
