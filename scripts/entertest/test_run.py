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
# CHECKS만 로컬에서 돌려보고 결과를 출력(인제스트 안 함) — 회사 PC 빠른 검증용.
CHECKS_ONLY = os.getenv("ENTERTEST_CHECKS_ONLY", "").lower() == "true"
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


# 로그인 폼 셀렉터 (DOM 디스커버리 10-A 확정 — ASP.NET WebForms, entertest.jinhakapply.com/Login)
LOGIN_ID_SEL = "ContentPlaceHolderPage_txtUserName"
LOGIN_PW_SEL = "ContentPlaceHolderPage_txtPassword"
LOGIN_BTN_SEL = "ContentPlaceHolderPage_btn_Send"


def login(driver, account: str) -> None:
    """ID/PW 로그인 (2FA·CAPTCHA 없음, ID=PW 동일). entertest /Login WebForms 폼.

    input이 즉시 interactable하지 않은 환경이 있어 JS로 값 주입 후 페이지의 Login()을 호출한다.
    Login()은 빈값 검증 → 비밀번호 encodeURIComponent → btn_Send 클릭(ASP.NET postback)을 수행하므로
    단순 send_keys/submit보다 폼 규약에 맞다.
    """
    driver.get(f"{origin_of(TARGET_URL)}/Login")
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.ID, LOGIN_ID_SEL))
    )
    driver.execute_script(
        "document.getElementById(arguments[0]).value = arguments[2];"
        "document.getElementById(arguments[1]).value = arguments[2];",
        LOGIN_ID_SEL,
        LOGIN_PW_SEL,
        account,
    )
    # 페이지 Login() 우선(pwd 인코딩 포함), 없으면 submit 버튼 직접 클릭.
    driver.execute_script(
        "if (typeof Login === 'function') { Login(); }"
        " else { document.getElementById(arguments[0]).click(); }",
        LOGIN_BTN_SEL,
    )
    # 로그인 성공 시 /Login 을 벗어난다(실패 시 alert/잔류). 최대 15초 대기.
    WebDriverWait(driver, 15).until(lambda d: "/Login" not in d.current_url)


def service_id_of(url: str) -> str:
    """TARGET_URL(.../Notice/{id}/A)에서 서비스 id 추출."""
    parts = [p for p in urlsplit(url).path.split("/") if p]
    for i, p in enumerate(parts):
        if p.isdigit():
            return p
    return parts[1] if len(parts) > 1 else ""


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


# ── CHECKS (v1=A: 단계 도달성 스모크) ──────────────────────────────────────
# DOM 디스커버리(10-A)로 확정한 흐름: Notice(유의사항) → /Login → 원서작성(ApplyFirst)
# → 전형료 결제(Payment/UnivWritingList) → 접수완료확인(Payment/UnivPayResult).
# 로그인된 테스트 계정으로 각 핵심 페이지가 정상 렌더되는지 검증한다.
# 실제 원서작성 폼 자동완주 + 테스트결제는 v2(B)에서 별도 구현(fragile·서비스별 상이).


def _body_ready(driver, timeout: int = 15) -> None:
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    )


def check_page_load(driver, ctx):
    driver.get(TARGET_URL)
    _body_ready(driver)
    if "진학어플라이" not in (driver.title or ""):
        return ("fail", f"예상 title 아님: {driver.title!r}")
    if "/Notice/" not in driver.current_url:
        return ("fail", f"Notice 페이지 미도달(브라우저 게이트?): {driver.current_url}")
    return ("pass", None)


def check_login(driver, ctx):
    login(driver, ACCOUNT)  # 실패 시 예외 → run_checks가 fail 처리
    if "/Login" in driver.current_url:
        return ("fail", "로그인 후에도 /Login 잔류 (계정/검증 확인)")
    src = driver.page_source
    if "로그아웃" not in src and "Logout" not in src:
        return ("fail", "로그인 마커(로그아웃) 미발견")
    return ("pass", None)


def check_apply_entry(driver, ctx):
    sid = service_id_of(TARGET_URL)
    driver.get(f"{origin_of(TARGET_URL)}/ApplyFirst/{sid}/A")
    _body_ready(driver)
    if "원서작성" not in driver.page_source:
        return ("fail", "원서작성 진입 페이지 미확인('원서작성' 탭 없음)")
    return ("pass", None)


def check_payment_page(driver, ctx):
    sid = service_id_of(TARGET_URL)
    driver.get(f"{origin_of(TARGET_URL)}/Payment/UnivWritingList/{sid}")
    _body_ready(driver)
    if "전형료 결제" not in driver.page_source:
        return ("fail", "전형료 결제 페이지 미확인")
    return ("pass", None)


def check_pay_result(driver, ctx):
    sid = service_id_of(TARGET_URL)
    driver.get(f"{origin_of(TARGET_URL)}/Payment/UnivPayResult/{sid}")
    _body_ready(driver)
    if "접수완료확인" not in driver.page_source:
        return ("fail", "접수완료확인 페이지 미확인")
    return ("pass", None)


# 각 항목 (key, label, fn). fn(driver, ctx) -> (status, message). 확장 = 항목 1줄 추가.
CHECKS = [
    ("page_load", "페이지 로드(유의사항)", check_page_load),
    ("login", "로그인", check_login),
    ("apply_entry", "원서작성 진입", check_apply_entry),
    ("payment_page", "전형료 결제 페이지", check_payment_page),
    ("pay_result", "접수완료확인 페이지", check_pay_result),
]


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

    # 로그인 후 흐름 페이지 캡처 — CHECKS 셀렉터 확정용 (ApplyFirst/작성목록/접수결과)
    if not ACCOUNT:
        print("[discover] ENTERTEST_ACCOUNT 미설정 — 로그인 후 단계 캡처 skip")
        print(f"[discover] saved to {out}")
        return
    try:
        login(driver, ACCOUNT)
        time.sleep(2)
        _snapshot(driver, out, "02_after_login")
        base = origin_of(TARGET_URL)
        sid = service_id_of(TARGET_URL)
        flow = [
            ("03_applyfirst", f"/ApplyFirst/{sid}/A"),
            ("04_writinglist", f"/Payment/UnivWritingList/{sid}"),
            ("05_payresult", f"/Payment/UnivPayResult/{sid}"),
        ]
        for name, path in flow:
            try:
                driver.get(base + path)
                time.sleep(2)
                _snapshot(driver, out, name)
            except Exception as e:  # noqa: BLE001
                print(f"[discover] {name} 캡처 실패: {e}")
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
    # 디스커버리/CHECKS_ONLY는 OPS/시크릿 불필요 — TARGET_URL(+ACCOUNT)만 있으면 된다.
    if DISCOVER:
        if not TARGET_URL:
            print("[error] ENTERTEST_TARGET_URL 누락")
            return 1
    elif CHECKS_ONLY:
        if not (TARGET_URL and ACCOUNT):
            print("[error] CHECKS_ONLY: ENTERTEST_TARGET_URL/ACCOUNT 필요")
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
        if CHECKS_ONLY:
            print(json.dumps({"failed": failed, "checks": checks}, ensure_ascii=False, indent=2))
            return 0
        ingest("failed" if failed else "done", checks)
        return 0
    except Exception as e:  # noqa: BLE001 — 비정상 종료는 poll-local이 error 보고
        print(f"[fatal] {e}")
        return 1
    finally:
        driver.quit()


if __name__ == "__main__":
    sys.exit(main())
