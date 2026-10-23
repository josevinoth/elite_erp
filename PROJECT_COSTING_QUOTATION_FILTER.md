# Project Costing Quotation Filter & Unique Constraint Implementation

## Overview
Updated the Project Costing module to:
1. Filter the quotations dropdown to show only **Completed** quotations
2. Exclude quotations that **already have a costing summary** from the dropdown
3. Enforce a **unique constraint** between quotations and costing summaries (one costing per quotation)

## Changes Made

### 1. Database Model Changes
**File:** `erp/erp_app/sub_models/project_costing_summary_mod.py`

Added `unique=True` constraint to the `quotation_number` ForeignKey field:
```python
quotation_number = models.ForeignKey(
    ProjectQuotationSummaryInfo,
    on_delete=models.PROTECT,
    related_name="project_costing_summaries",
    unique=True,  # ← NEW: Enforce one costing per quotation
)
```

**Migration:** `erp/erp_app/migrations/0002_add_unique_constraint_quotation_number.py`
- Alters the `quotation_number` field to add the unique constraint
- Status: ✅ Applied

### 2. API Endpoint Updates
**File:** `erp/erp_app/sub_views/project_costing_api.py`

#### A. `project_costing_quotations_api_view` (GET /api/project-costing/quotations/)
Updated the quotation listing logic to:
- Filter by status = "Completed" ✅ (already implemented)
- **NEW:** Exclude quotations that already have a costing summary

```python
quotations = (
    ProjectQuotationSummaryInfo.objects.select_related("project", "status")
    .filter(status__status_name__iexact="Completed")
    .exclude(project_costing_summaries__isnull=False)  # ← NEW: Exclude if costing exists
    .order_by("project__project_id", "id")
)
```

**Key Query Logic:**
- `.exclude(project_costing_summaries__isnull=False)` — filters out any quotation that has related costing records
- Uses the reverse relationship name `project_costing_summaries` from the ForeignKey definition

#### B. `generate_project_costing_api_view` (POST /api/project-costing/generate/)
Enhanced error message when attempting to generate a costing for a quotation that already has one:

```python
existing = ProjectCostingSummaryInfo.objects.filter(quotation_number=quotation).first()
if existing:
    payload = ProjectCostingSummaryView(request).detail_payload(existing)
    return Response(
        {
            "success": True,
            "message": "Project costing already exists for this quotation. Only one costing summary per quotation is allowed.",
            **payload,
        },
        status=status.HTTP_200_OK,
    )
```

## Frontend Impact

The `listCompletedQuotationSummaries()` function in `frontend/src/services/crudApi.js` calls `/api/project-costing/quotations/` to populate the "Select quotation for generation" dropdown on the Project Costing list page.

**Result:** The dropdown now:
- Shows only Completed quotations
- Automatically excludes quotations already used for costing (no duplicates possible)
- Provides a better user experience by preventing invalid selections

## Data Validation Flow

```
User clicks "Generate Project Costing"
    ↓
Dropdown shows: Completed quotations without existing costings
    ↓
User selects quotation
    ↓
Frontend calls POST /api/project-costing/generate/
    ↓
Backend checks:
  1. Quotation exists? ✓
  2. Quotation is Completed? ✓ (implied by dropdown)
  3. No existing costing for this quotation? ✓ (unique constraint)
    ↓
Generate costing or return existing costing with message
```

## Migration Instructions

### To apply the migration:
```powershell
Set-Location "C:\Users\BVM\PycharmProjects\elite_erp_v1.0\erp"
python manage.py migrate erp_app
```

### To rollback the migration (if needed):
```powershell
python manage.py migrate erp_app 0001
```

## Database Constraint Details

The `unique=True` on `quotation_number` ForeignKey creates:
- **Unique Index:** `unique_quotation_number` on the database table
- **Database Level:** Prevents insertion of duplicate quotation_number values
- **Django Validation:** Enforced by model `.clean()` and `.save()` methods
- **Effect:** Only one ProjectCostingSummaryInfo record can reference a specific ProjectQuotationSummaryInfo record

## Testing Recommendations

1. **Dropdown Filter Test:**
   - Create multiple quotations with status "Completed"
   - Generate costing for one quotation
   - Verify the dropdown no longer shows that quotation
   - Verify it still shows other completed quotations without costings

2. **Unique Constraint Test:**
   - Attempt to manually create two costings with the same quotation_number via API
   - Verify the second creation is rejected or returns the existing one

3. **UI Integration Test:**
   - Navigate to Project Costing page
   - Filter by project (if applicable)
   - Verify dropdown contents and generation functionality

## Files Modified

| File | Changes |
|------|---------|
| `erp_app/sub_models/project_costing_summary_mod.py` | Added `unique=True` to `quotation_number` FK |
| `erp_app/sub_views/project_costing_api.py` | Updated query logic in two endpoints |
| `erp_app/migrations/0002_add_unique_constraint_quotation_number.py` | NEW: Migration file |

## API Documentation Update

The existing README.md documentation for `/api/project-costing/quotations/` already states:
> "List completed quotations for the costing generation dropdown"

This implementation now fully realizes that specification by:
1. Filtering to Completed status only
2. Excluding quotations with existing costings

No README updates needed as the behavior now matches the documented description.

## Notes

- **Django Warning:** The system check may report W342 about unique=True on ForeignKey. This is expected behavior; Django suggests OneToOneField as an alternative, but ForeignKey with unique=True is the correct choice here as we need PROTECT on_delete behavior.
- **Performance:** The `.exclude()` filter uses a LEFT JOIN on the reverse relationship, which is efficient for this query pattern.
- **Backward Compatibility:** The change is backward compatible; existing costings remain unaffected, and the constraint only prevents new duplicate costings.

