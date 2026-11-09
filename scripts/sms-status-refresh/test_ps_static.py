"""poll-local.ps1 · register-poll-task.ps1 원문 대조 — PowerShell 은 이 PC 에서 돌려 볼 수 없다
(작업 등록·Moa 로그인이 실제로 일어난다). 그래서 지켜야 할 줄이 있는지를 원문으로 본다.

주석 줄('#' 로 시작)은 지운 뒤 대조한다 — 주석에만 남은 규칙은 규칙이 아니다.
"""
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def code_of(name: str) -> str:
    text = (HERE / name).read_text(encoding="utf-8-sig")
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


class TestPollLocal(unittest.TestCase):
    poll = code_of("poll-local.ps1")

    def test_결과_파일을_바이트로_보낸다(self):
        # 문자열로 읽어 보내면 Windows PowerShell 5.1 이 ISO-8859-1 로 바꿔 한글이 물음표가 된다.
        self.assertIn("[IO.File]::ReadAllBytes(", self.poll)
        self.assertNotRegex(self.poll, r"body\.json[^\n]*ConvertFrom-Json")
        self.assertNotRegex(self.poll, r"\$bodyPath[^\n]*ConvertFrom-Json")
        self.assertNotIn("Get-Content $bodyPath", self.poll)

    def test_최소_본문도_UTF8_바이트로_보낸다(self):
        # 실패 보고 message 에는 한글 tail 이 섞인다.
        self.assertIn("[Text.Encoding]::UTF8.GetBytes(", self.poll)
        self.assertIn("application/json; charset=utf-8", self.poll)

    def test_경로_심박_인터프리터(self):
        self.assertIn("/api/sms-status-refresh/request", self.poll)
        self.assertIn('-PollerId "sms-status-refresh"', self.poll)
        self.assertIn("python -I -X utf8 -u", self.poll)
        self.assertIn("scripts\\sms-status-refresh\\refresh.py", self.poll)
        for arg in ("--request-id", "--work-dir", "--watermarks", "--out"):
            self.assertIn(arg, self.poll)

    def test_실행_구간만_Continue(self):
        self.assertIn('$ErrorActionPreference = "Stop"', self.poll)
        self.assertIn('$ErrorActionPreference = "Continue"', self.poll)

    def test_작업_폴더는_남김_설정이_없으면_지운다(self):
        self.assertIn("SMS_STATUS_REFRESH_KEEP_WORK", self.poll)
        self.assertIn("Remove-Item", self.poll)

    def test_404_는_다시_보내지_않는다(self):
        # 서버가 404 = 진행 중인 그 요청이 없다(이미 보고됐거나 마감됨). 다시 보내도 또 404 다.
        self.assertIn("-eq 404", self.poll)
        self.assertIn("Get-HttpStatus", self.poll)

    def test_최소_본문의_tail_은_정리한_것만(self):
        self.assertIn("Get-SafeTail", self.poll)
        self.assertRegex(self.poll, r'Get-MinimalBody \$id "exit \$code — \$\(Get-SafeTail')

    def test_로그에_요청자_메일을_남기지_않는다(self):
        self.assertNotIn("requested_by", self.poll)


def function_text(source: str, name: str) -> str:
    """'function 이름' 줄부터 맨 앞 칸의 '}' 줄까지."""
    lines = source.splitlines()
    start = next(i for i, l in enumerate(lines) if l.startswith(f"function {name}"))
    end = next(i for i in range(start, len(lines)) if lines[i] == "}")
    return "\n".join(lines[start : end + 1])


@unittest.skipUnless(shutil.which("powershell"), "Windows PowerShell 없음")
class TestSafeTail(unittest.TestCase):
    """Get-SafeTail 만 떼어 Windows PowerShell 5.1 로 돌린다(네트워크·등록 없음)."""

    def run_tail(self, lines: list[str]) -> str:
        fn = function_text((HERE / "poll-local.ps1").read_text(encoding="utf-8-sig"), "Get-SafeTail")
        arr = ", ".join("'" + l.replace("'", "''") + "'" for l in lines)
        script = f"[Console]::OutputEncoding = [Text.Encoding]::UTF8\n{fn}\nGet-SafeTail @({arr})"
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "t.ps1"
            path.write_text(script, encoding="utf-8-sig")
            out = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(path)],
                capture_output=True, timeout=60,
            )
        self.assertEqual(out.returncode, 0, out.stderr.decode("utf-8", "replace"))
        return out.stdout.decode("utf-8").strip()

    def test_태그와_예외_이름만_남는다(self):
        got = self.run_tail([
            "[DUMP:login] url=https://moa.example/User/Login?x=1 title='점검'",
            "[STEP:moa:failed:login_failed]",
            "RuntimeError: 로그인 실패 — 010-0000-0001",
            '  File "C:\\x\\scrape.py", line 3',
        ])
        self.assertEqual(got, "[STEP:moa:failed:login_failed] / RuntimeError / -")
        self.assertNotIn("http", got)
        self.assertNotIn("010", got)

    def test_마지막_세_줄만(self):
        got = self.run_tail(["[A]", "[B]", "[C]", "[D]"])
        self.assertEqual(got, "[B] / [C] / [D]")


class TestRegister(unittest.TestCase):
    reg = code_of("register-poll-task.ps1")

    def test_실행_제한_30분_로그온_세션만(self):
        self.assertIn("-ExecutionTimeLimit (New-TimeSpan -Minutes 30)", self.reg)
        self.assertIn("IgnoreNew", self.reg)
        self.assertNotIn("S4U", self.reg)
        self.assertNotIn("-Password", self.reg)
        self.assertNotRegex(self.reg, r"(?m)^\s*param\(")

    def test_작업_이름과_5분_반복(self):
        self.assertIn('"OPS-Console-Sms-Status-Refresh-Poll"', self.reg)
        self.assertIn("-RepetitionInterval (New-TimeSpan -Minutes 5)", self.reg)
        self.assertIn("scripts\\sms-status-refresh\\poll-local.ps1", self.reg)


class TestExcelApply(unittest.TestCase):
    """excel_apply.ps1 — Excel 을 띄워 볼 수 없으니(실 파일을 만진다) 지켜야 할 줄을 원문으로 본다."""
    xl = code_of("excel_apply.ps1")

    def test_COM_안전_설정(self):
        # 매크로 강제 비활성(3)·경고 끔·이벤트 끔 — 현황 파일의 매크로가 열리는 순간 돌면 안 된다.
        self.assertIn("AutomationSecurity = 3", self.xl)
        self.assertIn("DisplayAlerts = $false", self.xl)
        self.assertIn("EnableEvents = $false", self.xl)

    def test_시트를_지우지_않고_같은_자리에서_비운다(self):
        # 시트를 지웠다 만들면 다른 시트·이름 정의가 가리키던 참조가 #REF! 로 끊긴다.
        self.assertNotIn(".Delete(", self.xl)
        self.assertIn("$ws.AutoFilterMode = $false", self.xl)
        self.assertIn("$ws.Cells.Clear()", self.xl)
        self.assertIn("$ws.Rows.RowHeight = $ws.StandardHeight", self.xl)

    def test_자기_PID_를_남긴다(self):
        # COM 으로 뜬 Excel 은 pwsh 의 자식이 아니라 Python 이 시간 초과 때 이 파일의 PID 만 죽인다.
        self.assertRegex(self.xl, r"\[Parameter\(Mandatory = \$true\)\]\[string\]\$PidFile")
        self.assertRegex(self.xl, r"Set-Content[^\n]*\$PidFile|Out-File[^\n]*\$PidFile")
        self.assertIn("-notcontains", self.xl)  # 먼저 떠 있던 Excel 은 뺀다
        self.assertNotRegex(self.xl, r"Stop-Process[^\n]*-Name|Get-Process EXCEL[^\n]*Stop-Process")

    def test_저장은_한_번(self):
        self.assertEqual(self.xl.count("$wb.Save()"), 1)
        self.assertNotIn("SaveAs", self.xl)
        # 실패하면 저장 없이 닫고 다시 던진다.
        self.assertIn("$wb.Close($false)", self.xl)
        self.assertRegex(self.xl, r"(?m)^\s*throw\s*$")


class TestEncoding(unittest.TestCase):
    def test_ps1_은_BOM_있는_UTF8(self):
        # 이 PC 의 Windows PowerShell 5.1 은 BOM 없는 파일을 CP949 로 읽어 한글 문자열이 깨진다.
        for name in ("poll-local.ps1", "register-poll-task.ps1", "excel_apply.ps1"):
            self.assertTrue((HERE / name).read_bytes().startswith(b"\xef\xbb\xbf"), name)


if __name__ == "__main__":
    unittest.main()
