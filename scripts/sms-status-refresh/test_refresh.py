"""refresh.py — 인자·env·본문 파일.

본문 파일이 ASCII 가 아니면 Windows PowerShell 5.1 을 지나며 한글이 물음표로 바뀐다.
ps1 은 이 파일을 바이트 그대로 보내므로, 여기서 ASCII 로 써 두는 것이 유일한 방어다.
"""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import refresh
from contract import Context, Step, StepResult


class RefreshMainTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.tmp = Path(self._tmp.name)
        self.out = self.tmp / "body.json"
        # 레포의 .env.local 을 읽지 않게 — 없는 파일을 가리킨다.
        env = {"SMS_STATUS_REFRESH_ENV_FILE": str(self.tmp / "none.env")}
        self._env = mock.patch.dict(os.environ, env)
        self._env.start()
        os.environ.pop("SMS_STATUS_REFRESH_DRY_RUN", None)
        os.environ.pop("CLOSING_DUMP_DIR", None)
        self.seen: list[Context] = []

    def tearDown(self):
        self._env.stop()
        self._tmp.cleanup()

    def _step(self, sid: str, summary: str = "끝") -> Step:
        def run(c: Context) -> StepResult:
            self.seen.append(c)
            return StepResult(sid, "ok", summary)

        return Step(sid, run)

    def _argv(self, *extra: str) -> list[str]:
        return [
            "--request-id", "req-1",
            "--out", str(self.out),
            "--work-dir", str(self.tmp),
            *extra,
        ]

    def _body(self) -> dict:
        return json.loads(self.out.read_bytes())

    def test_본문_파일은_ASCII_바이트뿐(self):
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa", "한글 요약 · 저장")}, clear=True):
            self.assertEqual(refresh.main(self._argv("--steps", "moa")), 0)
        raw = self.out.read_bytes()
        self.assertTrue(raw.isascii())
        body = json.loads(raw)
        self.assertEqual(body["result"]["steps"][0]["summary"], "한글 요약 · 저장")
        self.assertEqual(body["id"], "req-1")
        self.assertTrue(body["ok"])

    def test_steps_로_고른다(self):
        steps = {"moa": self._step("moa"), "other": self._step("other")}
        with mock.patch.dict(refresh.REGISTERED, steps, clear=True):
            self.assertEqual(refresh.main(self._argv("--steps", "moa")), 0)
        self.assertEqual([s["step"] for s in self._body()["result"]["steps"]], ["moa"])

    def test_기본은_STEP_IDS_전부(self):
        steps = {"moa": self._step("moa"), "pims": self._step("pims"),
                 "workbook": self._step("workbook"), "other": self._step("other")}
        with mock.patch.dict(refresh.REGISTERED, steps, clear=True):
            self.assertEqual(refresh.main(self._argv()), 0)
        self.assertEqual([s["step"] for s in self._body()["result"]["steps"]], ["moa", "pims", "workbook"])

    def test_모르는_단계는_2(self):
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
            self.assertEqual(refresh.main(self._argv("--steps", "moa,nope")), 2)
        self.assertFalse(self.out.exists())

    def test_watermarks_파일은_BOM_이_있어도_읽는다(self):
        wm = self.tmp / "watermarks.json"
        wm.write_bytes(b"\xef\xbb\xbf" + json.dumps({"mail": "2026-11-01T00:00:00Z"}).encode())
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
            self.assertEqual(refresh.main(self._argv("--steps", "moa", "--watermarks", str(wm))), 0)
        self.assertEqual(self.seen[0].watermarks, {"mail": "2026-11-01T00:00:00Z"})

    def test_watermarks_가_null_이면_빈_값(self):
        # 폴러가 빈 값을 ConvertTo-Json 하면 null 이 나올 수 있다.
        wm = self.tmp / "watermarks.json"
        wm.write_text("null", encoding="utf-8")
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
            self.assertEqual(refresh.main(self._argv("--steps", "moa", "--watermarks", str(wm))), 0)
        self.assertEqual(self.seen[0].watermarks, {})

    def test_watermarks_가_객체가_아니면_2(self):
        wm = self.tmp / "watermarks.json"
        wm.write_text("[1, 2]", encoding="utf-8")
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
            self.assertEqual(refresh.main(self._argv("--steps", "moa", "--watermarks", str(wm))), 2)

    def test_dry_run_env(self):
        steps = {"moa": self._step("moa")}
        with mock.patch.dict(os.environ, {"SMS_STATUS_REFRESH_DRY_RUN": "true"}):
            with mock.patch.dict(refresh.REGISTERED, steps, clear=True):
                refresh.main(self._argv("--steps", "moa"))
        self.assertTrue(self.seen[0].dry_run)

    def test_dry_run_기본은_꺼짐(self):
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
            refresh.main(self._argv("--steps", "moa"))
        self.assertFalse(self.seen[0].dry_run)
        self.assertEqual(self.seen[0].request_id, "req-1")
        self.assertEqual(self.seen[0].work_dir, self.tmp)

    def test_실패_덤프는_작업_폴더로(self):
        # scrape._dump_page 기본값은 현재 폴더(= 스케줄러가 돌리는 원래 폴더의 레포 루트)다.
        with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
            refresh.main(self._argv("--steps", "moa"))
        self.assertEqual(os.environ["CLOSING_DUMP_DIR"], str(self.tmp))

    def test_실패_덤프_폴더를_이미_정했으면_그대로(self):
        with mock.patch.dict(os.environ, {"CLOSING_DUMP_DIR": "D:/dumps"}):
            with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
                refresh.main(self._argv("--steps", "moa"))
            self.assertEqual(os.environ["CLOSING_DUMP_DIR"], "D:/dumps")

    def test_dotenv_가_없으면_2(self):
        # 계속 돌면 계정 env 가 비어 'Moa 로그인 실패' 로 잘못 보인다.
        with mock.patch.dict(sys.modules, {"dotenv": None}):
            with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
                self.assertEqual(refresh.main(self._argv("--steps", "moa")), 2)
        self.assertEqual(self.seen, [])
        self.assertFalse(self.out.exists())

    def test_env_파일을_덮어쓰지_않고_읽는다(self):
        envf = self.tmp / "x.env"
        envf.write_text("SRR_TEST_A=from-file\nSRR_TEST_B=from-file\n", encoding="utf-8")
        with mock.patch.dict(os.environ, {"SMS_STATUS_REFRESH_ENV_FILE": str(envf), "SRR_TEST_A": "pre"}):
            with mock.patch.dict(refresh.REGISTERED, {"moa": self._step("moa")}, clear=True):
                refresh.main(self._argv("--steps", "moa"))
            self.assertEqual(os.environ["SRR_TEST_A"], "pre")
            self.assertEqual(os.environ["SRR_TEST_B"], "from-file")


if __name__ == "__main__":
    unittest.main()
