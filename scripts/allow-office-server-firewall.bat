@echo off
REM Run this ONCE on the MAIN laptop, as Administrator.
REM Right-click → Run as administrator.
netsh advfirewall firewall delete rule name="Insurance Desk Office Server" >nul 2>&1
netsh advfirewall firewall add rule name="Insurance Desk Office Server" dir=in action=allow protocol=TCP localport=3457 profile=private,domain
if errorlevel 1 (
  echo Failed. Right-click this file and choose Run as administrator.
  pause
  exit /b 1
)
echo OK: Windows Firewall now allows Insurance Desk sharing on port 3457.
pause
