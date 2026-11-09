"""「06. Moa 대조」·「07. PIMS 대조」 시트 데이터를 만드는 순수 계산 모듈.

원본(`moa_compare.py`, 저장소 밖)의 build 부분을 이식했다. 규칙은 그대로다.
- 한 줄 = 정규화한 번호 하나. 키는 발신번호의 **숫자만**(하이픈·공백이 달라도 같은 번호).
- 대학 보조 키: Moa 는 UnivServiceID 앞 4자리, PIMS 는 UnivID. 안 겹치면 비고 '대학 ID 다름'.
- 세종에서 번호로 쓸 수 없는 행(빈칸·범위·글자·8자리 미만)은 '대조 제외'로 사유와 함께 남긴다.

바뀐 것: 파일 경로 대신 bytes 를 받고, 프로그램 종료 대신 `StepFailure("source_shape")`,
출력은 없다. 입력 파일의 머리글이 달라졌을 때의 메시지에는 셀 값을 싣지 않는다.

이 모듈은 파일을 쓰지 않는다(저장은 Excel COM 몫). Graph·Moa 도 모른다 — bytes 만 받는다.
"""
from __future__ import annotations

import collections
import datetime as dt
import io
import re
from typing import Sequence

from openpyxl import load_workbook

from contract import StepFailure
from graph import DriveItem

SHEET = "06. Moa 대조"
AFTER_SHEET = "05. 제출 서류 기준"
HEADER = ["No", "결과", "발신번호", "세종 학교명", "세종 등록일자", "Moa 대학명",
          "Moa 등록상태", "Moa 서비스 수", "Moa 최근 등록일", "비고"]
HEADER_ROW, FIRST_DATA_ROW = 8, 9
ORDER_MOA = ["Moa만", "세종만", "양쪽", "대조 제외"]
DONE, WAIT = "등록완료", "등록대기"
MOA_COLS = ["UnivServiceID", "대학명", "모집시기", "모집년도", "CallBack", "파일", "등록일자", "등록상태"]
SEJONG_COLS = ["Univ", "대학명", "번호", "비고", "등록일자"]
SEP = " · "
MIN_DIGITS = 8

PIMS_SHEET = "07. PIMS 대조"
PIMS_AFTER_SHEET = "06. Moa 대조"
PIMS_HEADER = ["No", "결과", "발신번호", "세종 학교명", "세종 등록일자", "PIMS 대학명",
               "PIMS 등록상태", "PIMS 등록 수", "PIMS 최근 등록일", "비고"]
PIMS_ORDER = ["PIMS만", "세종만", "양쪽", "대조 제외"]
PIMS_COLS = ["UnivID", "대학명", "발신번호", "파일", "등록일자", "상태", "수정", "비고"]
BAD = "등록불가"


# ---------------------------------------------------------------- 값 다루기
def digits(s) -> str:
    return re.sub(r"\D", "", str(s or ""))


def text(v) -> str:
    return "" if v is None else str(v).strip()


def ymd(v) -> str:
    """datetime 이든 'YYYY.MM.DD' 문자열이든 'YYYY-MM-DD' 텍스트로. 못 읽으면 원문."""
    if v is None:
        return ""
    if isinstance(v, (dt.datetime, dt.date)):
        return v.strftime("%Y-%m-%d")
    s = str(v).strip()
    m = re.fullmatch(r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\.?", s)
    return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}" if m else s


def join_unique(values) -> str:
    seen: list[str] = []
    for v in values:
        if v and v not in seen:
            seen.append(v)
    return SEP.join(seen)


# ---------------------------------------------------------------- 파일 고르기
_DATED = re.compile(r"(\d{6})(?:_(\d+))?\.xlsx$")
_WORKBOOK = re.compile(r"_(\d{6})\.xlsm$")


def _newest(items: Sequence[DriveItem], pattern: re.Pattern, key) -> DriveItem | None:
    """파일(임시 `~$` 제외) 중 이름이 pattern 에 맞고 key(match, item) 가 가장 큰 것."""
    found = [(key(m, it), it) for it in items
             if it.is_file and not it.name.startswith("~$") and (m := pattern.search(it.name))]
    return max(found, key=lambda t: t[0])[1] if found else None


def pick_latest_dated(items: Sequence[DriveItem]) -> DriveItem | None:
    """이름 끝 YYMMDD(+ 같은 날 `_N`)가 가장 큰 xlsx. 세종은 `리스트261002`·`리스트_261015` 가 섞여 있어 날짜 6자리만 본다."""
    return _newest(items, _DATED, lambda m, it: (m.group(1), int(m.group(2) or 1), it.last_modified))


def pick_latest_workbook(items: Sequence[DriveItem]) -> DriveItem | None:
    """현황 xlsm 중 최신. 화면(`pickLatestWorkbook`)과 같은 규칙: 날짜 내림차순 → 수정시각 내림차순."""
    return _newest(items, _WORKBOOK, lambda m, it: (m.group(1), it.last_modified))


# ---------------------------------------------------------------- 읽기
def _rows(data: bytes, what: str) -> list[tuple]:
    """첫 시트의 모든 행. 열 수 모자란 행은 호출자가 채운다. 못 열면 source_shape(원인 문구는 싣지 않는다)."""
    try:
        wb = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        try:
            return list(wb.worksheets[0].iter_rows(values_only=True))
        finally:
            wb.close()
    except Exception as e:  # noqa: BLE001 — 깨진 파일의 종류가 다양하다. 클래스만 남긴다
        raise StepFailure("source_shape", f"{what} 파일을 열지 못함 ({type(e).__name__})") from None


def _padded(r: Sequence, n: int) -> tuple:
    return tuple(r) + (None,) * max(0, n - len(r))


def _check_header(rows: list[tuple], idx: int, expected: list[str], what: str) -> None:
    got = [text(v) for v in _padded(rows[idx], len(expected))[: len(expected)]] if len(rows) > idx else None
    if got != expected:
        raise StepFailure("source_shape", f"{what} {idx + 1}행 머리글이 예상과 다름")


def load_moa(data: bytes) -> tuple[list[dict], str]:
    """수집 단계가 만든 Moa 목록(1행 추출 안내, 2행 머리글) → (행 목록, 추출일 'YYYY-MM-DD')."""
    rows = _rows(data, "Moa")
    _check_header(rows, 1, MOA_COLS, "Moa")
    extracted = re.search(r"\d{4}-\d{2}-\d{2}", text(_padded(rows[0], 1)[0]))
    n = len(MOA_COLS)
    recs = [dict(zip(MOA_COLS, (text(v) for v in _padded(r, n)[:n])))
            for r in rows[2:] if any(v is not None for v in r)]
    return recs, (extracted.group(0) if extracted else "")


def exclusion_reason(raw) -> str:
    s = text(raw)
    if not s:
        return "번호 빈칸"
    if "~" in s:
        return "범위 표기(~) — 번호 하나로 맞출 수 없음"
    if not re.fullmatch(r"[\d\-\s().]+", s):
        return "번호가 아닌 글자"
    if len(digits(s)) < MIN_DIGITS:
        return f"숫자 {MIN_DIGITS}자리 미만"
    return ""


def load_sejong(data: bytes) -> tuple[list[dict], list[dict]]:
    """세종 발번 리스트 → (대조에 쓸 행, 대조 제외 행)."""
    rows = _rows(data, "세종")
    _check_header(rows, 0, SEJONG_COLS, "세종")
    valid, excluded = [], []
    for raw_row in rows[1:]:
        r = _padded(raw_row, 5)
        if not any(v is not None for v in r[:5]):
            continue
        rec = {"univ": text(r[0]).zfill(4), "name": text(r[1]), "raw": text(r[2]), "date": ymd(r[4])}
        reason = exclusion_reason(r[2])
        if reason:
            excluded.append({**rec, "reason": reason})
        else:
            valid.append({**rec, "num": digits(r[2])})
    return valid, excluded


def load_pims(data: bytes) -> list[dict]:
    """PIMS 등록 리스트 → 행 목록. 상태·UnivID 는 그대로 가져온다."""
    rows = _rows(data, "PIMS")
    _check_header(rows, 0, PIMS_COLS, "PIMS")
    recs = []
    for raw_row in rows[1:]:
        r = _padded(raw_row, 6)
        if not any(v is not None for v in r[:6]):
            continue
        recs.append({"univ": text(r[0]).zfill(4), "name": text(r[1]), "raw": text(r[2]),
                     "date": ymd(r[4]), "status": text(r[5])})
    return recs


# ---------------------------------------------------------------- 대조
def range_numbers(raw: str) -> set[str]:
    """'02-123-1234~5678' → 끝 4자리 범위의 번호 집합 (비고용 — 대조 건수에는 안 넣는다)"""
    m = re.fullmatch(r"(.*?)(\d{4})\s*~\s*(\d{4})", raw.strip())
    if not m:
        return set()
    a, b = int(m.group(2)), int(m.group(3))
    if b - a >= 10000:
        return set()
    return {digits(m.group(1)) + f"{n:04d}" for n in range(min(a, b), max(a, b) + 1)}


def _status_text(statuses, lead: Sequence[str]) -> str:
    c = collections.Counter(statuses)
    if len(c) == 1:
        return next(iter(c))
    order = [*lead] + sorted(k for k in c if k not in lead)
    return SEP.join(f"{k} {c[k]}" for k in order if c[k])


def moa_status(recs) -> str:
    return _status_text((r["등록상태"] for r in recs), (DONE, WAIT))


def status_text(statuses) -> str:
    return _status_text(statuses, (DONE, WAIT, BAD))


def _group(recs, key) -> dict[str, list]:
    by: dict[str, list] = collections.defaultdict(list)
    for r in recs:
        by[key(r)].append(r)
    return by


def _in_range(sej_excl) -> set[str]:
    return set().union(*(range_numbers(e["raw"]) for e in sej_excl)) if sej_excl else set()


def build_rows(moa, sej_valid, sej_excl) -> list[dict]:
    s_by = _group(sej_valid, lambda r: r["num"])
    m_by = _group(moa, lambda r: digits(r["CallBack"]))
    in_range = _in_range(sej_excl)

    out = []
    for num in set(s_by) | set(m_by):
        s, m = s_by.get(num, []), m_by.get(num, [])
        kind = "양쪽" if s and m else ("세종만" if s else "Moa만")
        notes = []
        if len(s) > 1:
            notes.append(f"세종에 {len(s)}행")
        if kind == "양쪽" and not ({x["univ"] for x in s} & {x["UnivServiceID"][:4] for x in m}):
            notes.append("대학 ID 다름")
        if kind == "Moa만" and num in in_range:
            notes.append("세종 범위 표기(대조 제외) 안의 번호")
        out.append({
            "결과": kind,
            "발신번호": s[0]["raw"] if s else m[0]["CallBack"],
            "세종 학교명": join_unique(x["name"] for x in s),
            "세종 등록일자": join_unique(x["date"] for x in s),
            "Moa 대학명": join_unique(x["대학명"] for x in m),
            "Moa 등록상태": moa_status(m) if m else "",
            "Moa 서비스 수": len({x["UnivServiceID"] for x in m}) if m else "",
            "Moa 최근 등록일": max(x["등록일자"] for x in m) if m else "",
            "비고": SEP.join(notes),
            "_num": num,
            "_wait": any(x["등록상태"] == WAIT for x in m),
        })
    for e in sej_excl:
        out.append({"결과": "대조 제외", "발신번호": e["raw"], "세종 학교명": e["name"], "세종 등록일자": e["date"],
                    "Moa 대학명": "", "Moa 등록상태": "", "Moa 서비스 수": "", "Moa 최근 등록일": "",
                    "비고": e["reason"], "_num": "", "_wait": False})

    def key(r):
        school = r["Moa 대학명"] if r["결과"] == "Moa만" else r["세종 학교명"]
        return ORDER_MOA.index(r["결과"]), school, r["_num"], r["발신번호"]

    out.sort(key=key)
    return out


def _pims_row(num, s, p, in_range) -> dict:
    kind = "양쪽" if s and p else ("세종만" if s else "PIMS만")
    notes = []
    if len(s) > 1:
        notes.append(f"세종에 {len(s)}행")
    if kind == "양쪽" and not ({x["univ"] for x in s} & {x["univ"] for x in p}):
        notes.append("대학 ID 다름")
    if any(x["status"] == WAIT for x in p):
        notes.append("PIMS 등록대기")
    if any(x["status"] == BAD for x in p):
        notes.append("PIMS 등록불가")
    if kind == "PIMS만" and num in in_range:
        notes.append("세종 범위 표기(대조 제외) 안의 번호")
    return {
        "결과": kind,
        "발신번호": s[0]["raw"] if s else p[0]["raw"],
        "세종 학교명": join_unique(x["name"] for x in s),
        "세종 등록일자": join_unique(x["date"] for x in s),
        "PIMS 대학명": join_unique(x["name"] for x in p),
        "PIMS 등록상태": status_text(x["status"] for x in p) if p else "",
        "PIMS 등록 수": len(p) if p else "",
        "PIMS 최근 등록일": max(x["date"] for x in p) if p else "",
        "비고": SEP.join(notes),
        "_num": num,
        "_wait": any(x["status"] == WAIT for x in p),
        "_bad": any(x["status"] == BAD for x in p),
    }


def build_pims_rows(pims, sej_valid, sej_excl) -> list[dict]:
    s_by = _group(sej_valid, lambda r: r["num"])
    p_by = _group(pims, lambda r: digits(r["raw"]))
    p_by.pop("", None)
    in_range = _in_range(sej_excl)

    out = [_pims_row(num, s_by.get(num, []), p_by.get(num, []), in_range) for num in set(s_by) | set(p_by)]
    for e in sej_excl:
        out.append({"결과": "대조 제외", "발신번호": e["raw"], "세종 학교명": e["name"], "세종 등록일자": e["date"],
                    "PIMS 대학명": "", "PIMS 등록상태": "", "PIMS 등록 수": "", "PIMS 최근 등록일": "",
                    "비고": e["reason"], "_num": "", "_wait": False, "_bad": False})

    def key(r):
        school = r["PIMS 대학명"] if r["결과"] == "PIMS만" else r["세종 학교명"]
        return PIMS_ORDER.index(r["결과"]), school, r["_num"], r["발신번호"]

    out.sort(key=key)
    return out


# ---------------------------------------------------------------- 시트 데이터
def _reason_counts(sej_excl) -> dict[str, int]:
    return dict(collections.Counter(e["reason"].split(" —")[0] for e in sej_excl))


def build_moa_sheet(moa, sej_valid, sej_excl, sejong_label: str, extracted: str) -> dict:
    """「06. Moa 대조」 시트에 넣을 데이터. 키는 원본 JSON 과 같고 order·other 를 더했다."""
    rows = build_rows(moa, sej_valid, sej_excl)
    counts = collections.Counter(r["결과"] for r in rows)
    wait = sum(1 for r in rows if r["_wait"])
    s_unique = len({r["num"] for r in sej_valid})
    m_unique = len({digits(r["CallBack"]) for r in moa})
    summary = [["양쪽", counts["양쪽"]], ["세종만", counts["세종만"]], ["Moa만", counts["Moa만"]],
               ["대조 제외", counts["대조 제외"]], ["Moa 등록대기 포함", wait]]
    return {
        "sheet": SHEET,
        "afterSheet": AFTER_SHEET,
        "title": SHEET,
        "guide": [
            f"세종 「{sejong_label}」 × Moa 「알림톡 > 발신번호 관리」({extracted or '추출일 미상'} 추출)",
            "발신번호의 숫자만 비교 · Moa만 = Moa에 넣었지만 세종 목록에 없는 번호(먼저 확인)",
        ],
        "summary": summary,
        "summaryNote": (f"고유 번호: 세종 {s_unique} · Moa {m_unique} · 대조 제외는 세종 행 수 · "
                        "Moa 등록대기 포함 = 등록대기 서비스가 하나라도 걸린 번호"),
        "headerRow": HEADER_ROW,
        "firstDataRow": FIRST_DATA_ROW,
        "header": HEADER,
        "order": ORDER_MOA,
        "other": "Moa",
        "textColumns": [c for c in HEADER if c not in ("No", "Moa 서비스 수")],
        "rows": [[i] + [r[h] for h in HEADER[1:]] for i, r in enumerate(rows, 1)],
        "counts": {k: counts[k] for k in ORDER_MOA} | {"Moa 등록대기 포함": wait,
                                                       "세종 고유": s_unique, "Moa 고유": m_unique,
                                                       "세종 유효 행": len(sej_valid), "Moa 행": len(moa)},
        "exclusionReasons": _reason_counts(sej_excl),
    }


def build_pims_sheet(pims, sej_valid, sej_excl, sejong_label: str, pims_label: str) -> dict:
    """「07. PIMS 대조」 시트에 넣을 데이터. 06 바로 뒤에 들어간다."""
    rows = build_pims_rows(pims, sej_valid, sej_excl)
    counts = collections.Counter(r["결과"] for r in rows)
    wait = sum(1 for r in rows if r["_wait"])
    bad = sum(1 for r in rows if r["_bad"])
    s_unique = len({r["num"] for r in sej_valid})
    p_unique = len({digits(r["raw"]) for r in pims} - {""})
    summary = [["양쪽", counts["양쪽"]], ["세종만", counts["세종만"]], ["PIMS만", counts["PIMS만"]],
               ["대조 제외", counts["대조 제외"]], ["PIMS 등록대기 포함", wait], ["PIMS 등록불가 포함", bad]]
    return {
        "sheet": PIMS_SHEET,
        "afterSheet": PIMS_AFTER_SHEET,
        "title": PIMS_SHEET,
        "guide": [
            f"세종 「{sejong_label}」 × PIMS 「{pims_label}」",
            "발신번호의 숫자만 비교 · PIMS만 = PIMS에 넣었지만 세종 목록에 없는 번호(먼저 확인)",
        ],
        "summary": summary,
        "summaryNote": (f"고유 번호: 세종 {s_unique} · PIMS {p_unique} · 대조 제외는 세종 행 수 · "
                        "PIMS 등록대기·등록불가 포함 = 해당 상태 행이 하나라도 걸린 번호"),
        "headerRow": HEADER_ROW,
        "firstDataRow": FIRST_DATA_ROW,
        "header": PIMS_HEADER,
        "order": PIMS_ORDER,
        "other": "PIMS",
        "textColumns": [c for c in PIMS_HEADER if c not in ("No", "PIMS 등록 수")],
        "rows": [[i] + [r[h] for h in PIMS_HEADER[1:]] for i, r in enumerate(rows, 1)],
        "counts": {k: counts[k] for k in PIMS_ORDER} | {"PIMS 등록대기 포함": wait, "PIMS 등록불가 포함": bad,
                                                        "세종 고유": s_unique, "PIMS 고유": p_unique,
                                                        "세종 유효 행": len(sej_valid), "PIMS 행": len(pims)},
        "exclusionReasons": _reason_counts(sej_excl),
    }


# ---------------------------------------------------------------- 변화 요약
def result_counts(rows: Sequence[Sequence], order: Sequence[str]) -> dict[str, int]:
    """시트 행(둘째 칸 = 결과)의 분류별 건수. order 에 없는 분류는 세지 않는다."""
    c = collections.Counter(r[1] for r in rows)
    return {k: c[k] for k in order}


def delta_line(sheet: str, before: dict[str, int], after: dict[str, int], order: Sequence[str]) -> str:
    """`06. Moa 대조: Moa만 52→50 · 세종만 234→230 …` — 건수만. 번호·학교 이름은 싣지 않는다."""
    parts = [f"{k} {before.get(k, 0)}→{after.get(k, 0)}" for k in order]
    return f"{sheet}: {SEP.join(parts)}"
