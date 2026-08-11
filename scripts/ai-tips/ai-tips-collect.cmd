@echo off
REM AI TIP 후보 수집 — 작업 스케줄러 진입점 (매주 월 09:00).
REM InteractiveToken(로그인 사용자 세션)으로 실행해야 claude -p OAuth 구독으로 초안을 생성한다.
REM GitHub 검색 -> README -> claude -p 초안 -> 서버 적재. claude 실패 시 리포 정보만 적재.
REM 로그는 scripts\logs 일자별 적재. 등록: register-ai-tips-collect-task.ps1.
setlocal
set REPO=C:\Users\ys1114\ClaudeCode\Build\OPS-Console
cd /d "%REPO%"
if not exist "%REPO%\scripts\logs" mkdir "%REPO%\scripts\logs"
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a%%b%%c
"C:\Program Files\nodejs\node.exe" "%REPO%\scripts\ai-tips\collect-local.mjs" >> "%REPO%\scripts\logs\ai-tips-collect-%TODAY%.log" 2>&1
endlocal
