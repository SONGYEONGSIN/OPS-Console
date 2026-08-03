#!/usr/bin/env python3
"""1차 로그인 제출 결과 판정 가드 단위 테스트 (브라우저 불필요).

실행: cd scripts/moa-closing && python test_login_guard.py

재현 근거(2026-08-03): 자격증명이 틀리면 SMS가 발송되지 않는데 그대로 폴링에
들어가 180초 뒤 'SMS 코드 폴링 타임아웃'으로 죽었다 — 원인이 로그에 안 남는다.
"""
import unittest

from selenium.common.exceptions import (
    NoAlertPresentException,
    UnexpectedAlertPresentException,
)

import scrape


class FakeEl:
    def __init__(self, displayed: bool):
        self._displayed = displayed

    def is_displayed(self) -> bool:
        return self._displayed


class FakeSwitchTo:
    def __init__(self, alert_text: str | None):
        self._alert_text = alert_text

    @property
    def alert(self):
        if self._alert_text is None:
            raise NoAlertPresentException()
        return FakeAlert(self._alert_text)


class FakeAlert:
    def __init__(self, text: str):
        self.text = text

    def accept(self) -> None:
        pass


class FakeDriver:
    """셀렉터별 노출 상태만 흉내 내는 최소 드라이버."""

    def __init__(self, visible: set[str], alert_text: str | None = None, raise_alert=False):
        self.visible = visible
        self.switch_to = FakeSwitchTo(alert_text)
        self._raise_alert = raise_alert

    def find_elements(self, by, selector):
        if self._raise_alert:
            raise UnexpectedAlertPresentException(alert_text="세션이 만료되었습니다")
        return [FakeEl(selector in self.visible)]


SMS = scrape.SELECTORS["sms_code_input"]
CAPTCHA = scrape.SELECTORS["captcha_section"]


class WaitLoginAcceptedTest(unittest.TestCase):
    def test_sms_step_visible_passes(self):
        driver = FakeDriver(visible={SMS})
        scrape._wait_login_accepted(driver, timeout_sec=1)  # 예외 없이 통과

    def test_captcha_visible_aborts_without_retry(self):
        driver = FakeDriver(visible={CAPTCHA})
        with self.assertRaises(RuntimeError) as ctx:
            scrape._wait_login_accepted(driver, timeout_sec=1)
        self.assertIn("계정 잠금 방지", str(ctx.exception))
        self.assertIn("캡차", str(ctx.exception))

    def test_no_progress_aborts_with_credential_hint(self):
        # 캡차도 SMS 단계도 안 뜨는 경우 — 180초 폴링으로 넘어가면 안 된다.
        driver = FakeDriver(visible=set())
        with self.assertRaises(RuntimeError) as ctx:
            scrape._wait_login_accepted(driver, timeout_sec=1)
        self.assertIn("계정 잠금 방지", str(ctx.exception))
        self.assertIn("MOA_PASSWORD", str(ctx.exception))

    def test_alert_text_is_surfaced(self):
        driver = FakeDriver(visible=set(), alert_text="아이디 또는 비밀번호를 확인해주세요.")
        with self.assertRaises(RuntimeError) as ctx:
            scrape._wait_login_accepted(driver, timeout_sec=1)
        self.assertIn("아이디 또는 비밀번호를 확인해주세요.", str(ctx.exception))

    def test_late_alert_during_wait_is_surfaced(self):
        # 대기 중 뒤늦게 뜬 alert은 selenium이 예외로 던진다 — 그 텍스트를 살린다.
        driver = FakeDriver(visible=set(), raise_alert=True)
        with self.assertRaises(RuntimeError) as ctx:
            scrape._wait_login_accepted(driver, timeout_sec=1)
        self.assertIn("세션이 만료되었습니다", str(ctx.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)
