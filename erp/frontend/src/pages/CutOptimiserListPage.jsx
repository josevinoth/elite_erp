import { useEffect, useMemo, useState } from "react";
import { BsPencilSquare, BsTrashFill } from "react-icons/bs";
import { Link, useNavigate } from "react-router-dom";
import {
  listCutOptimiserRecords,
  deleteCutOptimiserRecord,
} from "../services/crudApi";
import TableSearchAndDownload from "../components/TableSearchAndDownload";

function formatCutId(cut_optimiser_id) {
  return cut_optimiser_id || "-";
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function CutOptimiserListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
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
    { key: "cut_optimiser_id", label: "Cut ID" },
    { key: "project_name", label: "Project" },
    { key: "revision", label: "Revision", exportValue: (row) => `R${row.revision || 1}` },
    { key: "updated_at", label: "Last Updated", exportValue: (row) => formatDateTime(row.updated_at) },
  ];

  const loadRows = async () => {
    setLoading(true);
    try {
      const data = await listCutOptimiserRecords();
      // Support both paginated and non-paginated responses
      setRows(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const onDelete = async (row) => {
    if (!window.confirm(`Delete ${formatCutId(row.cut_optimiser_id)}?`)) return;
    await deleteCutOptimiserRecord(row.id);
    loadRows();
  };

  return (
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title module-page__title--cutting" style={{ margin: 0 }}>Cut Optimiser List</h1>
        <Link
          className="crud-add-btn"
          title="Add Cut Optimiser"
          to="/projects/cut-optimiser/add"
          style={{ textDecoration: "none" }}
        >
          Add Cut Optimiser
        </Link>
      </div>

       <p className="module-page__description" style={{ marginBottom: "0.9rem" }}>
         Saved calculations with revision tracking by project.
       </p>

       <TableSearchAndDownload
         rows={filteredRows}
         columns={tableColumns}
         title="Cut Optimiser List"
         onSearchChange={setSearchText}
         showDownloadButton={true}
       />
       <div className="users-table-wrap" style={{ maxHeight: "68vh", overflowY: "auto" }}>
        <table className="users-table">
          <thead>
            <tr>
              <th>Cut ID</th>
              <th>Project</th>
              <th style={{ textAlign: "right" }}>Revision</th>
              <th>Last Updated</th>
               <th />
             </tr>
             <tr>
               <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.cut_optimiser_id ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, cut_optimiser_id: e.target.value }))} /></th>
               <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.project_name ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, project_name: e.target.value }))} /></th>
               <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.revision ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, revision: e.target.value }))} /></th>
               <th><input className="users-table__filter-input" type="text" placeholder="Filter" value={columnFilters.updated_at ?? ""} onChange={(e) => setColumnFilters(prev => ({ ...prev, updated_at: e.target.value }))} /></th>
               <th></th>
             </tr>
           </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center" }}>Loading...</td></tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatCutId(row.cut_optimiser_id)}</td>
                  <td>{row.project_name || "-"}</td>
                  <td style={{ textAlign: "right" }}>R{row.revision || 1}</td>
                  <td>{formatDateTime(row.updated_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="users-action users-action--edit"
                      title="Edit"
                      aria-label="Edit"
                      onClick={() => navigate(`/projects/cut-optimiser/record/${row.id}`)}
                    >
                      <BsPencilSquare aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="users-action users-action--delete"
                      title="Delete"
                      aria-label="Delete"
                      style={{ marginLeft: "0.45rem" }}
                      onClick={() => onDelete(row)}
                    >
                      <BsTrashFill aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#8eb1af" }}>
                  No cut optimiser records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default CutOptimiserListPage;

