"""compare.py — 06 Moa 대조 · 07 PIMS 대조 계산.

실제 파일·Graph·Moa 는 쓰지 않는다. 번호·학교는 전부 가짜다.
"""
import io
import unittest
from datetime import datetime

import compare
from contract import StepFailure
from fixtures import PIMS_HEADER, SEJONG_HEADER, make_xlsx
from graph import DriveItem
from moa_collect import build_moa_xlsx

EXTRACTED = datetime(2026, 11, 7, 9, 30)
MOA_ORDER = ["Moa만", "세종만", "양쪽", "대조 제외"]


def moa_row(sid, name, callback, date="2026-03-01", status="등록완료"):
    return [sid, name, "수시", "2026", callback, "", date, status]


def sejong_bytes():
    return make_xlsx([
        SEJONG_HEADER,
        ["9001", "테스트대학교A", "010-0000-0001", "", "2026.01.05"],
        ["9005", "테스트대학교E", "010-0000-0002", "", "2026.02.01"],
        ["9006", "테스트대학교F", "010-0000-0003", "", "2026.02.02"],
        ["9002", "테스트대학교B", "02-0000-0001~0003", "", "2026.01.06"],
        ["9003", "테스트대학교C", "", "", ""],
        ["9004", "테스트대학교D", "대표번호", "", ""],
    ])


def moa_bytes():
    return build_moa_xlsx([
        moa_row("900100001", "테스트대학교A", "01000000001"),
        moa_row("909900001", "테스트대학교Z", "010-0000-0002", status="등록대기"),
        moa_row("900700001", "테스트대학교G", "010-0000-0009", date="2026-03-02", status="등록대기"),
        moa_row("900800001", "테스트대학교H", "02-0000-0002"),
    ], EXTRACTED)


def pims_bytes():
    return make_xlsx([
        PIMS_HEADER,
        ["9001", "테스트대학교A", "01000000001", "", "2026-03-01", "등록완료", "", ""],
        ["9005", "테스트대학교E", "010-0000-0002", "", "2026-03-02", "등록대기", "", ""],
        ["9099", "테스트대학교Y", "010-0000-0002", "", "2026-03-03", "등록불가", "", ""],
        ["9007", "테스트대학교G", "010-0000-0009", "", "2026-03-04", "등록완료", "", ""],
    ])


def item(name, modified="2026-11-01T00:00:00Z", is_file=True):
    return DriveItem(id=name, name=name, etag="e", last_modified=modified, is_file=is_file)


def by_number(sheet):
    """발신번호 열 → 행 (번호는 가짜라 테스트에서만 본다)."""
    return {row[2]: row for row in sheet["rows"]}


def moa_sheet():
    moa, extracted = compare.load_moa(moa_bytes())
    valid, excl = compare.load_sejong(sejong_bytes())
    return compare.build_moa_sheet(moa, valid, excl, "세종 리스트_261107", extracted)


def pims_sheet():
    pims = compare.load_pims(pims_bytes())
    valid, excl = compare.load_sejong(sejong_bytes())
    return compare.build_pims_sheet(pims, valid, excl, "세종 리스트", "PIMS 리스트")


class MoaTest(unittest.TestCase):
    def test_Moa_목록은_수집_단계가_만든_파일을_그대로_읽는다(self):
        recs, extracted = compare.load_moa(moa_bytes())
        self.assertEqual(len(recs), 4)
        self.assertEqual(extracted, "2026-11-07")
        self.assertEqual(recs[0]["UnivServiceID"], "900100001")
        self.assertEqual(recs[0]["CallBack"], "01000000001")

    def test_분류_순서와_건수(self):
        sheet = moa_sheet()
        results = [r[1] for r in sheet["rows"]]
        self.assertEqual(results, sorted(results, key=MOA_ORDER.index))
        c = sheet["counts"]
        self.assertEqual((c["양쪽"], c["세종만"], c["Moa만"], c["대조 제외"]), (2, 1, 2, 3))
        self.assertEqual(c["양쪽"] + c["세종만"], c["세종 고유"])
        self.assertEqual(c["양쪽"] + c["Moa만"], c["Moa 고유"])
        self.assertEqual(c["Moa 등록대기 포함"], 2)
        self.assertEqual(sheet["order"], MOA_ORDER)
        self.assertEqual(sheet["other"], "Moa")
        self.assertEqual([r[0] for r in sheet["rows"]], list(range(1, len(sheet["rows"]) + 1)))
        self.assertEqual(sheet["summary"][0], ["양쪽", 2])
        self.assertEqual(sheet["summary"][-1], ["Moa 등록대기 포함", 2])

    def test_시트_키는_원본_JSON과_같다(self):
        sheet = moa_sheet()
        self.assertEqual(set(sheet), {
            "sheet", "afterSheet", "title", "guide", "summary", "summaryNote", "headerRow",
            "firstDataRow", "header", "textColumns", "rows", "counts", "exclusionReasons",
            "order", "other"})
        self.assertEqual(sheet["sheet"], "06. Moa 대조")
        self.assertEqual(sheet["afterSheet"], "05. 제출 서류 기준")
        self.assertEqual((sheet["headerRow"], sheet["firstDataRow"]), (8, 9))
        self.assertEqual(sheet["header"][:3], ["No", "결과", "발신번호"])
        self.assertIn("2026-11-07 추출", sheet["guide"][0])
        self.assertNotIn("No", sheet["textColumns"])
        self.assertNotIn("Moa 서비스 수", sheet["textColumns"])

    def test_하이픈이_달라도_같은_번호(self):
        row = by_number(moa_sheet())["010-0000-0001"]  # 발신번호는 세종 표기를 쓴다
        self.assertEqual(row[1], "양쪽")
        self.assertEqual(row[9], "")

    def test_대학_ID_다름_비고(self):
        row = by_number(moa_sheet())["010-0000-0002"]
        self.assertEqual(row[1], "양쪽")
        self.assertEqual(row[9], "대학 ID 다름")
        self.assertEqual(row[6], "등록대기")

    def test_범위_안의_Moa만_번호는_비고에_남는다(self):
        row = by_number(moa_sheet())["02-0000-0002"]
        self.assertEqual(row[1], "Moa만")
        self.assertEqual(row[9], "세종 범위 표기(대조 제외) 안의 번호")

    def test_대조_제외_사유(self):
        _, excl = compare.load_sejong(sejong_bytes())
        self.assertEqual([e["reason"] for e in excl], [
            "범위 표기(~) — 번호 하나로 맞출 수 없음", "번호 빈칸", "번호가 아닌 글자"])
        self.assertEqual(compare.exclusion_reason("1588-123"), "숫자 8자리 미만")
        self.assertEqual(compare.exclusion_reason("02-123-4567"), "")

    def test_머리글이_다르면_source_shape(self):
        bad = make_xlsx([["a", "b", "c", "d", "e"], ["secret-cell", "y", "z", "", ""]])
        for fn in (compare.load_moa, compare.load_sejong, compare.load_pims):
            with self.subTest(fn=fn.__name__):
                with self.assertRaises(StepFailure) as cm:
                    fn(bad)
                self.assertEqual(cm.exception.code, "source_shape")
                self.assertNotIn("secret-cell", cm.exception.detail)

    def test_빈_시트나_깨진_파일도_source_shape(self):
        for data in (make_xlsx([]), b"not an xlsx"):
            for fn in (compare.load_moa, compare.load_sejong, compare.load_pims):
                with self.subTest(fn=fn.__name__, n=len(data)):
                    with self.assertRaises(StepFailure) as cm:
                        fn(data)
                    self.assertEqual(cm.exception.code, "source_shape")


class PimsTest(unittest.TestCase):
    def test_PIMS_등록대기_등록불가_비고(self):
        sheet = pims_sheet()
        row = by_number(sheet)["010-0000-0002"]
        self.assertEqual(row[1], "양쪽")
        self.assertEqual(row[9], "PIMS 등록대기 · PIMS 등록불가")
        self.assertEqual(row[6], "등록대기 1 · 등록불가 1")
        self.assertEqual(row[7], 2)
        c = sheet["counts"]
        self.assertEqual((c["양쪽"], c["세종만"], c["PIMS만"], c["대조 제외"]), (2, 1, 1, 3))
        self.assertEqual((c["PIMS 등록대기 포함"], c["PIMS 등록불가 포함"]), (1, 1))
        self.assertEqual(sheet["summary"][-2:], [["PIMS 등록대기 포함", 1], ["PIMS 등록불가 포함", 1]])

    def test_PIMS_대학_ID는_그대로_비교한다(self):
        # 9005 가 PIMS 에도 있으므로 한 쪽이라도 겹치면 'ID 다름' 이 아니다
        self.assertNotIn("대학 ID 다름", by_number(pims_sheet())["010-0000-0002"][9])

    def test_PIMS_시트_고정값(self):
        sheet = pims_sheet()
        self.assertEqual(sheet["sheet"], "07. PIMS 대조")
        self.assertEqual(sheet["afterSheet"], "06. Moa 대조")
        self.assertEqual(sheet["order"], ["PIMS만", "세종만", "양쪽", "대조 제외"])
        self.assertEqual(sheet["other"], "PIMS")
        self.assertIn("PIMS 리스트", sheet["guide"][0])
        self.assertEqual(by_number(sheet)["010-0000-0009"][1], "PIMS만")
        self.assertEqual(by_number(sheet)["010-0000-0009"][9], "")


class PickTest(unittest.TestCase):
    def test_최신_파일_고르기(self):
        names = ["진학어플라이 발번 리스트261002.xlsx", "진학어플라이 발번리스트_261015.xlsx",
                 "~$진학어플라이 발번리스트_261020.xlsx", "메모.txt"]
        got = compare.pick_latest_dated([item(n) for n in names])
        self.assertEqual(got.name, "진학어플라이 발번리스트_261015.xlsx")
        moa = ["Moa 등록 리스트_261104.xlsx", "Moa 등록 리스트_261107.xlsx", "Moa 등록 리스트_261107_2.xlsx"]
        self.assertEqual(compare.pick_latest_dated([item(n) for n in moa]).name, "Moa 등록 리스트_261107_2.xlsx")
        self.assertEqual(compare.pick_latest_dated([item(n) for n in reversed(moa)]).name,
                         "Moa 등록 리스트_261107_2.xlsx")

    def test_접미_번호는_숫자로_비교한다(self):
        names = ["A_261107_2.xlsx", "A_261107_10.xlsx"]
        self.assertEqual(compare.pick_latest_dated([item(n) for n in names]).name, "A_261107_10.xlsx")

    def test_폴더와_없음(self):
        self.assertIsNone(compare.pick_latest_dated([]))
        self.assertIsNone(compare.pick_latest_dated([item("A_261107.xlsx", is_file=False)]))

    def test_날짜와_접미가_같으면_수정시각이_늦은_것(self):
        a = item("A_261107.xlsx", "2026-11-07T01:00:00Z")
        b = item("B_261107.xlsx", "2026-11-07T02:00:00Z")
        self.assertEqual(compare.pick_latest_dated([a, b]).name, "B_261107.xlsx")

    def test_현황_파일_고르기는_화면과_같다(self):
        base = "SMS 발신번호 사전등록 현황"
        files = [item(f"{base}_261015.xlsm"), item(f"{base}_261017.xlsm"),
                 item(f"~${base}_261020.xlsm"), item(f"{base}.xlsm"), item(f"{base}_261020.xlsx")]
        self.assertEqual(compare.pick_latest_workbook(files).name, f"{base}_261017.xlsm")
        same = [item(f"{base}_261017.xlsm", "2026-10-17T01:00:00Z"),
                item(f"{base}_261017.xlsm", "2026-10-17T05:00:00Z")]
        self.assertEqual(compare.pick_latest_workbook(same).last_modified, "2026-10-17T05:00:00Z")
        self.assertIsNone(compare.pick_latest_workbook([item(f"{base}.xlsm")]))
        self.assertIsNone(compare.pick_latest_workbook([]))


class DeltaTest(unittest.TestCase):
    def test_결과_열_건수(self):
        rows = [[1, "양쪽"], [2, "양쪽"], [3, "세종만"]]
        self.assertEqual(compare.result_counts(rows, MOA_ORDER),
                         {"Moa만": 0, "세종만": 1, "양쪽": 2, "대조 제외": 0})

    def test_바뀐_점은_건수만(self):
        before = {"Moa만": 52, "세종만": 234, "양쪽": 349, "대조 제외": 11}
        after = {"Moa만": 50, "세종만": 230, "양쪽": 351, "대조 제외": 11}
        line = compare.delta_line("06. Moa 대조", before, after, MOA_ORDER)
        self.assertEqual(line, "06. Moa 대조: Moa만 52→50 · 세종만 234→230 · 양쪽 349→351 · 대조 제외 11→11")
        sheet = moa_sheet()
        counts = compare.result_counts(sheet["rows"], MOA_ORDER)
        line = compare.delta_line("06. Moa 대조", counts, counts, MOA_ORDER)
        for r in sheet["rows"]:
            for cell in (r[2], r[3], r[5]):
                if cell:
                    self.assertNotIn(cell, line)


class YmdTest(unittest.TestCase):
    def test_시각이_붙은_문자열은_날짜만(self):
        # PIMS 모니터링 화면의 등록일자는 'YYYY-MM-DD HH:MM:SS' 로 온다.
        self.assertEqual(compare.ymd("2026-11-04 10:20:30"), "2026-11-04")
        self.assertEqual(compare.ymd("2026-11-04 10:20"), "2026-11-04")

    def test_기존_입력은_그대로(self):
        self.assertEqual(compare.ymd(datetime(2026, 11, 4, 9, 5)), "2026-11-04")
        self.assertEqual(compare.ymd("2026.1.5"), "2026-01-05")
        self.assertEqual(compare.ymd("2026-11-04"), "2026-11-04")
        self.assertEqual(compare.ymd(None), "")
        self.assertEqual(compare.ymd("대표번호"), "대표번호")


class SourceHygieneTest(unittest.TestCase):
    def test_compare_는_저장하지_않고_출력하지_않는다(self):
        with io.open(compare.__file__, encoding="utf-8") as f:
            src = f.read()
        for banned in (".save(", "print(", "SystemExit"):
            self.assertFalse(banned in src, f"compare.py 에 {banned} 가 있다")


if __name__ == "__main__":
    unittest.main()
