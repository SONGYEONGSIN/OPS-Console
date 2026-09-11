#!/usr/bin/env python3
"""audit.login_and_2fa 수동 코드 경로(MANUAL_CODE_FILE)도 우편함 점유를 잡는다.

수동으로 인증번호를 받아 적더라도 Moa 문자는 똑같이 폰 → Tasker → 우편함으로 들어간다.
점유 없이 로그인하면 그 순간 폴링 중인 마감 스크래퍼가 그 코드를 '최신'으로 꺼내
틀린 코드를 제출한다(코드 리뷰 MEDIUM). reset(점유)만 잡고 pop 은 하지 않는다.
"""
import os
import sys
import unittest
from unittest import mock

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_HERE, "..", "moa-closing"))
sys.path.insert(0, _HERE)

import sms_inbox  # noqa: E402
import audit  # noqa: E402


class ManualCodePathHoldsLease(unittest.TestCase):
    ENV = {
        "username": "u",
        "password": "p",
        "sms_urls": ["https://make/A"],
        "sms_timeout": 120,
        "sms_interval": 3,
        "manual_code_file": "C:/tmp/moa-code.txt",
        "base_url": "https://ops",
        "secret": "cron",
        "sms_consumer": "ratio-audit",
    }

    def _login(self, env: dict) -> None:
        driver, wait = mock.MagicMock(), mock.MagicMock()
        with (
            mock.patch.object(audit.scrape, "_open_login_page"),
            mock.patch.object(audit.scrape, "_wait_login_accepted"),
            mock.patch.object(audit.scrape, "_abort_if_captcha"),
            mock.patch.object(audit, "_accept_alert_if_present", return_value=None),
            mock.patch.object(audit, "poll_manual_code", return_value="123456") as manual,
            mock.patch.object(audit.time, "sleep"),
        ):
            audit.login_and_2fa(driver, wait, env)
            manual.assert_called_once()

    @mock.patch("scrape.requests.get")
    @mock.patch("sms_inbox.poll_inbox_code")
    @mock.patch("sms_inbox.reset_inbox", return_value=0)
    def test_수동_경로도_점유를_잡고_pop_은_하지_않는다(self, reset, pop, get):
        self._login(dict(self.ENV))
        reset.assert_called_once_with("https://ops", "cron", "ratio-audit")
        pop.assert_not_called()
        get.assert_not_called()

    @mock.patch("sms_inbox.reset_inbox", side_effect=sms_inbox.LeaseHeldError("closing", "09:00:12"))
    def test_다른_스크래퍼가_점유_중이면_수동_경로도_중단(self, reset):
        with self.assertRaises(sms_inbox.LeaseHeldError):
            self._login(dict(self.ENV))

    @mock.patch("sms_inbox.reset_inbox", side_effect=sms_inbox.InboxUnavailable("HTTP 500"))
    def test_우편함_장애면_수동_경로는_그대로_진행(self, reset):
        self._login(dict(self.ENV))  # 예외 없이 끝나야 한다 — 수동 입력이 곧 폴백이다

    @mock.patch("sms_inbox.reset_inbox")
    def test_창구_키가_없으면_점유_시도_없이_진행(self, reset):
        env = {k: v for k, v in self.ENV.items() if k not in ("base_url", "secret")}
        self._login(env)
        reset.assert_not_called()


if __name__ == "__main__":
    unittest.main()
