import { useEffect, useMemo, useState } from "react";
import { getLabFurnitureItemRequestedProjects } from "../services/crudApi";

export default function TotalReqdProjectsModal({ item, onClose }) {
  const [projects, setProjects] = useState([]);
  const [itemMeta, setItemMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    project: "",
    qty: "",
    stage: "ALL",
  });

  const [sortConfig, setSortConfig] = useState({
    key: "project_id",
    direction: "asc",
  });

  useEffect(() => {
    if (!item?.id) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    getLabFurnitureItemRequestedProjects(item.id)
      .then((data) => {
        if (!isMounted) return;
        if (data && data.success) {
          setProjects(data.projects || []);
          setItemMeta({
            item_code: data.item_code,
            item_name: data.item_name,
            item_category: data.item_category,
            total_reqd: data.total_reqd,
          });
        } else {
          setError(data?.message || "Failed to load project requirements.");
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err?.message || "Error loading requested projects.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.id]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { key, direction: "asc" };
    });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) {
      return <span style={{ opacity: 0.35, fontSize: "0.75rem" }}>⇅</span>;
    }
    return (
      <span style={{ color: "#0284c7", fontWeight: "bold", fontSize: "0.8rem" }}>
        {sortConfig.direction === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filters.project.trim()) {
        const query = filters.project.trim().toLowerCase();
        const display = (p.project_display || "").toLowerCase();
        const code = (p.project_id || "").toLowerCase();
        const name = (p.project_name || "").toLowerCase();
        if (!display.includes(query) && !code.includes(query) && !name.includes(query)) {
          return false;
        }
      }

      if (filters.qty.trim()) {
        const numFilter = parseFloat(filters.qty);
        if (!isNaN(numFilter)) {
          if (Number(p.requested_qty) < numFilter) return false;
        } else {
          if (!String(p.requested_qty).includes(filters.qty.trim())) return false;
        }
      }

      if (filters.stage && filters.stage !== "ALL") {
        if ((p.stage || "").toUpperCase() !== filters.stage.toUpperCase()) {
          return false;
        }
      }

      return true;
    });
  }, [projects, filters]);

  const sortedProjects = useMemo(() => {
    const list = [...filteredProjects];
    if (!sortConfig.key) return list;

    return list.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      if (sortConfig.key === "requested_qty") {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (sortConfig.key === "project_id" || sortConfig.key === "project_display") {
        aVal = a.project_display || a.project_id || "";
        bVal = b.project_display || b.project_id || "";
      }

      const aStr = String(aVal || "").toLowerCase();
      const bStr = String(bVal || "").toLowerCase();
      if (aStr < bStr) return sortConfig.direction === "asc" ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortConfig]);

  const formatQty = (val) => {
    const num = Number(val);
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
  };

  const filteredTotalQty = useMemo(() => {
    const sum = sortedProjects.reduce((acc, p) => acc + (Number(p.requested_qty) || 0), 0);
    return formatQty(sum);
  }, [sortedProjects]);

  const displayedItemCode = itemMeta?.item_code || item?.item_code || "";
  const displayedItemName = itemMeta?.item_name || item?.item_name || "";
  const displayedCategory = itemMeta?.item_category || item?.item_category || "";
  const displayedTotalReqd = formatQty(itemMeta?.total_reqd ?? item?.total_reqd ?? 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="costing-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "920px",
          width: "95%",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
        }}
      >
        {/* Header */}
        <div
          className="costing-modal-card__header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.85rem 1rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 className="costing-modal-card__title" style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "1.1rem" }}>
                Project Requirements
              </h3>
              <span
                style={{
                  background: "#e0f2fe",
                  color: "#0369a1",
                  border: "1px solid #bae6fd",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.03em",
                }}
              >
                {displayedItemCode}
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "3px" }}>
              <strong>{displayedItemName}</strong>
              {displayedCategory ? ` \u2022 ${displayedCategory}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                textAlign: "right",
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                padding: "4px 12px",
                borderRadius: "8px",
              }}
            >
              <span style={{ fontSize: "0.72rem", color: "#166534", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", fontWeight: 600 }}>
                Total Reqd
              </span>
              <strong style={{ fontSize: "1.05rem", color: "#15803d" }}>
                {displayedTotalReqd}
              </strong>
            </div>

            <button
              type="button"
              className="costing-modal-card__close"
              onClick={onClose}
              aria-label="Close"
              style={{
                fontSize: "1.5rem",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#64748b",
                padding: "2px 6px",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#64748b", fontSize: "0.95rem" }}>
              Loading project requirements...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "1rem",
                background: "#fef2f2",
                color: "#991b1b",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                margin: "1rem 0",
              }}
            >
              {error}
            </div>
          ) : projects.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem",
                color: "#64748b",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
              }}
            >
              No active projects requesting <strong>{displayedItemCode}</strong>.
            </div>
          ) : (
            <div
              className="card-table-wrap"
              style={{
                maxHeight: "52vh",
                overflowY: "auto",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
              }}
            >
              <table className="users-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 3, background: "#f8fafc" }}>
                  <tr>
                    <th
                      onClick={() => handleSort("project_display")}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        padding: "8px 12px",
                        textAlign: "left",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>Project ID + Project Name</span>
                        {getSortIndicator("project_display")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("requested_qty")}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        width: "150px",
                        padding: "8px 12px",
                        textAlign: "right",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                        <span>Reqd Qty</span>
                        {getSortIndicator("requested_qty")}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("stage")}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        width: "140px",
                        padding: "8px 12px",
                        textAlign: "center",
                        borderBottom: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                        <span>Stage</span>
                        {getSortIndicator("stage")}
                      </div>
                    </th>
                  </tr>

                  {/* Filter inputs under header */}
                  <tr style={{ background: "#f1f5f9" }}>
                    <th style={{ padding: "5px 8px", borderBottom: "2px solid #cbd5e1" }}>
                      <input
                        type="text"
                        className="users-table__filter-input"
                        placeholder="Filter project ID or name..."
                        value={filters.project}
                        onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                        }}
                      />
                    </th>
                    <th style={{ padding: "5px 8px", borderBottom: "2px solid #cbd5e1" }}>
                      <input
                        type="text"
                        className="users-table__filter-input"
                        placeholder="Min qty..."
                        value={filters.qty}
                        onChange={(e) => setFilters((f) => ({ ...f, qty: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                          textAlign: "right",
                        }}
                      />
                    </th>
                    <th style={{ padding: "5px 8px", borderBottom: "2px solid #cbd5e1" }}>
                      <select
                        className="users-table__filter-input"
                        value={filters.stage}
                        onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))}
                        style={{
                          width: "100%",
                          padding: "4px 8px",
                          fontSize: "0.8rem",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          background: "#ffffff",
                        }}
                      >
                        <option value="ALL">All Stages</option>
                        <option value="Costing">Costing</option>
                        <option value="Quotation">Quotation</option>
                      </select>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No projects match the current filters.
                      </td>
                    </tr>
                  ) : (
                    sortedProjects.map((proj, idx) => (
                      <tr
                        key={`${proj.project_id}-${proj.stage}-${idx}`}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background 0.1s ease",
                        }}
                      >
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                            <strong style={{ color: "#0f172a" }}>{proj.project_id}</strong>
                            {proj.project_name && (
                              <span style={{ color: "#475569" }}>- {proj.project_name}</span>
                            )}
                            {proj.reference_no && (
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#64748b",
                                  background: "#f1f5f9",
                                  padding: "1px 6px",
                                  borderRadius: "4px",
                                  marginLeft: "4px",
                                }}
                              >
                                {proj.reference_no}
                              </span>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: "right", padding: "8px 12px" }}>
                          <span style={{ fontWeight: 700, color: "#0284c7", fontSize: "0.95rem" }}>
                            {formatQty(proj.requested_qty)}
                          </span>
                        </td>

                        <td style={{ textAlign: "center", padding: "8px 12px" }}>
                          {proj.stage === "Costing" ? (
                            <span
                              style={{
                                background: "#ecfdf5",
                                color: "#047857",
                                border: "1px solid #a7f3d0",
                                padding: "3px 10px",
                                borderRadius: "12px",
                                fontSize: "0.76rem",
                                fontWeight: 600,
                                display: "inline-block",
                              }}
                            >
                              Costing
                            </span>
                          ) : (
                            <span
                              style={{
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                border: "1px solid #bfdbfe",
                                padding: "3px 10px",
                                borderRadius: "12px",
                                fontSize: "0.76rem",
                                fontWeight: 600,
                                display: "inline-block",
                              }}
                            >
                              Quotation
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="costing-modal-card__footer"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.75rem 0.25rem 0",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Showing <strong>{sortedProjects.length}</strong> of <strong>{projects.length}</strong> project{projects.length === 1 ? "" : "s"}
            {sortedProjects.length > 0 && (
              <span style={{ marginLeft: "14px", color: "#0369a1", fontWeight: 600 }}>
                Filtered Reqd Sum: <strong>{filteredTotalQty}</strong>
              </span>
            )}
          </div>

          <button
            type="button"
            className="users-btn users-btn--secondary"
            onClick={onClose}
            style={{
              padding: "0.45rem 1.4rem",
              fontSize: "0.85rem",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

