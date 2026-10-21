#!/usr/bin/env python3
"""setup_driver 크롬 시작 재시도 + chromedriver 로그 단위 테스트 (실제 크롬 실행 안 함).

실행: cd scripts/moa-closing && python test_driver_retry.py

재현 근거(2026-10-21 09:02): 회사 PC 부하 중 `SessionNotCreatedException: Chrome instance
exited` 한 번으로 실행 전체가 끝났고, chromedriver 로그를 안 남겨 원인 기록이 없었다.
"""
import os
import tempfile
import unittest
from unittest import mock

from selenium.common.exceptions import SessionNotCreatedException, WebDriverException

import scrape


class SetupDriverRetryTest(unittest.TestCase):
    def setUp(self):
        # Service 가 로그 파일을 열어 둔 채 남으므로 Windows 정리 오류는 무시한다.
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.addCleanup(self.tmp.cleanup)
        self.log_path = os.path.join(self.tmp.name, "chromedriver.log")
        env = mock.patch.dict(os.environ, {"CLOSING_USE_UC": ""})
        env.start()
        self.addCleanup(env.stop)
        log = mock.patch.object(scrape, "CHROMEDRIVER_LOG", self.log_path)
        log.start()
        self.addCleanup(log.stop)
        sleep = mock.patch.object(scrape.time, "sleep")
        self.sleep = sleep.start()
        self.addCleanup(sleep.stop)

    def _run(self, side_effect):
        with mock.patch.object(scrape.webdriver, "Chrome", side_effect=side_effect) as chrome:
            try:
                result = scrape.setup_driver(self.tmp.name, True)
            except Exception as e:  # noqa: BLE001
                return chrome, None, e
            return chrome, result, None

    def test_retries_once_after_session_not_created(self):
        driver = mock.MagicMock()
        chrome, result, err = self._run([SessionNotCreatedException("exited"), driver])
        self.assertIsNone(err)
        self.assertIs(result, driver)
        self.assertEqual(chrome.call_count, 2)
        self.sleep.assert_called_once_with(scrape.DRIVER_RETRY_WAIT_SEC)

    def test_fails_after_two_session_not_created(self):
        chrome, result, err = self._run(
            [SessionNotCreatedException("a"), SessionNotCreatedException("b")]
        )
        self.assertIsInstance(err, SessionNotCreatedException)
        self.assertEqual(chrome.call_count, 2)

    def test_other_webdriver_exception_is_not_retried(self):
        chrome, result, err = self._run([WebDriverException("boom")])
        self.assertIsInstance(err, WebDriverException)
        self.assertNotIsInstance(err, SessionNotCreatedException)
        self.assertEqual(chrome.call_count, 1)
        self.sleep.assert_not_called()

    def test_service_gets_log_path(self):
        chrome, _, _ = self._run([mock.MagicMock()])
        service = chrome.call_args.kwargs["service"]
        self.assertEqual(service.log_output.name, self.log_path)
        self.assertIn("--verbose", service.service_args)
        service.log_output.close()


if __name__ == "__main__":
    unittest.main()
