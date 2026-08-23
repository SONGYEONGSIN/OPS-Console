#!/usr/bin/env python3
"""Moa 정산 화면 구조 알아내기 — 회사 PC 에서 한 번 돌린다.

정산 금액을 긁으려면 URL·다운로드 호출·엑셀 컬럼 이름이 필요한데, 이것들은
**화면을 봐야만** 알 수 있다. Cloudflare 가 데이터센터 IP 를 막고 로그인에 SMS
본인확인이 붙어 회사 PC 밖에서는 열리지 않는다. 기존 마감 스크래퍼(`scrape.py`)의
셀렉터도 같은 이유로 "전부 라이브 디스커버리로 확정"했다.

**이 스크립트는 아무것도 가정하지 않는다.** 화면에 있는 것을 그대로 보고할 뿐이고,
그 출력이 곧 스크래퍼를 쓸 근거가 된다. 추측한 셀렉터로 스크래퍼를 먼저 쓰면
돌아가는지 알 수 없는 코드가 된다.

사내 정산 매뉴얼(D01)이 알려준 경로:
  모아 > 정산관리 > 정산내역        (일별, 송금예정일로 검색)
  모아 > 정산관리 > 정산요청내역     (월 결산용, 다운로드 가능)

사용 (레포 루트에서):
  python scripts/moa-settlement/discover.py

환경변수는 `scrape.py` 와 같다 — MOA_USERNAME / MOA_PASSWORD / MAKE_SMS_CODE_URL.
로그인 흐름을 그대로 가져다 쓰므로 2FA 처리가 두 벌이 되지 않는다.

  HEADLESS_MODE=false            창을 띄워 눈으로 보며 확인 (권장)
  MOA_SETTLE_URL=<주소>          메뉴 탐색을 건너뛰고 그 화면으로 바로 간다
  MOA_SETTLE_DOWNLOAD=true       다운로드까지 시도해 엑셀 컬럼을 뽑는다
"""
import os
import sys
import tempfile
from pathlib import Path

# scrape.py 의 로그인·드라이버·엑셀 복호를 그대로 쓴다. 복사하면 2FA 가 두 벌이 되고
# 한쪽만 고쳐지는 순간 갈라진다.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "moa-closing"))

MOA_ORIGIN = "https://moa.jinhakapply.com"

# 컬럼 이름을 무엇으로 볼지 — 매뉴얼 5·8쪽 화면에서 확인된 표기.
_SERVICE_ID_HINTS = ("univserviceid", "서비스id", "serviceid")
_AMOUNT_HINTS = ("금액", "총계", "송금", "수수료", "전형료")
_COUNT_HINTS = ("건수",)
_ISSUE_HINTS = ("구분", "세금계산서", "계산서")


def pick_settlement_links(links):
    """정산 관련 링크만, 화면에 뜬 차례 그대로.

    주소를 못 얻는 링크(`javascript:`, `#`, 빈 값)는 뺀다 — 보고해도 스크래퍼가
    쓸 수 없다. 정렬하지 않는다: 뜬 차례가 곧 메뉴 구조다.
    """
    out = []
    seen = set()
    for text, href in links:
        h = (href or "").strip()
        if not h or h == "#" or h.lower().startswith("javascript:"):
            continue
        if "정산" not in (text or "") and "settle" not in h.lower() and "정산" not in h:
            continue
        if h in seen:
            continue
        seen.add(h)
        out.append((text, href))
    return out


def classify_headers(headers):
    """엑셀/표 컬럼을 성격별로 나눠 보고한다.

    **어느 것이 청구금액인지는 정하지 않는다.** 후보를 빠짐없이 보여주는 게 일이고,
    고르는 건 사람이 한다 — 매뉴얼상 `수수료 총계`가 유력하나 `구분`이 학생부담이면
    달라질 수 있어 실제 값을 봐야 한다.

    모르는 컬럼은 `other` 에 남긴다. 조용히 버리면 화면에 있는데 보고서에 없는
    컬럼이 생긴다.
    """
    result = {"service_id": [], "amount": [], "count": [], "issue": [], "other": []}
    for h in headers:
        name = (h or "").strip()
        if not name:
            continue
        low = name.replace(" ", "").lower()
        if any(k in low for k in _SERVICE_ID_HINTS):
            result["service_id"].append(name)
        elif any(k in name for k in _COUNT_HINTS):
            result["count"].append(name)
        elif any(k in name for k in _AMOUNT_HINTS):
            result["amount"].append(name)
        elif any(k in name for k in _ISSUE_HINTS):
            result["issue"].append(name)
        else:
            result["other"].append(name)
    return result


def _report(title, rows):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")
    if not rows:
        print("  (없음)")
    for r in rows:
        print(f"  {r}")


def main() -> int:
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait

    from scrape import setup_driver, login_and_2fa  # noqa: E402

    env = {
        "username": os.getenv("MOA_USERNAME", ""),
        "password": os.getenv("MOA_PASSWORD", ""),
        "sms_url": os.getenv("MAKE_SMS_CODE_URL", ""),
        "sms_timeout": int(os.getenv("MOA_SMS_POLL_TIMEOUT_SEC", "90")),
        "sms_interval": int(os.getenv("MOA_SMS_POLL_INTERVAL_SEC", "3")),
    }
    missing = [k for k in ("username", "password", "sms_url") if not env[k]]
    if missing:
        print(f"[FAIL] 환경변수 누락: {missing}")
        return 1

    headless = os.getenv("HEADLESS_MODE", "false").lower() == "true"
    download_dir = tempfile.mkdtemp(prefix="moa-settle-")
    driver = setup_driver(download_dir, headless)
    wait = WebDriverWait(driver, int(os.getenv("MOA_WAIT_SEC", "40")))

    try:
        login_and_2fa(driver, wait, env)

        target = os.getenv("MOA_SETTLE_URL", "")
        if not target:
            anchors = [
                (a.text.strip(), a.get_attribute("href") or "")
                for a in driver.find_elements(By.TAG_NAME, "a")
            ]
            found = pick_settlement_links(anchors)
            _report("정산 관련 메뉴 (텍스트 → 주소)", [f"{t or '(빈 텍스트)'}  →  {h}" for t, h in found])
            if not found:
                print(
                    "\n[안내] 정산 메뉴가 링크로 안 잡혔습니다. 눌러야 뜨는 메뉴일 수 있습니다.\n"
                    "       화면에서 '정산관리 > 정산요청내역'을 직접 연 뒤 주소창을 복사해\n"
                    "       MOA_SETTLE_URL=<주소> 로 다시 실행하세요."
                )
                return 0
            target = found[-1][1]
            print(f"\n[INFO] 마지막 항목으로 이동합니다: {target}")

        driver.get(target if target.startswith("http") else MOA_ORIGIN + target)
        print(f"\n[INFO] 현재 주소: {driver.current_url}")
        print(f"[INFO] 제목: {driver.title}")

        _report(
            "검색 입력칸 (id / name / type)",
            [
                f"id={e.get_attribute('id') or '-'}  name={e.get_attribute('name') or '-'}  "
                f"type={e.get_attribute('type') or e.tag_name}"
                for e in driver.find_elements(By.CSS_SELECTOR, "input, select")
                if e.get_attribute("id") or e.get_attribute("name")
            ],
        )

        _report(
            "버튼과 그 호출 (다운로드 함수를 여기서 찾는다)",
            [
                f"{(e.text or e.get_attribute('value') or '(이름없음)').strip()}  →  "
                f"onclick={e.get_attribute('onclick') or '-'}  id={e.get_attribute('id') or '-'}"
                for e in driver.find_elements(
                    By.CSS_SELECTOR, "button, input[type=button], input[type=submit], a.btn"
                )
            ],
        )

        headers = [th.text.strip() for th in driver.find_elements(By.CSS_SELECTOR, "table th")]
        if headers:
            c = classify_headers(headers)
            _report("표 머리글 — 성격별", [
                f"서비스ID  : {c['service_id']}",
                f"금액 후보 : {c['amount']}   ← 이 중 무엇이 청구금액인지 실제 값으로 확인",
                f"건수      : {c['count']}",
                f"발행 축   : {c['issue']}",
                f"기타      : {c['other']}",
            ])

        if os.getenv("MOA_SETTLE_DOWNLOAD", "").lower() == "true":
            print(
                "\n[안내] 다운로드는 위에서 찾은 호출을 직접 실행해야 합니다.\n"
                "       예) driver.execute_script('GetSettlementListToExcel()')\n"
                "       버튼 목록의 onclick 을 보고 함수 이름을 확인한 뒤 실행하세요."
            )

        print(
            "\n[다음] 위 출력을 그대로 붙여 주시면 스크래퍼를 씁니다. 필요한 건 셋입니다:\n"
            "       1) 정산요청내역 주소  2) 다운로드 함수 이름  3) 청구금액에 해당하는 컬럼"
        )
        return 0
    finally:
        driver.quit()


if __name__ == "__main__":
    raise SystemExit(main())
