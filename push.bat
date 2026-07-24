@echo off
set "PATH=%PATH%;C:\Program Files\Git\bin"
cd /d "C:\Users\User\Desktop\Aura"

echo [1/3] Adding...
git add -A

echo [2/3] Committing...
git commit -m "auto update"

echo [3/3] Pushing...
git push origin main

echo Done!
pause
