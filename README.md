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
- `/api/auth/forgot-password/`
- `/api/auth/reset-password/`

## Password Reset Email Setup

Django reads mail settings from `.env` (in `erp/.env` or repo root `.env`) for password reset delivery.

```dotenv
DJANGO_EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DJANGO_EMAIL_HOST=smtp.zoho.com
DJANGO_EMAIL_PORT=587
DJANGO_EMAIL_USE_TLS=1
DJANGO_EMAIL_HOST_USER=your-zoho-mailbox@domain.com
DJANGO_EMAIL_HOST_PASSWORD=your-zoho-app-password
DJANGO_DEFAULT_FROM_EMAIL=your-zoho-mailbox@domain.com
```

A safe template is available in `.env.example`.

## Windows LAN Production Run

Use Waitress + Django from the `erp` folder.

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
cmd /c start_prod.bat
```

Stop production server:

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
cmd /c stop_prod.bat
```

Register automatic startup on Windows logon:

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
powershell -ExecutionPolicy Bypass -File .\register_startup_task.ps1
```

Or use one-click elevated registration:

```powershell
Set-Location "C:\Users\Admin\PycharmProjects\elite_erp_v1.0\erp"
cmd /c install_startup_task.bat
```
