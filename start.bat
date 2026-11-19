@echo off
rem Claude Monitor: arranque con doble clic (Windows). Requiere Python 3.
cd /d "%~dp0"
set PORT=8050
set "SRC=%USERPROFILE%\.claude\projects"
if defined CLAUDE_CONFIG_DIR set "SRC=%CLAUDE_CONFIG_DIR%\projects"

if not exist "claude-projects" (
  if not exist "%SRC%" (
    echo No se encuentra "%SRC%". Usa Claude Code al menos una vez y vuelve a probar.
    pause
    exit /b 1
  )
  mklink /J "claude-projects" "%SRC%" >nul
)

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY python --version >nul 2>nul && set "PY=python"
if not defined PY (
  echo No se ha encontrado Python 3.
  echo Instalalo desde https://www.python.org/downloads/ marcando "Add python.exe to PATH"
  echo y vuelve a abrir este archivo.
  pause
  exit /b 1
)

echo.
echo   Claude Monitor en http://localhost:%PORT%/
echo   Cierra esta ventana para pararlo.
echo.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/"
%PY% -m http.server %PORT% --bind 127.0.0.1
pause
