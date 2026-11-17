"""run-local.ps1 · register-task.ps1 원문 대조 — PowerShell 은 이 PC 에서 돌려 볼 수 없다
(작업 등록·Moa 로그인(SMS 발송)이 실제로 일어난다). 그래서 지켜야 할 줄이 있는지를 원문으로 본다.

주석 줄('#' 로 시작)은 지운 뒤 대조한다 — 주석에만 남은 규칙은 규칙이 아니다.
"""
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
BOM = b"\xef\xbb\xbf"


def code_of(name: str) -> str:
    text = (HERE / name).read_text(encoding="utf-8-sig")
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


class TestRunLocal(unittest.TestCase):
    ps = code_of("run-local.ps1")

    def test_BOM(self):
        self.assertTrue((HERE / "run-local.ps1").read_bytes().startswith(BOM))

    def test_마감_실행_중이면_기다린다(self):
        self.assertIn("Get-ScheduledTask -TaskName 'OPS-Console-Closing-Scrape'", self.ps)
        self.assertIn("'Running'", self.ps)
        self.assertRegex(self.ps, r"Start-Sleep -Seconds 30")
        self.assertRegex(self.ps, r"AddMinutes\(25\)")

    def test_대기_시작과_종료를_로그에_남긴다(self):
        self.assertIn("대기 시작", self.ps)
        self.assertIn("마감 스크랩 종료 확인", self.ps)
        self.assertIn("TotalMinutes", self.ps)

    def test_작업을_못_찾으면_진행하고_로그에_남긴다(self):
        self.assertIn("-ErrorAction SilentlyContinue", self.ps)

    def test_인터프리터_와_종료코드(self):
        self.assertIn(r'python -I -X utf8 -u "scripts\moa-dev-status\collect.py"', self.ps)
        self.assertIn('$ErrorActionPreference = "Continue"', self.ps)
        self.assertIn("$LASTEXITCODE", self.ps)
        self.assertIn("run-local.log", self.ps)
        self.assertIn("exit $code", self.ps)

    def test_python_출력은_UTF8_로_해석하고_되돌린다(self):
        # python 은 -X utf8 로 쓰는데 PS 5.1 은 네이티브 출력을 [Console]::OutputEncoding(CP949)로 읽는다 —
        # 안 맞추면 run-local.log 의 [FAIL]·트레이스백 한글이 깨진다(sms-status-refresh/poll-local.ps1 선례).
        call = self.ps.index(r'python -I -X utf8 -u "scripts\moa-dev-status\collect.py"')
        save = self.ps.index("$prevOut = [Console]::OutputEncoding")
        set_ = self.ps.index("[Console]::OutputEncoding = [Text.Encoding]::UTF8")
        restore = self.ps.index("[Console]::OutputEncoding = $prevOut")
        self.assertLess(save, set_)
        self.assertLess(set_, call)
        self.assertLess(call, restore)
        # 콘솔이 없는 세션이면 바꾸기가 던진다 — 실행을 막지 않게 try/catch 안에서 한다.
        before = self.ps[save:set_]
        self.assertIn("try", before)
        self.assertIn("catch", self.ps[set_:call])


class TestRegister(unittest.TestCase):
    ps = code_of("register-task.ps1")

    def test_BOM(self):
        self.assertTrue((HERE / "register-task.ps1").read_bytes().startswith(BOM))

    def test_트리거_설정(self):
        for s in ('"OPS-Console-Ops-Weekly-Dev-Status"', "-DaysOfWeek Wednesday -At 09:30am",
                  "-MultipleInstances IgnoreNew", "-StartWhenAvailable", "-WakeToRun",
                  "New-TimeSpan -Minutes 45", "LogonType S4U", "[switch]$StorePassword"):
            self.assertIn(s, self.ps)


class TestGitignore(unittest.TestCase):
    def test_로그_무시(self):
        lines = (HERE.parent.parent / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn("scripts/moa-dev-status/run-local.log", lines)


if __name__ == "__main__":
    unittest.main()
