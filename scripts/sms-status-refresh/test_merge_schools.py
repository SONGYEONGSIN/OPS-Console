"""merge_schools.py — `_학교`·`_서류` 보존 갱신(세종 열·판정 열만 다시 계산, 사람 칸은 그대로).

표는 fixtures_status 의 머리글로 만든 verify_table.Table 이고, 세종 회선은 sejong 레코드 모양을 손으로 만든다.
학교·번호·담당자는 전부 가짜다(`테스트대학교A`, `010-0000-0001`, `op-a`).
"""
import datetime as dt
import unittest

from openpyxl import Workbook
from openpyxl.utils import get_column_letter

import edits
import fixtures_status as fs
import keys
import merge_schools as ms
import test_verify_table as tvt
import verify_table as vt
from contract import StepFailure
from sejong import group_schools, kind

A, B, C = tvt.A, tvt.B, tvt.C
D, X = "테스트대학교D", "테스트대학교X"
U_LAST = 10
UNIV = {A: 9001, B: 4001, C: 9003, D: 9004}  # B 는 전문대학(4000번대)


def box(hid):
    name, heads = tvt.VIEWS[hid]
    return f"'{name}'!${get_column_letter(fs.box_span([w for _h, w, *_ in heads])[0])}$6"


def table(hid, records) -> vt.Table:
    """fixtures_status.write_hidden_row 와 같은 숨김 표 — A~ 데이터, P 수식, T 태그."""
    heads = tvt.VIEWS[hid][1]
    header = tuple([h for h, *_ in heads] + [None] * (vt.WIDTH - len(heads)))
    rows = []
    for i, rec in enumerate(records, start=2):
        r = [None] * vt.WIDTH
        for j, (_h, _w, _a, key) in enumerate(heads):
            r[j] = None if rec.get(key, "") == "" else rec[key]
        if "pdf" in rec:
            r[fs.PDF_COL - 1] = rec["pdf"]
        r[15] = fs.p_formula(box(hid), i, len(heads), U_LAST)
        r[19] = "|" + "|".join(rec.get("tags", [])) + "|"
        rows.append(tuple(r))
    return vt.Table(header, tuple(rows), U_LAST)


def line(name, num, state="일괄 등록", day=(2026, 1, 2), memo="", text="", univ=None):
    d = dt.date(*day) if day else None
    u = UNIV.get(name, 9099) if univ is None else univ
    return {"univ": u, "name": name, "kind": kind(u, name), "num": num, "state": state if num else "번호 없음",
            "date": d, "raw_date": None, "memo": memo, "text": text, "check": "", "date_fix": d}


def base_lines():
    return [line(A, "010-0000-0001"), line(A, "010-0000-0002", "추가 등록"), line(A, "010-0000-0004", "추가 등록"),
            line(B, "010-0000-0003"), line(C, "010-0000-0009")]


def col(hid, name):
    return vt.Table(table(hid, []).header, (), 1).col(name)


def cells(rows, hid, name):
    return [r[col(hid, name)] for r in rows]


def run(lines=None, schs=None, dcs=None, issues=(), own=None):
    school, docs = table("_학교", schs or tvt.schools()), table("_서류", dcs or tvt.docs())
    return school, docs, ms.merge_schools(school, docs, group_schools(lines or base_lines()), issues,
                                          own or edits.Ownership())


def blank(v):
    return "" if v is None else v


class MergeSchoolsTest(unittest.TestCase):
    def test_세종_열만_다시_계산(self):
        lines = base_lines() + [line(A, "010-0000-0005", "서류 미비", day=(2026, 3, 4))]
        school, docs, m = run(lines)  # 기준 없음 → 판정 칸도 전부 사람
        sejong = {col("_학교", n) for n in vt.SPECS["_학교"].sejong}
        got = m.school_rows[0]
        self.assertEqual([got[col("_학교", n)] for n in vt.SPECS["_학교"].sejong], [4, 1, 2, 1, "2026-03-04"])
        for i, (b, a) in enumerate(zip(school.rows[0], got)):
            if i not in sejong | {15, 19}:
                self.assertEqual(blank(b), a, vt.COLUMNS[i])
        d = m.doc_rows[0]
        self.assertEqual((d[col("_서류", "등록 회선")], d[col("_서류", "세종 등록 상태")]), (4, "서류 미비 1회선"))
        self.assertEqual(d[fs.PDF_COL - 1], "pdf-token-a")  # 모르는 열은 사람 칸
        self.assertEqual(m.added, {"_학교": (), "_서류": ()})
        self.assertEqual(m.vanished, {"_학교": (), "_서류": ()})

    def test_새_학교는_끝에_같은_No_로(self):
        _s, _d, m = run(base_lines() + [line(D, "010-0000-0010", day=(2026, 2, 3))])
        new = m.school_rows[-1]
        self.assertEqual(len(m.school_rows), 4)
        self.assertEqual([new[col("_학교", n)] for n in ("No", "학교명", "구분")], [4, D, "4년제"])
        for name in ("원서접수", "PIMS", "담당자"):
            self.assertEqual(new[col("_학교", name)], "", name)
        self.assertEqual(new[col("_학교", "최근 등록일")], "2026-02-03")
        self.assertEqual(new[15], fs.p_formula(box("_학교"), 5, len(fs.SCHOOL_HEADS), U_LAST))
        doc = m.doc_rows[-1]
        self.assertEqual([doc[col("_서류", n)] for n in ("No", "학교명", "신청서", "위임장", "제출 상태", "미제출 서류")],
                         [4, D, "", "", "서류 확인 안 됨", ""])
        self.assertEqual(doc[fs.PDF_COL - 1], "")
        self.assertEqual(m.added, {"_학교": (D,), "_서류": (D,)})

    def test_새_키는_keys_와_같다(self):
        school, docs, m = run(base_lines() + [line(D, "010-0000-0010")])
        for hid, before, rows in (("_학교", school, m.school_rows), ("_서류", docs, m.doc_rows)):
            pairs = [[(r[col(hid, "학교명")], r[col(hid, "구분")]) for r in t] for t in (before.rows, rows)]
            kb, ka = keys.school_keys(*pairs)
            self.assertEqual(set(m.added[hid]), set(ka) - set(kb), hid)

    def test_빠진_학교는_행을_남긴다(self):
        school, _d, m = run([x for x in base_lines() if x["name"] != C])
        self.assertEqual(len(m.school_rows), 3)
        got = m.school_rows[2]
        self.assertEqual([got[col("_학교", n)] for n in vt.SPECS["_학교"].sejong], [0, 0, 0, 0, "-"])
        self.assertEqual([got[col("_학교", n)] for n in ("No", "학교명", "담당자")], [3, C, "op-c"])
        doc = m.doc_rows[2]
        self.assertEqual((doc[col("_서류", "등록 회선")], doc[col("_서류", "세종 등록 상태")]), (0, "번호 없음"))
        self.assertEqual(m.vanished, {"_학교": (C,), "_서류": (C,)})
        self.assertEqual(m.added, {"_학교": (), "_서류": ()})

    def test_사람이_고친_확인은_그대로(self):
        base = tvt.schools()
        base[0] = {**base[0], "check": ""}  # 기준 판엔 비어 있었다 → 원본 '확인함' 은 사람이 쓴 것
        own = edits.Ownership.from_baseline({"_학교": table("_학교", base)})
        lines = base_lines() + [line(B, "010-0000-0006", "서류 미비")]
        _s, _d, m = run(lines, own=own)
        self.assertEqual(cells(m.school_rows, "_학교", "확인"), ["확인함", "확인 필요", ""])
        self.assertIn(("_학교", A, "확인"), m.decisions.kept)
        self.assertNotIn(("_학교", B, "확인"), m.decisions.kept)

    def test_확인은_확인_시트_대상도_본다(self):
        own = edits.Ownership.from_baseline({"_학교": table("_학교", tvt.schools())})
        issues = ({"유형": "미제출", "대상": f"{C}\n010-0000-0009 (1회선)"}, {"유형": "계정", "대상": f"{B} (법인)"})
        _s, _d, m = run(issues=issues, own=own)
        self.assertEqual(cells(m.school_rows, "_학교", "확인")[1:], ["확인 필요", "확인 필요"])

    def test_제출_서류는_서류_행으로(self):
        own = edits.Ownership.from_baseline({"_학교": table("_학교", tvt.schools())})
        dcs = tvt.docs()
        dcs[1] = {**dcs[1], "d1": "✕", "d2": "대체", "status": "2종 미제출"}
        dcs[2] = {**dcs[2], "status": "모두 제출"}
        _s, _d, m = run(dcs=dcs, own=own)
        self.assertEqual(cells(m.school_rows, "_학교", "제출 서류"),
                         ["일부 제출", "2종 미제출 (신청서, 위임장)", "모두 제출"])

    def test_비고는_덧붙이기만(self):
        lines = base_lines()
        lines[0] = {**lines[0], "memo": "가 메모"}
        lines[3] = {**lines[3], "memo": "나 메모"}
        schs = tvt.schools()
        schs[1] = {**schs[1], "note": "나 메모; 다른 것"}  # 출처 `; ` 결합 — 이미 있는 조각은 다시 안 붙는다
        base = tvt.schools()
        base[1] = {**base[1], "note": "나 메모; 다른 것"}
        own = edits.Ownership.from_baseline({"_학교": table("_학교", base)})
        _s, _d, m = run(lines, schs=schs, own=own)
        self.assertEqual(cells(m.school_rows, "_학교", "비고"), ["가 메모", "나 메모; 다른 것", ""])

    def test_번호가_생기면_번호_없음만_지운다(self):
        schs = tvt.schools()
        schs[2] = {**schs[2], "note": "번호 없음 / 연락 중"}
        own = edits.Ownership.from_baseline({"_학교": table("_학교", schs)})
        _s, _d, m = run(schs=schs, own=own)
        self.assertEqual(m.school_rows[2][col("_학교", "비고")], "연락 중")
        _s, _d, gone = run([x for x in base_lines() if x["name"] != C], schs=schs, own=own)
        self.assertEqual(gone.school_rows[2][col("_학교", "비고")], "번호 없음 / 연락 중")

    def test_태그는_최종_값으로(self):
        _s, _d, m = run(base_lines() + [line(D, "010-0000-0010", "서류 미비")])
        self.assertEqual(m.school_rows[3][19],
                         "|서류 미비|서비스 미확인|확인 필요|4년제|4년제 · 서류 미비|4년제 · 서비스 미확인|4년제 · 확인 필요|")
        self.assertEqual(m.doc_rows[3][19], "|서류 확인 안 됨|서류 미비 회선 있음|서류 미비 회선 있음 · 서류 확인 안 됨|"
                                            "4년제|4년제 · 서류 확인 안 됨|4년제 · 서류 미비 회선 있음|"
                                            "4년제 · 서류 미비 회선 있음 · 서류 확인 안 됨|")
        self.assertTrue(m.school_rows[0][19].endswith("|op-a|"))

    def test_P_는_행마다_템플릿으로(self):
        _s, _d, m = run(base_lines() + [line(D, "010-0000-0010")])
        for i, r in enumerate(m.school_rows, start=2):
            self.assertEqual(r[15], fs.p_formula(box("_학교"), i, len(fs.SCHOOL_HEADS), U_LAST))
        for i, r in enumerate(m.doc_rows, start=2):
            self.assertEqual(r[15], fs.p_formula(box("_서류"), i, len(fs.DOC_HEADS), U_LAST))

    def test_칸은_COM_이_옮기는_타입만(self):
        _s, _d, m = run(base_lines() + [line(D, "010-0000-0010")])
        for r in m.school_rows + m.doc_rows:
            self.assertEqual(len(r), vt.WIDTH)
            for v in r:
                self.assertIsInstance(v, (str, int))

    def test_이름이_겹쳐도_구분이_다르면_잇는다(self):
        schs = tvt.schools() + [tvt.school(4, X, "op-x", 1), tvt.school(5, X, "op-y", 1, kind="전문대학")]
        dcs = tvt.docs() + [tvt.doc(4, X, None), tvt.doc(5, X, None, kind="전문대학")]
        lines = base_lines() + [line(X, "010-0000-0011", univ=9010),
                                line(X, "010-0000-0012", univ=4010), line(X, "010-0000-0013", univ=4010)]
        _s, _d, m = run(lines, schs=schs, dcs=dcs)
        self.assertEqual(cells(m.school_rows, "_학교", "등록 회선")[3:], [1, 2])
        self.assertEqual(m.decisions.ambiguous, ())

    def test_이름과_구분이_겹치면_판정하지_않는다(self):
        schs = tvt.schools() + [tvt.school(4, X, "op-x", 5), tvt.school(5, X, "op-y", 5)]
        dcs = tvt.docs() + [tvt.doc(4, X, None), tvt.doc(5, X, None)]
        lines = base_lines() + [line(X, "010-0000-0011", univ=9010), line(X, "010-0000-0012", univ=9011)]
        school, _d, m = run(lines, schs=schs, dcs=dcs)
        self.assertEqual(cells(m.school_rows, "_학교", "등록 회선")[3:], [5, 5])  # 손대지 않는다
        self.assertEqual(m.school_rows[3][19], school.rows[3][19])
        self.assertIn(("_학교", f"{X}+4년제"), m.decisions.ambiguous)
        # 표에 한 줄, 세종에 같은 이름·구분 두 그룹 — 그 줄은 손대지 않고 새 행도 만들지 않는다
        _s, _d, one = run(lines, schs=schs[:4], dcs=dcs[:4])
        self.assertEqual(len(one.school_rows), 4)
        self.assertEqual(one.school_rows[3][col("_학교", "등록 회선")], 5)
        self.assertEqual(one.added, {"_학교": (), "_서류": ()})
        self.assertTrue(one.decisions.ambiguous)

    def test_결정에_meta_rows_입력이_있다(self):
        school, docs, m = run()
        self.assertEqual([(c.sheet, c.before, list(map(list, c.rows))) for c in m.decisions.changes],
                         [("_학교", school, m.school_rows), ("_서류", docs, m.doc_rows)])
        rows = edits.meta_rows(None, m.decisions.changes, edits.Ownership(), today="2026-11-11")
        self.assertTrue(all(r[0] == vt.HUMAN for r in rows))  # 기준 없음 → 전부 사람 기록


class ReadIssuesTest(unittest.TestCase):
    def test_확인_시트_행을_머리글_이름으로(self):
        wb = Workbook()
        ws = wb.create_sheet("_확인")
        ws.append(["No", "유형", "대상", "내용", "근거", "할 일"])
        ws.append([1, "미제출", f"{A}\n010-0000-0001", "내용", "근거", "할 일"])
        ws.append([None] * 6)
        ws.append([2, "계정", "계정 담당자", "", "", ""])
        ws.cell(1, 21, "고를 값")
        ws.cell(2, 21, "미제출")
        got = ms.read_issues(wb)
        self.assertEqual([r["대상"] for r in got], [f"{A}\n010-0000-0001", "계정 담당자"])
        self.assertNotIn("고를 값", got[0])

    def test_확인_시트가_없거나_대상_열이_없으면_실패(self):
        wb = Workbook()
        with self.assertRaises(StepFailure) as e:
            ms.read_issues(wb)
        self.assertEqual(e.exception.code, "sheet_shape")
        wb.create_sheet("_확인").append(["No", "유형"])
        with self.assertRaises(StepFailure):
            ms.read_issues(wb)


if __name__ == "__main__":
    unittest.main()
