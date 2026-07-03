#!/usr/bin/env python3
"""field_roles.role_value 단위 테스트 (순수 로직, 브라우저 불필요).

실행: cd scripts/entertest && python3 test_field_roles.py
근거: docs/entertest-universal-engine-design.md role 증거표 + JX PhoneFnc 정규식(9차 해독).
"""
import unittest

from field_roles import role_value


class PhoneFieldTest(unittest.TestCase):
    def test_landline_phone_uses_area_code_format(self):
        # data-phone-validate=phone → 랜드라인 정규식 /^(02|0[3-9][0-9])…/ 합격값
        self.assertEqual(
            role_value("PHONEFIELD", {"data-phone-validate": "phone"}),
            "0215881588",
        )

    def test_mobile_uses_010_format(self):
        # data-phone-validate=mobile → 휴대 정규식 /^(010)([0-9]{4})([0-9]{4})$/ 합격값
        self.assertEqual(
            role_value("PHONEFIELD", {"data-phone-validate": "mobile"}),
            "01012345678",
        )

    def test_multi_accepts_mobile(self):
        # phone,mobile 둘 다면 휴대값(multi 정규식이 mobile 허용)
        self.assertEqual(
            role_value("PHONEFIELD", {"data-phone-validate": "phone,mobile"}),
            "01012345678",
        )

    def test_no_phone_validate_defaults_mobile(self):
        self.assertEqual(role_value("PHONEFIELD", {}), "01012345678")


class OtherRoleTest(unittest.TestCase):
    def test_email(self):
        self.assertEqual(role_value("EMAILFIELD", {}), "test@test.com")

    def test_date_is_yyyymmdd(self):
        # DATEFIELD maxlength=8 → YYYYMMDD 8자리
        v = role_value("DATEFIELD", {"maxlength": "8"})
        self.assertEqual(len(v), 8)
        self.assertTrue(v.isdigit())

    def test_date_graduation_after_enrollment(self):
        # 졸업일자 > 입학일자 제약 → 입학은 이른 날짜, 졸업은 늦은 날짜
        enter = role_value("DATEFIELD", {"korname": "입학일자"})
        grad = role_value("DATEFIELD", {"korname": "졸업일자"})
        self.assertLess(int(enter), int(grad))

    def test_date_yyyymm_when_maxlength_6(self):
        # maxlength=6 → YYYYMM(6자리), 그 외 → YYYYMMDD(8자리)
        self.assertEqual(len(role_value("DATEFIELD", {"maxlength": "6"})), 6)
        self.assertEqual(len(role_value("DATEFIELD", {"maxlength": "8"})), 8)
        # 6자리에서도 졸업>입학 순서 유지
        e = role_value("DATEFIELD", {"maxlength": "6", "korname": "입학"})
        g = role_value("DATEFIELD", {"maxlength": "6", "korname": "졸업"})
        self.assertLess(int(e), int(g))
        self.assertEqual(len(e), 6)

    def test_date_by_id_hint(self):
        self.assertLess(
            int(role_value("DATEFIELD", {"idref": "txtStartDate"})),
            int(role_value("DATEFIELD", {"idref": "txtGraduteEndDate"})),
        )

    def test_search_and_file_are_special(self):
        # SEARCHFIELD/FILEFIELD는 값-주입이 아니라 특수 처리(파이썬/JS 위임) → None
        self.assertIsNone(role_value("SEARCHFIELD", {"searchid": "Major"}))
        self.assertIsNone(role_value("FILEFIELD", {}))

    def test_unknown_role_falls_back_to_test(self):
        self.assertEqual(role_value("TEXTFIELD", {}), "TEST")

    def test_jwtype_case_insensitive(self):
        self.assertEqual(role_value("phonefield", {"data-phone-validate": "mobile"}), "01012345678")


if __name__ == "__main__":
    unittest.main()
