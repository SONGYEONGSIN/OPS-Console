#!/usr/bin/env python3
"""sms_inbox — Supabase 우편함 클라이언트 (설계 §6.1, T7).

두 예외를 가르는 것이 핵심이다: 409(다른 스크래퍼가 로그인 중)는 `LeaseHeldError` 로
**중단**해야 하고, 그 밖의 장애(500·네트워크·307 HTML)만 `InboxUnavailable` 로 make 폴백을
탄다. 섞이면 SMS 두 통이 한 우편함에 겹쳐 서로의 코드를 가져간다(§3.2).
"""
import json
import os
import re
import sys
import unittest
from unittest import mock

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sms_inbox  # noqa: E402


def _resp(status: int, payload: dict | None = None, text: str | None = None):
    r = mock.Mock()
    r.status_code = status
    if payload is None:
        r.text = text or ""
        r.json.side_effect = ValueError("not json")
    else:
        r.text = json.dumps(payload)
        r.json.return_value = payload
    return r


class ResetInbox(unittest.TestCase):
    @mock.patch("sms_inbox.requests.post")
    def test_200이면_지운_건수를_돌려준다(self, post):
        post.return_value = _resp(200, {"ok": True, "cleared": 2})
        self.assertEqual(sms_inbox.reset_inbox("https://ops", "sec", "closing"), 2)
        kwargs = post.call_args.kwargs
        self.assertEqual(kwargs["json"], {"action": "reset", "consumer": "closing"})
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer sec")
        self.assertEqual(post.call_args.args[0], "https://ops/api/sms-codes/consume")

    @mock.patch("sms_inbox.requests.post")
    def test_409면_LeaseHeldError_이지_InboxUnavailable_이_아니다(self, post):
        post.return_value = _resp(
            409,
            {"ok": False, "error": "lease-held", "holder": "ratio-audit", "holderSince": "2026-09-11T09:00:12+09:00"},
        )
        with self.assertRaises(sms_inbox.LeaseHeldError) as ctx:
            sms_inbox.reset_inbox("https://ops", "sec", "closing")
        self.assertNotIsInstance(ctx.exception, sms_inbox.InboxUnavailable)
        self.assertIn("ratio-audit", str(ctx.exception))

    @mock.patch("sms_inbox.requests.post")
    def test_500이면_InboxUnavailable(self, post):
        post.return_value = _resp(500, {"ok": False, "error": "boom"})
        with self.assertRaises(sms_inbox.InboxUnavailable):
            sms_inbox.reset_inbox("https://ops", "sec", "closing")

    @mock.patch("sms_inbox.requests.post")
    def test_네트워크_오류면_InboxUnavailable(self, post):
        post.side_effect = requests.ConnectionError("down")
        with self.assertRaises(sms_inbox.InboxUnavailable):
            sms_inbox.reset_inbox("https://ops", "sec", "closing")

    @mock.patch("sms_inbox.requests.post")
    def test_307_HTML_이면_InboxUnavailable(self, post):
        # PUBLIC_PATHS 누락 시 로그인 페이지로 307 — JSON 이 아니다(F11).
        post.return_value = _resp(307, text="<html>login</html>")
        with self.assertRaises(sms_inbox.InboxUnavailable):
            sms_inbox.reset_inbox("https://ops", "sec", "closing")

    @mock.patch("sms_inbox.requests.post")
    def test_ok_false_200_도_InboxUnavailable(self, post):
        post.return_value = _resp(200, {"ok": False, "error": "weird"})
        with self.assertRaises(sms_inbox.InboxUnavailable):
            sms_inbox.reset_inbox("https://ops", "sec", "closing")


class PollInboxCode(unittest.TestCase):
    @mock.patch("sms_inbox.time.sleep")
    @mock.patch("sms_inbox.requests.post")
    def test_첫_pop_은_null_둘째에_코드(self, post, sleep):
        post.side_effect = [
            _resp(200, {"ok": True, "code": None}),
            _resp(200, {"ok": True, "code": "130753", "receivedAt": "2026-09-11T11:31:49Z"}),
        ]
        code = sms_inbox.poll_inbox_code("https://ops", "sec", "closing", timeout_sec=30)
        self.assertEqual(code, "130753")
        self.assertEqual(post.call_count, 2)
        self.assertEqual(post.call_args.kwargs["json"], {"action": "pop", "consumer": "closing"})
        sleep.assert_called_once_with(sms_inbox.INBOX_POLL_INTERVAL_SEC)

    @mock.patch("sms_inbox.time.sleep")
    @mock.patch("sms_inbox.requests.post")
    def test_409면_LeaseHeldError_로_즉시_멈춘다(self, post, sleep):
        post.return_value = _resp(409, {"ok": False, "error": "lease-not-held"})
        with self.assertRaises(sms_inbox.LeaseHeldError):
            sms_inbox.poll_inbox_code("https://ops", "sec", "closing", timeout_sec=30)
        self.assertEqual(post.call_count, 1)
        sleep.assert_not_called()

    @mock.patch("sms_inbox.time.monotonic")
    @mock.patch("sms_inbox.time.sleep")
    @mock.patch("sms_inbox.requests.post")
    def test_타임아웃이면_RuntimeError_문구에_우편함(self, post, sleep, monotonic):
        post.return_value = _resp(200, {"ok": True, "code": None})
        monotonic.side_effect = [0, 0, 2, 4, 6, 8, 10, 12]
        with self.assertRaises(RuntimeError) as ctx:
            sms_inbox.poll_inbox_code("https://ops", "sec", "closing", timeout_sec=6)
        self.assertNotIsInstance(ctx.exception, sms_inbox.LeaseHeldError)
        self.assertIn("우편함", str(ctx.exception))
        self.assertIn("6s", str(ctx.exception))
        self.assertIn("Tasker", str(ctx.exception))

    @mock.patch("sms_inbox.time.monotonic")
    @mock.patch("sms_inbox.time.sleep")
    @mock.patch("sms_inbox.requests.post")
    def test_폴링_중_일시_오류는_타임아웃까지_계속_본다(self, post, sleep, monotonic):
        # 로그인 창 90초 안의 네트워크 흔들림 하나로 문자를 버리지 않는다.
        post.side_effect = [
            requests.ConnectionError("blip"),
            _resp(500, {"ok": False, "error": "boom"}),
            _resp(200, {"ok": True, "code": "654321"}),
        ]
        monotonic.side_effect = [0, 0, 2, 4, 6]
        self.assertEqual(sms_inbox.poll_inbox_code("https://ops", "sec", "closing", timeout_sec=30), "654321")
        self.assertEqual(post.call_count, 3)


class MaskCode(unittest.TestCase):
    def test_여섯자리(self):
        self.assertEqual(sms_inbox.mask_code("123456"), "****56")

    def test_두자리_이하는_전부_가린다(self):
        self.assertEqual(sms_inbox.mask_code("12"), "**")
        self.assertEqual(sms_inbox.mask_code("1"), "**")
        self.assertEqual(sms_inbox.mask_code(""), "**")


class ModuleShape(unittest.TestCase):
    def test_selenium_을_import_하지_않는다(self):
        with open(sms_inbox.__file__, encoding="utf-8") as f:
            src = f.read()
        self.assertIsNone(re.search(r"^\s*(import|from)\s+selenium\b", src, re.M))

    def test_상수(self):
        self.assertEqual(sms_inbox.INBOX_TTL_SEC, 180)
        self.assertEqual(sms_inbox.INBOX_POLL_INTERVAL_SEC, 2)
        src = sms_inbox.SmsSource("inbox")
        self.assertEqual((src.kind, src.url, src.baseline), ("inbox", "", None))


if __name__ == "__main__":
    unittest.main()
