@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   lolo 桌宠 - 打包为可运行 exe（免安装）
echo ============================================
if not exist node_modules\electron\dist\electron.exe (
  echo [准备] 未找到 Electron 运行时，正在安装依赖（首次较慢）...
  call npm install
  if not exist node_modules\electron\dist\electron.exe (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)
echo [打包] 复制 Electron 运行时 + 工程到 dist\lolo-win32-x64 ...
set "DIST=dist\lolo-win32-x64"
if exist "%DIST%" rmdir /s /q "%DIST%"
mkdir "%DIST%\resources\app"
xcopy /s /e /y node_modules\electron\dist\* "%DIST%\" >nul
copy /y main.js preload.js package.json "%DIST%\resources\app\" >nul
xcopy /s /e /y config "%DIST%\resources\app\config\" >nul
xcopy /s /e /y src "%DIST%\resources\app\src\" >nul
xcopy /s /e /y assets "%DIST%\resources\app\assets\" >nul
if exist "%DIST%\electron.exe" move /y "%DIST%\electron.exe" "%DIST%\lolo.exe" >nul
echo.
echo 完成！运行下面的文件即可启动 lolo 桌宠：
echo   %~dp0%DIST%\lolo.exe
echo （注：lolo.exe 需与同目录的 resources 等文件一起使用，整文件夹移动即可）
echo.
pause
