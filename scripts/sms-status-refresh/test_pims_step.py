"""run_pims_step — PIMS 수집 단계 전체 흐름(가짜 드라이버·가짜 Graph).

가짜들은 test_pims_collect.py 것을 쓴다. 실제 로그인·네트워크는 없다.
"""
import json
import os
import unittest
from pathlib import Path

import compare
from contract import Step, run_steps
from graph import PIMS_DIR, XLSX, GraphError
from pims_collect import build_pims_xlsx, run_pims_step
from test_pims_collect import NOW, RAW_HEAD, ROWS, FakeDriver, FakeGraph, ctx, row


class TestRunStep(unittest.TestCase):
    ENV = {"MOA_USERNAME": "u", "MOA_PASSWORD": "p"}

    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in self.ENV}
        os.environ.update(self.ENV)

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def _run(self, drv=None, graph=None, dry_run=False, login=None):
        graph = graph or FakeGraph()
        seen_env: list[dict] = []

        def fake_login(env):
            seen_env.append(env)
            return drv

        # 실패 분류(StepFailure → failed/코드)는 run_steps 가 하므로 그 길로 돌린다.
        step = Step(
            "pims",
            lambda c: run_pims_step(
                c,
                login=login or fake_login,
                graph_factory=lambda: graph,
                now=lambda: NOW,
                sleep=lambda _s: None,
            ),
        )
        return run_steps([step], ctx(dry_run))[0], graph, seen_env

    def _prev(self, n: int) -> bytes:
        return build_pims_xlsx([row(f"{9000 + i}") for i in range(n)])

    def test_수집해_새_파일로_올린다(self):
        drv = FakeDriver((RAW_HEAD, ROWS, 3))
        r, graph, seen_env = self._run(drv, FakeGraph(["PIMS 등록 리스트_261109.xlsx"]))
        self.assertEqual((r.step, r.status), ("pims", "ok"))
        self.assertEqual(r.summary, "PIMS 목록 3행 저장 (PIMS 등록 리스트_261109_2.xlsx)")
        self.assertEqual(r.counts, {"rows": 3, "done": 1, "wait": 1, "bad": 1})
        folder, name, data, ctype = graph.puts[0]
        self.assertEqual((folder, name, ctype), (PIMS_DIR, "PIMS 등록 리스트_261109_2.xlsx", XLSX))
        self.assertEqual(graph.folders, [PIMS_DIR])
        self.assertTrue(data.startswith(b"PK"))
        self.assertEqual(len(compare.load_pims(data)), 3)
        self.assertEqual(drv.quits, 1)
        self.assertNotIn("sms_consumer", seen_env[0])  # 문자 인증이 없으니 우편함 리스를 잡지 않는다

    def test_내려받기_폴더는_작업_폴더(self):
        _r, _g, seen_env = self._run(FakeDriver((RAW_HEAD, ROWS, 3)))
        self.assertEqual(seen_env[0]["download_dir"], str(Path(".") / "pims-download"))

    def test_지난_파일이_있으면_변경_한_줄(self):
        graph = FakeGraph(files=[("PIMS 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", self._prev(5))])
        r, graph, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)), graph)
        self.assertEqual(r.status, "ok")
        self.assertEqual(r.changes, ("PIMS: 지난 5행 → 3행",))

    def test_지난_파일이_없으면_변경_줄_없음(self):
        r, _g, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)))
        self.assertEqual(r.changes, ())

    def test_지난_파일의_절반_미만이면_저장하지_않는다(self):
        graph = FakeGraph(files=[
            ("PIMS 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", self._prev(10)),
            ("PIMS 등록 리스트_261101.xlsx", "2026-11-01T00:00:00Z", b"broken"),
        ])
        r, graph, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)), graph)
        self.assertEqual((r.status, r.error_code), ("failed", "pims_incomplete"))
        self.assertEqual(r.detail, "지난 파일 10행 → 3행")
        self.assertEqual(graph.downloads, ["0"])  # 가장 최근 것만 본다
        self.assertEqual(graph.puts, [])

    def test_지난_파일의_절반_이상이면_올린다(self):
        graph = FakeGraph(files=[("PIMS 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", self._prev(6))])
        r, graph, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)), graph)
        self.assertEqual(r.status, "ok")
        self.assertEqual(len(graph.puts), 1)

    def test_지난_파일을_못_읽으면_비교를_건너뛴다(self):
        graph = FakeGraph(files=[
            ("PIMS 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", b"broken"),
            ("메모.xlsx", "2026-11-05T00:00:00Z", b"x"),
        ])
        r, graph, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)), graph)
        self.assertEqual(r.status, "ok")
        self.assertEqual(r.changes, ())
        self.assertEqual(graph.downloads, ["0"])  # 이름 규칙에 맞는 것만

    def test_dry_run_은_저장하지_않는다(self):
        r, graph, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)), dry_run=True)
        self.assertEqual(r.status, "ok")
        self.assertEqual(graph.puts, [])
        self.assertEqual(r.summary, "PIMS 목록 3행 · 저장 안 함(시험 실행)")
        self.assertEqual(r.counts["rows"], 3)

    def test_로그인_전에_Teams_를_먼저_본다(self):
        events: list[str] = []

        def login(_env):
            events.append("login")
            return FakeDriver((RAW_HEAD, ROWS, 3))

        graph = FakeGraph(events=events)
        r, _, _ = self._run(graph=graph, login=login)
        self.assertEqual(r.status, "ok")
        self.assertLess(events.index("teams"), events.index("login"))

    def test_Teams_폴더를_못_읽으면_로그인_전에_멈춘다(self):
        class Missing(FakeGraph):
            def children(self, path):
                raise GraphError(404)

        calls = []
        r, _, _ = self._run(graph=Missing(), login=lambda env: calls.append(env))
        self.assertEqual((r.status, r.error_code), ("failed", "source_missing"))
        self.assertEqual(calls, [])

    def test_로그인_실패는_클래스_이름만(self):
        def bad(_env):
            raise RuntimeError("010-0000-0001 로그인 거절")

        r, graph, _ = self._run(login=bad)
        self.assertEqual((r.status, r.error_code, r.detail), ("failed", "pims_login_failed", "RuntimeError"))
        dumped = json.dumps(r.to_json(), ensure_ascii=False)
        self.assertNotIn("거절", dumped)
        self.assertNotIn("010-0000", dumped)
        self.assertEqual(graph.puts, [])

    def test_계정_env_가_없으면_로그인하지_않는다(self):
        os.environ["MOA_PASSWORD"] = ""
        calls = []
        graph = FakeGraph()
        r, _, _ = self._run(graph=graph, login=lambda env: calls.append(env))
        self.assertEqual((r.status, r.error_code), ("failed", "pims_login_failed"))
        self.assertEqual(calls, [])

    def test_빈_표와_열_변경은_저장하지_않는다(self):
        cases = [
            (FakeDriver((RAW_HEAD, [], 0)), "pims_empty"),
            (FakeDriver(None, has_table=False), "pims_empty"),
            (FakeDriver(([*RAW_HEAD[:2], "번호", *RAW_HEAD[3:]], ROWS, 3)), "pims_shape_changed"),
            (FakeDriver((RAW_HEAD, ROWS, 513)), "pims_incomplete"),
            (FakeDriver((RAW_HEAD, ROWS, 3), has_select=False), "pims_shape_changed"),
        ]
        for drv, code in cases:
            r, graph, _ = self._run(drv)
            self.assertEqual((r.status, r.error_code), ("failed", code))
            self.assertEqual(graph.puts, [])
            self.assertEqual(drv.quits, 1)

    def test_요약에_번호가_없다(self):
        graph = FakeGraph(files=[("PIMS 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", self._prev(5))])
        r, _, _ = self._run(FakeDriver((RAW_HEAD, ROWS, 3)), graph)
        dumped = json.dumps(r.to_json(), ensure_ascii=False) + " ".join(r.changes)
        self.assertNotIn("010-0000", dumped)
        self.assertNotIn("02-0000", dumped)

    def test_드라이버는_항상_닫는다(self):
        drv = FakeDriver((RAW_HEAD, ROWS, 3))
        drv.fail_on_rows = True
        graph = FakeGraph()
        with self.assertRaises(RuntimeError):  # 분류는 run_steps 가 한다(unknown·클래스 이름)
            run_pims_step(
                ctx(),
                login=lambda _env: drv,
                graph_factory=lambda: graph,
                now=lambda: NOW,
                sleep=lambda _s: None,
            )
        self.assertEqual(drv.quits, 1)
        self.assertEqual(graph.puts, [])

    def test_Moa_가_실패해도_돈다(self):
        # needs 없음 — Moa 로그인 하나가 막혀도 PIMS 수집은 간다.
        from refresh import REGISTERED

        self.assertEqual(REGISTERED["pims"].id, "pims")
        self.assertEqual(REGISTERED["pims"].needs, ())


if __name__ == "__main__":
    unittest.main()
