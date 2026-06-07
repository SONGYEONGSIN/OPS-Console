# SmileEDI 세금계산서 스크래핑 프로그램

SmileEDI 웹사이트에서 세금계산서 정보를 자동으로 스크래핑하고, SharePoint에 업로드하며, 조건에 따라 메일을 발송하는 자동화 프로그램입니다.

## 🚀 주요 기능

### 📊 스크래핑 기능
- **자동 로그인**: SmileEDI 사이트 팝업 로그인 자동 처리
- **매출계산서 검색**: 지정된 날짜 범위로 세금계산서 자동 검색
- **Excel 다운로드**: 검색 결과를 Excel 파일로 자동 다운로드
- **헤드리스 모드**: 백그라운드에서 브라우저 없이 실행 가능

### 📁 SharePoint 연동
- **자동 업로드**: 다운로드한 Excel 파일을 SharePoint에 자동 업로드
- **파일 암호 해독**: 암호화된 Excel 파일 자동 해독 후 업로드
- **중복 처리**: 기존 파일이 있을 경우 스마트한 병합/업데이트
- **잠금 파일 처리**: 파일이 사용 중일 때 대안 방법 제공

### 📧 메일 발송 기능
- **조건부 메일 발송**: 특정 조건을 만족하는 데이터에 대해 자동 메일 발송
- **담당자 자동 배정**: 회사별 담당자 자동 매칭
- **HTML 메일**: 표 형태의 보기 좋은 메일 템플릿
- **Excel 첨부**: 필터링된 데이터를 Excel 파일로 첨부

### 🔧 시스템 기능
- **환경 설정 분리**: 로그인, SharePoint, 메일 설정 파일 분리
- **에러 처리**: 각 단계별 상세한 에러 처리 및 로깅
- **재시도 로직**: 네트워크 오류 시 자동 재시도
- **데이터 보존**: 기존 데이터 형식 및 구조 완벽 보존

## 📋 설치 방법

### 1. 자동 패키지 설치
```bash
# 필수 패키지 자동 설치
python install_packages.py
```

### 2. 수동 패키지 설치
```bash
# requirements.txt로 설치
pip install -r requirements.txt

# 개별 패키지 설치
pip install selenium>=4.15.0
pip install python-dotenv>=1.0.0
pip install webdriver-manager>=4.0.0
pip install pandas
pip install openpyxl
pip install requests
pip install msal
pip install msoffcrypto-tool  # 암호화된 Excel 파일 처리용
```

### 3. Chrome 브라우저
- Chrome 브라우저가 설치되어 있어야 합니다
- ChromeDriver는 webdriver-manager가 자동으로 관리합니다

## ⚙️ 환경 설정

### 1. SmileEDI 로그인 설정 (`smileedi_config.env`)
```env
# SmileEDI 로그인 정보
SMILEEDI_USERNAME=your_username
SMILEEDI_PASSWORD=your_password

# 검색 설정
SEARCH_START_DATE=2024-01-01
SEARCH_END_DATE=2024-12-31

# Excel 파일 암호
EXCEL_PASSWORD=your_excel_password

# 브라우저 설정
HEADLESS_MODE=true
WAIT_TIME_MIN=3
WAIT_TIME_MAX=5
```

### 2. SharePoint 설정 (`sharepoint_config.env`)
```env
# Microsoft Graph API 설정
TENANT_ID=your_tenant_id
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
SHAREPOINT_SITE_ID=your_site_id
SHAREPOINT_DRIVE_ID=your_drive_id

# 업로드 설정
UPLOAD_FOLDER_PATH=/path/to/upload/folder
```

### 3. 메일 발송 설정 (`smileedi_mail_config.env`)
```env
# SMTP 설정
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password

# 메일 설정
FROM_EMAIL=your_email@gmail.com
FROM_NAME=자동화시스템

# 담당자 설정 (회사별)
MANAGER_COMPANY_1=회사명1
MANAGER_EMAIL_1=manager1@company.com
MANAGER_COMPANY_2=회사명2
MANAGER_EMAIL_2=manager2@company.com
```

## 🎯 사용 방법

### 기본 실행
```bash
python Tax_invoice.py
```

### 프로그램에서 헤드리스 모드 변경
```python
# Tax_invoice.py에서 헤드리스 모드 설정
scraper = SmileEDIScraper(headless=True)   # 백그라운드 실행
scraper = SmileEDIScraper(headless=False)  # 브라우저 창 보기
```

## 📝 프로그램 구조

### 주요 클래스
- `SmileEDIScraper`: 메인 스크래핑 및 처리 클래스

### 핵심 메서드
#### 🌐 스크래핑 관련
- `scrape_tax_invoices()`: 메인 스크래핑 함수
- `setup_driver()`: Chrome 드라이버 설정
- `handle_login_popup()`: 로그인 처리
- `setup_search_conditions()`: 검색 조건 설정
- `download_excel_file()`: Excel 파일 다운로드

#### 📁 SharePoint 관련
- `upload_file_to_sharepoint()`: SharePoint 파일 업로드
- `decrypt_excel_file()`: 암호화된 Excel 파일 해독
- `find_existing_files_by_pattern()`: 기존 파일 검색
- `smart_update_existing_file()`: 스마트 파일 업데이트

#### 📧 메일 관련
- `analyze_sharepoint_excel_file()`: Excel 파일 분석
- `send_notification_email()`: 알림 메일 발송
- `filter_data_by_conditions()`: 메일 발송 조건 필터링

## 🔍 프로그램 실행 흐름

1. **환경 설정 로드** → SmileEDI 로그인 정보, SharePoint 설정, 메일 설정
2. **SmileEDI 로그인** → 자동 로그인 및 세션 유지
3. **매출계산서 페이지 이동** → 지정된 페이지로 자동 이동
4. **검색 조건 설정** → 날짜 범위 및 검색 조건 설정
5. **검색 실행** → 세금계산서 데이터 검색
6. **Excel 다운로드** → 검색 결과를 Excel 파일로 다운로드
7. **파일 암호 해독** → 암호화된 파일인 경우 자동 해독
8. **SharePoint 업로드** → 해독된 파일을 SharePoint에 업로드
9. **데이터 분석** → 업로드된 파일에서 메일 발송 조건 확인
10. **메일 발송** → 조건에 맞는 데이터에 대해 담당자에게 메일 발송
11. **상태 업데이트** → SharePoint 파일의 이메일오류 컬럼 업데이트

## 📊 메일 발송 조건

다음 조건 **모두 만족** 시 메일 발송:
1. **거래처명이 공백이 아님**
2. **공급가액이 0이 아님**
3. **이메일오류 상태가 'Y'가 아님**
4. **승인번호가 공백이 아님**

## 🔧 SharePoint 파일 처리 방식

### 파일 업로드 우선순위
1. **기존 파일 없음** → 새 파일 업로드
2. **기존 파일 있음** → 내용 비교 후 병합 업데이트
3. **파일 잠금됨** → 타임스탬프 포함 새 파일명으로 업로드
4. **업데이트 실패** → 백업 생성 후 대체

### 데이터 보존 정책
- **기존 이메일오류='Y' 데이터 보존**
- **원본 Excel 구조 유지** (1,2,3행 헤더 포함)
- **데이터 타입 보존** (문자열 형태 유지)

## ⚠️ 알려진 이슈 및 해결 방법

### 1. msoffcrypto 모듈 오류
```bash
# 오류 메시지
[WARN] msoffcrypto 모듈이 없어 암호 해독을 할 수 없습니다.

# 해결 방법
pip install msoffcrypto-tool
```

### 2. SharePoint 파일 잠금 오류 (HTTP 423)
```
오류: The resource you are attempting to access is locked
원인: 다른 사용자가 파일을 편집 중이거나 Excel Online에서 열려있음
해결: 프로그램이 자동으로 타임스탬프 포함 새 파일명으로 업로드
```

### 3. 파일 업로드 실패 시 프로세스 중단
```
현재 동작: 업로드 실패 시 메일 발송 등 후속 프로세스 중단
영향: 스크래핑은 완료되지만 데이터 분석 및 메일 발송 불가
```

### 4. Chrome 드라이버 오류
```bash
# Chrome 브라우저 버전 확인
chrome://version/

# 드라이버 매니저 업데이트
pip install --upgrade webdriver-manager
```

### 5. 로그인 실패
- **로그인 정보 확인**: smileedi_config.env 파일의 사용자명/비밀번호
- **팝업 차단 해제**: 브라우저 팝업 차단 설정 확인
- **네트워크 연결**: 인터넷 연결 상태 확인

## 📁 파일 구조

```
SmileEdi/
├── Tax_invoice.py              # 메인 실행 파일
├── install_packages.py         # 패키지 설치 스크립트
├── requirements.txt            # 의존성 패키지 목록
├── smileedi_config.env         # SmileEDI 로그인 설정
├── sharepoint_config.env       # SharePoint API 설정 (별도 생성 필요)
├── smileedi_mail_config.env    # 메일 발송 설정
├── refresh_token.txt           # SharePoint 토큰 (자동 생성)
└── README.md                   # 본 문서
```

## 🔐 보안 고려사항

1. **환경 설정 파일 보안**: .env 파일에는 민감한 정보가 포함되므로 Git에 업로드하지 마세요
2. **API 권한**: SharePoint API는 최소 필요 권한만 부여하세요
3. **메일 인증**: Gmail 등 사용 시 앱 비밀번호를 사용하세요
4. **토큰 관리**: refresh_token.txt 파일도 보안에 주의하세요

## 📞 문제 해결 및 지원

### 로그 확인
- 프로그램 실행 중 상세한 로그가 출력됩니다
- `[FAIL]`, `[WARN]` 메시지를 확인하여 문제점을 파악하세요

### 일반적인 확인사항
1. **Chrome 브라우저 설치 상태**
2. **인터넷 연결 상태**
3. **모든 환경 설정 파일 존재 및 내용 확인**
4. **SharePoint 사이트 접근 권한**
5. **메일 서버 설정 및 인증 정보**

### 성공적인 실행 로그 예시
```
🚀 SmileEDI 세금계산서 스크래핑 프로그램
============================================================
[OK] 설정 파일 로드: smileedi_config.env
[OK] 메일 설정 파일 로드: smileedi_mail_config.env
[OK] Chrome 드라이버 초기화 완료
[OK] 로그인 성공!
[OK] 매출계산서 검색 조건 설정 완료
[OK] 검색 실행 완료
[OK] 엑셀 다운로드 처리 완료
[OK] 해독된 파일로 업로드: 역발행 세금계산서_decrypted.xlsx
[OK] SharePoint 업로드 성공: 역발행 세금계산서.xlsx
[OK] 메일 발송 완료: 3건
[OK] 이메일오류 상태 업데이트 완료
✅ 스크래핑이 성공적으로 완료되었습니다!
```

## 🎯 향후 개선 계획

1. **파일 업로드 실패 시에도 후속 프로세스 진행**
2. **SharePoint 파일 잠금 상황 자동 해결**
3. **더 정교한 에러 복구 메커니즘**
4. **실행 결과 대시보드 제공**
5. **스케줄링 기능 추가**