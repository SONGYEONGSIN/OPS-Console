"""verify_view.py — 보기 시트(01~03)·`00. 요약`·`_수정` 검사.

숨김 표의 행 수가 바뀌면 보기 시트의 수식·조건부 서식·`/ N건` 이 새 행 수를 따라가야 한다(결정 1).
원본·작업 사본은 test_verify_table.build 모양에 `00. 요약`(맨 앞)·`04`+`_확인`(안 만지는 장)을 얹는다.
작업 사본의 보기 시트는 fixtures_status.resize_view(COM 이 하는 일)로 맞추고, 실패는 그 뒤에 일부러 망가뜨린다.
"""
import json
import tempfile
import unittest
from pathlib import Path

from openpyxl.formatting.formatting import ConditionalFormattingList
from openpyxl.cell.cell import MergedCell
from openpyxl.worksheet.hyperlink import Hyperlink

import fixtures_status as fs
import test_verify as tv
import test_verify_table as tt
import verify
import verify_memos as vm
import verify_table as vt
import verify_view as vv

SUMMARY = "00. 요약"
V1, V3 = "01. 학교별 현황", "03. 번호 목록"
D = "테스트대학교D"
CHECK_HEADS = [("No", 6, "C", "no"), ("유형", 10, "C", "kind"), ("대상", 20, "L", "name"), ("내용", 30, "L", "note")]
EDIT = ["기계", "_학교", tt.A, "확인", "확인함"]
MERGED = ["A1:I1"]  # 요약 병합 — payload `merged` 가 정본이다(T14 가 데이터에 맞춰 만든다)


def summary(sejong=3, missing=0):
    """요약 값(1행~)과 링크 — 0 칸엔 링크가 없다(결정 8). 원본 링크 대상은 01 G6·03 D6 두 곳."""
    rows = [["SMS 발신번호 사전등록 현황: 요약"], ["▪ 기준 자료: 테스트 자료"], [],
            [f"■ 등록 현황 · {sejong}곳"], ["4년제", sejong - 1, "전문대학", 1], ["서류 미비", missing, "번호", 5]]
    links = {"B5": f"{V1}!G6", "D5": f"{V1}!G6", "D6": f"{V3}!D6"}
    return rows, ({**links, "B6": f"{V3}!D6"} if missing else links)


def tips_of(links):
    """링크 칸마다 툴팁 — 칸 주소만 담은 가짜 문구."""
    return {coord: f"tip {coord}" for coord in links}


def summary_fields(links, **override):
    """summary payload 의 병합·툴팁·스타일 — 정상 모양."""
    return {"merged": list(MERGED), "tips": tips_of(links), "styles": {"A1": "title"}, **override}


def write_summary(wb, rows, links, tips=None):
    """`00. 요약` 을 맨 앞에 만들거나 비우고 다시 쓴다 — 값만 + 시트 안 링크(+ 툴팁)."""
    ws = wb[SUMMARY] if SUMMARY in wb.sheetnames else wb.create_sheet(SUMMARY, 0)
    for row in ws.iter_rows():
        for c in row:
            if not isinstance(c, MergedCell):  # 병합된 칸은 왼쪽 위만 값·링크를 가진다
                c.hyperlink, c.value = None, None
    for r, row in enumerate(rows, start=1):
        for c, v in enumerate(row, start=1):
            ws.cell(r, c).value = v
    tips = tips_of(links) if tips is None else tips
    for coord, loc in links.items():
        sheet, cell = loc.split("!")
        ws[coord].hyperlink = Hyperlink(ref=coord, location=f"'{sheet}'!{cell}", tooltip=tips.get(coord))
    if "A1:I1" not in {str(m) for m in ws.merged_cells.ranges}:
        ws.merge_cells("A1:I1")


def base(wb):
    write_summary(wb, *summary())
    recs = [{"no": 1, "kind": "확인", "name": tt.A, "note": "메모 X", "tags": ["확인"]}]
    fs.search_sheet(wb, "04. 확인 필요", "_확인", CHECK_HEADS, recs, fs.picks_of(recs))


def school_d():
    sch = {**tt.school(4, D, "", 1), "apply": "", "pims": ""}
    doc = {"no": 4, "name": D, "kind": "4년제", "lines": 1, "state": "등록", "status": "서류 확인 안 됨",
           "pdf": None, "tags": ["4년제"]}
    return tt.schools() + [sch], tt.docs() + [doc]


def count_cell(ws):
    return next(c for row in ws.iter_rows(max_row=8) for c in row
                if isinstance(c.value, str) and c.value.startswith("=") and "건\"" in c.value)


class VerifyViewTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.before = tt.build(self.dir / "before.xlsm", moa_rows=tv.OLD_MOA, mutate=base)

    def tearDown(self):
        self._tmp.cleanup()

    def _after(self, name="after.xlsm", nums=None, schs=None, dcs=None, keep=(), sm=None, edits=None, extra=None,
               tips=None):
        """keep 의 숨김 표는 보기 시트를 맞추지 않는다(옛 범위 그대로). tips 는 시트에 쓸 툴팁(기본 = 정상)."""
        def mutate(wb):
            base(wb)
            for hid, recs in (("_번호", nums or tt.numbers()), ("_학교", schs or tt.schools()),
                              ("_서류", dcs or tt.docs())):
                tt.rewrite(wb, hid, recs)
                if hid not in keep:
                    tt.resize(wb, hid, len(recs))
            write_summary(wb, *(sm or summary()), tips=tips)
            if edits is not None:
                tt.edits_sheet(edits)(wb)
            if extra is not None:
                extra(wb)
        return tt.build(self.dir / name, mutate=mutate)

    def _sheets(self, after, tables=None, sm=None, meta=None, views=True, view=None, fields=None, more=()):
        """view 는 {숨김 표: view payload 덮어쓸 필드}, fields 는 summary payload 에 덮어쓸 필드, more 는 덧붙일 payload."""
        hids = ("_번호", "_학교", "_서류")
        out = [tt.payload(self.before, after, s, **(tables or {}).get(s, {})) for s in hids]
        out += [tt.view_payload(after, s, **(view or {}).get(s, {})) for s in hids] if views else []
        rows, links = sm or summary()
        out.append({"kind": "summary", "sheet": SUMMARY, "rows": rows, "links": links,
                    **{**summary_fields(links), **(fields or {})}})
        if meta is not None:
            out.append({"kind": "meta", "sheet": vt.META_SHEET, "rows": [r + ["", "2026-11-10"] for r in meta]})
        return out + list(more)

    def _failed(self, after, sheets=None, **kw):
        checks = verify.verify_workbook(self.before, after, [tv.MOA, tv.PIMS] + (sheets or self._sheets(after, **kw)),
                                        module_hashes=tv.same_hashes, baseline=self.before)
        return verify.failed_labels(checks), checks

    def _grown(self, name="after.xlsm", **kw):
        schs, dcs = school_d()
        return self._after(name, nums=tt.changed_numbers(), schs=schs, dcs=dcs, **kw)

    _ADDED = {"_번호": {"added": ["01000000010"]}, "_학교": {"added": [D]}, "_서류": {"added": [D]}}

    def test_정상_갱신은_통과(self):
        sm = summary(sejong=4, missing=1)
        after = self._grown(sm=sm, edits=[EDIT])
        failed, checks = self._failed(after, tables=self._ADDED, sm=sm, meta=[EDIT])
        self.assertEqual(failed, [])
        self.assertEqual(len(checks), 27 + 1 + 3 * vt.CHECKS_PER_TABLE + 3 * vm.CHECKS_PER_LOST + 2
                         + 3 * vv.CHECKS_PER_VIEW + vv.CHECKS_PER_SUMMARY + vv.CHECKS_PER_META)

    def test_뷰가_옛_범위를_보면_실패(self):
        # 01 을 안 맞추면 새 학교가 보기 화면에서 안 보인다 — 참조 범위·/ N건·행 수식이 모두 잡는다
        after = self._grown(keep=("_학교",))
        failed, _ = self._failed(after, tables=self._ADDED)
        self.assertEqual(failed, [vt.label(V1, x) for x in (vv.L_RANGE, vv.L_COUNT, vv.L_ROWS)])

        def old(cell_of, a, b):
            def edit(wb):
                c = cell_of(wb[V3])
                c.value = c.value.replace(a, b)
            return edit
        idx = f"{chr(64 + len(fs.NUMBER_HEADS) + 2)}9"  # 숨김 순번 열 — `_번호!$P$2:$P$N` 을 본다
        cases = (("건수", old(count_cell, "/ 6건", "/ 5건"), [vv.L_COUNT]),
                 ("순번", old(lambda ws: ws[idx], "$P$7", "$P$6"), [vv.L_RANGE]),
                 ("INDEX", old(lambda ws: ws["D10"], "D$7", "D$6"), [vv.L_RANGE]),
                 ("건수_범위", old(count_cell, "$P$7", "$P$6"), [vv.L_RANGE, vv.L_COUNT]))
        for tag, edit, expected in cases:
            after = self._grown(f"after-{tag}.xlsm", extra=edit)
            self.assertEqual(self._failed(after, tables=self._ADDED)[0], [vt.label(V3, x) for x in expected], tag)

    def test_CF_가_안_따라가면_실패(self):
        def old_cf(wb):
            ws = wb[V3]
            rules = [r for cf in ws.conditional_formatting for r in cf.rules]
            ws.conditional_formatting = ConditionalFormattingList()
            for r in rules:
                ws.conditional_formatting.add("E9:E13", r)  # 원본 5행 → 9~13행 그대로
        after = self._grown(extra=old_cf)
        self.assertEqual(self._failed(after, tables=self._ADDED)[0], [vt.label(V3, vv.L_CF)])

    def test_줄면_남은_수식_실패(self):
        nums = [r for r in tt.numbers() if r["num"] != "010-0000-0003"]
        gone = {"_번호": {"removed": ["01000000003"]}}
        self.assertEqual(self._failed(self._after(nums=nums), tables=gone)[0], [])
        # 맞추지 않으면 13행(옛 마지막 줄)의 수식이 빈 줄을 센다
        stale = self._after("after-stale.xlsm", nums=nums, keep=("_번호",))
        self.assertEqual(self._failed(stale, tables=gone)[0],
                         [vt.label(V3, x) for x in (vv.L_RANGE, vv.L_COUNT, vv.L_TAIL, vv.L_CF)])
        left = self._after("after-left.xlsm", nums=nums,
                           extra=lambda wb: setattr(wb[V3]["A13"], "value", '=IF($J13="","",1)'))
        failed, checks = self._failed(left, tables=gone)
        self.assertEqual(failed, [vt.label(V3, vv.L_TAIL)])
        self.assertIn("13행", {c.label: c for c in checks}[vt.label(V3, vv.L_TAIL)].detail)

    def test_요약_링크가_빠지면_실패(self):
        sm = summary(missing=1)
        dropped = (sm[0], {k: v for k, v in sm[1].items() if k != "B6"})
        failed, _ = self._failed(self._after(sm=dropped), sm=sm)
        self.assertEqual(failed, [vt.label(SUMMARY, vv.L_SUM_LINKS)])
        zero = summary()[0], {**summary()[1], "B6": f"{V3}!D6"}  # 0 칸에 링크
        self.assertEqual(self._failed(self._after("after-zero.xlsm", sm=zero), sm=zero)[0],
                         [vt.label(SUMMARY, vv.L_SUM_TARGET)])
        # 허용 대상 = 원본 요약의 링크 대상(01 G6·03 D6). 02 G6 은 검색 칸이어도 원본에 없던 대상이다
        for tag, loc in (("A9", f"{V1}!A9"), ("02", "02. 학교별 제출 서류!G6")):
            elsewhere = summary()[0], {**summary()[1], "B5": loc}
            self.assertEqual(self._failed(self._after(f"after-else-{tag}.xlsm", sm=elsewhere), sm=elsewhere)[0],
                             [vt.label(SUMMARY, vv.L_SUM_TARGET)], tag)
        failed, checks = self._failed(self._after("after-num.xlsm"), sm=summary(sejong=4))
        self.assertEqual(failed, [vt.label(SUMMARY, vv.L_SUM_DATA)])
        dumped = json.dumps([c.__dict__ for c in checks], ensure_ascii=False)
        for value in ("테스트", "등록 현황", "4년제"):
            self.assertNotIn(value, dumped)

    def test__수정_은_숨김_맨_끝(self):
        place = vt.label(vt.META_SHEET, vv.L_META_PLACE)
        visible = self._after(edits=[EDIT], extra=lambda wb: setattr(wb[vt.META_SHEET], "sheet_state", "visible"))
        self.assertIn(place, self._failed(visible, meta=[EDIT])[0])
        moved = self._after("after-moved.xlsm", edits=[EDIT],
                            extra=lambda wb: wb.move_sheet(vt.META_SHEET, offset=-1))
        self.assertIn(place, self._failed(moved, meta=[EDIT])[0])
        self.assertEqual(self._failed(self._after("after-ok.xlsm", edits=[EDIT]), meta=[EDIT])[0], [])

    def test__수정_은_이어_쓰고_텍스트(self):
        human = ["사람", "_번호", "01000000002", "비고", "메모 X"]
        self.before = tt.build(self.dir / "before-e.xlsm", moa_rows=tv.OLD_MOA,
                               mutate=lambda wb: (base(wb), tt.edits_sheet([EDIT])(wb)))
        ok = self._after("after-e.xlsm", edits=[EDIT, human])
        self.assertEqual(self._failed(ok, meta=[EDIT, human])[0], [])
        dropped = self._after("after-drop.xlsm", edits=[human])  # 원본 행을 지웠다
        self.assertEqual(self._failed(dropped, meta=[human])[0], [vt.label(vt.META_SHEET, vv.L_META_KEEP)])
        number = [*human[:2], 1000000002, *human[3:]]  # 텍스트 서식이 아니라 숫자로 바뀐 키
        typed = self._after("after-int.xlsm", edits=[EDIT, number])
        self.assertEqual(self._failed(typed, meta=[EDIT, number])[0], [vt.label(vt.META_SHEET, vv.L_META_TEXT)])

    def test_숨김_표에_보기_검사가_없으면_실패(self):
        after = self._after()
        self.assertEqual(self._failed(after, views=False)[0], [vv.L_VIEWS])

    def test_요약_검사는_정확히_하나(self):
        after = self._after()
        full = self._sheets(after)
        others = [s for s in full if s["kind"] != "summary"]
        summaries = [s for s in full if s["kind"] == "summary"]
        self.assertEqual(self._failed(after, sheets=others)[0], [vv.L_SUMMARY_ONE])
        self.assertEqual(self._failed(after, sheets=full + summaries)[0], [vv.L_SUMMARY_ONE])

    def _view_failed(self, name, extra=None, **view):
        after = self._after(name, extra=extra)
        return self._failed(after, view={"_번호": view} if view else None)[0]

    def test_보기_머리·틀_고정이_바뀌면_실패(self):
        top = [vt.label(V3, vv.L_TOP)]
        self.assertEqual(self._view_failed("h.xlsm", lambda wb: setattr(wb[V3]["A1"], "value", "다른 제목")), top)
        self.assertEqual(self._view_failed("f.xlsm", lambda wb: setattr(wb[V3], "freeze_panes", "A8")), top)

    def test_기준_자료_칸은_A열_1_8행의_텍스트만(self):
        top = [vt.label(V3, vv.L_TOP)]

        def note(v):
            return lambda wb: setattr(wb[V3]["A4"], "value", v)
        self.assertEqual(self._view_failed("n-ok.xlsm", note("▪ 기준 자료: 새 자료"), sourceNote="A4"), [])
        self.assertEqual(self._view_failed("n-f.xlsm", note("=1"), sourceNote="A4"), top)
        self.assertEqual(self._view_failed("n-0.xlsm", sourceNote="A4"), top)  # 빈 칸
        # A열 1~8행 밖은 면제하지 않는다 — 검색 칸·열 머리글을 기준 자료 칸이라고 우겨 바꾸는 것을 막는다
        for coord in ("G6", "A9"):
            self.assertEqual(self._view_failed(f"n-{coord}.xlsm", sourceNote=coord), top, coord)

    def test_건수_칸이_옮겨지면_실패(self):
        def move(wb):
            c = count_cell(wb[V3])
            wb[V3].cell(c.row, c.column + 1).value, c.value = c.value, None
        self.assertEqual(self._view_failed("m.xlsm", move), [vt.label(V3, x) for x in (vv.L_COUNT, vv.L_TOP)])

    def test_보기_payload_행_수가_다르면_실패(self):
        self.assertEqual(self._view_failed("r.xlsm", rows=6), [vt.label(V3, vv.L_RANGE)])

    def test_요약_수식·모양이_바뀌면_실패(self):
        rows, links = summary()
        sm = ([*rows, ["=1+1"]], links)
        self.assertEqual(self._failed(self._after("s-f.xlsm", sm=sm), sm=sm)[0], [vt.label(SUMMARY, vv.L_SUM_FORMULA)])
        frozen = self._after("s-m.xlsm", extra=lambda wb: setattr(wb[SUMMARY], "freeze_panes", "A3"))
        self.assertEqual(self._failed(frozen)[0], [vt.label(SUMMARY, vv.L_SUM_META)])

    def test__수정_머리글이_바뀌면_실패(self):
        after = self._after("e-h.xlsm", edits=[EDIT],
                            extra=lambda wb: setattr(wb[vt.META_SHEET]["F1"], "value", "메모"))
        self.assertEqual(self._failed(after, meta=[EDIT])[0], [vt.label(vt.META_SHEET, vv.L_META_HEADER)])

    # ---- 요약 payload 계약: merged·tips·styles (T14 가 이대로 만든다)
    @staticmethod
    def _merge(rng):
        return lambda wb: wb[SUMMARY].merge_cells(rng)

    def _without(self, after, field, replace=None):
        """summary payload 에서 field 를 빼거나(replace=None) 바꾼 sheets."""
        sheets = self._sheets(after)
        i = next(i for i, s in enumerate(sheets) if s["kind"] == "summary")
        rest = {k: v for k, v in sheets[i].items() if k != field}
        sheets[i] = rest if replace is None else {**rest, field: replace}
        return sheets

    def test_요약_병합은_payload_merged_와_비교(self):
        # 원본 요약 병합은 A1:I1 하나 — 데이터가 늘어 병합이 하나 더 생겨도 payload 가 같으면 통과
        two = ["A1:I1", "A2:I2"]
        after = self._after(extra=self._merge("A2:I2"))
        self.assertEqual(self._failed(after, fields={"merged": two})[0], [])
        self.assertEqual(self._failed(after, fields={"merged": two[::-1]})[0], [])  # 순서는 보지 않는다
        # 시트에는 둘, payload 에는 하나 → 어긋남
        self.assertEqual(self._failed(after, fields={"merged": MERGED})[0], [vt.label(SUMMARY, vv.L_SUM_META)])
        # 시트에는 하나, payload 에는 둘
        self.assertEqual(self._failed(self._after("m1.xlsm"), fields={"merged": two})[0],
                         [vt.label(SUMMARY, vv.L_SUM_META)])

    def test_merged_빠지면_실패(self):
        label = [vt.label(SUMMARY, vv.L_SUM_META)]
        for tag, merged in (("없음", None), ("문자열", "A1:I1"), ("범위아님", ["A1:I1", "병합"])):
            after = self._after(f"mg-{tag}.xlsm")
            self.assertEqual(self._failed(after, sheets=self._without(after, "merged", merged))[0], label, tag)

    def test_병합_말고_틀_고정은_여전히_원본과_같아야(self):
        two = {"merged": ["A1:I1", "A2:I2"]}
        frozen = self._after("mf.xlsm", extra=lambda wb: (wb[SUMMARY].merge_cells("A2:I2"),
                                                          setattr(wb[SUMMARY], "freeze_panes", "A3")))
        self.assertEqual(self._failed(frozen, fields=two)[0], [vt.label(SUMMARY, vv.L_SUM_META)])

    def test_링크_칸_tip_빠지면_실패(self):
        label = [vt.label(SUMMARY, vv.L_SUM_TIPS)]
        tips = tips_of(summary()[1])
        # payload 에서 한 칸이 빠졌다
        self.assertEqual(self._failed(self._after(), fields={"tips": {k: v for k, v in tips.items() if k != "D6"}})[0],
                         label)
        # 시트의 하이퍼링크에 툴팁이 없다
        bare = self._after("tip-bare.xlsm", tips={k: v for k, v in tips.items() if k != "D6"})
        self.assertEqual(self._failed(bare)[0], label)
        # 툴팁 문구가 다르다
        self.assertEqual(self._failed(self._after("tip-diff.xlsm"), fields={"tips": {**tips, "B5": "다른 문구"}})[0],
                         label)
        # 빈 문자열은 툴팁이 아니다
        empty = {**tips, "B5": ""}
        self.assertEqual(self._failed(self._after("tip-empty.xlsm", tips=empty), fields={"tips": empty})[0], label)
        # 사전이 아니다
        self.assertEqual(self._failed(self._after("tip-list.xlsm"), fields={"tips": []})[0], label)

    def test_링크_없는_칸_tip_은_실패(self):
        tips = {**tips_of(summary()[1]), "C3": "링크가 없는 칸"}
        self.assertEqual(self._failed(self._after(), fields={"tips": tips})[0], [vt.label(SUMMARY, vv.L_SUM_TIPS)])

    def test_tip_문구는_결과에_싣지_않는다(self):
        tips = {**tips_of(summary()[1]), "B5": "비밀 툴팁 문구"}
        _failed, checks = self._failed(self._after(), fields={"tips": tips})
        self.assertNotIn("툴팁 문구", json.dumps([c.__dict__ for c in checks], ensure_ascii=False))

    def test_styles_는_사전인지만_본다(self):
        label = [vt.label(SUMMARY, vv.L_SUM_STYLES)]
        after = self._after()
        self.assertEqual(self._failed(after, fields={"styles": {"Z99": "아무 키", "A1": {"bold": True}}})[0], [])
        self.assertEqual(self._failed(after, fields={"styles": {}})[0], [])
        self.assertEqual(self._failed(after, fields={"styles": ["title"]})[0], label)
        self.assertEqual(self._failed(after, sheets=self._without(after, "styles"))[0], label)

    # ---- 시트 허용 목록 (sheet_names.VIEW_OF·SUMMARY_SHEET)
    def test_허용_목록_밖_보기_시트는_실패(self):
        after = self._after()
        outside = {"kind": "view", "sheet": "04. 확인 필요", "source": "_확인", "rows": 1, "sourceNote": None}
        self.assertEqual(self._failed(after, more=[outside])[0], [vt.label("04. 확인 필요", vv.L_VIEW_KNOWN)])
        # 이름은 허용 목록에 있어도 짝이 다른 숨김 표를 보면 안 된다
        swapped = {**outside, "sheet": V1, "source": "_서류"}
        self.assertEqual(self._failed(after, more=[swapped])[0], [vt.label(V1, vv.L_VIEW_KNOWN)])

    def test_허용_짝이_아닌_보기_payload_는_숨김_표의_보기_검사가_아니다(self):
        # 03 의 view payload 가 엉뚱한 이름으로 들어오면 `_번호` 의 보기 검사는 없는 것이다
        failed, _ = self._failed(self._after(), view={"_번호": {"sheet": "04. 확인 필요"}})
        self.assertIn(vv.L_VIEWS, failed)

    def test_허용_목록_밖_요약_시트는_실패(self):
        after = self._after()
        rows, links = summary()
        outside = {"kind": "summary", "sheet": "04. 확인 필요", "rows": rows, "links": links, **summary_fields(links)}
        self.assertEqual(self._failed(after, more=[outside])[0], [vt.label("04. 확인 필요", vv.L_SUM_KNOWN)])
        # 요약은 정확히 하나 — 허용 이름만 센다
        only_outside = [s for s in self._sheets(after) if s["kind"] != "summary"] + [outside]
        self.assertIn(vv.L_SUMMARY_ONE, self._failed(after, sheets=only_outside)[0])


if __name__ == "__main__":
    unittest.main()
