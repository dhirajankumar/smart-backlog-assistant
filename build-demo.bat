@echo off
setlocal enabledelayedexpansion

echo [1/4] Building NestJS API...
call npx nx build api --configuration=production
if !errorlevel! neq 0 (
  echo ERROR: API build failed
  exit /b !errorlevel!
)

echo [2/4] Building Angular frontend...
call npx nx build web --configuration=production
if !errorlevel! neq 0 (
  echo ERROR: Web build failed
  exit /b !errorlevel!
)

echo [3/4] Packaging with pkg...
call pkg dist/apps/api/main.js --config pkg.config.json --output dist/backlog-assistant.exe
if !errorlevel! neq 0 (
  echo ERROR: pkg packaging failed. Ensure pkg is installed globally: npm install -g pkg
  exit /b !errorlevel!
)

echo [3.5/4] Copying web assets alongside exe...
if exist dist\web rmdir /s /q dist\web
xcopy /E /I /Q dist\apps\web\browser dist\web\browser
if !errorlevel! neq 0 (
  echo ERROR: Web asset copy failed
  exit /b !errorlevel!
)

echo [4/4] Creating demo zip...
powershell -Command "Compress-Archive -Force -Path 'dist\backlog-assistant.exe','dist\web','README-demo.md' -DestinationPath 'dist\backlog-assistant-demo.zip'"
if !errorlevel! neq 0 (
  echo ERROR: Zip creation failed
  exit /b !errorlevel!
)

echo.
echo Build complete!
echo Output: dist\backlog-assistant-demo.zip
echo   - dist\backlog-assistant.exe (~60 MB, Windows x64 standalone, node22)
echo   - dist\web\browser\ (Angular static files, must stay next to exe)
echo   - README-demo.md
