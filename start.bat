@echo off
echo 학습 리포트 서버 시작 중...
echo.

REM Python 3 확인
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Python 서버로 실행합니다.
    echo 브라우저에서 http://localhost:8000 으로 열립니다.
    echo 종료하려면 이 창에서 Ctrl+C 를 누르세요.
    echo.
    start "" "http://localhost:8000"
    python -m http.server 8000
    goto end
)

REM Python 없으면 안내
echo Python이 설치되어 있지 않습니다.
echo.
echo 해결 방법:
echo   1. https://python.org 에서 Python 설치 후 다시 실행
echo   2. 또는 VS Code + Live Server 확장 사용
echo   3. 또는 크롬 바로가기에 --allow-file-access-from-files 플래그 추가
echo.
pause
:end
