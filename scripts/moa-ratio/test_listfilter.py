#!/usr/bin/env python3
"""listfilter.py 순수 로직 단위 테스트 (브라우저·네트워크 불필요).

실행: cd scripts/moa-ratio && python3 test_listfilter.py
근거: 요청 배경 — Moa 목록 API에 모집구분 필터가 없어 과거 연도 서비스가 대량
섞인다. StartDate(/Date(ms)/ 형식) 파싱·필터 로직은 조용히 깨지기 쉬워
브라우저 없이 검증한다.
"""
import datetime
import unittest

from listfilter import filter_by_start_date, parse_moa_date, september_first_kst

KST = datetime.timezone(datetime.timedelta(hours=9))


class ParseMoaDateTest(unittest.TestCase):
    def test_parses_epoch_ms(self):
        # 실제 Moa 목록 샘플값(조선대 1130056 StartDate) — KST 2026-02-25 15:00:00
        dt = parse_moa_date("/Date(1771999200000)/")
        self.assertIsNotNone(dt)
        self.assertEqual(
            dt.astimezone(KST),
            datetime.datetime(2026, 2, 25, 15, 0, 0, tzinfo=KST),
        )

    def test_none_on_missing_value(self):
        self.assertIsNone(parse_moa_date(None))
        self.assertIsNone(parse_moa_date(""))

    def test_none_on_malformed_value(self):
        self.assertIsNone(parse_moa_date("2026-09-08"))
        self.assertIsNone(parse_moa_date("/Date(abc)/"))
        self.assertIsNone(parse_moa_date("Date(123)"))


class SeptemberFirstKstTest(unittest.TestCase):
    def test_uses_reference_year(self):
        now = datetime.datetime(2026, 8, 2, 12, 0, 0, tzinfo=KST)
        cutoff = september_first_kst(now)
        self.assertEqual(cutoff, datetime.datetime(2026, 9, 1, 0, 0, 0, tzinfo=KST))

    def test_converts_utc_reference_to_kst_year(self):
        # UTC 2026-12-31 20:00은 KST로 2027-01-01 05:00 — 연도가 걸쳐 있어도
        # KST 기준 연도를 써야 한다(하드코딩 금지 — 실행 시점 기준 계산 검증).
        now = datetime.datetime(2026, 12, 31, 20, 0, 0, tzinfo=datetime.timezone.utc)
        cutoff = september_first_kst(now)
        self.assertEqual(cutoff, datetime.datetime(2027, 9, 1, 0, 0, 0, tzinfo=KST))


class FilterByStartDateTest(unittest.TestCase):
    def _row(self, dt: datetime.datetime) -> dict:
        ms = int(dt.timestamp() * 1000)
        return {"UnivServiceID": 1, "StartDate": f"/Date({ms})/"}

    def test_excludes_just_before_boundary(self):
        now = datetime.datetime(2026, 8, 2, 0, 0, 0, tzinfo=KST)
        row = self._row(datetime.datetime(2026, 8, 31, 23, 59, 59, tzinfo=KST))
        self.assertEqual(filter_by_start_date([row], now=now), [])

    def test_includes_at_boundary(self):
        now = datetime.datetime(2026, 8, 2, 0, 0, 0, tzinfo=KST)
        row = self._row(datetime.datetime(2026, 9, 1, 0, 0, 0, tzinfo=KST))
        self.assertEqual(filter_by_start_date([row], now=now), [row])

    def test_excludes_past_year_service(self):
        # 실제 라이브 데이터 사례 — 필터 없이 받으면 과거 연도 서비스가 섞였다
        now = datetime.datetime(2026, 8, 2, 0, 0, 0, tzinfo=KST)
        row = self._row(datetime.datetime(2026, 2, 25, 15, 0, 0, tzinfo=KST))
        self.assertEqual(filter_by_start_date([row], now=now), [])

    def test_excludes_missing_start_date_without_crashing(self):
        now = datetime.datetime(2026, 8, 2, 0, 0, 0, tzinfo=KST)
        rows = [{"UnivServiceID": 1}]  # StartDate 키 자체가 없음
        self.assertEqual(filter_by_start_date(rows, now=now), [])

    def test_excludes_malformed_start_date_without_crashing(self):
        now = datetime.datetime(2026, 8, 2, 0, 0, 0, tzinfo=KST)
        rows = [{"UnivServiceID": 1, "StartDate": "이상한값"}]
        self.assertEqual(filter_by_start_date(rows, now=now), [])

    def test_keeps_only_matching_rows_from_mixed_list(self):
        now = datetime.datetime(2026, 8, 2, 0, 0, 0, tzinfo=KST)
        good = self._row(datetime.datetime(2026, 9, 8, 11, 0, 0, tzinfo=KST))
        bad_year = self._row(datetime.datetime(2026, 2, 25, 15, 0, 0, tzinfo=KST))
        bad_missing = {"UnivServiceID": 2}
        rows = [good, bad_year, bad_missing]
        self.assertEqual(filter_by_start_date(rows, now=now), [good])


if __name__ == "__main__":
    unittest.main(verbosity=2)
