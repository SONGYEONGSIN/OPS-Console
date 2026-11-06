"""poll-local.ps1 · register-poll-task.ps1 원문 대조 — PowerShell 은 이 PC 에서 돌려 볼 수 없다
(작업 등록·Moa 로그인이 실제로 일어난다). 그래서 지켜야 할 줄이 있는지를 원문으로 본다.

주석 줄('#' 로 시작)은 지운 뒤 대조한다 — 주석에만 남은 규칙은 규칙이 아니다.
"""
import re
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

    def test_로그에_요청자_메일을_남기지_않는다(self):
        self.assertNotIn("requested_by", self.poll)


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


class TestEncoding(unittest.TestCase):
    def test_ps1_은_BOM_있는_UTF8(self):
        # 이 PC 의 Windows PowerShell 5.1 은 BOM 없는 파일을 CP949 로 읽어 한글 문자열이 깨진다.
        for name in ("poll-local.ps1", "register-poll-task.ps1"):
            self.assertTrue((HERE / name).read_bytes().startswith(b"\xef\xbb\xbf"), name)


if __name__ == "__main__":
    unittest.main()
