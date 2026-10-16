@echo off
chcp 65001 >nul
cd /d "%~dp0"
python -c "import fitz, flask, numpy, winrt.windows.media.ocr" 2>nul || (
  echo Installation des dependances...
  python -m pip install -r requirements.txt || (echo Echec : Python est-il installe ? & pause & exit /b 1)
)
python app.py
pause
