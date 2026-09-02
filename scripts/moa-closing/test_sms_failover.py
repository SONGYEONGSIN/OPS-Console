#!/usr/bin/env python3
"""SMS 웹훅 이중화 단위 테스트 (네트워크 불필요).

실행: cd scripts/moa-closing && python test_sms_failover.py

make 계정을 둘 두고 같은 문자함을 두 경로로 읽는다(무료 한도 대비). 한쪽이
죽으면 다른 쪽으로 넘어가되, **고른 뒤에는 흐름 내내 그 URL 만 쓴다.**

섞으면 안 되는 이유: baseline 을 A 에서 읽고 폴링을 B 에서 하면, 두 시나리오의
동기화 시점이 달라 B 에 남아 있던 지난 SMS 가 baseline 과 달라 보인다 →
만료된 코드를 새 코드로 오인한다(2026-08-06 사고와 같은 형태).
"""
import unittest

import requests

import scrape


class FakeResp:
    def __init__(self, text: str):
        self.text = text

    def raise_for_status(self) -> None:
        pass


class PickBaselineTest(unittest.TestCase):
    def setUp(self):
        self._orig_get = scrape.requests.get
        self.seen: list[str] = []

    def tearDown(self):
        scrape.requests.get = self._orig_get

    def _stub(self, mapping: dict):
        """URL → 결과(문자열이면 본문, Exception 이면 raise)."""

        def fake_get(url, timeout=None):
            self.seen.append(url)
            item = mapping[url]
            if isinstance(item, Exception):
                raise item
            return FakeResp(item)

        scrape.requests.get = fake_get

    def test_첫_웹훅이_살아_있으면_그걸_쓴다(self):
        self._stub({"A": "인증번호 [123456]"})
        url, baseline = scrape.pick_baseline(["A", "B"], interval_sec=0)
        self.assertEqual(url, "A")
        self.assertEqual(baseline, "123456")

    def test_두번째_웹훅은_건드리지_않는다(self):
        """A 가 살아 있으면 B 로 GET 을 보내지 않는다 — 큐 과적 시 요청을 늘리면 안 된다."""
        self._stub({"A": "인증번호 [123456]"})
        scrape.pick_baseline(["A", "B"], interval_sec=0)
        self.assertNotIn("B", self.seen)

    def test_첫_웹훅이_죽으면_두번째로_넘어간다(self):
        self._stub({
            "A": requests.RequestException("boom"),
            "B": "인증번호 [654321]",
        })
        url, baseline = scrape.pick_baseline(["A", "B"], attempts=1, interval_sec=0)
        self.assertEqual(url, "B")
        self.assertEqual(baseline, "654321")

    def test_고른_URL_을_돌려준다_폴링이_그것만_쓰도록(self):
        """URL 을 안 돌려주면 호출부가 A 로 baseline, B 로 폴링하게 된다 —
        그게 만료 코드를 새 코드로 오인하는 경로다."""
        self._stub({
            "A": requests.RequestException("boom"),
            "B": "인증번호 [654321]",
        })
        url, _ = scrape.pick_baseline(["A", "B"], attempts=1, interval_sec=0)
        self.assertNotEqual(url, "A")

    def test_본문에_코드가_없어도_그_웹훅은_살아_있다(self):
        """첫 실행이라 문자가 없는 것과 웹훅이 죽은 것은 다르다 — 넘어가지 않는다."""
        self._stub({"A": "", "B": "인증번호 [999999]"})
        url, baseline = scrape.pick_baseline(["A", "B"], interval_sec=0)
        self.assertEqual(url, "A")
        self.assertIsNone(baseline)

    def test_전부_죽으면_중단한다(self):
        self._stub({
            "A": requests.RequestException("boom"),
            "B": requests.RequestException("boom"),
        })
        with self.assertRaises(RuntimeError) as ctx:
            scrape.pick_baseline(["A", "B"], attempts=1, interval_sec=0)
        self.assertIn("MAKE_SMS_CODE_URL", str(ctx.exception))

    def test_웹훅이_하나뿐이어도_된다(self):
        """백업을 안 넣은 PC 가 있다 — 한 개짜리도 그대로 돈다."""
        self._stub({"A": "인증번호 [111111]"})
        url, baseline = scrape.pick_baseline(["A"], interval_sec=0)
        self.assertEqual(url, "A")
        self.assertEqual(baseline, "111111")


class SmsUrlsFromEnvTest(unittest.TestCase):
    def test_주소_두_개를_순서대로_모은다(self):
        self.assertEqual(scrape.sms_urls({"MAKE_SMS_CODE_URL": "A", "MAKE_SMS_CODE_URL_2": "B"}), ["A", "B"])

    def test_백업이_없으면_하나만(self):
        self.assertEqual(scrape.sms_urls({"MAKE_SMS_CODE_URL": "A"}), ["A"])

    def test_빈_값은_버린다(self):
        """env 에 키만 있고 값이 비어 있으면 그 URL 로 GET 해봐야 낭비다."""
        self.assertEqual(scrape.sms_urls({"MAKE_SMS_CODE_URL": "A", "MAKE_SMS_CODE_URL_2": "  "}), ["A"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
