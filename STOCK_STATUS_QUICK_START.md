# Stock Status Feature - Quick Start Guide

## What Was Done

The Stock Status feature has been successfully implemented, allowing the ERP system to automatically track and categorize quotation items based on their stock availability.

## Key Components

### 1. Database
✅ **StockStatusInfo** lookup table with 4 pre-populated statuses:
- In-Stock (ID: 1)
- Partial Stock (ID: 2)
- No Stock (ID: 3)
- Not Purchased (ID: 4)

### 2. Backend Models
✅ **ProjectQuotationItemInfo** now includes:
- `stock_status` ForeignKey to StockStatusInfo
- Auto-calculated based on purchase history and quantities

### 3. APIs & Views
✅ **Stock Planning Endpoint:** `GET /api/quotations/stock-planning/`
- Returns all quotation items where stock_status ≠ "In-Stock"
- Includes all item details and stock status information

### 4. Frontend Pages
✅ **StockPlanningPage:** `/stock-planning`
- Dedicated page for managing non-In-Stock items
- Color-coded status badges
- Responsive table with item details

✅ **ProjectQuotationPage Updates:**
- Stock status badge displayed for each quotation item
- Color-coded for easy identification

## Using the Feature

### View Stock Planning Items
```
1. Navigate to: /stock-planning
2. View all quotation items that need attention
3. Status colors indicate urgency:
   - Gray: Not yet purchased
   - Red: Out of stock
   - Orange: Partially available
   - Green: In stock
```

### Check Item Stock Status in Quotations
```
1. Go to: /projects
2. Open a project
3. Click "Quotation" section
4. Each item shows its current stock status with color badge
```

### API Usage
```bash
# Get all non-In-Stock items
curl -X GET http://localhost:8000/api/quotations/stock-planning/ \
  -H "Cookie: sessionid=YOUR_SESSION_ID"

# Response includes:
# - quotation_number
# - project_id, project_name
# - item_category, item_name, item_code, item_type
# - purchase_qty, requested_qty
# - length, width, height, volume
# - stock_status (nested object with id and status_name)
```

## Stock Status Logic

The stock status is automatically determined when quotation items are saved:

```
1. Check Purchase History
   └─> No history? → "Not Purchased"
   
2. Check Purchase Quantity
   └─> purchase_qty = 0? → "No Stock"
   └─> purchase_qty < requested_qty? → "Partial Stock"
   └─> purchase_qty ≥ requested_qty? → "In-Stock"
```

## Database Structure

### StockStatusInfo Table
```
+----+------------------+----------+----------+
| id | status_name      | created  | updated  |
+----+------------------+----------+----------+
| 1  | In-Stock         | ...      | ...      |
| 2  | Partial Stock    | ...      | ...      |
| 3  | No Stock         | ...      | ...      |
| 4  | Not Purchased    | ...      | ...      |
+----+------------------+----------+----------+
```

### ProjectQuotationItemInfo Table (Updated)
```
+-----+------------------+-----------+-------+
| ... | stock_status_id  | created   | ...   |
+-----+------------------+-----------+-------+
| 1   | NULL (legacy)    | ...       | ...   |
| 2   | NULL (legacy)    | ...       | ...   |
| 3   | 2 (Partial)      | ...       | ...   |
+-----+------------------+-----------+-------+
```

## Migration History

```
0062_add_stock_status_lookup_and_item_fk.py
  └─ Creates StockStatusInfo model
  └─ Adds stock_status FK to ProjectQuotationItemInfo

0063_alter_stockstatusinfo_id.py
  └─ Adjusts ID field type

0064_populate_stock_status.py
  └─ Populates default statuses (In-Stock, Partial Stock, No Stock, Not Purchased)
```

## Configuration Files

No configuration needed! The feature works out of the box after:
1. Migrations are applied
2. Server is restarted
3. Stock status lookup table is populated

## Troubleshooting

**Q: Stock Planning page shows "No stock planning items"**
- A: This is correct if all quotation items are "In-Stock" status

**Q: Items don't show stock status badge**
- A: Items created before migration might need to be re-saved for stock status to be calculated

**Q: API returns empty items list**
- A: All your items must be "In-Stock" status. Check the ProjectQuotationPage to see current statuses.

## Next Steps

1. **Create quotation items** through ProjectQuotationPage
2. **System automatically assigns** stock status based on purchase history
3. **Monitor stock** in dedicated StockPlanningPage
4. **Track changes** as purchase orders are fulfilled

## Files Modified

### Backend
- `sub_models/stock_status_mod.py` - New model
- `sub_models/project_quotation_items_mod.py` - Added stock_status FK
- `project_quotation_items_serializer.py` - Serializes stock_status
- `sub_views/project_quotation_api.py` - Added stock_planning endpoint
- `sub_views/project_quotation_view.py` - Added stock_planning_payload method
- `migrations/0062_*.py`, `0063_*.py`, `0064_*.py` - Database changes

### Frontend
- `pages/StockPlanningPage.jsx` - New page for stock planning view
- `pages/ProjectQuotationPage.jsx` - Shows stock status badges
- `services/crudApi.js` - listStockPlanningItems() function

## Support

For any issues or questions regarding the Stock Status feature:
1. Check the comprehensive documentation in STOCK_STATUS_IMPLEMENTATION.md
2. Review the API responses for detailed error messages
3. Check browser console for frontend errors
4. Check Django logs for backend errors

---

**Feature Status:** ✅ PRODUCTION READY

All components tested and verified working correctly.

