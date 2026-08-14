# Stock Purchase Add Page Update - Implementation Summary

## Overview
Updated the Purchase Item Add Page (StockPurchaseAddPage.jsx and StockPurchaseItem model) to automatically fetch and populate item name, item type, and UOM from the Item Master when an item code is selected.

## Changes Made

### 1. Backend Model Changes

#### File: `erp_app/sub_models/stock_purchase.py`
- **Updated StockPurchaseItem.save()** method to pull `item_type` and `uom` from LabFurnitureItem when `item_code` is selected
- Now sets `item_type_id` and `uom_id` from the selected LabFurnitureItem
- Ensures automatic sync between the Item Master and Purchase Item

### 2. Backend API Changes

#### File: `erp_app/sub_views/stock_purchase_api.py`

**Updated _serialize_item() function:**
- Now pulls `item_name` from LabFurnitureItem (instead of StockPurchaseItem duplicate)
- Includes `item_type_id` in the response for mapping to ItemType object ID
- Includes `uom_name` and `uom_symbol` for display purposes
- Returns all required fields: `item_type`, `item_type_id`, `uom_id`, `uom_name`, `uom_symbol`

**Updated stock_purchase_detail_api_view():**
- Added `prefetch_related` for efficient data loading of:
  - `items__item_code` (LabFurnitureItem)
  - `items__item_code__item_category`
  - `items__item_code__uom`
  - `items__item_code__item_type`

**Existing list_stock_purchases_api_view():**
- Already has prefetch_related for the same relations

### 3. Frontend Changes

#### File: `frontend/src/pages/StockPurchaseAddPage.jsx`

**Imports:**
- Added `listItemTypes` to import list from crudApi

**State Management:**
- Added `itemTypeOptions` state to store available ItemType values

**Data Loading:**
- Updated `useEffect` to fetch ItemTypes along with Vendors, LabFurnitureItems, Categories, and UOMs
- Properly handles both array and object responses from API

**Functions Updated:**

1. **dimensionPatchFromMaster():** 
   - Now includes `item_name` and `item_type` from LabFurnitureItem
   - Returns: length, width, height, volume, item_name, item_type

2. **handleItemCodeSelect():**
   - Now auto-fills `item_type` from selected LabFurnitureItem
   - Still allows manual editing for flexibility (duplicates allowed for different vendors)
   - Pulls all dimensions, name, and type from Item Master

3. **Item Type Dropdown:**
   - Changed from hardcoded ["BUY", "MAKE"] to dynamic options from `itemTypeOptions`
   - Shows full ItemType names as returned from API
   - Remains editable to allow overrides when needed

**Table Column Styling:**
- Item Category: 250px wide with text wrapping enabled
- Item Name: 300px wide with text wrapping enabled
- Item Code: 120px (compact)
- Item Type: 100px (compact)
- GRN No: 80px (compact)
- UOM: 90px (compact)
- Others: Appropriate widths for data display
- All long-text columns use `whiteSpace: "normal"` and `wordWrap: "break-word"` for responsive design

### 4. Database Migration

#### File: `erp_app/migrations/0046_backfill_stock_purchase_item_from_lab_furniture_item.py`

**Migration Purpose:**
- Backfills all existing StockPurchaseItem records with:
  - `item_name` from linked LabFurnitureItem
  - `item_type_id` from linked LabFurnitureItem
  - `uom_id` from linked LabFurnitureItem

**Backward Compatibility:**
- Only updates records that have an `item_code` (ForeignKey to LabFurnitureItem)
- Records without item_code are left unchanged
- Reverse migration is a no-op (data remains intact)
- Uses bulk_update for efficiency

### 5. Flow Diagram

```
User selects Item Category
  ↓
User selects Item Code
  ↓
[Frontend] handleItemCodeSelect() triggered
  ↓
[Frontend] Fetch LabFurnitureItem from itemMasterOptions
  ↓
[Frontend] Auto-populate:
  - item_name (read-only display)
  - item_type (editable dropdown from ItemType options)
  - uom_id (read-only, synced)
  - length, width, height, volume (read-only, synced)
  ↓
[User can override item_type if needed]
  ↓
Form submitted
  ↓
[Backend] StockPurchaseItem.save() pulls item_type & uom from LabFurnitureItem
  ↓
[API] _serialize_item() returns all fields from Item Master
  ↓
[Frontend] Displays complete record with all synced values
```

### 6. API Response Example

```json
{
  "id": 123,
  "grn_number": "GRN0123",
  "item_name": "Steel Plate A",
  "item_code": "SP001",
  "item_code_id": 5,
  "item_category": "Metal",
  "item_category_id": 2,
  "item_type": "BUY",
  "item_type_id": 1,
  "quantity": "100",
  "unit_price": "150.50",
  "total_price": "15050.00",
  "uom_id": 3,
  "uom_name": "KG",
  "uom_symbol": "kg",
  "length": "2000",
  "width": "1000",
  "height": "5",
  "volume": "10000.0"
}
```

## Field Mapping

| Field | Source | Editable | Note |
|-------|--------|----------|------|
| item_name | LabFurnitureItem | No | Auto-filled from Item Master |
| item_code | LabFurnitureItem | No | Selected from dropdown |
| item_type | LabFurnitureItem | Yes | Auto-filled but editable for flexibility |
| uom | LabFurnitureItem | No | Auto-synced, read-only |
| length | LabFurnitureItem | No | Read-only from Item Master |
| width | LabFurnitureItem | No | Read-only from Item Master |
| height | LabFurnitureItem | No | Read-only from Item Master |
| volume | LabFurnitureItem | No | Read-only from Item Master |
| quantity | User Input | Yes | Entry field |
| unit_price | User Input | Yes | Entry field |
| total_price | Calculated | No | quantity × unit_price |

## Backward Compatibility

✅ Fully backward compatible:
- Existing records without item_code references are unaffected
- Model fields retain all data, just now properly synced
- API continues to return all existing fields plus new derived values
- Frontend gracefully handles missing item types

## Testing Checklist

- [ ] Run migration: `python manage.py migrate erp_app 0046`
- [ ] Create new purchase with item code selection
- [ ] Verify auto-fill of item_name, item_type, uom
- [ ] Edit existing purchase record
- [ ] Verify all values load correctly
- [ ] Test item_type dropdown shows actual options
- [ ] Test manual override of item_type
- [ ] Verify table column widths adapt to content
- [ ] Test responsive design on mobile
- [ ] Verify no duplicate item codes in same invoice
- [ ] Check calculated total prices are correct

