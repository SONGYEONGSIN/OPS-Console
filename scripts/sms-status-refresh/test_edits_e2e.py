"""edits.py 끝에서 끝까지 — 사람 칸 판정을 실제 시트에서 읽어 검사(verify_table.Owners)와 대조한다.

두 번 이어 돈다. 1회차는 기준 판(첫 실행), 2회차는 1회차가 남긴 `_수정`. `_수정` 은 meta_rows 출력을
실제 시트에 써서 만들고(손으로 만든 기록 행 없음), 계산 쪽은 그 시트를 `sheet_table.read_edits` 로 읽고 키는
`keys.*` 로 따로 계산한다. 검사 쪽은 같은 통합 문서 쌍으로 `Owners.load` 를 돈다.
픽스처에 넣은 것 — 키 그대로 · 빠진 키(사람 칸 있음) · 새 키 · 사람이 고친 칸 · 앞뒤 공백 값 · None 칸 ·
이번 표에서만 겹치는 번호(그 번호는 양쪽 모두 `학교|원문` 키가 된다). 번호·학교는 전부 가짜다.
"""
import tempfile
import unittest
from pathlib import Path

from openpyxl import load_workbook

import edits
import keys
import sheet_table
import test_verify as tv
import test_verify_table as tt
import verify_memos as vm
import verify_table as vt

A, B, C = tt.A, tt.B, tt.C
JUDGED_SHEETS = ("_번호", "_학교")
ALL = ("_번호", "_학교", "_서류")
VARIANTS = (None, "", " ", "완료", " 완료 ", "메모 X", " 참고 ", "사람 입력", "연락함")


def n(no, school, last, docs="", note="", kind="4년제"):
    return tt.num(no, school, f"010-0000-{last}", "일괄", docs=docs, note=note, kind=kind)


BASE = [n(1, A, "0001"), n(2, A, "0002", note="메모 X"), n(3, B, "0003"), n(4, C, "0009"), n(5, A, "0009"),
        n(6, B, "0006")]
# 원본 — 사람이 1번 제출 서류·3번 비고(앞뒤 공백)·6번 비고를 고쳤다(기준 판과 다르다)
ORIG = [n(1, A, "0001", docs="사람 입력"), BASE[1], n(3, B, "0003", note=" 참고 "), BASE[3], BASE[4],
        n(6, B, "0006", note="연락함")]
# 1회차 결과 — 6번 빠짐(사람 비고 → 못 옮김), 2번 제출 서류 기계 갱신(앞뒤 공백), 7번 새 키,
# 3번 번호가 C 에도 붙어 이번 표에서만 겹친다
RUN1 = [ORIG[0], n(2, A, "0002", docs=" 완료 ", note="메모 X"), ORIG[2], BASE[3], BASE[4],
        n(7, B, "0007", docs="완료"), n(8, C, "0003")]
# 2회차 결과 — 1번 빠짐(사람 제출 서류 → 못 옮김), 7번 기계 갱신, 9번 새 키(빈 칸뿐)
RUN2 = [RUN1[1], RUN1[2], BASE[3], BASE[4], n(7, B, "0007", docs="미완료"), RUN1[6], n(9, A, "0010")]


def meta_sheet(rows):
    """meta_rows 출력을 숨김·맨 끝 `_수정` 시트에 그대로 쓴다(칸은 전부 str — T13 의 '@' 쓰기)."""
    def add(wb):
        ws = wb.create_sheet(vt.META_SHEET)
        ws.sheet_state = "hidden"
        ws.append(list(vt.META_HEADER))
        for r in rows:
            ws.append(list(r))
    return add


def calc_keys(spec, bt: vt.Table, at: vt.Table) -> dict[str, int]:
    """계산 쪽 키 — T9·T10 처럼 keys.* 를 (원본, 이번 표) 쌍으로 돌려 {원본 키: 원본 행 번호}."""
    def side(t):
        idx = [t.col(name) for name in vt.KEY_NAMES[spec.key]]
        rows = [i for i, r in enumerate(t.rows) if any(v not in (None, "") for v in r)]
        return rows, [(t.rows[i][idx[0]], t.rows[i][idx[1]]) for i in rows]
    (brows, bpairs), (_ar, apairs) = side(bt), side(at)
    bkeys, _akeys = (keys.number_keys if spec.key == "number" else keys.school_keys)(bpairs, apairs)
    return dict(zip(bkeys, brows))


class EditsEndToEndTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self._tmp.name)
        self.base = tt.build(self.dir / "base.xlsm", nums=BASE, moa_rows=tv.OLD_MOA)
        self.w0 = tt.build(self.dir / "w0.xlsm", nums=ORIG, moa_rows=tv.OLD_MOA)

    def tearDown(self):
        self._tmp.cleanup()

    def _written(self, name, nums, meta) -> Path:
        """원본(w0)을 COM 처럼 다시 쓴 작업 사본 — `_번호` 2행부터 A~T, 보기 행 수, `_수정`."""
        def mutate(wb):
            tt.rewrite(wb, "_번호", nums)
            tt.resize(wb, "_번호", len(nums))
            meta_sheet(meta)(wb)
        return tt.build(self.dir / name, nums=ORIG, moa_rows=tv.OLD_MOA, mutate=mutate)

    def _run(self, before: Path, nums, name: str, today: str) -> tuple[Path, list]:
        """계산 한 번 — 원본 시트에서 `_수정`·표를 읽어 meta_rows 를 만들고, 그것을 쓴 작업 사본을 돌려준다."""
        draft = self._written(f"draft-{name}", nums, [])  # 이번에 쓸 표 행(table payload rows)만 쓰는 데 쓴다
        bwb, dwb = load_workbook(before), load_workbook(draft)
        old = sheet_table.read_edits(bwb)
        if old is None:
            bases = load_workbook(self.base)
            own = edits.Ownership.from_baseline({s: vt.read_table(bases, s) for s in JUDGED_SHEETS})
        else:
            own = edits.Ownership.from_meta(old)
        changes = [edits.Change(s, vt.read_table(bwb, s), vt.read_table(dwb, s).rows) for s in ALL]
        meta = edits.meta_rows(old, changes, own, today=today)
        return self._written(name, nums, meta), meta

    def _assert_same_judgment(self, before: Path, after: Path):
        """모든 (시트, 키, 열) 칸에서 계산(시트에서 읽은 `_수정`·keys.* 키)과 검사(Owners.load)의 판정이 같다."""
        bwb, awb = load_workbook(before), load_workbook(after)
        old = sheet_table.read_edits(bwb)
        baseline = None if old is not None else self.base
        if old is None:
            bases = load_workbook(self.base)
            calc = edits.Ownership.from_baseline({s: vt.read_table(bases, s) for s in JUDGED_SHEETS})
        else:
            calc = edits.Ownership.from_meta(old)
        check = vt.Owners.load(bwb, baseline)
        cells = 0
        for sheet in JUDGED_SHEETS:
            spec = vt.SPECS[sheet]
            bt, at = vt.read_table(bwb, sheet), vt.read_table(awb, sheet)
            vkeys = vt.keyed(spec, [bt, at])[0]
            ckeys = calc_keys(spec, bt, at)
            self.assertEqual(ckeys, vkeys, sheet)
            human = check.human_fn(sheet, spec, bt, vkeys)
            own = calc.bind(sheet, bt, ckeys)
            judged = [(i, vt.base_name(h)) for i, h in enumerate(bt.header) if vt.base_name(h) in spec.judged]
            for k, r in vkeys.items():
                for i, col in judged:
                    for v in (bt.rows[r][i], *VARIANTS):
                        cells += 1
                        self.assertEqual(own.owner(sheet, k, col, v) == vt.HUMAN, human(k, col, v), (sheet, k, col, v))
        self.assertGreater(cells, 100)

    def _assert_verify_passes(self, before: Path, after: Path, meta, removed):
        """같은 통합 문서 쌍에서 verify 의 사람 칸 보존(L_PERSON)과 못 옮김(lostMemos) 검사가 통과한다."""
        bwb, awb = load_workbook(before), load_workbook(after)
        owners = vt.Owners.load(bwb, None if sheet_table.read_edits(bwb) is not None else self.base)
        sheets = [tt.payload(before, after, s, removed=removed if s == "_번호" else []) for s in ALL]
        person = [c for sd in sheets for c in vt.check_table(bwb, awb, sd, owners) if vt.L_PERSON in c.label]
        self.assertEqual(len(person), 3)
        self.assertEqual([c.label for c in person if not c.ok], [])
        sheets.append({"kind": "meta", "sheet": vt.META_SHEET, "rows": [list(r) for r in meta]})
        lost = vm.check_lost_memos(bwb, awb, sheets, owners)
        self.assertEqual(len(lost), 3)
        self.assertEqual([c.label for c in lost if not c.ok], [])

    def test_두_번_이어_돌아도_계산과_검사의_판정이_같다(self):
        w1, meta1 = self._run(self.w0, RUN1, "w1.xlsm", "2026-11-10")
        self.assertEqual({(r[2], r[3], r[4]) for r in meta1 if r[0] == vt.LOST}, {("01000000006", "비고", "연락함")})
        self.assertIn((vt.HUMAN, "_번호", f"{B}|010-0000-0003", "비고"), {r[:4] for r in meta1})
        self.assertIn((vt.MACHINE, "_번호", "01000000002", "제출 서류", " 완료 "), {r[:5] for r in meta1})
        self._assert_same_judgment(self.w0, w1)
        self._assert_verify_passes(self.w0, w1, meta1, ["01000000006"])

        w2, meta2 = self._run(w1, RUN2, "w2.xlsm", "2026-11-11")
        self.assertEqual(meta2[:len(meta1)], meta1)
        self.assertEqual({(r[2], r[3], r[4]) for r in meta2[len(meta1):] if r[0] == vt.LOST},
                         {("01000000001", "제출 서류", "사람 입력")})
        self._assert_same_judgment(w1, w2)
        self._assert_verify_passes(w1, w2, meta2, ["01000000001"])
        self._assert_same_judgment(w2, w2)  # 2회차 기록까지 다시 읽어도 같다


if __name__ == "__main__":
    unittest.main()
