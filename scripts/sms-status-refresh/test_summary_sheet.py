"""summary_sheet.py — `00. 요약` payload(출처 summary.py 배치를 값·링크·병합·툴팁·스타일 키로).

표는 verify_table.Table 을 손으로 만들고 T(태그)는 T9/T10 이 쓰는 같은 함수(school_tags·doc_tags·number_tags)로
찍는다 — 그래야 '파란 수 = 그 키로 거른 행 수' 를 실제 검색 규칙(T 의 `|키|`)으로 잴 수 있다.
학교·번호는 전부 가짜다(`테스트대학교01`, `010-0000-0001`, `op-a`).
"""
import re
import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook, load_workbook
from openpyxl.worksheet.hyperlink import Hyperlink

import summary_sheet as ss
import verify_table as vt
import verify_view as vv
from number_rows import number_tags
from school_rows import DOC_COLS, doc_tags, school_tags
from sheet_names import ISSUE_VIEW, SUMMARY_SHEET
from summary_layout import STYLE_KEYS
from table_rows import P_INDEX, T_INDEX, named, tag_cell

V1, V2, V3, V4 = "01. 학교별 현황", "02. 학교별 제출 서류", "03. 번호 목록", ISSUE_VIEW
SEARCH = {V1: "G6", V2: "G6", V3: "F6"}
LINKS = {f"{V1}!G6", f"{V2}!G6", f"{V3}!F6", f"{V4}!D6"}  # 실파일 원본 요약의 링크 대상
BASE = ("▪ 기준 자료: 세종 「테스트 발번 리스트_261020.xlsx」 (2025-09 이후 등록한 번호만 있음), "
        "2026-10-20 작성, 2026-11-12 갱신")
KINDS = ("4년제", "전문대학", "대학원", "초중고", "기타")

SCHOOL_H = ("No", "학교명", "구분", "원서접수", "PIMS", "담당자", "등록 회선", "일괄 등록", "추가 등록", "서류 미비",
            "최근 등록일", "제출 서류 (10/15 기준)", "확인", "비고")
DOC_H = ("No", "학교명", "구분", "등록 회선\n(03 번호 목록)", "세종 등록 상태", *DOC_COLS,
         "제출 상태\n(10/15 기준)", "미제출 서류")
NUM_H = ("No", "학교명", "구분", "발신번호", "상태", "등록일자", "제출 서류 (10/15 기준)", "비고")


def table(header, recs, tags_fn) -> vt.Table:
    """{머리글: 값} 레코드 → A~T 표. P 는 가짜 수식, T 는 그 행 값으로 만든 태그."""
    head = tuple(list(header) + [None] * (vt.WIDTH - len(header)))
    rows = []
    for rec in recs:
        r = [rec.get(h, "") if h else "" for h in head]
        r[P_INDEX] = "=1"
        r[T_INDEX] = tag_cell(tags_fn(named(vt.Table(head, (), 1), r)))
        rows.append(tuple(r))
    return vt.Table(head, tuple(rows), 1)


def school(i, kind, lines=1, bad=0, jp="O", pims="", check=""):
    return {"No": i, "학교명": f"테스트대학교{i:02d}", "구분": kind, "원서접수": jp, "PIMS": pims, "담당자": "op-a",
            "등록 회선": lines, "일괄 등록": lines - bad, "추가 등록": 0, "서류 미비": bad,
            "확인": check or ("확인 필요" if bad or not lines else "")}


def doc(i, kind, lines=1, bad=0, state="모두 제출", missing=()):
    reg = "번호 없음" if not lines else (f"서류 미비 {bad}회선" if bad else "등록 완료")
    marks = {c: ("" if state == "서류 확인 안 됨" else "✕" if c in missing else "O") for c in DOC_COLS}
    return {"No": i, "학교명": f"테스트대학교{i:02d}", "구분": kind, "등록 회선\n(03 번호 목록)": lines,
            "세종 등록 상태": reg, **marks, "제출 상태\n(10/15 기준)": state}


def number(i, j, kind, state="일괄 등록", doc_text="서류 모두 제출"):
    return {"No": j, "학교명": f"테스트대학교{i:02d}", "구분": kind, "발신번호": f"010-0000-{j:04d}",
            "상태": state, "등록일자": "2026-10-01", "제출 서류 (10/15 기준)": "" if state == "번호 없음" else doc_text}


def sample():
    """다섯 구분 — 구분마다 학교 둘(하나는 회선 둘·하나는 번호 없음 또는 서류 미비), 서류 상태를 섞는다."""
    schs, dcs, nums, j = [], [], [], 0
    states = (("모두 제출", ()), ("1종 미제출", ("법인인감",)), ("2종 미제출", ("법인인감", "신분증")),
              ("서류 확인 안 됨", ()))
    for k, kind in enumerate(KINDS):
        for m in range(2):
            i = k * 2 + m + 1
            lines, bad = (2, 1) if m == 0 and k % 2 else (2, 0) if m == 0 else (0, 0) if k < 2 else (1, 0)
            state, missing = states[(k + m) % 4]
            schs.append(school(i, kind, lines, bad, jp="O" if m == 0 else "", pims="O" if k % 3 == 0 else ""))
            dcs.append(doc(i, kind, lines, bad, state, missing))
            doc_text = {"모두 제출": "서류 모두 제출", "서류 확인 안 됨": "서류 확인 안 됨"}.get(
                state, "보완 필요: " + ", ".join(missing))
            for s in range(max(lines, 1)):
                j += 1
                st = "번호 없음" if not lines else "서류 미비" if s < bad else "일괄 등록"
                nums.append(number(i, j, kind, st, doc_text))
    return (table(SCHOOL_H, schs, school_tags), table(DOC_H, dcs, doc_tags), table(NUM_H, nums, number_tags))


def issues(n_types):
    return tuple({"No": t + 1, "유형": f"유형{t:02d}", "대상": f"테스트대학교{t + 1:02d}\n둘째 줄", "내용": "x"}
                 for t in range(n_types))


def payload(n_types=11, search=None, link_targets=None, tables=None):
    s, d, n = tables or sample()
    return ss.summary_payload(s, d, n, issues(n_types), SEARCH if search is None else search, BASE,
                              LINKS if link_targets is None else link_targets)


def value(p, coord):
    m = re.fullmatch(r"([A-Z]+)(\d+)", coord)
    col, row = ord(m.group(1)) - 64, int(m.group(2))
    cells = p["rows"][row - 1]
    return cells[col - 1] if col <= len(cells) else ""


class TestBaseLine(unittest.TestCase):
    def test_이름에_날짜가_있으면_작성일을_넣는다(self):
        self.assertEqual(ss.base_line("진학 발번리스트_261015.xlsx", "2026-11-12"),
                         "▪ 기준 자료: 세종 「진학 발번리스트_261015.xlsx」 (2025-09 이후 등록한 번호만 있음), "
                         "2026-10-15 작성, 2026-11-12 갱신")

    def test_날짜가_없으면_작성일_구간을_뺀다(self):
        self.assertEqual(ss.base_line("발번리스트.xlsx", "2026-11-12"),
                         "▪ 기준 자료: 세종 「발번리스트.xlsx」 (2025-09 이후 등록한 번호만 있음), 2026-11-12 갱신")

    def test_밑줄_없이_붙은_날짜도_읽는다(self):
        self.assertIn("2026-10-02 작성, 2026-11-12 갱신", ss.base_line("리스트261002", "2026-11-12"))

    def test_날짜가_아닌_여섯_자리는_작성일이_아니다(self):
        self.assertNotIn("작성", ss.base_line("리스트_261399", "2026-11-12"))


class TestLayout(unittest.TestCase):
    def test_다섯_구분_11_유형이면_63행_병합_C51_I62(self):
        p = payload(11)
        self.assertEqual(len(p["rows"]), 63)
        self.assertEqual(sorted(p["merged"], key=lambda m: int(m[1:3])), [f"C{r}:I{r}" for r in range(51, 63)])
        for coord, head in (("A7", "■ 등록 현황"), ("A16", "■ 등록 회선 × 제출 서류"), ("A26", "■ 서비스"),
                            ("A37", "■ 세종 등록 상태"), ("A45", "■ 서류별 미제출"), ("A50", "■ 확인 필요 · 11건")):
            self.assertTrue(str(value(p, coord)).startswith(head), coord)
        self.assertEqual(value(p, "A63"), "합계")

    def test_구분이_빠지면_섹션이_올라온다(self):
        s, d, n = sample()
        keep = [i for i, r in enumerate(s.rows) if r[2] != "대학원"]
        drop = (vt.Table(s.header, tuple(s.rows[i] for i in keep), 1), d, n)
        p = payload(2, tables=drop)
        self.assertTrue(str(value(p, "A15")).startswith("■ 등록 회선"))
        self.assertEqual(len(p["rows"]), 63 - 3 - 9)  # 구분별 섹션 셋에서 한 줄씩, 유형 9개

    def test_기준_자료_줄은_A5_에_그대로(self):
        p = payload()
        self.assertEqual(value(p, "A1"), "SMS 발신번호 사전등록 현황: 요약")
        self.assertEqual(value(p, "A5"), BASE)
        self.assertTrue(value(p, "A2").startswith("▪ 파란 수를 누르면"))

    def test_값은_str_int_만_수식_없음(self):
        p = payload()
        vals = [v for row in p["rows"] for v in row]
        self.assertTrue(all(type(v) in (str, int) for v in vals))
        self.assertFalse(any(isinstance(v, str) and v.startswith("=") for v in vals))

    def test_payload_모양(self):
        p = payload()
        self.assertEqual((p["kind"], p["sheet"]), ("summary", SUMMARY_SHEET))
        self.assertEqual(p["warnings"], [])
        self.assertEqual(p["styles"]["A1"], "title")
        self.assertEqual(p["styles"]["A7"], "section")
        self.assertEqual(p["styles"]["B8"], "head")
        self.assertEqual(p["styles"]["A14"], "label-total")
        self.assertEqual(p["styles"]["C14"], "link-total")
        self.assertEqual(p["styles"]["A24"], "foot")
        self.assertEqual(p["styles"]["C52"], "list")
        self.assertTrue(set(p["styles"].values()) <= set(STYLE_KEYS))


class TestLinks(unittest.TestCase):
    def test_0_칸에는_링크가_없다(self):
        p = payload()
        zeros = [c for c, v in ((c, value(p, c)) for c in p["styles"]) if v == 0]
        self.assertTrue(zeros)
        for c in zeros:
            self.assertNotIn(c, p["links"])
            self.assertNotIn(c, p["tips"])
            self.assertFalse(p["styles"][c].startswith("link"), c)
        for c in p["links"]:
            self.assertNotIn(value(p, c), (0, ""), c)

    def test_파란_수는_그_키로_거른_행_수(self):
        s, d, n = sample()
        iss = issues(11)
        p = ss.summary_payload(s, d, n, iss, SEARCH, BASE, LINKS)
        rows_of = {V1: [r[T_INDEX] for r in s.rows], V2: [r[T_INDEX] for r in d.rows],
                   V3: [r[T_INDEX] for r in n.rows], V4: [tag_cell([x["유형"]]) for x in iss]}
        self.assertGreater(len(p["links"]), 60)
        for c, loc in p["links"].items():
            sheet = loc.rpartition("!")[0]
            key = re.fullmatch(r"누르면 그 장에서 「(.*)」.+", p["tips"][c]).group(1)
            want = sum(1 for t in rows_of[sheet] if not key or f"|{key}|" in t)
            self.assertEqual(value(p, c), want, f"{c} 「{key}」")

    def test_링크는_검색_칸으로_툴팁은_링크마다(self):
        p = payload()
        self.assertEqual(set(p["links"].values()), LINKS)
        self.assertEqual(set(p["tips"]), set(p["links"]))
        self.assertEqual(p["links"]["B9"], f"{V1}!G6")
        self.assertEqual(p["tips"]["B9"], "누르면 그 장에서 「4년제」학교만 보기")
        self.assertEqual(p["tips"]["C14"], "누르면 그 장에서 「등록 회선」번호만 보기")

    def test_원본에_없는_대상은_값만_쓰고_warnings(self):
        p = payload(search={**SEARCH, V2: "A1"})
        self.assertNotIn(f"{V2}!A1", p["links"].values())
        self.assertFalse(any(loc.startswith(V2) for loc in p["links"].values()))
        self.assertEqual(len(p["warnings"]), 1)
        self.assertIn(f"{V2}!A1", p["warnings"][0])
        self.assertTrue(all(not p["styles"][c].startswith("link") for c in p["styles"]
                            if c[0] == "G" and c[1:] in ("30", "31")))

    def test_search_에_없는_04_는_원본_대상을_쓴다(self):
        p = payload()
        self.assertEqual(p["links"]["B52"], f"{V4}!D6")
        gone = payload(link_targets=LINKS - {f"{V4}!D6"})
        self.assertFalse(any(loc.startswith(V4) for loc in gone["links"].values()))
        self.assertIn(V4, gone["warnings"][0])


class TestVerify(unittest.TestCase):
    """payload 를 COM 처럼 적용한 요약을 실제 verify 요약 검사 7개로 본다."""

    def _before(self, path):
        wb = Workbook()
        ws = wb.active
        ws.title = SUMMARY_SHEET
        ws["A1"] = "옛 요약"
        for i, loc in enumerate(sorted(LINKS), start=2):
            sheet, cell = loc.split("!")
            ws[f"B{i}"] = i
            ws[f"B{i}"].hyperlink = Hyperlink(ref=f"B{i}", location=f"'{sheet}'!{cell}", tooltip="옛 툴팁")
        ws.merge_cells("C51:I51")
        wb.save(path)

    def _after(self, path, p):
        wb = Workbook()
        ws = wb.active
        ws.title = SUMMARY_SHEET
        for r, row in enumerate(p["rows"], start=1):
            for c, v in enumerate(row, start=1):
                if v != "":
                    ws.cell(row=r, column=c, value=v)
        for m in p["merged"]:
            ws.merge_cells(m)
        for coord, loc in p["links"].items():
            sheet, cell = loc.split("!")
            ws[coord].hyperlink = Hyperlink(ref=coord, location=f"'{sheet}'!{cell}", tooltip=p["tips"][coord])
        wb.save(path)

    def test_적용하면_요약_검사_7개를_통과한다(self):
        with tempfile.TemporaryDirectory() as d:
            before, after = Path(d) / "before.xlsx", Path(d) / "after.xlsx"
            self._before(before)
            bwb = load_workbook(before)
            p = payload(search=SEARCH, link_targets=set(vv.sheet_links(bwb[SUMMARY_SHEET]).values()))
            self._after(after, p)
            checks = vv.check_summary(bwb, load_workbook(after), p)
        self.assertEqual(len(checks), vv.CHECKS_PER_SUMMARY)
        self.assertEqual([c.label for c in checks if not c.ok], [])


if __name__ == "__main__":
    unittest.main()
