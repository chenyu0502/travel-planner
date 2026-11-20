@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在啟動行程手冊：http://localhost:8090
where py >nul 2>nul && (start "" http://localhost:8090 & py -m http.server 8090 & goto :eof)
where python >nul 2>nul && (start "" http://localhost:8090 & python -m http.server 8090 & goto :eof)
where npx >nul 2>nul && (npx --yes http-server -p 8090 -c-1 -o & goto :eof)
echo 找不到 Python 或 Node.js，請安裝其中一個後再執行。也可以直接用瀏覽器開啟 index.html。
pause
