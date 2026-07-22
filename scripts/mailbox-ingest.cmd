@echo off
REM 메일함 ingest — 작업 스케줄러 진입점 (10분 간격).
REM InteractiveToken(로그인 사용자 세션)으로 실행해야 claude -p OAuth 구독을 사용할 수 있다.
REM Outlook 수집 + auto_draft 운영자 대상 claude -p 회신 초안 생성. 로그는 scripts\logs 일자별 적재
REM (초안 생성 실패도 stderr로 이 로그에 남으므로 관측 가능). 등록: register-ingest-task.ps1.
setlocal
set REPO=C:\Users\ys1114\ClaudeCode\Build\OPS-Console
cd /d "%REPO%"
if not exist "%REPO%\scripts\logs" mkdir "%REPO%\scripts\logs"
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a%%b%%c
"C:\Program Files\nodejs\node.exe" "%REPO%\scripts\mailbox-ingest.mjs" >> "%REPO%\scripts\logs\mailbox-ingest-%TODAY%.log" 2>&1
endlocal
