#!/usr/bin/env python3
"""judge.py 순수 로직 단위 테스트 (브라우저·claude 불필요).

실행: cd scripts/moa-ratio && python3 test_judge.py
근거: docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md 부록 A
"""
import unittest

import judge

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
    def _svc(self, seq=1):
        return {
            "service_id": 1093020,
            "seq": seq,
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

    def test_prompt_distinguishes_seq_for_same_service_id(self):
        # 홍익대 1172089 같이 같은 serviceId가 차수(Seq)만 다른 두 설정 페이지를
        # 가질 때, claude가 블록을 구분할 수 있도록 seq가 프롬프트에 드러나야 한다.
        svc1, svc2 = self._svc(seq=1), self._svc(seq=2)
        p = build_prompt([svc1, svc2])
        self.assertIn("seq: 1", p)
        self.assertIn("seq: 2", p)

    def test_prompt_contains_apply_period(self):
        # 접수일정을 알아야 "접수 시작 시각"과 "경쟁률 공개 시각"을 구분할 수 있다
        # (홍익대 1172089 오탐 사례 — 접수일정 없이는 문구의 시각이 접수 시작인지
        # 경쟁률 공개인지 판정기가 구분하지 못했다).
        svc = self._svc()
        svc["apply_period"] = "2026-09-08 오전 11:00:00 ~ 2026-09-11 오후 6:00:00"
        p = build_prompt([svc])
        self.assertIn("2026-09-08 오전 11:00:00 ~ 2026-09-11 오후 6:00:00", p)

    def test_prompt_handles_missing_apply_period_key(self):
        # extract_detail이 접수일정 요소를 못 찾으면 apply_period 키 자체가 없을 수
        # 있다 — 죽지 않고 "없음"으로 표시되어야 한다.
        svc = self._svc()
        self.assertNotIn("apply_period", svc)
        p = build_prompt([svc])
        self.assertIn("접수일정:", p)
        self.assertIn("없음", p)

    def test_prompt_mentions_apply_period_judge_rule(self):
        # 문구 시각이 접수일정(접수 시작·마감)과 일치하면 스케줄 시각과 달라도
        # 이상이 아니라는 판정 규칙이 프롬프트에 명시돼야 한다(홍익대 1172089
        # 오탐 방지). 연도 규칙(rule 1)의 "이상이 아니다"와 혼동되지 않도록
        # '접수 시작'을 함께 검사한다.
        p = build_prompt([self._svc()])
        self.assertIn("접수 시작", p)
        self.assertIn("이상이 아니다", p)
        rule_section = p.split("판정 규칙:")[1].split("같은 serviceId")[0]
        self.assertIn("접수 시작", rule_section)
        self.assertIn("이상이 아니다", rule_section)

    def test_prompt_mentions_start_time_cycle_rule(self):
        # 홍익대 1172089 재현 — "9. 7.(월) 10:00부터 3시간 단위로 업데이트" 문구는
        # 접수 시작(10:00)을 기준점으로 한 주기 안내이고, 접수 시작 시점엔 경쟁률이
        # 0이라 첫 실제 갱신이 10:00이 아니라 13:00(10+3시간)인 것이 정상이다.
        # 판정기가 "문구는 10시인데 스케줄 첫 실행이 13시"를 불일치로 오판하지
        # 않도록, 이 해석이 일반 규칙으로 프롬프트에 있어야 한다(특정 대학 예외 아님).
        p = build_prompt([self._svc()])
        rule_section = p.split("판정 규칙:")[1].split("같은 serviceId")[0]
        self.assertIn("단위로 업데이트", rule_section)
        self.assertIn("접수 시작", rule_section)
        self.assertIn("이상으로 보고하지 마라", rule_section)


class ParseTest(unittest.TestCase):
    def test_parses_plain_json(self):
        raw = '{"results":[{"serviceId":1,"seq":1,"items":[{"type":"year","field":"top",' \
              '"found":"2025학년도","expect":"2026","quote":"q"}]}]}'
        out = parse_response(raw)
        self.assertEqual(list(out.keys()), [(1, 1)])
        self.assertEqual(out[(1, 1)][0]["type"], "year")

    def test_parses_fenced_json(self):
        raw = '```json\n{"results":[{"serviceId":7,"seq":2,"items":[]}]}\n```'
        self.assertEqual(parse_response(raw), {(7, 2): []})

    def test_rejects_unknown_type(self):
        raw = '{"results":[{"serviceId":1,"seq":1,"items":[{"type":"typo","field":"top",' \
              '"found":"a","expect":"b","quote":""}]}]}'
        with self.assertRaises(ValueError):
            parse_response(raw)

    def test_rejects_non_json(self):
        with self.assertRaises(ValueError):
            parse_response("판정 결과를 알려드리겠습니다")

    def test_rejects_missing_seq(self):
        # seq 누락 시 추측 판정 없이 ValueError — 어느 차수 결과인지 알 수 없기 때문.
        raw = '{"results":[{"serviceId":1,"items":[{"type":"year","field":"top",' \
              '"found":"a","expect":"b","quote":"q"}]}]}'
        with self.assertRaises(ValueError):
            parse_response(raw)

    def test_rejects_non_integer_seq(self):
        raw = '{"results":[{"serviceId":1,"seq":"1","items":[]}]}'
        with self.assertRaises(ValueError):
            parse_response(raw)

    def test_distinguishes_same_service_id_different_seq(self):
        # 핵심 회귀 테스트: 홍익대 1172089 1차/2차처럼 같은 serviceId에 seq가
        # 다른 두 항목이 한 배치 응답에 있을 때, 서로 덮어쓰지 않고 둘 다 보존되어야
        # 한다(기존 결함: out[sid] = items 가 뒤 항목으로 앞 항목을 덮어썼다).
        raw = (
            '{"results":['
            '{"serviceId":1172089,"seq":1,"items":[{"type":"schedule","field":"pre_open",'
            '"found":"1차 값","expect":"1차 기대값","quote":"q1"}]},'
            '{"serviceId":1172089,"seq":2,"items":[{"type":"schedule","field":"pre_open",'
            '"found":"2차 값","expect":"2차 기대값","quote":"q2"}]}'
            "]}"
        )
        out = parse_response(raw)
        self.assertEqual(set(out.keys()), {(1172089, 1), (1172089, 2)})
        self.assertEqual(out[(1172089, 1)][0]["found"], "1차 값")
        self.assertEqual(out[(1172089, 2)][0]["found"], "2차 값")



class RunClaudeEncodingTest(unittest.TestCase):
    """stdin/stdout 인코딩 고정 — 로케일(cp949)에 맡기면 프롬프트의 em dash 한 글자에
    판정이 통째로 실패한다(2026-08-03 재현: 6배치 전부 실패 → 52건 건너뜀)."""

    def test_utf8_is_pinned_for_subprocess(self):
        captured = {}

        def fake_run(cmd, **kwargs):
            captured.update(kwargs)

            class R:
                returncode = 0
                stdout = '{"results":[]}'
                stderr = ""

            return R()

        original = judge.subprocess.run
        judge.subprocess.run = fake_run
        try:
            judge.run_claude("판정 프롬프트 — em dash 포함")
        finally:
            judge.subprocess.run = original

        self.assertEqual(captured.get("encoding"), "utf-8")
        self.assertEqual(captured.get("errors"), "replace")

if __name__ == "__main__":
    unittest.main(verbosity=2)
