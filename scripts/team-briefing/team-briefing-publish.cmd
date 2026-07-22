@echo off
REM 팀 브리핑 발행 — 작업 스케줄러 진입점 (매주 금 10:00).
REM InteractiveToken(로그인 사용자 세션)으로 실행해야 claude -p OAuth 구독으로 스토리를 생성한다.
REM draft 집계 -> claude -p 스토리 -> publish(뉴스레터 발행 + Teams 티저). claude 실패 시 수치 요약 폴백.
REM 로그는 scripts\logs 일자별 적재(스토리 실패도 stderr로 남아 관측 가능). 등록: register-team-briefing-task.ps1.
setlocal
set REPO=C:\Users\ys1114\ClaudeCode\Build\OPS-Console
cd /d "%REPO%"
if not exist "%REPO%\scripts\logs" mkdir "%REPO%\scripts\logs"
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a%%b%%c
"C:\Program Files\nodejs\node.exe" "%REPO%\scripts\team-briefing\publish-local.mjs" >> "%REPO%\scripts\logs\team-briefing-%TODAY%.log" 2>&1
endlocal
