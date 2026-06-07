@echo off
setlocal
cd /d "%~dp0"
if not exist node_modules (
  npm install
)
npm run build
if errorlevel 1 exit /b %errorlevel%
npm start
