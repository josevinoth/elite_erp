import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CrudPage from "../components/CrudPage";
import ConfirmPopupModal from "../components/ConfirmPopupModal";
import {
  createItemCodeName,
  deleteItemCodeName,
  listItemCodeNames,
  listLabFurnitureItemCategories,
  updateItemCodeName,
  updateLabFurnitureItemCategory,
} from "../services/crudApi";

const withCombinedItem = (row = {}) => {
  const code = (row.item_code || "").trim();
  const cat = (row.item_category || "").trim();
  const name = (row.item_name || "").trim();
  return {
    ...row,
    combined_item: [code, cat, name].filter(Boolean).join(" _ ") || "—",
  };
};

function EditableCategoryInput({
  value,
  onChange,
  options,
  isRequired,
  isReadOnly,
  onEditCategory,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const currentValue = String(value ?? "");
  const filteredOptions = useMemo(() => {
    const q = currentValue.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [options, currentValue]);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", width: "100%" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
          <input
            id="mf-item_category"
            type="text"
            className="auth-input"
            value={currentValue}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Type or select category..."
            required={isRequired}
            readOnly={isReadOnly}
            autoComplete="off"
            style={{ width: "100%", paddingRight: "36px" }}
          />
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            tabIndex={-1}
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#6b7280",
              fontSize: "0.85rem",
              padding: "4px 8px",
              display: "flex",
              alignItems: "center",
            }}
            title="Toggle categories list"
          >
            {open ? "▲" : "▼"}
          </button>
        </div>

        {Boolean(currentValue.trim()) && !isReadOnly && (
          <button
            type="button"
            onClick={() => onEditCategory && onEditCategory(currentValue, onChange)}
            title="Edit category master"
            style={{
              padding: "0.45rem 0.85rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              backgroundColor: "#f8fafc",
              color: "#334155",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              height: "38px",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#e2e8f0";
              e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            ✏️ Edit
          </button>
        )}
      </div>

      {open && options.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: "220px",
            overflowY: "auto",
            backgroundColor: "#ffffff",
            border: "1px solid #d9dce8",
            borderRadius: "6px",
            boxShadow: "0 6px 18px rgba(0,0,0,0.12)",
            zIndex: 9999,
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.label);
                  setOpen(false);
                }}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#334155",
                  backgroundColor:
                    opt.label.toLowerCase() === currentValue.trim().toLowerCase()
                      ? "#eff6ff"
                      : "transparent",
                  fontWeight:
                    opt.label.toLowerCase() === currentValue.trim().toLowerCase()
                      ? 600
                      : 400,
                  borderBottom: "1px solid #f1f5f9",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f8fafc")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor =
                    opt.label.toLowerCase() === currentValue.trim().toLowerCase()
                      ? "#eff6ff"
                      : "transparent")
                }
              >
                {opt.label}
              </div>
            ))
          ) : (
            <div style={{ padding: "8px 12px", fontSize: "0.85rem", color: "#64748b", fontStyle: "italic" }}>
              Press Save to create &ldquo;{currentValue.trim()}&rdquo; as a new category
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const COLUMNS = [
  {
    key: "combined_item",
    label: "Item Code _ Item Category _ Item Name",
    minWidth: "380px",
  },
  {
    key: "updated_by",
    label: "Updated By",
    width: "150px",
    minWidth: "130px",
  },
  {
    key: "updated_on",
    label: "Updated On",
    width: "190px",
    minWidth: "170px",
  },
];

const FIELDS = [
  {
    key: "item_category",
    label: "Item Category",
    required: true,
    getEditValue: (row) => row.item_category || "",
  },
  { key: "item_name", label: "Item Name", required: true },
  { key: "item_code", label: "Item Code", required: true },
];

function ItemCodeNamesPage() {
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modern Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: "",
    message: "",
    type: "warning",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    onConfirm: null,
    onCancel: null,
  });

  // Edit Category Dialog state
  const [editCategoryDialog, setEditCategoryDialog] = useState({
    open: false,
    catId: null,
    oldName: "",
    newName: "",
    onChangeFormCategory: null,
  });

  const requestConfirm = useCallback(
    ({ title, message, type = "warning", confirmLabel = "Confirm", cancelLabel = "Cancel" }) => {
      return new Promise((resolve) => {
        setConfirmModal({
          open: true,
          title,
          message,
          type,
          confirmLabel,
          cancelLabel,
          onConfirm: () => {
            setConfirmModal((prev) => ({ ...prev, open: false }));
            resolve(true);
          },
          onCancel: () => {
            setConfirmModal((prev) => ({ ...prev, open: false }));
            resolve(false);
          },
        });
      });
    },
    []
  );

  const showSuccessModal = useCallback(
    ({ title = "Success", message }) => {
      return new Promise((resolve) => {
        setConfirmModal({
          open: true,
          title,
          message,
          type: "success",
          confirmLabel: "OK",
          cancelLabel: null,
          onConfirm: () => {
            setConfirmModal((prev) => ({ ...prev, open: false }));
            resolve(true);
          },
          onCancel: () => {
            setConfirmModal((prev) => ({ ...prev, open: false }));
            resolve(true);
          },
        });
      });
    },
    []
  );

  const loadCategories = useCallback(async () => {
    const data = await listLabFurnitureItemCategories();
    const options = Array.isArray(data.item_categories)
      ? data.item_categories.map((category) => ({
          value: String(category.id),
          label: category.name,
        }))
      : [];
    setCategoryOptions(options);
    return options;
  }, []);

  useEffect(() => {
    loadCategories().catch(() => setCategoryOptions([]));
  }, [loadCategories]);

  const fetchFn = useCallback(async () => {
    const data = await listItemCodeNames();
    const rows = Array.isArray(data.item_code_names) ? data.item_code_names : [];
    return rows.map(withCombinedItem);
  }, []);

  const createFn = useCallback(
    async (payload) => {
      const newCat = (payload.item_category || "").trim();
      const existingMatch = categoryOptions.find(
        (c) => c.label.trim().toLowerCase() === newCat.toLowerCase()
      );
      if (!existingMatch && newCat) {
        const ok = await requestConfirm({
          title: "Confirm New Category",
          type: "info",
          message: `Category "${newCat}" does not exist in master records.\n\nIt will be created as a new category and assigned to this item code.\n\nDo you want to proceed?`,
          confirmLabel: "Create & Save",
          cancelLabel: "Cancel",
        });
        if (!ok) {
          const cancelErr = new Error("Category creation cancelled.");
          cancelErr.silent = true;
          throw cancelErr;
        }
      }

      const data = await createItemCodeName(payload);
      await loadCategories();
      await showSuccessModal({
        title: "Item Code Created",
        message: existingMatch
          ? `Item code "${payload.item_code}" created successfully under category "${existingMatch.label}".`
          : `New category "${newCat}" created and assigned to item code "${payload.item_code}" successfully.`,
      });
      return withCombinedItem(data.item_code_name);
    },
    [categoryOptions, loadCategories, requestConfirm, showSuccessModal]
  );

  const updateFn = useCallback(
    async (id, payload, editRow) => {
      const oldCat = (editRow?.item_category || "").trim();
      const newCat = (payload.item_category || "").trim();
      const isCatChanged = oldCat && newCat && oldCat.toLowerCase() !== newCat.toLowerCase();

      if (isCatChanged) {
        const existingMatch = categoryOptions.find(
          (c) => c.label.trim().toLowerCase() === newCat.toLowerCase()
        );

        if (existingMatch) {
          // Changed to another existing category
          const confirmed = await requestConfirm({
            title: "Confirm Category Change",
            type: "info",
            message: `You are changing the category for item code "${payload.item_code || editRow?.item_code}" from "${oldCat}" to "${existingMatch.label}".\n\nThis will also update the linked Stock Item Master record.\n\nDo you want to proceed?`,
            confirmLabel: "Apply Change",
            cancelLabel: "Cancel",
          });
          if (!confirmed) {
            const cancelErr = new Error("Category update cancelled.");
            cancelErr.silent = true;
            throw cancelErr;
          }
          payload.item_category_id = existingMatch.value;
          payload.item_category = existingMatch.label;
          payload.category_mode = "reassign";
        } else {
          // Renamed the category
          const confirmed = await requestConfirm({
            title: "Confirm Category Rename",
            type: "warning",
            message: `Renaming category "${oldCat}" to "${newCat}" will update this category master record and apply the changes across all linked items, stock items, quotations, and costings in the entire system.\n\nAre you sure you want to proceed?`,
            confirmLabel: "Rename Everywhere",
            cancelLabel: "Cancel",
          });
          if (!confirmed) {
            const cancelErr = new Error("Category rename cancelled.");
            cancelErr.silent = true;
            throw cancelErr;
          }
          payload.item_category_id = editRow.item_category_id;
          payload.item_category = newCat;
          payload.rename_category = true;
          payload.category_mode = "rename";
          payload.old_category_name = oldCat;
        }
      }

      const data = await updateItemCodeName(id, payload);
      await loadCategories();

      if (isCatChanged) {
        await showSuccessModal({
          title: "Category Updated",
          message: payload.rename_category
            ? `Category successfully renamed from "${oldCat}" to "${newCat}" across all linked records in the system.`
            : `Category successfully updated to "${newCat}".`,
        });
      }

      return withCombinedItem(data.item_code_name);
    },
    [categoryOptions, loadCategories, requestConfirm, showSuccessModal]
  );

  const handleOpenEditCategory = useCallback((currentVal, onChange) => {
    const raw = (currentVal || "").trim();
    if (!raw) return;
    const match = categoryOptions.find((c) => c.label.trim().toLowerCase() === raw.toLowerCase());
    if (!match) {
      requestConfirm({
        title: "Category Notice",
        type: "info",
        message: `"${raw}" is a new category that has not been saved to master yet.\n\nYou can edit the text directly in the field, or click Save to create it.`,
        confirmLabel: "OK",
        cancelLabel: null,
      });
      return;
    }
    setEditCategoryDialog({
      open: true,
      catId: match.value,
      oldName: match.label,
      newName: match.label,
      onChangeFormCategory: onChange,
    });
  }, [categoryOptions, requestConfirm]);

  const handleApplyCategoryEdit = useCallback(async () => {
    const { catId, oldName, newName, onChangeFormCategory } = editCategoryDialog;
    const trimmedNew = (newName || "").trim();
    if (!trimmedNew) {
      return;
    }
    if (trimmedNew.toLowerCase() === oldName.toLowerCase()) {
      setEditCategoryDialog((prev) => ({ ...prev, open: false }));
      return;
    }

    setEditCategoryDialog((prev) => ({ ...prev, open: false }));

    const confirmed = await requestConfirm({
      title: "Confirm Category Rename",
      type: "warning",
      message: `Renaming category "${oldName}" to "${trimmedNew}" will update this category master record and apply the changes across all linked items, stock items, quotations, and costings in the entire system.\n\nAre you sure you want to proceed?`,
      confirmLabel: "Rename Everywhere",
      cancelLabel: "Cancel",
    });

    if (confirmed) {
      try {
        await updateLabFurnitureItemCategory(catId, { name: trimmedNew });
        await loadCategories();
        if (typeof onChangeFormCategory === "function") {
          onChangeFormCategory(trimmedNew);
        }
        setRefreshKey((k) => k + 1);
        await showSuccessModal({
          title: "Category Updated",
          message: `Category successfully renamed from "${oldName}" to "${trimmedNew}" across all linked records in the system.`,
        });
      } catch (err) {
        await requestConfirm({
          title: "Update Failed",
          type: "danger",
          message: err?.message || "Failed to update category.",
          confirmLabel: "OK",
          cancelLabel: null,
        });
      }
    }
  }, [editCategoryDialog, requestConfirm, loadCategories, showSuccessModal]);

  const fields = useMemo(() => [
    {
      ...FIELDS[0],
      render: ({ value, onChange, isRequired, isReadOnly }) => (
        <EditableCategoryInput
          value={value}
          onChange={onChange}
          options={categoryOptions}
          isRequired={isRequired}
          isReadOnly={isReadOnly}
          onEditCategory={(val) => handleOpenEditCategory(val, onChange)}
        />
      ),
    },
    {
      ...FIELDS[1],
      type: "text",
    },
    {
      ...FIELDS[2],
      type: "text",
    },
  ], [categoryOptions, handleOpenEditCategory]);

  const computeValues = useCallback((changedKey, changedValue) => {
    if (changedKey === "item_code") {
      return { item_code: String(changedValue || "").toUpperCase().trimStart() };
    }
    return {};
  }, []);

  return (
    <>
      <CrudPage
        title="Item Code"
        columns={COLUMNS}
        fields={fields}
        fetchFn={fetchFn}
        createFn={createFn}
        updateFn={updateFn}
        deleteFn={deleteItemCodeName}
        computeValues={computeValues}
        includeAuditColumns={true}
        tableMaxHeight="60vh"
        tableWrapClassName="users-table-wrap--item-code-names"
        modalCardClassName="modal-card--item-master"
        stickyHeader
        defaultPageSize={20}
        refreshKey={refreshKey}
      />

      {/* Edit Category Dialog */}
      <ConfirmPopupModal
        open={editCategoryDialog.open}
        title="Edit Item Category"
        type="info"
        confirmLabel="Save & Apply"
        cancelLabel="Cancel"
        zIndex={4000}
        onCancel={() => setEditCategoryDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={handleApplyCategoryEdit}
      >
        <div style={{ marginTop: "0.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.45rem", fontSize: "0.86rem", fontWeight: 600, color: "#334155" }}>
            Category Name *
          </label>
          <input
            type="text"
            className="auth-input"
            value={editCategoryDialog.newName}
            onChange={(e) => setEditCategoryDialog((prev) => ({ ...prev, newName: e.target.value }))}
            style={{ width: "100%", fontSize: "0.95rem" }}
            autoFocus
          />
          <div style={{ marginTop: "0.55rem", fontSize: "0.8rem", color: "#64748b", lineHeight: 1.4 }}>
            Renaming this category updates the master record across all linked items, quotations, and costings in the system.
          </div>
        </div>
      </ConfirmPopupModal>

      {/* Main Confirmation & Feedback Modal */}
      <ConfirmPopupModal
        open={confirmModal.open}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmLabel={confirmModal.confirmLabel}
        cancelLabel={confirmModal.cancelLabel}
        zIndex={4100}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />
    </>
  );
}

export default ItemCodeNamesPage;
