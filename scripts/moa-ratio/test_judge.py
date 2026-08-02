#!/usr/bin/env python3
"""judge.py 순수 로직 단위 테스트 (브라우저·claude 불필요).

실행: cd scripts/moa-ratio && python3 test_judge.py
근거: docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md 부록 A
"""
import unittest

from judge import (
    build_prompt,
    clean_text,
    filter_schedule_lines,
    parse_response,
    schedule_years,
)

# 부록 A 정상 샘플 (성신여자대학교 1093020)
SAMPLE_SCHEDULE = [
    "2026-07-21 오전 11:00:00 ~ 2026-09-07 오후 6:03:00 : 10분 반복 (테스트용)",
    "2026-09-08 오전 11:00:00 : 한 번",
    "2026-09-09 오전 10:00:00 ~ 2026-09-11 오전 10:03:00 : 10시 반복",
]


class CleanTextTest(unittest.TestCase):
    def test_unescapes_and_strips_markup(self):
        raw = "&lt;font color=red&gt;※ 원서접수기간&lt;/font&gt;&lt;br&gt; ※ 지원현황"
        self.assertEqual(clean_text(raw), "※ 원서접수기간\n※ 지원현황")

    def test_empty_stays_empty(self):
        self.assertEqual(clean_text(""), "")


class ScheduleLineTest(unittest.TestCase):
    def test_excludes_test_lines(self):
        kept = filter_schedule_lines(SAMPLE_SCHEDULE)
        self.assertEqual(len(kept), 2)
        self.assertTrue(all("테스트용" not in line for line in kept))

    def test_trims_and_drops_blanks(self):
        self.assertEqual(filter_schedule_lines(["  a  ", "", "   "]), ["a"])

    def test_years_are_collected_from_all_dates(self):
        # 연말·연초에 걸치면 두 연도 모두 정상으로 봐야 한다
        lines = ["2026-12-30 오후 6:00:00 ~ 2027-01-02 오후 6:00:00 : 10시 반복"]
        self.assertEqual(schedule_years(lines), {"2026", "2027"})

    def test_years_ignore_test_lines(self):
        # 테스트용 라인만 다른 연도(2025)를 줘서 실제로 걸러지는지 판별한다.
        # (SAMPLE_SCHEDULE 은 정상 라인도 전부 2026년이라 필터 유무를 구분 못 함)
        lines = [
            "2025-01-01 오전 10:00:00 : 한 번 (테스트용)",
            "2026-09-09 오전 10:00:00 ~ 2026-09-11 오전 10:03:00 : 10시 반복",
        ]
        years = schedule_years(lines)
        self.assertEqual(years, {"2026"})
        self.assertNotIn("2025", years)


class PromptTest(unittest.TestCase):
    def _svc(self):
        return {
            "service_id": 1093020,
            "university_name": "성신여자대학교",
            "service_name": "수시",
            "schedule_lines": SAMPLE_SCHEDULE,
            "pre_open_text": "※ 원서접수기간: 2026.9.8.",
            "top_text": "※ 원서접수기간: 2026.9.8.",
        }

    def test_prompt_contains_service_and_schedule(self):
        p = build_prompt([self._svc()])
        self.assertIn("1093020", p)
        self.assertIn("성신여자대학교", p)
        self.assertIn("2026-09-08 오전 11:00:00 : 한 번", p)

    def test_prompt_excludes_test_schedule_lines(self):
        self.assertNotIn("테스트용", build_prompt([self._svc()]))

    def test_prompt_demands_json_only(self):
        p = build_prompt([self._svc()])
        self.assertIn("JSON", p)


class ParseTest(unittest.TestCase):
    def test_parses_plain_json(self):
        raw = '{"results":[{"serviceId":1,"items":[{"type":"year","field":"top",' \
              '"found":"2025학년도","expect":"2026","quote":"q"}]}]}'
        out = parse_response(raw)
        self.assertEqual(list(out.keys()), [1])
        self.assertEqual(out[1][0]["type"], "year")

    def test_parses_fenced_json(self):
        raw = '```json\n{"results":[{"serviceId":7,"items":[]}]}\n```'
        self.assertEqual(parse_response(raw), {7: []})

    def test_rejects_unknown_type(self):
        raw = '{"results":[{"serviceId":1,"items":[{"type":"typo","field":"top",' \
              '"found":"a","expect":"b","quote":""}]}]}'
        with self.assertRaises(ValueError):
            parse_response(raw)

    def test_rejects_non_json(self):
        with self.assertRaises(ValueError):
            parse_response("판정 결과를 알려드리겠습니다")


if __name__ == "__main__":
    unittest.main(verbosity=2)
