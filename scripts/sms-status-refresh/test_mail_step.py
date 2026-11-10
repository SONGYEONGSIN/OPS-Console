"""mail_step — 세종 메일의 발번 리스트 첨부를 Teams 세종 폴더에 저장하는 단계.

메일함·Teams 는 전부 가짜다. 실제 메일·파일은 만지지 않는다.
폴더 경로는 상수를 import 하지 않고 글자 그대로 적는다 — 경로가 바뀌면 여기서 걸려야 한다.
메일 주소·사람 이름 자리는 토큰(`box-a`, `담당-x`)만 쓴다.
"""
import contextlib
import io
import itertools
import json
import os
import tempfile
import unicodedata
import unittest
from pathlib import Path
from unittest import mock

import mail_step
import refresh
from contract import FIRST_WATERMARK, Context, Step, StepResult, run_steps
from graph import SEJONG_DIR, XLSX, DriveItem, GraphError
from mail_step import run_mail_step
from sms_mailbox import Attachment, MailboxError, Message
from test_compare import sejong_bytes
from test_workbook_step import OK_CHECKS, FakeGraph

SEJONG_PATH = "01. 결제사/세종텔레콤"
CONTACT_PATH = "02.운영부/운영2팀/담당-x"
ENV = {"SMS_STATUS_MAILBOX_UPN": "box-a", "SMS_STATUS_SEJONG_CONTACT_FOLDER": "담당-x"}
PREV = "2026-11-01T00:00:00Z"
LIST_NAME = "세종 발번리스트_261110.xlsx"
MB = 1024 * 1024


def att(aid: str, name: str, *, size: int = 10_000, inline: bool = False, is_file: bool = True) -> Attachment:
    return Attachment(aid, name, size, inline, is_file)


def msg(mid: str, minute: int) -> Message:
    return Message(mid, f"2026-11-02T00:{minute:02d}:00Z")


class FakeMailbox:
    """sms_mailbox.Mailbox 흉내. fail = {메서드 이름: 던질 예외}."""

    def __init__(self, *, children=None, messages=None, atts=None, fail=None):
        self.folders = {SEJONG_PATH: "f-sj", CONTACT_PATH: "f-ct"}
        self.children = children or {}
        self.messages = messages or {}
        self.atts = atts or {}
        self.fail = fail or {}
        self.calls: list[tuple] = []

    def _maybe_fail(self, name: str) -> None:
        if name in self.fail:
            raise self.fail[name]

    def folder_id(self, path):
        self.calls.append(("folder", path))
        self._maybe_fail("folder_id")
        return self.folders[path]

    def descendants(self, fid, depth=2):
        self.calls.append(("descendants", fid, depth))
        found, level = [fid], [fid]
        for _ in range(depth):
            level = [c for p in level for c in self.children.get(p, [])]
            found = [*found, *level]
        return found

    def messages_since(self, fid, since):
        self.calls.append(("since", fid, since))
        self._maybe_fail("messages_since")
        return [m for m in self.messages.get(fid, []) if m.received > since]

    def attachments(self, mid):
        self.calls.append(("attachments", mid))
        return list(self.atts.get(mid, []))

    def attachment_bytes(self, mid, aid):
        self.calls.append(("bytes", mid, aid))
        self._maybe_fail("attachment_bytes")
        return f"{mid}/{aid}".encode()


class FakeTeams:
    """Graph 흉내 — 세종 폴더의 이름 목록과 put_new 만. 같은 이름이면 409."""

    token = "tok"

    def __init__(self, existing=(), put_error=None):
        self.existing = list(existing)
        self.put_error = put_error
        self.puts: list[tuple] = []

    def children(self, path):
        assert path == SEJONG_DIR
        return [DriveItem(f"x{i}", n, "e", "", True) for i, n in enumerate(self.existing)]

    def put_new(self, folder, name, data, content_type):
        if self.put_error is not None:
            raise self.put_error
        if name in self.existing or any(p[1] == name for p in self.puts):
            raise GraphError(409, "새 파일 올리기")
        self.puts.append((folder, name, data, content_type))
        return DriveItem("new", name, "e", "", True)


class MailStepTest(unittest.TestCase):
    def setUp(self):
        self._env = mock.patch.dict(os.environ, ENV)
        self._env.start()
        self.made: list[tuple] = []

    def tearDown(self):
        self._env.stop()

    def _run(self, mb=None, teams=None, *, dry_run=False, watermarks=None, clock=None):
        mb = mb or FakeMailbox()
        teams = teams or FakeTeams()

        def factory(token, upn):
            self.made.append((token, upn))
            return mb

        step = Step("mail", lambda c: run_mail_step(
            c, graph_factory=lambda: teams, mailbox_factory=factory,
            clock=clock or itertools.count(0, 0).__next__))
        wm = {"mail": PREV} if watermarks is None else watermarks
        ctx = Context("req-1", wm, dry_run, mock.MagicMock(), {})
        return run_steps([step], ctx)[0], mb, teams

    # ── 브리프 RED ──

    def test_발번_리스트만_저장(self):
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]}, atts={"m1": [
            att("a1", LIST_NAME),
            att("a2", "공문.pdf"),
            att("a3", "발번 리스트.png", inline=True),
            att("a4", "발번 리스트 전달", is_file=False),
            att("a5", "발번 리스트_큰것.xlsx", size=4 * MB + 1),
            att("a6", "발번 리스트_딱4MB.xlsx", size=4 * MB),
        ]})
        r, mb, teams = self._run(mb)
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual(teams.puts, [(SEJONG_DIR, LIST_NAME, b"m1/a1", XLSX),
                                      (SEJONG_DIR, "발번 리스트_딱4MB.xlsx", b"m1/a6", XLSX)])
        self.assertEqual(r.summary, "메일 1통 · 저장 2 · 이미 있음 0 · 건너뜀 3")
        # 큰 첨부·인라인·항목 첨부·관계없는 첨부는 내려받지도 않는다
        self.assertEqual([c[2] for c in mb.calls if c[0] == "bytes"], ["a1", "a6"])
        self.assertEqual(self.made, [("tok", "box-a")])

    def test_같은_이름은_이미_있음(self):
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]}, atts={"m1": [att("a1", LIST_NAME)]})
        r, _mb, teams = self._run(mb, FakeTeams(existing=[LIST_NAME]))
        self.assertEqual((r.status, r.summary), ("ok", "메일 1통 · 저장 0 · 이미 있음 1 · 건너뜀 0"))
        self.assertEqual(teams.puts, [])
        self.assertEqual(r.watermark, "2026-11-02T00:01:00Z")

    def test_watermark_는_처리한_마지막_메일(self):
        # 두 폴더·하위 폴더에서 받은 순서가 섞여 와도 가장 늦은 메일까지 처리하고 그 시각을 낸다
        mb = FakeMailbox(children={"f-ct": ["f-ct-1"], "f-ct-1": ["f-ct-2"], "f-ct-2": ["f-ct-3"]},
                         messages={"f-sj": [msg("m3", 3), msg("m1", 1)], "f-ct-2": [msg("m2", 2)],
                                   "f-ct-3": [msg("m9", 9)]})
        r, mb, _t = self._run(mb)
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual(r.watermark, "2026-11-02T00:03:00Z")
        self.assertEqual([c[1] for c in mb.calls if c[0] == "attachments"], ["m1", "m2", "m3"])
        # 하위 2단계까지만 — f-ct-3(3단계)은 보지 않는다. 모든 폴더에 이전 watermark 를 넘긴다
        self.assertEqual([c[1:] for c in mb.calls if c[0] == "since"],
                         [("f-sj", PREV), ("f-ct", PREV), ("f-ct-1", PREV), ("f-ct-2", PREV)])
        self.assertEqual([c[1] for c in mb.calls if c[0] == "folder"], [SEJONG_PATH, CONTACT_PATH])
        self.assertEqual(r.to_json()["watermark"], "2026-11-02T00:03:00Z")

    def test_메일_없어도_watermark_유지(self):
        r, _mb, _t = self._run()
        self.assertEqual((r.status, r.summary), ("ok", "메일 0통 · 저장 0 · 이미 있음 0 · 건너뜀 0"))
        self.assertEqual(r.watermark, PREV)  # 다시 내야 서버의 최근 50건 창에서 빠지지 않는다

    def test_처음엔_FIRST_WATERMARK_부터(self):
        r, mb, _t = self._run(watermarks={})
        self.assertEqual(r.watermark, FIRST_WATERMARK)
        self.assertTrue(all(c[2] == FIRST_WATERMARK for c in mb.calls if c[0] == "since"))

    def test_시험_실행은_저장_없음(self):
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]},
                         atts={"m1": [att("a1", LIST_NAME), att("a2", "발번 리스트_261101.xlsx")]})
        r, _mb, teams = self._run(mb, FakeTeams(existing=["발번 리스트_261101.xlsx"]), dry_run=True)
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual(teams.puts, [])
        self.assertEqual(r.watermark, PREV)  # 올리지 않는다
        self.assertEqual(r.summary, "메일 1통 · 저장 1 · 이미 있음 1 · 건너뜀 0 · 저장 안 함(시험 실행)")

    def test_50통_120초_상한(self):
        many = [Message(f"m{i:02d}", f"2026-11-02T01:{i:02d}:00Z") for i in range(55)]
        r, mb, _t = self._run(FakeMailbox(messages={"f-sj": many}))
        self.assertEqual(len([c for c in mb.calls if c[0] == "attachments"]), 50)
        self.assertEqual(r.watermark, "2026-11-02T01:49:00Z")
        self.assertEqual(r.summary, "메일 50통 · 저장 0 · 이미 있음 0 · 건너뜀 0 · 남은 5통은 다음 실행")
        self.assertEqual(r.counts["remaining"], 5)

        # 시계가 한 번 볼 때마다 30초씩 가면 30·60·90초에 한 통씩, 120초에 멈춘다
        r, mb, _t = self._run(FakeMailbox(messages={"f-sj": many}), clock=itertools.count(0, 30).__next__)
        self.assertEqual([c[1] for c in mb.calls if c[0] == "attachments"], ["m00", "m01", "m02"])
        self.assertEqual((r.status, r.watermark), ("ok", "2026-11-02T01:02:00Z"))
        self.assertEqual(r.counts["remaining"], 52)

    def test_상한에서_같은_시각_메일은_다음_실행으로(self):
        # receivedDateTime gt 라서, 같은 시각의 못 본 메일을 남기고 watermark 를 그 시각으로 올리면 영영 안 본다
        same = [Message(f"m{i:02d}", "2026-11-02T01:00:00Z") for i in range(50, 52)]
        many = [Message(f"m{i:02d}", f"2026-11-02T00:{i:02d}:00Z") for i in range(49)] + same
        r, _mb, _t = self._run(FakeMailbox(messages={"f-sj": many}))
        self.assertEqual(r.watermark, "2026-11-02T00:48:00Z")

    def test_저장_실패는_watermark_없음(self):
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]}, atts={"m1": [att("a1", LIST_NAME)]})
        r, _mb, _t = self._run(mb, FakeTeams(put_error=GraphError(503, "새 파일 올리기")))
        self.assertEqual((r.status, r.error_code, r.detail), ("failed", "mail_failed", "Teams 저장 GraphError 503"))
        self.assertIsNone(r.watermark)
        self.assertIsNone(r.to_json()["watermark"])

    def test_결과에_메일_원문_없음(self):
        secret = "비밀-세종 발번 리스트_담당자이름.xlsx"
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]},
                         atts={"m1": [att("a1", secret), att("a2", "발번 리스트-큰.xlsx", size=9 * MB)]})
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            r, _mb, teams = self._run(mb)
        self.assertEqual(teams.puts[0][1], secret)  # Teams 에는 원래 이름 그대로
        text = json.dumps(r.to_json(), ensure_ascii=False) + " ".join(r.changes) + out.getvalue()
        for raw in (secret, "담당자이름", "발번 리스트-큰", "담당-x", "box-a", "세종텔레콤", "m1", "a1"):
            self.assertNotIn(raw, text)

    def test_같은_실행_06_07_이_새_리스트를_쓴다(self):
        name = "세종텔레콤 발번 리스트_261110.xlsx"

        class SharedGraph(FakeGraph):
            token = "tok"

            def put_new(self, folder, fname, data, content_type):
                self.calls.append(("put_new", folder, fname))
                self.files[folder] = [*self.files[folder], ("sj-new", fname, data)]
                return DriveItem("sj-new", fname, "e", "", True)

        graph = SharedGraph()
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]}, atts={"m1": [att("a1", name)]})
        mb.attachment_bytes = lambda mid, aid: sejong_bytes()
        steps = [
            Step("mail", lambda c: run_mail_step(c, graph_factory=lambda: graph,
                                                 mailbox_factory=lambda t, u: mb, clock=lambda: 0.0)),
            Step("workbook", lambda c: _workbook(c, graph)),
        ]
        ok = StepResult("x", "ok", "끝")
        ctx = Context("req-1", {"mail": PREV}, False, self._tmpdir(), {"moa": ok, "pims": ok})
        mail_r, wb_r = run_steps(steps, ctx)
        self.assertEqual(mail_r.status, "ok", mail_r.detail)
        self.assertEqual(wb_r.status, "ok", wb_r.detail)
        self.assertIn(("download", "sj-new"), graph.calls)
        self.assertNotIn(("download", "sj"), graph.calls)
        self.assertIn(f"세종 {name}", wb_r.summary)
        self.assertNotIn("새 세종 메일은 확인 못 함", wb_r.summary)

    def _tmpdir(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        return Path(tmp.name)

    # ── 실패 코드 ──

    def test_env_가_없으면_mail_config_이고_아무것도_부르지_않는다(self):
        for key in ENV:
            with mock.patch.dict(os.environ, {key: " "}):
                called = []
                step = Step("mail", lambda c: run_mail_step(
                    c, graph_factory=lambda: called.append(1), mailbox_factory=None, clock=lambda: 0.0))
                r = run_steps([step], Context("r", {}, False, mock.MagicMock(), {}))[0]
                self.assertEqual((r.status, r.error_code), ("failed", "mail_config"), key)
                self.assertEqual(called, [])

    def test_Graph_설정_누락은_mail_config_나머지는_mail_failed(self):
        for status, code in ((0, "mail_config"), (401, "mail_failed")):
            def boom(status=status):
                raise GraphError(status, "토큰")

            step = Step("mail", lambda c: run_mail_step(c, graph_factory=boom, mailbox_factory=None,
                                                        clock=lambda: 0.0))
            r = run_steps([step], Context("r", {}, False, mock.MagicMock(), {}))[0]
            self.assertEqual((r.status, r.error_code), ("failed", code), status)

    def test_메일함_오류_분류(self):
        cases = [
            ("folder_id", MailboxError("folder_missing", 404), "mail_folder_missing"),
            ("folder_id", MailboxError("access_denied", 403), "mail_access_denied"),
            ("messages_since", MailboxError("failed", 404), "mail_folder_missing"),  # 메일함·폴더가 사라짐
            ("messages_since", MailboxError("failed", 503), "mail_failed"),
            ("attachment_bytes", MailboxError("failed", 0), "mail_failed"),
        ]
        for method, err, code in cases:
            mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]}, atts={"m1": [att("a1", LIST_NAME)]},
                             fail={method: err})
            r, _mb, teams = self._run(mb)
            self.assertEqual((r.status, r.error_code), ("failed", code), (method, err.status))
            self.assertEqual(r.detail, f"MailboxError {err.status}")
            self.assertIsNone(r.watermark)
            self.assertEqual(teams.puts, [])

    def test_NFD_이름도_찾고_NFC_로_저장한다(self):
        nfd = unicodedata.normalize("NFD", LIST_NAME)
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]}, atts={"m1": [att("a1", nfd)]})
        r, _mb, teams = self._run(mb)
        self.assertEqual(r.status, "ok", r.detail)
        self.assertEqual([p[1] for p in teams.puts], [LIST_NAME])

    def test_경로_문자가_든_이름은_건너뜀(self):
        mb = FakeMailbox(messages={"f-sj": [msg("m1", 1)]},
                         atts={"m1": [att("a1", "a/발번 리스트.xlsx"), att("a2", "발번 리스트?.xlsx")]})
        r, _mb, teams = self._run(mb)
        self.assertEqual((r.summary, teams.puts), ("메일 1통 · 저장 0 · 이미 있음 0 · 건너뜀 2", []))


def _workbook(ctx, graph):
    from workbook_step import run_workbook_step

    return run_workbook_step(ctx, graph_factory=lambda: graph, apply=lambda *_a: None,
                             restore=lambda *_a: (0, 0), verify=lambda *_a: list(OK_CHECKS),
                             sleep=lambda _s: None)


class WiringTest(unittest.TestCase):
    def test_메일_단계가_맨_앞에_등록된다(self):
        self.assertEqual(list(refresh.REGISTERED)[0], "mail")
        self.assertIs(refresh.REGISTERED["mail"].run, run_mail_step)
        self.assertEqual(refresh.REGISTERED["mail"].needs, ())

    def test_상수(self):
        self.assertEqual((mail_step.MAX_MESSAGES, mail_step.BUDGET_S, mail_step.MAX_BYTES), (50, 120, 4 * MB))


if __name__ == "__main__":
    unittest.main()
