"""서버 대상 조회·실행 조건 보고 (네트워크·브라우저 없이 목으로만 검증).

실행: cd scripts/moa-ratio && python -X utf8 -m unittest test_audit_targets -v
"""
import os
import unittest
from unittest import mock

import audit

COND = {
    "requestId": "00000000-0000-4000-8000-000000000001",
    "line": "조건: 2년제 · 수시 · 접수 마감 전 — 대상 1건",
}
TARGET_ROW = {
    "serviceId": 9001001,
    "universityName": "테스트대학교A",
    "serviceName": "수시",
    "operatorName": "운영자A",
}
ENV = {
    "RATIO_AUDIT_KIND": "page",
    "RATIO_AUDIT_REQUEST_ID": COND["requestId"],
    "OPS_CONSOLE_BASE_URL": "https://ops.test",
    "CRON_SECRET": "s",
    "MOA_USERNAME": "u",
    "MOA_PASSWORD": "p",
    "MANUAL_CODE_FILE": "manual.txt",
    "RATIO_AUDIT_DRY_RUN": "true",
}


class FakeRes:
    def __init__(self, status_code, body=None, text=""):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self._body = body
        self.text = text

    def json(self):
        if self._body is None:
            raise ValueError("not json")
        return self._body


class FakeHttp:
    def __init__(self, res):
        self.res = res
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append({"url": url, **kwargs})
        return self.res


class FetchTargetsTest(unittest.TestCase):
    def test_대상_조회는_요청_id_를_쿼리로_보낸다(self):
        http = FakeHttp(FakeRes(200, {"ok": True, "targets": [TARGET_ROW], "condition": COND}))
        targets, cond = audit.fetch_targets("https://ops.test", "s", COND["requestId"], http=http)
        self.assertEqual(http.calls[0]["url"], "https://ops.test/api/ratio-audit/targets")
        self.assertEqual(http.calls[0]["params"], {"requestId": COND["requestId"]})
        self.assertEqual(list(targets), [9001001])
        self.assertEqual(cond, COND)

    def test_대상_조회_실패는_ASCII_코드와_이유를_담는다(self):
        http = FakeHttp(
            FakeRes(409, {"ok": False, "code": "missing_filters", "error": "실행 조건이 없는 요청입니다"})
        )
        with self.assertRaises(audit.TargetsUnavailable) as cm:
            audit.fetch_targets("https://ops.test", "s", COND["requestId"], http=http)
        self.assertIn("409 missing_filters", str(cm.exception))
        self.assertIn("실행 조건이 없는 요청입니다", str(cm.exception))

    def test_JSON_이_아닌_오류_본문은_앞_200자만_담는다(self):
        http = FakeHttp(FakeRes(502, None, text="x" * 500))
        with self.assertRaises(audit.TargetsUnavailable) as cm:
            audit.fetch_targets("https://ops.test", "s", COND["requestId"], http=http)
        self.assertIn("502", str(cm.exception))
        self.assertNotIn("x" * 201, str(cm.exception))


class BuildPayloadTest(unittest.TestCase):
    def test_결과에_서버가_준_조건을_그대로_싣는다(self):
        p = audit.build_payload("page", 0, [], [], [], COND)
        self.assertEqual(p["condition"], COND)
        self.assertEqual(p["scannedCount"], 0)
        self.assertEqual(p["kind"], "page")
        self.assertEqual(
            set(p), {"kind", "scannedCount", "findings", "linkErrors", "skipped", "condition"}
        )


class MainGateTest(unittest.TestCase):
    def _run(self, env, fetch=None):
        with mock.patch.dict(os.environ, env, clear=True), \
                mock.patch.object(audit, "fetch_targets", fetch or mock.Mock()) as f, \
                mock.patch.object(audit.scrape, "setup_driver") as drv, \
                mock.patch.object(audit.scrape, "sms_urls", return_value=[]), \
                mock.patch.object(audit, "_report", return_value=7) as rep:
            code = audit.main()
        return code, f, drv, rep

    def test_요청_id_가_없으면_대상_조회도_로그인도_안_한다(self):
        env = {k: v for k, v in ENV.items() if k != "RATIO_AUDIT_REQUEST_ID"}
        code, fetch, drv, rep = self._run(env)
        self.assertEqual(code, 1)
        fetch.assert_not_called()
        drv.assert_not_called()
        rep.assert_not_called()

    def test_대상_조회가_거절되면_로그인_전에_멈춘다(self):
        fetch = mock.Mock(side_effect=audit.TargetsUnavailable("targets 409 missing_filters: x"))
        code, _, drv, rep = self._run(ENV, fetch)
        self.assertEqual(code, 1)
        drv.assert_not_called()
        rep.assert_not_called()

    def test_대상이_0건이면_Moa_에_로그인하지_않는다(self):
        fetch = mock.Mock(return_value=({}, COND))
        code, _, drv, rep = self._run(ENV, fetch)
        self.assertEqual(code, 7)
        drv.assert_not_called()
        payload = rep.call_args.args[0]
        self.assertEqual(payload["condition"], COND)
        self.assertEqual(payload["scannedCount"], 0)
        self.assertEqual(payload["findings"], [])


if __name__ == "__main__":
    unittest.main()
