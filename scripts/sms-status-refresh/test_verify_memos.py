"""verify_memos.py — 옮기지 못한 메모(lostMemos) 검사.

숨김 표에서 빠진 키의 사람 칸 중 값이 있던 칸 {(키, 열, 값)} = 이번에 `_수정` 에 이은 `못 옮김` 행 {(키, 열, 값)}(시트별).
칸마다 한 행이다(키당 한 행이 아니다) — 메모 칸이 둘인 키는 두 행.
기준 판을 안 주면(`baseline=None`) 판정 열도 전부 사람 칸이라 `_번호` 의 비고·제출 서류가 메모다:
2번 번호(비고 있음)는 메모 있는 행, 3번 번호(비고·제출 서류 없음)는 메모 없는 행이다.
원본·작업 사본의 보기 시트는 test_verify_view 와 같은 방식으로 맞춘다.
"""
import json
import tempfile
import unittest
from pathlib import Path

import test_verify as tv
import test_verify_table as tt
import test_verify_view as tvv
import verify
import verify_memos as vm
import verify_table as vt

KEY2, KEY3 = "01000000002", "01000000003"  # 2번(비고 있음)·3번(메모 없음) 번호


KEY1 = "01000000001"  # 1번 — 제출 서류 '완료' + (two_memo_numbers 에서) 비고 둘


LOST_2 = [vt.LOST, "_번호", KEY2, "비고", "메모 X / 번호 없음"]  # 2번의 유일한 메모 칸


def lost(sheet="_번호", key=KEY2, col="비고", value="값"):
    return [vt.LOST, sheet, key, col, value]


def two_memo_numbers():
    """1번 번호에 메모 칸이 둘(제출 서류·비고)."""
    rows = tt.numbers()
    rows[0] = {**rows[0], "note": "메모 Y"}
    return rows


LOST_1_DOCS, LOST_1_NOTE = lost(key=KEY1, col="제출 서류", value="완료"), lost(key=KEY1, col="비고", value="메모 Y")


class VerifyMemosTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.before = tt.build(self.dir / "before.xlsm", moa_rows=tv.OLD_MOA, mutate=tvv.base)

    def tearDown(self):
        self._tmp.cleanup()

    def _after(self, name, nums=None, schs=None, edits=None):
        def mutate(wb):
            tvv.base(wb)
            for hid, recs in (("_번호", nums or tt.numbers()), ("_학교", schs or tt.schools()),
                              ("_서류", tt.docs())):
                tt.rewrite(wb, hid, recs)
                tt.resize(wb, hid, len(recs))
            tvv.write_summary(wb, *tvv.summary())
            if edits is not None:
                tt.edits_sheet(edits)(wb)
        return tt.build(self.dir / name, mutate=mutate)

    def _failed(self, after, removed=None, meta=None, baseline=None):
        """removed = {숨김 표: [빠진 키]}, meta = `_수정` 전체 행(원본 행 + 이번에 이은 행)."""
        hids = ("_번호", "_학교", "_서류")
        sheets = [tt.payload(self.before, after, s, removed=(removed or {}).get(s, ())) for s in hids]
        sheets += [tt.view_payload(after, s) for s in hids]
        rows, links = tvv.summary()
        sheets.append({"kind": "summary", "sheet": tvv.SUMMARY, "rows": rows, "links": links,
                       **tvv.summary_fields(links)})
        if meta is not None:
            sheets.append({"kind": "meta", "sheet": vt.META_SHEET, "rows": [r + ["", "2026-11-10"] for r in meta]})
        checks = verify.verify_workbook(self.before, after, [tv.MOA, tv.PIMS] + sheets,
                                        module_hashes=tv.same_hashes, baseline=baseline)
        return verify.failed_labels(checks), {c.label: c for c in checks}

    @staticmethod
    def _without(key):
        return [r for r in tt.numbers() if r["num"] != key]

    def test_빠진_키의_메모_수_와_못_옮김_수가_다르면_실패(self):
        label = [vt.label("_번호", vm.L_LOST_MEMOS)]
        nums = self._without("010-0000-0002")  # 메모 있는 행이 빠졌다
        removed = {"_번호": [KEY2]}
        # 못 옮김 행이 하나도 없다
        self.assertEqual(self._failed(self._after("a0.xlsm", nums=nums), removed)[0], label)
        # 못 옮김 행이 더 많다
        two = [LOST_2, lost(key="01000000099")]
        self.assertEqual(self._failed(self._after("a2.xlsm", nums=nums, edits=two), removed, two)[0], label)
        # 구분이 `못 옮김` 이 아니면 세지 않는다
        other = [["사람", "_번호", KEY2, "비고", "메모 X"]]
        self.assertEqual(self._failed(self._after("a3.xlsm", nums=nums, edits=other), removed, other)[0], label)
        # 맞다
        one = [LOST_2]
        self.assertEqual(self._failed(self._after("a1.xlsm", nums=nums, edits=one), removed, one)[0], [])

    def test_못_옮김_행은_그_시트만_센다(self):
        nums = self._without("010-0000-0002")
        removed = {"_번호": [KEY2]}
        wrong = [lost("_학교", "x")]  # `_번호` 의 메모를 `_학교` 행으로 적었다
        failed, _ = self._failed(self._after("w.xlsm", nums=nums, edits=wrong), removed, wrong)
        self.assertEqual(failed, [vt.label("_번호", vm.L_LOST_MEMOS), vt.label("_학교", vm.L_LOST_MEMOS)])

    def test_빠진_키에_메모_없으면_못_옮김_0(self):
        nums = self._without("010-0000-0003")  # 비고·제출 서류 없는 행이 빠졌다
        removed = {"_번호": [KEY3]}
        failed, checks = self._failed(self._after("n0.xlsm", nums=nums), removed)
        self.assertEqual(failed, [])
        self.assertIn("메모 칸 0 /", checks[vt.label("_번호", vm.L_LOST_MEMOS)].detail)
        # 메모가 없는데 못 옮김 행이 있다
        one = [lost(key=KEY3)]
        failed, _ = self._failed(self._after("n1.xlsm", nums=nums, edits=one), removed, one)
        self.assertEqual(failed, [vt.label("_번호", vm.L_LOST_MEMOS)])

    def test_빠진_키가_없으면_못_옮김_0(self):
        failed, checks = self._failed(self._after("none.xlsm"))
        self.assertEqual(failed, [])
        self.assertEqual({c.label for c in checks.values() if vm.L_LOST_MEMOS in c.label},
                         {vt.label(s, vm.L_LOST_MEMOS) for s in ("_번호", "_학교", "_서류")})

    def test_이번에_이은_행만_센다(self):
        # 지난 실행이 남긴 못 옮김 행은 이번 빠진 키와 무관하다
        old = [lost(key="01000000099")]
        self.before = tt.build(self.dir / "before-old.xlsm", moa_rows=tv.OLD_MOA,
                               mutate=lambda wb: (tvv.base(wb), tt.edits_sheet(old)(wb)))
        self.assertEqual(self._failed(self._after("o0.xlsm", edits=old), meta=old)[0], [])
        nums = self._without("010-0000-0002")
        removed = {"_번호": [KEY2]}
        self.assertEqual(self._failed(self._after("o1.xlsm", nums=nums, edits=old), removed, old)[0],
                         [vt.label("_번호", vm.L_LOST_MEMOS)])
        both = old + [LOST_2]
        self.assertEqual(self._failed(self._after("o2.xlsm", nums=nums, edits=both), removed, both)[0], [])

    def test_학교_시트는_행이_빠지면_키_증감이_막고_메모는_세어_본다(self):
        schs = tt.schools()[:2]  # 담당자 칸 등 사람 칸이 여럿인 C 가 빠졌다
        wrong = [lost("_학교", tt.C)]  # 칸 하나만 적었다 — 나머지는 빠짐
        after = self._after("s.xlsm", schs=schs, edits=wrong)
        failed, checks = self._failed(after, {"_학교": [tt.C]}, wrong)
        self.assertEqual(failed, [vt.label("_학교", vt.L_KEYS), vt.label("_학교", vm.L_LOST_MEMOS)])
        self.assertIn("빠짐", checks[vt.label("_학교", vm.L_LOST_MEMOS)].detail)

    # ---- 칸 단위 집합 대조 (T10 계약: 빠진 키의 메모 칸마다 `못 옮김` 1행, 키·열·값이 원본과 같다)
    def _two_memo(self, name, meta):
        self.before = tt.build(self.dir / f"before-{name}", nums=two_memo_numbers(), moa_rows=tv.OLD_MOA,
                               mutate=tvv.base)
        nums = [r for r in two_memo_numbers() if r["num"] != "010-0000-0001"]
        return self._failed(self._after(name, nums=nums, edits=meta), {"_번호": [KEY1]}, meta)[0]

    def test_메모_칸이_둘인_키는_칸마다_한_행(self):
        label = [vt.label("_번호", vm.L_LOST_MEMOS)]
        self.assertEqual(self._two_memo("t2.xlsm", [LOST_1_DOCS, LOST_1_NOTE]), [])
        self.assertEqual(self._two_memo("t1.xlsm", [LOST_1_NOTE]), label)  # 한 칸을 잃었다
        self.assertEqual(self._two_memo("t0.xlsm", [LOST_1_DOCS, LOST_1_NOTE, LOST_1_NOTE[:3] + ["제출 서류", "다름"]]),
                         label)  # 한 칸을 두 번 적는 식의 군더더기

    def test_키를_다르게_적은_행은_실패(self):
        other = lost(key="01000000099", col="제출 서류", value="완료")
        self.assertEqual(self._two_memo("k.xlsm", [other, LOST_1_NOTE]), [vt.label("_번호", vm.L_LOST_MEMOS)])

    def test_열이나_값을_다르게_적은_행은_실패(self):
        label = [vt.label("_번호", vm.L_LOST_MEMOS)]
        self.assertEqual(self._two_memo("c.xlsm", [lost(key=KEY1, col="확인", value="완료"), LOST_1_NOTE]), label)
        self.assertEqual(self._two_memo("v0.xlsm", [lost(key=KEY1, col="제출 서류", value=""), LOST_1_NOTE]), label)
        self.assertEqual(self._two_memo("v1.xlsm", [lost(key=KEY1, col="제출 서류", value="미완료"), LOST_1_NOTE]),
                         label)

    # ---- 기준 판정 칸의 주인(Owners) 배선 — 기계가 쓴 칸은 메모가 아니다
    def _owned(self, name, kind, extra=()):
        """2번 번호(유일한 메모 칸 = 비고)가 빠진 실행 — before·after 모두 `_수정` 에 (kind, 2번 비고) 기록이 있다."""
        record = [kind, "_번호", KEY2, "비고", "메모 X / 번호 없음"]
        self.before = tt.build(self.dir / f"before-{name}", moa_rows=tv.OLD_MOA,
                               mutate=lambda wb: (tvv.base(wb), tt.edits_sheet([record])(wb)))
        meta = [record, *extra]
        after = self._after(name, nums=self._without("010-0000-0002"), edits=meta)
        return self._failed(after, {"_번호": [KEY2]}, meta)[0]

    def test_수정에_기계_기록이_있는_칸은_메모가_아니다(self):
        self.assertEqual(self._owned("own-m.xlsm", vt.MACHINE), [])  # 못 옮김 0행으로 통과
        self.assertEqual(self._owned("own-m1.xlsm", vt.MACHINE, [LOST_2]), [vt.label("_번호", vm.L_LOST_MEMOS)])

    def test_수정에_사람_기록이_있는_칸은_메모(self):
        self.assertEqual(self._owned("own-h.xlsm", vt.HUMAN), [vt.label("_번호", vm.L_LOST_MEMOS)])
        self.assertEqual(self._owned("own-h1.xlsm", vt.HUMAN, [LOST_2]), [])

    def test_기준_판과_같은_값이면_기계_칸이고_다르면_메모(self):
        nums, removed = self._without("010-0000-0002"), {"_번호": [KEY2]}
        same = tt.build(self.dir / "base-same.xlsm", moa_rows=tv.OLD_MOA, mutate=tvv.base)
        self.assertEqual(self._failed(self._after("bs.xlsm", nums=nums), removed, baseline=same)[0], [])
        blank = tt.numbers()
        blank[1] = {**blank[1], "note": ""}  # 기준 판에선 비어 있던 비고 → 그 뒤에 사람이 쓴 메모
        differ = tt.build(self.dir / "base-differ.xlsm", nums=blank, moa_rows=tv.OLD_MOA, mutate=tvv.base)
        self.assertEqual(self._failed(self._after("bd.xlsm", nums=nums), removed, baseline=differ)[0],
                         [vt.label("_번호", vm.L_LOST_MEMOS)])
        both = [LOST_2]
        self.assertEqual(self._failed(self._after("bd1.xlsm", nums=nums, edits=both), removed, both,
                                      baseline=differ)[0], [])

    def test_결과에_값이_없다(self):
        nums = self._without("010-0000-0002")
        failed, checks = self._failed(self._after("v.xlsm", nums=nums), {"_번호": [KEY2]})
        self.assertEqual(failed, [vt.label("_번호", vm.L_LOST_MEMOS)])
        dumped = json.dumps([c.__dict__ for c in checks.values()], ensure_ascii=False)
        for value in ("메모 X", "010-0000", KEY2, "테스트대학교"):
            self.assertNotIn(value, dumped)


if __name__ == "__main__":
    unittest.main()
