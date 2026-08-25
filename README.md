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

---

## Project Costing Module

Clone approved quotation summaries and items into project costing records, then track retrieval workflow using the same database schema.

### Backend file mapping

| Area | File | Purpose |
|------|------|---------|
| Summary model | `erp/erp_app/sub_models/project_costing_summary_mod.py` | Stores cloned quotation summary values plus generated `costing_id` |
| Item model | `erp/erp_app/sub_models/project_costing_items_mod.py` | Stores cloned quotation item rows plus `retrieval_status` |
| Retrieval status model | `erp/erp_app/sub_models/retrieval_status_mod.py` | Defines allowed costing retrieval workflow statuses |
| Summary serializer | `erp/erp_app/project_costing_summary_serializer.py` | Exposes costing summary display/edit fields |
| Item serializer | `erp/erp_app/project_costing_items_serializer.py` | Exposes costing items with nested `retrieval_status` |
| View helpers | `erp/erp_app/sub_views/project_costing_view.py` | Clone/list/detail payload logic for costing summaries and items |
| API views | `erp/erp_app/sub_views/project_costing_api.py` | List, generate, edit, import, retrieval, and return endpoints |
| URL registration | `erp/erp_app/urls.py` | Registers costing summary/item API routes |

### Frontend file mapping

| Area | File | Purpose |
|------|------|---------|
| Page | `erp/frontend/src/pages/ProjectCostingPage.jsx` | Costing list and costing summary edit page |
| Styles | `erp/frontend/src/styles/ProjectCosting.css` | All costing page styling and status badge classes |
| Service API | `erp/frontend/src/services/crudApi.js` | Fetch helpers for costing CRUD, item import, and template download |

### Key API routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/project-costing/` | List project costing summaries with quotation number and project code |
| `POST` | `/api/project-costing/generate/` | Clone a quotation summary and its items into project costing |
| `GET` | `/api/project-costing/<id>/` | Load costing summary detail and linked items |
| `PATCH` | `/api/project-costing/<id>/` | Update costing summary fields |
| `GET/PATCH` | `/api/project-costing/<id>/edit/` | Compatibility edit endpoint for summary + linked item updates |
| `GET/POST` | `/api/project-costing/<id>/items/` | List or create costing items for a summary |
| `PATCH/DELETE` | `/api/project-costing/<costing_id>/items/<item_id>/` | Update or delete a costing item |
| `GET` | `/api/stock-retrieval/` | List costing items with retrieval status `Item Requested` |
| `GET` | `/api/stock-return/` | List costing items with retrieval status `Item Return` |

### UI behavior

- `Generate Project Costing` clones quotation summary financial fields and quotation item rows.
- New costing item rows default `retrieval_status` to `No Action`.
- Rows marked `Item Accepted` are frozen for non-admin users.
- Rows marked `Item Return` flow into the Stock Return module.
- `ProjectCostingPage.jsx` keeps all styles in `ProjectCosting.css` with badge/popup classes only.
- `StockRetrievalPage.jsx` now displays `purchase_qty`, `length`, `width`, `height`, and `volume`.
- In Stock Retrieval, `retrieval_status` is read-only when `stock_status = Not Purchased` (enforced on every load/render).

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

---

## Vendor Module

Manage master vendor records with generated vendor codes and validation.

### Backend file mapping

| Area | File | Purpose |
|------|------|---------|
| Vendor model | `erp/erp_app/sub_models/vendor.py` | Stores vendor master records with auto-generated `vendor_code` (`VC_` + `10000 + id`) |
| Vendor proxy class | `erp/erp_app/sub_models/vendor_mod.py` | Exposes `VendorInfo` naming convention |
| Serializer | `erp/erp_app/vendor_serializer.py` | Validates duplicates and email (`@` required), returns legacy + new field aliases |
| API views | `erp/erp_app/sub_views/vendor_api.py` | Vendor CRUD endpoints |
| URL registration | `erp/erp_app/urls.py` | Registers vendor API routes |

### Frontend file mapping

| Area | File | Purpose |
|------|------|---------|
| Page | `erp/frontend/src/pages/VendorsPage.jsx` | Add/edit/delete vendors with inline validation |
| Styles | `erp/frontend/src/styles/Vendor.css` | Vendor page layout and table styles (no inline JSX styles) |

### Vendor behavior

- Vendor code auto-generates in format `VC_XXXXX` from record id.
- Duplicate `vendor_name` is rejected at UI + API.
- `email_id` must contain `@`.
- Address input uses a 3-row textarea with vertical resize.

---

## Place Stock Order Module

Separate stock-purchase workflow to place vendor orders for not-purchased costing items.

### Routing and navigation

- Route: `/stock-purchase/place-order`
- Navigation: **Home Page -> Stocks -> Stock Purchase -> Place Stock Order**

### Backend file mapping

| Area | File | Purpose |
|------|------|---------|
| Order models | `erp/erp_app/sub_models/place_stock_order_mod.py` | Stores order header (`PlaceStockOrderInfo`) and selected items (`PlaceStockOrderItem`) |
| API views | `erp/erp_app/sub_views/place_stock_order_api.py` | Meta endpoint (vendors + items) and create endpoint |
| URL registration | `erp/erp_app/urls.py` | Registers `/api/stock-purchase/place-order/meta/` and `/api/stock-purchase/place-order/` |

### Frontend file mapping

| Area | File | Purpose |
|------|------|---------|
| Page | `erp/frontend/src/pages/PlaceStockOrderPage.jsx` | Vendor auto-fill + multi-item selection + save order |
| Service helpers | `erp/frontend/src/services/crudApi.js` | `listPlaceStockOrderMeta`, `createPlaceStockOrder` |
| Styles | `erp/frontend/src/styles/PlaceStockOrder.css` | All page/table styles (no inline JSX styles) |

### Place Stock Order behavior

- Vendor dropdown auto-populates `vendor_code`, `address`, `phone_number`, `email_id`, and `contact_person`.
- Order item list includes only Project Costing rows with `stock_status = Not Purchased`.
- Multi-select item table includes: category, name, code, type, purchase qty, requested qty, size, volume, stock status.
- Save persists linkages to both `costing_id` and `vendor_id`.

