"""workbook_step — 현황 파일 06·07 갱신 · 검사 · If-Match 업로드 · 올린 뒤 확인.

Graph·Excel·매크로 복원·검사는 전부 가짜다. 실제 현황 파일·Teams 는 만지지 않는다.
번호·학교는 가짜(test_compare 의 fixture)뿐이다.
"""
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import requests

import refresh
import workbook_step
from contract import STEP_IDS, Context, Step, StepResult, run_steps
from fixtures import make_xlsm_like
from graph import MOA_DIR, PIMS_DIR, SEJONG_DIR, SMS_ROOT, XLSM, DriveItem, UploadRejected
from test_compare import moa_bytes, moa_sheet, pims_bytes, pims_sheet, sejong_bytes
from verify import Check
from workbook_step import APP_SHEETS, TARGETS, apply_excel, run_workbook_step

WB_NAME = "SMS 발신번호 사전등록 현황_261107.xlsm"
SEJONG_NAME = "세종 등록 리스트_261107.xlsx"
MOA_NAME = "Moa 등록 리스트_261108.xlsx"
PIMS_NAME = "PIMS 등록 리스트_261108.xlsx"
APP_ROWS = 5


def workbook_bytes() -> bytes:
    """기존 06 만 있는 현황 파일 흉내 — 데이터 9행부터 Moa만 1 · 양쪽 1."""
    filler = [["."] for _ in range(7)]
    moa06 = [*filler, ["No", "결과", "발신번호"],
             [1, "Moa만", "010-0000-0099"], [2, "양쪽", "010-0000-0001"]]
    return make_xlsm_like({"03. 번호 목록": [["."]], "06. Moa 대조": moa06}, b"VBA")


def honest_rows() -> dict[str, int]:
    """올린 뒤 Graph 가 돌려줄 정상 행 수."""
    rows = {s: APP_ROWS for s in APP_SHEETS}
    rows["06. Moa 대조"] = 8 + len(moa_sheet()["rows"])
    rows["07. PIMS 대조"] = 8 + len(pims_sheet()["rows"])
    return rows


class FakeGraph:
    """호출 순서를 calls 에 남긴다. item 의 eTag 는 etags 를 차례로(마지막 값 반복)."""

    def __init__(self, *, etags=("e1",), put_error=None, rows_after=None, missing=(), after_error=None):
        self.calls: list[tuple] = []
        self.files = {
            SMS_ROOT: [("wb", WB_NAME, workbook_bytes())],
            SEJONG_DIR: [("sj", SEJONG_NAME, sejong_bytes())],
            MOA_DIR: [("mo", MOA_NAME, moa_bytes())],
            PIMS_DIR: [("pi", PIMS_NAME, pims_bytes())],
        }
        for folder in missing:
            self.files[folder] = []
        self._etags = list(etags)
        self.put_error = put_error
        self.rows_after = rows_after or honest_rows()
        self.after_error = after_error
        self.puts: list[tuple] = []

    def _find(self, item_id):
        return next(f for fs in self.files.values() for f in fs if f[0] == item_id)

    def children(self, path):
        self.calls.append(("children", path))
        return [DriveItem(i, n, "x", "2026-11-08T00:00:00Z", True) for i, n, _b in self.files[path]]

    def item(self, item_id):
        self.calls.append(("item", item_id))
        etag = self._etags.pop(0) if len(self._etags) > 1 else self._etags[0]
        return DriveItem(item_id, self._find(item_id)[1], etag, "", True)

    def download(self, item_id):
        self.calls.append(("download", item_id))
        return self._find(item_id)[2]

    def used_range_rows(self, item_id, sheet):
        self.calls.append(("rows", item_id, sheet))
        if not self.puts:
            return APP_ROWS
        if self.after_error is not None:
            raise self.after_error
        return self.rows_after[sheet]

    def put_if_match(self, item_id, data, etag, content_type):
        self.calls.append(("put", item_id, etag))
        if self.put_error is not None:
            raise self.put_error
        self.puts.append((item_id, data, etag, content_type))
        return DriveItem(item_id, WB_NAME, "e-new", "", True)


OK_CHECKS = [Check("a", True), Check("b", True), Check("c", True)]


class RunStepTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.work = Path(self._tmp.name)
        self.applied: list[tuple] = []
        self.sleeps: list[float] = []

    def tearDown(self):
        self._tmp.cleanup()

    def _run(self, graph=None, *, checks=None, dry_run=False, results=None, verify=None):
        graph = graph or FakeGraph()
        ok = StepResult("x", "ok", "끝")
        results = {"moa": ok, "pims": ok} if results is None else results

        def fake_apply(wb, data, pid):
            self.applied.append((wb, data, pid))

        step = Step("workbook", lambda c: run_workbook_step(
            c,
            graph_factory=lambda: graph,
            apply=fake_apply,
            restore=lambda before, after: (0, 0),
            verify=verify or (lambda before, after, sheets: list(checks or OK_CHECKS)),
            sleep=self.sleeps.append,
        ))
        ctx = Context("req-1", {}, dry_run, self.work, results)
        return run_steps([step], ctx)[0], graph

    def test_eTag_를_먼저_읽는다(self):
        _r, g = self._run()
        self.assertLess(g.calls.index(("item", "wb")), g.calls.index(("download", "wb")))

    def test_검사가_하나라도_실패하면_올리지_않는다(self):
        r, g = self._run(checks=[Check("a", True), Check("b", False)])
        self.assertEqual((r.status, r.error_code, r.detail), ("failed", "verify_failed", "1/2 실패: b"))
        self.assertEqual([c for c in g.calls if c[0] == "put"], [])

    def test_oletools_가_없으면_verify_failed_따로_적는다(self):
        def no_oletools(*_a):
            raise ImportError("oletools")

        r, g = self._run(verify=no_oletools)
        self.assertEqual((r.status, r.error_code, r.detail), ("failed", "verify_failed", "oletools 없음"))
        self.assertEqual(g.puts, [])

    def test_검사가_0건이면_올리지_않는다(self):
        r, g = self._run(verify=lambda *_a: [])
        self.assertEqual((r.status, r.error_code, r.detail), ("failed", "verify_failed", "검사 0건"))
        self.assertEqual(g.puts, [])

    def test_eTag_가_비면_내려받지도_올리지도_않는다(self):
        for etag in ("", None):
            r, g = self._run(FakeGraph(etags=(etag,)))
            self.assertEqual((r.status, r.error_code, r.detail), ("failed", "unknown", "eTag 없음"))
            self.assertEqual([c for c in g.calls if c[0] in ("download", "put")], [], repr(etag))

    def test_업로드_직전에도_빈_eTag_를_막는다(self):
        for etag in ("", None):
            g = FakeGraph(etags=(etag,))
            with self.assertRaises(workbook_step.StepFailure) as cm:
                workbook_step._upload(g, "wb", b"x", etag)
            self.assertEqual((cm.exception.code, cm.exception.detail), ("unknown", "eTag 없음"))
            self.assertEqual(g.puts, [])

    def test_PUT_이_타임아웃이면_업로드_여부_불명(self):
        for err, name in ((requests.Timeout(), "Timeout"), (requests.ConnectionError(), "ConnectionError")):
            r, _g = self._run(FakeGraph(put_error=err))
            self.assertEqual((r.status, r.error_code, r.detail), ("failed", "unknown", f"업로드 여부 불명 {name}"))

    def test_올린_뒤_확인_중_오류도_업로드됨이라고_적는다(self):
        r, g = self._run(FakeGraph(after_error=TimeoutError()))
        self.assertEqual((r.status, r.error_code), ("failed", "after_check"))
        self.assertEqual(r.detail, "업로드됨 · 확인 중 오류 TimeoutError")
        self.assertEqual(len(g.puts), 1)

    def test_올리기_직전_eTag_가_바뀌면_PUT_없이_changed(self):
        r, g = self._run(FakeGraph(etags=("e1", "e2")))
        self.assertEqual((r.status, r.error_code), ("failed", "changed"))
        self.assertEqual([c for c in g.calls if c[0] == "put"], [])

    def test_423_은_locked_412_는_changed(self):
        for code in ("locked", "changed"):
            r, _g = self._run(FakeGraph(put_error=UploadRejected(code)))
            self.assertEqual((r.status, r.error_code), ("failed", code))

    def test_If_Match_는_처음_기록한_eTag(self):
        r, g = self._run(FakeGraph(etags=("e1",)))
        self.assertEqual(r.status, "ok", r.detail)
        item_id, data, etag, ctype = g.puts[0]
        self.assertEqual((item_id, etag, ctype), ("wb", "e1", XLSM))
        self.assertEqual(data, (self.work / "work.xlsm").read_bytes())

    def test_dry_run_은_올리지_않는다(self):
        r, g = self._run(dry_run=True)
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual(r.summary, "06·07 갱신 · 검사 3/3 통과 · 올리지 않음(시험 실행)")
        self.assertEqual(g.puts, [])
        self.assertEqual(r.counts["uploaded"], 0)

    def test_올린_뒤_행_수가_다르면_after_check(self):
        rows = {**honest_rows(), "_번호": APP_ROWS + 1}
        r, g = self._run(FakeGraph(rows_after=rows))
        self.assertEqual((r.status, r.error_code), ("failed", "after_check"))
        self.assertEqual(r.detail, "업로드됨 · 행 수 다름: _번호")
        self.assertEqual(self.sleeps, [10, 10, 10])
        self.assertEqual(len(g.puts), 1)

    def test_올린_뒤_행_수가_맞으면_쉬지_않는다(self):
        r, g = self._run()
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual(self.sleeps, [])
        after = [c[2] for c in g.calls[g.calls.index(("put", "wb", "e1")):] if c[0] == "rows"]
        self.assertEqual(sorted(after), sorted([*APP_SHEETS, *TARGETS]))

    def test_업로드_완료_요약과_건수(self):
        r, _g = self._run()
        self.assertEqual(r.summary, f"06·07 갱신 · 검사 3/3 통과 · 업로드 완료 "
                                    f"(세종 {SEJONG_NAME} · Moa {MOA_NAME} · PIMS {PIMS_NAME})")
        self.assertEqual(set(r.counts), {"moa_both", "moa_sejong_only", "moa_only", "moa_excluded",
                                         "pims_both", "pims_sejong_only", "pims_only", "pims_excluded",
                                         "checks", "uploaded"})
        self.assertEqual((r.counts["checks"], r.counts["uploaded"]), (3, 1))
        self.assertEqual(r.counts["moa_both"], moa_sheet()["counts"]["양쪽"])
        self.assertEqual(r.counts["pims_only"], pims_sheet()["counts"]["PIMS만"])

    def test_Moa_단계가_실패해도_돈다_지난_자료라고_적는다(self):
        failed = StepResult("moa", "failed", "실패", error_code="login_failed")
        r, _g = self._run(results={"moa": failed, "pims": StepResult("pims", "ok", "끝")})
        self.assertEqual(r.status, "ok", r.detail)
        self.assertTrue(r.summary.endswith(" · Moa 는 지난 자료"), r.summary)
        self.assertNotIn("PIMS 는 지난 자료", r.summary)

    def test_PIMS_단계가_실패해도_돈다_지난_자료라고_적는다(self):
        failed = StepResult("pims", "failed", "실패", error_code="pims_login_failed")
        r, _g = self._run(results={"moa": StepResult("moa", "ok", "끝"), "pims": failed})
        self.assertEqual(r.status, "ok", r.detail)
        self.assertTrue(r.summary.endswith(" · PIMS 는 지난 자료"), r.summary)
        self.assertNotIn("Moa 는 지난 자료", r.summary)

    def test_세종_목록이_없으면_source_missing(self):
        r, g = self._run(FakeGraph(missing=(SEJONG_DIR,)))
        self.assertEqual((r.status, r.error_code), ("failed", "source_missing"))
        self.assertEqual(self.applied, [])
        self.assertEqual(g.puts, [])

    def test_현황_파일이_없으면_source_missing(self):
        r, _g = self._run(FakeGraph(missing=(SMS_ROOT,)))
        self.assertEqual((r.status, r.error_code), ("failed", "source_missing"))

    def test_바뀐_점은_건수만(self):
        r, _g = self._run()
        self.assertEqual(len(r.changes), 2)
        self.assertTrue(r.changes[0].startswith("06. Moa 대조: Moa만 1→"), r.changes[0])
        self.assertIn("양쪽 1→", r.changes[0])
        self.assertTrue(r.changes[1].startswith("07. PIMS 대조: PIMS만 0→"), r.changes[1])  # 07 이 없던 파일
        for line in r.changes:
            self.assertIn("→", line)
            self.assertNotIn("010-0000", line)

    def test_요약에_번호가_없다(self):
        for kw in ({}, {"checks": [Check("a", True), Check("b", False)]}):
            r, _g = self._run(**kw)
            text = json.dumps(r.to_json(), ensure_ascii=False) + "\n".join(r.changes)
            self.assertIsNone(re.search(r"0\d{1,2}-?\d{3,4}-?\d{4}", text), text)
            self.assertNotIn("테스트대학교", text)

    def test_작업_파일은_작업_폴더_안에만(self):
        r, _g = self._run(dry_run=True)
        self.assertEqual(r.status, "ok", r.detail)
        wb, data, pid = self.applied[0]
        self.assertEqual({wb.parent, data.parent, pid.parent}, {self.work})
        self.assertEqual(wb, self.work / "work.xlsm")
        self.assertTrue((self.work / "before.xlsm").exists())
        sheets = json.loads(data.read_text(encoding="utf-8"))["sheets"]
        self.assertEqual([s["sheet"] for s in sheets], list(TARGETS))


class ApplyExcelTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.wb, self.data, self.pid = self.dir / "work.xlsm", self.dir / "data.json", self.dir / "excel.pid"

    def tearDown(self):
        self._tmp.cleanup()

    def _call(self, run_side_effect, which="C:/pwsh.exe"):
        with mock.patch.object(workbook_step.shutil, "which", return_value=which), \
             mock.patch.object(workbook_step.subprocess, "run", side_effect=run_side_effect) as run:
            try:
                apply_excel(self.wb, self.data, self.pid, timeout_s=5)
                return None, run
            except workbook_step.StepFailure as e:
                return e, run

    @staticmethod
    def done(code, out=""):
        return subprocess.CompletedProcess([], code, stdout=out, stderr="")

    def test_성공(self):
        err, run = self._call([self.done(0, "applied: 06=1\nexcel cleanup: ok\n")])
        self.assertIsNone(err)
        cmd = run.call_args.args[0]
        self.assertEqual(cmd[0], "C:/pwsh.exe")
        self.assertTrue(cmd[cmd.index("-File") + 1].endswith("excel_apply.ps1"))
        for flag, val in (("-Workbook", self.wb), ("-Data", self.data), ("-PidFile", self.pid)):
            self.assertEqual(cmd[cmd.index(flag) + 1], str(val))

    def test_pwsh_가_없으면_excel_failed(self):
        err, run = self._call([], which=None)
        self.assertEqual((err.code, err.detail), ("excel_failed", "pwsh 없음"))
        run.assert_not_called()

    def test_실패하면_FAILED_줄만(self):
        err, _run = self._call([self.done(1, "applied: \nFAILED at line 42: $ws.Cells(1,1)\n")])
        self.assertEqual((err.code, err.detail), ("excel_failed", "FAILED at line 42"))

    def test_FAILED_줄이_없으면_종료_코드(self):
        err, _run = self._call([self.done(1, "무언가 던짐\n")])
        self.assertEqual((err.code, err.detail), ("excel_failed", "exit 1"))

    def test_시간_초과면_자기_Excel_만_정리한다(self):
        self.pid.write_text("999", encoding="ascii")  # 지난 실행이 남긴 PID — 지워져야 한다

        def fake_run(cmd, **_kw):
            if cmd[0] == "taskkill":
                return self.done(0)
            self.assertFalse(self.pid.exists())
            self.pid.write_text("4321", encoding="ascii")  # ps1 이 Excel PID 를 적은 뒤 멈춤
            raise subprocess.TimeoutExpired(cmd, 5)

        err, run = self._call(fake_run)
        self.assertEqual(err.code, "excel_failed")
        self.assertEqual(run.call_args_list[1].args[0], ["taskkill", "/F", "/PID", "4321"])

    def test_PidFile_이_비었거나_숫자가_아니면_taskkill_을_부르지_않는다(self):
        for content in (b"", b"abc", b"\xff\xfe", None):
            def fake_run(cmd, content=content, **_kw):
                if cmd[0] == "taskkill":
                    return self.done(0)
                if content is not None:
                    self.pid.write_bytes(content)
                raise subprocess.TimeoutExpired(cmd, 5)

            err, run = self._call(fake_run)
            self.assertEqual(err.code, "excel_failed", repr(content))
            self.assertEqual([c.args[0][0] for c in run.call_args_list], [run.call_args_list[0].args[0][0]])


class WiringTest(unittest.TestCase):
    def test_단계_등록(self):
        self.assertEqual(STEP_IDS, ("moa", "pims", "workbook"))
        self.assertEqual(list(refresh.REGISTERED), ["moa", "pims", "workbook"])
        self.assertEqual(refresh.REGISTERED["workbook"].needs, ())  # Moa·PIMS 가 실패해도 돈다
        self.assertIs(refresh.REGISTERED["workbook"].run, run_workbook_step)

    def test_상수(self):
        self.assertEqual(APP_SHEETS, ("_학교", "_서류", "_번호", "_확인"))
        self.assertEqual(TARGETS, ("06. Moa 대조", "07. PIMS 대조"))


if __name__ == "__main__":
    unittest.main()
