@echo off
setlocal
cd /d "%~dp0"
set "PATH=C:\Program Files\Git\cmd;C:\Program Files\Git\ucrt64\bin;%PATH%"

echo ==============================================
echo  Orbix Studio - Git Add, Commit and Push
echo ==============================================
echo.
echo [1/4] Running git status...
git status
echo.
echo [2/4] Staging modified files...
git add .
echo.
echo [3/4] Committing changes...
git commit -m "fix(cache): bump asset query versions to v5 and update service worker cache"
echo.
echo [4/4] Pushing to GitHub (origin main)...
git push origin main
echo.
echo ==============================================
echo  Finished! Check output above.
echo ==============================================
pause
