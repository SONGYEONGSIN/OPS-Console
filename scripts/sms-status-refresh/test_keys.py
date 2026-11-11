"""keys.py — 숨김 시트 행을 잇는 키. 번호·학교는 전부 가짜다."""
import unicodedata
import unittest

import keys


class SchoolKeyTest(unittest.TestCase):
    def test_NFC_공백_접기(self):
        nfd = unicodedata.normalize("NFD", "테스트대학교A")
        self.assertNotEqual(nfd, "테스트대학교A")
        self.assertEqual(keys.school_key(f"  {nfd}  "), "테스트대학교A")
        self.assertEqual(keys.school_key("테스트  대학교\tA"), "테스트 대학교 A")

    def test_NAME_FIX_를_따른다(self):
        for raw, fixed in keys.NAME_FIX.items():
            self.assertEqual(keys.school_key(f" {raw} "), fixed)

    def test_빈칸은_빈_문자열(self):
        self.assertEqual(keys.school_key(None), "")


class NumberKeysTest(unittest.TestCase):
    def test_숫자만_같으면_같은_키(self):
        before, after = keys.number_keys(
            [("테스트대학교A", "010-0000-0001"), ("테스트대학교B", "010 0000 0002")],
            [("테스트대학교A", "01000000001"), ("테스트대학교Z", "010-0000-0002")])
        self.assertEqual(before, ["01000000001", "01000000002"])
        self.assertEqual(after, before)

    def test_숫자로_못_잇는_번호는_학교와_원문(self):
        (got,) = keys.number_keys([("테스트대학교A", "010-0000-0004~5"), ("테스트 대학교B", "0101234"),
                                   ("테스트대학교C", None)])
        self.assertEqual(got, ["테스트대학교A|010-0000-0004~5", "테스트 대학교B|0101234", "테스트대학교C|"])

    def test_한_쪽에서라도_두_번이면_모든_쪽에서_원문_키(self):
        before, after = keys.number_keys(
            [("테스트대학교A", "010-0000-0009"), ("테스트대학교C", "010-0000-0009"), ("테스트대학교A", "010-0000-0001")],
            [("테스트대학교A", "010-0000-0009")])
        self.assertEqual(before, ["테스트대학교A|010-0000-0009", "테스트대학교C|010-0000-0009", "01000000001"])
        self.assertEqual(after, ["테스트대학교A|010-0000-0009"])

    def test_쪽마다_따로_센다(self):
        # 앞뒤에 한 번씩 있는 번호는 합치면 2회지만 쪽마다 1회 — 숫자 키 그대로
        before, after = keys.number_keys([("테스트대학교A", "010-0000-0001")], [("테스트대학교A", "010-0000-0001")])
        self.assertEqual(before, ["01000000001"])
        self.assertEqual(after, ["01000000001"])

    def test_뒤_쪽에서만_두_번이어도_원문_키(self):
        before, after = keys.number_keys(
            [("테스트대학교A", "010-0000-0009")],
            [("테스트대학교A", "010-0000-0009"), ("테스트대학교C", "010-0000-0009")])
        self.assertEqual(before, ["테스트대학교A|010-0000-0009"])
        self.assertEqual(after, ["테스트대학교A|010-0000-0009", "테스트대학교C|010-0000-0009"])
        before, after = keys.school_keys([("테스트대학교A", "4년제")],
                                         [("테스트대학교A", "4년제"), ("테스트대학교A", "대학원")])
        self.assertEqual(before, ["테스트대학교A+4년제"])
        self.assertEqual(after, ["테스트대학교A+4년제", "테스트대학교A+대학원"])

    def test_글자가_섞인_번호는_원문_키(self):
        (got,) = keys.number_keys([("테스트대학교A", "1588-0000(대표)"), ("테스트대학교B", "02-0000-0000 내선")])
        self.assertEqual(got, ["테스트대학교A|1588-0000(대표)", "테스트대학교B|02-0000-0000 내선"])
        self.assertEqual(keys.number_digits(" 010 0000-0001 "), "01000000001")
        self.assertEqual(keys.number_digits(1000000001), "1000000001")

    def test_원문_키도_겹치면_차례_번호(self):
        (got,) = keys.number_keys([("테스트대학교A", "대표번호"), ("테스트대학교A", "대표번호")])
        self.assertEqual(got, ["테스트대학교A|대표번호", "테스트대학교A|대표번호#2"])


class SchoolKeysTest(unittest.TestCase):
    def test_학교명이_겹치면_구분을_붙인다(self):
        before, after = keys.school_keys(
            [("테스트대학교A", "4년제"), ("테스트대학교A", "대학원"), ("테스트대학교B", "4년제")],
            [("테스트대학교A", "4년제"), ("테스트대학교B", "4년제")])
        self.assertEqual(before, ["테스트대학교A+4년제", "테스트대학교A+대학원", "테스트대학교B"])
        self.assertEqual(after, ["테스트대학교A+4년제", "테스트대학교B"])

    def test_구분까지_겹치면_차례_번호(self):
        (got,) = keys.school_keys([("테스트대학교A", "4년제"), ("테스트대학교A", "4년제")])
        self.assertEqual(got, ["테스트대학교A+4년제", "테스트대학교A+4년제#2"])


if __name__ == "__main__":
    unittest.main()
