import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getStockPurchaseItemTrace } from "../services/crudApi";

function StockPurchaseItemTracePage() {
  const { itemId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [traceData, setTraceData] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    getStockPurchaseItemTrace(itemId)
      .then((data) => {
        if (!alive) return;
        setTraceData(data.item_trace || null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "Failed to load trace details.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [itemId]);

  const item = traceData?.item || {};
  const modules = Array.isArray(traceData?.modules) ? traceData.modules : [];

  return (
    <section className="module-page crud-page">
      <div className="crud-page__header">
        <h1 className="module-page__title module-page__title--traceability">Traceability</h1>
      </div>

      {loading ? <p className="users-status">Loading trace details...</p> : null}
      {error ? <p className="users-status users-status--error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <div className="users-table-wrap" style={{ marginBottom: "1rem" }}>
            <table className="users-table">
              <tbody>
                <tr>
                  <td style={{ width: "220px" }}>Purchase Item ID</td>
                  <td>{item.id || "-"}</td>
                </tr>
                <tr>
                  <td>GRN Number</td>
                  <td>{item.grn_number || "-"}</td>
                </tr>
                <tr>
                  <td>Item Code</td>
                  <td>{item.item_code || "-"}</td>
                </tr>
                <tr>
                  <td>Item Name</td>
                  <td>{item.item_name || "-"}</td>
                </tr>
                <tr>
                  <td>Purchase Number</td>
                  <td>{item.purchase_number || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="users-table-wrap">
            <table className="users-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Reference</th>
                  <th>Project Number</th>
                  <th>Project Name</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {modules.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No linked modules found for this item.</td>
                  </tr>
                ) : (
                  modules.map((m, index) => (
                    <tr key={`${m.module}-${m.id || index}`}>
                      <td>{m.module || "-"}</td>
                      <td>{m.label || "-"}</td>
                      <td>{m.module === "Project" ? (m.label || "-") : "-"}</td>
                      <td>{m.meta?.project_name || "-"}</td>
                      <td>
                        {m.link ? (
                          <a href={m.link} target="_blank" rel="noopener noreferrer">
                            Open
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}

export default StockPurchaseItemTracePage;

