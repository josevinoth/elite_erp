import {useEffect, useMemo, useState} from "react";
import {BsPencilSquare, BsTrashFill} from "react-icons/bs";
import {Link, useNavigate} from "react-router-dom";
import {deleteLceEstimateById, listLceEstimates} from "../services/crudApi";
import TableSearchAndDownload from "../components/TableSearchAndDownload";

function LceListPage() {
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchText, setSearchText] = useState("");
    const [columnFilters, setColumnFilters] = useState({});

    const filteredRows = useMemo(() => {
      // Global search first
      const searchLower = searchText.trim().toLowerCase();
      const globalSearched = searchLower
        ? rows.filter((row) =>
            Object.values(row).some((value) =>
              String(value || "").toLowerCase().includes(searchLower)
            )
          )
        : rows;

      // Then apply per-column filters
      const activeFilters = Object.entries(columnFilters).filter(
        ([, value]) => String(value || "").trim()
      );

      if (!activeFilters.length) return globalSearched;

      return globalSearched.filter((row) =>
        activeFilters.every(([key, filterValue]) =>
          String(row[key] || "")
            .toLowerCase()
            .includes(String(filterValue).trim().toLowerCase())
        )
      );
    }, [rows, searchText, columnFilters]);

    const tableColumns = [
      { key: "id", label: "LCE ID", exportValue: (row) => `LCE_${String(row.id).padStart(3, "0")}` },
      { key: "date", label: "Date" },
      { key: "total_supplier_price", label: "Supplier Price" },
      { key: "total_supplier_price_omr", label: "Supplier Price (OMR)" },
      { key: "total", label: "Total" },
    ];

    const loadRows = () => {
        setLoading(true);
        setError("");
        return listLceEstimates()
            .then((data) => {
                setRows(Array.isArray(data.lce_estimates) ? data.lce_estimates : []);
            })
            .catch((err) => {
                setRows([]);
                setError(err.message || "Failed to load LCE records.");
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadRows().catch(() => {
        });
    }, []);

    const formatLceId = (id) => `LCE_${String(id).padStart(3, "0")}`;

    const handleDelete = async (row) => {
        if (!window.confirm(`Delete ${formatLceId(row.id)}?`)) {
            return;
        }
        try {
            await deleteLceEstimateById(row.id);
            await loadRows();
        } catch (err) {
            setError(err.message || "Delete failed.");
        }
    };

    return (
        <section className="module-page">
            <div className="crud-page__header" style={{marginBottom: "0.8rem"}}>
                <h1 className="module-page__title module-page__title--projects" style={{margin: 0}}>LCE List</h1>
                <Link
                    className="crud-add-btn"
                    title="LCE ADD"
                    to="/projects/costing/add"
                    style={{textDecoration: "none"}}
                >
                    LCE ADD
                </Link>
            </div>
            <p className="module-page__description" style={{marginBottom: "0.9rem"}}>
                Showing saved LCE records. Click Edit to update a record.
            </p>

            {loading ? <p className="users-status">Loading LCE records...</p> : null}
            {error ? <p className="users-status users-status--error">{error}</p> : null}

            {!loading ? (
                <>
                  <TableSearchAndDownload
                    rows={filteredRows}
                    columns={tableColumns}
                    title="LCE List"
                    onSearchChange={setSearchText}
                    showDownloadButton={true}
                  />
                  <div className="users-table-wrap" style={{maxHeight: "65vh", overflowY: "auto"}}>
                    <table className="users-table">
                        <thead>
                        <tr>
                            <th>LCE ID</th>
                            <th>Date</th>
                            <th style={{textAlign: "right"}}>Supplier Price</th>
                            <th style={{textAlign: "right"}}>Supplier Price (OMR)</th>
                            <th style={{textAlign: "right"}}>Total</th>
                            <th/>
                        </tr>
                        <tr>
                            <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.id ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, id: e.target.value }))} /></th>
                            <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.date ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, date: e.target.value }))} /></th>
                            <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.total_supplier_price ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, total_supplier_price: e.target.value }))} /></th>
                            <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.total_supplier_price_omr ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, total_supplier_price_omr: e.target.value }))} /></th>
                            <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.total ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, total: e.target.value }))} /></th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredRows.map((row) => (
                            <tr key={row.id}>
                                <td>{`LCE_${String(row.id).padStart(3, "0")}`}</td>
                                <td>{row.date}</td>
                                <td style={{textAlign: "right"}}>{row.total_supplier_price}</td>
                                <td style={{textAlign: "right"}}>{row.total_supplier_price_omr}</td>
                                <td style={{textAlign: "right"}}>{row.total}</td>
                                <td>
                                    <button
                                        type="button"
                                        className="users-action users-action--edit"
                                        title="Edit LCE"
                                        aria-label="Edit LCE"
                                        onClick={() => navigate(`/projects/costing/record/${row.id}`)}
                                    >
                                        <BsPencilSquare aria-hidden="true"/>
                                    </button>
                                    <button
                                        type="button"
                                        className="users-action users-action--delete"
                                        title="Delete LCE"
                                        aria-label="Delete LCE"
                                        style={{marginLeft: "0.45rem"}}
                                        onClick={() => handleDelete(row)}
                                    >
                                        <BsTrashFill aria-hidden="true"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {!filteredRows.length ? (
                            <tr>
                                <td colSpan={6} style={{textAlign: "center", color: "#8eb1af"}}>
                                    No LCE records found.
                                </td>
                            </tr>
                        ) : null}
                        </tbody>
                    </table>
                  </div>
                </>
            ) : null}
        </section>
    );
}

export default LceListPage;

