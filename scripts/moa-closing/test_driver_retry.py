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
        env = mock.patch.dict(os.environ, {"CLOSING_USE_UC": ""})
        env.start()
        self.addCleanup(env.stop)
        self.services = []

        def make_service(*args, **kwargs):
            svc = mock.MagicMock(name=f"service{len(self.services) + 1}")
            svc.init_kwargs = kwargs
            self.services.append(svc)
            return svc

        svc_patch = mock.patch.object(scrape, "Service", side_effect=make_service)
        svc_patch.start()
        self.addCleanup(svc_patch.stop)
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

    def test_failed_attempt_service_is_stopped_before_retry(self):
        chrome, _, err = self._run([SessionNotCreatedException("x"), mock.MagicMock()])
        self.assertIsNone(err)
        self.assertEqual(len(self.services), 2)
        self.assertIsNot(self.services[0], self.services[1])
        self.services[0].stop.assert_called_once()
        self.services[1].stop.assert_not_called()
        self.assertIs(chrome.call_args_list[0].kwargs["service"], self.services[0])
        self.assertIs(chrome.call_args_list[1].kwargs["service"], self.services[1])

    def test_service_stopped_on_non_retried_failure(self):
        _, _, err = self._run([WebDriverException("boom")])
        self.assertIsInstance(err, WebDriverException)
        self.services[0].stop.assert_called_once()

    def test_stop_error_does_not_mask_original(self):
        def boom(*a, **k):
            raise OSError("stop failed")

        orig = scrape.Service
        self.services.clear()
        chrome_effects = [SessionNotCreatedException("a"), SessionNotCreatedException("b")]
        with mock.patch.object(scrape.webdriver, "Chrome", side_effect=chrome_effects):
            def make(*a, **k):
                svc = mock.MagicMock()
                svc.stop.side_effect = boom
                return svc

            with mock.patch.object(scrape, "Service", side_effect=make):
                with self.assertRaises(SessionNotCreatedException):
                    scrape.setup_driver(self.tmp.name, True)

    def test_success_does_not_stop_service(self):
        self._run([mock.MagicMock()])
        self.services[0].stop.assert_not_called()

    def test_no_driver_log_is_configured(self):
        # verbose/INFO 로그는 send_keys 로 보낸 비밀번호·SMS 코드를 평문으로 남긴다.
        self._run([mock.MagicMock()])
        kwargs = self.services[0].init_kwargs
        self.assertNotIn("log_output", kwargs)
        self.assertNotIn("--verbose", kwargs.get("service_args") or [])


if __name__ == "__main__":
    unittest.main()
