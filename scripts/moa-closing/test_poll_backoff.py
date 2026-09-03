"""SMS 폴링 간격 — make 무료 크레딧을 아낀다.

3초 고정 간격이면 180초 동안 **60번** GET 한다. baseline 3회를 더해 실행당 63회,
하루 한 번만 돌아도 월 1,890 operations — make 무료 한도(1,000)의 두 배다.
2026-09-03 주 계정 크레딧이 소진돼 `Queue is full` 로 막혔다.

SMS 는 대개 5~15초에 온다. **그 구간만 촘촘히** 보고 뒤는 뜸하게 본다.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scrape import poll_intervals


def test_초반은_촘촘하다():
    seq = poll_intervals(180)
    assert seq[0] <= 5, "SMS 는 대개 5~15초에 온다 — 그때를 놓치면 안 된다"
    assert seq[1] <= 5


def test_뒤로_갈수록_뜸해진다():
    seq = poll_intervals(180)
    assert seq[-1] > seq[0]


def test_호출_횟수가_크게_준다():
    # 3초 고정이면 60회. 그 절반보다 적어야 한다.
    assert len(poll_intervals(180)) < 30


def test_합이_타임아웃을_넘지_않는다():
    for t in (30, 90, 180, 300):
        assert sum(poll_intervals(t)) <= t, f"{t}초"


def test_짧은_타임아웃도_최소_한_번은_본다():
    assert len(poll_intervals(3)) >= 1


def test_한_달_치가_무료_한도_안에_든다():
    # 실행당 = baseline 3회 + 폴링. 하루 1회 × 31일.
    per_run = 3 + len(poll_intervals(180))
    assert per_run * 31 < 1000, f"월 {per_run * 31} ops"
