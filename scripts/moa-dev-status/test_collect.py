import contextlib
import io
import json
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from selenium.common.exceptions import TimeoutException, WebDriverException

# `python -I` 는 스크립트 폴더를 넣지 않는다 — 자기 폴더와 Moa 로그인 모듈 폴더를 직접 넣는다.
_HERE = Path(__file__).resolve().parent
for _p in (_HERE.parent / "moa-closing", _HERE):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

from collect import (  # noqa: E402
    AJAX_JS,
    FILL_JS,
    SERIALIZE_JS,
    SMS_CONSUMER,
    WORK_STATUS_URL,
    build_env,
    check_serialized,
    collect_range,
    fetch_work_status,
    login_with_retry,
    post_ingest,
    post_run_log,
    run,
    success_message,
)
from parse import DevStatusFailure  # noqa: E402
from sms_inbox import LeaseHeldError  # noqa: E402
from test_parse import NAME, page, row  # noqa: E402

KST = timezone(timedelta(hours=9))
S, E = "2026-03-01", "2027-05-17"
OK_SERIAL = f"Manager=&Developer=&CategoryName=&ApplyFromTime={S}&ApplyToTime={E}"
NOW = datetime(2026, 11, 18, 0, 30, tzinfo=timezone.utc)  # KST 수 09:30
ENV = {
    "username": "u",
    "password": "p",
    "sms_urls": ["https://make.test/hook"],
    "sms_timeout": 90,
    "sms_interval": 3,
    "wait_sec": 1,
    "base_url": "https://ops.test",
    "secret": "s3cret",
    "sms_consumer": SMS_CONSUMER,
    "download_dir": "unused",
}
RERUN = "Start-ScheduledTask -TaskName 'OPS-Console-Ops-Weekly-Dev-Status'"


class FakeDriver:
    def __init__(self, serialized=OK_SERIAL, ajax=None, get_error=None, ajax_error=None):
        self.serialized = serialized
        self.get_error = get_error
        self.ajax_error = ajax_error
        self.ajax = ajax if ajax is not None else {"status": 200, "body": page([row()])}
        self.visited = []
        self.fill_args = None
        self.async_calls = []
        self.script_timeout = None
        self.quit_calls = 0

    def get(self, url):
        self.visited.append(url)
        if self.get_error:
            raise self.get_error

    def execute_script(self, js, *args):
        if js == FILL_JS:
            self.fill_args = args
            return None
        if js == SERIALIZE_JS:
            return self.serialized
        return True  # 폼 준비 확인

    def set_script_timeout(self, sec):
        self.script_timeout = sec

    def execute_async_script(self, js, *args):
        self.async_calls.append(js)
        if self.ajax_error:
            raise self.ajax_error
        return self.ajax

    def quit(self):
        self.quit_calls += 1


class FakeLogin:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def __call__(self, env):
        self.calls += 1
        out = self.outcomes.pop(0)
        if isinstance(out, BaseException):
            raise out
        return out


class FakeResp:
    def __init__(self, status=200, payload=None, bad_json=False):
        self.status_code = status
        self._payload = payload
        self._bad_json = bad_json

    def json(self):
        if self._bad_json:
            raise ValueError("not json")
        return self._payload


class Post:
    def __init__(self, url, kwargs):
        self.url = url
        self.kwargs = kwargs
        self.json = kwargs.get("json")


class FakeHttp:
    def __init__(self, ingest=None, run_log=None):
        self.ingest = ingest or FakeResp(200, {"ok": True, "received": 1, "dev": 0, "test": 1})
        self.run_log = run_log or FakeResp(200, {"ok": True})
        self.posts = []

    def post(self, url, **kwargs):
        self.posts.append(Post(url, kwargs))
        if isinstance(self.run_log, Exception) and url.endswith("/run-log"):
            raise self.run_log
        if isinstance(self.ingest, Exception) and not url.endswith("/run-log"):
            raise self.ingest
        return self.run_log if url.endswith("/run-log") else self.ingest

    def run_log_bodies(self):
        return [p.json for p in self.posts if p.url.endswith("/run-log")]


class Base(unittest.TestCase):
    def assertCode(self, fn, code):
        with self.assertRaises(DevStatusFailure) as cm:
            fn()
        self.assertEqual(cm.exception.code, code)
        return cm.exception


class RangeTest(Base):
    def test_범위_3월1일_경계_KST(self):
        self.assertEqual(
            collect_range(datetime(2026, 2, 28, 14, 59, tzinfo=timezone.utc)),
            ("2025-03-01", "2026-08-28"),
        )
        self.assertEqual(  # UTC 로는 전날
            collect_range(datetime(2026, 2, 28, 15, 30, tzinfo=timezone.utc)),
            ("2026-03-01", "2026-09-01"),
        )

    def test_범위_없는_날은_말일(self):
        self.assertEqual(collect_range(datetime(2026, 8, 31, 1, 0, tzinfo=KST))[1], "2027-02-28")
        self.assertEqual(  # 윤년
            collect_range(datetime(2027, 8, 31, 1, 0, tzinfo=KST))[1], "2028-02-29"
        )


class EnvTest(Base):
    def test_SMS_CONSUMER_는_env로_안_바뀐다(self):
        self.assertEqual(SMS_CONSUMER, "ops-weekly-dev-status")
        self.assertEqual(
            build_env({"SMS_CONSUMER": "closing", "sms_consumer": "closing"})["sms_consumer"],
            "ops-weekly-dev-status",
        )

    def test_env_이름은_마감과_같다(self):
        env = build_env(
            {
                "MOA_USERNAME": "u",
                "MOA_PASSWORD": "p",
                "MAKE_SMS_CODE_URL": "https://a",
                "MAKE_SMS_CODE_URL_2": "https://b",
                "OPS_CONSOLE_BASE_URL": "https://ops.test/",
                "CRON_SECRET": "x",
                "TEMP": "C:\\T",
            }
        )
        self.assertEqual(env["username"], "u")
        self.assertEqual(env["password"], "p")
        self.assertEqual(env["sms_urls"], ["https://a", "https://b"])
        self.assertEqual((env["sms_timeout"], env["sms_interval"], env["wait_sec"]), (90, 3, 40))
        self.assertEqual(env["base_url"], "https://ops.test")
        self.assertEqual(env["secret"], "x")
        self.assertEqual(Path(env["download_dir"]), Path("C:\\T") / "moa-dev-status")


class SerializedTest(Base):
    def test_직렬화_담당자_남음(self):
        self.assertCode(
            lambda: check_serialized(
                "Manager=kim&Developer=&CategoryName=&ApplyFromTime=2026-03-01&ApplyToTime=2027-05-17", S, E
            ),
            "form_not_set",
        )

    def test_직렬화_수시_남음(self):
        self.assertCode(
            lambda: check_serialized(
                f"Manager=&Developer=&CategoryName=%EC%88%98%EC%8B%9C&ApplyFromTime={S}&ApplyToTime={E}", S, E
            ),
            "form_not_set",
        )

    def test_직렬화_키_없음(self):
        self.assertCode(
            lambda: check_serialized(f"Developer=&CategoryName=&ApplyFromTime={S}&ApplyToTime={E}", S, E),
            "form_not_set",
        )

    def test_직렬화_날짜_틀림(self):
        self.assertCode(
            lambda: check_serialized(
                f"Manager=&Developer=&CategoryName=&ApplyFromTime={S}&ApplyToTime=", S, E
            ),
            "form_not_set",
        )

    def test_직렬화_이유에_값을_싣지_않는다(self):
        err = self.assertCode(
            lambda: check_serialized(f"Manager=kim&Developer=&CategoryName=&ApplyFromTime={S}&ApplyToTime={E}", S, E),
            "form_not_set",
        )
        self.assertIn("Manager", err.reason)
        self.assertNotIn("kim", err.reason)

    def test_직렬화_정상(self):
        check_serialized(OK_SERIAL, S, E)

    def test_직렬화_실제_모양은_통과(self):
        # 정찰 본문의 키 모양(UnivServiceID 두 번, 토큰) — 토큰 값은 자리값
        check_serialized(
            f"Manager=&Developer=&ApplyFromTime={S}&ApplyToTime={E}&UnivServiceID=&UnivServiceID="
            "&ServiceType=&CategoryName=&__RequestVerificationToken=tok",
            S, E,
        )

    def test_직렬화_날짜는_키로_본다(self):
        err = self.assertCode(  # 값은 다 있지만 칸이 뒤바뀜
            lambda: check_serialized(
                f"Manager=&Developer=&CategoryName=&ApplyFromTime={E}&ApplyToTime={S}", S, E
            ),
            "form_not_set",
        )
        self.assertEqual(err.reason, "ApplyFromTime 값이 다름")
        self.assertNotIn(S, err.reason)
        self.assertNotIn(E, err.reason)

    def test_직렬화_종료일_키_없음(self):
        err = self.assertCode(
            lambda: check_serialized(
                f"Manager=&Developer=&CategoryName=&ApplyFromTime={S}&To={E}", S, E
            ),
            "form_not_set",
        )
        self.assertEqual(err.reason, "ApplyToTime 키 없음")


class FetchTest(Base):
    def test_조회_정상(self):
        drv = FakeDriver()
        body = fetch_work_status(drv, S, E, 1)
        self.assertEqual(body, page([row()]))
        self.assertEqual(drv.visited, [WORK_STATUS_URL])
        self.assertEqual(drv.fill_args, (S, E))
        self.assertEqual(drv.script_timeout, 120)
        self.assertEqual(drv.async_calls, [AJAX_JS])

    def test_AJAX_요청부는_spec_원문(self):
        self.assertIn(
            "$.ajax({url:'/Develop/WorkStatus',type:'POST',data:$('#form0').serialize(),"
            "headers:{'X-Requested-With':'XMLHttpRequest'}})",
            AJAX_JS,
        )
        self.assertIn(".done((b,_,x)=>done({status:x.status, body:b}))", AJAX_JS)
        self.assertIn('.fail(x=>done({status:x.status, body:""}))', AJAX_JS)

    def test_FILL_은_여섯_칸을_비우고_날짜를_넣는다(self):
        for el in (
            "ddlManager", "ddlDeveloper", "ddlCategoryName",
            "txtUnivServiceID", "txtServiceType", "txtServiceName",
            "txtApplyFromTime", "txtApplyToTime", "input", "change",
        ):
            self.assertIn(el, FILL_JS)

    def test_조회_직렬화_실패면_ajax_를_안_부른다(self):
        drv = FakeDriver(serialized=f"Manager=kim&Developer=&CategoryName=&ApplyFromTime={S}&ApplyToTime={E}")
        with self.assertRaises(DevStatusFailure):
            fetch_work_status(drv, S, E, 1)
        self.assertEqual(drv.async_calls, [])

    def test_조회_스크립트_타임아웃은_fetch_failed_타입만(self):
        drv = FakeDriver(ajax_error=TimeoutException(f"script timeout {NAME}"))
        err = self.assertCode(lambda: fetch_work_status(drv, S, E, 1), "fetch_failed")
        self.assertEqual(err.reason, "TimeoutException")

    def test_조회_WebDriver_오류는_fetch_failed_타입만(self):
        drv = FakeDriver(get_error=WebDriverException(f"chrome gone {NAME}"))
        err = self.assertCode(lambda: fetch_work_status(drv, S, E, 1), "fetch_failed")
        self.assertEqual(err.reason, "WebDriverException")

    def test_조회_403(self):
        drv = FakeDriver(ajax={"status": 403, "body": ""})
        err = self.assertCode(lambda: fetch_work_status(drv, S, E, 1), "fetch_failed")
        self.assertEqual(err.reason, "HTTP 403")


class LoginRetryTest(Base):
    def test_재시도_409_두번_뒤_성공(self):
        drv = FakeDriver()
        sleeps = []
        login = FakeLogin(
            [LeaseHeldError("closing", "t"), LeaseHeldError("closing", "t"), (drv, "우편함")]
        )
        with contextlib.redirect_stdout(io.StringIO()):
            got = login_with_retry(ENV, login=login, sleep=sleeps.append)
        self.assertEqual(got, (drv, "우편함"))
        self.assertEqual(sleeps, [240, 240])
        self.assertEqual(login.calls, 3)

    def test_재시도_세번_모두_409(self):
        sleeps = []
        login = FakeLogin([LeaseHeldError("closing", "t")] * 3)
        with contextlib.redirect_stdout(io.StringIO()):
            err = self.assertCode(
                lambda: login_with_retry(ENV, login=login, sleep=sleeps.append), "lease_busy"
            )
        self.assertIn("closing", err.reason)
        self.assertEqual(login.calls, 3)
        self.assertEqual(sleeps, [240, 240])

    def test_409_아닌_예외는_한번(self):
        sleeps = []
        login = FakeLogin([RuntimeError("캡차 노출")])
        err = self.assertCode(
            lambda: login_with_retry(ENV, login=login, sleep=sleeps.append), "login_failed"
        )
        self.assertEqual(err.reason, "RuntimeError: 캡차 노출")
        self.assertEqual(login.calls, 1)
        self.assertEqual(sleeps, [])


class IngestTest(Base):
    def test_인제스트_리다이렉트는_실패(self):
        http = FakeHttp(ingest=FakeResp(307, None))
        self.assertCode(lambda: post_ingest("https://ops.test", "s", [(1000001, "-")], http=http),
                        "ingest_failed")
        self.assertIs(http.posts[0].kwargs["allow_redirects"], False)

    def test_인제스트_200_HTML은_실패(self):
        http = FakeHttp(ingest=FakeResp(200, bad_json=True))
        err = self.assertCode(
            lambda: post_ingest("https://ops.test", "s", [(1000001, "-")], http=http),
            "ingest_failed",
        )
        self.assertEqual(err.reason, "HTTP 200")

    def test_인제스트_네트워크_오류는_ingest_failed_타입만(self):
        http = FakeHttp(ingest=requests.exceptions.ConnectTimeout(f"timeout {NAME}"))
        err = self.assertCode(
            lambda: post_ingest("https://ops.test", "s", [(1000001, "-")], http=http),
            "ingest_failed",
        )
        self.assertEqual(err.reason, "ConnectTimeout")

    def test_인제스트_ok_가_아니면_실패(self):
        http = FakeHttp(ingest=FakeResp(200, {"ok": False, "error": "x"}))
        self.assertCode(lambda: post_ingest("https://ops.test", "s", [(1000001, "-")], http=http),
                        "ingest_failed")

    def test_인제스트_본문(self):
        http = FakeHttp()
        resp = post_ingest("https://ops.test", "s3cret", [(1000001, "-")], http=http)
        self.assertTrue(resp["ok"])
        p = http.posts[0]
        self.assertTrue(p.url.endswith("/api/ops-weekly/dev-status"))
        self.assertEqual(p.json, {"rows": [{"service_id": 1000001, "test_open": "-"}]})
        self.assertEqual(p.kwargs["headers"]["Authorization"], "Bearer s3cret")
        self.assertEqual(p.kwargs["timeout"], 30)

    def test_run_log_는_예외를_삼키고_1000자로_자른다(self):
        http = FakeHttp(run_log=ConnectionError("down"))
        with contextlib.redirect_stdout(io.StringIO()):
            post_run_log("https://ops.test", "s", "failed", "가" * 1500, http=http)
        self.assertEqual(len(http.run_log_bodies()[0]["message"]), 1000)
        self.assertEqual(http.run_log_bodies()[0]["status"], "failed")
        self.assertTrue(http.posts[0].url.endswith("/api/ops-weekly/dev-status/run-log"))


class MessageTest(Base):
    def test_성공_문구(self):
        self.assertEqual(
            success_message(
                {"ok": True, "received": 1463, "dev": 158, "test": 1305}, S, E, "우편함"
            ),
            "수집 1,463건 — 테스트 1,305 · 개발 158 · 범위 2026-03-01~2027-05-17 (SMS: 우편함)",
        )


class RunTest(Base):
    def _run(self, html, *, dry_run=False, env=ENV, http=None):
        drv = FakeDriver()
        login = FakeLogin([(drv, "우편함")])
        http = http or FakeHttp()
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            rc = run(
                env, now=NOW, dry_run=dry_run, login=login,
                fetch=lambda d, s, e, w: html, http=http, sleep=lambda s: None,
            )
        return rc, http, out.getvalue(), drv, login

    def test_실패면_인제스트_안_하고_재실행_명령을_붙인다(self):
        rc, http, _, drv, _ = self._run(page([row(cells=7)]))
        self.assertEqual(rc, 1)
        self.assertEqual([c.url for c in http.posts if c.url.endswith("/dev-status")], [])
        msg = http.run_log_bodies()[-1]["message"]
        self.assertTrue(msg.startswith("row_shape: "))
        self.assertIn(RERUN, msg)
        self.assertEqual(http.run_log_bodies()[-1]["status"], "failed")
        self.assertEqual(drv.quit_calls, 1)

    def test_이름이_stdout과_run_log에_없다(self):
        for html in (page([row(cells=7)]), page([row("1000001"), row("1000002", "-")])):
            rc, http, out, _, _ = self._run(html)
            self.assertNotIn(NAME, out)
            self.assertNotIn(NAME, json.dumps([p.json for p in http.posts], ensure_ascii=False))

    def test_성공이면_인제스트_뒤_성공_기록(self):
        http = FakeHttp(ingest=FakeResp(200, {"ok": True, "received": 2, "dev": 1, "test": 1}))
        rc, http, out, drv, _ = self._run(page([row("1000001"), row("1000002", "-")]), http=http)
        self.assertEqual(rc, 0)
        self.assertEqual(
            http.posts[0].json["rows"],
            [{"service_id": 1000001, "test_open": "2026-11-10 14:00:00"},
             {"service_id": 1000002, "test_open": "-"}],
        )
        self.assertEqual(
            http.run_log_bodies(),
            [{"status": "success",
              "message": "수집 2건 — 테스트 1 · 개발 1 · 범위 2026-03-01~2027-05-18 (SMS: 우편함)"}],
        )
        self.assertEqual(drv.quit_calls, 1)

    def test_dry_run은_아무것도_안_보낸다(self):
        rc, http, out, _, _ = self._run(page([row("1000001"), row("1000002", "-")]), dry_run=True)
        self.assertEqual(rc, 0)
        self.assertEqual(http.posts, [])
        self.assertIn("2건", out)

    def test_env_누락은_로그인_전에_실패(self):
        env = {**ENV, "username": ""}
        rc, http, _, _, login = self._run(page([row()]), env=env)
        self.assertEqual(rc, 1)
        self.assertEqual(login.calls, 0)
        msg = http.run_log_bodies()[-1]["message"]
        self.assertTrue(msg.startswith("env_missing: "))
        self.assertIn("username", msg)

    def test_조회_타임아웃은_단계_코드로_기록(self):
        s, e = collect_range(NOW)  # 직렬화 확인을 통과해 ajax 까지 가야 한다
        drv = FakeDriver(
            serialized=f"Manager=&Developer=&CategoryName=&ApplyFromTime={s}&ApplyToTime={e}",
            ajax_error=TimeoutException("t"),
        )
        http = FakeHttp()
        with contextlib.redirect_stdout(io.StringIO()):
            rc = run(ENV, now=NOW, dry_run=False, login=FakeLogin([(drv, "우편함")]),
                     http=http, sleep=lambda s: None)
        self.assertEqual(rc, 1)
        self.assertTrue(
            http.run_log_bodies()[-1]["message"].startswith("fetch_failed: TimeoutException — 재실행: ")
        )
        self.assertEqual(drv.quit_calls, 1)

    def test_인제스트_네트워크_오류는_단계_코드로_기록(self):
        http = FakeHttp(ingest=requests.exceptions.ConnectionError("down"))
        rc, http, _, _, _ = self._run(page([row()]), http=http)
        self.assertEqual(rc, 1)
        self.assertTrue(
            http.run_log_bodies()[-1]["message"].startswith("ingest_failed: ConnectionError — 재실행: ")
        )

    def test_로그인_뒤_예상_밖_예외는_타입_이름만(self):
        drv = FakeDriver()
        http = FakeHttp()

        def boom(d, s, e, w):
            raise KeyError(NAME)

        with contextlib.redirect_stdout(io.StringIO()) as out:
            rc = run(ENV, now=NOW, dry_run=False, login=FakeLogin([(drv, "우편함")]),
                     fetch=boom, http=http, sleep=lambda s: None)
        self.assertEqual(rc, 1)
        msg = http.run_log_bodies()[-1]["message"]
        self.assertTrue(msg.startswith("unexpected: KeyError — 재실행: "))
        self.assertNotIn(NAME, msg)
        self.assertNotIn(NAME, out.getvalue())
        self.assertEqual(drv.quit_calls, 1)


if __name__ == "__main__":
    unittest.main()
