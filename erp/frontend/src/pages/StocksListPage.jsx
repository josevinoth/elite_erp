import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BsBoxArrowUpRight } from "react-icons/bs";
import { listStockPurchases } from "../services/crudApi";

function StocksListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [filters, setFilters] = useState({
    grn_number: "",
    item_category: "",
    item_name: "",
    item_code: "",
    quantity: "",
  });

  useEffect(() => {
    let alive = true;

    const loadRows = async () => {
      setLoading(true);
      setStatus("");
      try {
        const data = await listStockPurchases();
        if (!alive) return;

        const purchases = Array.isArray(data?.stock_purchases) ? data.stock_purchases : [];
        const flattened = [];

        purchases.forEach((purchase) => {
          const items = Array.isArray(purchase?.items) ? purchase.items : [];
          items.forEach((item) => {
            flattened.push({
              key: `${purchase.id}-${item.id || item.item_code || item.item_name}`,
              purchase_id: purchase.id,
              grn_number: item.grn_number || "",
              item_category: item.item_category || "",
              item_name: item.item_name || "",
              item_code: item.item_code || "",
              quantity: item.quantity || "0",
            });
          });
        });

        setRows(flattened);
      } catch (error) {
        if (!alive) return;
        setRows([]);
        setStatus(error?.message || "Failed to load stocks.");
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadRows();
    return () => {
      alive = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const hasFilter = Object.values(filters).some((value) => String(value || "").trim());
    if (!hasFilter) return rows;

    return rows.filter((row) => {
      return Object.entries(filters).every(([key, filterValue]) => {
        const query = String(filterValue || "").trim().toLowerCase();
        if (!query) return true;
        return String(row[key] ?? "").toLowerCase().includes(query);
      });
    });
  }, [rows, filters]);

  const totalQty = useMemo(
    () => filteredRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    [filteredRows]
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="module-page">
      <div className="crud-page__header">
        <h1 className="module-page__title">Stocks List</h1>
        <button type="button" className="crud-add-btn" onClick={() => navigate("/stock-purchase")}>Stock Purchase</button>
      </div>

      {status ? <p className="users-status users-status--error">{status}</p> : null}
      {loading ? <p className="users-status">Loading...</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.5rem", marginTop: "0.8rem" }}>
        <input
          className="users-table__filter-input"
          placeholder="Filter GRN"
          value={filters.grn_number}
          onChange={(e) => handleFilterChange("grn_number", e.target.value)}
        />
        <input
          className="users-table__filter-input"
          placeholder="Filter Category"
          value={filters.item_category}
          onChange={(e) => handleFilterChange("item_category", e.target.value)}
        />
        <input
          className="users-table__filter-input"
          placeholder="Filter Item Name"
          value={filters.item_name}
          onChange={(e) => handleFilterChange("item_name", e.target.value)}
        />
        <input
          className="users-table__filter-input"
          placeholder="Filter Item Code"
          value={filters.item_code}
          onChange={(e) => handleFilterChange("item_code", e.target.value)}
        />
        <input
          className="users-table__filter-input"
          placeholder="Filter Qty"
          value={filters.quantity}
          onChange={(e) => handleFilterChange("quantity", e.target.value)}
        />
      </div>

      <div className="users-table-wrap" style={{ maxHeight: "62vh", overflowY: "auto" }}>
        <table className="users-table">
          <thead>
            <tr>
              <th>GRN Number</th>
              <th>Item Category</th>
              <th>Item Name</th>
              <th>Item Code</th>
              <th>Qty Purchased</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6}>No stock rows found.</td>
              </tr>
            ) : null}
            {filteredRows.map((row) => (
              <tr key={row.key}>
                <td>{row.grn_number}</td>
                <td>{row.item_category}</td>
                <td>{row.item_name}</td>
                <td>{row.item_code}</td>
                <td>{row.quantity}</td>
                <td>
                  <button
                    type="button"
                    className="users-action users-action--edit"
                    onClick={() => navigate(`/stock-purchase/record/${row.purchase_id}`)}
                    disabled={!row.purchase_id}
                    title="Open Purchase"
                    aria-label="Open Purchase"
                  >
                    <BsBoxArrowUpRight aria-hidden="true" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!loading ? <p className="users-status">Total Qty Purchased: {totalQty.toFixed(2)}</p> : null}
    </section>
  );
}

export default StocksListPage;

