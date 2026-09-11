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

    @mock.patch("sms_inbox.requests.post")
    def test_예외_문구에_비밀키가_실리지_않는다(self, post):
        # requests 는 헤더 값에 공백·줄바꿈이 섞이면 InvalidHeader 문구에 값을 그대로 담는다.
        # 그 문구가 [WARN] 으로 stdout → git 추적 로그·run-log 로 흘러간다(보안 리뷰 H1).
        secret = "s3cr3t-real-value-" + "x" * 46
        post.side_effect = requests.exceptions.InvalidHeader(
            f"Invalid leading whitespace in header value: 'Bearer {secret}\\n'"
        )
        with self.assertRaises(sms_inbox.InboxUnavailable) as ctx:
            sms_inbox.reset_inbox("https://ops", secret, "closing")
        self.assertNotIn(secret, str(ctx.exception))
        self.assertNotIn(secret[:12], str(ctx.exception))
        self.assertIn("InvalidHeader", str(ctx.exception))


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
    def test_pop_이_계속_401이면_타임아웃_문구에_마지막_응답이_실린다(self, post, sleep, monotonic):
        # JSON 본문이 있는 비200(키 회전·500)을 '문자 미도착'으로 오진하지 않는다(보안 리뷰 M2).
        post.return_value = _resp(401, {"ok": False, "error": "unauthorized"})
        monotonic.side_effect = [0, 0, 2, 4, 6, 8, 10]
        with self.assertRaises(RuntimeError) as ctx:
            sms_inbox.poll_inbox_code("https://ops", "sec", "closing", timeout_sec=4)
        msg = str(ctx.exception)
        self.assertIn("우편함", msg)
        self.assertIn("401", msg)
        self.assertIn("unauthorized", msg)

    @mock.patch("sms_inbox.time.sleep")
    @mock.patch("sms_inbox.requests.post")
    def test_pop_409_의_holder_는_자기_이름이_아니다(self, post, sleep):
        post.return_value = _resp(409, {"ok": False, "error": "lease-not-held"})
        with self.assertRaises(sms_inbox.LeaseHeldError) as ctx:
            sms_inbox.poll_inbox_code("https://ops", "sec", "closing", timeout_sec=30)
        self.assertNotEqual(ctx.exception.holder, "closing")

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


class PrepareSmsSource(unittest.TestCase):
    """scrape.prepare_sms_source — 제출 '전'에 소스를 하나 고른다 (설계 §6.2, T8)."""

    ENV = {
        "base_url": "https://ops",
        "secret": "cron",
        "sms_consumer": "closing",
        "sms_urls": ["https://make/A", "https://make/B"],
        "sms_timeout": 90,
        "sms_interval": 3,
    }

    def setUp(self):
        import scrape  # noqa: WPS433 — selenium 이 있는 모듈은 여기서만 부른다

        self.scrape = scrape

    @mock.patch("scrape.requests.get")
    @mock.patch("sms_inbox.reset_inbox", return_value=0)
    def test_우편함이_살아_있으면_make_를_한_번도_부르지_않는다(self, reset, get):
        # 이 테스트가 이번 변경의 존재 이유다 — make 크레딧 0.
        src = self.scrape.prepare_sms_source(dict(self.ENV))
        self.assertEqual(src.kind, "inbox")
        reset.assert_called_once_with("https://ops", "cron", "closing")
        get.assert_not_called()

    @mock.patch("scrape.requests.get")
    @mock.patch("sms_inbox.reset_inbox", side_effect=sms_inbox.LeaseHeldError("ratio-audit", "09:00"))
    def test_409면_중단하고_make_를_부르지_않는다(self, reset, get):
        with self.assertRaises(RuntimeError) as ctx:
            self.scrape.prepare_sms_source(dict(self.ENV))
        self.assertIsInstance(ctx.exception, sms_inbox.LeaseHeldError)
        get.assert_not_called()

    @mock.patch("scrape.pick_baseline", return_value=("https://make/A", "111111"))
    @mock.patch("sms_inbox.reset_inbox", side_effect=sms_inbox.InboxUnavailable("HTTP 500"))
    def test_우편함_장애면_pick_baseline_으로_간다(self, reset, pick):
        src = self.scrape.prepare_sms_source(dict(self.ENV))
        self.assertEqual((src.kind, src.url, src.baseline), ("make", "https://make/A", "111111"))
        pick.assert_called_once_with(["https://make/A", "https://make/B"])

    @mock.patch("scrape.pick_baseline", return_value=("https://make/A", None))
    @mock.patch("sms_inbox.reset_inbox")
    def test_base_url_secret_이_없으면_우편함을_건드리지_않고_make(self, reset, pick):
        # discover.py 처럼 창구 키가 없는 호출자 호환.
        env = {k: v for k, v in self.ENV.items() if k not in ("base_url", "secret")}
        src = self.scrape.prepare_sms_source(env)
        self.assertEqual(src.kind, "make")
        reset.assert_not_called()

    @mock.patch("scrape.requests.get")
    @mock.patch("sms_inbox.reset_inbox")
    def test_폴링_타임아웃이_리스_TTL_이상이면_제출_전에_막는다(self, reset, get):
        # 리스가 폴링 중에 만료되면 pop 409 가 '남이 가져갔다'로 오진된다(보안 리뷰 L5).
        # SMS 가 발송되기 전(prepare 단계)에 설정 오류로 세운다.
        env = {**self.ENV, "sms_timeout": sms_inbox.INBOX_TTL_SEC}
        with self.assertRaises(RuntimeError) as ctx:
            self.scrape.prepare_sms_source(env)
        self.assertIn("MOA_SMS_POLL_TIMEOUT_SEC", str(ctx.exception))
        reset.assert_not_called()
        get.assert_not_called()

    @mock.patch("scrape.pick_baseline", return_value=("https://make/A", None))
    @mock.patch("sms_inbox.reset_inbox")
    def test_sms_consumer_가_없어도_make(self, reset, pick):
        env = {k: v for k, v in self.ENV.items() if k != "sms_consumer"}
        self.assertEqual(self.scrape.prepare_sms_source(env).kind, "make")
        reset.assert_not_called()


class AwaitSmsCode(unittest.TestCase):
    ENV = PrepareSmsSource.ENV

    def setUp(self):
        import scrape

        self.scrape = scrape

    @mock.patch("scrape.poll_fresh_sms_code")
    @mock.patch("sms_inbox.poll_inbox_code", return_value="130753")
    def test_inbox_면_우편함만_본다(self, poll_inbox, poll_make):
        code = self.scrape.await_sms_code(sms_inbox.SmsSource("inbox"), dict(self.ENV))
        self.assertEqual(code, "130753")
        poll_inbox.assert_called_once_with("https://ops", "cron", "closing", 90)
        poll_make.assert_not_called()

    @mock.patch("scrape.poll_fresh_sms_code", return_value="222222")
    @mock.patch("sms_inbox.poll_inbox_code")
    def test_make_면_기존_baseline_diff_폴링(self, poll_inbox, poll_make):
        src = sms_inbox.SmsSource("make", "https://make/A", "111111")
        self.assertEqual(self.scrape.await_sms_code(src, dict(self.ENV)), "222222")
        poll_make.assert_called_once_with("https://make/A", "111111", 90, 3)
        poll_inbox.assert_not_called()

    def test_run_log_문구용_라벨(self):
        # 폴백이 조용히 일어나면 크레딧이 계속 타는데 아무도 모른다 — 실행 기록에 남긴다.
        self.assertEqual(self.scrape.sms_source_label(sms_inbox.SmsSource("inbox")), "우편함")
        self.assertEqual(self.scrape.sms_source_label(sms_inbox.SmsSource("make", "u", None)), "make")


if __name__ == "__main__":
    unittest.main()
