"""점검 건수 세기.

페이지 점검이 늘 '검사 0건'으로 보고했다(2026-09-04 화면 확인). `collected` 는
세팅 점검이 claude 판정에 넣는 상세 목록이라 페이지 점검에서는 끝까지 비어 있는데,
`scannedCount` 가 그걸 그대로 썼다.

**0건 검사에 링크오류 2건은 있을 수 없다** — 숫자가 서로 모순이면 로그를 못 믿는다.
"""
from audit import scanned_count


def test_세팅_점검은_순회한_상세_수():
    assert scanned_count("schedule", collected_count=97, page_checked=0) == 97


def test_페이지_점검은_링크를_확인한_수():
    assert scanned_count("page", collected_count=0, page_checked=48) == 48


def test_페이지_점검이_collected_를_보지_않는다():
    # 세팅 점검 잔여물이 남아 있어도 페이지 점검 수치를 오염시키지 않는다.
    assert scanned_count("page", collected_count=97, page_checked=48) == 48


def test_대상이_없으면_0():
    assert scanned_count("page", collected_count=0, page_checked=0) == 0


def test_모르는_종류는_터뜨린다():
    # 조용히 0을 주면 '안 돈 것'과 구분이 안 된다.
    try:
        scanned_count("unknown", collected_count=1, page_checked=1)
    except ValueError:
        return
    raise AssertionError("알 수 없는 종류인데 통과했다")
