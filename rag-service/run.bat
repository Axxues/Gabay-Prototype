@echo off
setlocal

set "PYTHON_EXE=C:\Users\elain\AppData\Local\Programs\Python\Python312\python.exe"
set "SCRIPTS_DIR=C:\Users\elain\AppData\Local\Programs\Python\Python312\Scripts"

if exist "%PYTHON_EXE%" (
    set "PATH=C:\Users\elain\AppData\Local\Programs\Python\Python312;%SCRIPTS_DIR%;%PATH%"
    "%PYTHON_EXE%" -m uvicorn app.main:app --reload --port 8000 %*
) else (
    python -m uvicorn app.main:app --reload --port 8000 %*
)
