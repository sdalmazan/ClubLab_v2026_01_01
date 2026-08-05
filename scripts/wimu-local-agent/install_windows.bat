@echo off
:: ============================================================
::  ClubLab WIMU GPS Agent — Instalador Windows
::  Compatible con Windows 10/11 (64-bit)
:: ============================================================
setlocal enabledelayedexpansion
title ClubLab WIMU GPS Agent — Instalacion

echo.
echo  ============================================================
echo   ClubLab ^| Instalador del Agente GPS Local  (Windows)
echo  ============================================================
echo.

:: ── Verificar Python ─────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python no encontrado en el sistema.
    echo.
    echo  Por favor instala Python 3.9+ desde:
    echo    https://www.python.org/downloads/windows/
    echo.
    echo  Asegurate de marcar "Add Python to PATH" durante la instalacion.
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo  Python encontrado: %PYVER%

:: ── Crear entorno virtual ─────────────────────────────────────
set VENV_DIR=%~dp0venv
echo.
echo  Creando entorno virtual en: %VENV_DIR%
python -m venv "%VENV_DIR%"
if errorlevel 1 (
    echo  [ERROR] No se pudo crear el entorno virtual.
    pause
    exit /b 1
)

:: ── Instalar dependencias ─────────────────────────────────────
echo.
echo  Instalando dependencias (requests)...
"%VENV_DIR%\Scripts\pip" install -r "%~dp0requirements.txt" --quiet
if errorlevel 1 (
    echo  [ERROR] No se pudieron instalar las dependencias.
    echo  Verifica tu conexion a internet e intentalo de nuevo.
    pause
    exit /b 1
)

:: ── Crear script de ejecucion ─────────────────────────────────
set RUNNER=%~dp0run_agent.bat
echo @echo off > "%RUNNER%"
echo :: ClubLab WIMU GPS Agent — Script de ejecucion >> "%RUNNER%"
echo "%VENV_DIR%\Scripts\python" "%~dp0wimu_agent.py" %%* >> "%RUNNER%"

echo.
echo  ============================================================
echo   Instalacion completada con exito!
echo  ============================================================
echo.
echo  USO:
echo    1. Descarga el wimu_config.json desde ClubLab
echo       (Rendimiento → Ajustes → Agente GPS Local)
echo.
echo    2. Ejecuta el agente:
echo       run_agent.bat --config wimu_config.json
echo.
echo    3. O especifica la carpeta manualmente:
echo       run_agent.bat --config wimu_config.json --folder "C:\GPS\Partido"
echo.
echo    4. Para guardar el output localmente primero:
echo       run_agent.bat --config wimu_config.json --output wimu_output.json
echo.
pause
