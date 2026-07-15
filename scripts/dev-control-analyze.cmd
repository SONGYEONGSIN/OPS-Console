@echo off
REM 원서제어 수집·AI 분석 — 작업 스케줄러 진입점 (매일 08:30)
REM 전체 서비스 대상, 변경분만 claude -p 분석. 로그는 scripts\logs에 일자별 적재.
setlocal
set REPO=C:\Users\ys1114\ClaudeCode\Build\OPS-Console
cd /d "%REPO%"
if not exist "%REPO%\scripts\logs" mkdir "%REPO%\scripts\logs"
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a%%b%%c
"C:\Program Files\nodejs\node.exe" "%REPO%\scripts\dev-control-analyze.mjs" >> "%REPO%\scripts\logs\dev-control-%TODAY%.log" 2>&1
endlocal
