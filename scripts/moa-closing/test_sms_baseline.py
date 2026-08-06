#!/usr/bin/env python3
"""SMS baseline 확보 가드 단위 테스트 (네트워크 불필요).

실행: cd scripts/moa-closing && python test_sms_baseline.py

재현 근거(2026-08-06): 제출 직전 baseline GET이 RemoteDisconnected로 실패해
baseline=None이 되면 poll_fresh_sms_code의 '직전과 달라졌는가' 판정이 무력화된다.
그러면 웹훅에 남아 있던 어제 SMS를 새 코드로 오인해 만료된 코드로 2FA를 시도한다.
"""
import unittest

import requests

import scrape


class FakeResp:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self) -> None:
        pass


class FetchBaselineCodeTest(unittest.TestCase):
    def setUp(self):
        self._orig_get = scrape.requests.get
        self.calls = 0

    def tearDown(self):
        scrape.requests.get = self._orig_get

    def _stub(self, *results):
        """호출 순서대로 결과를 돌려준다. Exception이면 raise."""

        def fake_get(url, timeout=None):
            item = results[min(self.calls, len(results) - 1)]
            self.calls += 1
            if isinstance(item, Exception):
                raise item
            return FakeResp(item)

        scrape.requests.get = fake_get

    def test_returns_code_on_first_success(self):
        self._stub("[Web발신] 본인확인 인증번호는 [123456] 입니다.")
        self.assertEqual(scrape.fetch_baseline_code("http://x", interval_sec=0), "123456")
        self.assertEqual(self.calls, 1)

    def test_retries_until_webhook_answers(self):
        self._stub(
            requests.ConnectionError("Remote end closed connection"),
            "[Web발신] 본인확인 인증번호는 [654321] 입니다.",
        )
        self.assertEqual(scrape.fetch_baseline_code("http://x", interval_sec=0), "654321")
        self.assertEqual(self.calls, 2)

    def test_aborts_when_every_attempt_fails(self):
        # 여기서 None을 돌려주면 만료된 직전 코드를 새 코드로 오인한다 — 반드시 중단.
        self._stub(requests.ConnectionError("Remote end closed connection"))
        with self.assertRaises(RuntimeError) as ctx:
            scrape.fetch_baseline_code("http://x", attempts=3, interval_sec=0)
        self.assertIn("중단", str(ctx.exception))
        self.assertIn("MAKE_SMS_CODE_URL", str(ctx.exception))
        self.assertEqual(self.calls, 3)

    def test_body_without_code_is_not_an_error(self):
        # 웹훅은 응답했는데 코드가 없는 경우(첫 실행 등) — baseline None이 정상이다.
        self._stub("아직 수신된 문자가 없습니다")
        self.assertIsNone(scrape.fetch_baseline_code("http://x", interval_sec=0))
        self.assertEqual(self.calls, 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
