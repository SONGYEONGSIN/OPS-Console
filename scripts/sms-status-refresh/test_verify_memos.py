"""verify_memos.py — 옮기지 못한 메모(lostMemos) 검사.

숨김 표에서 빠진 키 중 사람 칸에 값이 있던 행 수 = 이번에 `_수정` 에 이은 `못 옮김` 행 수(시트별).
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
LOST_2 = [vt.LOST, "_번호", KEY2, "비고", "메모 X / 번호 없음"]


def lost(sheet="_번호", key=KEY2):
    return [vt.LOST, sheet, key, "비고", "값"]


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

    def _failed(self, after, removed=None, meta=None):
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
                                        module_hashes=tv.same_hashes, baseline=None)
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
        self.assertIn("0 /", checks[vt.label("_번호", vm.L_LOST_MEMOS)].detail)
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
        schs = tt.schools()[:2]  # 담당자 칸이 있는 C 가 빠졌다
        after = self._after("s.xlsm", schs=schs, edits=[lost("_학교", tt.C)])
        failed, checks = self._failed(after, {"_학교": [tt.C]}, [lost("_학교", tt.C)])
        self.assertEqual(failed, [vt.label("_학교", vt.L_KEYS)])
        self.assertIn("1 /", checks[vt.label("_학교", vm.L_LOST_MEMOS)].detail)

    def test_결과에_값이_없다(self):
        nums = self._without("010-0000-0002")
        failed, checks = self._failed(self._after("v.xlsm", nums=nums), {"_번호": [KEY2]})
        self.assertEqual(failed, [vt.label("_번호", vm.L_LOST_MEMOS)])
        dumped = json.dumps([c.__dict__ for c in checks.values()], ensure_ascii=False)
        for value in ("메모 X", "010-0000", KEY2, "테스트대학교"):
            self.assertNotIn(value, dumped)


if __name__ == "__main__":
    unittest.main()
