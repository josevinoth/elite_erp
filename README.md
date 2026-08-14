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

---

## Stock Manufacture Module

Track in-house manufactured stock items linked to the Item Master (LabFurnitureItem).

### Model

**`StockManufactureItem`** — `erp_app/sub_models/stock_manufacture.py`  
(created by migration `0048_stock_manufacture_item`)

| Field          | Type              | Notes                                     |
|----------------|-------------------|-------------------------------------------|
| `item_name`    | CharField(200)    | Auto-filled from Item Master              |
| `item_category`| FK → ItemCategory | Synced from Item Master on save           |
| `item_code`    | FK → LabFurnitureItem | Optional; drives auto-fill in form   |
| `item_type`    | FK → ItemType_info | Synced from Item Master                  |
| `uom`          | FK → UOM          | Synced from Item Master                   |
| `quantity`     | Decimal(12,4)     | User input                                |
| `unit_price`   | Decimal(14,2)     | User input                                |
| `total_price`  | Decimal(14,2)     | Auto-calculated: quantity × unit_price    |
| `length`       | Decimal(12,4)     | Synced from Item Master                   |
| `width`        | Decimal(12,4)     | Synced from Item Master                   |
| `height`       | Decimal(12,4)     | Synced from Item Master                   |
| `volume`       | Decimal(16,4)     | Auto-calculated: length × width × height  |
| `created_at`   | DateTimeField     | Auto                                      |
| `updated_at`   | DateTimeField     | Auto                                      |

### Django API Routes

Registered in `erp_app/urls.py` — view file: `erp_app/sub_views/stock_manufacture_api.py`

| Method   | URL                               | View function                                  | Description                  |
|----------|-----------------------------------|------------------------------------------------|------------------------------|
| `GET`    | `/api/stock-manufacture/`         | `list_stock_manufacture_items_api_view`        | List all manufacture items   |
| `POST`   | `/api/stock-manufacture/create/`  | `create_stock_manufacture_item_api_view`       | Create a new item            |
| `PATCH`  | `/api/stock-manufacture/<pk>/`    | `stock_manufacture_item_detail_api_view`       | Update an existing item      |
| `DELETE` | `/api/stock-manufacture/<pk>/`    | `stock_manufacture_item_detail_api_view`       | Delete an item               |

#### API + serializer

- `stock_manufacture_api.py` uses a dedicated serializer: `StockManufactureItemSerializer`
- `StockManufactureItemSerializer` performs item-master sync for `item_name`, `item_type`, `uom`, and dimensions
- duplicate manufacturing records for the same `item_code` are blocked

### React Frontend

#### Routes — `frontend/src/App.jsx`

| Route                                  | Component                  | Description                  |
|----------------------------------------|----------------------------|------------------------------|
| `/stock-manufacture`                   | `StockManufacturePage`     | List + inline add/edit page  |

#### List Page — `StockManufacturePage.jsx`

Uses a custom inline CRUD table (same interaction pattern as stock purchase items).

**Columns displayed:**

| Column       | Key            | Min Width |
|--------------|----------------|-----------|
| Item Category | `item_category` | 280 px   |
| Item Code    | `item_code`    | 110 px    |
| Item Name    | `item_name`    | 300 px    |
| Item Type    | `item_type`    | 120 px    |
| GRN No.      | computed label | 120 px    |
| UOM          | `uom`          | 140 px    |
| Qty/Size     | `quantity`     | 80 px     |
| Unit Price   | `unit_price`   | 100 px    |
| Total Price  | `total_price`  | 100 px    |
| Length       | `length`       | 80 px     |
| Width        | `width`        | 80 px     |
| Height/Thk   | `height`       | 90 px     |
| Volume       | `volume`       | 90 px     |

**Features:**

- Add button opens inline add section on the same page (no navigation)
- Edit opens inline editable row in list table
- Item code selection auto-fills read-only `item_name`, `item_type`, `uom`, and dimensions
- Horizontal table scroll keeps the page responsive on mobile

### Frontend Service Functions — `crudApi.js`

| Function                        | Method   | Endpoint                            |
|---------------------------------|----------|-------------------------------------|
| `listStockManufactureItems()`   | `GET`    | `/api/stock-manufacture/`           |
| `createStockManufactureItem(payload)` | `POST` | `/api/stock-manufacture/create/` |
| `updateStockManufactureItem(id, payload)` | `PATCH` | `/api/stock-manufacture/<id>/` |
| `deleteStockManufactureItem(id)` | `DELETE` | `/api/stock-manufacture/<id>/`  |

### Data Flow

```
User selects Item Category
  ↓
User selects Item Code
  ↓
[Frontend] inline add/edit row item-code handler triggered
  ↓
[Frontend] Looks up LabFurnitureItem from itemMasterOptions
  ↓
[Frontend] Auto-populates (all read-only):
  - item_name, item_type, uom
  - length, width, height → volume (calculated)
  ↓
User enters quantity & unit_price → total_price auto-calculated
  ↓
Form submitted from same list page (POST /api/stock-manufacture/create/ or PATCH /api/stock-manufacture/<id>/)
  ↓
[Backend] StockManufactureItemSerializer + stock_manufacture_api
  - resolves FK ids
  - derives item_name / item_type / uom from Item Master when item_code present
  - calculates total_price & volume server-side
  - prevents duplicate stock manufacture rows for the same item_code
  ↓
201 response with serialized record
```

### Migration

```powershell
python manage.py migrate erp_app 0049
```

---

## Project Quotation Module

Prepare project quotations per project with BOM hierarchy validation and cost-type-aware item entry.

### Highlights

- Cost types are stored in `erp/erp_app/sub_models/CostType_mod.py` as `CostTypeInfo`
- Quotation rows are stored in `erp/erp_app/sub_models/project_quotation_mod.py` as `ProjectQuotationItemInfo`
- Material rows enforce the chain `Item Category → Item Name → Item Code`
- Non-material rows automatically clear item master fields
- BOM hierarchy rejects skipped levels with the message:
  `Invalid BOM hierarchy: children must be linked to immediate parent level.`
- `cost_per_qty` auto-resolves from Item Costing first, then the latest stock purchase costs

### Django API Routes

Registered in `erp/erp_app/urls.py` — view files: `erp/erp_app/sub_views/project_quotation_api.py` and `erp/erp_app/sub_views/project_quotation_view.py`

| Method   | URL                                 | Description                              |
|----------|--------------------------------------|------------------------------------------|
| `GET`    | `/api/project-quotations/`           | List project-grouped quotation payloads  |
| `POST`   | `/api/project-quotations/create/`    | Create a quotation row                   |
| `GET`    | `/api/project-quotations/<pk>/`      | Fetch one quotation row + project group  |
| `PATCH`  | `/api/project-quotations/<pk>/`      | Update a quotation row                   |
| `DELETE` | `/api/project-quotations/<pk>/`      | Delete a quotation row                   |

### React Frontend

- Route: `/projects/quotation`
- Page: `erp/frontend/src/pages/ProjectQuotationPage.jsx`
- Service calls: `erp/frontend/src/services/crudApi.js`

### Migration

The schema and default quotation cost types are created by:

```powershell
Set-Location "C:\Users\BVM\PycharmProjects\elite_erp_v1.0\erp"
python manage.py migrate erp_app
```

