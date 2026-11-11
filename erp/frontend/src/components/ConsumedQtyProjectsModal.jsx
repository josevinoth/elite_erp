import { useEffect, useState } from "react";
import { getLabFurnitureItemConsumedProjects } from "../services/crudApi";

export default function ConsumedQtyProjectsModal({ item, onClose }) {
  const [projects, setProjects] = useState([]);
  const [itemMeta, setItemMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!item?.id) return undefined;
    let isMounted = true;

    getLabFurnitureItemConsumedProjects(item.id)
      .then((data) => {
        if (!isMounted) return;
        if (!data?.success) {
          setError(data?.message || "Failed to load consumed quantities.");
          return;
        }
        setProjects(data.projects || []);
        setItemMeta(data);
      })
      .catch((err) => {
        if (isMounted) setError(err?.message || "Error loading consumed quantities.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [item?.id]);

  const formatQty = (value) => {
    const quantity = Number(value);
    return Number.isFinite(quantity) ? quantity.toFixed(2) : "0.00";
  };
  const itemCode = itemMeta?.item_code || item?.item_code || "";
  const itemName = itemMeta?.item_name || item?.item_name || "";
  const itemCategory = itemMeta?.item_category || item?.item_category || "";
  const totalConsumed = itemMeta?.total_consumed_qty ?? item?.consumed_qty ?? 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="costing-modal-card"
        onClick={(event) => event.stopPropagation()}
        style={{ maxWidth: "760px", width: "95%", maxHeight: "85vh", display: "flex", flexDirection: "column", gap: "0.85rem" }}
      >
        <div className="costing-modal-card__header">
          <div>
            <h3 className="costing-modal-card__title" style={{ margin: 0 }}>Consumed Quantity by Project</h3>
            <div style={{ color: "#64748b", fontSize: "0.82rem", marginTop: "4px" }}>
              <strong>{itemCode}</strong> — {itemName}{itemCategory ? ` • ${itemCategory}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <strong style={{ color: "#b45309" }}>Total: {formatQty(totalConsumed)}</strong>
            <button type="button" className="costing-modal-card__close" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
        </div>

        <div style={{ overflowY: "auto", minHeight: "120px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>Loading consumed quantities...</div>
          ) : error ? (
            <div style={{ padding: "1rem", color: "#991b1b", background: "#fef2f2", borderRadius: "6px" }}>{error}</div>
          ) : projects.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2.5rem", color: "#64748b" }}>
              No consumed quantities recorded for this item.
            </div>
          ) : (
            <table className="users-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Project ID + Project Name</th>
                  <th style={{ textAlign: "right", width: "160px" }}>Consumed Qty</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.project_id}>
                    <td>
                      <strong>{project.project_id}</strong>
                      {project.project_name ? ` - ${project.project_name}` : ""}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: "#b45309" }}>
                      {formatQty(project.consumed_qty)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="costing-modal-card__footer" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="users-btn users-btn--secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
