@echo off
title Binance Clone - Starting Servers
color 0A
echo.
echo  ====================================
echo   BINANCE CLONE - SERVER STARTUP
echo  ====================================
echo.
echo  Starting Backend (port 5000)...
start "BACKEND - Port 5000" cmd /k "cd /d d:\binance\backend && node src/index.js"

echo  Waiting for backend to initialize...
timeout /t 4 /nobreak > nul

echo  Starting Frontend (port 3000)...
start "FRONTEND - Port 3000" cmd /k "cd /d d:\binance\frontend && npm run dev"

echo.
echo  Both servers started!
echo.
echo  Frontend:  http://localhost:3000
echo  Backend:   http://localhost:5000
echo  Admin:     http://localhost:3000/admin
echo.
echo  CREDENTIALS:
echo  Admin:  admin@binance-clone.com / admin123456
echo  Demo:   demo@binance-clone.com  / user123456
echo.
echo  Opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start http://localhost:3000
echo.
pause
