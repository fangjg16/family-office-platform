@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 npm，请先安装 Node.js：https://nodejs.org
    echo 安装后重新打开本文件即可。
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo 首次运行正在安装依赖，请稍候…
    call npm install
    if errorlevel 1 (
        echo [错误] npm install 失败
        pause
        exit /b 1
    )
)

echo.
echo  启动本地预览：http://localhost:5173
echo  浏览器将自动打开；关闭本窗口或按 Ctrl+C 停止服务。
echo.
call npm run dev
pause
