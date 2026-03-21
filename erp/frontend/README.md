# Elite ERP React Frontend

Reusable React authentication frontend for login and registration.

## Features

- Reusable auth components (`AuthLayout`, `AuthForm`)
- Reusable auth form state hook (`useAuthForm`)
- Shared API helpers (`src/services/authApi.js`)
- One common stylesheet (`src/styles/auth_common.css`)
- Routes for `/login` and `/register`

## Run

1. Start Django backend at `http://127.0.0.1:8000`.
2. Start React dev server:

```powershell
Set-Location "C:\Users\BVM\PycharmProjects\elite_erp_v1.0\erp\frontend"
npm install
npm run dev
```

Vite proxy forwards `/api/*` to Django, so the frontend can call `/api/auth/*` without CORS setup.

## Build

```powershell
Set-Location "C:\Users\BVM\PycharmProjects\elite_erp_v1.0\erp\frontend"
npm run build
npm run preview
```

