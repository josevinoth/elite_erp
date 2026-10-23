# Stock Return Approval/Rejection Implementation

## Overview
Implemented Approved/Rejected buttons on the Stock Return page with rejection comment functionality, reusing the item rejection comments scenario from the Stock Retrieval page.

**URL**: http://localhost:5173/stock-return

## Changes Made

### 1. Frontend Service (`erp/frontend/src/services/crudApi.js`)

**Updated Function**: `updateStockReturnItem()`
- Added support for `rejectionComment` parameter
- Added support for `action` parameter (approve/reject)
- Now sends these parameters to the backend API

```javascript
export async function updateStockReturnItem(itemId, retrievalStatusName, rejectionComment = "", action = "") {
  const headers = await csrfHeaders();
  const res = await fetch(`/api/stock-return/${itemId}/`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify({ 
      retrieval_status_name: retrievalStatusName,
      rejection_comment: rejectionComment,
      action: action
    }),
  });
  return parseJson(res);
}
```

### 2. Frontend Component (`erp/frontend/src/pages/StockReturnPage.jsx`)

**Key Additions**:

#### State Management
- Added `rejectionDialog` state for handling rejection comment input
- Added `confirmModal` state for approval/rejection confirmation

#### New Callbacks
- `submitStatusUpdate()`: Main function to update item status with comments and action
- `openRejectionDialog()`: Opens dialog to input rejection comment
- `closeRejectionDialog()`: Closes rejection comment dialog
- `approveItem()`: Initiates approval workflow
- `confirmApprove()`: Confirms and applies approval (sets status to "Item Return Accepted")
- `rejectItem()`: Initiates rejection workflow (pre-fills with existing comment if any)
- `confirmReject()`: Confirms and applies rejection with comment (sets status to "Item Supplied")
- `cancelConfirm()`: Closes confirmation modal

#### UI Changes
- **Replaced dropdown** with two action buttons: "Approved" and "Rejected"
- **Added Action Column** to display the buttons
- **Added Modal Structure**:
  - Confirmation modal for both approve and reject actions
  - Shows item details and new status
  - For rejection: includes textarea for entering rejection comment
  - For approval: displays "Item Return Accepted (In-Stock)" status
- **Added Rejection Comments Column** in the table to display any rejection comments

#### Button Styling
- "Approved" button: `modal-btn--save` (green) class
- "Rejected" button: `modal-btn--cancel` (red) class

### 3. Backend API (`erp/erp_app/sub_views/project_costing_api.py`)

#### Imports Added
```python
from ..sub_models.stock_status_mod import StockStatusInfo
from ..sub_models.project_quotation_items_mod import _resolve_stock_status
```

#### Status Transition Map Updated
Added "return" source with valid transitions:
```python
"return": {
    RetrievalStatusInfo.STATUS_ITEM_RETURN,
    RetrievalStatusInfo.STATUS_ITEM_RETURN_ACCEPTED,
    RetrievalStatusInfo.STATUS_ITEM_SUPPLIED,  # Allow rejection back to Item Supplied
}
```

#### `stock_return_item_detail_api_view()` Function Updated
- Now accepts `action` and `rejection_comment` parameters from request
- Validates rejection comment is required when action is "reject"
- **On Approval** (status = "Item Return Accepted"):
  - Sets stock status to "In-Stock" (via `_resolve_stock_status()`)
  - Clears any rejection comment
  - Item becomes available for next project's item search
- **On Rejection** (status = "Item Supplied"):
  - Saves the rejection comment
  - Moves item back to "Item Supplied" status (previous stage)
  - Comment persists for reference
- Includes proper error handling and validation

## Workflow

### Approval Workflow
1. User clicks "Approved" button on a stock return item
2. Confirmation modal appears showing:
   - Item name, code, and costing ID
   - New status: "Item Return Accepted (In-Stock)"
3. User confirms the action
4. Backend:
   - Sets retrieval status to "Item Return Accepted"
   - Sets stock status to "In-Stock"
   - Clears rejection comment
5. Item is now available for next project's stock retrieval

### Rejection Workflow
1. User clicks "Rejected" button on a stock return item
2. Confirmation modal appears with:
   - Item details
   - New status: "Item Supplied"
   - Textarea for rejection comment (pre-filled if previously entered)
3. User enters rejection reason
4. User confirms the action
5. Backend:
   - Validates rejection comment is not empty
   - Sets retrieval status to "Item Supplied"
   - Saves rejection comment
   - Item moves back to previous stage
6. Comment is displayed in the "Rejection Comments" column

## Key Features

✅ **Reused Item Rejection Comments Scenario**: Uses the same confirmation modal and comment input pattern as Stock Retrieval page
✅ **Two-Step Confirmation**: Prevents accidental status changes with confirmation dialog
✅ **Stock Status Updates**: On approval, automatically sets stock to "In-Stock" for inventory availability
✅ **Comment Persistence**: Rejection comments are saved and displayed in the table
✅ **Status Tracking**: Clear indication of item status transitions
✅ **User-Friendly**: Intuitive button layout and clear status messages

## Database Fields Used

- `retrieval_status`: Tracks the return status (Item Return, Item Return Accepted, Item Supplied)
- `stock_status`: Tracks inventory status (In-Stock, No Stock, etc.)
- `rejection_comment`: Stores rejection reason (reused from retrieval workflow)

## API Endpoints

**PATCH** `/api/stock-return/{item_pk}/`

Request body:
```json
{
  "retrieval_status_name": "Item Return Accepted" or "Item Supplied",
  "rejection_comment": "Optional rejection reason",
  "action": "approve" or "reject"
}
```

Response:
```json
{
  "success": true,
  "item": {
    "id": 123,
    "costing_id": "PRJ-001",
    "item_name": "Chair",
    "stock_status": {"status_name": "In-Stock"},
    "retrieval_status": {"status_name": "Item Return Accepted"},
    "rejection_comment": "",
    ...
  }
}
```

## Testing Checklist

- [ ] Navigate to http://localhost:5173/stock-return
- [ ] Verify "Approved" and "Rejected" buttons are visible
- [ ] Click "Approved" button and confirm modal appears
- [ ] Approve an item and verify:
  - Status changes to "Item Return Accepted"
  - Stock status changes to "In-Stock"
  - Item becomes available for next project search
- [ ] Click "Rejected" button and confirm modal appears
- [ ] Reject an item with comment and verify:
  - Status changes to "Item Supplied"
  - Rejection comment is saved and displayed
  - Comment appears in "Rejection Comments" column
- [ ] Try rejecting without comment - should show error "Rejection comments are required"
- [ ] Verify only stock team or admin can perform actions
- [ ] Test with various items and comments

## Error Handling

- ❌ Attempting rejection without comment: Error message "Rejection comments are required."
- ❌ Invalid status transition: Error message "Invalid status transition from Stock Return."
- ❌ Permission denied: Error message "Only stock team or admin can update return status."
- ❌ Item not found: Error message "Project costing item not found."

## Future Enhancements

- Add email notifications when items are approved/rejected
- Add audit trail for approval/rejection actions
- Add bulk approval/rejection functionality
- Add filtering by approval status

