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

RUN_ID = os.getenv("ENTERTEST_RUN_ID", "")
TARGET_URL = os.getenv("ENTERTEST_TARGET_URL", "")
# 대역(범위) "jt29001~jt29005"로 등록 가능 — 로그인은 범위 시작 계정 사용. ID=PW 동일.
ACCOUNT = os.getenv("ENTERTEST_ACCOUNT", "").split("~")[0].strip()
BASE = os.getenv("OPS_CONSOLE_BASE_URL", "").rstrip("/")
SECRET = os.getenv("CRON_SECRET", "")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
DISCOVER = os.getenv("ENTERTEST_DISCOVER", "").lower() == "true"
# CHECKS만 로컬에서 돌려보고 결과를 출력(인제스트 안 함) — 회사 PC 빠른 검증용.
CHECKS_ONLY = os.getenv("ENTERTEST_CHECKS_ONLY", "").lower() == "true"
# check_apply_write(원서작성 완주) 단독 실행 — 인제스트 안 함, 결과만 출력(개발/검증용).
APPLY_WRITE = os.getenv("ENTERTEST_APPLY_WRITE", "").lower() == "true"
BUCKET = "entertest-screenshots"


def make_driver():
    # entertest 게이트는 CF 챌린지("Just a moment")가 아니라 단순 브라우저(UA) 체크라
    # 실제 Chrome이면 plain Selenium으로 통과한다(검증됨). 기본은 plain.
    # CF 챌린지가 있는 사이트에 한해 ENTERTEST_USE_UC=true로 undetected-chromedriver를 시도한다.
    use_uc = os.getenv("ENTERTEST_USE_UC", "").lower() == "true"
    if use_uc and uc is not None:
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


def enter_wonseo(driver, sid: str) -> None:
    """원서작성 폼(Wonseo) 진입 — check_apply_write(v2)의 진입 단계.

    해독(docs/entertest-apply-automation.md): ApplyFirst → 실제 콘텐츠는 iframe #frmNotice
    (src=/Noti/{sid}/T) 안의 동의서. 동의 체크박스(c0=모두동의 + chkNotice*) 전체 체크 →
    버튼 onApply() → confirm("원서를 작성하시겠습니까?") 수락 → /Wonseo/{sid}/{N}/A
    (실제 폼, default content) 도달.
    """
    base = origin_of(TARGET_URL)
    driver.get(f"{base}/ApplyFirst/{sid}/A")
    # iframe 진입 필수 — 바깥 문서엔 nav/footer뿐, 동의서·폼은 #frmNotice 안.
    WebDriverWait(driver, 15).until(
        EC.frame_to_be_available_and_switch_to_it((By.ID, "frmNotice"))
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
  else if(/Mobile|Tel/i.test(id)) v='01012345678';
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
// 3) 업로드 우회 — hidden만 세팅(결제직전까지 파일 존재 검증 없음)
[['hdnUploadFileName','test.jpg'],['hdnUploadFileOrgFile','test.jpg'],['hdnUploadFileSize','12345'],['hdnUploadFileType','image/jpeg'],
 ['hdnUploadFile1Name','test.jpg'],['hdnUploadFile1OrgFile','test.jpg'],['hdnUploadFile1Size','12345'],['hdnUploadFile1Type','image/jpeg']
].forEach(function(p){ var el=document.getElementById(p[0]); if(el&&!el.value) el.value=p[1]; });
try{ if(typeof PhotoRegist==='function') PhotoRegist({storageUrl:'https://image.jinhakapply.com/test.jpg',FileName:'test',Ext:'jpg',Size:12345}); }catch(e){}
// 4) 라디오 — 필수 그룹 기본 선택(빈 그룹만)
['rdoSelTypeCodeE','rdoEMemSsnSelectN','rdoPersonalDataAgree11','rdoPersonalDataAgree21','rdoGraduteStatus2'].forEach(function(id){
  var el=document.getElementById(id); if(el&&!el.checked) el.click(); });
var g=document.querySelector('[id^=rdoGraduation]'); if(g&&!g.checked) g.click();
// 5) select 첫 실제 옵션(미선택만)
document.querySelectorAll('select').forEach(function(s){
  if((s.offsetParent||s.getClientRects().length) && s.selectedIndex<=0 && s.options.length>1){
    s.selectedIndex=1; s.dispatchEvent(new Event('change',{bubbles:true})); } });
"""


# 검증 모달 텍스트 — JS로 직접(애니메이션/표시 토글에 견고). #globalAlert(.layer attention) 우선.
# 검증 모달은 #globalAlert만 본다. (div.layer_cont/.layer.attention 류는 SEARCHFIELD 검색팝업
# #SearchLayer_Pop과 클래스가 겹쳐 "검색"을 오탐 → #globalAlert로 한정.)
# #globalAlert는 position:fixed + 0-size wrapper라 offsetParent/clientRects로는 '안 보임'으로 오판 →
# display/visibility + 텍스트 존재로만 판정.
_MODAL_JS = r"""
var g=document.getElementById('globalAlert');
if(g){ var st=getComputedStyle(g);
  if(st.display!=='none' && st.visibility!=='hidden'){
    var t=(g.innerText||'').replace(/확인/g,'').trim(); if(t) return t; } }
return null;
"""


def _modal_text(driver):
    """검증 모달 표시 텍스트(없으면 None). 1104069은 #globalAlert 사용."""
    try:
        return driver.execute_script(_MODAL_JS)
    except Exception:  # noqa: BLE001
        return None


# 검증 모달이 지목한 필드를 placeholder/label 매칭으로 찾아 force-fill(readonly/숨김 무시).
# broad-fill이 놓치는 hidden/readonly/조건부 필드를 모달 메시지 기반으로 수렴시키는 일반 메커니즘.
_FORCE_FILL_JS = r"""
var msg=(arguments[0]||'');
function norm(s){ return (s||'').replace(/[\s ]/g,'')
  .replace(/[를을]?(입력|선택|체크)해?\s*주세요\.?/g,'').replace(/[()（）]/g,'').trim(); }
var key=norm(msg); if(!key) return null;
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
var els=document.querySelectorAll('input,textarea,select');
for(var i=0;i<els.length;i++){ var el=els[i];
  if(el.type==='hidden') continue;
  var ph=norm(el.placeholder||''); var lab='';
  if(el.id){ var l=document.querySelector('label[for="'+el.id+'"]'); if(l) lab=norm(l.innerText||''); }
  var hit=(ph && (key.indexOf(ph)>=0||ph.indexOf(key)>=0)) || (lab && (key.indexOf(lab)>=0||lab.indexOf(key)>=0));
  if(hit){
    if(el.tagName.toLowerCase()==='select'){ if(el.options.length>1) el.selectedIndex=1; }
    else { el.removeAttribute('readonly'); el.value=val(el); }
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));
    return (el.id||el.name||'matched')+' = '+(el.value||'[select]');
  }
}
return null;
"""


def _force_fill_for_message(driver, msg):
    """검증 모달 메시지가 지목한 필드를 찾아 force-fill. 매칭 안 되면 None."""
    try:
        return driver.execute_script(_FORCE_FILL_JS, msg)
    except Exception:  # noqa: BLE001
        return None


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
    """원서작성 폼 자동 완주(결제직전까지). 1104069 PoC."""
    sid = service_id_of(TARGET_URL)
    # 자체적으로 로그인 보장 (CHECKS 시퀀스에선 check_login이 선행하지만, 단독 실행/안전 위해).
    if "/Login" in driver.current_url or "로그아웃" not in driver.page_source:
        login(driver, ACCOUNT)
    enter_wonseo(driver, sid)
    print(f"[apply] 진입 완료 - {driver.current_url}")
    driver.execute_script("window.confirm=function(){return true;}; window.alert=function(){};")
    last = None
    for i in range(15):
        _close_search_popup(driver)  # 이전 회차에 열린 검색팝업이 DoValidate를 막지 않도록
        driver.execute_script(_WONSEO_FILL_JS)
        time.sleep(0.4)
        _close_search_popup(driver)  # 채움 중 열렸을 수 있는 검색팝업 닫기
        driver.execute_script(
            "window.confirm=function(){return true;};"
            "if(typeof DoValidate==='function'){ DoValidate(); } else { console.log('no DoValidate'); }"
        )
        # 검증 모달은 애니메이션으로 늦게 뜰 수 있어 최대 5s 폴링.
        m = None
        for _ in range(10):
            time.sleep(0.5)
            m = _modal_text(driver)
            if m:
                break
        cur = driver.current_url
        print(f"[apply] {i+1}회 저장 — 모달: {(m or '없음')[:120].replace(chr(10),' ')}")
        if "/Wonseo/" not in cur:
            # 폼 이탈 = 저장/제출됨 → 결제직전(작성목록) 도달 확인.
            driver.get(f"{origin_of(TARGET_URL)}/Payment/UnivWritingList/{sid}")
            _body_ready(driver)
            ok = "없습니다" not in driver.page_source
            return ("pass" if ok else "fail",
                    f"저장 후 결제목록 {'원서 있음(결제직전 도달)' if ok else '비어있음'} ({i+1}회 시도)")
        if not m:
            # /Wonseo 잔류 + #globalAlert 없음 → SEARCHFIELD 검증이 검색팝업을 띄운 경우가 흔하다
            # (hidden 코드만으로 통과 안 되는 필드 → 검색 결과 선택 필요. 다음 단계 작업).
            sp = driver.execute_script(
                "var p=document.getElementById('SearchLayer_Pop');"
                "return p && getComputedStyle(p).display!=='none';"
            )
            if sp:
                last = "SEARCHFIELD 검색팝업 대기 — 결과 자동선택 필요(미구현)"
            print(f"[apply]   (#globalAlert 없음 — 검색팝업={bool(sp)})")
            time.sleep(0.5)
            continue
        if any(k in m for k in ("저장되었습니다", "저장 완료", "작성되었습니다", "성공", "접수")):
            return ("pass", f"저장 성공 모달 확인 ({i+1}회): {m[:80]}")
        last = m.replace("\n", " ")[:200]
        # 모달이 지목한 필드를 force-fill (broad-fill이 놓친 hidden/readonly/조건부 필드 수렴).
        matched = _force_fill_for_message(driver, m)
        print(f"[apply]   ↳ force-fill: {matched}")
        _close_modal(driver)
        time.sleep(0.5)
    return ("fail", f"저장 검증 루프 미통과(15회). 마지막 모달: {last}")


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
const fields = [...document.querySelectorAll('input,select,textarea')].map(el => {
  const o = {
    tag: el.tagName.toLowerCase(),
    type: (el.getAttribute('type')||'').toLowerCase(),
    id: el.id||'', name: el.name||'',
    label: labelFor(el),
    required: !!(el.required || el.getAttribute('aria-required')==='true'),
    placeholder: el.placeholder||'',
    visible: vis(el),
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
        nf = len(data.get("fields", []))
        nb = len(data.get("buttons", []))
        print(f"[discover] {name} 인벤토리 — 필드 {nf} / 버튼 {nb}")
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
