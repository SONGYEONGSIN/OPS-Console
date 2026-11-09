"""pims_collect.py — PIMS 모니터링 발신번호 목록 수집 단계.

실제 PIMS 모니터링에는 로그인하지 않는다. 드라이버·로그인·Graph 는 전부 가짜다.
번호·학교·대학 ID 는 가짜 값만 쓴다.

처리상태가 전체로 안 바뀐 채 읽으면 '대기' 몇 건만 저장되고, 다음 07 대조가 전부 '세종만'으로
바뀐다 — 저장하지 않고 이 단계만 실패해야 한다.
"""
import io
import unittest
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from openpyxl import load_workbook

import compare
from contract import Context, StepFailure
from graph import DriveItem
from pims_collect import (
    PIMS_COLS,
    PIMS_LOGIN_URL,
    PIMS_URL,
    PREP_JS,
    ROWS_JS,
    SEARCH_JS,
    build_pims_xlsx,
    clean_pims_table,
    collect_pims_rows,
    next_pims_name,
)

KST = timezone(timedelta(hours=9))
NOW = datetime(2026, 11, 9, 10, 2, tzinfo=KST)
RAW_HEAD = ["UnivID ⇅", "대학명 ⇅", "발신번호", "파일", "등록일자 ⇅", "상태", "수정", "비고"]


def row(univ="9001", name="테스트대학교A", phone="010-0000-0001", status="등록완료", button="승인취소"):
    return [univ, name, phone, "test.pdf", "2026-11-04 10:20:30", status, button, ""]


ROWS = [
    row(),
    row("9002", "테스트대학교B", "02-0000-0001", "등록대기", "승인 반려"),
    row("901", "테스트대학교C", "010-0000-0003", "등록불가", "반려취소"),
]

STALE = "stale"  # 조회 전 표가 아직 그대로(표시만 달린 채 비워진 상태)


class FakeDriver:
    """PIMS 모니터링 화면 흉내. 조회 뒤에는 reads 를 차례로 보여 준다(마지막은 반복).

    reads 원소: (header, rows, all_count) = 새로 그려진 표 · STALE · None = 표 없음(쪽 이동 중).
    """

    def __init__(self, table=None, *, reads=None, has_table=True):
        self.reads = list(reads) if reads is not None else [table]
        self.has_table = has_table
        self.scripts: list[str] = []
        self.urls: list[str] = []
        self.events: list[str] = []
        self.quits = 0
        self.fail_on_rows = False
        self.all_selected = False
        self.searched_with_all = None

    def get(self, url):
        self.urls.append(url)

    def _read(self):
        state = self.reads.pop(0) if len(self.reads) > 1 else self.reads[0]
        if state is None:
            return None
        if state == STALE:
            return [RAW_HEAD, [], True, 513]
        head, rows, count = state
        return [head, rows, False, count]

    def execute_script(self, script, *args):
        self.scripts.append(script)
        if script == PREP_JS:
            self.events.append("prep")
            if not self.has_table:
                return None
            self.all_selected = True
            return True
        if script == SEARCH_JS:
            self.events.append("search")
            self.searched_with_all = self.all_selected
            return None
        if script == ROWS_JS:
            if self.fail_on_rows:
                raise RuntimeError("010-0000-0001")
            if self.searched_with_all is None:
                return None if not self.has_table else [RAW_HEAD, [], False, 513]
            return self._read()
        return None

    def quit(self):
        self.quits += 1


class FakeGraph:
    """files: [(이름, 수정 시각, 내용 bytes | None)]. 내용이 None 이면 3행짜리 지난 파일."""

    def __init__(self, names=(), files=None, events=None):
        self.files = list(files) if files is not None else [(n, "2026-11-04T00:00:00Z", None) for n in names]
        self.puts: list[tuple] = []
        self.downloads: list[str] = []
        self.folders: list[str] = []
        self.events = events if events is not None else []

    def children(self, path):
        self.events.append("teams")
        self.folders.append(path)
        return [DriveItem(str(i), n, "e", t, True) for i, (n, t, _b) in enumerate(self.files)]

    def download(self, item_id):
        self.downloads.append(item_id)
        data = self.files[int(item_id)][2]
        return data if data is not None else build_pims_xlsx(clean_pims_table(RAW_HEAD, ROWS, 3))

    def put_new(self, folder, name, data, content_type):
        self.puts.append((folder, name, data, content_type))
        return DriveItem("new", name, "e", "", True)


def ctx(dry_run=False) -> Context:
    return Context("req-1", {}, dry_run, Path("."), {})


class TestConstants(unittest.TestCase):
    def test_주소와_열은_조사한_값_그대로(self):
        self.assertEqual(PIMS_LOGIN_URL, "https://monitoringv2.jinhakapply.com/login.aspx")
        self.assertEqual(PIMS_URL, "https://monitoringv2.jinhakapply.com/PhoneManagement.aspx")
        self.assertEqual(PIMS_COLS, ["UnivID", "대학명", "발신번호", "파일", "등록일자", "상태", "수정", "비고"])
        self.assertIs(PIMS_COLS, compare.PIMS_COLS)  # 한 곳만 둔다


class TestCollect(unittest.TestCase):
    def collect(self, drv, tries=6):
        return collect_pims_rows(drv, sleep=lambda _s: None, tries=tries)

    def test_처리상태를_전체로_바꾼_뒤_조회한다(self):
        drv = FakeDriver((RAW_HEAD, ROWS, 3))
        head, rows, count = self.collect(drv)
        self.assertEqual(drv.events[:2], ["prep", "search"])  # select 가 조회보다 앞
        self.assertTrue(drv.searched_with_all)
        self.assertEqual(drv.urls, [PIMS_URL])
        self.assertIn("ProcessType", PREP_JS)
        self.assertIn("''", PREP_JS)
        self.assertIn("SearchUniv", PREP_JS)  # 대학ID 칸은 비운다
        self.assertEqual(SEARCH_JS, "getPhoneNumberList(1);")
        self.assertIn("allData", ROWS_JS)
        self.assertEqual((head, rows, count), (RAW_HEAD, ROWS, 3))

    def test_수정_성격의_페이지_함수는_부르지_않는다(self):
        drv = FakeDriver((RAW_HEAD, ROWS, 3))
        self.collect(drv)
        joined = "\n".join(drv.scripts)
        for name in ("updateStatus", "rejectPhone", "Login("):
            self.assertNotIn(name, joined)

    def test_표가_안정될_때까지_기다린다(self):
        five = [row(f"90{i:02d}") for i in range(5)]
        drv = FakeDriver(reads=[STALE, (RAW_HEAD, five[:3], 5), (RAW_HEAD, five, 5), (RAW_HEAD, five, 5)])
        head, rows, count = self.collect(drv)
        self.assertEqual((len(rows), count), (5, 5))

    def test_조회_전_표는_결과로_보지_않는다(self):
        # 조회가 아무것도 안 바꾸면(스크립트 오류 등) 조회 전 화면을 저장하면 안 된다.
        drv = FakeDriver(reads=[STALE])
        with self.assertRaises(StepFailure) as cm:
            self.collect(drv)
        self.assertEqual(cm.exception.code, "pims_incomplete")

    def test_끝까지_안정되지_않으면_pims_incomplete(self):
        growing = [(RAW_HEAD, [row(f"{9000 + i}") for i in range(n)], 513) for n in range(20, 400, 40)]
        drv = FakeDriver(reads=growing)
        with self.assertRaises(StepFailure) as cm:
            self.collect(drv, tries=6)
        self.assertEqual(cm.exception.code, "pims_incomplete")

    def test_표가_없으면_빈_값(self):
        # 세션 만료로 로그인 화면이 떠 있으면 표 자체가 없다.
        drv = FakeDriver(None, has_table=False)
        self.assertEqual(self.collect(drv), ([], [], 0))
        self.assertNotIn("search", drv.events)


class TestCleanTable(unittest.TestCase):
    def test_머리글_정리와_값_그대로(self):
        got = clean_pims_table(RAW_HEAD, ROWS, 3)
        self.assertEqual(got, ROWS)
        self.assertEqual(got[0][6], "승인취소")  # 수정 칸 버튼 글자도 그대로

    def test_칸_값은_strip_한다(self):
        got = clean_pims_table(RAW_HEAD, [[f" {c} " for c in ROWS[0]]], 1)
        self.assertEqual(got, [ROWS[0]])

    def test_머리글이_다르면_pims_shape_changed(self):
        head = [*RAW_HEAD[:2], "번호", *RAW_HEAD[3:]]
        with self.assertRaises(StepFailure) as cm:
            clean_pims_table(head, ROWS, 3)
        self.assertEqual(cm.exception.code, "pims_shape_changed")
        self.assertEqual(cm.exception.detail, "머리글")

    def test_행_칸_수가_다르면_pims_shape_changed(self):
        with self.assertRaises(StepFailure) as cm:
            clean_pims_table(RAW_HEAD, [*ROWS, ROWS[0][:5]], 4)
        self.assertEqual(cm.exception.code, "pims_shape_changed")
        self.assertEqual(cm.exception.detail, "행 칸 수")

    def test_빈_표는_pims_empty(self):
        for rows in ([], [["조회된 데이터가 없습니다."]]):
            with self.assertRaises(StepFailure) as cm:
                clean_pims_table(RAW_HEAD, rows, 0)
            self.assertEqual(cm.exception.code, "pims_empty")

    def test_원본_건수와_표_행_수가_다르면_pims_incomplete(self):
        # 처리상태가 전체로 안 바뀌어 대기(W)만 그려진 경우 — 표는 멀쩡해 보인다.
        with self.assertRaises(StepFailure) as cm:
            clean_pims_table(RAW_HEAD, ROWS, 513)
        self.assertEqual(cm.exception.code, "pims_incomplete")
        self.assertEqual(cm.exception.detail, "표 3행 · 원본 513행")


class TestXlsx(unittest.TestCase):
    def test_xlsx_모양(self):
        data = build_pims_xlsx(clean_pims_table(RAW_HEAD, ROWS, 3))
        ws = load_workbook(io.BytesIO(data)).active
        self.assertEqual([c.value for c in ws[1]], PIMS_COLS)  # 1행 = 머리글(추출 정보 행 없음)
        self.assertTrue(all(c.font.bold for c in ws[1]))
        self.assertEqual(ws.freeze_panes, "A2")
        self.assertEqual(ws.auto_filter.ref, "A1:H4")
        cells = [c for r in ws.iter_rows(min_row=2) for c in r]
        self.assertEqual(len(cells), 3 * 8)
        self.assertTrue(all(c.number_format == "@" for c in cells))
        self.assertTrue(all(c.value is None or isinstance(c.value, str) for c in cells))
        self.assertEqual(ws["A2"].value, "9001")  # 숫자로 바뀌지 않는다

    def test_저장_파일은_compare_load_pims_로_다시_읽힌다(self):
        data = build_pims_xlsx(clean_pims_table(RAW_HEAD, ROWS, 3))
        recs = compare.load_pims(data)
        self.assertEqual(len(recs), 3)
        self.assertEqual(recs[2]["univ"], "0901")  # 3자리는 zfill 로 맞춰진다
        self.assertEqual(recs[0]["date"], "2026-11-04")  # 시각은 버려진다
        self.assertEqual([r["status"] for r in recs], ["등록완료", "등록대기", "등록불가"])
        self.assertEqual(recs[0]["raw"], "010-0000-0001")


class TestName(unittest.TestCase):
    def test_같은_날_두_번째면_이름에_2(self):
        d = date(2026, 11, 9)
        self.assertEqual(next_pims_name([], d), "PIMS 등록 리스트_261109.xlsx")
        self.assertEqual(next_pims_name(["PIMS 등록 리스트_261109.xlsx"], d), "PIMS 등록 리스트_261109_2.xlsx")
        self.assertEqual(
            next_pims_name(["PIMS 등록 리스트_261109_2.xlsx", "PIMS 등록 리스트_261109.xlsx"], d),
            "PIMS 등록 리스트_261109_3.xlsx",
        )
        self.assertEqual(next_pims_name(["PIMS 등록 리스트_261104.xlsx"], d), "PIMS 등록 리스트_261109.xlsx")


if __name__ == "__main__":
    unittest.main()
