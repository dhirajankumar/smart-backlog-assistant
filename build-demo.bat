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

echo [3.6/4] Bundling github-mcp-shim alongside exe...
if exist dist\github-mcp-server rmdir /s /q dist\github-mcp-server
mkdir dist\github-mcp-server\dist
copy /Y tools\github-mcp-shim\index.js dist\github-mcp-server\dist\index.js
if !errorlevel! neq 0 (
  echo ERROR: github-mcp-shim copy failed
  exit /b !errorlevel!
)

echo [4/4] Creating demo zip...
if exist dist\backlog-assistant-demo rmdir /s /q dist\backlog-assistant-demo
mkdir dist\backlog-assistant-demo
copy /Y dist\backlog-assistant.exe dist\backlog-assistant-demo\backlog-assistant.exe
xcopy /E /I /Q dist\web dist\backlog-assistant-demo\web
xcopy /E /I /Q dist\github-mcp-server dist\backlog-assistant-demo\github-mcp-server
if exist .env copy /Y .env dist\backlog-assistant-demo\.env
copy /Y README-demo.md dist\backlog-assistant-demo\README-demo.md
if exist dist\backlog-assistant-demo.zip del dist\backlog-assistant-demo.zip
cd dist
"C:\Program Files\7-Zip\7z.exe" a -tzip backlog-assistant-demo.zip backlog-assistant-demo
set ZIPERR=!errorlevel!
cd ..
rmdir /s /q dist\backlog-assistant-demo
if !ZIPERR! neq 0 (
  echo ERROR: Zip creation failed. Ensure 7-Zip is installed at "C:\Program Files\7-Zip\7z.exe"
  exit /b !ZIPERR!
)

echo.
echo Build complete!
echo Output: dist\backlog-assistant-demo.zip
echo   - dist\backlog-assistant.exe (~60 MB, Windows x64 standalone, node22)
echo   - dist\web\browser\ (Angular static files, must stay next to exe)
echo   - dist\github-mcp-server\ (MCP server, must stay next to exe; requires node.exe on PATH)
echo   - README-demo.md
