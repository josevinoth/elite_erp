# How to Test: Items Not Yet Purchased in Quotation

## Scenario: Adding Item NOT in Purchase System

### Prerequisites
- You have a ProjectQuotation open
- You have item master data loaded
- You want to add an item to quotation that hasn't been purchased yet

---

## Step-by-Step Test

### 1. Start Adding New Item
```
Click: "+ Add Item" button
Expected: Draft row appears in quotation items table
```

### 2. Select Item Category
```
Action: Click Item Category dropdown
Expected: List of categories appears
Select: Any category (e.g., "Equipment")
```

### 3. Select Item Name
```
Action: Click Item Name dropdown
Expected: Names filtered by selected category appear
Select: Any item name
```

### 4. Select Item Code
```
Action: Click Item Code dropdown
Expected: Codes filtered by category + name appear
Select: An item that is NOT in purchase history
```

### 5. What System Shows

**For Item NOT in Purchase:**
```
Purchase Qty: 0 (grayed out, read-only)
Max Cost: 0 (grayed out, read-only)
Min Cost: 0 (grayed out, read-only)
Actual Cost: [EMPTY] (YELLOW background, editable)
Stock Status: "Not Purchased" (gray badge)

Message: "Item not yet purchased. Please enter Actual Cost manually."
```

**For Item IN Purchase:**
```
Purchase Qty: [auto-filled from purchase history]
Max Cost: [fetched from cost preview]
Min Cost: [fetched from cost preview]
Actual Cost: [auto-filled from cost preview]
Stock Status: "In-Stock" or "Partial Stock" (green/orange badge)

Message: "Requested Qty is within Purchase Qty."
```

### 6. Enter Custom Cost (For Not Purchased Item)
```
Action: Click Actual Cost field
Expected: Field highlights, ready for input
Type: Any positive number (e.g., 500.00)
Expected: Field shows yellow background with value
Expected: Total Cost auto-calculates (Actual Cost × Requested Qty)
```

### 7. Enter Requested Quantity
```
Action: Click Requested Qty field
Expected: Field ready for input
Type: Any positive number (e.g., 100)
Expected: Total Cost auto-updates
```

### 8. Save Item
```
Action: Click checkmark icon (Save button)
Expected: Validation runs
Expected: Warning popup appears:
  "Item not yet purchased. You can enter custom cost.
   Do you want to proceed?"
```

### 9. Confirm Override
```
Action: Click "Yes" button
Expected: Record saves successfully
Expected: Success message shown
Expected: Item appears in quotation items list
Expected: Cost fields visible: Max=0, Min=0, Actual=[your value], Total=[calculated]
```

### 10. Verify Table Display
```
Quotation Items Table should show all columns:

✓ Item Category
✓ Item Name
✓ Item Code
✓ Item Type
✓ Purchase Qty = 0
✓ Requested Qty = [your value]
✓ Stock Status = "Not Purchased" (gray badge)
✓ Max Cost = 0
✓ Min Cost = 0
✓ Actual Cost = [your entered value]
✓ Total Cost = [calculated value]
✓ Length = [from item master]
✓ Width = [from item master]
✓ Height = [from item master]
✓ Volume = [from item master]
```

---

## Edge Cases to Test

### Test 1: Item Not Purchased, No Cost Entered
```
Steps:
1. Select item not in purchase
2. Leave Actual Cost empty
3. Try to save

Expected Result:
❌ Error message: "Actual Cost must be set when item is not yet purchased."
❌ Save is blocked until cost is entered
```

### Test 2: Item Not Purchased, Zero Cost Entered
```
Steps:
1. Select item not in purchase
2. Enter 0 in Actual Cost field
3. Try to save

Expected Result:
❌ Error message: "Actual Cost must be set when item is not yet purchased."
❌ Save is blocked (0 is treated as not set)
```

### Test 3: Item Not Purchased, Valid Cost, Requested Qty Empty
```
Steps:
1. Select item not in purchase
2. Enter cost: 500
3. Leave Requested Qty empty
4. Try to save

Expected Result:
✓ Warning dialog appears: "Item not yet purchased..."
✓ Click Yes to confirm
✓ Record saves with Requested Qty = 0
✓ Total Cost = 0 (since requested qty is 0)
```

### Test 4: Edit Existing Item (Not Purchased)
```
Steps:
1. Have an existing "Not Purchased" item in quotation
2. Click edit icon
3. Change Requested Qty from 100 to 50
4. Click save checkmark

Expected Result:
✓ Warning dialog appears again
✓ Total Cost auto-updates to 50 × [cost]
✓ Record updates successfully
```

### Test 5: Compare with Item IN Purchase
```
Steps:
1. Add an item that IS in purchase history
2. Verify it auto-fills costs

Expected Result:
✓ Purchase Qty auto-filled
✓ Max Cost auto-filled
✓ Min Cost auto-filled
✓ Actual Cost auto-filled
✓ Stock Status shows "In-Stock" (green) or "Partial Stock" (orange)
✓ No warning message about custom cost
✓ Can save immediately if requested_qty ≤ purchase_qty
```

---

## User Interface Checks

### Cost Fields Visibility
- [ ] Max Cost column visible in table
- [ ] Min Cost column visible in table
- [ ] Actual Cost column visible in table
- [ ] Total Cost column visible in table
- [ ] All cost fields right-aligned
- [ ] Values display with 2 decimal places

### Visual Indicators
- [ ] Read-only fields (Max, Min, Total) have gray background
- [ ] Actual Cost field has yellow background when item not purchased
- [ ] Stock Status badge shows correct color:
  - [ ] Gray for "Not Purchased"
  - [ ] Green for "In-Stock"
  - [ ] Orange for "Partial Stock"
  - [ ] Red for "No Stock"

### Tooltips
- [ ] Hover over Actual Cost field shows tooltip text
- [ ] Tooltip explains "Enter custom cost - item not yet purchased" for non-purchased items

---

## Messages to Verify

### When selecting Item NOT in Purchase:
```
✓ "Item not yet purchased. Please enter Actual Cost manually."
  (Display color: ORANGE/WARNING)
```

### When saving Item NOT in Purchase:
```
✓ "Item not yet purchased. You can enter custom cost.

Do you want to proceed?"
(Popup confirmation dialog with Yes/No buttons)
```

### When saving Item IN Purchase (High Quantity):
```
✓ "Requested Qty is higher than Purchase Qty.

Do you want to proceed?"
(Popup confirmation dialog with Yes/No buttons)
```

### Success Message After Save:
```
✓ "Quotation item added successfully."
  (Display color: GREEN/SUCCESS)
```

---

## Common Issues & Solutions

### Issue: Actual Cost field not editable (grayed out)
**Solution:** Item may be from purchase. Check Purchase Qty value.
- If Purchase Qty > 0, field should be editable
- If Purchase Qty = 0, field should have yellow background

### Issue: Warning dialog not appearing
**Solution:** Check browser console for JavaScript errors
- Open DevTools (F12)
- Check Console tab for any error messages
- Verify window.confirm is not blocked

### Issue: Total Cost not calculating
**Solution:** Check that:
1. Actual Cost field has a valid number
2. Requested Qty field has a valid number
3. Both are positive values
4. No validation errors are showing

### Issue: Save button appears to do nothing
**Solution:** 
1. Check if validation error message appeared above table
2. Read the error message (e.g., "Actual Cost must be set...")
3. Fix the issue mentioned in error
4. Try saving again

---

## Performance Checks

- [ ] Page loads within 3 seconds
- [ ] Adding item response within 1 second
- [ ] Dropdowns populate within 500ms
- [ ] Table renders smoothly with new item
- [ ] No console errors after operations
- [ ] No memory leaks (check DevTools Memory tab)

---

## Regression Tests

### Ensure Existing Features Still Work:
- [ ] Can still add items FROM purchase system
- [ ] Cost auto-fills for purchased items
- [ ] Requested Qty > Purchase Qty warning still works
- [ ] Duplicate item code detection still works
- [ ] Edit existing quotation items still works
- [ ] Delete quotation items still works
- [ ] Summary calculation still works
- [ ] Save quotation summary still works

---

## Sign-Off

When all tests pass:
```
✓ Feature working as expected
✓ No regressions found
✓ User experience satisfactory
✓ Ready for production
```

---

## Quick Reference: Column Order

```
1. Item Category         (editable dropdown)
2. Item Name             (editable dropdown)
3. Item Code             (editable dropdown)
4. Item Type             (read-only)
5. Purchase Qty          (read-only)
6. Requested Qty         (editable input)
7. Stock Status          (read-only badge)
8. Max Cost              (read-only)          ← NEW
9. Min Cost              (read-only)          ← NEW
10. Actual Cost          (editable)           ← NEW
11. Total Cost           (read-only)          ← NEW
12. Length              (read-only)
13. Width               (read-only)
14. Height              (read-only)
15. Volume              (read-only)
16. Action              (edit/delete buttons)
```

Total columns: 16 (was 12 before update)

---

Test Date: _______________
Tested By: _______________
Status: ☐ PASS / ☐ FAIL

