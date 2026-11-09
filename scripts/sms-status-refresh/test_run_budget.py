"""실행 시간 예산 — 스케줄러가 30분에 끊기 전에 결과 보고·작업 폴더 정리 몫을 남긴다.

최악 합(Moa·PIMS·Excel·Graph)이 30분에 가깝다. 끊기면 보고도 정리도 안 되므로
refresh.py 가 실행 전체 마감 시각을 정하고, 가장 긴 Excel 단계가 그 안에서 타임아웃을 줄인다.
"""
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import refresh
import workbook_step
from contract import Context, Step, StepResult, run_steps
from test_workbook_step import OK_CHECKS, FakeGraph
from workbook_step import apply_excel, run_workbook_step

HERE = Path(__file__).resolve().parent


class BudgetConstantTest(unittest.TestCase):
    def test_예산은_25분이고_스케줄러_제한보다_짧다(self):
        self.assertEqual(refresh.RUN_BUDGET_S, 25 * 60)
        reg = (HERE / "register-poll-task.ps1").read_text(encoding="utf-8-sig")
        m = re.search(r"-ExecutionTimeLimit \(New-TimeSpan -Minutes (\d+)\)", reg)
        self.assertIsNotNone(m)
        self.assertLess(refresh.RUN_BUDGET_S, int(m.group(1)) * 60)

    def test_Context_마감은_기본_없음(self):
        self.assertIsNone(Context("r", {}, False, Path("."), {}).deadline)


class RefreshDeadlineTest(unittest.TestCase):
    def test_시작_시각에_예산을_더해_마감을_채운다(self):
        seen: list[Context] = []

        def run(c: Context) -> StepResult:
            seen.append(c)
            return StepResult("moa", "ok", "끝")

        with tempfile.TemporaryDirectory() as tmp, \
             mock.patch.dict(os.environ, {"SMS_STATUS_REFRESH_ENV_FILE": str(Path(tmp) / "none.env")}), \
             mock.patch.dict(refresh.REGISTERED, {"moa": Step("moa", run)}, clear=True), \
             mock.patch.object(refresh.time, "monotonic", return_value=1000.0):
            argv = ["--request-id", "r", "--out", str(Path(tmp) / "b.json"), "--work-dir", tmp, "--steps", "moa"]
            self.assertEqual(refresh.main(argv), 0)
        self.assertEqual(seen[0].deadline, 1000.0 + refresh.RUN_BUDGET_S)


class ExcelTimeoutTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        d = Path(self._tmp.name)
        self.args = (d / "work.xlsm", d / "data.json", d / "excel.pid")

    def tearDown(self):
        self._tmp.cleanup()

    def _timeout_for(self, deadline):
        done = subprocess.CompletedProcess([], 0, stdout="", stderr="")
        with mock.patch.object(workbook_step.shutil, "which", return_value="C:/pwsh.exe"), \
             mock.patch.object(workbook_step.subprocess, "run", return_value=done) as run:
            apply_excel(*self.args, deadline=deadline, clock=lambda: 0.0)
        return run.call_args.kwargs["timeout"]

    def test_마감이_멀거나_없으면_600초(self):
        self.assertEqual(self._timeout_for(None), 600)
        self.assertEqual(self._timeout_for(10_000.0), 600)

    def test_마감이_가까우면_남은_시간에서_120초를_뺀다(self):
        self.assertEqual(self._timeout_for(500.0), 380)

    def test_300초_미만이면_Excel_을_띄우지_않는다(self):
        with mock.patch.object(workbook_step.shutil, "which", return_value="C:/pwsh.exe"), \
             mock.patch.object(workbook_step.subprocess, "run") as run:
            with self.assertRaises(workbook_step.StepFailure) as cm:
                apply_excel(*self.args, deadline=299.0, clock=lambda: 0.0)
        self.assertEqual((cm.exception.code, cm.exception.detail), ("excel_failed", "시간 부족"))
        run.assert_not_called()

    def test_단계가_실행_마감을_Excel_에_넘긴다(self):
        with tempfile.TemporaryDirectory() as tmp, \
             mock.patch.object(workbook_step, "apply_excel") as fake_apply:
            step = Step("workbook", lambda c: run_workbook_step(
                c, graph_factory=FakeGraph, restore=lambda b, a: (0, 0),
                verify=lambda b, a, s: list(OK_CHECKS), sleep=lambda _s: None))
            ok = StepResult("x", "ok", "끝")
            ctx = Context("r", {}, True, Path(tmp), {"moa": ok, "pims": ok}, deadline=1234.0)
            r = run_steps([step], ctx)[0]
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual(fake_apply.call_args.kwargs["deadline"], 1234.0)


if __name__ == "__main__":
    unittest.main()
