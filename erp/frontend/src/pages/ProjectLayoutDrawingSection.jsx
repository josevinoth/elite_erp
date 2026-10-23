import { useEffect, useState } from "react";
import { listProjectLayoutDrawings, saveProjectLayoutDrawings } from "../services/crudApi";
import {
  buildLayoutRowsPayload,
  createLayoutDrawingRow,
  mapLayoutRowsFromApi,
} from "../utils/projectsAddPageUtils";

function ProjectLayoutDrawingSection({
  projectId,
  isEditMode,
  savingProject,
  focusLayoutDrawingId,
  approverOptions,
  approvalStatusOptions,
}) {
  const [layoutDrawings, setLayoutDrawings] = useState(() => [createLayoutDrawingRow(0)]);
  const [layoutError, setLayoutError] = useState("");
  const [layoutStatus, setLayoutStatus] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);

  const isBusy = savingProject || savingLayout;

  // Load layout drawings when in edit mode
  useEffect(() => {
    if (!isEditMode || !projectId) {
      return;
    }
    let alive = true;
    listProjectLayoutDrawings(projectId)
      .then((layoutData) => {
        if (!alive) return;
        const loadedRows = mapLayoutRowsFromApi(layoutData.drawings);
        const normalizedRows = loadedRows.map((row) => ({
          ...row,
          file_url: String(row.file_url || ""),
          file_name: String(row.file_name || ""),
          newFile: null,
          clear_file: false,
          level_one_approver: row?.level_one_approver ? String(row.level_one_approver) : "",
          level_one_status: row?.level_one_status ? String(row.level_one_status) : "",
          level_one_message: String(row?.level_one_message || ""),
        }));
        setLayoutDrawings(normalizedRows.length ? normalizedRows : [createLayoutDrawingRow(0)]);
      })
      .catch(() => {
        if (alive) setLayoutDrawings([createLayoutDrawingRow(0)]);
      });
    return () => { alive = false; };
  }, [isEditMode, projectId]);

  // Scroll to section if linked
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("section") !== "layout-drawing") return;
    const target = document.getElementById("layout-drawing-approval-section");
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [layoutDrawings.length]);

  const canEditDrawingRow = (row) => !isEditMode || row?.id == null || Boolean(row?.can_edit);

  const updateLayoutDrawing = (rowTempId, field, value) => {
    setLayoutDrawings((prev) =>
      prev.map((row) => {
        if (row.tempId !== rowTempId || !canEditDrawingRow(row)) return row;
        return { ...row, [field]: value };
      })
    );
  };

  const addLayoutDrawingRow = () => {
    setLayoutDrawings((prev) => [...prev, createLayoutDrawingRow(prev.length)]);
  };

  const removeLayoutDrawingRow = (rowTempId) => {
    setLayoutDrawings((prev) => {
      const next = prev.filter((row) => row.tempId !== rowTempId);
      return next.length ? next : [createLayoutDrawingRow(0)];
    });
  };

  const handleLayoutFiles = (rowTempId, files) => {
    setLayoutDrawings((prev) =>
      prev.map((row) => {
        if (row.tempId !== rowTempId || !canEditDrawingRow(row)) return row;
        const selectedFiles = Array.from(files || []).filter((f) => f instanceof File);
        const selectedFile = selectedFiles[0] || null;
        const drawingName = String(row.drawing_name || "").trim();
        const autoName = !drawingName && selectedFile ? selectedFile.name : row.drawing_name;
        return {
          ...row,
          drawing_name: autoName,
          newFile: selectedFile,
          clear_file: false,
        };
      })
    );
  };

  const removeNewLayoutFile = (rowTempId) => {
    setLayoutDrawings((prev) =>
      prev.map((row) => {
        if (row.tempId !== rowTempId || !canEditDrawingRow(row)) return row;
        return { ...row, newFile: null };
      })
    );
  };

  const removeExistingAttachment = (rowTempId) => {
    setLayoutDrawings((prev) =>
      prev.map((row) => {
        if (row.tempId !== rowTempId || !canEditDrawingRow(row)) return row;
        return {
          ...row,
          file_url: "",
          file_name: "",
          clear_file: true,
        };
      })
    );
  };

  const rowHasUserInput = (row) => Boolean(
    String(row?.drawing_name || "").trim()
    || row?.newFile
    || row?.file_url
    || String(row?.level_one_approver || "").trim()
    || String(row?.level_one_status || "").trim()
    || String(row?.level_one_message || "").trim()
    || row?.clear_file
  );

  const normalizeRowsForSave = () => {
    const safeRows = Array.isArray(layoutDrawings) ? layoutDrawings : [];
    const keptRows = [];

    for (let index = 0; index < safeRows.length; index += 1) {
      const row = safeRows[index];
      const hasExistingFile = Boolean(row?.file_url) && !row?.clear_file;
      const hasNewFile = row?.newFile instanceof File;
      const hasInput = rowHasUserInput(row);

      // Ignore untouched placeholder rows created in the UI.
      if (!row?.id && !hasInput) {
        continue;
      }

      if (!hasExistingFile && !hasNewFile) {
        throw new Error(`Drawing row ${index + 1} requires a file. Please attach a file or remove the row.`);
      }

      keptRows.push(row);
    }

    return keptRows;
  };

  const handleSaveLayoutOnly = async () => {
    if (!isEditMode) return;
    setSavingLayout(true);
    setLayoutError("");
    setLayoutStatus("");
    try {
      const rowsToSave = normalizeRowsForSave();
      const data = await saveProjectLayoutDrawings(projectId, buildLayoutRowsPayload(rowsToSave));
      const syncedRows = mapLayoutRowsFromApi(data?.drawings || []);
      setLayoutDrawings(syncedRows.length ? syncedRows : [createLayoutDrawingRow(0)]);
      setLayoutStatus("Layout drawing updates saved.");
    } catch (err) {
      setLayoutError(err.message || "Unable to save layout drawing updates.");
    } finally {
      setSavingLayout(false);
    }
  };

  if (!isEditMode) {
    return (
      <div className="modal-form" style={{ paddingTop: 0 }}>
        <div
          className="modal-form__row projects-detail-form__full-row"
          style={{
            alignItems: "flex-start",
            marginTop: "0",
            backgroundColor: "#fff",
            borderRadius: "10px",
            border: "1px solid #d9dee8",
            boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
            padding: "1rem",
          }}
        >
          <div style={{ width: "100%" }}>
            <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1rem", fontWeight: 700 }}>Layout Drawing Approval</h3>
            <p className="users-status" style={{ margin: 0 }}>
              Save the project first. Layout drawing upload is available only in Project Edit.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-form" style={{ paddingTop: 0 }}>
      <div
        id="layout-drawing-approval-section"
        className="modal-form__row projects-detail-form__full-row"
        style={{
          alignItems: "flex-start",
          marginTop: "0",
          backgroundColor: "#fff",
          borderRadius: "10px",
          border: "1px solid #d9dee8",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
          padding: "1rem",
        }}
      >
        <div style={{ width: "100%" }}>
          <h3 style={{ margin: "0 0 0.75rem 0", fontSize: "1rem", fontWeight: 700 }}>Layout Drawing Approval</h3>
          {layoutError ? <p className="users-status users-status--error">{layoutError}</p> : null}
          {layoutStatus ? <p className="users-status users-status--success">{layoutStatus}</p> : null}

          {/* Drawing Rows header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <label className="modal-form__label" style={{ marginBottom: 0 }}>Drawings</label>
            <button
              type="button"
              className="crud-add-btn"
              onClick={addLayoutDrawingRow}
              disabled={isBusy}
            >
              + Add Drawing Row
            </button>
          </div>

          {/* Drawing Rows */}
          {layoutDrawings.map((row, rowIndex) => (
            <div
              key={row.tempId}
              style={{
                border: String(row.id || "") === String(focusLayoutDrawingId || "") ? "2px solid #2f6feb" : "1px solid #d8d8d8",
                borderRadius: "8px",
                padding: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "minmax(180px, 1.1fr) minmax(220px, 1.1fr) minmax(180px, 1fr) minmax(180px, 1fr) minmax(220px, 1.2fr)", alignItems: "start" }}>
                <div>
                  <label className="modal-form__label" htmlFor={`drawing-name-${row.tempId}`}>Drawing Name</label>
                  <input
                    id={`drawing-name-${row.tempId}`}
                    type="text"
                    className="auth-input"
                    value={row.drawing_name}
                    onChange={(e) => updateLayoutDrawing(row.tempId, "drawing_name", e.target.value)}
                    disabled={!canEditDrawingRow(row)}
                  />
                </div>

                <div>
                  <label className="modal-form__label" htmlFor={`drawing-files-${row.tempId}`}>Attach Drawings (All File Types)</label>
                  <input
                    id={`drawing-files-${row.tempId}`}
                    type="file"
                    className="auth-input"
                    onChange={(e) => {
                      handleLayoutFiles(row.tempId, e.target.files);
                      e.target.value = "";
                    }}
                    disabled={!canEditDrawingRow(row)}
                  />
                  <div style={{ marginTop: "0.25rem" }}>
                    {row.file_url ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <a href={row.file_url} target="_blank" rel="noreferrer">{row.file_name || row.drawing_name}</a>
                        <button
                          type="button"
                          className="modal-btn modal-btn--cancel"
                          onClick={() => removeExistingAttachment(row.tempId)}
                          disabled={isBusy || !canEditDrawingRow(row)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                    {row.newFile ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginTop: row.file_url ? "0.35rem" : 0 }}>
                        <span>{row.newFile.name}</span>
                        <button
                          type="button"
                          className="modal-btn modal-btn--cancel"
                          onClick={() => removeNewLayoutFile(row.tempId)}
                          disabled={isBusy || !canEditDrawingRow(row)}
                        >
                          Clear
                        </button>
                      </div>
                    ) : null}
                    {!row.file_url && !row.newFile ? (
                      <small style={{ display: "block", marginTop: "0.2rem", opacity: 0.75 }}>
                        After selecting a file, click Save to upload.
                      </small>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="modal-form__label" htmlFor={`layout-approver-${row.tempId}`}>Approver</label>
                  <select
                    id={`layout-approver-${row.tempId}`}
                    className="auth-input"
                    value={row.level_one_approver || ""}
                    onChange={(e) => updateLayoutDrawing(row.tempId, "level_one_approver", e.target.value)}
                  >
                    <option value="">Select Approver</option>
                    {approverOptions.map((opt) => (
                      <option key={`layout-approver-${row.tempId}-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="modal-form__label" htmlFor={`layout-status-${row.tempId}`}>Approval Status</label>
                  <select
                    id={`layout-status-${row.tempId}`}
                    className="auth-input"
                    value={row.level_one_status || ""}
                    onChange={(e) => updateLayoutDrawing(row.tempId, "level_one_status", e.target.value)}
                  >
                    <option value="">Select Status</option>
                    {approvalStatusOptions.map((opt) => (
                      <option key={`layout-status-${row.tempId}-${opt.value}`} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="modal-form__label" htmlFor={`layout-comments-${row.tempId}`}>Comments</label>
                  <textarea
                    id={`layout-comments-${row.tempId}`}
                    className="auth-input modal-form__textarea"
                    value={row.level_one_message || ""}
                    onChange={(e) => updateLayoutDrawing(row.tempId, "level_one_message", e.target.value)}
                    placeholder="Enter comments"
                  />
                </div>
              </div>

              {/* Remove row */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={() => removeLayoutDrawingRow(row.tempId)}
                  disabled={isBusy || layoutDrawings.length === 1 || !canEditDrawingRow(row)}
                >
                  Remove Row {rowIndex + 1}
                </button>
              </div>
            </div>
          ))}

          {/* Save */}
          <div className="modal-form__actions" style={{ marginTop: "0.35rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="modal-btn modal-btn--save"
              onClick={handleSaveLayoutOnly}
              disabled={isBusy}
            >
              {savingLayout ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProjectLayoutDrawingSection;

