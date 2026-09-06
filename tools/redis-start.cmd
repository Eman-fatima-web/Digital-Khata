@echo off
REM Portable Redis launcher for Digital Khata
REM Starts redis-server on port 6379 in the background.
REM Safe to double-click or run via: npm run redis:start
cd /d "%~dp0"
if exist "redis\redis-server.exe" (
  start "Digital Khata Redis" /min redis\redis-server.exe --port 6379
  echo Redis started on port 6379
) else (
  echo redis-server.exe not found. Download from:
  echo   https://github.com/tporadowski/redis/releases
  echo and extract into the tools\redis folder.
)