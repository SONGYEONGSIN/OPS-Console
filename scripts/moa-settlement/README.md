# Moa 정산 화면 알아내기

계산서 청구금액을 Moa 에서 가져오려면(설계 T3-b) 셋이 필요하다.

1. **정산요청내역 주소**
2. **다운로드 함수 이름**
3. **어느 컬럼이 청구금액인가**

셋 다 **화면을 봐야만** 알 수 있다. Cloudflare 가 데이터센터 IP 를 막고 로그인에 SMS
본인확인이 붙어 **회사 PC 밖에서는 열리지 않는다.** 기존 마감 스크래퍼의 셀렉터도
같은 이유로 라이브 디스커버리로 확정했다.

`discover.py` 는 **아무것도 가정하지 않는다.** 화면에 있는 것을 그대로 보고하고,
그 출력이 스크래퍼를 쓸 근거가 된다.

## 회사 PC 에서

레포 루트에서, `.env.local` 에 `MOA_USERNAME` / `MOA_PASSWORD` / `MAKE_SMS_CODE_URL` 이
있는 상태로:

```powershell
.\scripts\moa-settlement\run-discover.ps1
```

창이 뜨고 SMS 인증이 오면 그대로 두면 된다(마감 스크래퍼와 같은 흐름).

**메뉴가 링크로 안 잡히면** — 눌러야 뜨는 메뉴일 수 있다. 화면에서
`정산관리 > 정산요청내역` 을 직접 연 뒤 주소창을 복사해:

```powershell
$env:MOA_SETTLE_URL="https://moa.jinhakapply.com/..."
.\scripts\moa-settlement\run-discover.ps1
```

## 나온 출력을 어떻게 쓰나

그대로 붙여 주면 된다. 받는 쪽(`POST /api/invoice/amounts`)은 이미 배포돼 있고
실 요청으로 검증돼 있어, 긁는 쪽만 붙이면 끝난다.

설계: `docs/superpowers/specs/2026-08-24-invoice-issuance-design.md`
