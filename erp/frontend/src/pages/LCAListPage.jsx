import { useCallback } from "react";
import StandardListPage from "../components/StandardListPage";
import { deleteLcaActualsById, listLcaActuals } from "../services/crudApi";

const COLUMNS = [
  { key: "lca_id", label: "LCA ID", align: "center", headerAlign: "center" },
  { key: "total_supplier_price", label: "Supplier Price", align: "center", headerAlign: "center" },
  { key: "total_supplier_price_omr", label: "Supplier Price (OMR)", align: "center", headerAlign: "center" },
  { key: "total", label: "Total", align: "center", headerAlign: "center" },
  { key: "updated_by", label: "Updated By", align: "center", headerAlign: "center" },
  { key: "updated_on", label: "Updated On", align: "center", headerAlign: "center" },
];
function LCAListPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchText, setSearchText] = useState("");
  const [columnFilters, setColumnFilters] = useState({});

  const filteredRows = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase();
    const globalSearched = searchLower
      ? rows.filter((row) =>
          Object.values(row).some((value) =>
            String(value || "").toLowerCase().includes(searchLower)
          )
        )
      : rows;

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
    { key: "id", label: "LCA ID", exportValue: (row) => `LCA_${String(row.id).padStart(3, "0")}` },
    { key: "date", label: "Date" },
    { key: "total_supplier_price", label: "Supplier Price" },
    { key: "total_supplier_price_omr", label: "Supplier Price (OMR)" },
    { key: "total", label: "Total" },
    { key: "updated_by", label: "Updated By" },
    { key: "updated_on", label: "Updated On" },
  ];

function LCAListPage() {
  const fetchRows = useCallback(async () => {
    const data = await listLcaActuals();
    const rows = Array.isArray(data?.lca_actuals) ? data.lca_actuals : [];
    return rows.map((row) => ({
      ...row,
      lca_id: row.lca_id || `LCA_${String(row.id).padStart(3, "0")}`,
    }));
  }, []);

  return (
    <StandardListPage
      title="Landing Cost Actuals (LCA) List"
      columns={COLUMNS}
      fetchRows={fetchRows}
      rowKey="id"
      showAddButton
      addButtonTo="/projects/lca/add"
      addButtonLabel="Add LCA"
      editButtonTo={(row) => `/projects/lca/record/${row.id}`}
      deleteFn={deleteLcaActualsById}
      deleteConfirmFn={(row) => `Are you sure you want to delete LCA_${String(row.id).padStart(3, "0")}?`}
      showDefaultDelete
      includeAuditColumns={true}
      exportFileName="Landing Cost Actuals (LCA) List"
      defaultPageSize={20}
      pageSizeOptions={[10, 20, 50, 100]}
      tableMaxHeight="62vh"
    />
    <section className="module-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title module-page__title--projects" style={{ margin: 0 }}>
          Landing Cost Actuals (LCA) List
        </h1>
      </div>
      <p className="module-page__description" style={{ marginBottom: "0.9rem" }}>
        Showing saved Landing Cost Actuals (LCA) records. Click Edit to update a record.
      </p>

      {loading ? <p className="users-status">Loading LCA records...</p> : null}
      {error ? <p className="users-status users-status--error">{error}</p> : null}

      {!loading ? (
        <>
          <TableSearchAndDownload
            rows={filteredRows}
            columns={tableColumns}
            title="LCA List"
            onSearchChange={setSearchText}
            showDownloadButton={true}
            actions={[
              <Link
                key="add-lca"
                className="crud-add-btn"
                title="Add LCA"
                to="/projects/lca/add"
                style={{ textDecoration: "none" }}
              >
                + Add LCA
              </Link>,
            ]}
          />
          <div className="users-table-wrap" style={{ maxHeight: "65vh", overflowY: "auto" }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>LCA ID</th>
                  <th>Date</th>
                  <th style={{ textAlign: "right" }}>Supplier Price</th>
                  <th style={{ textAlign: "right" }}>Supplier Price (OMR)</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th>Updated By</th>
                  <th>Updated On</th>
                  <th />
                </tr>
                <tr>
                  <th>
                    <input
                      className="users-table__filter-input"
                      type="text"
                      placeholder="Filter"
                      value={columnFilters.id ?? ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, id: e.target.value }))}
                    />
                  </th>
                  <th>
                    <input
                      className="users-table__filter-input"
                      type="text"
                      placeholder="Filter"
                      value={columnFilters.date ?? ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, date: e.target.value }))}
                    />
                  </th>
                  <th>
                    <input
                      className="users-table__filter-input"
                      type="text"
                      placeholder="Filter"
                      value={columnFilters.total_supplier_price ?? ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, total_supplier_price: e.target.value }))}
                    />
                  </th>
                  <th>
                    <input
                      className="users-table__filter-input"
                      type="text"
                      placeholder="Filter"
                      value={columnFilters.total_supplier_price_omr ?? ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, total_supplier_price_omr: e.target.value }))}
                    />
                  </th>
                  <th>
                    <input
                      className="users-table__filter-input"
                      type="text"
                      placeholder="Filter"
                      value={columnFilters.total ?? ""}
                      onChange={(e) => setColumnFilters((prev) => ({ ...prev, total: e.target.value }))}
                    />
                  </th>
                  <th></th>
                  <th></th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatLcaId(row.id)}</td>
                    <td>{row.date}</td>
                    <td style={{ textAlign: "right" }}>{row.total_supplier_price}</td>
                    <td style={{ textAlign: "right" }}>{row.total_supplier_price_omr}</td>
                    <td style={{ textAlign: "right" }}>{row.total}</td>
                    <td>{row.updated_by || "—"}</td>
                    <td>{row.updated_on || (row.updated_at ? new Date(row.updated_at).toLocaleString() : "—")}</td>
                    <td>
                      <button
                        type="button"
                        className="users-action users-action--edit"
                        title="Edit LCA"
                        aria-label="Edit LCA"
                        onClick={() => navigate(`/projects/lca/record/${row.id}`)}
                      >
                        <BsPencilSquare aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="users-action users-action--delete"
                        title="Delete LCA"
                        aria-label="Delete LCA"
                        style={{ marginLeft: "0.45rem" }}
                        onClick={() => handleDelete(row)}
                      >
                        <BsTrashFill aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredRows.length ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#8eb1af" }}>
                      No LCA records found.
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

export default LCAListPage;
