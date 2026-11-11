"""contract.py — 단계 결과 계약과 오케스트레이터 규칙.

앞 단계 실패가 그 결과에 기대지 않는 뒤 단계를 막으면, Moa 로그인 하나가 막혀도
현황 파일 갱신까지 통째로 멈춘다. 반대로 기대는 단계는 반드시 건너뛰어야 한다 —
빈 목록으로 06 을 다시 쓰면 전부 '세종만'이 된다.
"""
import json
import unittest
from pathlib import Path

from contract import (
    FAILURE_CODES,
    FIRST_WATERMARK,
    SMS_CONSUMER,
    STEP_IDS,
    Context,
    Step,
    StepFailure,
    StepResult,
    build_body,
    run_steps,
)


def ctx(**kw) -> Context:
    base = dict(
        request_id="req-1",
        watermarks={},
        dry_run=False,
        work_dir=Path("."),
        results={},
    )
    return Context(**{**base, **kw})


def _raise(exc: Exception):
    def run(_c):
        raise exc

    return run


class TestRunSteps(unittest.TestCase):
    def test_앞_단계가_실패해도_기대지_않는_뒤_단계는_돈다(self):
        seen = []
        a = Step("a", _raise(StepFailure("lease_busy")))
        b = Step("b", lambda c: seen.append("b") or StepResult("b", "ok", "끝"))
        r = run_steps([a, b], ctx())
        self.assertEqual(
            [(x.step, x.status, x.error_code) for x in r],
            [("a", "failed", "lease_busy"), ("b", "ok", None)],
        )
        self.assertEqual(seen, ["b"])

    def test_기대는_단계가_실패하면_건너뛴다(self):
        seen = []
        a = Step("a", _raise(StepFailure("moa_empty")))
        b = Step("b", lambda c: seen.append("b") or StepResult("b", "ok", "끝"), needs=("a",))
        r = run_steps([a, b], ctx())
        self.assertEqual((r[1].step, r[1].status, r[1].error_code), ("b", "skipped", "dependency_failed"))
        self.assertEqual(seen, [])

    def test_기대는_단계가_목록에_없어도_건너뛴다(self):
        # --steps 로 앞 단계를 빼고 돌리면 결과가 없다 — ok 가 아니므로 기대는 단계는 못 돈다.
        b = Step("b", lambda c: StepResult("b", "ok", "끝"), needs=("a",))
        r = run_steps([b], ctx())
        self.assertEqual((r[0].status, r[0].error_code), ("skipped", "dependency_failed"))

    def test_예상_못한_예외는_클래스_이름만(self):
        r = run_steps([Step("a", _raise(ValueError("010-0000-0001")))], ctx())
        self.assertEqual((r[0].status, r[0].error_code, r[0].detail), ("failed", "unknown", "ValueError"))
        self.assertNotIn("010-0000", json.dumps(r[0].to_json(), ensure_ascii=False))

    def test_뒤_단계는_앞_결과를_본다(self):
        seen = []

        def b_run(c: Context) -> StepResult:
            seen.append(c.results["a"].status)
            return StepResult("b", "ok", "끝")

        a = Step("a", lambda c: StepResult("a", "ok", "앞"))
        run_steps([a, Step("b", b_run, needs=("a",))], ctx())
        self.assertEqual(seen, ["ok"])

    def test_처음_ctx_는_바꾸지_않는다(self):
        c = ctx()
        run_steps([Step("a", lambda _c: StepResult("a", "ok", "앞"))], c)
        self.assertEqual(c.results, {})


class TestStepFailure(unittest.TestCase):
    def test_모르는_코드는_만들_수_없다(self):
        with self.assertRaises(ValueError):
            StepFailure("nope")

    def test_코드와_detail(self):
        e = StepFailure("locked", "423")
        self.assertEqual((e.code, e.detail), ("locked", "423"))


class TestBody(unittest.TestCase):
    def test_본문(self):
        ok = StepResult("a", "ok", "가" * 301, counts={"rows": 3}, changes=("x 추가",))
        bad = StepResult("b", "failed", "실패", error_code="locked", detail="나" * 301, changes=("y 삭제", "z 삭제"))
        body = build_body("req-1", [ok, bad])
        self.assertEqual(body["id"], "req-1")
        self.assertFalse(body["ok"])
        self.assertEqual(body["result"]["version"], 1)
        self.assertEqual(body["result"]["changes"], ["x 추가", "y 삭제", "z 삭제"])
        s0, s1 = body["result"]["steps"]
        self.assertEqual(len(s0["summary"]), 300)
        self.assertEqual(s0["counts"], {"rows": 3})
        self.assertIsNone(s0["error"])
        self.assertEqual(s1["error"]["code"], "locked")
        self.assertEqual(len(s1["error"]["detail"]), 300)

    def test_changes_는_서버_상한으로_자른다(self):
        # 넘기면 서버가 본문 전체를 400 으로 버린다 — 결과가 통째로 사라진다.
        r = StepResult("a", "ok", "끝", changes=tuple("다" * 301 for _ in range(250)))
        changes = build_body("r", [r])["result"]["changes"]
        self.assertEqual(len(changes), 200)
        self.assertEqual(len(changes[0]), 300)

    def test_모두_ok_면_ok(self):
        body = build_body("r", [StepResult("a", "ok", "끝")])
        self.assertTrue(body["ok"])

    def test_결과가_없으면_ok_아님(self):
        self.assertFalse(build_body("r", [])["ok"])

    def test_detail_없는_실패는_code_만(self):
        j = StepResult("a", "failed", "실패", error_code="unknown").to_json()
        self.assertEqual(j["error"], {"code": "unknown"})

    def test_watermark_는_있을_때만_값(self):
        self.assertIsNone(StepResult("a", "ok", "끝").to_json()["watermark"])
        j = StepResult("a", "ok", "끝", watermark="2026-11-07T01:00:00Z").to_json()
        self.assertEqual(j["watermark"], "2026-11-07T01:00:00Z")


class TestConstants(unittest.TestCase):
    def test_상수(self):
        self.assertEqual(SMS_CONSUMER, "sms-status-refresh")
        self.assertEqual(FIRST_WATERMARK, "2026-10-16T15:00:00Z")
        self.assertEqual(STEP_IDS, ("mail", "moa", "pims", "workbook"))
        for code in ("mail_config", "mail_folder_missing", "mail_access_denied", "mail_failed"):
            self.assertIn(code, FAILURE_CODES)
        self.assertIn("dependency_failed", FAILURE_CODES)
        self.assertIn("unknown", FAILURE_CODES)
        for code in ("pims_login_failed", "pims_empty", "pims_shape_changed", "pims_incomplete"):
            self.assertIn(code, FAILURE_CODES)


if __name__ == "__main__":
    unittest.main()
