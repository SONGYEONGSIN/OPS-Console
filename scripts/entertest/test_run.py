#!/usr/bin/env python3
"""entertest 원서접수 케이스별 테스트 러너 (회사 PC, Selenium).

흐름: run-local.ps1이 ENTERTEST_RUN_ID/TARGET_URL/ACCOUNT 전달 →
  Chrome 기동(브라우저 게이트 통과) → ID/PW 로그인 → CHECKS 순차 실행 →
  실패 시 스크린샷 Storage 업로드 → /api/entertest/ingest POST.

DOM 디스커버리: ENTERTEST_DISCOVER=true 로 실행하면 로그인 후 단계별 page_source/
스크린샷을 scripts/entertest/discovery/ 에 저장하고 종료(셀렉터 확정용).
"""
import os
import sys
import time
import json
from urllib.parse import urlsplit


def origin_of(url: str) -> str:
    """URL에서 scheme://host origin 추출 (예: https://entertest.jinhakapply.com)."""
    s = urlsplit(url)
    return f"{s.scheme}://{s.netloc}"

try:
    from dotenv import load_dotenv

    _repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    load_dotenv(os.path.join(_repo, ".env.local"))
except Exception:
    pass

import requests

try:
    import undetected_chromedriver as uc
except Exception:
    uc = None
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

RUN_ID = os.getenv("ENTERTEST_RUN_ID", "")
TARGET_URL = os.getenv("ENTERTEST_TARGET_URL", "")
ACCOUNT = os.getenv("ENTERTEST_ACCOUNT", "")  # ID=PW 동일
BASE = os.getenv("OPS_CONSOLE_BASE_URL", "").rstrip("/")
SECRET = os.getenv("CRON_SECRET", "")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DISCOVER = os.getenv("ENTERTEST_DISCOVER", "").lower() == "true"
BUCKET = "entertest-screenshots"


def make_driver():
    # entertest 게이트는 CF 챌린지("Just a moment")가 아니라 단순 브라우저(UA) 체크라
    # 실제 Chrome이면 plain Selenium으로도 통과한다. undetected-chromedriver를 우선
    # 시도하되(있으면), Chrome/드라이버 버전 불일치 등으로 기동 실패하면 plain으로 폴백한다.
    if uc is not None:
        try:
            uc_opts = uc.ChromeOptions()
            uc_opts.add_argument("--start-maximized")
            return uc.Chrome(options=uc_opts)
        except Exception as e:  # noqa: BLE001 — uc 기동 실패 시 plain Selenium 폴백
            print(f"[driver] undetected-chromedriver 기동 실패 → plain Selenium 폴백: {e}")
    opts = Options()
    opts.add_argument("--start-maximized")
    return webdriver.Chrome(options=opts)


def login(driver, account: str) -> None:
    """ID/PW 로그인 (2FA·CAPTCHA 없음, ID=PW 동일). 셀렉터는 10-A에서 확정."""
    # placeholder: 10-A 디스커버리로 #txtId/#txtPw/#btnLogin 등 실제 셀렉터 확정 후 구현
    raise NotImplementedError("login 셀렉터는 DOM 디스커버리(10-A) 후 구현")


def upload_screenshot(driver, key: str):
    """실패 스크린샷을 Supabase Storage에 업로드하고 public URL 반환."""
    if not (SUPABASE_URL and SERVICE_KEY):
        return None
    png = driver.get_screenshot_as_png()
    path = f"{RUN_ID}/{key}.png"
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}"
    r = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "image/png",
            "x-upsert": "true",
        },
        data=png,
        timeout=30,
    )
    if r.status_code not in (200, 201):
        return None
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}"


# CHECKS: 각 항목 (key, label, fn). fn(driver, ctx) -> (status, message).
# 10-A 디스커버리로 실제 단계·셀렉터 확정 후 10-B에서 채운다.
CHECKS = []  # 10-B에서 page_load/login/fill_steps/required_validation/test_payment_complete 추가


def run_checks(driver):
    results = []
    for key, label, fn in CHECKS:
        try:
            status, message = fn(driver, {})
        except Exception as e:  # noqa: BLE001
            status, message = "fail", str(e)[:300]
        shot = upload_screenshot(driver, key) if status == "fail" else None
        item = {"key": key, "label": label, "status": status, "message": message}
        if shot:
            item["screenshot_url"] = shot
        results.append(item)
        if status == "fail":
            # 치명 단계 실패 시 이후는 skip
            break
    # break로 누락된 뒤 케이스는 skip 처리
    done_keys = {r["key"] for r in results}
    for key, label, _ in CHECKS:
        if key not in done_keys:
            results.append({"key": key, "label": label, "status": "skip", "message": None})
    return results


def _snapshot(driver, out: str, name: str) -> None:
    with open(os.path.join(out, f"{name}.html"), "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    driver.save_screenshot(os.path.join(out, f"{name}.png"))
    print(f"[discover] {name} — url={driver.current_url}")


def discover(driver) -> None:
    """단계별 page_source/스크린샷 저장 (셀렉터 확정용).

    로그인 구현 전(login() NotImplementedError)에도 동작한다: 먼저 로그인 전 페이지를
    캡처하고, login()이 구현된 뒤 재실행하면 로그인 후 단계까지 이어서 캡처한다.
    """
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "discovery")
    os.makedirs(out, exist_ok=True)
    driver.get(TARGET_URL)
    time.sleep(3)
    _snapshot(driver, out, "01_notice")

    # 로그인 페이지 캡처 — 폼 셀렉터(ID/PW/로그인 버튼) 확정용. Notice엔 폼이 없고
    # GoLogin()이 {origin}/Login 으로 이동한다.
    try:
        driver.get(f"{origin_of(TARGET_URL)}/Login")
        time.sleep(2)
        _snapshot(driver, out, "00_login")
    except Exception as e:  # noqa: BLE001
        print(f"[discover] 로그인 페이지 캡처 실패: {e}")

    # 로그인 구현 후 재실행 시 로그인 후 단계도 캡처 (1차 실행에선 NotImplementedError로 skip)
    try:
        login(driver, ACCOUNT)
        time.sleep(2)
        _snapshot(driver, out, "02_after_login")
    except NotImplementedError:
        print("[discover] login() 미구현 — 로그인 전 페이지만 캡처. "
              "01_notice.html에서 로그인 폼 셀렉터를 확인 후 login()을 구현하세요.")
    except Exception as e:  # noqa: BLE001
        print(f"[discover] login 시도 실패(셀렉터 재확인 필요): {e}")
    print(f"[discover] saved to {out}")


def ingest(status: str, checks, error=None) -> None:
    body = {"id": RUN_ID, "status": status, "checks": checks}
    if error:
        body["error_message"] = error[:500]
    r = requests.post(
        f"{BASE}/api/entertest/ingest",
        headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"},
        data=json.dumps(body),
        timeout=30,
    )
    print(f"[ingest] {r.status_code} {r.text[:200]}")


def main() -> int:
    # 디스커버리 1차 실행은 OPS/시크릿 불필요 — TARGET_URL만 있으면 된다.
    if DISCOVER:
        if not TARGET_URL:
            print("[error] ENTERTEST_TARGET_URL 누락")
            return 1
    elif not (RUN_ID and TARGET_URL and ACCOUNT and BASE and SECRET):
        print("[error] 필수 환경변수 누락 (RUN_ID/TARGET_URL/ACCOUNT/BASE/SECRET)")
        return 1
    driver = make_driver()
    try:
        if DISCOVER:
            discover(driver)
            return 0
        checks = run_checks(driver)
        failed = any(c["status"] == "fail" for c in checks)
        ingest("failed" if failed else "done", checks)
        return 0
    except Exception as e:  # noqa: BLE001 — 비정상 종료는 poll-local이 error 보고
        print(f"[fatal] {e}")
        return 1
    finally:
        driver.quit()


if __name__ == "__main__":
    sys.exit(main())
