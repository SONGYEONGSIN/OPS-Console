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
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

_REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(_REPO, "scripts", "moa-closing"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import scrape  # noqa: E402  (로그인 부품/드라이버 재사용 — 기존 검증된 구현)
from judge import build_prompt, clean_text, parse_response, run_claude  # noqa: E402

MOA_BASE = "https://moa.jinhakapply.com"
LIST_API = f"{MOA_BASE}/Ratio/GetRatioList"
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
    scrape._abort_if_captcha(driver)
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


def fetch_ratio_list(driver, server: str) -> list[dict]:
    """GetRatioList 를 페이지 컨텍스트에서 POST. 전체 목록이 한 번에 온다."""
    script = """
    const done = arguments[arguments.length - 1];
    fetch(arguments[0], {
      method: 'POST', credentials: 'include',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({MACHINE: arguments[1], ServiceName: '', Manager: '',
        Developer: '', CategoryTypeName: '', IsActive: '', strFlag: '', Search: ''}),
    }).then(r => r.json()).then(d => done(JSON.stringify(d))).catch(e => done('ERR:' + e));
    """
    driver.set_script_timeout(120)
    raw = driver.execute_async_script(script, LIST_API, server)
    if raw.startswith("ERR:"):
        raise RuntimeError(f"{server} 목록 조회 실패: {raw[:200]}")
    rows = json.loads(raw)
    print(f"[OK] {server} 목록 {len(rows)}건")
    return rows


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

    targets = fetch_targets(base_url, secret)

    driver = scrape.setup_driver(tempfile.mkdtemp(prefix="moa-ratio-"), True)
    wait = WebDriverWait(driver, 40)
    findings, link_errors, skipped, collected = [], [], [], []
    try:
        login_and_2fa(driver, wait, env)
        driver.get(f"{MOA_BASE}/Ratio/RatioSetting")

        test_rows = [r for r in fetch_ratio_list(driver, "TEST")
                     if int(r["UnivServiceID"]) in targets]
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

        for row in fetch_ratio_list(driver, "REAL"):
            sid = int(row["UnivServiceID"])
            if sid not in targets:
                continue
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
    # 다시 타지 않고 이 파일로 복구할 수 있게 경로를 stdout에 남긴다.
    out = os.getenv("OUT_JSON", os.path.join(tempfile.gettempdir(), "ratio-audit.json"))
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
