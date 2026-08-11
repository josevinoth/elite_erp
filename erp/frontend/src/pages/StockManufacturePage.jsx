import { useEffect, useRef, useState } from "react";
import { BsCheckCircleFill, BsPencilSquare, BsPlusCircleFill, BsTrashFill, BsXCircleFill } from "react-icons/bs";
import {
  createStockManufactureItem,
  deleteStockManufactureItem,
  listLabFurnitureItemCategories,
  listLabFurnitureItems,
  listItemTypes,
  listStockManufactureItems,
  listUoms,
  updateStockManufactureItem,
} from "../services/crudApi";

// ─── helpers ─────────────────────────────────────────────────────────────────
const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const toCurrency = (v) => (Math.round((toNum(v) + Number.EPSILON) * 100) / 100).toFixed(2);
const toDim = (v) => (v == null || v === "" ? "0" : String(v));

let _rk = 1;
const nextKey = () => ++_rk;

const emptyAddRow = () => ({
  rowKey: nextKey(),
  item_category_id: "",
  item_code_id: "",
  item_name: "",
  item_type: "",
  item_type_id: "",
  uom_id: "",
  quantity: "",
  unit_price: "",
  total_price: "0.00",
  length: "0",
  width: "0",
  height: "0",
  volume: "0.0000",
});

const calcRow = (row) => ({
  ...row,
  total_price: toCurrency(toNum(row.quantity) * toNum(row.unit_price)),
  volume: (toNum(row.length) * toNum(row.width) * toNum(row.height)).toFixed(4),
});

// ─── shared table header ──────────────────────────────────────────────────────
function TableHead({ showAction }) {
  return (
    <thead>
      <tr>
        <th style={{ width: "280px", whiteSpace: "normal", wordWrap: "break-word" }}>Item Category</th>
        <th style={{ width: "130px" }}>Item Code</th>
        <th style={{ width: "300px", whiteSpace: "normal", wordWrap: "break-word" }}>Item Name</th>
        <th style={{ width: "120px" }}>Item Type</th>
        <th style={{ width: "120px" }}>GRN No.</th>
        <th style={{ width: "140px" }}>UOM</th>
        <th style={{ width: "100px" }}>Qty / Size</th>
        <th style={{ width: "130px" }}>Unit Price</th>
        <th style={{ width: "130px" }}>Total Price</th>
        <th style={{ width: "100px" }}>Length</th>
        <th style={{ width: "100px" }}>Width</th>
        <th style={{ width: "110px" }}>Height / Thk</th>
        <th style={{ width: "100px" }}>Volume</th>
        {showAction && <th style={{ width: "110px", textAlign: "center" }}>Action</th>}
      </tr>
    </thead>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
function StockManufacturePage() {
  // reference data
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [itemTypeOptions, setItemTypeOptions] = useState([]);
  const [uomOptions, setUomOptions] = useState([]);
  const itemMasterRef = useRef([]);

  // list
  const [listRows, setListRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // add section
  const [addMode, setAddMode] = useState(false);
  const [addRows, setAddRows] = useState([]);
  const [savingAdd, setSavingAdd] = useState(false);

  // inline edit
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // status
  const [status, setStatus] = useState({ msg: "", type: "" });
  const [isMobile, setIsMobile] = useState(false);

  const showStatus = (msg, type = "success") => setStatus({ msg, type });
  const clearStatus = () => setStatus({ msg: "", type: "" });

  // ── Load reference + list data ────────────────────────────────────────────
  const reloadList = () => {
    setLoading(true);
    listStockManufactureItems()
      .then((d) => setListRows(d.stock_manufacture_items || []))
      .catch(() => showStatus("Failed to load records.", "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    Promise.all([
      listLabFurnitureItemCategories(),
      listLabFurnitureItems(),
      listItemTypes(),
      listUoms(),
    ]).then(([catD, itemD, itD, uomD]) => {
      if (!alive) return;
      const masters = itemD.lab_furniture_items || [];
      setCategoryOptions(catD.item_categories || []);
      itemMasterRef.current = masters;
      setItemTypeOptions(Array.isArray(itD) ? itD : itD?.item_types || []);
      setUomOptions(Array.isArray(uomD) ? uomD : uomD?.uoms || []);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { reloadList(); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(media.matches);
    apply();
    if (media.addEventListener) {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    media.addListener(apply);
    return () => media.removeListener(apply);
  }, []);

  // ── helpers ───────────────────────────────────────────────────────────────
  const getMasterById = (id) => {
    const nid = String(id || "").trim();
    return nid ? itemMasterRef.current.find((m) => String(m.id) === nid) || null : null;
  };

  const getCodesForCategory = (categoryId) =>
    itemMasterRef.current
      .filter((m) => !categoryId || String(m.item_category_id || "") === String(categoryId || ""))
      .sort((a, b) => (a.item_code || "").localeCompare(b.item_code || ""));

  const masterPatch = (master) => master ? {
    item_code_id: String(master.id),
    item_category_id: master.item_category_id ? String(master.item_category_id) : "",
    item_name: master.item_name || "",
    item_type: master.item_type || "",
    item_type_id: master.item_type_id ? String(master.item_type_id) : "",
    uom_id: master.uom_id ? String(master.uom_id) : "",
    length: toDim(master.length),
    width: toDim(master.width),
    height: toDim(master.height),
  } : {
    item_code_id: "", item_name: "", item_type: "", item_type_id: "",
    uom_id: "", length: "0", width: "0", height: "0",
  };

  const toPayload = (r) => ({
    item_category_id: r.item_category_id || null,
    item_code_id: r.item_code_id || null,
    item_name: r.item_name,
    item_type_id: r.item_type_id || null,
    uom_id: r.uom_id || null,
    quantity: r.quantity || "0",
    unit_price: r.unit_price || "0",
    length: r.length || "0",
    width: r.width || "0",
    height: r.height || "0",
  });

  const validateManufactureRow = (row) => {
    if (!String(row.item_name || "").trim()) return "Item name is required.";
    if (!row.item_type_id) return "Item type is required.";
    if (!row.uom_id) return "UOM is required.";
    return "";
  };

  // ── ADD section handlers ──────────────────────────────────────────────────
  const startAdd = () => {
    clearStatus();
    setEditId(null);
    setEditForm(null);
    setAddRows([emptyAddRow()]);
    setAddMode(true);
  };

  const cancelAdd = () => { setAddMode(false); setAddRows([]); };

  const patchAddRow = (rowKey, patch) =>
    setAddRows((prev) => prev.map((r) => r.rowKey === rowKey ? calcRow({ ...r, ...patch }) : r));

  const handleAddCategory = (rowKey, val) =>
    patchAddRow(rowKey, { item_category_id: val, item_code_id: "", item_name: "", item_type: "", item_type_id: "", uom_id: "", length: "0", width: "0", height: "0" });

  const handleAddItemCode = (rowKey, val) =>
    patchAddRow(rowKey, masterPatch(getMasterById(val)));

  const handleAddField = (rowKey, key, val) => patchAddRow(rowKey, { [key]: val });

  const addNewRow = () => setAddRows((prev) => [...prev, emptyAddRow()]);

  const removeAddRow = (rowKey) => {
    if (addRows.length <= 1) return;
    setAddRows((prev) => prev.filter((r) => r.rowKey !== rowKey));
  };

  const saveAdd = async () => {
    const valid = addRows.filter((r) => String(r.item_name || "").trim());
    if (!valid.length) { showStatus("Select an item code for at least one row.", "error"); return; }

    const duplicateInDraft = new Set();
    for (const row of valid) {
      const rowError = validateManufactureRow(row);
      if (rowError) {
        showStatus(rowError, "error");
        return;
      }
      const codeId = String(row.item_code_id || "");
      if (codeId) {
        if (duplicateInDraft.has(codeId)) {
          showStatus("Duplicate item code found in new rows.", "error");
          return;
        }
        duplicateInDraft.add(codeId);
        if (listRows.some((existing) => String(existing.item_code_id || "") === codeId)) {
          showStatus("This item code already exists in Stock Manufacture.", "error");
          return;
        }
      }
    }

    setSavingAdd(true);
    clearStatus();
    try {
      for (const r of valid) await createStockManufactureItem(toPayload(r));
      showStatus(`${valid.length} record(s) created successfully.`);
      setAddMode(false);
      setAddRows([]);
      reloadList();
    } catch (err) {
      showStatus(err?.message || "Save failed.", "error");
    } finally {
      setSavingAdd(false);
    }
  };

  // ── EDIT inline handlers ──────────────────────────────────────────────────
  const startEdit = (row) => {
    clearStatus();
    setAddMode(false);
    setAddRows([]);
    setEditId(row.id);
    setEditForm(calcRow({
      item_category_id: row.item_category_id ? String(row.item_category_id) : "",
      item_code_id: row.item_code_id ? String(row.item_code_id) : "",
      item_name: row.item_name || "",
      item_type: row.item_type || "",
      item_type_id: row.item_type_id ? String(row.item_type_id) : "",
      uom_id: row.uom_id ? String(row.uom_id) : "",
      quantity: row.quantity || "",
      unit_price: row.unit_price || "",
      total_price: toCurrency(toNum(row.total_price)),
      length: toDim(row.length),
      width: toDim(row.width),
      height: toDim(row.height),
      volume: toDim(row.volume),
    }));
  };

  const cancelEdit = () => { setEditId(null); setEditForm(null); };

  const patchEdit = (patch) => setEditForm((prev) => calcRow({ ...prev, ...patch }));

  const handleEditCategory = (val) =>
    patchEdit({ item_category_id: val, item_code_id: "", item_name: "", item_type: "", item_type_id: "", uom_id: "", length: "0", width: "0", height: "0" });

  const handleEditItemCode = (val) => patchEdit(masterPatch(getMasterById(val)));

  const saveEdit = async () => {
    if (!editForm) return;
    const rowError = validateManufactureRow(editForm);
    if (rowError) { showStatus(rowError, "error"); return; }

    const editCodeId = String(editForm.item_code_id || "");
    const hasExistingDuplicate = listRows.some(
      (r) => String(r.id) !== String(editId) && String(r.item_code_id || "") === editCodeId
    );
    if (editCodeId && hasExistingDuplicate) {
      showStatus("This item code already exists in Stock Manufacture.", "error");
      return;
    }

    setSavingEdit(true);
    clearStatus();
    try {
      await updateStockManufactureItem(editId, toPayload(editForm));
      showStatus("Record updated successfully.");
      setEditId(null);
      setEditForm(null);
      reloadList();
    } catch (err) {
      showStatus(err?.message || "Update failed.", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── DELETE ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    clearStatus();
    try {
      await deleteStockManufactureItem(id);
      showStatus("Record deleted.");
      reloadList();
    } catch (err) {
      showStatus(err?.message || "Delete failed.", "error");
    }
  };

  // ── Shared editable row renderer ──────────────────────────────────────────
  const EditableRow = ({ row, onCategoryChange, onItemCodeChange, onFieldChange }) => (
    <>
      <td style={{ width: "280px" }}>
        <select className="auth-input" value={row.item_category_id}
          onChange={(e) => onCategoryChange(e.target.value)}>
          <option value="">Select category</option>
          {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </td>
      <td style={{ width: "130px" }}>
        <select className="auth-input" value={row.item_code_id}
          onChange={(e) => onItemCodeChange(e.target.value)}
          disabled={!row.item_category_id}>
          <option value="">Select code</option>
          {getCodesForCategory(row.item_category_id).map((m) =>
            <option key={m.id} value={m.id}>{m.item_code}</option>)}
        </select>
      </td>
      <td style={{ width: "300px", whiteSpace: "normal", wordWrap: "break-word" }}>
        <input className="auth-input auth-input--readonly" value={row.item_name} readOnly disabled placeholder="Auto-filled" />
      </td>
      <td style={{ width: "120px" }}>
        <select className="auth-input" value={row.item_type_id} onChange={() => {}} disabled title="Auto-filled">
          <option value="">Auto</option>
          {itemTypeOptions.map((it) => <option key={it.id} value={String(it.id)}>{it.it_name}</option>)}
        </select>
      </td>
      <td style={{ width: "120px" }}>
        <input className="auth-input auth-input--readonly" value="Auto" readOnly disabled />
      </td>
      <td style={{ width: "140px" }}>
        <select className="auth-input" value={row.uom_id} onChange={() => {}} disabled title="Auto-filled">
          <option value="">UOM</option>
          {uomOptions.map((u) => <option key={u.id} value={String(u.id)}>{u.name} ({u.symbol})</option>)}
        </select>
      </td>
      <td style={{ width: "100px" }}>
        <input type="number" step="any" className="auth-input" value={row.quantity}
          onChange={(e) => onFieldChange("quantity", e.target.value)} placeholder="0" />
      </td>
      <td style={{ width: "130px" }}>
        <input type="number" step="any" className="auth-input" value={row.unit_price}
          onChange={(e) => onFieldChange("unit_price", e.target.value)} placeholder="0.00" />
      </td>
      <td style={{ width: "130px" }}>
        <input className="auth-input auth-input--readonly" value={row.total_price} readOnly disabled />
      </td>
      <td style={{ width: "100px" }}>
        <input type="number" step="any" className="auth-input auth-input--readonly" value={row.length} readOnly disabled title="Synced from Item Master" />
      </td>
      <td style={{ width: "100px" }}>
        <input type="number" step="any" className="auth-input auth-input--readonly" value={row.width} readOnly disabled title="Synced from Item Master" />
      </td>
      <td style={{ width: "110px" }}>
        <input type="number" step="any" className="auth-input auth-input--readonly" value={row.height} readOnly disabled title="Synced from Item Master" />
      </td>
      <td style={{ width: "100px" }}>
        <input className="auth-input auth-input--readonly" value={row.volume} readOnly disabled />
      </td>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="module-page">
      {/* Page header */}
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title" style={{ margin: 0 }}>Stock Manufacture</h1>
        {!addMode && (
          <button type="button" className="crud-add-btn" onClick={startAdd}>
            <BsPlusCircleFill aria-hidden="true" /> Add
          </button>
        )}
      </div>

      {/* Status banner */}
      {status.msg ? (
        <p style={{
          background: status.type === "success" ? "#22bb33" : "orange",
          color: "#fff", padding: "0.5rem 1rem", borderRadius: 6, marginBottom: "0.8rem",
        }}>{status.msg}</p>
      ) : null}

      {/* ── ADD SECTION ─────────────────────────────────────────────────── */}
      {addMode && (
        <div className="stock-purchase-add-form__row--full" style={{ marginBottom: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <h3 style={{ margin: 0 }}>New Manufacture Items</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="crud-add-btn" onClick={addNewRow} disabled={savingAdd}>
                <BsPlusCircleFill aria-hidden="true" /> Add Row
              </button>
              <button type="button" className="modal-btn modal-btn--cancel" onClick={cancelAdd} disabled={savingAdd}>Cancel</button>
              <button type="button" className="modal-btn modal-btn--save" onClick={saveAdd} disabled={savingAdd}>
                {savingAdd ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <div className="users-table-wrap" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
            <table className="users-table users-table--sp-items">
              <TableHead showAction />
              <tbody>
                {addRows.map((row) => (
                  <tr key={row.rowKey}>
                    <EditableRow
                      row={row}
                      onCategoryChange={(v) => handleAddCategory(row.rowKey, v)}
                      onItemCodeChange={(v) => handleAddItemCode(row.rowKey, v)}
                      onFieldChange={(k, v) => handleAddField(row.rowKey, k, v)}
                    />
                    <td style={{ width: "110px", verticalAlign: "middle", textAlign: "center" }}>
                      <button type="button" className="users-action users-action--delete"
                        onClick={() => removeAddRow(row.rowKey)}
                        disabled={addRows.length <= 1 || savingAdd}
                        title={addRows.length <= 1 ? "At least one row required" : "Remove row"}
                        style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        <BsTrashFill aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LIST TABLE ──────────────────────────────────────────────────── */}
      <div className="users-table-wrap" style={{ overflowX: "scroll", WebkitOverflowScrolling: "touch" }}>
        <table className="users-table users-table--sp-items">
          <TableHead showAction />
          <tbody>
            {loading && (
              <tr><td colSpan={14} style={{ textAlign: "center", padding: "1rem" }}>Loading...</td></tr>
            )}
            {!loading && listRows.length === 0 && (
              <tr><td colSpan={14} style={{ textAlign: "center", padding: "1rem", color: "#888" }}>No records found.</td></tr>
            )}
            {listRows.map((row) => (
              <tr key={row.id}>
                {editId === row.id && editForm ? (
                  <>
                    <EditableRow
                      row={editForm}
                      onCategoryChange={handleEditCategory}
                      onItemCodeChange={handleEditItemCode}
                      onFieldChange={(k, v) => patchEdit({ [k]: v })}
                    />
                    <td style={{ width: "110px", verticalAlign: "middle", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                        <button type="button" className="modal-btn modal-btn--save"
                          style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                          title="Save"
                          onClick={saveEdit} disabled={savingEdit}>
                          <BsCheckCircleFill aria-hidden="true" />
                        </button>
                        <button type="button" className="modal-btn modal-btn--cancel"
                          style={{ padding: "3px 10px", fontSize: "0.78rem" }}
                          title="Cancel"
                          onClick={cancelEdit} disabled={savingEdit}>
                          <BsXCircleFill aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ width: "280px", whiteSpace: "normal", wordWrap: "break-word" }}>{row.item_category}</td>
                    <td style={{ width: "130px" }}>{row.item_code}</td>
                    <td style={{ width: "300px", whiteSpace: "normal", wordWrap: "break-word" }}>{row.item_name}</td>
                    <td style={{ width: "120px" }}>{row.item_type}</td>
                    <td style={{ width: "120px" }}>Auto</td>
                    <td style={{ width: "140px" }}>{row.uom}</td>
                    <td style={{ width: "100px", textAlign: "right" }}>{row.quantity}</td>
                    <td style={{ width: "130px", textAlign: "right" }}>{row.unit_price}</td>
                    <td style={{ width: "130px", textAlign: "right" }}>{row.total_price}</td>
                    <td style={{ width: "100px", textAlign: "right" }}>{row.length}</td>
                    <td style={{ width: "100px", textAlign: "right" }}>{row.width}</td>
                    <td style={{ width: "110px", textAlign: "right" }}>{row.height}</td>
                    <td style={{ width: "100px", textAlign: "right" }}>{row.volume}</td>
                    <td style={{ width: "110px", verticalAlign: "middle", textAlign: "center" }}>
                      <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                        <button type="button" className="users-action users-action--edit"
                          onClick={() => startEdit(row)} title="Edit"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <BsPencilSquare aria-hidden="true" />
                        </button>
                        <button type="button" className="users-action users-action--delete"
                          onClick={() => handleDelete(row.id)} title="Delete"
                          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          <BsTrashFill aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default StockManufacturePage;

