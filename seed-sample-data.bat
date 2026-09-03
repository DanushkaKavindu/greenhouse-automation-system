@echo off
cd /d "%~dp0"
echo Running sample-data backfill (temp / humidity / soil moisture / solar lux, Aug 27 - Sep 1)...
echo.
call npm run seed:sample-data
echo.
echo Done. Check the Calendar page in the app - Aug 27 to Sep 1 should now show real averages.
pause
