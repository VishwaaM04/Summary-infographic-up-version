@echo off
echo Starting NotebookLM MCP Server...
echo ---------------------------------
echo This window must stay open for the server to work.
echo To stop the server, press Ctrl+C or close this window.
echo.

cd /d "%~dp0"
call npm start

pause
