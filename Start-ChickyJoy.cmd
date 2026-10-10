@echo off
setlocal
cd /d "%~dp0"
title ChickyJoy
if not exist "%~dp0tools\Start-ChickyJoy.ps1" (
  echo Hay giai nen toan bo ZIP vao thu muc moi truoc khi chay.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Start-ChickyJoy.ps1"
if errorlevel 1 pause
endlocal
