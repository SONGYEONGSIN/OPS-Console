#!/usr/bin/env python3
"""entertest 원서접수 케이스별 테스트 러너 (회사 PC, Selenium).

흐름: run-local.ps1이 ENTERTEST_RUN_ID/TARGET_URL/ACCOUNT 전달 →
  Chrome 기동(브라우저 게이트 통과) → ID/PW 로그인 → CHECKS 순차 실행 →
  실패 시 스크린샷 Storage 업로드 → /api/entertest/ingest POST.

DOM 디스커버리: ENTERTEST_DISCOVER=true 로 실행하면 로그인 후 단계별 page_source/
스크린샷 + 필드/버튼 인벤토리({단계}.fields.json)를 scripts/entertest/discovery/ 에
저장하고 종료(셀렉터 확정용 — 실제 원서작성 자동완주 v2 설계 입력).
"""
import os
import sys
import time
import json
from urllib.parse import urlsplit

# Windows 콘솔(cp949)에서도 한글/특수문자 print가 깨지지 않도록 utf-8로 강제.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:  # noqa: BLE001
    pass


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

from field_roles import role_value  # jwtype role 레지스트리 (범용 엔진 2단계)

RUN_ID = os.getenv("ENTERTEST_RUN_ID", "")
TARGET_URL = os.getenv("ENTERTEST_TARGET_URL", "")
# 대역(범위) "jt29001~jt29005"로 등록 가능. ID=PW 동일.
# ACCOUNT_SPEC=원본 범위 문자열, ACCOUNT=현재 사용 계정(기본=첫 계정). check_apply_write는 대역을 펼쳐
# 접수완료로 소진되지 않은 계정을 자동 순환 선택하며 ACCOUNT(전역)를 갱신한다(아래 expand_accounts).
ACCOUNT_SPEC = os.getenv("ENTERTEST_ACCOUNT", "").strip()
ACCOUNT = ACCOUNT_SPEC.split("~")[0].strip()
BASE = os.getenv("OPS_CONSOLE_BASE_URL", "").rstrip("/")
SECRET = os.getenv("CRON_SECRET", "")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DISCOVER = os.getenv("ENTERTEST_DISCOVER", "").lower() == "true"
# CHECKS만 로컬에서 돌려보고 결과를 출력(인제스트 안 함) — 회사 PC 빠른 검증용.
CHECKS_ONLY = os.getenv("ENTERTEST_CHECKS_ONLY", "").lower() == "true"
# check_apply_write(원서작성 완주) 단독 실행 — 인제스트 안 함, 결과만 출력(개발/검증용).
APPLY_WRITE = os.getenv("ENTERTEST_APPLY_WRITE", "").lower() == "true"
# 결제(테스트 결제)+접수완료까지 진행(opt-in). ⚠️ 접수완료 시 같은 계정/학교 재작성이 막힌다(계정 소진)
# → 반복 테스트는 결제직전(기본)으로, 전 과정 완주 검증만 PAY=true + 깨끗한 계정 사용.
PAY = os.getenv("ENTERTEST_PAY", "").lower() == "true"
BUCKET = "entertest-screenshots"


def make_driver():
    # entertest 게이트는 CF 챌린지("Just a moment")가 아니라 단순 브라우저(UA) 체크라
    # 실제 Chrome이면 plain Selenium으로 통과한다(검증됨). 기본은 plain.
    # CF 챌린지가 있는 사이트에 한해 ENTERTEST_USE_UC=true로 undetected-chromedriver를 시도한다.
    # 원서작성 흐름은 네이티브 alert/confirm을 띄운다(예: 재진입 시 "이미 작성한 원서가 있습니다").
    # unhandledPromptBehavior=accept로 자동 수락 → Selenium UnexpectedAlertPresentException 회피
    # (페이지 JS 레벨 override는 _INSTALL_ALERT_CAPTURE_JS가 별도 담당).
    use_uc = os.getenv("ENTERTEST_USE_UC", "").lower() == "true"
    if use_uc and uc is not None:
        try:
            uc_opts = uc.ChromeOptions()
            uc_opts.add_argument("--start-maximized")
            uc_opts.set_capability("unhandledPromptBehavior", "accept")
            return uc.Chrome(options=uc_opts)
        except Exception as e:  # noqa: BLE001 — uc 기동 실패 시 plain Selenium 폴백
            print(f"[driver] undetected-chromedriver 기동 실패 → plain Selenium 폴백: {e}")
    opts = Options()
    opts.add_argument("--start-maximized")
    opts.set_capability("unhandledPromptBehavior", "accept")
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

    계정 순환 시 이전 세션이 남으면 /Login이 인증상태로 리다이렉트되어 폼이 없으므로, 도메인 진입 후
    쿠키를 비워 미인증 상태로 만든 뒤 /Login을 다시 연다.
    """
    base = origin_of(TARGET_URL)
    driver.get(f"{base}/Login")
    try:
        driver.delete_all_cookies()  # 이전 계정 세션 제거(순환 로그인)
    except Exception:  # noqa: BLE001
        pass
    driver.get(f"{base}/Login")
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


def expand_accounts(spec: str):
    """계정 대역 문자열을 계정 리스트로 펼친다.

    "jt29001~jt29005" → [jt29001..jt29005], "jt29001~29005" → 동일(끝은 접두사 생략 가능),
    "jt29005"(단일) → [jt29005]. 끝<시작이거나 파싱 실패면 시작 계정만.
    """
    import re

    spec = (spec or "").strip()
    if not spec:
        return []
    if "~" not in spec:
        return [spec]
    a, b = [s.strip() for s in spec.split("~", 1)]
    ma = re.match(r"^(\D*)(\d+)$", a)
    if not ma:
        return [a]
    prefix, start_s = ma.group(1), ma.group(2)
    width, start_n = len(start_s), int(start_s)
    mb = re.search(r"(\d+)$", b)
    end_n = int(mb.group(1)) if mb else start_n
    if end_n < start_n:
        return [a]
    return [f"{prefix}{str(n).zfill(width)}" for n in range(start_n, end_n + 1)]


def service_id_of(url: str) -> str:
    """TARGET_URL(.../Notice/{id}/A)에서 서비스 id 추출."""
    parts = [p for p in urlsplit(url).path.split("/") if p]
    for i, p in enumerate(parts):
        if p.isdigit():
            return p
    return parts[1] if len(parts) > 1 else ""


def enter_wonseo(driver, sid: str) -> None:
    """원서작성 폼(Wonseo) 진입 — check_apply_write(v2)의 진입 단계.

    해독(docs/entertest-apply-automation.md): ApplyFirst → 실제 콘텐츠는 iframe #frmNotice
    (src=/Noti/{sid}/T) 안의 동의서. 동의 체크박스(c0=모두동의 + chkNotice*) 전체 체크 →
    버튼 onApply() → confirm("원서를 작성하시겠습니까?") 수락 → /Wonseo/{sid}/{N}/A
    (실제 폼, default content) 도달.

    기존 원서가 있으면(반복 실행) ApplyFirst가 네이티브 alert("이미 작성한 원서가 있습니다",
    드라이버가 자동 수락) 후 편집 페이지 /Wonseo/{sid}/{N}/AC/{ApplyID}로 직행한다(동의 iframe 없음).
    두 경로(신규 동의 / 기존 편집)를 모두 처리한다.
    """
    base = origin_of(TARGET_URL)
    driver.get(f"{base}/ApplyFirst/{sid}/A")
    # 신규(#frmNotice 동의 iframe) vs 기존(곧장 /Wonseo 편집) 분기 대기.
    WebDriverWait(driver, 20).until(lambda d: (
        "/Wonseo/" in d.current_url
        or d.execute_script("return !!document.getElementById('frmNotice');")
    ))
    if "/Wonseo/" in driver.current_url:
        return  # 기존 원서 편집 진입 — 동의 단계 불필요
    driver.switch_to.frame("frmNotice")
    # 신규(동의 iframe /Noti/{sid}/T, 체크박스 6) vs 접수완료-차단(/Noti/{sid}/A, 체크박스 0) 판별.
    # 접수완료 후엔 ApplyFirst가 단순 공지로 바운스 → 같은 계정/학교 재작성 불가.
    n_chk = driver.execute_script(
        "return document.querySelectorAll('input[type=checkbox]').length;"
    )
    if not n_chk:
        driver.switch_to.default_content()
        raise RuntimeError(
            "원서작성 진입 불가 — 이미 접수완료된 원서가 있어 재작성이 막힘(계정/학교 소진). "
            "반복 테스트는 다른 테스트 계정(jt29001~) 사용."
        )
    # 동의 체크박스 전체 체크 + confirm 자동 수락(프레임 컨텍스트) 후 onApply().
    driver.execute_script(
        "window.confirm = function () { return true; };"
        "document.querySelectorAll('input[type=checkbox]').forEach(function (c) {"
        "  if (!c.checked) { try { c.click(); } catch (e) { c.checked = true; } }"
        "});"
    )
    time.sleep(0.5)
    driver.execute_script("if (typeof onApply === 'function') { onApply(); }")
    driver.switch_to.default_content()
    # onApply가 top 문서를 /Wonseo로 이동 — 도달 대기.
    WebDriverWait(driver, 20).until(lambda d: "/Wonseo/" in d.current_url)


def delete_unpaid_applications(driver) -> int:
    """미접수(미결제) 원서를 삭제 — 반복 실행 시 깨끗한 신규 작성 경로를 보장(편집 모드 회피). 삭제 건수 반환.

    해독(5차): /MyPage/PayingPage의 '삭제하기'(jQuery) → Deletelayer(chkagree 동의 + passwd 본인확인 +
    btnpasswdCheck '확인' → btnDelete '미접수 원서 삭제'). 테스트 계정은 ID=PW. 네이티브 confirm은
    드라이버 unhandledPromptBehavior=accept가 자동 수락.
    """
    base = origin_of(TARGET_URL)
    deleted = 0
    for _ in range(10):  # 여러 건이면 반복 — 매 회 목록 갱신
        driver.get(base + "/MyPage/PayingPage")
        _body_ready(driver)
        time.sleep(1.2)
        has = driver.execute_script(
            "return Array.prototype.some.call(document.querySelectorAll('a'), function(a){"
            "  return /삭제하기/.test(a.innerText||'') && getComputedStyle(a).display!=='none'; });"
        )
        if not has:
            break
        driver.execute_script(
            "var a=Array.prototype.find.call(document.querySelectorAll('a'), function(x){"
            "  return /삭제하기/.test(x.innerText||''); }); if(a) a.click();"
        )
        time.sleep(1.0)
        # 동의 체크 + 비밀번호(=계정) 입력 → 본인확인 → 삭제.
        # (chkagree: 클릭 1회로 체크. set-true 후 click하면 토글되어 풀림 → "동의 안 함" 거부.)
        driver.execute_script(
            "var c=document.getElementById('chkagree');"
            "if(c){ if(!c.checked){ try{c.click()}catch(e){} } if(!c.checked){ c.checked=true;"
            "  c.dispatchEvent(new Event('change',{bubbles:true})); } }"
            "var p=document.getElementById('passwd'); if(p){ p.value=arguments[0];"
            "  p.dispatchEvent(new Event('input',{bubbles:true})); p.dispatchEvent(new Event('change',{bubbles:true})); }",
            ACCOUNT,
        )
        time.sleep(0.3)
        driver.execute_script("var b=document.getElementById('btnpasswdCheck'); if(b) b.click();")
        time.sleep(1.2)
        driver.execute_script("var b=document.getElementById('btnDelete'); if(b) b.click();")
        time.sleep(2.0)  # confirm 자동수락 + 삭제 AJAX settle
        deleted += 1
    return deleted


_TEST_PHOTO_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_test_photo.jpg")


def _ensure_test_photo() -> str:
    """업로드용 테스트 사진(300x400=3cm×4cm 비율 JPEG) 생성/재사용. PIL 필요."""
    if os.path.exists(_TEST_PHOTO_PATH):
        return _TEST_PHOTO_PATH
    from PIL import Image  # 로컬 실행 환경 의존(스크립트 전용)

    Image.new("RGB", (300, 400), (180, 180, 190)).save(_TEST_PHOTO_PATH, "JPEG", quality=85)
    return _TEST_PHOTO_PATH


def upload_photo(driver) -> bool:
    """사진 직접 업로드(필수 필드, 서버가 storageUrl 검증 → 위조 불가).

    해독(5차): #UpPic '바로 업로드' = PhotoDirect() → iframe #__frmHelper(DirectPhotoUpload.aspx)에
    <input type=file id=UploadedPicture>. send_keys로 실제 이미지 주입(네이티브 다이얼로그 우회) →
    #UploadBtn '업로드' → 서버 저장 후 부모 EventDirectUpload(storageUrl,…) → PhotoRegist가
    실제 txtPhotoFileName/ext 세팅 + 팝업 자동 닫힘. 성공 시 True.
    """
    path = _ensure_test_photo()
    driver.switch_to.default_content()
    driver.execute_script("if(typeof PhotoDirect==='function'){ PhotoDirect(); }")
    try:
        WebDriverWait(driver, 15).until(lambda d: d.execute_script(
            "var f=document.getElementById('__frmHelper');"
            "return !!(f && /DirectPhotoUpload/.test(f.src||''));"
        ))
    except Exception:  # noqa: BLE001 — 사진 필드 없는 전형이면 팝업 미오픈
        driver.switch_to.default_content()
        return False
    try:
        driver.switch_to.frame("__frmHelper")
        inp = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "UploadedPicture"))
        )
        inp.send_keys(path)
        time.sleep(1.2)
        driver.execute_script(
            "var b=document.getElementById('UploadBtn');"
            "if(b){ b.click(); } else if(typeof __doPostBack==='function'){ __doPostBack('ButtonUpload',''); }"
        )
    finally:
        driver.switch_to.default_content()
    # PhotoRegist 완료(txtPhotoFileName 채워짐) 대기.
    for _ in range(24):
        time.sleep(0.5)
        fn = driver.execute_script(
            "var e=document.getElementById('txtPhotoFileName'); return e?e.value:'';"
        )
        if fn:
            return True
    return False


def _filefield_filled(driver, name: str) -> bool:
    """FILEFIELD(name) 컨테이너의 파일명 hidden(input[name$=Name])이 채워졌는지."""
    return bool(driver.execute_script(
        "var s=document.querySelector('[jwtype=FILEFIELD][name=\"'+arguments[0]+'\"]');"
        "if(!s) return false; var i=s.querySelector('input[name$=Name]'); return !!(i && i.value);",
        name,
    ))


def upload_documents(driver) -> int:
    """필수 서류 FILEFIELD를 실제 업로드(여권/외국인등록증 등). 업로드 성공 개수 반환.

    해독(5차): 트리거 btn{Name}Edit 클릭 → iframe #__frmHelper(JSFileUpload) <input type=file id=UploadedFile>.
    send_keys로 실제 파일 주입(다이얼로그 우회) → #UploadBtn '저장'(uploadFile()) → UploadEvent가
    컨테이너 파일명 hidden 세팅 + 팝업 닫힘. (사진과 동일 패턴, 위조 불가 — 서버가 파일 검증.)
    """
    path = _ensure_test_photo()  # 여권/등록증 accept=이미지 — 동일 JPEG 재사용
    driver.switch_to.default_content()
    names = driver.execute_script(
        "return Array.prototype.map.call(document.querySelectorAll('[jwtype=FILEFIELD]'),"
        "function(s){ return s.getAttribute('name'); }).filter(Boolean);"
    )
    done = 0
    for name in names:
        if _filefield_filled(driver, name):
            done += 1
            continue
        driver.switch_to.default_content()
        driver.execute_script(
            "var b=document.getElementById('btn'+arguments[0]+'Edit'); if(b){ b.click(); }", name
        )
        try:
            WebDriverWait(driver, 15).until(lambda d: d.execute_script(
                "var f=document.getElementById('__frmHelper');"
                "return !!(f && /JSFileUpload/.test(f.src||''));"
            ))
        except Exception:  # noqa: BLE001 — 트리거 없거나 팝업 미오픈
            driver.switch_to.default_content()
            continue
        try:
            driver.switch_to.frame("__frmHelper")
            inp = WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.ID, "UploadedFile"))
            )
            inp.send_keys(path)
            time.sleep(1.0)
            driver.execute_script(
                "if(typeof uploadFile==='function'){ uploadFile(); }"
                "else { var b=document.getElementById('UploadBtn'); if(b) b.click(); }"
            )
        finally:
            driver.switch_to.default_content()
        for _ in range(24):
            time.sleep(0.5)
            if _filefield_filled(driver, name):
                done += 1
                break
    return done


# ── check_apply_write (v2/B): 원서작성 폼 자동 채움 + 저장 검증루프 (해독 문서 기반) ──────────
# 전략: 진입 → 보이는 텍스트/라디오/select를 포맷 규칙대로 broad-fill + hidden SEARCHFIELD 코드/
# 업로드 hidden 직접 주입 → DoValidate()(저장) → 커스텀 검증 모달(div.layer_cont)이 첫 미충족 1건씩
# 표시 → 닫고 재채움/재저장 반복 → 모달이 더 안 뜨면(또는 성공 모달) 결제직전 도달로 판정.
# 1104069(외국인 중문 편입 worst-case) PoC. 다른 전형은 후속 확장.

# 보이는 입력 broad-fill — 포맷 규칙: 중문(txtC*)·날짜(Period)·외국인등록번호·연락처/이메일 등 분기.
_WONSEO_FILL_JS = r"""
function setVal(el, v){ if(!el) return; el.value=v;
  el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
// 1) 보이는 텍스트/textarea (빈 것만)
document.querySelectorAll('input[type=text],input[type=tel],input[type=number],input:not([type]),textarea').forEach(function(el){
  if(el.getClientRects().length===0) return; if(el.value) return; if(el.readOnly) return;  // SEARCHFIELD 표시는 readonly → 건드리면 검색팝업 → skip
  var id=el.id||''; var v='TEST';
  if(/^txtC/.test(id)) v='测试';
  else if(/Email/i.test(id)) v='test@test.com';
  else if(/Mobile|Tel/i.test(id)){ var _pw=el.closest('[jwtype=PHONEFIELD]');
    var _pv=((_pw&&_pw.getAttribute('data-phone-validate'))||'').toLowerCase();
    v=(_pv.indexOf('phone')>-1 && _pv.indexOf('mobile')<0) ? '0215881588' : '01012345678'; }  // 랜드라인 vs 휴대 구분
  else if(/Addr1/i.test(id)) v=/^txtC/.test(id)?'100000':'12345';
  else if(/Passport/i.test(id)) v='EM0000000';
  else if(/EMemSsn_1/.test(id)) v='050101';
  else if(/EMemSsn_2/.test(id)) v='6000000';
  else if(/GradutePeriodStart/.test(id)) v='201803';
  else if(/GradutePeriodEnd/.test(id)) v='202102';
  else if(/PeriodStart/.test(id)) v='20180302';
  else if(/PeriodEnd/.test(id)) v='20210228';
  else if(/Total/i.test(id)) v='12';
  else if(/Semester/i.test(id)) v='42';  // 마스크 "X학년 Y학기" → 2자리
  else if(/Year/i.test(id)) v='4';
  else if(/Web/i.test(id)) v='http://test.com';
  else if(/Fax/i.test(id)) v='021234567';
  else if(/Name$/.test(id)) v=/Nationality/.test(id)?'中国':(/^txtC/.test(id)?'测试':'TEST');
  setVal(el, v);
});
// 2) hidden SEARCHFIELD 코드 — 비어있지 않으면 통과(해독: 값 무관). 빈 것만 '1'.
['hdnUnivMajorCode','hdnUnivSubMajorCode','hdnMajor2Code','hdnUnivSubMajor2Code','hdnNationalityCode',
 'hdnNationality_EngCode','hdnNationality2Code','hdnExamNationalityCode','hdnSchoolNationalityCode',
 'hdnGraduteUnivCode','hdnGraduteUnivNationCode','hdnGraduteunivMajorCode','hdnHiGradeNameCode',
 'hdnGGradeNameCode','hdnEnterUnivCode','hdnEnterUnivMajorCode','hdnPrevUnivCode','hdnPrevUnivMajorCode',
 'hdnPrevUnivNationCode'].forEach(function(id){ var el=document.getElementById(id); if(el&&!el.value) el.value='1'; });
// 자동합산 총계(readonly) — 타깃 set.
var _tot=document.getElementById('txtTotal'); if(_tot && (!_tot.value||_tot.value==='0')){ _tot.value='12'; _tot.dispatchEvent(new Event('change',{bubbles:true})); }
// 3) 업로드 필드 — 가짜 hidden 주입 금지. 사진/서류 모두 서버가 실제 파일을 검증(위조 시 CommonError).
//    필요 시 upload_photo()/upload_documents()로 실제 업로드.
// 4) 라디오 — 필수 그룹 기본 선택(빈 그룹만)
['rdoSelTypeCodeE','rdoEMemSsnSelectN','rdoPersonalDataAgree11','rdoPersonalDataAgree21','rdoGraduteStatus2'].forEach(function(id){
  var el=document.getElementById(id); if(el&&!el.checked) el.click(); });
var g=document.querySelector('[id^=rdoGraduation]'); if(g&&!g.checked) g.click();
// 5) select 첫 실제 옵션(미선택만)
document.querySelectorAll('select').forEach(function(s){
  if((s.offsetParent||s.getClientRects().length) && s.selectedIndex<=0 && s.options.length>1){
    s.selectedIndex=1; s.dispatchEvent(new Event('change',{bubbles:true})); } });
"""


# 검증 피드백 채널 = 네이티브 alert() (해독 5차, DoValidate.toString 확인):
#   DoValidate() → window.JWValidate() → 첫 미충족 필드를 alert("…를 입력해 주세요.")로 표시 후 return.
#   사이트 자체 alert 래퍼가 #globalAlert를 그리지만, 자동화는 alert를 후킹해 메시지를 직접 캡처한다
#   (override로 삼키면 피드백 소실 = 기존 "DoValidate 불안정" 버그의 진짜 원인).
# 캡처 설치: window.alert가 window.__alertMsg에 마지막 메시지를 적재(삼키지 않고 보존), confirm=true.
_INSTALL_ALERT_CAPTURE_JS = r"""
window.__alertMsg = null;
// 이 사이트의 alert/confirm은 Promise(thenable) 반환식이고, 저장 경로 JX.ExecuteSaveEvents가
// confirm(...).then(t).catch(DoValidateExcept) / alert(...).finally(...)로 체이닝한다. override가
// boolean/undefined를 반환하면 체인이 깨져 저장이 중단(DoValidateExcept)되므로 thenable을 반환한다.
// (동기 thenable — .then/.catch/.finally 콜백을 즉시 실행해 저장 흐름을 진행. confirm은 자동 yes.)
function __thenable(resolveVal){
  var t={ then:function(f){ if(f) f(resolveVal); return t; },
          catch:function(){ return t; },
          finally:function(f){ if(f) f(); return t; } };
  return t;
}
window.alert = function(m){ window.__alertMsg = (m==null?'':String(m)); return __thenable(); };
window.confirm = function(){ return __thenable(true); };
"""


def _alert_text(driver):
    """캡처된 alert 메시지를 읽고 비운다(consume). 없으면 None.

    #globalAlert(사이트 alert 래퍼의 시각요소)도 폴백으로 함께 확인.
    """
    try:
        msg = driver.execute_script(
            "var m=window.__alertMsg; window.__alertMsg=null; return m;"
        )
        if msg:
            return msg
    except Exception:  # noqa: BLE001
        pass
    try:
        return driver.execute_script(
            "var g=document.getElementById('globalAlert');"
            "if(g){ var st=getComputedStyle(g);"
            "  if(st.display!=='none' && st.visibility!=='hidden'){"
            "    var t=(g.innerText||'').replace(/확인/g,'').trim(); if(t) return t; } }"
            "return null;"
        )
    except Exception:  # noqa: BLE001
        return None


# 검증 모달이 지목한 필드를 placeholder/label 매칭으로 찾아 force-fill(readonly/숨김 무시).
# broad-fill이 놓치는 hidden/readonly/조건부 필드를 모달 메시지 기반으로 수렴시키는 일반 메커니즘.
_FORCE_FILL_JS = r"""
function val(el){ var id=el.id||'';
  if(/^txtC/.test(id)) return '测试';
  if(/Email/i.test(id)) return 'test@test.com';
  if(/Mobile|Tel/i.test(id)) return '01012345678';
  if(/Gradute.*Period/i.test(id)) return '202002';
  if(/Period/i.test(id)) return '20200302';
  if(/Total/i.test(id)) return '12';
  if(/Semester/i.test(id)) return '42';  // 마스크 "X학년 Y학기" → 2자리(4학년 2학기)
  if(/Year/i.test(id)) return '4';
  if(/Passport/i.test(id)) return 'EM0000000';
  if(/Addr1/i.test(id)) return /^txtC/.test(id)?'100000':'12345';
  return 'TEST'; }
// jw 프레임워크: 필수 필드 컨테이너 <span jwtype korname searchid requiredalert="…주세요.">에 메타 보존.
// requiredalert == alert 메시지(정확 일치) → fuzzy 라벨 매칭(엉뚱한 그룹 선택 버그) 제거.
var raw=(arguments[0]||'').trim();
var field=null;
try{ field=document.querySelector('[requiredalert="'+raw.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"]'); }catch(e){}
if(!field){ var cs=document.querySelectorAll('[korname]');
  for(var i=0;i<cs.length;i++){ var kn=cs[i].getAttribute('korname')||''; if(kn && raw.indexOf(kn)>=0){ field=cs[i]; break; } } }
if(!field) return null;
var jt=(field.getAttribute('jwtype')||'').toUpperCase();
var sid=field.getAttribute('searchid')||'';
if(jt==='SEARCHFIELD' || sid) return 'SEARCH:'+sid;  // 파이썬이 select_search_result 호출
function fire(el){ el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); }
// ADDRESSFIELD: 우편번호 검색 팝업 대신 JX(name).Set(...)로 RoadData 세팅(해독):
//   저장 핸들러 ADDRESS.text()가 this.RoadData(null)에 ROADJUSOETC를 쓰다 크래시하던 원인 해소.
if(jt==='ADDRESSFIELD'){
  var an=field.getAttribute('name')||'';
  try{ if(window.JX && an){ JX(an).Set({BASEAREA:'06236',ROADJUSO:'서울특별시 테헤란로 1',
    OLDJUSO1:'서울특별시 역삼동 1',ROADJUSOETC:'101',REGION:'서울'}); } }catch(e){}
  var det=field.querySelector("input[id$='RoadJusoEtc'],input[name$='RoadJusoEtc']");
  if(det){ det.removeAttribute('readonly'); det.value='101'; fire(det); det.dispatchEvent(new Event('blur',{bubbles:true})); }
  return an+' = JX.Set(addr)+detail';
}
// 값-role(PHONE/EMAIL/DATE): 값 결정은 파이썬 field_roles.role_value(단일 소스·단위테스트).
// JS는 대상 input과 jwtype·data-* 신호만 넘기고, 파이썬이 값을 계산해 _SET_VALUE_JS로 주입한다.
if(jt==='PHONEFIELD'||jt==='EMAILFIELD'||jt==='DATEFIELD'){
  var vin=field.querySelector('input[type=text],input[inputmode=numeric],input:not([type=hidden])');
  if(vin){ return 'ROLE:'+JSON.stringify({id:vin.id||vin.name, jwtype:jt,
    attrs:{'data-phone-validate':field.getAttribute('data-phone-validate')||'',
           'maxlength':vin.getAttribute('maxlength')||''}}); }
}
var radios=field.querySelectorAll('input[type=radio]');
if(radios.length){ var pick=null;
  for(var i=0;i<radios.length;i++){ if(/^(1|Y)$/i.test(radios[i].value)){ pick=radios[i]; break; } }
  pick=pick||radios[0]; pick.checked=true; try{ pick.click(); }catch(e){} fire(pick);
  return (pick.id||pick.name||'radio')+' = checked('+pick.value+')'; }
var checks=field.querySelectorAll('input[type=checkbox]');
// 체크박스는 click이 토글이므로 checked=true 후 click하면 도로 해제된다(반복 원인).
// click 먼저(자연 체크 + onclick 핸들러) → 그래도 미체크면 force → fire.
if(checks.length){ var n=0; checks.forEach(function(c){ if(!c.checked){ try{c.click()}catch(e){} if(!c.checked) c.checked=true; fire(c); n++; } }); return 'checkbox x'+n; }
var sel=field.querySelector('select');
if(sel){ if(sel.options.length>1) sel.selectedIndex=1; fire(sel); return (sel.id||'select')+' = idx1'; }
var txt=field.querySelector('input[type=text],input[type=tel],input[type=number],input:not([type]),textarea,input[type=hidden]');
if(txt){ txt.removeAttribute('readonly'); txt.value=val(txt); fire(txt); return (txt.id||txt.name||'text')+' = '+txt.value; }
return null;
"""


# 값-role 주입: id/name으로 input을 찾아 값 세팅 + input/change/blur(PhoneFnc 재포맷·검증).
_SET_VALUE_JS = r"""
var el=document.getElementById(arguments[0]) || (document.getElementsByName(arguments[0])[0]);
if(!el) return false;
el.removeAttribute('readonly'); el.value=arguments[1];
el.dispatchEvent(new Event('input',{bubbles:true}));
el.dispatchEvent(new Event('change',{bubbles:true}));
el.dispatchEvent(new Event('blur',{bubbles:true}));
return true;
"""


def _force_fill_for_message(driver, msg):
    """검증 모달 메시지가 지목한 필드를 찾아 force-fill. 매칭 안 되면 None.

    값-role(ROLE: 마커)은 field_roles.role_value로 값을 결정 후 주입(구조 role은 JS 내부 처리).
    """
    try:
        r = driver.execute_script(_FORCE_FILL_JS, msg)
    except Exception:  # noqa: BLE001
        return None
    if isinstance(r, str) and r.startswith("ROLE:"):
        try:
            desc = json.loads(r[len("ROLE:"):])
        except Exception:  # noqa: BLE001
            return None
        v = role_value(desc.get("jwtype", ""), desc.get("attrs") or {})
        if v is None:
            return None
        fid = desc.get("id") or ""
        try:
            ok = driver.execute_script(_SET_VALUE_JS, fid, v)
        except Exception:  # noqa: BLE001
            return None
        return f"{fid} = {v} (role={desc.get('jwtype')})" if ok else None
    return r


# SEARCHFIELD 검색팝업에서 결과 선택 (디스커버리 확정):
#   트리거 a#btn{searchid} 클릭 → #SearchLayer_Pop 오픈 → input에 검색어 → a.btn_search 클릭 →
#   결과 <ul><li>(첫 li는 안내) → 데이터 li(cursor:pointer, <a><span.title>) 클릭(jQuery) → 코드/이름 세팅 + 팝업 닫힘.
def _popup_open(driver) -> bool:
    return bool(driver.execute_script(
        "var p=document.getElementById('SearchLayer_Pop'); return !!(p && getComputedStyle(p).display!=='none');"
    ))


def _resolve_open_popup(driver) -> str:
    """이미 열린 #SearchLayer_Pop을 해소 — 여러 검색어를 시도해 첫 데이터 결과를 클릭(코드/이름 세팅).

    반환: 선택된 결과 텍스트(성공) 또는 ''(실패). 외국인 중문 폼이라 중문/한글/광역 쿼리를 폭넓게 시도.
    """
    if not _popup_open(driver):
        return ""
    for q in ("중국", "中", "大学", "大", "学", "서울", "a", "A"):
        clicked_text = driver.execute_script(
            r"""
            var q=arguments[0]; var p=document.getElementById('SearchLayer_Pop');
            var inp=Array.prototype.slice.call(p.querySelectorAll('input[type=text]'))
              .find(function(e){return getComputedStyle(e).display!=='none';});
            if(inp){ inp.value=q; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('keyup',{bubbles:true})); }
            var b=Array.prototype.slice.call(p.querySelectorAll('a.btn_search')).find(function(x){return /검색/.test(x.innerText||'');});
            if(b) b.click();
            return true;
            """,
            q,
        )
        time.sleep(1.4)
        picked = driver.execute_script(
            r"""
            var p=document.getElementById('SearchLayer_Pop');
            var lis=Array.prototype.slice.call(p.querySelectorAll('li'))
              .filter(function(x){ return x.querySelector('a') && (x.style.cursor==='pointer' || x.querySelector('a span.title')); });
            if(lis.length){ var t=(lis[0].innerText||'').replace(/\s+/g,' ').trim(); lis[0].click(); return t; }
            return '';
            """
        )
        if picked:
            time.sleep(0.6)
            return picked[:40]
        if not _popup_open(driver):
            return "(닫힘)"
    return ""


def select_search_result(driver, searchid: str, query: str) -> str:
    """특정 searchfield(트리거 a#btn{searchid})를 열어 query로 검색 후 첫 결과 선택."""
    driver.execute_script("var b=document.getElementById('btn'+arguments[0]); if(b) b.click();", searchid)
    time.sleep(1.2)
    if not _popup_open(driver):
        return ""
    return _resolve_open_popup(driver)


def _close_search_popup(driver) -> None:
    """SEARCHFIELD 검색 팝업(#SearchLayer_Pop, .layer.search1)을 닫기(a.close '닫기'). ESC 안 먹음."""
    driver.execute_script(
        "var p=document.getElementById('SearchLayer_Pop');"
        "var roots=p?[p]:Array.prototype.slice.call(document.querySelectorAll('.layer.search1, .layer.search'));"
        "roots.forEach(function(r){ if(getComputedStyle(r).display==='none') return;"
        "  r.querySelectorAll('a.close, a.btn_close, button.close, a').forEach(function(b){"
        "    var t=(b.innerText||''); var cls=(b.className||'').toString();"
        "    if(/닫기|关闭/.test(t) || cls.indexOf('close')>=0){ try{b.click()}catch(e){} } }); });"
    )


def _close_modal(driver) -> None:
    """검증 모달(#globalAlert)의 확인 버튼 클릭(페이지 이탈 방지) + 검색 팝업도 닫기."""
    driver.execute_script(
        "var box = document.getElementById('globalAlert');"
        "if(box){ box.querySelectorAll('a,button,input[type=button]').forEach(function(b){"
        "  var t=(b.innerText||b.value||''); if(/확인|确认|OK/i.test(t)){ try{b.click()}catch(e){} } }); }"
    )
    _close_search_popup(driver)


def check_apply_write(driver, ctx):
    """원서작성 폼 자동 완주(결제직전 또는 ENTERTEST_PAY 시 접수완료까지). 1104069 PoC.

    계정 대역 자동 순환: ENTERTEST_ACCOUNT가 범위(jt29001~jt29005)면 펼쳐서, 접수완료로 소진(진입 차단)되지
    않은 첫 계정을 자동 선택한다. PAY 모드는 실행마다 1계정 소진 → 다음 실행 시 다음 계정으로 순환(등록 개수만큼).
    결제직전(기본)은 계정 재사용 가능(삭제→재생성)이라 보통 첫 계정만 쓴다.
    """
    global ACCOUNT
    sid = service_id_of(TARGET_URL)
    accounts = expand_accounts(ACCOUNT_SPEC) or ([ACCOUNT] if ACCOUNT else [])
    print(f"[apply] 계정 대역: {len(accounts)}개 {accounts}")
    chosen, idx = None, -1
    for idx, acc in enumerate(accounts):
        ACCOUNT = acc  # 전역 갱신 — login/delete(passwd)/이후 단계가 이 계정 사용
        login(driver, acc)
        # 기존 미접수 원서 삭제 — 깨끗한 신규 작성 경로로(편집 모드 trivial-pass 방지, 반복 안정).
        n_del = delete_unpaid_applications(driver)
        try:
            enter_wonseo(driver, sid)
        except RuntimeError as e:
            # 접수완료로 진입 차단된 계정 → 다음 계정으로 순환.
            print(f"[apply] {acc} 진입 불가({n_del}건 삭제) — {str(e)[:50]}… 다음 계정 시도")
            continue
        chosen = acc
        print(f"[apply] 사용 계정: {acc} (대역 {len(accounts)}개 중 {idx+1}번째, 미접수 삭제 {n_del}건)")
        break
    if not chosen:
        return ("fail", f"대역 {len(accounts)}개 전부 소진(접수완료/차단) — 사용 가능 계정 없음")
    print(f"[apply] 진입 완료 - {driver.current_url}")
    # 업로드 전 broad-fill 선행(중요): 라디오/select 클릭이 조건부 섹션을 재렌더하며 업로드 hidden을
    # 리셋한다. 먼저 채워 렌더를 안정화하면 이후 broad-fill은 멱등(이미 채워짐→무동작)이라 업로드가
    # 보존된다. (검증됨: 선행 안 하면 hdnUploadFileName이 broad-fill마다 비워짐.)
    for _ in range(2):
        _close_search_popup(driver)
        driver.execute_script(_WONSEO_FILL_JS)
        time.sleep(0.4)
        _close_search_popup(driver)
    # 사진/서류는 필수이고 서버가 실제 파일을 검증(위조 시 CommonError) → 실제 업로드.
    photo_ok = upload_photo(driver)
    print(f"[apply] 사진 업로드: {'OK' if photo_ok else '미수행(필드 없음/실패)'}")
    doc_n = upload_documents(driver)
    print(f"[apply] 서류 업로드: {doc_n}건")
    last = None
    saved = False
    valid_i = 0
    for i in range(15):
        _close_search_popup(driver)  # 이전 회차에 열린 검색팝업이 검증을 막지 않도록
        driver.execute_script(_WONSEO_FILL_JS)
        time.sleep(0.4)
        _close_search_popup(driver)  # 채움 중 열렸을 수 있는 검색팝업 닫기
        # JWValidate()로 검증 상태 확인 — 첫 미충족 1건을 alert로 표시(캡처). 통과 시에만 저장(DoValidate).
        # (DoValidate를 직접 돌리지 않아 "파일 업로드 완료" 등 비검증 alert 노이즈를 피한다.)
        is_valid = driver.execute_script(
            _INSTALL_ALERT_CAPTURE_JS
            + "return (typeof JWValidate==='function') ? !!JWValidate() : null;"
        )
        m = _alert_text(driver)
        print(f"[apply] {i+1}회 — JWValidate={is_valid} 메시지: {(m or '없음')[:110].replace(chr(10),' ')}")
        if is_valid:
            # 모든 클라 검증 통과 → 저장(thenable alert/confirm으로 ExecuteSaveEvents 체인 진행).
            valid_i = i + 1
            driver.execute_script(
                _INSTALL_ALERT_CAPTURE_JS
                + "if(typeof DoValidate==='function'){ DoValidate(); }"
            )
            time.sleep(3)  # 저장 POST/네비게이션 settle
            for _ in range(8):
                if "/Wonseo/" not in driver.current_url:
                    break
                time.sleep(0.5)
            saved = True
            break
        if not m:
            # 검증 false인데 메시지 없음 → SEARCHFIELD 검색팝업이 떠 있을 수 있음 → 결과 선택으로 해소.
            if _popup_open(driver):
                picked = _resolve_open_popup(driver)
                print(f"[apply]   ↳ 검색결과 선택: {picked or '실패'}")
                last = f"검색팝업 해소: {picked or '결과없음'}"
            else:
                print("[apply]   (검증 false·메시지/팝업 없음 — 계속)")
            time.sleep(0.4)
            continue
        last = m.replace("\n", " ")[:200]
        # 검증이 지목한 필드를 force-fill (broad-fill이 놓친 hidden/readonly/조건부 필드 수렴).
        matched = _force_fill_for_message(driver, m)
        if matched and matched.startswith("SEARCH:"):
            # SEARCHFIELD → 검색팝업을 열어 결과 선택(코드/이름 세팅). searchid 미상이면 광역 해소.
            searchid = matched[len("SEARCH:"):]
            picked = select_search_result(driver, searchid, "") if searchid else ""
            if not picked and _popup_open(driver):
                picked = _resolve_open_popup(driver)
            print(f"[apply]   ↳ search[{searchid}]: {picked or '실패'}")
        else:
            print(f"[apply]   ↳ force-fill: {matched}")
        _close_modal(driver)
        time.sleep(0.5)

    # 결제목록(권위)으로 최종 판정 — URL 변화/신규·편집 모드 무관. '결제하기' 버튼 존재 = 결제직전 도달.
    driver.get(f"{origin_of(TARGET_URL)}/Payment/UnivWritingList/{sid}")
    _body_ready(driver)
    import re as _re
    body = _re.sub(r"\s+", " ", driver.execute_script("return document.body.innerText||'';"))
    has_app = ("결제하기" in body) and ("작성한 원서가 없습니다" not in body)
    if not has_app:
        return ("fail", f"[{chosen}] 결제목록 비어있음 (마지막 검증 메시지: {last}, 저장시도={saved})")
    base_msg = f"[{chosen}] 결제직전 도달 — 결제목록에 원서 있음 (JWValidate 통과 {valid_i}회차, 저장={saved})"
    if not PAY:
        return ("pass", base_msg)
    # opt-in: 테스트 결제 → 접수완료까지.
    done, receipt = complete_payment(driver, sid)
    if done:
        return ("pass", f"[{chosen}] 접수완료 — 수험(접수)번호 {receipt} (테스트 결제, {base_msg})")
    return ("fail", f"[{chosen}] 결제직전 도달했으나 접수완료 실패 ({base_msg})")


def complete_payment(driver, sid: str):
    """전형료 결제(테스트 결제) → 접수완료. (done: bool, receipt: str|None) 반환.

    해독(5차): 결제목록 '결제하기' → /Payment/UnivPayBegin → 결제수단 화면의 '테스트 결제' 버튼
    (onclick=PayClick('btnPay','PayTest') = 테스트 사이트 전용 PG, 실과금 없음) → /Payment/PayConfirm
    "원서접수가 완료되었습니다" → /Payment/UnivPayResult 에 수험(접수)번호.
    ⚠️ 접수완료 시 같은 계정/학교 재작성 불가(계정 소진).
    """
    base = origin_of(TARGET_URL)
    driver.get(f"{base}/Payment/UnivWritingList/{sid}")
    _body_ready(driver)
    driver.execute_script(
        "var a=Array.prototype.find.call(document.querySelectorAll('a'),"
        "function(b){ return /결제하기/.test(b.innerText||''); }); if(a) a.click();"
    )
    try:
        WebDriverWait(driver, 15).until(
            lambda d: "/UnivPayBegin/" in d.current_url or "/PayConfirm/" in d.current_url
        )
    except Exception:  # noqa: BLE001
        return (False, None)
    driver.execute_script(_INSTALL_ALERT_CAPTURE_JS)
    driver.execute_script(
        "var a=Array.prototype.find.call(document.querySelectorAll('a,button,input'),"
        "function(b){ return /테스트 결제/.test(b.innerText||b.value||''); }); if(a) a.click();"
    )
    for _ in range(20):  # 접수완료 대기
        time.sleep(1)
        if "/PayConfirm/" in driver.current_url or "접수가 완료" in driver.page_source:
            break
    # 접수완료확인에서 수험(접수)번호 확보.
    driver.get(f"{base}/Payment/UnivPayResult/{sid}")
    _body_ready(driver)
    time.sleep(1)
    import re as _re
    body = _re.sub(r"\s+", " ", driver.execute_script("return document.body.innerText||'';"))
    m = _re.search(r"수험\(?접수\)?번호\s*([0-9A-Za-z]{8,})", body)
    receipt = m.group(1) if m else None
    done = ("접수원서" in body) and (receipt is not None)
    print(f"[apply] 접수완료확인 — 수험번호: {receipt or '미확인'}")
    return (done, receipt)


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


# 현재 페이지의 입력 필드/버튼을 구조화 추출 (ASP.NET WebForms raw HTML은 거대·노이즈가
# 커서, 작성 로직 설계엔 이 인벤토리가 훨씬 유용하다). 읽기 전용 — 클릭/제출 안 함.
_INVENTORY_JS = r"""
const vis = el => !!(el.offsetParent || el.getClientRects().length);
const labelFor = el => {
  if (el.id) { const l = document.querySelector('label[for="' + el.id + '"]'); if (l) return (l.innerText||'').trim(); }
  const p = el.closest('label'); if (p) return (p.innerText||'').trim();
  return '';
};
// 사이트가 필드에 선언한 '의미' 속성 — 범용 작성 엔진의 role 매핑 근거.
// jinhakapply(JWValidate)는 korname(한글 필드명)·requiredalert(검증 실패 메시지)·
// jwtype(SEARCHFIELD 등)·searchid 를 필드나 상위 래퍼에 붙인다. id 정규식 추측 대신 이걸 읽는다.
const SEM = ['korname','requiredalert','jwtype','searchid','searchtype','format','maxlength','onkeyup','onblur','onchange'];
const semOf = el => {
  const o = {};
  for (const a of el.attributes) {
    const n = a.name.toLowerCase();
    if (n.startsWith('jw') || n.startsWith('data-') || SEM.includes(n)) o[a.name] = (a.value||'').slice(0,120);
  }
  return o;
};
// 필드 자체에 jw/korname 이 없으면 상위 4단계까지 래퍼에서 찾는다(JWValidate 컨테이너 패턴).
const wrapSemOf = el => {
  let p = el.parentElement;
  for (let i=0; i<4 && p; i++, p=p.parentElement) {
    if (p.getAttribute && (p.getAttribute('jwtype')||p.getAttribute('korname')||p.getAttribute('requiredalert'))) {
      const o = {}; for (const a of p.attributes){ const n=a.name.toLowerCase(); if(n.startsWith('jw')||SEM.includes(n)) o[a.name]=(a.value||'').slice(0,120); }
      return o;
    }
  }
  return {};
};
const fields = [...document.querySelectorAll('input,select,textarea')].map(el => {
  const o = {
    tag: el.tagName.toLowerCase(),
    type: (el.getAttribute('type')||'').toLowerCase(),
    id: el.id||'', name: el.name||'',
    label: labelFor(el),
    required: !!(el.required || el.getAttribute('aria-required')==='true'),
    placeholder: el.placeholder||'',
    maxlength: el.getAttribute('maxlength')||'',
    readonly: el.hasAttribute('readonly'),
    disabled: !!el.disabled,
    cls: (el.className||'').slice(0,120),
    visible: vis(el),
    attrs: semOf(el),
    wrap: wrapSemOf(el),
  };
  if (o.tag === 'select') o.options = [...el.options].map(x => ({v:x.value, t:(x.text||'').trim()}));
  return o;
});
const buttons = [...document.querySelectorAll('button,a,input[type=button],input[type=submit],input[type=image]')]
  .filter(vis)
  .map(el => ({
    tag: el.tagName.toLowerCase(),
    type: (el.getAttribute('type')||'').toLowerCase(),
    id: el.id||'', name: el.name||'',
    text: ((el.innerText||el.value||el.getAttribute('alt')||'')).trim().slice(0,40),
    onclick: (el.getAttribute('onclick')||'').slice(0,160),
    href: (el.getAttribute('href')||'').slice(0,160),
  }))
  .filter(b => b.text || b.onclick || b.href);
return {url: location.href, title: document.title, fields, buttons};
"""


def _inventory(driver, out: str, name: str) -> None:
    """현재 페이지 필드/버튼 인벤토리를 {name}.fields.json 으로 저장 (실패해도 흐름 무중단)."""
    try:
        data = driver.execute_script(_INVENTORY_JS)
        with open(os.path.join(out, f"{name}.fields.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        fields = data.get("fields", [])
        nf = len(fields)
        nb = len(data.get("buttons", []))
        # 의미 속성(korname/requiredalert/jwtype)을 필드 또는 래퍼에 가진 필드 수 — role 매핑 신호.
        sem = sum(
            1
            for x in fields
            if any(k in (x.get("attrs") or {}) for k in ("korname", "requiredalert", "jwtype"))
            or any(k in (x.get("wrap") or {}) for k in ("korname", "requiredalert", "jwtype"))
        )
        print(f"[discover] {name} 인벤토리 — 필드 {nf} (의미속성 {sem}) / 버튼 {nb}")
    except Exception as e:  # noqa: BLE001 — 인벤토리 추출 실패는 디스커버리 흐름을 막지 않는다
        print(f"[discover] {name} 인벤토리 추출 실패: {e}")


def _snapshot(driver, out: str, name: str) -> None:
    with open(os.path.join(out, f"{name}.html"), "w", encoding="utf-8") as f:
        f.write(driver.page_source)
    driver.save_screenshot(os.path.join(out, f"{name}.png"))
    _inventory(driver, out, name)
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
        # 원서작성 폼(Wonseo) 진입 + 인벤토리 — v2 check_apply_write 설계 입력.
        # 진입 자체가 check_apply_write 1단계 검증이기도 하다.
        try:
            enter_wonseo(driver, sid)
            time.sleep(2)
            _snapshot(driver, out, "06_wonseo")
        except Exception as e:  # noqa: BLE001
            driver.switch_to.default_content()
            print(f"[discover] Wonseo 진입/캡처 실패(진입 시퀀스 재확인 필요): {e}")
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
    elif APPLY_WRITE:
        if not (TARGET_URL and ACCOUNT):
            print("[error] APPLY_WRITE: ENTERTEST_TARGET_URL/ACCOUNT 필요")
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
        if APPLY_WRITE:
            import traceback
            try:
                status, message = check_apply_write(driver, {})
            except RuntimeError as e:  # 진입 차단 등 예상된 실패는 메시지만(트레이스백 불필요)
                status, message = "fail", str(e)
            except Exception:  # noqa: BLE001
                traceback.print_exc()
                status, message = "fail", "예외 — 위 트레이스백 참조"
            print(json.dumps({"apply_write": {"status": status, "message": message}}, ensure_ascii=False, indent=2))
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
