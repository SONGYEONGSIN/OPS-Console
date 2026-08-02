#!/usr/bin/env python3
"""경쟁률 안내문구 ↔ 스케줄 세팅 판정 — 순수 로직 + claude 호출.

브라우저·DB에 의존하지 않는다. audit.py 가 수집한 텍스트만 입력받아
프롬프트를 만들고 응답을 파싱한다.

판정 기준(스펙 §3): 문구의 날짜 연도가 '스케줄 라인들의 연도 집합'에 없으면 이상.
실행 시점 연도로 고정하지 않는다(달력연도와 학년도는 다른 축).
"""
import html as html_mod
import json
import re
import subprocess
import sys
import tempfile

VALID_TYPES = {"year", "schedule"}
VALID_FIELDS = {"pre_open", "top"}

# Windows 는 확장자 없는 셸 스크립트를 spawn 하지 못한다(dev-control-analyze.mjs 선례).
CLAUDE_BIN = "claude.cmd" if sys.platform == "win32" else "claude"


def clean_text(raw: str) -> str:
    """textarea 값의 HTML 이스케이프 해제 → <br> 개행 → 나머지 태그 제거."""
    if not raw:
        return ""
    text = html_mod.unescape(raw)
    text = re.sub(r"<\s*br\s*/?\s*>", "\n", text, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text)
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(line for line in lines if line)


def filter_schedule_lines(lines: list[str]) -> list[str]:
    """'테스트용' 스케줄은 판정에서 제외 — 단기 반복이 정상 문구를 오판하게 만든다."""
    out = []
    for line in lines:
        text = re.sub(r"\s+", " ", (line or "")).strip()
        if not text or "테스트용" in text:
            continue
        out.append(text)
    return out


def schedule_years(lines: list[str]) -> set[str]:
    """스케줄 라인들에 등장하는 연도 집합. 연말·연초에 걸치면 두 연도 모두 정상."""
    years: set[str] = set()
    for line in filter_schedule_lines(lines):
        years.update(re.findall(r"(20\d{2})", line))
    return years


def build_prompt(services: list[dict]) -> str:
    """배치 프롬프트. 실행로그는 절대 넣지 않는다(수백 줄이라 프롬프트를 잠식)."""
    blocks = []
    for svc in services:
        lines = filter_schedule_lines(svc.get("schedule_lines") or [])
        years = ", ".join(sorted(schedule_years(svc.get("schedule_lines") or []))) or "없음"
        apply_period = svc.get("apply_period") or "없음"
        blocks.append(
            f"### serviceId: {svc['service_id']} / seq: {svc['seq']}\n"
            f"대학: {svc.get('university_name', '')} / 서비스: {svc.get('service_name', '')}\n"
            f"접수일정: {apply_period}\n"
            f"스케줄 연도 집합: {years}\n"
            f"스케줄 세팅:\n" + "\n".join(f"- {line}" for line in lines) + "\n"
            f"[오픈전 내용]\n{svc.get('pre_open_text', '')}\n"
            f"[상단 내용]\n{svc.get('top_text', '')}\n"
        )

    return (
        "너는 대학 원서접수 경쟁률 서비스의 설정을 점검한다.\n"
        "각 서비스마다 '스케줄 세팅'과 안내문구('오픈전 내용', '상단 내용')를 대조해 "
        "어긋난 부분만 찾아라.\n\n"
        "판정 규칙:\n"
        "1. type=year — 문구에 적힌 날짜의 연도가 '스케줄 연도 집합'에 없으면 이상이다. "
        "'2027학년도' 같은 학년도 표기는 달력연도와 다른 축이므로 이상이 아니다.\n"
        "2. type=schedule — 문구에 적힌 공개 날짜·시각이 스케줄 세팅과 다르면 이상이다. "
        "스케줄이 특정 날짜까지만 반복되어 마감일 문구에서 일부 시각이 빠진 것은 정상이다.\n"
        "3. 문구에 적힌 시각이 '접수일정'의 접수 시작·마감 시각과 일치하면, 스케줄 세팅 "
        "시각과 달라도 이상이 아니다. 문구가 접수 시작(마감)을 안내하는 것인지 경쟁률 "
        "공개 시각을 안내하는 것인지는 맥락으로 구분하라.\n"
        "4. 확신이 없으면 보고하지 마라. 추측 금지.\n\n"
        "같은 serviceId 가 차수(seq)만 다른 별개 설정으로 여러 번 나올 수 있다 — "
        "블록 헤더의 seq 로 구분하고, 응답에도 그 seq 를 그대로 되돌려줘라.\n\n"
        "출력은 JSON만. 설명·코드펜스 없이 아래 형태로만 답하라.\n"
        '{"results":[{"serviceId":123,"seq":1,"items":[{"type":"year|schedule",'
        '"field":"pre_open|top","found":"문구에서 발견한 값",'
        '"expect":"스케줄 기준 기대값","quote":"원문 발췌"}]}]}\n'
        "이상이 없는 서비스는 items 를 빈 배열로 둔다. "
        "입력에 있는 모든 (serviceId, seq) 조합을 결과에 포함하라.\n\n"
        "=== 입력 ===\n" + "\n".join(blocks)
    )


def parse_response(raw: str) -> dict[tuple[int, int], list[dict]]:
    """claude 응답 → {(serviceId, seq): items}. 형식이 어긋나면 ValueError (추측 판정 금지).

    같은 serviceId 가 차수(seq)만 다른 별개 설정으로 존재할 수 있어(예: 홍익대
    1172089 1차/2차) serviceId 단독 키는 뒤 항목이 앞 항목을 조용히 덮어쓴다.
    seq 를 함께 키잉해 이 결함을 막는다.
    """
    text = (raw or "").strip()
    fence = re.search(r"```(?:json)?\s*(.+?)\s*```", text, re.S)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError(f"JSON 없음: {text[:120]!r}")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON 파싱 실패: {e}") from e

    results = data.get("results")
    if not isinstance(results, list):
        raise ValueError("results 배열 없음")

    out: dict[tuple[int, int], list[dict]] = {}
    for row in results:
        sid = row.get("serviceId")
        seq = row.get("seq")
        items = row.get("items", [])
        if not isinstance(sid, int) or not isinstance(seq, int) or not isinstance(items, list):
            raise ValueError(f"행 형식 오류: {row!r}")
        for item in items:
            if item.get("type") not in VALID_TYPES:
                raise ValueError(f"type 오류: {item!r}")
            if item.get("field") not in VALID_FIELDS:
                raise ValueError(f"field 오류: {item!r}")
            if not item.get("found") or not item.get("expect"):
                raise ValueError(f"found/expect 누락: {item!r}")
            item.setdefault("quote", "")
        out[(sid, seq)] = items
    return out


def run_claude(prompt: str) -> str:
    """claude -p 호출 — 프롬프트는 stdin, 도구 차단, cwd 는 리포 밖.

    dev-control-analyze.mjs 와 동일한 안전장치: 이 호출은 텍스트 판정만 필요하므로
    도구 사용을 막고, 리포의 .claude 설정을 상속하지 않도록 cwd 를 옮긴다.
    """
    proc = subprocess.run(
        [CLAUDE_BIN, "-p", "--disallowedTools", "Bash Edit Write NotebookEdit Task"],
        input=prompt,
        capture_output=True,
        text=True,
        timeout=300,
        cwd=tempfile.gettempdir(),
        shell=(sys.platform == "win32"),
    )
    if proc.returncode != 0:
        raise RuntimeError(f"claude 실패({proc.returncode}): {proc.stderr[:300]}")
    return proc.stdout
