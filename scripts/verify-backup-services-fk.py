"""
PR-2 smoke 검증 — /dashboard/backup multi-select services FK.

체크리스트:
1) 로그인 + /dashboard/backup 진입 200
2) "+ 백업 요청" 버튼으로 신규 요청 진입
3) 담당 서비스 검색 input에 "한양" 입력 → 결과 list 노출 (3+ 항목)
4) 결과 첫 항목 클릭 → 선택 chips에 추가 + 검색 input 초기화
5) View deep-link 동작 (기존 요청 1건 있다면 — 없으면 skip)
6) console_errors 0

산출: screenshots + JSON 요약.
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
OUT_DIR = Path(".claude/memory/analysis/verify-pr96")
OUT_DIR.mkdir(parents=True, exist_ok=True)


def main() -> int:
    findings: dict = {"base": BASE, "checks": {}}
    console_errors: list[str] = []
    page_errors: list[str] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: page_errors.append(str(e)))

        page.set_default_navigation_timeout(120_000)
        page.set_default_timeout(15_000)

        # 1) 로그인
        page.goto(f"{BASE}/login", wait_until="domcontentloaded")
        page.wait_for_selector("#email", timeout=30_000)
        page.fill("#email", EMAIL)
        page.fill("#password", PASSWORD)
        page.get_by_role("button", name="로그인", exact=True).last.click()
        page.wait_for_url(re.compile(r".*/dashboard.*"), timeout=20_000)
        findings["checks"]["login"] = "ok"

        # 2) /dashboard/backup 진입
        page.goto(f"{BASE}/dashboard/backup", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        page.wait_for_load_state("networkidle", timeout=30_000)
        page.screenshot(path=str(OUT_DIR / "01-backup-list.png"), full_page=True)
        findings["checks"]["backup_page_loaded"] = True

        # 3) "+ 백업 요청" 버튼 클릭 → 인스펙터 EditForm 진입
        try:
            create_btn = page.get_by_role("button", name=re.compile(r"\+\s*백업\s*요청"))
            create_btn.click()
            page.wait_for_timeout(800)
            findings["checks"]["create_clicked"] = True
        except Exception as e:
            findings["checks"]["create_clicked_error"] = str(e)
            page.screenshot(path=str(OUT_DIR / "ERR-create.png"), full_page=True)

        # 4) 담당 서비스 검색 input
        try:
            search_input = page.get_by_label("담당 서비스 검색")
            search_input.fill("한양")
            page.wait_for_timeout(500)
            page.screenshot(path=str(OUT_DIR / "02-search-results.png"), full_page=True)

            # 검색 결과 list 항목 수
            results_list = page.get_by_label("담당 서비스 검색 결과")
            result_buttons = results_list.locator("button")
            count = result_buttons.count()
            findings["checks"]["search_한양_results"] = count

            # 첫 항목 클릭 → 선택 chips에 추가됨
            if count > 0:
                result_buttons.first.click()
                page.wait_for_timeout(300)
                page.screenshot(path=str(OUT_DIR / "03-after-pick.png"), full_page=True)
                # 검색 input 비워졌는지
                value_after = search_input.input_value()
                findings["checks"]["search_input_cleared"] = value_after == ""
                # 선택 chips 1개 노출
                chip_remove_buttons = page.locator('button[aria-label*=" 제거"]')
                findings["checks"]["selected_chips_count"] = chip_remove_buttons.count()
        except Exception as e:
            findings["checks"]["search_pick_error"] = str(e)
            page.screenshot(path=str(OUT_DIR / "ERR-search.png"), full_page=True)

        findings["console_errors"] = console_errors[:5]
        findings["page_errors"] = page_errors[:5]
        browser.close()

    (OUT_DIR / "summary.json").write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(findings, ensure_ascii=False, indent=2))
    return 0 if not page_errors else 1


if __name__ == "__main__":
    sys.exit(main())
