#!/usr/bin/env python3
"""경쟁률 세팅 오설정 점검 — Moa 순회 → claude 판정 → OPS-Console 인제스트.

설계: docs/superpowers/specs/2026-08-02-moa-ratio-setting-audit-design.md

흐름:
  대상 로딩(GET /api/ratio-audit/targets) → Moa 로그인(scrape.py 내부 부품 재사용)
  → POST /Ratio/GetRatioList(TEST) 전체 목록 → 대상 교집합
  → GET /Ratio/RatioSetting/{id}?Seq&Server=TEST 순회로 스케줄·문구 추출
  → judge.py 배치 판정 → REAL 목록으로 html 링크 404 점검
  → POST /api/ratio-audit/ingest

읽기 전용. 저장·배포 버튼을 누르지 않는다.
RATIO_AUDIT_DRY_RUN=true 면 인제스트 대신 파일로만 저장한다.

로그인 절차는 scrape.login_and_2fa를 그대로 호출하지 않고 이 파일 안에 풀어 썼다
(MANUAL_CODE_FILE 수동 코드 입력 경로를 끼워 넣기 위함). scrape 모듈의
SELECTORS/_open_login_page/_abort_if_captcha/poll_fresh_sms_code/setup_driver는
그대로 재사용해 로그인 판별 로직이 두 스크립트에서 갈라지지 않게 한다. scrape.py
자체는 마감 자동화가 쓰고 있으므로 수정하지 않는다.
"""
import json
import os
import re
import sys
import tempfile
import time

import requests
from selenium.common.exceptions import NoAlertPresentException, UnexpectedAlertPresentException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_REPO, "scripts", "moa-closing"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import scrape  # noqa: E402  (로그인 부품/드라이버 재사용 — 기존 검증된 구현)
from judge import build_prompt, clean_text, parse_response, run_claude  # noqa: E402

MOA_BASE = "https://moa.jinhakapply.com"
RATIO_SETTING_LIST_URL = f"{MOA_BASE}/Ratio/RatioSetting"
DETAIL_URL = MOA_BASE + "/Ratio/RatioSetting/{sid}?Seq={seq}&Server={server}"
HTML_BASE = {
    "REAL": "https://addon.jinhakapply.com/RatioV1/",
}
BATCH_SIZE = 10
MAX_CONSECUTIVE_SKIPS = 5  # 세션 만료 시 매건 타임아웃으로 조용히 실패하는 것을 조기 감지

# ── MANUAL_CODE_FILE 수동 2FA 코드 입력 경로 ──────────────────────────────
# Make 웹훅(SMS 인증번호 중계)이 "Queue is full." 상태로 응답하지 못할 때 쓰는
# 임시 경로다. graceful degradation 폴백이 아니라 운영자가 명시적으로 켜는
# 입력 경로 — MANUAL_CODE_FILE을 지정하지 않으면 기존 웹훅 폴링이 그대로 동작한다.
# 폴링 GET 자체가 Make 큐를 더 채우므로, 이 경로가 켜지면 baseline 조회를 포함해
# 웹훅을 아예 호출하지 않는다(login_and_2fa 참조).
# scrape.py SMS_CODE_PATTERN과 동일 근거 — 대괄호 형식을 우선 인식한다. SMS 원문을
# 통째로 붙여넣으면 파일 내 첫 4자리 숫자가 전화번호·시각 등 엉뚱한 값일 수 있어,
# 대괄호가 없을 때만 4~8자리 숫자로 폴백한다.
MANUAL_CODE_BRACKET_PATTERN = re.compile(r"\[(\d+)\]")
MANUAL_CODE_FALLBACK_PATTERN = re.compile(r"\d{4,8}")
MANUAL_CODE_TIMEOUT_SEC = 8 * 60  # 최대 8분 — 운영자가 SMS를 확인해 파일에 적을 시간
MANUAL_CODE_INTERVAL_SEC = 2


def _extract_manual_code(content: str) -> str | None:
    """대괄호 형식 [123456]을 우선 찾고, 없을 때만 4~8자리 숫자로 폴백한다."""
    m = MANUAL_CODE_BRACKET_PATTERN.search(content)
    if m:
        return m.group(1)
    m = MANUAL_CODE_FALLBACK_PATTERN.search(content)
    return m.group(0) if m else None


def poll_manual_code(path: str, timeout_sec: int, interval_sec: int) -> str:
    """MANUAL_CODE_FILE 폴링 — 파일에 인증번호가 써질 때까지 대기.

    운영자가 SMS로 받은 인증번호를 이 파일에 직접 적어 넣는 것을 기다린다.
    """
    deadline = time.monotonic() + timeout_sec
    print(f"[INFO] 수동 코드 파일 대기 중: {path} (최대 {timeout_sec}s)")
    while time.monotonic() < deadline:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
            code = _extract_manual_code(content)
            if code:
                masked = ("*" * (len(code) - 2) + code[-2:]) if len(code) > 2 else "**"
                print(f"[OK] 수동 코드 파일에서 인증번호 수신 (…{masked})")
                return code
        time.sleep(interval_sec)
    raise RuntimeError(f"수동 코드 파일 폴링 타임아웃 ({timeout_sec}s) — {path}")


def _accept_alert_if_present(driver) -> str | None:
    """2차 제출(인증번호 확인) 직후 뜬 native alert를 읽어 수용(accept)한다.

    인증번호를 틀리면 Moa가 "인증번호를 다시 확인해주세요." 같은 alert를 띄운다.
    이걸 처리하지 않은 채 다음 webdriver 명령(예: _abort_if_captcha의
    find_elements)을 보내면 그 명령이 UnexpectedAlertPresentException 스택트레이스로
    죽어 원인이 로그에 드러나지 않는다. 여기서 먼저 텍스트를 읽어 accept함으로써
    호출부가 원인이 드러나는 RuntimeError로 바꿀 수 있게 한다.
    """
    try:
        alert = driver.switch_to.alert
        text = alert.text
        alert.accept()
        return text
    except NoAlertPresentException:
        return None


def login_and_2fa(driver, wait, env) -> None:
    """Moa 로그인 + SMS 2FA. scrape.login_and_2fa와 동일 흐름을 이 스크립트 안에 풀어
    썼다(MANUAL_CODE_FILE 분기를 끼워 넣기 위함). #btnLogin 이중용도(1차 SMS발송 →
    2차 인증확인)도 동일하다.

    env["manual_code_file"]이 지정되면 웹훅 폴링(scrape.poll_fresh_sms_code) 대신
    poll_manual_code로 인증번호를 받는다. 이 경로에서는 baseline 조회(scrape.
    fetch_sms_code)도 생략한다 — 웹훅 큐 과적 상황에서 GET 요청 자체를 늘리지
    않기 위함.
    """
    scrape._open_login_page(driver, wait)
    driver.find_element(By.CSS_SELECTOR, scrape.SELECTORS["login_id"]).send_keys(env["username"])
    driver.find_element(By.CSS_SELECTOR, scrape.SELECTORS["login_pw"]).send_keys(env["password"])

    manual_file = env.get("manual_code_file", "")
    baseline = None if manual_file else scrape.fetch_sms_code(env["sms_url"])
    driver.find_element(By.CSS_SELECTOR, scrape.SELECTORS["login_submit"]).click()  # 1차 → SMS 발송
    scrape._abort_if_captcha(driver)

    if manual_file:
        code = poll_manual_code(manual_file, MANUAL_CODE_TIMEOUT_SEC, MANUAL_CODE_INTERVAL_SEC)
    else:
        code = scrape.poll_fresh_sms_code(
            env["sms_url"], baseline, env["sms_timeout"], env["sms_interval"]
        )
    wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, scrape.SELECTORS["sms_code_input"]))
    )
    driver.find_element(By.CSS_SELECTOR, scrape.SELECTORS["sms_code_input"]).send_keys(code)
    driver.find_element(By.CSS_SELECTOR, scrape.SELECTORS["sms_submit"]).click()  # 2차 → 인증확인
    time.sleep(2)
    try:
        alert_text = _accept_alert_if_present(driver)
        if alert_text is not None:
            raise RuntimeError(f"로그인 실패: {alert_text}")
        scrape._abort_if_captcha(driver)
    except UnexpectedAlertPresentException as e:
        # _accept_alert_if_present 이후 뒤늦게 뜬 alert 대비 — selenium이 이후 명령
        # 실행 중 감지한 경우 예외에 담긴 텍스트를 그대로 노출한다.
        raise RuntimeError(f"로그인 실패: {getattr(e, 'alert_text', None) or e}") from e
    print("[OK] 로그인 + 2FA 완료")


def fetch_targets(base_url: str, secret: str) -> dict[int, dict]:
    res = requests.get(
        f"{base_url}/api/ratio-audit/targets",
        headers={"Authorization": f"Bearer {secret}"},
        timeout=30,
    )
    res.raise_for_status()
    rows = res.json()["targets"]
    print(f"[OK] 점검 대상 {len(rows)}건")
    return {int(r["serviceId"]): r for r in rows}


def _dump_page(driver, out_dir: str, label: str) -> None:
    """목록 조회 실패 시 진단용 — 현재 페이지 HTML·스크린샷을 out_dir에 남긴다.

    scrape.py의 _dump_page와 같은 목적이나, 저장 경로를 그 함수가 쓰는
    CLOSING_DUMP_DIR(scrape.py 전용 env)이 아니라 이 스크립트의 OUT_JSON 디렉터리로
    맞추기 위해 별도로 둔다(scrape.py는 수정하지 않는다는 제약).
    """
    try:
        os.makedirs(out_dir, exist_ok=True)
        html_path = os.path.join(out_dir, f"fail-{label}.html")
        png_path = os.path.join(out_dir, f"fail-{label}.png")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(driver.page_source or "")
        driver.save_screenshot(png_path)
        print(f"[DUMP] url={driver.current_url} title={driver.title!r}")
        print(f"[DUMP] 저장: {html_path} / {png_path}")
    except Exception as exc:  # noqa: BLE001 — 덤프 실패로 원래 에러를 가리지 않는다
        print(f"[DUMP] 덤프 실패(무시): {exc}")


def _read_operator_options(driver) -> list[dict[str, str]]:
    """운영자 드롭다운(#ddlDirectManager) 옵션을 전부 읽는다. 빈 값('선택')은 제외.

    사람 이름을 코드에 하드코딩하면 운영자가 늘거나 바뀔 때마다 이 파일을 고쳐야
    한다 — 실행 시점에 DOM에서 읽어 그 문제를 없앤다.
    """
    raw = driver.execute_script(
        "return Array.from(document.getElementById('ddlDirectManager').options)"
        ".map(function(o) { return {value: o.value, text: o.text}; });"
    )
    return [o for o in raw if o["value"]]


def _poll_ratio_list(driver, timeout_sec: int = 120) -> list[dict] | None:
    """window.RatioList가 배열로 채워질 때까지 폴링. 타임아웃이면 None."""
    deadline = time.monotonic() + timeout_sec
    while time.monotonic() < deadline:
        raw = driver.execute_script(
            "return Array.isArray(window.RatioList) ? "
            "JSON.stringify(window.RatioList) : null;"
        )
        if raw is not None:
            return json.loads(raw)
        time.sleep(1)
    return None


def fetch_ratio_list(driver, wait, server: str, dump_dir: str) -> list[dict]:
    """목록 페이지 자체의 GetRatioList()를 운영자별로 호출해 전체 목록을 모은다.

    raw fetch로 POST /Ratio/GetRatioList를 직접 호출하면 서버가 JSON 대신 전체
    HTML 페이지를 반환한다(라이브 실행 확인: "ERR:SyntaxError ... <!DOCTYPE"). 페이지의
    원래 구현은 jQuery $.ajax인데, jQuery는 X-Requested-With: XMLHttpRequest 헤더를
    자동으로 붙이고 ASP.NET MVC는 Request.IsAjaxRequest()로 이 헤더 유무를 분기해
    없으면(raw fetch) JSON 대신 HTML을 돌려준다. 사이트의 GetRatioList()를 그대로
    호출하면 헤더·직렬화·쿠키 인증을 사이트가 하던 그대로 재현하므로 이 분기를
    신경 쓸 필요가 없다.

    운영자별로 순회하는 이유(라이브 실행으로 확인된 부록 A 함정의 실체): 운영자
    드롭다운(#ddlDirectManager)을 ''(전체 의도)로 비우고 GetRatioList()를 호출해도
    서버가 빈 값을 로그인 계정으로 되돌려 로그인한 운영자 담당분만 응답한다.
    디스커버리 때 로그인 계정(송영신) 담당 283건과, 값을 비운 채 받은 283건이
    정확히 일치했고, 다른 운영자(성신여자대학교 1093020 담당 김지영) 대상은
    통째로 빠져 교집합이 0건이 됐다 — '전체'라는 옵션이 서버에는 없다는 뜻이다.
    그래서 드롭다운 옵션을 전부 읽어 운영자마다 한 번씩 명시적으로 지정해
    GetRatioList()를 호출하고 결과를 UnivServiceID+Seq 조합으로 중복 제거하며
    합친다. 한 운영자 조회가 실패해도 경고만 남기고 나머지 운영자는 계속 순회한다
    — 인증번호를 사람이 입력해야 해서 재시도 비용이 크므로, 일부 실패로 전체
    순회를 죽이지 않는다.
    """
    label = f"ratio-list-{server}"
    try:
        wait.until(EC.presence_of_element_located((By.ID, "ddlDirectManager")))
        radio_id = "rdoRatioServer1" if server == "REAL" else "rdoRatioServer2"
        driver.execute_script(f"document.getElementById('{radio_id}').click();")

        operators = _read_operator_options(driver)
        if not operators:
            raise RuntimeError("운영자 드롭다운 옵션을 찾지 못함(#ddlDirectManager)")

        merged: dict[tuple[int, object], dict] = {}
        failed_operators = []
        for i, op in enumerate(operators, 1):
            try:
                driver.execute_script(
                    "var el = document.getElementById('ddlDirectManager');"
                    "el.value = arguments[0];"
                    "el.dispatchEvent(new Event('change', {bubbles: true}));",
                    op["value"],
                )
                driver.execute_script("window.RatioList = null; GetRatioList();")
                rows = _poll_ratio_list(driver)
                if rows is None:
                    raise RuntimeError("목록 조회 타임아웃(120s)")
                for row in rows:
                    merged[(int(row["UnivServiceID"]), row["Seq"])] = row
            except Exception as e:  # noqa: BLE001 — 한 운영자 실패로 전체 순회를 죽이지 않는다
                failed_operators.append(op["text"])
                print(f"[WARN] {server} 운영자 '{op['text']}' 조회 실패, 건너뜀: {e}")
                continue
            print(
                f"[INFO] {server} 운영자 {i}/{len(operators)} 조회 "
                f"({op['text']}) — 누적 {len(merged)}건"
            )

        if failed_operators:
            print(f"[WARN] {server} 조회 실패 운영자 {len(failed_operators)}명: {failed_operators}")

        rows = list(merged.values())
        print(f"[OK] {server} 목록 {len(rows)}건")
        return rows
    except Exception:
        _dump_page(driver, dump_dir, label)
        raise


def _save_raw_list(rows: list[dict], out_dir: str, label: str) -> str:
    """운영자별로 병합한 원본 Moa 목록을 진단용으로 저장한다.

    같은 종류의 불일치(예: 교집합 0건)가 다시 나면, 인증번호를 다시 받아 로그인을
    처음부터 돌리지 않고도 이 파일과 대상 목록을 나란히 놓고 원인을 바로 좁힐 수
    있게 한다.
    """
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"moa-list-{label}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=1)
    print(f"[INFO] {label} 원본 목록 저장: {path}")
    return path


def _print_intersection_diagnostics(
    label: str, moa_rows: list[dict], targets: dict[int, dict], matched_count: int
) -> None:
    """교집합 진단 한 줄 + 저조 시 ID 대조용 상위 5개를 출력한다.

    교집합이 0건이거나 대상의 10% 미만이면 로그인 계정 한정 응답 같은 구조적
    불일치일 가능성이 높다 — Moa/대상 ID를 나란히 찍어 로그인 없이도 즉시 대조할
    수 있게 한다.
    """
    moa_count = len(moa_rows)
    target_count = len(targets)
    print(
        f"[INFO] {label} 진단 — Moa 목록 {moa_count}건 / 대상 {target_count}건 / "
        f"교집합 {matched_count}건"
    )
    if target_count and matched_count < target_count * 0.1:
        moa_ids = [int(r["UnivServiceID"]) for r in moa_rows[:5]]
        target_ids = list(targets.keys())[:5]
        print(f"[WARN] {label} 교집합 저조 — Moa ID 상위5 {moa_ids} / 대상 ID 상위5 {target_ids}")


def extract_detail(driver, wait, sid: int, seq, server: str) -> dict:
    """설정/배포 페이지에서 스케줄 라인 + 오픈전/상단 문구 추출."""
    driver.get(DETAIL_URL.format(sid=sid, seq=seq, server=server))
    wait.until(lambda d: d.find_elements(By.CSS_SELECTOR, "#txtTopText"))
    lines = [
        el.text for el in driver.find_elements(By.CSS_SELECTOR, "td.sc div.scroll_box ul li")
    ]
    return {
        "service_id": sid,
        "schedule_lines": lines,
        "pre_open_text": clean_text(
            driver.find_element(By.CSS_SELECTOR, "#txtOpenText").get_attribute("value") or ""
        ),
        "top_text": clean_text(
            driver.find_element(By.CSS_SELECTOR, "#txtTopText").get_attribute("value") or ""
        ),
    }


def check_link(url: str, attempts: int = 3) -> tuple[int, str]:
    """경쟁률 HTML 링크 상태. 요청 자체가 실패한 경우(타임아웃·연결 실패)만 재시도한다.

    HTTP 응답을 받았으면 4xx/5xx여도 그대로 반환 — 미오픈 서비스는 404가 정상이므로
    재시도로 서버에 불필요한 부하를 주지 않는다.
    """
    last = (0, "")
    for i in range(attempts):
        try:
            res = requests.get(url, timeout=15)
            return res.status_code, ""
        except requests.RequestException as e:
            last = (0, str(e)[:200])
            if i < attempts - 1:
                time.sleep(2)
    return last


def main() -> int:
    dry_run = os.getenv("RATIO_AUDIT_DRY_RUN", "").lower() == "true"
    base_url = os.getenv("OPS_CONSOLE_BASE_URL", "").rstrip("/")
    secret = os.getenv("CRON_SECRET", "")
    if not secret or not base_url:
        print("[FAIL] OPS_CONSOLE_BASE_URL / CRON_SECRET 필요")
        return 1

    env = {
        "username": os.getenv("MOA_USERNAME", ""),
        "password": os.getenv("MOA_PASSWORD", ""),
        "sms_url": os.getenv("MAKE_SMS_CODE_URL", ""),
        "sms_timeout": int(os.getenv("MOA_SMS_POLL_TIMEOUT_SEC", "120")),
        "sms_interval": int(os.getenv("MOA_SMS_POLL_INTERVAL_SEC", "3")),
        "manual_code_file": os.getenv("MANUAL_CODE_FILE", ""),
    }
    # 자격증명이 비면 Moa가 로그인 실패 후 캡차를 띄워 사람이 풀기 전까지 자동화가
    # 막힌다(scrape.py와 동일 근거) — 빈 값 제출 자체를 조기 차단한다.
    required = ["username", "password"]
    if not env["manual_code_file"]:
        required.append("sms_url")  # 수동 코드 경로가 아니면 웹훅 URL 필수
    missing = [k for k in required if not env[k]]
    if missing:
        print(f"[FAIL] 환경변수 누락: {missing}")
        return 1

    # 목록 조회 실패 시 진단 덤프(_dump_page)를 이 디렉터리에 남긴다 — 최종 결과
    # 파일(out)과 같은 위치라 실패해도 한 곳만 보면 된다.
    out = os.getenv("OUT_JSON", os.path.join(tempfile.gettempdir(), "ratio-audit.json"))
    dump_dir = os.path.dirname(out) or tempfile.gettempdir()

    targets = fetch_targets(base_url, secret)

    driver = scrape.setup_driver(tempfile.mkdtemp(prefix="moa-ratio-"), True)
    wait = WebDriverWait(driver, 40)
    findings, link_errors, skipped, collected = [], [], [], []
    try:
        login_and_2fa(driver, wait, env)
        driver.get(RATIO_SETTING_LIST_URL)

        test_list_raw = fetch_ratio_list(driver, wait, "TEST", dump_dir)
        _save_raw_list(test_list_raw, dump_dir, "TEST")
        test_rows = [r for r in test_list_raw if int(r["UnivServiceID"]) in targets]
        _print_intersection_diagnostics("TEST", test_list_raw, targets, len(test_rows))
        print(f"[OK] 교집합 {len(test_rows)}건 순회 시작")

        consecutive_skips = 0
        for i, row in enumerate(test_rows, 1):
            sid = int(row["UnivServiceID"])
            try:
                detail = extract_detail(driver, wait, sid, row["Seq"], "TEST")
                detail["university_name"] = targets[sid]["universityName"]
                detail["service_name"] = targets[sid]["serviceName"]
                collected.append(detail)
                consecutive_skips = 0
            except Exception as e:  # noqa: BLE001 — 1건 실패로 전체를 죽이지 않는다
                skipped.append({"serviceId": sid, "reason": f"{type(e).__name__}: {e}"[:200]})
                consecutive_skips += 1
                # 세션 만료 시 상세 페이지가 로그인으로 리다이렉트되어 매건 40초
                # 타임아웃으로 조용히 실패한다 — 연속 skip이 한도를 넘으면 즉시 중단.
                if consecutive_skips >= MAX_CONSECUTIVE_SKIPS:
                    remaining = test_rows[i:]
                    print(
                        f"[FAIL] 연속 {consecutive_skips}건 건너뜀 — 세션 만료 의심, "
                        f"순회 중단 (미시도 {len(remaining)}건)"
                    )
                    for r in remaining:
                        skipped.append({
                            "serviceId": int(r["UnivServiceID"]),
                            "reason": f"연속 skip {consecutive_skips}건으로 순회 중단 — 미시도",
                        })
                    break
            if i % 20 == 0:
                print(f"[INFO] {i}/{len(test_rows)} 순회")

        for start in range(0, len(collected), BATCH_SIZE):
            batch = collected[start : start + BATCH_SIZE]
            try:
                verdict = parse_response(run_claude(build_prompt(batch)))
            except Exception as e:  # noqa: BLE001 — 1회 재시도 후 배치 skip
                print(f"[WARN] 배치 판정 실패, 재시도: {e}")
                try:
                    verdict = parse_response(run_claude(build_prompt(batch)))
                except Exception as e2:  # noqa: BLE001
                    for svc in batch:
                        skipped.append({"serviceId": svc["service_id"],
                                        "reason": f"판정 실패: {e2}"[:200]})
                    continue
            for svc in batch:
                items = verdict.get(svc["service_id"], [])
                if not items:
                    continue
                findings.append({
                    "serviceId": svc["service_id"],
                    "universityName": svc["university_name"],
                    "serviceName": svc["service_name"],
                    "operatorName": targets[svc["service_id"]]["operatorName"],
                    "items": items,
                })
            print(f"[INFO] 판정 {min(start + BATCH_SIZE, len(collected))}/{len(collected)}")

        driver.get(RATIO_SETTING_LIST_URL)  # extract_detail이 상세 페이지로 이동시켰으므로 복귀
        real_list_raw = fetch_ratio_list(driver, wait, "REAL", dump_dir)
        _save_raw_list(real_list_raw, dump_dir, "REAL")
        real_rows = [r for r in real_list_raw if int(r["UnivServiceID"]) in targets]
        _print_intersection_diagnostics("REAL", real_list_raw, targets, len(real_rows))
        for row in real_rows:
            sid = int(row["UnivServiceID"])
            url = f"{HTML_BASE['REAL']}RatioH/Ratio{sid}{row['Seq']}.html"
            status, reason = check_link(url)
            if status != 200:
                link_errors.append({"serviceId": sid, "url": url,
                                    "status": status, "reason": reason})
    finally:
        driver.quit()

    payload = {
        "scannedCount": len(collected),
        "findings": findings,
        "linkErrors": link_errors,
        "skipped": skipped,
    }
    print(f"[RESULT] 순회 {len(collected)} / 이상 {len(findings)} / "
          f"링크오류 {len(link_errors)} / 건너뜀 {len(skipped)}")

    # 인제스트 성패와 무관하게 항상 먼저 파일로 남긴다 — POST 실패 시 SMS 인증·순회를
    # 다시 타지 않고 이 파일로 복구할 수 있게 경로를 stdout에 남긴다. (out은 main
    # 상단에서 dump_dir과 함께 이미 계산됨)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=1)
    print(f"[INFO] 결과 저장: {out}")

    if dry_run:
        print("[DRY RUN] 인제스트 생략")
        return 0

    res = requests.post(
        f"{base_url}/api/ratio-audit/ingest",
        headers={"Authorization": f"Bearer {secret}"},
        json=payload,
        timeout=60,
    )
    print(f"[OK] 인제스트 {res.status_code} {res.text[:200]}")
    return 0 if res.ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
