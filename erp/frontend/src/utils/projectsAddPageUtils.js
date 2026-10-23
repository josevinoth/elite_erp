export function createLayoutDrawingRow(seed = 0) {
  return {
    id: null,
    tempId: `new_${Date.now()}_${seed}`,
    drawing_name: "",
    file_url: "",
    file_name: "",
    newFile: null,
    clear_file: false,
    level_one_approver: "",
    level_one_status: "",
    level_one_message: "",
    can_edit: true,
  };
}

export const EMPTY_FORM = {
  project_id: "",
  project_name: "",
  project_location: "",
  proposal_date: "",
  material_required_date: "",
  project_completion_date: "",
  mas_approved: "",
  advance_payment_received: "",
  prod_dwg_issued: "",
  prod_dwg_issued_justification: "",
  prod_dwg_release_date: "",
  prod_dwg_issued_sf: "",
  prod_dwg_issued_sf_justification: "",
  prod_dwg_release_date_sf: "",
  mas_justification: "",
  drawing_approved: "",
  drawing_justification: "",
  prev_proj_replica: "",
  project_category: "",
  project_sub_category: "",
  standard_lab: "",
  non_standard_lab: "",
  non_moe_product_series: "",
  project_owner: "",
  order_value_omr: "",
  description: "",
  status: "",
  expected_customer_need_date: "",
};

export const YESNO_FIELD_CONFIG = [
  { key: "advance_payment_received", label: "Advance Payment Received?" },
  { key: "prev_proj_replica", label: "Previous Project Replica?" },
];

const TEXT_KEYS = new Set([
  "project_id",
  "project_name",
  "project_location",
  "description",
  "prod_dwg_issued_justification",
  "prod_dwg_issued_sf_justification",
  "mas_justification",
  "drawing_justification",
]);

export function normalizeInputText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*([-_])\s*/g, "$1")
    .trimStart();
}

export function normalizePayloadValue(key, value) {
  if (!TEXT_KEYS.has(key)) {
    return value;
  }
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*([-_])\s*/g, "$1")
    .trim();
}

export function toDateInputValue(value) {
  const source = String(value || "").trim();
  if (!source) {
    return "";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    return source;
  }
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function normalizeOptionLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getOptionLabelByValue(options, value) {
  const selectedValue = String(value || "").trim();
  if (!selectedValue) {
    return "";
  }
  const found = options.find((opt) => String(opt?.value || "").trim() === selectedValue);
  return String(found?.label || "");
}

export function mapLayoutRowsFromApi(drawings = []) {
  return (Array.isArray(drawings) ? drawings : []).map((row, index) => ({
    id: row.id,
    tempId: String(row.id || `existing_${index}`),
    drawing_name: String(row.drawing_name || ""),
    file_url: String(row.file_url || ""),
    file_name: String(row.file_name || ""),
    newFile: null,
    clear_file: false,
    level_one_approver: row?.level_one_approver ? String(row.level_one_approver) : "",
    level_one_status: row?.level_one_status ? String(row.level_one_status) : "",
    level_one_message: String(row.level_one_message || ""),
    // Keep edit enabled unless API explicitly marks it as false.
    can_edit: row?.can_edit !== false,
  }));
}

export function buildLayoutRowsPayload(layoutDrawings) {
  const safeRows = Array.isArray(layoutDrawings) ? layoutDrawings : [];
  return safeRows.map((row) => ({
    ...row,
  }));
}

