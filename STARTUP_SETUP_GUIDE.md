EliteERP Production Server - Task Scheduler Setup Guide
========================================================

PROBLEM: Server not running through .bat file when launched from Task Scheduler outside of PyCharm
SOLUTION: Fixed batch files and improved startup scripts

WHAT WAS FIXED:
===============

1. run_server.bat
   - Added error checking to verify Python exists
   - Set DJANGO_SETTINGS_MODULE explicitly
   - Set PYTHONUNBUFFERED=1 for real-time logging
   - Changed working directory to project root
   - Added logging with timestamps

2. erp_control.bat
   - Unified start/stop/status/restart in one command
   - Uses dynamic paths so it works for different Windows usernames
   - Supports optional port argument (default 8010)

3. register_startup_task.ps1
   - Increased delay from 20s to 30s (allows network to be ready)
   - Set correct working directory to project root
   - Added helpful output messages
   - Better documentation of what was registered

4. Startup flow simplification
   - Scheduled task now calls erp_control.bat start 8010


HOW TO SETUP:
=============

Step 1: Test the startup process
   - Open PowerShell as Administrator
   - Navigate to: C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp
   - Run: erp_control.bat start 8010
   - The server should start and listen on port 8010
   - Use a new terminal and run: erp_control.bat stop 8010
   - Check the logs/server.log file

Step 2: Register the startup task
   - Open PowerShell as Administrator
   - Run: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   - Navigate to: C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp
   - Run: .\register_startup_task.ps1
   - You should see: "[OK] Scheduled task 'EliteERP-Prod' registered successfully."

Step 3: Verify the task was created
   - Open Task Scheduler (search for "Task Scheduler" in Windows)
   - Look for "EliteERP-Prod" in the task list
   - Double-click it to verify:
     * Trigger: "At log on"
     * Action: "cmd.exe /c "...\erp_control.bat" start 8010"
     * Working directory: C:\Users\Admin\PycharmProjects\elite_erp_v1.0

Step 4: Test by logging off and back on
   - Press Alt+F4 to log off (or click Start > Sign out)
   - Log back in
   - The server should automatically start
   - Check the logs:
     * logs/startup.log - startup information
     * logs/server.log - server output


ACCESSING YOUR APPLICATION:
============================

Once the server is running via Task Scheduler:

From the same computer:
   - http://localhost:8010/

From other computers on the same LAN:
   - First, set a RESERVED IP for your computer (see NETWORKING section below)
   - http://192.168.X.X:8010/

Note: If you get "Invalid HTTP_HOST header" error:
   - Edit: C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\erp\settings.py
   - Find: ALLOWED_HOSTS = [...]
   - Add your IP address: ALLOWED_HOSTS = ['192.168.1.6', 'localhost', '127.0.0.1']


NETWORKING - MAKING IP STABLE:
==============================

On Windows (for reserved IP via DHCP):
   1. Note your current MAC address:
      - Open Command Prompt as Administrator
      - Run: ipconfig /all
      - Find "Physical Address" (MAC address)

   2. On your router (Airtel WiFi):
      - Access router settings (usually 192.168.1.1)
      - Login to router admin
      - Find DHCP settings or "Connected Devices"
      - Find your computer by MAC address
      - Set it to "Reserved" or "Static DHCP"
      - Set preferred IP (e.g., 192.168.1.2)

   3. Restart the computer or release/renew IP:
      - ipconfig /release
      - ipconfig /renew

For WiFi connection reliability:
   - Use Ethernet (LAN cable) connection for stability
   - If WiFi: Keep router close and avoid interference


TROUBLESHOOTING:
================

1. Task won't run:
   - Check if you ran it as Administrator
   - Check logs at: C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\logs\startup.log
   - Verify Python path exists: C:\Users\Admin\PycharmProjects\elite_erp_v1.0\.venv\Scripts\python.exe

2. Server starts but connection refused from other machines:
   - Verify IP is stable (see NETWORKING section)
   - Run: ipconfig (check your current IP)
   - Try pinging from other machine: ping 192.168.X.X
   - Check Windows Firewall allows port 8010

3. "Invalid HTTP_HOST header" error:
   - Add your IP to ALLOWED_HOSTS in settings.py
   - Restart server

4. Server crashes after starting:
   - Check logs/server.log for error messages
   - Run test_startup.bat to see full error output

5. Port 8010 already in use:
   - Run: netstat -aon | findstr :8010
   - Check which process is using it: tasklist /FI "PID eq XXXXX"
   - Either close that process or use different port in serve.py


USEFUL COMMANDS:
================

# Check if server is running
netstat -aon | findstr :8010

# View startup logs
type C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\logs\startup.log

# View server logs
type C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\logs\server.log

# Manually start server
cd C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp
erp_control.bat start 8010

# Stop server
erp_control.bat stop 8010

# Delete task scheduler entry (if needed)
schtasks /delete EliteERP-Prod /f


FILES CHANGED:
==============

1. erp_control.bat - Unified start/stop/status/restart controller
2. register_startup_task.ps1 - Updated to call erp_control.bat on logon

All files are in: C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp\


NEXT STEPS:
===========

1. Run erp_control.bat start 8010 to verify everything works
2. When ready, run register_startup_task.ps1 as Administrator
3. Log off and back on to test
4. Check logs if there are any issues


