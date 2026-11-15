"""apply_excel — excel_apply.ps1 부르기(pwsh 찾기·실패 줄·시간 초과 때 자기 Excel 만 정리).

test_workbook_step 에서 옮겼다(400줄 상한). pwsh·Excel 은 띄우지 않는다 — subprocess.run 을 가짜로 바꾼다.
"""
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import workbook_step
from workbook_step import apply_excel


class ApplyExcelTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.wb, self.data, self.pid = self.dir / "work.xlsm", self.dir / "data.json", self.dir / "excel.pid"

    def tearDown(self):
        self._tmp.cleanup()

    def _call(self, run_side_effect, which="C:/pwsh.exe"):
        with mock.patch.object(workbook_step.shutil, "which", return_value=which), \
             mock.patch.object(workbook_step.subprocess, "run", side_effect=run_side_effect) as run:
            try:
                apply_excel(self.wb, self.data, self.pid, timeout_s=5)
                return None, run
            except workbook_step.StepFailure as e:
                return e, run

    @staticmethod
    def done(code, out=""):
        return subprocess.CompletedProcess([], code, stdout=out, stderr="")

    def test_성공(self):
        err, run = self._call([self.done(0, "applied: 06=1\nexcel cleanup: ok\n")])
        self.assertIsNone(err)
        cmd = run.call_args.args[0]
        self.assertEqual(cmd[0], "C:/pwsh.exe")
        self.assertTrue(cmd[cmd.index("-File") + 1].endswith("excel_apply.ps1"))
        for flag, val in (("-Workbook", self.wb), ("-Data", self.data), ("-PidFile", self.pid)):
            self.assertEqual(cmd[cmd.index(flag) + 1], str(val))

    def test_pwsh_가_없으면_excel_failed(self):
        err, run = self._call([], which=None)
        self.assertEqual((err.code, err.detail), ("excel_failed", "pwsh 없음"))
        run.assert_not_called()

    def test_실패하면_FAILED_줄만(self):
        err, _run = self._call([self.done(1, "applied: \nFAILED at line 42: $ws.Cells(1,1)\n")])
        self.assertEqual((err.code, err.detail), ("excel_failed", "FAILED at line 42"))

    def test_FAILED_줄이_없으면_종료_코드(self):
        err, _run = self._call([self.done(1, "무언가 던짐\n")])
        self.assertEqual((err.code, err.detail), ("excel_failed", "exit 1"))

    def test_시간_초과면_자기_Excel_만_정리한다(self):
        self.pid.write_text("999", encoding="ascii")  # 지난 실행이 남긴 PID — 지워져야 한다

        def fake_run(cmd, **_kw):
            if cmd[0] == "taskkill":
                return self.done(0)
            self.assertFalse(self.pid.exists())
            self.pid.write_text("4321", encoding="ascii")  # ps1 이 Excel PID 를 적은 뒤 멈춤
            raise subprocess.TimeoutExpired(cmd, 5)

        err, run = self._call(fake_run)
        self.assertEqual(err.code, "excel_failed")
        self.assertEqual(run.call_args_list[1].args[0], ["taskkill", "/F", "/PID", "4321", "/FI", "IMAGENAME eq EXCEL.EXE"])

    def test_PidFile_이_비었거나_숫자가_아니면_taskkill_을_부르지_않는다(self):
        for content in (b"", b"abc", b"\xff\xfe", None):
            def fake_run(cmd, content=content, **_kw):
                if cmd[0] == "taskkill":
                    return self.done(0)
                if content is not None:
                    self.pid.write_bytes(content)
                raise subprocess.TimeoutExpired(cmd, 5)

            err, run = self._call(fake_run)
            self.assertEqual(err.code, "excel_failed", repr(content))
            self.assertEqual([c.args[0][0] for c in run.call_args_list], [run.call_args_list[0].args[0][0]])


if __name__ == "__main__":
    unittest.main()
