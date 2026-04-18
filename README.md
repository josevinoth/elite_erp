# elite_erp

Enterprise resource planning web portal for elite customer.

## Backend (Django)

```powershell
Set-Location "C:\Users\BVM\PycharmProjects\elite_erp_v1.0\erp"
python manage.py runserver
```

## Frontend (React)

```powershell
Set-Location "C:\Users\BVM\PycharmProjects\elite_erp_v1.0\erp\frontend"
npm install
npm run dev
```

React app routes:

- `/login`
- `/register`

Auth API routes (Django):

- `/api/auth/csrf/`
- `/api/auth/register/`
- `/api/auth/login/`
- `/api/auth/logout/`

## Windows LAN Production Run

Use Waitress + Django from the `erp` folder.

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
cmd /c erp_control.bat start 8010
```

Stop production server:

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
cmd /c erp_control.bat stop 8010
```

Register automatic startup on Windows logon:

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
powershell -ExecutionPolicy Bypass -File .\register_startup_task.ps1
```

Check status anytime:

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
cmd /c erp_control.bat status 8010
```

