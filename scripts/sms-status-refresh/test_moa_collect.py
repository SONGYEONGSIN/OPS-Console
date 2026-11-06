"""moa_collect.py — Moa 발신번호 목록 수집 단계.

실제 Moa 에는 로그인하지 않는다(로그인마다 운영자 폰으로 인증 문자가 간다).
드라이버·로그인·Graph 는 전부 가짜다.

빈 표나 열이 바뀐 표를 저장하면 다음 06 대조가 전부 '세종만'으로 바뀐다 —
저장하지 않고 이 단계만 실패해야 한다.
"""
import io
import json
import os
import sys
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from openpyxl import load_workbook

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "moa-closing"))

import sms_inbox  # noqa: E402
from contract import Context, Step, StepFailure, run_steps  # noqa: E402
from graph import MOA_DIR, XLSX, DriveItem  # noqa: E402
from moa_collect import (  # noqa: E402
    MOA_COLS,
    MOA_URL,
    PREP_JS,
    ROWS_JS,
    SEARCH_JS,
    build_moa_xlsx,
    clean_table,
    collect_callback_rows,
    next_moa_name,
    run_moa_step,
)

KST = timezone(timedelta(hours=9))
NOW = datetime(2026, 11, 7, 10, 2, tzinfo=KST)
RAW_HEAD = ["UnivServiceID ⇅", "대학명 ⇅", "모집시기", "모집년도", "CallBack", "파일", "등록일자 ⇅", "등록상태", "수정"]


def row(sid: str, phone: str = "010-0000-0001", univ: str = "테스트대학교A") -> list[str]:
    return [sid, univ, "수시", "2027", phone, "", "2026-10-01", "등록완료", ""]


ROWS = [row("9001001"), row("9001002", "010-0000-0002"), row("9002001", "010-0000-0003", "테스트대학교B")]


STALE = "stale"  # 검색 전 표가 아직 그대로(표시만 달린 채 비워진 상태)
PRE = [RAW_HEAD, [row(f"90{i:05d}") for i in range(20)]]  # 검색 전 첫 화면 20행


class FakeDriver:
    """Moa 화면 흉내. 검색 전 표(pre)가 있고, Search() 뒤에는 reads 를 차례로 보여 준다(마지막은 반복).

    reads 원소: [header, rows] = 새로 그려진 표 · STALE = 아직 검색 전 표 · None = 표 없음(쪽 이동 중).
    """

    def __init__(self, table=None, *, reads=None, pre=PRE):
        self.pre = pre
        self.reads = list(reads) if reads is not None else [table]
        self.searched = False
        self.scripts: list[str] = []
        self.urls: list[str] = []
        self.quits = 0
        self.fail_on_rows = False

    def get(self, url):
        self.urls.append(url)

    def _read(self):
        state = self.reads.pop(0) if len(self.reads) > 1 else self.reads[0]
        if state is None:
            return None
        if state == STALE:
            return [self.pre[0], [], True]
        return [state[0], state[1], False]

    def execute_script(self, script, *args):
        self.scripts.append(script)
        if script == PREP_JS:
            return None if self.pre is None else True
        if script == SEARCH_JS:
            self.searched = True
            return None
        if script == ROWS_JS:
            if self.fail_on_rows:
                raise RuntimeError("010-0000-0001")
            if not self.searched:
                return None if self.pre is None else [*self.pre, False]
            return self._read()
        return None

    def quit(self):
        self.quits += 1


class FakeGraph:
    """files: [(이름, 수정 시각, 내용 bytes | None)]. 내용이 None 이면 3행짜리 지난 파일."""

    def __init__(self, names=(), files=None):
        self.files = list(files) if files is not None else [(n, "2026-11-06T00:00:00Z", None) for n in names]
        self.puts: list[tuple] = []
        self.downloads: list[str] = []

    def children(self, path):
        return [DriveItem(str(i), n, "e", t, True) for i, (n, t, _b) in enumerate(self.files)]

    def download(self, item_id):
        self.downloads.append(item_id)
        data = self.files[int(item_id)][2]
        return data if data is not None else build_moa_xlsx(clean_table(RAW_HEAD, ROWS), NOW)

    def put_new(self, folder, name, data, content_type):
        self.puts.append((folder, name, data, content_type))
        return DriveItem("new", name, "e", "", True)


def ctx(dry_run=False) -> Context:
    return Context("req-1", {}, dry_run, Path("."), {})


class TestCollect(unittest.TestCase):
    def collect(self, drv, tries=6):
        return collect_callback_rows(drv, sleep=lambda _s: None, tries=tries)

    def test_빈_조건_Search_만_부르고_수정_함수는_안_부른다(self):
        drv = FakeDriver([RAW_HEAD, ROWS])
        head, rows = self.collect(drv)
        joined = "\n".join(drv.scripts)
        self.assertIn("Search();", joined)
        self.assertNotIn("SetCallBackUpdate", joined)
        for field in ("txtServiceID", "txtUnivServiceID", "txtServiceType"):
            self.assertIn(field, joined)
        self.assertEqual(drv.urls, [MOA_URL])
        self.assertEqual((head, rows), (RAW_HEAD, ROWS))

    def test_표가_없으면_빈_값(self):
        # 세션 만료로 로그인 화면이 떠 있으면 표 자체가 없다.
        drv = FakeDriver(None, pre=None)
        self.assertEqual(self.collect(drv), ([], []))
        self.assertNotIn(SEARCH_JS, drv.scripts)

    def test_검색_전에_표를_비우고_표시를_단다(self):
        # 표시가 없으면 검색 전 화면을 두 번 읽고 '안정됐다'며 그 20행을 저장한다.
        drv = FakeDriver([RAW_HEAD, ROWS])
        self.collect(drv)
        self.assertLess(drv.scripts.index(PREP_JS), drv.scripts.index(SEARCH_JS))
        self.assertIn("data-srr-stale", PREP_JS)

    def test_검색_전_화면이_그대로면_실패(self):
        # Search() 가 아무것도 안 바꾸면(스크립트 오류 등) 검색 전 20행을 저장하면 안 된다.
        drv = FakeDriver(reads=[STALE])
        with self.assertRaises(StepFailure) as cm:
            self.collect(drv)
        self.assertEqual(cm.exception.code, "moa_incomplete")

    def test_검색_전_20행_뒤_진짜_결과(self):
        big = [row(f"9{i:06d}") for i in range(887)]
        drv = FakeDriver(reads=[STALE, STALE, None, [RAW_HEAD, big], [RAW_HEAD, big]])
        head, rows = self.collect(drv)
        self.assertEqual(len(rows), 887)

    def test_행이_계속_늘면_실패_부분_표를_돌려주지_않는다(self):
        growing = [[RAW_HEAD, [row(f"9{i:06d}") for i in range(n)]] for n in range(20, 900, 50)]
        drv = FakeDriver(reads=growing)
        with self.assertRaises(StepFailure) as cm:
            self.collect(drv, tries=6)
        self.assertEqual(cm.exception.code, "moa_incomplete")


class TestCleanTable(unittest.TestCase):
    def test_머리글_정리와_빈_수정_열_제외(self):
        got = clean_table(RAW_HEAD, ROWS)
        self.assertEqual(len(got), 3)
        self.assertEqual(got[0], ["9001001", "테스트대학교A", "수시", "2027", "010-0000-0001", "", "2026-10-01", "등록완료"])

    def test_수정_열에_값이_있으면_moa_shape_changed(self):
        rows = [*ROWS[:2], [*ROWS[2][:-1], "수정"]]
        with self.assertRaises(StepFailure) as cm:
            clean_table(RAW_HEAD, rows)
        self.assertEqual(cm.exception.code, "moa_shape_changed")

    def test_열이_바뀌면_moa_shape_changed(self):
        head = [*RAW_HEAD[:4], "발신번호", *RAW_HEAD[5:]]
        with self.assertRaises(StepFailure) as cm:
            clean_table(head, ROWS)
        self.assertEqual(cm.exception.code, "moa_shape_changed")

    def test_행_칸_수가_다르면_moa_shape_changed(self):
        with self.assertRaises(StepFailure) as cm:
            clean_table(RAW_HEAD, [*ROWS, ROWS[0][:5]])
        self.assertEqual(cm.exception.code, "moa_shape_changed")

    def test_빈_표는_moa_empty(self):
        for rows in ([], [["검색 결과가 없습니다."]]):
            with self.assertRaises(StepFailure) as cm:
                clean_table(RAW_HEAD, rows)
            self.assertEqual(cm.exception.code, "moa_empty")


class TestXlsx(unittest.TestCase):
    def test_xlsx_모양(self):
        data = build_moa_xlsx(clean_table(RAW_HEAD, ROWS), NOW)
        wb = load_workbook(io.BytesIO(data))
        ws = wb.active
        self.assertEqual(ws.title, "Moa 등록 리스트_261107")
        self.assertIn("2026-11-07 10:02", ws["A1"].value)
        self.assertIn("/Message/CallBack", ws["A1"].value)
        self.assertIn("3행", ws["A1"].value)
        self.assertTrue(ws["A1"].font.bold)
        self.assertEqual([c.value for c in ws[2]], MOA_COLS)
        self.assertTrue(ws["A2"].font.bold)
        self.assertEqual(ws.freeze_panes, "A3")
        self.assertEqual(ws.auto_filter.ref, "A2:H5")
        cells = [c for r in ws.iter_rows(min_row=3) for c in r]
        self.assertEqual(len(cells), 3 * 8)
        self.assertTrue(all(c.number_format == "@" for c in cells))
        self.assertTrue(all(c.value is None or isinstance(c.value, str) for c in cells))
        self.assertEqual(ws["A3"].value, "9001001")  # 숫자로 바뀌지 않는다


class TestName(unittest.TestCase):
    def test_같은_날_두_번째는__2(self):
        d = date(2026, 11, 7)
        self.assertEqual(next_moa_name([], d), "Moa 등록 리스트_261107.xlsx")
        self.assertEqual(next_moa_name(["Moa 등록 리스트_261107.xlsx"], d), "Moa 등록 리스트_261107_2.xlsx")
        self.assertEqual(
            next_moa_name(["Moa 등록 리스트_261107_2.xlsx", "Moa 등록 리스트_261107.xlsx"], d),
            "Moa 등록 리스트_261107_3.xlsx",
        )
        self.assertEqual(next_moa_name(["Moa 등록 리스트_261104.xlsx"], d), "Moa 등록 리스트_261107.xlsx")


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
            return drv, "우편함"

        # 실패 분류(StepFailure → failed/코드)는 run_steps 가 하므로 그 길로 돌린다.
        step = Step(
            "moa",
            lambda c: run_moa_step(
                c,
                login=login or fake_login,
                graph_factory=lambda: graph,
                now=lambda: NOW,
                sleep=lambda _s: None,
            ),
        )
        return run_steps([step], ctx(dry_run))[0], graph, seen_env

    def test_수집해_새_파일로_올린다(self):
        drv = FakeDriver([RAW_HEAD, ROWS])
        r, graph, seen_env = self._run(drv, FakeGraph(["Moa 등록 리스트_261107.xlsx"]))
        self.assertEqual((r.step, r.status), ("moa", "ok"))
        self.assertEqual(r.summary, "Moa 3행 수집 · Moa 등록 리스트_261107_2.xlsx 저장 (SMS: 우편함)")
        self.assertEqual(r.counts, {"rows": 3, "services": 3, "univs": 2})
        folder, name, data, ctype = graph.puts[0]
        self.assertEqual((folder, name, ctype), (MOA_DIR, "Moa 등록 리스트_261107_2.xlsx", XLSX))
        self.assertTrue(data.startswith(b"PK"))
        self.assertEqual(seen_env[0]["sms_consumer"], "sms-status-refresh")
        self.assertEqual(drv.quits, 1)

    def test_지난_파일의_절반_미만이면_저장_안_함(self):
        # 지난번 10행 → 이번 3행: 화면을 덜 읽은 것일 가능성이 크다. 저장하면 06 이 '세종만'으로 바뀐다.
        prev = build_moa_xlsx([[f"90{i:05d}", "테스트대학교A", "수시", "2027", "010-0000-0001", "", "2026-10-01", "등록완료"] for i in range(10)], NOW)
        graph = FakeGraph(files=[
            ("Moa 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", prev),
            ("Moa 등록 리스트_261101.xlsx", "2026-11-01T00:00:00Z", b"broken"),
        ])
        r, graph, _ = self._run(FakeDriver([RAW_HEAD, ROWS]), graph)
        self.assertEqual((r.status, r.error_code), ("failed", "moa_incomplete"))
        self.assertEqual(r.detail, "지난 파일 10행 → 3행")
        self.assertEqual(graph.downloads, ["0"])  # 가장 최근 것만 본다
        self.assertEqual(graph.puts, [])

    def test_지난_파일과_비슷하면_올린다(self):
        prev = build_moa_xlsx([[f"90{i:05d}", "테스트대학교A", "수시", "2027", "010-0000-0001", "", "2026-10-01", "등록완료"] for i in range(5)], NOW)
        graph = FakeGraph(files=[("Moa 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", prev)])
        r, graph, _ = self._run(FakeDriver([RAW_HEAD, ROWS]), graph)
        self.assertEqual(r.status, "ok")
        self.assertEqual(len(graph.puts), 1)

    def test_지난_파일을_못_읽으면_비교를_건너뛴다(self):
        graph = FakeGraph(files=[
            ("Moa 등록 리스트_261104.xlsx", "2026-11-04T00:00:00Z", b"broken"),
            ("메모.xlsx", "2026-11-05T00:00:00Z", b"x"),
        ])
        r, graph, _ = self._run(FakeDriver([RAW_HEAD, ROWS]), graph)
        self.assertEqual(r.status, "ok")
        self.assertEqual(graph.downloads, ["0"])  # 이름 규칙에 맞는 것만

    def test_내려받기_폴더는_작업_폴더(self):
        _r, _g, seen_env = self._run(FakeDriver([RAW_HEAD, ROWS]))
        self.assertEqual(seen_env[0]["download_dir"], str(Path(".") / "moa-download"))

    def test_빈_표는_moa_empty_저장_안_함(self):
        drv = FakeDriver([RAW_HEAD, []])
        r, graph, _ = self._run(drv)
        self.assertEqual((r.status, r.error_code), ("failed", "moa_empty"))
        self.assertEqual(graph.puts, [])

    def test_열이_바뀌면_저장_안_함(self):
        drv = FakeDriver([[*RAW_HEAD[:4], "발신번호", *RAW_HEAD[5:]], ROWS])
        r, graph, _ = self._run(drv)
        self.assertEqual((r.status, r.error_code), ("failed", "moa_shape_changed"))
        self.assertEqual(graph.puts, [])

    def test_리스_점유는_lease_busy(self):
        def busy(_env):
            raise sms_inbox.LeaseHeldError("closing", "2026-11-07T01:00:00Z")

        r, graph, _ = self._run(login=busy)
        self.assertEqual((r.status, r.error_code), ("failed", "lease_busy"))
        self.assertEqual(graph.puts, [])

    def test_로그인_실패는_login_failed(self):
        def bad(_env):
            raise RuntimeError("로그인 거절")

        r, _, _ = self._run(login=bad)
        self.assertEqual((r.status, r.error_code), ("failed", "login_failed"))
        self.assertNotIn("거절", json.dumps(r.to_json(), ensure_ascii=False))

    def test_계정_env_가_없으면_로그인하지_않는다(self):
        os.environ["MOA_PASSWORD"] = ""
        calls = []
        r, _, _ = self._run(login=lambda env: calls.append(env))
        self.assertEqual((r.status, r.error_code), ("failed", "login_failed"))
        self.assertEqual(calls, [])

    def test_Teams_폴더를_못_읽으면_로그인_전에_멈춘다(self):
        # 인증 문자를 보내고 나서 저장할 곳이 없다는 걸 알면 문자 한 통이 헛된다.
        from graph import GraphError

        class Missing(FakeGraph):
            def children(self, path):
                raise GraphError(404)

        calls = []
        r, _, _ = self._run(graph=Missing(), login=lambda env: calls.append(env))
        self.assertEqual((r.status, r.error_code), ("failed", "source_missing"))
        self.assertEqual(calls, [])

    def test_dry_run_은_올리지_않는다(self):
        drv = FakeDriver([RAW_HEAD, ROWS])
        r, graph, _ = self._run(drv, dry_run=True)
        self.assertEqual(r.status, "ok")
        self.assertEqual(graph.puts, [])
        self.assertIn("저장 안 함(시험 실행)", r.summary)
        self.assertIn("(SMS: 우편함)", r.summary)

    def test_결과에_번호를_싣지_않는다(self):
        drv = FakeDriver([RAW_HEAD, ROWS])
        r, _, _ = self._run(drv)
        self.assertNotIn("010-0000", json.dumps(r.to_json(), ensure_ascii=False))
        self.assertNotIn("010-0000", " ".join(r.changes))

    def test_드라이버는_항상_닫는다(self):
        drv = FakeDriver([RAW_HEAD, ROWS])
        drv.fail_on_rows = True
        graph = FakeGraph()
        with self.assertRaises(RuntimeError):  # 분류는 run_steps 가 한다(unknown·클래스 이름)
            run_moa_step(
                ctx(),
                login=lambda _env: (drv, "우편함"),
                graph_factory=lambda: graph,
                now=lambda: NOW,
                sleep=lambda _s: None,
            )
        self.assertEqual(drv.quits, 1)
        self.assertEqual(graph.puts, [])


if __name__ == "__main__":
    unittest.main()
