"""
PR-1.5 검증 — /dashboard/services 실 데이터(2511행) UI 동작 확인.

체크리스트:
1) 로그인 성공
2) /dashboard/services 200 OK + 테이블 row 표시
3) 페이지네이션/리스트 길이
4) 검색 "한양" → 필터링
5) 본인 필터 토글 (있다면) → 행 수 변화
6) 카테고리 필터 (있다면) → 행 수 변화
7) 콘솔 에러 0건

결과는 screenshot + JSON 요약.
"""

import os
import json
import re
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

def load_env_local() -> dict:
    env_path = Path(".env.local")
    if not env_path.exists():
        return {}
    out = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip()
    return out


_env = load_env_local()
BASE = os.environ.get("BASE_URL", "http://localhost:3000")
EMAIL = os.environ.get("TEST_USER_EMAIL") or _env.get("TEST_USER_EMAIL")
PASSWORD = os.environ.get("TEST_USER_PASSWORD") or _env.get("TEST_USER_PASSWORD")
if not EMAIL or not PASSWORD:
    print("TEST_USER_EMAIL / TEST_USER_PASSWORD 미설정", file=sys.stderr)
    sys.exit(2)
OUT_DIR = Path(".claude/memory/analysis/verify-pr94")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main() -> int:
    findings: dict = {"base": BASE, "checks": {}}
    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        # 1) 로그인 — dev 첫 컴파일은 느림. domcontentloaded + 큰 timeout.
        page.set_default_navigation_timeout(120_000)
        page.set_default_timeout(15_000)
        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_selector("#email", timeout=30_000)
        page.fill("#email", EMAIL)
        page.fill("#password", PASSWORD)
        page.get_by_role("button", name="로그인", exact=True).last.click()
        page.wait_for_url(re.compile(r".*/dashboard.*"), timeout=15_000)
        findings["checks"]["login"] = "ok"
        page.screenshot(path=str(OUT_DIR / "01-after-login.png"), full_page=False)

        # 2) services 페이지
        page.goto(f"{BASE}/dashboard/services", wait_until="domcontentloaded")
        page.wait_for_selector("table", timeout=30_000)
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT_DIR / "02-services-default.png"), full_page=True)

        # 행 수: table 안 tr 카운트 (헤더 제외 가정 — 일반적 패턴)
        all_rows = page.locator("table tbody tr").count()
        if all_rows == 0:
            all_rows = page.locator("tbody tr").count()
        findings["checks"]["initial_rows_in_table"] = all_rows

        # 페이지 텍스트에 "2511" 또는 큰 숫자가 보이는지(상단 메타 카운트)
        meta_text = page.locator("body").inner_text()
        digits = re.findall(r"\b(\d{2,5})\b", meta_text)
        findings["checks"]["large_numbers_visible"] = sorted(set(int(d) for d in digits if int(d) >= 100), reverse=True)[:10]

        # 3) 검색 — 흔한 placeholder "검색" 또는 type=search input 찾기
        search_input = page.locator("input[type=search], input[placeholder*='검색']").first
        if search_input.count() > 0:
            search_input.fill("한양")
            page.wait_for_timeout(700)  # debounce
            try:
                page.wait_for_load_state("networkidle", timeout=5_000)
            except Exception:
                pass
            page.screenshot(path=str(OUT_DIR / "03-search-한양.png"), full_page=True)
            after = page.locator("table tbody tr, tbody tr").count()
            findings["checks"]["search_hanyang_rows"] = after
            search_input.fill("")
            page.wait_for_timeout(700)
        else:
            findings["checks"]["search_input_present"] = False

        # 4) 본인 필터 토글 — 흔히 "내 담당" 텍스트
        my_filter = page.get_by_text(re.compile(r"내 담당"), exact=False).first
        if my_filter.count() > 0:
            before = page.locator("table tbody tr, tbody tr").count()
            try:
                my_filter.click()
                page.wait_for_timeout(700)
                try:
                    page.wait_for_load_state("networkidle", timeout=5_000)
                except Exception:
                    pass
                after = page.locator("table tbody tr, tbody tr").count()
                findings["checks"]["my_filter_before"] = before
                findings["checks"]["my_filter_after"] = after
                page.screenshot(path=str(OUT_DIR / "04-my-filter.png"), full_page=True)
            except Exception as e:
                findings["checks"]["my_filter_error"] = str(e)
        else:
            findings["checks"]["my_filter_present"] = False

        findings["console_errors"] = console_errors
        findings["page_errors"] = page_errors

        browser.close()

    (OUT_DIR / "summary.json").write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(findings, ensure_ascii=False, indent=2))
    return 0 if not page_errors else 1


if __name__ == "__main__":
    sys.exit(main())
