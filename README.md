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
