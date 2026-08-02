#!/usr/bin/env python3
"""Moa 목록 시작일 필터 — 순수 함수, 브라우저·네트워크 의존 없음.

Moa 검색 폼에는 모집구분(수시/정시 등) 날짜 필터가 없다. 목록 JSON을 필터 없이
받으면 과거 연도 서비스가 대량으로 섞인다(수시는 보통 9월에 시작). StartDate
(ASP.NET 관용 표기 "/Date(밀리초 epoch)/")를 파싱해 '올해 9월 1일 00:00 KST'
이후 시작하는 행만 남긴다. "올해"는 하드코딩하지 않고 실행 시점(now) 기준으로
계산한다.
"""
import datetime
import re

KST = datetime.timezone(datetime.timedelta(hours=9))

_DATE_MS_PATTERN = re.compile(r"/Date\((-?\d+)\)/")


def parse_moa_date(raw: str | None) -> datetime.datetime | None:
    """'/Date(1771999200000)/' 형식(밀리초 epoch, UTC 기준)을 파싱한다.

    값이 없거나 형식이 어긋나면 None — 호출부(filter_by_start_date)가 이를
    "판단 불가로 제외"로 처리하고, 여기서는 예외를 던져 순회를 죽이지 않는다.
    """
    if not raw:
        return None
    m = _DATE_MS_PATTERN.fullmatch(raw.strip())
    if not m:
        return None
    try:
        ms = int(m.group(1))
        return datetime.datetime.fromtimestamp(ms / 1000, tz=datetime.timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None


def september_first_kst(now: datetime.datetime | None = None) -> datetime.datetime:
    """'올해 9월 1일 00:00 KST'. now 생략 시 실행 시점(현재 시각) 기준.

    now가 KST 이외 타임존이어도 astimezone으로 KST 변환 후 연도를 뽑으므로,
    연말·연초 경계에서도 KST 기준 연도가 사용된다.
    """
    reference = (now or datetime.datetime.now(tz=datetime.timezone.utc)).astimezone(KST)
    return datetime.datetime(reference.year, 9, 1, 0, 0, 0, tzinfo=KST)


def filter_by_start_date(rows: list[dict], now: datetime.datetime | None = None) -> list[dict]:
    """StartDate >= 올해 9월 1일 00:00 KST 인 행만 남긴다.

    StartDate가 없거나 형식이 어긋난 행은 판단 불가로 보고 제외한다(죽지 않음).
    """
    cutoff = september_first_kst(now)
    kept = []
    for row in rows:
        started_at = parse_moa_date(row.get("StartDate"))
        if started_at is not None and started_at >= cutoff:
            kept.append(row)
    return kept
